const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function checkRapidApi() {
  const key = Deno.env.get("RAPIDAPI_KEY");
  const host = Deno.env.get("RAPIDAPI_HOST");
  if (!key || !host) {
    return { ok: false, configured: false, error: "Missing RAPIDAPI_KEY or RAPIDAPI_HOST" };
  }
  try {
    // Hit the host root — any non-401/403 response proves the API key is accepted by RapidAPI.
    const res = await fetch(`https://${host}/`, {
      headers: { "x-rapidapi-key": key, "x-rapidapi-host": host },
    });
    const text = await res.text();
    const authRejected = res.status === 401 || res.status === 403;
    return {
      ok: !authRejected,
      configured: true,
      status: res.status,
      host,
      authAccepted: !authRejected,
      sample: text.slice(0, 200),
    };
  } catch (e) {
    return { ok: false, configured: true, error: String(e) };
  }
}

async function checkTelegram() {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatIds = (Deno.env.get("TELEGRAM_CHAT_ID") ?? "")
    .split(",").map(s => s.trim()).filter(Boolean);
  if (!token) return { ok: false, configured: false, error: "Missing TELEGRAM_BOT_TOKEN" };

  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const me = await meRes.json();
    if (!meRes.ok || !me.ok) {
      return { ok: false, configured: true, status: meRes.status, error: me.description ?? "getMe failed" };
    }

    const sendResults: any[] = [];
    for (const chatId of chatIds) {
      const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "✅ Integration check: bot is responding correctly.",
        }),
      });
      const sendJson = await sendRes.json();
      sendResults.push({ chatId, ok: sendRes.ok && sendJson.ok, status: sendRes.status, description: sendJson.description });
    }

    return {
      ok: sendResults.every(r => r.ok),
      configured: true,
      bot: { id: me.result.id, username: me.result.username, name: me.result.first_name },
      chatIds,
      sendResults,
    };
  } catch (e) {
    return { ok: false, configured: true, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const target = url.searchParams.get("target"); // "rapidapi" | "telegram" | null (both)

  const result: Record<string, unknown> = {};
  if (!target || target === "rapidapi") result.rapidapi = await checkRapidApi();
  if (!target || target === "telegram") result.telegram = await checkTelegram();

  const allOk = Object.values(result).every((r: any) => r?.ok);
  return new Response(JSON.stringify({ ok: allOk, ...result }, null, 2), {
    status: allOk ? 200 : 502,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});