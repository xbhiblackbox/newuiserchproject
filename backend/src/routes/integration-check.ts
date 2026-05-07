import { Router, Request, Response } from "express";
import { getAdminChatIds } from "../lib/rapidapi";

const router = Router();

async function checkRapidApi() {
  const key  = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST ?? "instagram-looter2.p.rapidapi.com";
  if (!key) return { ok: false, configured: false, error: "Missing RAPIDAPI_KEY env var" };
  try {
    // Probe a known lightweight endpoint
    const res = await fetch(
      `https://${host}/id?username=instagram`,
      {
        headers: { "x-rapidapi-key": key, "x-rapidapi-host": host },
        signal: AbortSignal.timeout(10000),
      } as RequestInit
    );
    const text = await res.text();
    const authOk = res.status !== 401 && res.status !== 403;
    return {
      ok: authOk && res.status < 500,
      configured: true,
      status: res.status,
      host,
      sample: text.slice(0, 200),
    };
  } catch (e: any) {
    return { ok: false, configured: true, error: String(e) };
  }
}

async function checkTelegram() {
  const token   = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_CHAT_ID ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!token) return { ok: false, configured: false, error: "Missing TELEGRAM_BOT_TOKEN" };
  try {
    const meRes  = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const me     = await meRes.json() as any;
    if (!meRes.ok || !me.ok) return { ok: false, configured: true, error: me.description ?? "getMe failed" };

    const sendResults: any[] = [];
    for (const chatId of chatIds) {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "✅ Integration check: bot is responding correctly." }),
      });
      const j = await r.json() as any;
      sendResults.push({ chatId, ok: r.ok && j.ok, status: r.status });
    }
    return {
      ok: sendResults.every((r) => r.ok),
      configured: true,
      bot: { id: me.result.id, username: me.result.username },
      chatIds,
      sendResults,
    };
  } catch (e: any) {
    return { ok: false, configured: true, error: String(e) };
  }
}

// Probe instagram-looter2 endpoints for a given username
async function probeLooter2Paths(username: string) {
  const host = process.env.RAPIDAPI_HOST ?? "instagram-looter2.p.rapidapi.com";
  const key  = process.env.RAPIDAPI_KEY  ?? "";
  const headers = { "x-rapidapi-key": key, "x-rapidapi-host": host };

  const paths = [
    `/id?username=${username}`,
    `/web-profile?username=${username}`,
    `/profile?username=${username}`,
    `/reels?id=25025320`,          // instagram's own ID as smoke-test
    `/user-feeds?id=25025320`,
    `/highlights?id=25025320`,
    `/user-reels?id=25025320`,
    `/posts?id=25025320`,
  ];

  const results: Array<{ path: string; status: number; sample: string; ok: boolean }> = [];
  for (const path of paths) {
    try {
      const res = await fetch(`https://${host}${path}`, {
        headers,
        signal: AbortSignal.timeout(8000),
      } as RequestInit);
      const text = await res.text();
      results.push({ path, status: res.status, sample: text.slice(0, 150), ok: res.ok });
    } catch (e: any) {
      results.push({ path, status: 0, sample: String(e).slice(0, 100), ok: false });
    }
  }
  return results;
}

router.all("/", async (req: Request, res: Response): Promise<void> => {
  const target = req.query.target as string | undefined;
  const result: Record<string, unknown> = {};
  if (!target || target === "rapidapi") result.rapidapi = await checkRapidApi();
  if (!target || target === "telegram") result.telegram = await checkTelegram();
  const allOk = Object.values(result).every((r: any) => r?.ok);
  res.status(allOk ? 200 : 502).json({ ok: allOk, ...result });
});

// GET /integration-check/probe?username=whop
router.get("/probe", async (req: Request, res: Response): Promise<void> => {
  const username = (req.query.username as string) || "instagram";
  try {
    const results = await probeLooter2Paths(username);
    const working = results.filter((r) => r.ok);
    res.json({ username, api: process.env.RAPIDAPI_HOST ?? "instagram-looter2.p.rapidapi.com", working, all: results });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
