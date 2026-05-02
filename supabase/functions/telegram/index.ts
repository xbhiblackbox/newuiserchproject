import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

async function sendToAllAdmins(botToken: string, chatIds: string[], text: string) {
  const results = await Promise.allSettled(
    chatIds.map(id =>
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: id.trim(), text, parse_mode: "HTML" }),
      })
    )
  );
  return results;
}

function getAdminChatIds() {
  const ids = [
    Deno.env.get("TELEGRAM_ADMIN_CHAT_ID_1") || "",
    Deno.env.get("TELEGRAM_ADMIN_CHAT_ID_2") || "",
    ...(Deno.env.get("TELEGRAM_CHAT_ID") || "").split(","),
  ];
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: "Missing text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatIds = getAdminChatIds();

    if (!botToken || chatIds.length === 0) {
      return new Response(JSON.stringify({ error: "Telegram not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const results = await sendToAllAdmins(botToken, chatIds, text);
    console.log("Telegram send results:", results.length, "admins");

    return new Response(JSON.stringify({ ok: true, sent_to: chatIds.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
