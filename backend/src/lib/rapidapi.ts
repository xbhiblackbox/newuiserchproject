import { query, queryOne, execute } from "./db";

// ---- Active RapidAPI key with 30s in-memory cache ----
// Mirrors the Supabase edge function behavior exactly.
let ACTIVE_KEY_CACHE: { key: string; at: number } | null = null;
const ACTIVE_KEY_TTL_MS = 30_000;

export async function getActiveRapidKey(): Promise<string> {
  if (ACTIVE_KEY_CACHE && Date.now() - ACTIVE_KEY_CACHE.at < ACTIVE_KEY_TTL_MS) {
    return ACTIVE_KEY_CACHE.key;
  }
  // PRIORITY: env var > Supabase DB
  // If RAPIDAPI_KEY is set in Railway env, always use it (most up-to-date)
  const envKey = process.env.RAPIDAPI_KEY?.trim();
  if (envKey && envKey.length > 0) {
    ACTIVE_KEY_CACHE = { key: envKey, at: Date.now() };
    return envKey;
  }
  // Fallback: try Supabase api_settings table
  try {
    const row = await queryOne<{ current_key: string | null }>(
      "SELECT current_key FROM api_settings WHERE id = 1 LIMIT 1"
    );
    const k = row?.current_key?.trim();
    const finalKey = k && k.length > 0 ? k : "";
    ACTIVE_KEY_CACHE = { key: finalKey, at: Date.now() };
    return finalKey;
  } catch {
    return "";
  }
}

export function invalidateActiveKeyCache(): void {
  ACTIVE_KEY_CACHE = null;
}

// ---- Usage counter + quota alerts (fire-and-forget) ----
export async function incrementApiUsageAndAlert(): Promise<void> {
  try {
    const row = await queryOne<{
      monthly_limit: number;
      used_count: number;
      alerted_warning: boolean;
      alerted_urgent: boolean;
      period_start: string;
    }>(
      "SELECT monthly_limit, used_count, alerted_warning, alerted_urgent, period_start FROM api_settings WHERE id = 1"
    );
    if (!row) return;

    const now = new Date();
    const ps = new Date(row.period_start);
    let used = row.used_count;
    let warned = row.alerted_warning;
    let urgent = row.alerted_urgent;
    let resetPeriod = false;

    if (
      ps.getUTCFullYear() !== now.getUTCFullYear() ||
      ps.getUTCMonth() !== now.getUTCMonth()
    ) {
      used = 0;
      warned = false;
      urgent = false;
      resetPeriod = true;
    }
    used += 1;

    const limit = row.monthly_limit || 500;
    const remaining = Math.max(0, limit - used);

    let triggerWarning = false;
    let triggerUrgent = false;
    if (!urgent && remaining <= 5) { triggerUrgent = true; urgent = true; }
    else if (!warned && remaining <= 10) { triggerWarning = true; warned = true; }

    if (resetPeriod) {
      await execute(
        `UPDATE api_settings SET used_count=$1, alerted_warning=$2, alerted_urgent=$3, period_start=$4, updated_at=$5 WHERE id=1`,
        [used, warned, urgent, now.toISOString(), now.toISOString()]
      );
    } else {
      await execute(
        `UPDATE api_settings SET used_count=$1, alerted_warning=$2, alerted_urgent=$3, updated_at=$4 WHERE id=1`,
        [used, warned, urgent, now.toISOString()]
      );
    }

    if (triggerWarning || triggerUrgent) {
      sendQuotaAlert({ used, limit, remaining, urgent: triggerUrgent }).catch(() => null);
    }
  } catch {
    // best-effort
  }
}

async function sendQuotaAlert(opts: {
  used: number;
  limit: number;
  remaining: number;
  urgent: boolean;
}): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = getAdminChatIds();
  if (!botToken || chatIds.length === 0) return;

  const { used, limit, remaining, urgent } = opts;
  const header = urgent
    ? `🚨🚨 <b>URGENT — RAPIDAPI QUOTA ALMOST GONE</b> 🚨🚨`
    : `⚠️ <b>RAPIDAPI QUOTA WARNING</b> ⚠️`;

  const msg =
    `${header}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 <b>Used:</b> <code>${used} / ${limit}</code>\n` +
    `🔻 <b>Remaining:</b> <code>${remaining}</code> searches\n\n` +
    (urgent
      ? `🔥 Sirf <b>${remaining}</b> searches bachi hain!\n💀 Iske baad searches band ho jayengi.\n\n`
      : `⏳ Sirf <b>${remaining}</b> searches bachi hain.\n📌 Naya RapidAPI key ready rakho.\n\n`) +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🛠 <b>Naya API key submit karne ke liye:</b>\n<code>/setapi YOUR_NEW_RAPIDAPI_KEY</code>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🚀 <b>DARKSIDEX — ZERO DOWNTIME</b> 🌙`;

  await Promise.allSettled(
    chatIds.map((id) =>
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: id,
          text: msg,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }).catch(() => null)
    )
  );
}

export function getAdminChatIds(): string[] {
  const ids = [
    process.env.TELEGRAM_ADMIN_CHAT_ID_1 || "",
    process.env.TELEGRAM_ADMIN_CHAT_ID_2 || "",
    ...(process.env.TELEGRAM_CHAT_ID || "").split(","),
  ];
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

export const RAPIDAPI_HOST =
  process.env.RAPIDAPI_HOST ?? "instagram-looter2.p.rapidapi.com";

// Central callRapid — sets x-rapidapi-* headers, 40s timeout
export async function callRapid(
  path: string,
  init: RequestInit,
  onBilled?: () => void
): Promise<any> {
  const url = `https://${RAPIDAPI_HOST}${path}`;
  const activeKey = await getActiveRapidKey();
  const startedAt = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40000);

  try {
    const r = await fetch(url, {
      ...init,
      headers: {
        ...((init.headers as Record<string, string>) ?? {}),
        "x-rapidapi-key": activeKey,
        "x-rapidapi-host": RAPIDAPI_HOST,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await r.text();
    if (!r.ok) throw new Error(`RapidAPI ${r.status}: ${text.slice(0, 200)}`);
    if (onBilled) {
      onBilled();
      // fire-and-forget quota increment
      incrementApiUsageAndAlert().catch(() => null);
    }
    try { return JSON.parse(text); } catch { return {}; }
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}
