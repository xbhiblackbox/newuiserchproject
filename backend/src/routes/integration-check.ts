import { Router, Request, Response } from "express";
import { getActiveRapidKey } from "../lib/rapidapi";

const router = Router();

async function checkRapidApi() {
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST;
  if (!key || !host) return { ok: false, configured: false, error: "Missing RAPIDAPI_KEY or RAPIDAPI_HOST" };
  try {
    const res = await fetch(`https://${host}/`, {
      headers: { "x-rapidapi-key": key, "x-rapidapi-host": host },
      signal: AbortSignal.timeout(8000),
    } as RequestInit);
    const text = await res.text();
    const authRejected = res.status === 401 || res.status === 403;
    return { ok: !authRejected, configured: true, status: res.status, host, authAccepted: !authRejected, sample: text.slice(0, 200) };
  } catch (e: any) {
    return { ok: false, configured: true, error: String(e) };
  }
}

async function checkTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_CHAT_ID ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!token) return { ok: false, configured: false, error: "Missing TELEGRAM_BOT_TOKEN" };
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const me = await meRes.json() as any;
    if (!meRes.ok || !me.ok) return { ok: false, configured: true, status: meRes.status, error: me.description ?? "getMe failed" };

    const sendResults: any[] = [];
    for (const chatId of chatIds) {
      const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "✅ Integration check: bot is responding correctly." }),
      });
      const sendJson = await sendRes.json() as any;
      sendResults.push({ chatId, ok: sendRes.ok && sendJson.ok, status: sendRes.status, description: sendJson.description });
    }
    return { ok: sendResults.every((r) => r.ok), configured: true, bot: { id: me.result.id, username: me.result.username, name: me.result.first_name }, chatIds, sendResults };
  } catch (e: any) {
    return { ok: false, configured: true, error: String(e) };
  }
}

// Probe endpoint: tests all known instagram-looter2 paths to find which ones work
async function probeRapidApiPaths(username: string) {
  const host = process.env.RAPIDAPI_HOST ?? "instagram-looter2.p.rapidapi.com";
  const key = await getActiveRapidKey();

  const paths = [
    `/web-profile-info?username=${username}`,
    `/web-profile?username=${username}`,
    `/profile?username=${username}`,
    `/user-info?username=${username}`,
    `/account-info?username=${username}`,
    `/userinfo?username=${username}`,
    `/user?username=${username}`,
    `/get-user?username=${username}`,
    `/users?username=${username}`,
    `/user-by-username?username=${username}`,
    `/v1/info?username_or_id_or_url=${username}`,
    `/v1/user?username=${username}`,
    `/v2/user?username=${username}`,
    `/id?username=${username}`,
    `/user-id?username=${username}`,
  ];

  const results: Array<{ path: string; status: number; sample: string; hasData: boolean }> = [];
  for (const path of paths) {
    try {
      const res = await fetch(`https://${host}${path}`, {
        headers: { "x-rapidapi-key": key, "x-rapidapi-host": host },
        signal: AbortSignal.timeout(6000),
      } as RequestInit);
      const text = await res.text();
      let parsed: any = {};
      try { parsed = JSON.parse(text); } catch {}
      const hasData = res.ok && !text.includes("does not exist") && !text.includes("not found") && (
        parsed?.username || parsed?.data?.username || parsed?.user?.username ||
        parsed?.pk || parsed?.id || parsed?.data?.id ||
        (typeof parsed === "string" && /^\d{5,}$/.test(parsed.trim()))
      );
      results.push({ path, status: res.status, sample: text.slice(0, 150), hasData: !!hasData });
    } catch (e: any) {
      results.push({ path, status: 0, sample: String(e).slice(0, 100), hasData: false });
    }
  }
  return results;
}

router.all("/", async (req: Request, res: Response): Promise<void> => {
  const target = (req.query.target as string | undefined);
  const result: Record<string, unknown> = {};
  if (!target || target === "rapidapi") result.rapidapi = await checkRapidApi();
  if (!target || target === "telegram") result.telegram = await checkTelegram();
  const allOk = Object.values(result).every((r: any) => r?.ok);
  res.status(allOk ? 200 : 502).json({ ok: allOk, ...result });
});

// GET /functions/v1/integration-check/probe?username=whop
router.get("/probe", async (req: Request, res: Response): Promise<void> => {
  const username = (req.query.username as string) || "instagram";
  try {
    const results = await probeRapidApiPaths(username);
    const working = results.filter(r => r.hasData);
    res.json({ username, working, all: results });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
