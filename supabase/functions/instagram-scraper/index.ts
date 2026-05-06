const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trace-id, x-replay-of, x-access-key, x-device-fp",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-trace-id, x-cache, x-cache-age, x-duration-ms, x-cache-heatmap, x-cache-stats",
};

let RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY") ?? "";
const RAPIDAPI_HOST = Deno.env.get("RAPIDAPI_HOST") ?? "instagram120.p.rapidapi.com";

// ---- Active RapidAPI key & quota tracking ----
// The active key can be overridden via api_settings.current_key (managed
// from Telegram via /setapi). We cache the lookup briefly to avoid hitting
// the DB on every scrape.
let ACTIVE_KEY_CACHE: { key: string; at: number } | null = null;
const ACTIVE_KEY_TTL_MS = 30_000;

async function getActiveRapidKey(): Promise<string> {
  if (ACTIVE_KEY_CACHE && Date.now() - ACTIVE_KEY_CACHE.at < ACTIVE_KEY_TTL_MS) {
    return ACTIVE_KEY_CACHE.key;
  }
  if (!SUPABASE_URL_ENV || !SUPABASE_SRK) return RAPIDAPI_KEY;
  try {
    const r = await fetch(
      `${SUPABASE_URL_ENV}/rest/v1/api_settings?id=eq.1&select=current_key&limit=1`,
      {
        headers: {
          apikey: SUPABASE_SRK,
          Authorization: `Bearer ${SUPABASE_SRK}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(2000),
      },
    );
    if (r.ok) {
      const rows = await r.json() as Array<{ current_key: string | null }>;
      const k = rows?.[0]?.current_key?.trim();
      const finalKey = k && k.length > 0 ? k : RAPIDAPI_KEY;
      ACTIVE_KEY_CACHE = { key: finalKey, at: Date.now() };
      return finalKey;
    }
  } catch (_) { /* fall back */ }
  return RAPIDAPI_KEY;
}

function invalidateActiveKeyCache() { ACTIVE_KEY_CACHE = null; }

// Increment usage counter & send alerts when thresholds are crossed.
// Fire-and-forget: never blocks the user response.
async function incrementApiUsageAndAlert(): Promise<void> {
  if (!SUPABASE_URL_ENV || !SUPABASE_SRK) return;
  try {
    const r = await fetch(
      `${SUPABASE_URL_ENV}/rest/v1/api_settings?id=eq.1&select=monthly_limit,used_count,alerted_warning,alerted_urgent,period_start`,
      {
        headers: {
          apikey: SUPABASE_SRK,
          Authorization: `Bearer ${SUPABASE_SRK}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(2500),
      },
    );
    if (!r.ok) return;
    const rows = await r.json() as Array<{
      monthly_limit: number; used_count: number;
      alerted_warning: boolean; alerted_urgent: boolean;
      period_start: string;
    }>;
    const row = rows?.[0];
    if (!row) return;

    // Auto-reset if a new calendar month started
    const now = new Date();
    const ps = new Date(row.period_start);
    let used = row.used_count;
    let warned = row.alerted_warning;
    let urgent = row.alerted_urgent;
    let resetPeriod = false;
    if (ps.getUTCFullYear() !== now.getUTCFullYear() || ps.getUTCMonth() !== now.getUTCMonth()) {
      used = 0; warned = false; urgent = false; resetPeriod = true;
    }
    used += 1;

    const limit = row.monthly_limit || 500;
    const remaining = Math.max(0, limit - used);

    let triggerWarning = false;
    let triggerUrgent = false;
    if (!urgent && remaining <= 5) { triggerUrgent = true; urgent = true; }
    else if (!warned && remaining <= 10) { triggerWarning = true; warned = true; }

    const patch: Record<string, unknown> = {
      used_count: used,
      alerted_warning: warned,
      alerted_urgent: urgent,
      updated_at: now.toISOString(),
    };
    if (resetPeriod) patch.period_start = now.toISOString();

    await fetch(`${SUPABASE_URL_ENV}/rest/v1/api_settings?id=eq.1`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SRK,
        Authorization: `Bearer ${SUPABASE_SRK}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
      signal: AbortSignal.timeout(2500),
    }).catch(() => null);

    if (triggerWarning || triggerUrgent) {
      sendQuotaAlert({ used, limit, remaining, urgent: triggerUrgent });
    }
  } catch (_) { /* best-effort */ }
}

function sendQuotaAlert(opts: { used: number; limit: number; remaining: number; urgent: boolean }) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
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
      ? `🔥 Sirf <b>${remaining}</b> searches bachi hain!\n` +
        `💀 Iske baad searches band ho jayengi.\n\n`
      : `⏳ Sirf <b>${remaining}</b> searches bachi hain.\n` +
        `📌 Naya RapidAPI key ready rakho.\n\n`) +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🛠 <b>Naya API key submit karne ke liye:</b>\n` +
    `<code>/setapi YOUR_NEW_RAPIDAPI_KEY</code>\n\n` +
    `📍 New Gmail se RapidAPI account banao →\n` +
    `   Instagram120 API subscribe (free) →\n` +
    `   API key copy karo →\n` +
    `   Yahan <code>/setapi KEY</code> bhejo.\n\n` +
    `✅ Submit karte hi quota auto-reset ho jayega\n` +
    `   aur users bina ruke search karte rahenge.\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🚀 <b>DARKSIDEX — ZERO DOWNTIME</b> 🌙`;

  const task = (async () => {
    await Promise.allSettled(
      chatIds.map((id) =>
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: id, text: msg, parse_mode: "HTML", disable_web_page_preview: true }),
        }).catch(() => null)
      )
    );
  })();
  // @ts-ignore EdgeRuntime is a Supabase Deno global
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(task);
  }
}

// ---- L2 persistent cache (Postgres) ----
// In-memory cache (L1) is per-isolate. When Supabase scales out under load,
// each cold isolate would otherwise re-hit RapidAPI. The L2 cache is shared
// across ALL isolates via the `search_cache` table, so the second request to
// any username — from any region — is a cache hit instead of a paid API call.
const SUPABASE_URL_ENV = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const L2_TTL_SECONDS = 30 * 60; // 30 min — matches the spirit of HARD_TTL_MS

// ---------------------------------------------------------------------------
// ACCESS KEY GATE — server-side authorization.
// Every POST must include x-access-key + x-device-fp headers. We validate
// against the access_keys table. This blocks any attempt to bypass the
// client-side login (removing KeyGuard, editing localStorage, hitting the
// function URL directly with the public anon key, etc.).
// ---------------------------------------------------------------------------
const KEY_CACHE = new Map<string, { ok: boolean; at: number; label?: string }>();
const WEB_PROFILE_CACHE = new Map<string, { at: number; payload: any }>();
const WEB_PROFILE_TTL_MS = 2 * 60 * 1000;

// Mask the access key so admin notifications never leak the full secret.
// Shows first 4 + last 4 with bullet padding (e.g. "ABCD••••WXYZ").
function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return key[0] + "•••" + key[key.length - 1];
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}
const KEY_CACHE_TTL_MS = 30_000;

async function validateAccessKey(key: string, fp: string): Promise<{ ok: boolean; reason?: string; label?: string; keyMasked?: string }> {
  if (!key || !fp) return { ok: false, reason: "missing_credentials" };
  if (!SUPABASE_URL_ENV || !SUPABASE_SRK) return { ok: false, reason: "server_misconfig" };

  const cacheKey = `${key}::${fp}`;
  const cached = KEY_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < KEY_CACHE_TTL_MS) {
    return cached.ok
      ? { ok: true, label: cached.label, keyMasked: maskKey(key) }
      : { ok: false, reason: "cached_reject" };
  }

  try {
    const url = `${SUPABASE_URL_ENV}/rest/v1/access_keys?key=eq.${encodeURIComponent(key)}&select=active,expires_at,device_fingerprints,max_devices,label&limit=1`;
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_SRK,
        Authorization: `Bearer ${SUPABASE_SRK}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return { ok: false, reason: "lookup_failed" };
    const rows = (await r.json()) as Array<{
      id?: string;
      active: boolean;
      expires_at: string | null;
      device_fingerprints: string[] | null;
      max_devices: number | null;
      label: string | null;
    }>;
    const row = rows?.[0];
    if (!row) {
      KEY_CACHE.set(cacheKey, { ok: false, at: Date.now() });
      return { ok: false, reason: "invalid_key" };
    }
    if (!row.active) {
      KEY_CACHE.set(cacheKey, { ok: false, at: Date.now() });
      return { ok: false, reason: "deactivated" };
    }
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      KEY_CACHE.set(cacheKey, { ok: false, at: Date.now() });
      return { ok: false, reason: "expired" };
    }
    const fps = row.device_fingerprints || [];
    if (!fps.includes(fp)) {
      // Auto-register this device if there's room — matches check-key-status
      // behavior so existing users (logged in before the gate existed) and
      // new logins both work seamlessly.
      const maxDev = row.max_devices ?? 1;
      if (fps.length >= maxDev) {
        KEY_CACHE.set(cacheKey, { ok: false, at: Date.now() });
        return { ok: false, reason: "device_limit_reached" };
      }
      try {
        const updated = [...fps, fp];
        await fetch(
          `${SUPABASE_URL_ENV}/rest/v1/access_keys?key=eq.${encodeURIComponent(key)}`,
          {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_SRK,
              Authorization: `Bearer ${SUPABASE_SRK}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              device_fingerprints: updated,
              updated_at: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(3000),
          },
        );
      } catch (_e) {
        // Even if the write fails, allow this request — next call will retry.
      }
    }
    const label = row.label || "User";
    KEY_CACHE.set(cacheKey, { ok: true, at: Date.now(), label });
    return { ok: true, label, keyMasked: maskKey(key) };
  } catch (_e) {
    return { ok: false, reason: "lookup_error" };
  }
}

async function l2Get(cacheKey: string): Promise<{ payload: unknown; ageMs: number } | null> {
  if (!SUPABASE_URL_ENV || !SUPABASE_SRK) return null;
  try {
    const url = `${SUPABASE_URL_ENV}/rest/v1/search_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&select=payload,stored_at,expires_at&limit=1`;
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_SRK,
        Authorization: `Bearer ${SUPABASE_SRK}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(2000),
    });
    if (!r.ok) { await r.text().catch(() => null); return null; }
    const rows = await r.json() as Array<{ payload: unknown; stored_at: string; expires_at: string }>;
    if (!rows.length) return null;
    const row = rows[0];
    if (Date.now() > new Date(row.expires_at).getTime()) return null;
    return { payload: row.payload, ageMs: Date.now() - new Date(row.stored_at).getTime() };
  } catch {
    return null;
  }
}

async function l2Set(cacheKey: string, username: string, type: string, pages: number, payload: unknown): Promise<void> {
  if (!SUPABASE_URL_ENV || !SUPABASE_SRK) return;
  try {
    const expiresAt = new Date(Date.now() + L2_TTL_SECONDS * 1000).toISOString();
    const url = `${SUPABASE_URL_ENV}/rest/v1/search_cache?on_conflict=cache_key`;
    await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SRK,
        Authorization: `Bearer ${SUPABASE_SRK}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([{
        cache_key: cacheKey,
        username,
        type,
        pages,
        payload,
        stored_at: new Date().toISOString(),
        expires_at: expiresAt,
      }]),
      signal: AbortSignal.timeout(3000),
    }).then((r) => r.text()).catch(() => null);
  } catch {
    // best-effort cache, never block the response
  }
}

// ---- Telegram admin broadcast (fire-and-forget) ----
// Sends a stylish notification to ALL configured admins whenever a user
// triggers a username search. Used to keep both admins in real-time sync
// and to highlight that each search has a real RapidAPI cost.
function getAdminChatIds(): string[] {
  const ids = [
    Deno.env.get("TELEGRAM_ADMIN_CHAT_ID_1") || "",
    Deno.env.get("TELEGRAM_ADMIN_CHAT_ID_2") || "",
    ...(Deno.env.get("TELEGRAM_CHAT_ID") || "").split(","),
  ];
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

// Per-instance counter so admins see which # search this is.
let SEARCH_SEQ = 0;

function broadcastSearchToAdmins(
  username: string,
  type: string,
  traceId: string,
  searcher?: { label?: string; keyMasked?: string },
) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatIds = getAdminChatIds();
  if (!botToken || chatIds.length === 0) return;

  SEARCH_SEQ += 1;
  const seq = SEARCH_SEQ;
  const ts = new Date().toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: true,
  });

  const who = searcher?.label || "Unknown";
  const keyMasked = searcher?.keyMasked || "—";
  const msg =
    `🛰️ <b>𝗗𝗔𝗥𝗞𝗦𝗜𝗗𝗘𝗫 • 𝗟𝗜𝗩𝗘 𝗦𝗘𝗔𝗥𝗖𝗛</b> 🛰️\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>Searcher:</b> <code>${who}</code>\n` +
    `🔑 <b>Access Key:</b> <code>${keyMasked}</code>\n` +
    `🔎 <b>Target:</b> <code>@${username}</code>\n` +
    `📦 <b>Scope:</b> <code>${type}</code>\n` +
    `🆔 <b>Trace:</b> <code>${traceId}</code>\n` +
    `📊 <b>Search #</b> <code>${seq}</code>\n` +
    `⏱ <b>Time:</b> ${ts}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💸 <b>RapidAPI billed:</b> 1 lookup\n` +
    `🔐 <b>Visible to:</b> <i>ALL admins (real-time sync)</i>\n` +
    `🛡️ <i>Zero-cheat mode — every query logged on both sides.</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🚀 <b>DARKSIDEX • TO THE MOON</b> 🌙`;

  const task = (async () => {
    await Promise.allSettled(
      chatIds.map((id) =>
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: id, text: msg, parse_mode: "HTML", disable_web_page_preview: true }),
        }).catch(() => null)
      )
    );
  })();
  // @ts-ignore EdgeRuntime is a Supabase Deno global
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(task);
  }
}

// ---- structured logging ----
// Every log line is a single-line JSON object, easy to grep / filter in
// supabase function logs UI. Trace IDs are propagated through every call so
// you can follow one user's request end-to-end.
const newTraceId = (): string => {
  // 12-char base36 id — short, unique enough for log correlation
  return (
    Date.now().toString(36).slice(-6) +
    Math.random().toString(36).slice(2, 8)
  );
};

type LogLevel = "info" | "warn" | "error" | "debug";
const slog = (
  level: LogLevel,
  traceId: string,
  event: string,
  fields: Record<string, unknown> = {},
) => {
  const line = JSON.stringify({
    t: new Date().toISOString(),
    level,
    trace: traceId,
    event,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

// Per-request RapidAPI timing collector. Stored on a context object that
// flows through buildResult so we can emit one aggregated summary per request.
interface ReqCtx {
  traceId: string;
  username: string;
  type: string;
  startedAt: number;
  rapidCalls: Array<{ path: string; ms: number; status: "ok" | "err"; err?: string }>;
}
const newCtx = (traceId: string, username: string, type: string): ReqCtx => ({
  traceId,
  username,
  type,
  startedAt: Date.now(),
  rapidCalls: [],
});

// Sort RapidAPI calls slowest-first and keep the top N for compact reporting.
// Used both inline in structured logs and attached to the JSON response under
// `_debug.rapidCalls` for client-side debugging without re-querying logs.
const slowestRapidCalls = (
  ctx: ReqCtx,
  limit = 5,
): Array<{ path: string; ms: number; status: "ok" | "err"; err?: string }> => {
  return ctx.rapidCalls
    .slice()
    .sort((a, b) => b.ms - a.ms)
    .slice(0, limit)
    .map(c => ({ path: c.path, ms: c.ms, status: c.status, ...(c.err ? { err: c.err.slice(0, 120) } : {}) }));
};

// Build a debug summary that we attach to the JSON payload. Kept small to
// avoid bloating responses.
const buildDebugSummary = (ctx: ReqCtx, totalMs: number) => {
  const rapidTotalMs = ctx.rapidCalls.reduce((s, c) => s + c.ms, 0);
  return {
    traceId: ctx.traceId,
    totalMs,
    rapidCalls: ctx.rapidCalls.length,
    rapidTotalMs,
    rapidErrors: ctx.rapidCalls.filter(c => c.status === "err").length,
    slowest: slowestRapidCalls(ctx, 5),
  };
};

// ---- trace recorder ----
// Captures the inputs + outcome of each non-replay request, keyed by trace id,
// so we can re-run that exact request later via ?debug=replay&trace=<id> and
// diff cache state, latency, and RapidAPI calls against the original.
interface TraceRecord {
  traceId: string;
  recordedAt: number;
  // inputs (enough to reconstruct an equivalent POST body)
  username: string;
  type: string;
  pages: number;
  cursor: string;
  force: boolean;
  // outcome
  cache: string;             // HIT | STALE | MISS | BYPASS | COALESCED | PAGINATE | ERROR
  totalMs: number;
  rapidCalls: number;
  rapidTotalMs: number;
  rapidErrors: number;
  slowest: Array<{ path: string; ms: number; status: "ok" | "err"; err?: string }>;
  err?: string;
}
const TRACES = new Map<string, TraceRecord>();
const TRACES_MAX = 500;

const recordTrace = (rec: TraceRecord) => {
  if (TRACES.size >= TRACES_MAX) {
    // Evict oldest by recordedAt to bound memory.
    let oldKey: string | null = null; let oldAt = Infinity;
    for (const [k, v] of TRACES) {
      if (v.recordedAt < oldAt) { oldAt = v.recordedAt; oldKey = k; }
    }
    if (oldKey) TRACES.delete(oldKey);
  }
  TRACES.set(rec.traceId, rec);
};

const tracesSnapshot = (limit = 50) => {
  return Array.from(TRACES.values())
    .sort((a, b) => b.recordedAt - a.recordedAt)
    .slice(0, limit);
};

// Compute a compact diff between original trace and the replay outcome.
// Useful to spot cache state changes (MISS → HIT) and latency drift.
const diffTrace = (orig: TraceRecord, rep: TraceRecord) => ({
  cache: { from: orig.cache, to: rep.cache, changed: orig.cache !== rep.cache },
  totalMs: { from: orig.totalMs, to: rep.totalMs, deltaMs: rep.totalMs - orig.totalMs },
  rapidCalls: { from: orig.rapidCalls, to: rep.rapidCalls, delta: rep.rapidCalls - orig.rapidCalls },
  rapidTotalMs: { from: orig.rapidTotalMs, to: rep.rapidTotalMs, deltaMs: rep.rapidTotalMs - orig.rapidTotalMs },
  rapidErrors: { from: orig.rapidErrors, to: rep.rapidErrors, delta: rep.rapidErrors - orig.rapidErrors },
  slowestPath: {
    from: orig.slowest[0]?.path ?? null,
    to: rep.slowest[0]?.path ?? null,
  },
});


// ---- in-memory cache & request coalescing (per edge instance) ----
// Survives between invocations on the same warm instance, dramatically reducing
// RapidAPI calls when many users hit the same usernames concurrently.
// Stale-While-Revalidate cache:
//   - Within SOFT TTL (5 min): return cached, no refresh
//   - Between SOFT and HARD TTL (60 min): return cached INSTANTLY, refresh in background
//   - After HARD TTL: cache miss, must scrape
interface CacheRec { storedAt: number; hardExp: number; payload: unknown; hits: number }
const RESP_CACHE = new Map<string, CacheRec>();
const INFLIGHT = new Map<string, Promise<unknown>>();
const REVALIDATING = new Set<string>(); // dedupe background refreshes
const SOFT_TTL_MS = 5 * 60 * 1000;   // serve fresh without refresh
const HARD_TTL_MS = 60 * 60 * 1000;  // can serve stale up to this long
const RESP_CACHE_MAX = 500;

// ---- cache-key collision detection ----
// Tracks which (username, type, pages) inputs originally produced each cacheKey.
// If a different input later maps to the same key, that means our key formula
// is lossy and two distinct logical requests would share a cached payload.
// Bounded LRU-ish to keep memory in check.
interface KeyOrigin { username: string; type: string; pages: number; firstSeenAt: number; lastSeenAt: number }
const KEY_ORIGINS = new Map<string, KeyOrigin>();
const KEY_ORIGINS_MAX = 1000;

const checkKeyCollision = (
  cacheKey: string,
  username: string,
  type: string,
  pages: number,
  traceId: string,
) => {
  const existing = KEY_ORIGINS.get(cacheKey);
  if (existing) {
    if (existing.username !== username || existing.type !== type || existing.pages !== pages) {
      // Two different inputs collapsed to the same cacheKey — this is a bug
      // in the key formula. Log both inputs so it's easy to reproduce.
      slog("warn", traceId, "cache_key_collision", {
        cacheKey,
        existing: {
          username: existing.username,
          type: existing.type,
          pages: existing.pages,
          firstSeenAt: new Date(existing.firstSeenAt).toISOString(),
        },
        incoming: { username, type, pages },
      });
    }
    existing.lastSeenAt = Date.now();
    return;
  }
  if (KEY_ORIGINS.size >= KEY_ORIGINS_MAX) {
    // Evict the entry with the oldest lastSeenAt to bound memory.
    let oldKey: string | null = null; let oldAt = Infinity;
    for (const [k, v] of KEY_ORIGINS) {
      if (v.lastSeenAt < oldAt) { oldAt = v.lastSeenAt; oldKey = k; }
    }
    if (oldKey) KEY_ORIGINS.delete(oldKey);
  }
  KEY_ORIGINS.set(cacheKey, {
    username, type, pages,
    firstSeenAt: Date.now(),
    lastSeenAt: Date.now(),
  });
};

interface CacheLookup { payload: unknown; isStale: boolean; ageMs: number }

const cacheGet = (k: string): CacheLookup | null => {
  const r = RESP_CACHE.get(k);
  if (!r) return null;
  const age = Date.now() - r.storedAt;
  if (Date.now() > r.hardExp) { RESP_CACHE.delete(k); return null; }
  r.hits++;
  return { payload: r.payload, isStale: age > SOFT_TTL_MS, ageMs: age };
};
const cacheSet = (k: string, payload: unknown) => {
  if (RESP_CACHE.size >= RESP_CACHE_MAX) {
    // Evict the least-popular entry instead of FIFO so hot usernames stay warm.
    let coldKey: string | null = null;
    let coldHits = Infinity;
    for (const [key, rec] of RESP_CACHE) {
      if (rec.hits < coldHits) { coldHits = rec.hits; coldKey = key; }
    }
    if (coldKey) RESP_CACHE.delete(coldKey);
  }
  const prev = RESP_CACHE.get(k);
  RESP_CACHE.set(k, {
    storedAt: Date.now(),
    hardExp: Date.now() + HARD_TTL_MS,
    payload,
    hits: prev?.hits ?? 0,
  });
};

// ---- cache heatmap ----
// Per-instance counters of HIT / STALE / MISS / BYPASS / COALESCED / PAGINATE
// per username. Used to (a) emit a compact "top usernames" header on every
// response for quick debugging, and (b) power the GET /debug endpoint.
type HeatState = "HIT" | "STALE" | "MISS" | "BYPASS" | "COALESCED" | "PAGINATE";
interface HeatRec {
  HIT: number; STALE: number; MISS: number;
  BYPASS: number; COALESCED: number; PAGINATE: number;
  total: number; lastAt: number;
}
const HEATMAP = new Map<string, HeatRec>();
const HEATMAP_MAX = 200;

const heatTrack = (username: string, state: HeatState) => {
  let r = HEATMAP.get(username);
  if (!r) {
    if (HEATMAP.size >= HEATMAP_MAX) {
      // Evict the entry with the oldest lastAt (LRU-ish) to keep memory bounded.
      let oldKey: string | null = null; let oldAt = Infinity;
      for (const [k, v] of HEATMAP) {
        if (v.lastAt < oldAt) { oldAt = v.lastAt; oldKey = k; }
      }
      if (oldKey) HEATMAP.delete(oldKey);
    }
    r = { HIT: 0, STALE: 0, MISS: 0, BYPASS: 0, COALESCED: 0, PAGINATE: 0, total: 0, lastAt: 0 };
    HEATMAP.set(username, r);
  }
  r[state]++;
  r.total++;
  r.lastAt = Date.now();
};

// Top-N usernames per state, compact header-friendly format: "user:count,user:count"
const heatTopFor = (state: HeatState, n = 5): string => {
  const arr: Array<[string, number]> = [];
  for (const [u, r] of HEATMAP) if (r[state] > 0) arr.push([u, r[state]]);
  arr.sort((a, b) => b[1] - a[1]);
  return arr.slice(0, n).map(([u, c]) => `${u}:${c}`).join(",");
};

// Compact aggregate of total counts across all usernames, for the X-Cache-Stats header.
const heatStatsHeader = (): string => {
  let HIT = 0, STALE = 0, MISS = 0, BYPASS = 0, COALESCED = 0, PAGINATE = 0;
  for (const r of HEATMAP.values()) {
    HIT += r.HIT; STALE += r.STALE; MISS += r.MISS;
    BYPASS += r.BYPASS; COALESCED += r.COALESCED; PAGINATE += r.PAGINATE;
  }
  return `h=${HIT};s=${STALE};m=${MISS};b=${BYPASS};c=${COALESCED};p=${PAGINATE};u=${HEATMAP.size};cache=${RESP_CACHE.size}`;
};

// Header value combining the top entries per state. Truncated for safety
// (HTTP header values realistically should stay under ~4KB).
const heatHeaderValue = (): string => {
  const parts = [
    `HIT=${heatTopFor("HIT")}`,
    `STALE=${heatTopFor("STALE")}`,
    `MISS=${heatTopFor("MISS")}`,
  ];
  const out = parts.filter(p => !p.endsWith("=")).join("|");
  return out.slice(0, 1024);
};

// Full heatmap snapshot, used by the JSON /debug endpoint.
const heatSnapshot = () => {
  const rows = Array.from(HEATMAP.entries())
    .map(([username, r]) => ({ username, ...r }))
    .sort((a, b) => b.total - a.total);
  return {
    cacheSize: RESP_CACHE.size,
    cacheMax: RESP_CACHE_MAX,
    heatmapSize: HEATMAP.size,
    rows,
  };
};

// ---- latency & error-rate metrics ----
// Per-key rolling sample of latencies + error count. Two namespaces:
//   "user:<username>"  → end-to-end request latency for that username
//   "rapid:<path>"     → individual RapidAPI call latency for that path
// Samples are bounded to the last N to keep memory/CPU bounded under load.
interface MetricRec {
  samples: number[];   // ring buffer of recent latencies in ms
  ringIdx: number;     // next write index in `samples`
  total: number;       // total observations ever recorded
  errors: number;      // total errors ever recorded
  lastAt: number;
}
const METRICS = new Map<string, MetricRec>();
const METRIC_SAMPLES_MAX = 500;
const METRICS_MAX = 1000;

const metricRecord = (key: string, ms: number, isError: boolean) => {
  let r = METRICS.get(key);
  if (!r) {
    if (METRICS.size >= METRICS_MAX) {
      // Evict oldest by lastAt to bound memory.
      let oldKey: string | null = null; let oldAt = Infinity;
      for (const [k, v] of METRICS) {
        if (v.lastAt < oldAt) { oldAt = v.lastAt; oldKey = k; }
      }
      if (oldKey) METRICS.delete(oldKey);
    }
    r = { samples: [], ringIdx: 0, total: 0, errors: 0, lastAt: 0 };
    METRICS.set(key, r);
  }
  if (r.samples.length < METRIC_SAMPLES_MAX) {
    r.samples.push(ms);
  } else {
    r.samples[r.ringIdx] = ms;
    r.ringIdx = (r.ringIdx + 1) % METRIC_SAMPLES_MAX;
  }
  r.total++;
  if (isError) r.errors++;
  r.lastAt = Date.now();
};

// Compute percentile from a sorted ascending array. Linear interpolation.
const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo));
};

interface MetricSummary {
  key: string;
  count: number;
  errors: number;
  errorRate: number; // 0..1, rounded to 4 decimals
  p50: number;
  p95: number;
  p99: number;
}
const summarizeMetric = (key: string, r: MetricRec): MetricSummary => {
  const sorted = r.samples.slice().sort((a, b) => a - b);
  return {
    key,
    count: r.total,
    errors: r.errors,
    errorRate: r.total > 0 ? Math.round((r.errors / r.total) * 10000) / 10000 : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
};

// Snapshot all metrics, sorted by traffic (count desc). Optional prefix filter
// lets callers pull just `user:` or `rapid:` slices.
const metricsSnapshot = (prefix?: string): MetricSummary[] => {
  const out: MetricSummary[] = [];
  for (const [k, r] of METRICS) {
    if (prefix && !k.startsWith(prefix)) continue;
    out.push(summarizeMetric(k, r));
  }
  out.sort((a, b) => b.count - a.count);
  return out;
};

// Compact summary for the per-request structured log: just the relevant
// username + RapidAPI paths touched in this request.
const metricsForRequest = (username: string, ctx: ReqCtx): {
  user: MetricSummary | null;
  rapid: MetricSummary[];
} => {
  const userKey = `user:${username}`;
  const userRec = METRICS.get(userKey);
  const touchedPaths = Array.from(new Set(ctx.rapidCalls.map(c => c.path)));
  const rapid: MetricSummary[] = [];
  for (const p of touchedPaths) {
    const rec = METRICS.get(`rapid:${p}`);
    if (rec) rapid.push(summarizeMetric(`rapid:${p}`, rec));
  }
  return {
    user: userRec ? summarizeMetric(userKey, userRec) : null,
    rapid,
  };
};


// Fire-and-forget background refresh. EdgeRuntime.waitUntil keeps the isolate
// alive past the response so the refresh actually completes.
function scheduleRevalidation(cacheKey: string, username: string, type: string, parentTrace?: string) {
  if (REVALIDATING.has(cacheKey) || INFLIGHT.has(cacheKey)) return;
  REVALIDATING.add(cacheKey);
  // Pull the page count out of the cache key (e.g. "user::all::p3") so the
  // background refresh fetches the same shape we originally cached.
  const pagesMatch = cacheKey.match(/::p(\d+)$/);
  const pages = pagesMatch ? Number(pagesMatch[1]) : 1;
  const traceId = `${parentTrace ?? newTraceId()}-bg`;
  const ctx = newCtx(traceId, username, type);
  slog("info", traceId, "revalidate_start", { cacheKey, pages, parentTrace });
  const task = (async () => {
    try {
      const r = await buildResult(username, type, ctx, { pages });
      cacheSet(cacheKey, r);
      // Also refresh the shared L2 cache so other isolates benefit.
      l2Set(cacheKey, username, type, pages, r).catch(() => null);
      slog("info", traceId, "revalidate_done", {
        ms: Date.now() - ctx.startedAt, rapidCalls: ctx.rapidCalls.length,
      });
    } catch (e) {
      slog("warn", traceId, "revalidate_failed", { err: (e as Error).message });
    } finally {
      REVALIDATING.delete(cacheKey);
    }
  })();
  // @ts-ignore — EdgeRuntime is a Supabase Deno global
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(task);
  }
}

const json = (d: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(d), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });


const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  const s = v.replace(/,/g, "").trim();
  const m = s.match(/([\d.]+)\s*([kmb])?/i);
  if (!m) return 0;
  const base = Number(m[1]) || 0;
  const mult = m[2]?.toLowerCase() === "k" ? 1_000 : m[2]?.toLowerCase() === "m" ? 1_000_000 : m[2]?.toLowerCase() === "b" ? 1_000_000_000 : 1;
  return Math.round(base * mult);
};
const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

const compactNum = (v: unknown): number => {
  if (typeof v === "number") return v;
  const s = str(v).replace(/,/g, "").trim();
  const m = s.match(/([\d.]+)\s*([kmb])?/i);
  if (!m) return 0;
  const base = Number(m[1]) || 0;
  const mult = m[2]?.toLowerCase() === "k" ? 1_000 : m[2]?.toLowerCase() === "m" ? 1_000_000 : m[2]?.toLowerCase() === "b" ? 1_000_000_000 : 1;
  return Math.round(base * mult);
};

async function callRapid(path: string, init: RequestInit, ctx?: ReqCtx) {
  const url = `https://${RAPIDAPI_HOST}${path}`;
  const startedAt = Date.now();
  let status: "ok" | "err" = "ok";
  let errMsg: string | undefined;
  try {
    const activeKey = await getActiveRapidKey();
    const r = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        "x-rapidapi-key": activeKey,
        "x-rapidapi-host": RAPIDAPI_HOST,
      },
      signal: AbortSignal.timeout(40000),
    });
    const text = await r.text();
    if (!r.ok) {
      status = "err";
      errMsg = `http_${r.status}`;
      if (ctx) slog("warn", ctx.traceId, "rapid_call", {
        path, method: init.method ?? "GET", ms: Date.now() - startedAt,
        status: r.status, body: text.slice(0, 200),
      });
      throw new Error(`RapidAPI ${r.status}`);
    }
    if (ctx) slog("debug", ctx.traceId, "rapid_call", {
      path, method: init.method ?? "GET", ms: Date.now() - startedAt, status: 200,
    });
    try { return JSON.parse(text); } catch { return {}; }
  } catch (e) {
    status = "err";
    errMsg = errMsg ?? (e as Error).message;
    throw e;
  } finally {
    const ms = Date.now() - startedAt;
    if (ctx) ctx.rapidCalls.push({ path, ms, status, err: errMsg });
    // Per-RapidAPI-path metrics for the dashboard. Always recorded, even when
    // ctx is missing (e.g. background revalidation paths).
    metricRecord(`rapid:${path}`, ms, status === "err");
    // Quota tracking: only count successful billable calls.
    if (status === "ok") {
      // @ts-ignore EdgeRuntime is a Supabase Deno global
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(incrementApiUsageAndAlert());
      } else {
        incrementApiUsageAndAlert().catch(() => null);
      }
    }
  }
}

// Try multiple endpoint shapes (different RapidAPI providers use different paths/params)
async function tryEndpoints(
  variants: Array<{ path: string; method?: "GET" | "POST"; query?: Record<string, string>; body?: Record<string, string> }>,
  ctx?: ReqCtx,
): Promise<{ data: any; variant: { path: string; method?: "GET" | "POST"; query?: Record<string, string>; body?: Record<string, string> } }> {
  let lastErr: any;
  for (const v of variants) {
    try {
      const u = new URL(`https://${RAPIDAPI_HOST}${v.path}`);
      Object.entries(v.query ?? {}).forEach(([k, val]) => u.searchParams.set(k, val));
      const init: RequestInit = { method: v.method ?? "GET" };
      if (v.body) {
        init.body = JSON.stringify(v.body);
        init.headers = { "Content-Type": "application/json" };
      }
      return { data: await callRapid(u.pathname + u.search, init, ctx), variant: v };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("All endpoints failed");
}

function readPageInfo(rawIn: any) {
  const raw = unwrap(rawIn);
  const result = Array.isArray(raw?.result) ? raw.result[0] : raw?.result;
  const pageInfo =
    result?.page_info ??
    result?.data?.page_info ??
    raw?.data?.page_info ??
    raw?.page_info ??
    null;

  return {
    hasNext: !!(pageInfo?.has_next_page ?? pageInfo?.hasNextPage),
    cursor: str(
      pageInfo?.end_cursor ??
      pageInfo?.next_cursor ??
      pageInfo?.max_id ??
      pageInfo?.maxId ??
      raw?.next_max_id ??
      raw?.max_id
    ),
  };
}

function paginationVariants(
  variant: { path: string; method?: "GET" | "POST"; query?: Record<string, string>; body?: Record<string, string> },
  cursor: string,
) {
  const method = variant.method ?? "GET";
  if (method === "POST") {
    return [
      { ...variant, body: { ...(variant.body ?? {}), maxId: cursor } },
      { ...variant, body: { ...(variant.body ?? {}), max_id: cursor } },
      { ...variant, body: { ...(variant.body ?? {}), end_cursor: cursor } },
      { ...variant, body: { ...(variant.body ?? {}), cursor } },
      { ...variant, body: { ...(variant.body ?? {}), after: cursor } },
    ];
  }

  return [
    { ...variant, query: { ...(variant.query ?? {}), maxId: cursor } },
    { ...variant, query: { ...(variant.query ?? {}), max_id: cursor } },
    { ...variant, query: { ...(variant.query ?? {}), end_cursor: cursor } },
    { ...variant, query: { ...(variant.query ?? {}), cursor } },
    { ...variant, query: { ...(variant.query ?? {}), after: cursor } },
  ];
}

// ---------- normalizers (handle multiple provider shapes) ----------
function unwrap(raw: any): any {
  // Some providers wrap everything in { data: {...} } — unwrap once.
  if (raw && typeof raw === "object" && raw.data && (raw.data.result || raw.data.user || raw.data.items || raw.data.posts || raw.data.reels || raw.data.edges || raw.data.tray)) {
    return raw.data;
  }
  return raw;
}

function normalizeProfile(rawIn: any) {
  // instagram120: { data: { result: [{ status:"ok", user: {...} }] } }
  // others: { result: { user: {...} } } | { data: {...} } | direct user
  const raw = unwrap(rawIn);
  const resultArr = Array.isArray(raw?.result) ? raw.result[0] : raw?.result;
  const d =
    resultArr?.user ??
    raw?.result?.user ??
    raw?.graphql?.user ??
    raw?.data?.user ??
    raw?.user_info?.user ??
    raw?.data ??
    raw?.user ??
    raw ??
    {};
  return {
    username: str(d.username ?? d.user_name),
    fullName: str(d.full_name ?? d.fullname ?? d.fullName ?? d.name),
    bio: str(d.biography ?? d.bio),
    avatarUrl: str(
      d.hd_profile_pic_url_info?.url ??
        d.profile_pic_url_info?.url ??
        d.hd_profile_pic_versions?.slice(-1)?.[0]?.url ??
        d.profile_pic_url_hd ??
        d.profile_pic_url ??
        d.profile_pic_url_proxy ??
        d.avatarUrl ??
        d.profile_picture ??
        d.avatar
    ),
    isVerified: !!(d.is_verified ?? d.verified),
    followers: num(
      d.follower_count ?? d.followers ?? d.followers_count ?? d.edge_followed_by?.count ?? d.edge_followed_by_count
    ),
    following: num(
      d.following_count ?? d.following ?? d.followings ?? d.edge_follow?.count ?? d.edge_follow_count
    ),
    postsCount: num(
      d.media_count ?? d.posts_count ?? d.post_count ?? d.edge_owner_to_timeline_media?.count ?? d.edge_owner_to_timeline_media_count
    ),
    externalUrl: str(d.external_url ?? d.website ?? d.bio_links?.[0]?.url),
    category: str(d.category ?? d.category_name),
  };
}

function normalizeMediaItem(it: any) {
  if (!it) return null;
  // Drill through edge wrappers: { node: { media: {...} } } | { node: {...} } | { media: {...} } | direct
  const m =
    it?.node?.media ??
    it?.media ??
    it?.node ??
    it;
  const owner = m.owner ?? m.user ?? it?.owner ?? it?.user ?? {};
  const id = str(m.id ?? m.pk ?? m.media_id);
  const code = str(m.code ?? m.shortcode ?? m.shortCode);
  const caption = str(
    m.caption?.text ??
      (typeof m.caption === "string" ? m.caption : undefined) ??
      m.edge_media_to_caption?.edges?.[0]?.node?.text ??
      ""
  );
  const thumbnail = str(
    m.thumbnail_url ??
      m.display_url ??
      m.image_versions2?.candidates?.[0]?.url ??
      m.image_versions2?.additional_candidates?.first_frame?.url ??
      m.image_versions?.items?.[0]?.url ??
      m.display_resources?.slice(-1)?.[0]?.src ??
      m.thumbnail_src ??
      m.cover_frame_url ??
      m.thumbnail ??
      m.cover?.url ??
      m.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url ??
      m.carousel_media?.[0]?.display_url
  );
  const videoUrl = str(
    m.video_url ?? m.video_versions?.[0]?.url ?? m.videoUrl ?? m.video?.url ?? ""
  );
  const productType = str(m.product_type ?? m.media_type_name ?? "");
  const mediaType = num(m.media_type);
  const isVideo = !!videoUrl || productType === "clips" || mediaType === 2 || !!m.is_video;
  return {
    id,
    code,
    caption,
    thumbnail,
    videoUrl,
    duration: num(m.video_duration ?? m.duration ?? m.clips_metadata?.duration),
    views: num(
      m.play_count ??
      m.ig_play_count ??
      m.video_play_count ??
      m.video_view_count ??
      m.view_count ??
      m.views ??
      m.fb_play_count
    ),
    likes: num(
      m.like_count ?? m.likes ?? m.edge_liked_by?.count ?? m.edge_media_preview_like?.count
    ),
    comments: num(m.comment_count ?? m.comments ?? m.edge_media_to_comment?.count),
    shares: num(m.reshare_count ?? m.share_count ?? m.shares),
    takenAt: num(m.taken_at ?? m.taken_at_timestamp ?? m.takenAt),
    productType,
    isVideo,
    ownerUsername: str(owner.username),
    ownerFullName: str(owner.full_name ?? owner.fullname ?? owner.name),
    ownerAvatar: str(owner.profile_pic_url ?? owner.profile_pic_url_hd ?? owner.profile_picture ?? owner.avatar),
  };
}

function pickItems(rawIn: any): any[] {
  const raw = unwrap(rawIn);
  // result may be array OR object
  const r0 = Array.isArray(raw?.result) ? raw.result[0] : raw?.result;
  return (
    r0?.items ??
    r0?.posts ??
    r0?.reels ??
    r0?.edges ??
    r0?.data?.items ??
    r0?.user?.edge_owner_to_timeline_media?.edges ??
    raw?.user?.edge_owner_to_timeline_media?.edges ??
    raw?.graphql?.user?.edge_owner_to_timeline_media?.edges ??
    raw?.data?.items ??
    raw?.data?.posts ??
    raw?.data?.reels ??
    raw?.data?.edges ??
    raw?.items ??
    raw?.posts ??
    raw?.reels ??
    raw?.edges ??
    (Array.isArray(raw?.result) ? raw.result : null) ??
    (Array.isArray(raw?.data) ? raw.data : null) ??
    []
  );
}

// Fetch a single media's full details (used to recover video_url for reels)
async function fetchMediaDetail(codeOrId: string, ctx?: ReqCtx): Promise<any | null> {
  if (!codeOrId) return null;
  try {
    // /api/instagram/links is the confirmed working endpoint on instagram120
    const { data } = await tryEndpoints([
      { path: "/api/instagram/links", method: "POST", body: { url: `https://www.instagram.com/reel/${codeOrId}/` } },
      { path: "/api/instagram/links", method: "POST", body: { url: `https://www.instagram.com/p/${codeOrId}/` } },
      { path: "/api/instagram/get", method: "POST", body: { url: `https://www.instagram.com/reel/${codeOrId}/` } },
      { path: "/api/instagram/get", method: "POST", body: { url: `https://www.instagram.com/p/${codeOrId}/` } },
    ], ctx);
    return data;
  } catch (e) {
    if (ctx) slog("warn", ctx.traceId, "media_detail_failed", { code: codeOrId, err: (e as Error).message });
    return null;
  }
}

function extractDetailFields(rawIn: any): { videoUrl: string; caption: string; thumbnail: string } {
  // Some endpoints return a top-level array (e.g. /api/instagram/links -> [{urls, meta}])
  const raw = unwrap(rawIn);
  const top = Array.isArray(raw) ? raw[0] : raw;
  const r0 = Array.isArray(top?.result) ? top.result[0] : top?.result;
  const m =
    r0?.media ??
    r0?.item ??
    r0?.items?.[0] ??
    r0 ??
    top?.data?.media ??
    top?.data?.item ??
    top?.data ??
    top?.media ??
    top?.item ??
    top ??
    {};

  // Direct video fields
  let videoUrl = str(
    m.video_url ??
      m.video_versions?.[0]?.url ??
      m.video?.url ??
      m.videoUrl ??
      m.node?.video_url ??
      m.carousel_media?.[0]?.video_versions?.[0]?.url ??
      ""
  );

  // links/urls array shape (links endpoint)
  if (!videoUrl) {
    const linkArr =
      m.urls ??
      m.links ??
      m.video ??
      r0?.urls ??
      r0?.links ??
      top?.urls ??
      top?.links ??
      null;
    if (Array.isArray(linkArr)) {
      // Prefer mp4 with highest quality
      const mp4s = linkArr.filter((l: any) => {
        const u = str(l?.url ?? l?.link ?? l);
        const ext = str(l?.extension);
        return /\.mp4($|\?)/i.test(u) || ext.toLowerCase() === "mp4";
      });
      const best = mp4s.sort((a: any, b: any) => num(b?.quality) - num(a?.quality))[0];
      if (best) videoUrl = str(best?.url ?? best?.link ?? best);
      if (!videoUrl) videoUrl = str(linkArr[0]?.url ?? linkArr[0]?.link ?? linkArr[0]);
    }
  }

  const meta = m.meta ?? r0?.meta ?? top?.meta ?? {};
  const captionRaw =
    m.caption?.text ??
    (typeof m.caption === "string" ? m.caption : undefined) ??
    m.edge_media_to_caption?.edges?.[0]?.node?.text ??
    meta.title ??
    meta.caption ??
    "";
  const caption = str(captionRaw);
  const thumbnail = str(
    m.thumbnail_url ??
      m.display_url ??
      m.image_versions2?.candidates?.[0]?.url ??
      m.cover?.url ??
      meta.thumbnail ??
      meta.image ??
      ""
  );

  return { videoUrl, caption, thumbnail };
}

function dedupeMediaItems(items: any[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = str(item?.id || item?.code || item?.shortcode || item?.pk || item?.media_id);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeHighlight(h: any) {
  return {
    id: str(h.id ?? h.pk),
    name: str(h.title ?? h.name),
    image: str(
      h.cover_media?.cropped_image_version?.url ??
        h.cover_media?.url ??
        h.cover_image ??
        h.cover?.url ??
        h.image ??
        h.thumbnail
    ),
  };
}

async function fetchInstagramWebProfile(username: string, ctx?: ReqCtx): Promise<any | null> {
  const key = username.toLowerCase();
  const cached = WEB_PROFILE_CACHE.get(key);
  if (cached && Date.now() - cached.at < WEB_PROFILE_TTL_MS) return cached.payload;

  const startedAt = Date.now();
  try {
    const page = await fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      },
      signal: AbortSignal.timeout(12000),
    });
    const html = await page.text();
    if (!page.ok || !html) throw new Error(`web_${page.status}`);

      const extract = (re: RegExp) => {
      const m = html.match(re);
      if (!m?.[1]) return "";
        return m[1]
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">");
    };
    const description = extract(/<meta\s+name="description"\s+content="([^"]*)"/i);
    const title = extract(/<meta\s+property="og:title"\s+content="([^"]*)"/i);
    const descCounts = description.match(/([\d.,]+\s*[KMB]?)\s+Followers,\s+([\d.,]+\s*[KMB]?)\s+Following,\s+([\d.,]+\s*[KMB]?)\s+Posts/i);
    const titleUser = title.match(/\(@([^\)]+)\)/)?.[1] || username;
    const payload = {
      user: {
        username: titleUser,
        full_name: title.split("(@")[0]?.trim() || "",
        biography: description.replace(/^.*?Posts\s+-\s*/i, ""),
        profile_pic_url_hd: extract(/<meta\s+property="og:image"\s+content="([^"]*)"/i),
        followers_count: compactNum(descCounts?.[1]),
        following_count: compactNum(descCounts?.[2]),
        media_count: compactNum(descCounts?.[3]),
      },
    };
    WEB_PROFILE_CACHE.set(key, { at: Date.now(), payload });
    if (ctx) slog("info", ctx.traceId, "web_profile_done", { ms: Date.now() - startedAt, ok: !!payload.user.profile_pic_url_hd });
    return payload;
  } catch (e) {
    if (ctx) slog("warn", ctx.traceId, "web_profile_failed", { ms: Date.now() - startedAt, err: (e as Error).message });
    return null;
  }
}

function mergeProfile(primary: any, fallback: any, username: string) {
  const fb = fallback ? normalizeProfile(fallback) : null;
  return {
    username: primary?.username || fb?.username || username,
    fullName: primary?.fullName || fb?.fullName || username,
    bio: primary?.bio || fb?.bio || "",
    avatarUrl: primary?.avatarUrl || fb?.avatarUrl || "",
    isVerified: !!(primary?.isVerified || fb?.isVerified),
    followers: primary?.followers || fb?.followers || 0,
    following: primary?.following || fb?.following || 0,
    postsCount: primary?.postsCount || fb?.postsCount || 0,
    externalUrl: primary?.externalUrl || fb?.externalUrl || "",
    category: primary?.category || fb?.category || "",
  };
}

// ---------- workers (each one self-contained, run in parallel) ----------
async function fetchProfile(username: string, ctx?: ReqCtx) {
  const startedAt = Date.now();
  let profile: any = null;
  let webRaw: any = null;
  try {
    const raw = await tryEndpoints([
      { path: "/api/instagram/userInfo", method: "POST", body: { username } },
      { path: "/api/instagram/userInfoByUsername", method: "POST", body: { username } },
      { path: "/v1/info", query: { username_or_id_or_url: username } },
      { path: "/userinfo", query: { username } },
      { path: "/api/v1/users/web_profile_info", query: { username } },
    ], ctx);
    profile = normalizeProfile(raw);
  } catch (e) {
    if (ctx) slog("warn", ctx.traceId, "rapid_profile_failed", { err: (e as Error).message });
  }
  if (!profile?.username || !profile?.avatarUrl) {
    webRaw = await fetchInstagramWebProfile(username, ctx);
  }
  profile = mergeProfile(profile, webRaw, username);
  if (ctx) slog("info", ctx.traceId, "fetch_profile_done", {
    ms: Date.now() - startedAt, ok: !!profile.username, hasAvatar: !!profile.avatarUrl,
  });
  return profile;
}

// Encode/decode opaque cursor tokens passed back to clients. The token wraps
// the provider cursor + which endpoint variant is paginating, so clients don't
// need to know any provider details.
type Variant = { path: string; method?: "GET" | "POST"; query?: Record<string, string>; body?: Record<string, string> };
type CursorToken = { c: string; v: Variant };

function encodeCursor(tok: CursorToken): string {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(tok))));
  } catch { return ""; }
}
function decodeCursor(s: string): CursorToken | null {
  if (!s) return null;
  try {
    const tok = JSON.parse(decodeURIComponent(escape(atob(s))));
    if (tok && typeof tok.c === "string" && tok.v && typeof tok.v.path === "string") return tok;
  } catch {}
  return null;
}

interface PaginatedResult {
  items: any[];
  nextCursor: string;
  hasMore: boolean;
}

async function fetchPaginated(
  variants: Variant[],
  ctx?: ReqCtx,
  opts: { maxPages?: number; cap?: number; startCursor?: CursorToken | null } = {},
): Promise<PaginatedResult> {
  const maxPages = opts.maxPages ?? 1;          // default: just one page (fast)
  const cap = opts.cap ?? 120;
  const allRaw: any[] = [];
  let cur: { hasNext: boolean; cursor: string };
  let lastVariant: Variant;
  let pages = 0;

  if (opts.startCursor) {
    // Resume pagination from a previously returned cursor.
    cur = { hasNext: true, cursor: opts.startCursor.c };
    lastVariant = opts.startCursor.v;
  } else {
    const first = await tryEndpoints(variants, ctx);
    allRaw.push(pickItems(first.data));
    cur = readPageInfo(first.data);
    lastVariant = first.variant;
    pages = 1;
  }

  while (cur.hasNext && cur.cursor && pages < maxPages) {
    try {
      const next = await tryEndpoints(paginationVariants(lastVariant, cur.cursor), ctx);
      allRaw.push(pickItems(next.data));
      cur = readPageInfo(next.data);
      lastVariant = next.variant;
      pages++;
    } catch (e) {
      if (ctx) slog("warn", ctx.traceId, "page_fetch_failed", { page: pages + 1, err: (e as Error).message });
      break;
    }
  }

  const items = dedupeMediaItems(allRaw.flat()).map(normalizeMediaItem).filter(Boolean).slice(0, cap);
  const hasMore = !!(cur.hasNext && cur.cursor);
  const nextCursor = hasMore ? encodeCursor({ c: cur.cursor, v: lastVariant }) : "";
  return { items, nextCursor, hasMore };
}

async function fetchPosts(
  username: string,
  ctx?: ReqCtx,
  opts: { maxPages?: number; startCursor?: CursorToken | null } = {},
): Promise<PaginatedResult> {
  const startedAt = Date.now();
  // The provider's /api/instagram/posts endpoint is the only one that returns
  // a real feed, but it intermittently 500s with "link not found". Other paths
  // (userPosts, /v1/posts, /posts) always 404 — keep them out of the hot path
  // so we don't burn quota & latency. Retry the real endpoint a few times with
  // small backoff on transient 500s before giving up.
  const variants = [
    { path: "/api/instagram/posts", method: "POST" as const, body: { username } },
  ];
  let lastErr: any;
  let result: PaginatedResult | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      result = await fetchPaginated(variants, ctx, opts);
      if (result.items.length > 0 || !result.hasMore) break;
      // Empty result on a public account — try again, provider is flaky.
      lastErr = new Error("empty_result");
    } catch (e) {
      lastErr = e;
      if (ctx) slog("warn", ctx.traceId, "posts_retry", {
        attempt: attempt + 1, err: (e as Error).message,
      });
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
  }
  if (!result) {
    if (ctx) slog("error", ctx.traceId, "posts_failed", { err: String(lastErr?.message ?? lastErr) });
    result = { items: [], nextCursor: "", hasMore: false };
  }
  if (ctx) slog("info", ctx.traceId, "fetch_posts_done", {
    ms: Date.now() - startedAt, count: result.items.length,
    hasMore: result.hasMore, paginated: !!opts.startCursor,
  });
  return result;
}

async function fetchHighlights(username: string, ctx?: ReqCtx) {
  const startedAt = Date.now();
  const resp = await tryEndpoints([
    { path: "/api/instagram/highlights", method: "POST", body: { username } },
    { path: "/api/instagram/userHighlights", method: "POST", body: { username } },
    { path: "/v1/highlights", query: { username_or_id_or_url: username } },
  ], ctx);
  const raw = unwrap(resp.data);
  const r0 = Array.isArray(raw?.result) ? raw.result[0] : raw?.result;
  const items = r0?.items ?? r0?.tray ?? r0 ?? raw?.items ?? [];
  const out = (Array.isArray(items) ? items : []).map(normalizeHighlight);
  if (ctx) slog("info", ctx.traceId, "fetch_highlights_done", {
    ms: Date.now() - startedAt, count: out.length,
  });
  return out;
}

// Build the full result for a username — runs profile/posts/highlights IN PARALLEL.
// `pages` controls how many pages of posts to fetch on the initial request
// (defaults to 1 for fast cold-start; clients call paginatePosts() to load more).
async function buildResult(
  username: string,
  type: string,
  ctx?: ReqCtx,
  opts: { pages?: number } = {},
): Promise<any> {
  const wants = (t: string) => type === "all" || type === t;
  const buildStart = Date.now();
  const pages = Math.max(1, Math.min(5, opts.pages ?? 1));
  if (ctx) slog("info", ctx.traceId, "build_start", { username, type, pages });

  const [profileRes, postsRes, highlightsRes] = await Promise.allSettled([
    wants("profile") ? fetchProfile(username, ctx) : Promise.resolve(null),
    (wants("posts") || wants("reels")) ? fetchPosts(username, ctx, { maxPages: pages }) : Promise.resolve(null),
    wants("highlights") ? fetchHighlights(username, ctx) : Promise.resolve(null),
  ]);

  const result: any = { username };

  let postsArr: any[] = [];
  let postsNextCursor = "";
  let postsHasMore = false;
  if (postsRes.status === "fulfilled" && postsRes.value && Array.isArray((postsRes.value as PaginatedResult).items)) {
    const pr = postsRes.value as PaginatedResult;
    postsArr = pr.items;
    postsNextCursor = pr.nextCursor;
    postsHasMore = pr.hasMore;
  } else if (postsRes.status === "rejected" && ctx) {
    slog("error", ctx.traceId, "posts_failed", { err: String(postsRes.reason?.message ?? postsRes.reason) });
  }

  if (wants("profile")) {
    if (profileRes.status === "fulfilled" && profileRes.value) {
      result.profile = profileRes.value;
    } else {
      if (profileRes.status === "rejected" && ctx) {
        slog("error", ctx.traceId, "profile_failed", { err: String(profileRes.reason?.message ?? profileRes.reason) });
      }
      result.profile = mergeProfile(null, null, username);
    }
    const owner = postsArr.find((p: any) => p?.ownerUsername || p?.ownerAvatar || p?.ownerFullName);
    if (owner) {
      result.profile = {
        ...result.profile,
        username: result.profile.username || owner.ownerUsername || username,
        fullName: result.profile.fullName || owner.ownerFullName || owner.ownerUsername || username,
        avatarUrl: result.profile.avatarUrl || owner.ownerAvatar || "",
      };
    }
    result.profileOk = !!result.profile.username;
  }

  if (wants("posts")) {
    result.posts = postsArr;
    result.postsOk = postsRes.status === "fulfilled";
    result.postsNextCursor = postsNextCursor;
    result.postsHasMore = postsHasMore;
  }

  if (wants("reels")) {
    // Provider's dedicated /reels endpoint always 404s — derive from video posts.
    const videoPosts = postsArr.filter(
      (p: any) => p?.isVideo || p?.videoUrl || p?.productType === "clips"
    );
    result.reels = videoPosts.slice(0, 120);
    result.reelsOk = postsRes.status === "fulfilled";
    // Reels share the same underlying cursor since they're derived from posts.
    result.reelsNextCursor = postsNextCursor;
    result.reelsHasMore = postsHasMore;
  }

  if (wants("highlights")) {
    if (highlightsRes.status === "fulfilled" && highlightsRes.value) {
      result.highlights = highlightsRes.value;
      result.highlightsOk = true;
    } else {
      result.highlights = [];
      result.highlightsOk = false;
      if (highlightsRes.status === "rejected" && ctx) {
        slog("error", ctx.traceId, "highlights_failed", { err: String(highlightsRes.reason?.message ?? highlightsRes.reason) });
      }
    }
  }

  // Enrichment: detail fetches for missing video URLs (capped to 6, parallel).
  if (Array.isArray(result.reels) && result.reels.length) {
    const MAX_DETAIL_FETCH = 6;
    const targets = result.reels
      .map((r: any, idx: number) => ({ r, idx }))
      .filter(({ r }: any) => (!r?.videoUrl || !r?.caption) && (r?.code || r?.id))
      .slice(0, MAX_DETAIL_FETCH);

    if (targets.length) {
      const enrichStart = Date.now();
      const detailResults = await Promise.allSettled(
        targets.map(({ r }: any) => fetchMediaDetail(str(r.code || r.id), ctx))
      );
      let recovered = 0;
      detailResults.forEach((res, i) => {
        if (res.status !== "fulfilled" || !res.value) return;
        const fields = extractDetailFields(res.value);
        const { idx } = targets[i];
        const cur = result.reels[idx];
        if (!cur.videoUrl && fields.videoUrl) recovered++;
        result.reels[idx] = {
          ...cur,
          videoUrl: cur.videoUrl || fields.videoUrl || "",
          caption: cur.caption || fields.caption || "",
          thumbnail: cur.thumbnail || fields.thumbnail || "",
        };
      });
      if (ctx) slog("info", ctx.traceId, "enrich_done", {
        ms: Date.now() - enrichStart, attempted: targets.length, recovered,
      });
    }
  }

  if (ctx) slog("info", ctx.traceId, "build_done", {
    ms: Date.now() - buildStart,
    profileOk: result.profileOk,
    postsCount: result.posts?.length,
    reelsCount: result.reels?.length,
    highlightsCount: result.highlights?.length,
    hasMore: postsHasMore,
  });

  return result;
}

// "Load more" path — paginate from a previously returned cursor.
// Cheap, focused, and bypasses the SWR cache because each cursor is unique.
async function paginatePostsResult(
  username: string,
  type: string,
  cursor: string,
  pages: number,
  ctx?: ReqCtx,
): Promise<any> {
  const tok = decodeCursor(cursor);
  if (!tok) {
    if (ctx) slog("warn", ctx.traceId, "bad_cursor", { cursor: cursor.slice(0, 32) });
    throw new Error("Invalid cursor");
  }
  const buildStart = Date.now();
  if (ctx) slog("info", ctx.traceId, "paginate_start", { username, type, pages });

  const pr = await fetchPosts(username, ctx, {
    maxPages: Math.max(1, Math.min(3, pages || 1)),
    startCursor: tok,
  });

  const result: any = { username, paginated: true };
  if (type === "all" || type === "posts") {
    result.posts = pr.items;
    result.postsNextCursor = pr.nextCursor;
    result.postsHasMore = pr.hasMore;
  }
  if (type === "all" || type === "reels") {
    const videoPosts = pr.items.filter(
      (p: any) => p?.isVideo || p?.videoUrl || p?.productType === "clips"
    );
    result.reels = videoPosts;
    result.reelsNextCursor = pr.nextCursor;
    result.reelsHasMore = pr.hasMore;
  }

  if (ctx) slog("info", ctx.traceId, "paginate_done", {
    ms: Date.now() - buildStart,
    postsCount: result.posts?.length, reelsCount: result.reels?.length,
    hasMore: pr.hasMore,
  });

  return result;
}

// ---------- main ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // ---- ACCESS KEY GATE (applies to ALL non-OPTIONS requests) ----
  // Replay self-calls forward the original auth headers so they still pass.
  const gateKey = req.headers.get("x-access-key") || "";
  const gateFp = req.headers.get("x-device-fp") || "";
  const gate = await validateAccessKey(gateKey, gateFp);
  if (!gate.ok) {
    return new Response(
      JSON.stringify({ error: "Unauthorized", reason: gate.reason }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
  // GET /...?debug=heatmap → cache HIT/MISS/STALE counts per username.
  // GET /...?debug=metrics → p50/p95/p99 latency + error rate per user/RapidAPI path.
  // GET /...?debug=traces  → recent recorded traces (inputs + outcome).
  // GET /...?debug=replay&trace=<id>[&force=1] → re-run the recorded trace and diff against original.
  if (req.method === "GET") {
    const u = new URL(req.url);
    const debug = u.searchParams.get("debug");
    if (debug === "heatmap") {
      return json(heatSnapshot(), 200, {
        "X-Cache-Heatmap": heatHeaderValue(),
        "X-Cache-Stats": heatStatsHeader(),
      });
    }
    if (debug === "metrics") {
      // Optional ?prefix=user: or ?prefix=rapid: to filter the slice.
      const prefix = u.searchParams.get("prefix") ?? undefined;
      return json({
        users: metricsSnapshot("user:"),
        rapid: metricsSnapshot("rapid:"),
        ...(prefix ? { filtered: metricsSnapshot(prefix) } : {}),
      });
    }
    if (debug === "traces") {
      const limit = Math.max(1, Math.min(200, Number(u.searchParams.get("limit") ?? "50")));
      return json({ count: TRACES.size, traces: tracesSnapshot(limit) });
    }
    if (debug === "replay") {
      const wantedTrace = u.searchParams.get("trace") ?? "";
      const orig = TRACES.get(wantedTrace);
      if (!orig) {
        return json({ error: "trace not found", traceId: wantedTrace, hint: "use ?debug=traces to list available trace ids" }, 404);
      }
      // Optional ?force=1 forces a fresh scrape (bypasses cache) so the replay
      // exercises the same upstream path as the original even if it's now warm.
      const replayForce = u.searchParams.get("force") === "1" ? true : orig.force;
      const replayTraceId = `${orig.traceId}-replay-${Date.now().toString(36).slice(-4)}`;
      slog("info", replayTraceId, "replay_start", {
        origTrace: orig.traceId,
        username: orig.username, type: orig.type, pages: orig.pages,
        cursor: orig.cursor ? `${orig.cursor.slice(0, 16)}…` : "",
        force: replayForce,
      });
      // Self-fetch back into the POST handler. Tag it as a replay so we can
      // skip recording the replay itself into the TRACES map.
      const selfBody: Record<string, unknown> = {
        username: orig.username,
        type: orig.type,
        force: replayForce,
        pages: orig.pages,
      };
      if (orig.cursor) selfBody.cursor = orig.cursor;
      const replayStart = Date.now();
      let replayRec: TraceRecord;
      let replayPayload: unknown = null;
      try {
        const r = await fetch(req.url.split("?")[0], {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Forward auth so the self-call passes the same gateway checks.
            ...(req.headers.get("authorization") ? { "Authorization": req.headers.get("authorization")! } : {}),
            ...(req.headers.get("apikey") ? { "apikey": req.headers.get("apikey")! } : {}),
            ...(req.headers.get("x-access-key") ? { "x-access-key": req.headers.get("x-access-key")! } : {}),
            ...(req.headers.get("x-device-fp") ? { "x-device-fp": req.headers.get("x-device-fp")! } : {}),
            "x-trace-id": replayTraceId,
            "x-replay-of": orig.traceId,
          },
          body: JSON.stringify(selfBody),
        });
        const totalMs = Date.now() - replayStart;
        replayPayload = await r.json().catch(() => null);
        const dbg = (replayPayload as Record<string, unknown> | null)?._debug as Record<string, unknown> | undefined;
        replayRec = {
          traceId: replayTraceId,
          recordedAt: Date.now(),
          username: orig.username,
          type: orig.type,
          pages: orig.pages,
          cursor: orig.cursor,
          force: replayForce,
          cache: r.headers.get("x-cache") ?? "?",
          totalMs,
          rapidCalls: Number(dbg?.rapidCalls ?? 0),
          rapidTotalMs: Number(dbg?.rapidTotalMs ?? 0),
          rapidErrors: Number(dbg?.rapidErrors ?? 0),
          slowest: (dbg?.slowest as TraceRecord["slowest"]) ?? [],
        };
      } catch (e) {
        replayRec = {
          traceId: replayTraceId,
          recordedAt: Date.now(),
          username: orig.username,
          type: orig.type,
          pages: orig.pages,
          cursor: orig.cursor,
          force: replayForce,
          cache: "ERROR",
          totalMs: Date.now() - replayStart,
          rapidCalls: 0, rapidTotalMs: 0, rapidErrors: 0,
          slowest: [],
          err: (e as Error).message,
        };
      }
      const diff = diffTrace(orig, replayRec);
      slog("info", replayTraceId, "replay_done", { origTrace: orig.traceId, ...diff });
      return json({
        original: orig,
        replay: replayRec,
        diff,
        replayPayloadPreview: replayPayload && typeof replayPayload === "object"
          ? Object.keys(replayPayload as Record<string, unknown>).slice(0, 20)
          : null,
      });
    }
    return json({ error: "POST only" }, 405);
  }
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const activeKey = await getActiveRapidKey();
  if (!activeKey) return json({ error: "RAPIDAPI_KEY missing" }, 500);

  // Use client-supplied trace id if present (so client logs and server logs
  // share the same id), otherwise mint a fresh one.
  const traceId = req.headers.get("x-trace-id") || newTraceId();
  // Replay self-calls set this header so we can skip re-recording them into
  // the TRACES map (which would create infinite-replay-of-replays chains).
  const replayOf = req.headers.get("x-replay-of") || "";
  const isReplay = !!replayOf;
  const reqStart = Date.now();

  let body: any;
  try { body = await req.json(); } catch {
    slog("warn", traceId, "bad_json", {});
    return json({ error: "Invalid JSON" }, 400, { "X-Trace-Id": traceId });
  }

  const username = str(body.username).trim().replace(/^@/, "").toLowerCase();
  const type = str(body.type || "all");
  if (!username) {
    slog("warn", traceId, "missing_username", {});
    return json({ error: "username required" }, 400, { "X-Trace-Id": traceId });
  }

  if (type === "debug") return json({ host: RAPIDAPI_HOST, hasKey: !!RAPIDAPI_KEY }, 200, { "X-Trace-Id": traceId });

  const force = !!body.force;
  // pages: how many pages of posts to fetch on initial scrape (1..5). Defaults
  // to 1 so cold-start requests are as fast and cheap as possible.
  const pages = Math.max(1, Math.min(5, num(body.pages) || 1));
  // cursor: opaque token from a previous response. When set, we run the
  // "load more" path which bypasses cache and only fetches the next batch.
  const cursor = str(body.cursor || "").trim();

  slog("info", traceId, "request", {
    username, type, force, pages, hasCursor: !!cursor,
    ua: req.headers.get("user-agent")?.slice(0, 80) ?? null,
  });

  // Notify ALL admins in real-time about this search (fire-and-forget).
  // Skipped for cursor "load more" requests — only the initial lookup counts
  // as a billable query worth surfacing.
  if (!cursor) {
    try {
      broadcastSearchToAdmins(username, type, traceId, {
        label: gate.label,
        keyMasked: gate.keyMasked,
      });
    } catch (_) { /* ignore */ }
  }

  // ---- LOAD-MORE PATH ----
  // Cursor requests are stateless and not cached: each cursor is unique and
  // the response is small, so caching would just bloat memory.
  if (cursor) {
    const ctx = newCtx(traceId, username, type);
    try {
      const payload = await paginatePostsResult(username, type, cursor, pages, ctx);
      const totalMs = Date.now() - reqStart;
      const slowest = slowestRapidCalls(ctx, 5);
      const rapidTotalMs = ctx.rapidCalls.reduce((s, c) => s + c.ms, 0);
      slog("info", traceId, "response", {
        cache: "PAGINATE", totalMs, rapidCalls: ctx.rapidCalls.length, rapidTotalMs,
        hasMore: payload.postsHasMore ?? payload.reelsHasMore ?? false,
        slowest,
      });
      heatTrack(username, "PAGINATE");
      metricRecord(`user:${username}`, totalMs, false);
      const reqMetrics = metricsForRequest(username, ctx);
      slog("info", traceId, "metrics", { username, ...reqMetrics });
      if (!isReplay) recordTrace({
        traceId, recordedAt: Date.now(),
        username, type, pages, cursor, force,
        cache: "PAGINATE", totalMs,
        rapidCalls: ctx.rapidCalls.length, rapidTotalMs,
        rapidErrors: ctx.rapidCalls.filter(c => c.status === "err").length,
        slowest,
      });
      const debugPayload = { ...payload, _debug: { ...buildDebugSummary(ctx, totalMs), metrics: reqMetrics } };
      return json(debugPayload, 200, {
        "X-Cache": "PAGINATE",
        "X-Duration-Ms": String(totalMs),
        "X-Trace-Id": traceId,
        "X-Cache-Heatmap": heatHeaderValue(),
        "X-Cache-Stats": heatStatsHeader(),
        // Don't cache load-more responses at the CDN — each cursor is unique.
        "Cache-Control": "no-store",
      });
    } catch (e) {
      const totalMs = Date.now() - reqStart;
      const msg = (e as Error).message;
      metricRecord(`user:${username}`, totalMs, true);
      slog("warn", traceId, "paginate_failed", { totalMs, err: msg });
      if (!isReplay) recordTrace({
        traceId, recordedAt: Date.now(),
        username, type, pages, cursor, force,
        cache: "ERROR", totalMs,
        rapidCalls: ctx.rapidCalls.length,
        rapidTotalMs: ctx.rapidCalls.reduce((s, c) => s + c.ms, 0),
        rapidErrors: ctx.rapidCalls.filter(c => c.status === "err").length,
        slowest: slowestRapidCalls(ctx, 5),
        err: msg,
      });
      const status = msg === "Invalid cursor" ? 400 : 502;
      return json({ error: msg, traceId }, status, { "X-Trace-Id": traceId });
    }
  }

  // ---- INITIAL FETCH PATH ----
  // Cache key includes pages so a 1-page request and a 3-page request stay
  // separate (different result sizes).
  const cacheKey = `v8::${username}::${type}::p${pages}`;
  // Detect (and warn on) two different inputs producing the same cacheKey.
  checkKeyCollision(cacheKey, username, type, pages, traceId);

  // 1) Stale-While-Revalidate: serve from cache instantly when available.
  if (!force) {
    const cached = cacheGet(cacheKey);
    if (cached) {
      const cacheState = cached.isStale ? "STALE" : "HIT";
      if (cached.isStale) scheduleRevalidation(cacheKey, username, type, traceId);
      const totalMs = Date.now() - reqStart;
      slog("info", traceId, "response", {
        cache: cacheState, ageSec: Math.round(cached.ageMs / 1000),
        totalMs, rapidCalls: 0,
      });
      heatTrack(username, cacheState);
      metricRecord(`user:${username}`, totalMs, false);
      if (!isReplay) recordTrace({
        traceId, recordedAt: Date.now(),
        username, type, pages, cursor, force,
        cache: cacheState, totalMs,
        rapidCalls: 0, rapidTotalMs: 0, rapidErrors: 0,
        slowest: [],
      });
      return json(cached.payload, 200, {
        "X-Cache": cacheState,
        "X-Cache-Age": String(Math.round(cached.ageMs / 1000)),
        "X-Duration-Ms": String(totalMs),
        "X-Trace-Id": traceId,
        "X-Cache-Heatmap": heatHeaderValue(),
        "X-Cache-Stats": heatStatsHeader(),
        "Cache-Control": "public, max-age=300",
      });
    }

    // 1b) L2 (Postgres) cache lookup — shared across all isolates.
    const l2 = await l2Get(cacheKey);
    if (l2) {
      // Promote to L1 for instant subsequent hits on this isolate.
      cacheSet(cacheKey, l2.payload);
      const totalMs = Date.now() - reqStart;
      slog("info", traceId, "response", {
        cache: "HIT_L2", ageSec: Math.round(l2.ageMs / 1000), totalMs, rapidCalls: 0,
      });
      heatTrack(username, "HIT");
      metricRecord(`user:${username}`, totalMs, false);
      if (!isReplay) recordTrace({
        traceId, recordedAt: Date.now(),
        username, type, pages, cursor, force,
        cache: "HIT_L2", totalMs,
        rapidCalls: 0, rapidTotalMs: 0, rapidErrors: 0,
        slowest: [],
      });
      return json(l2.payload, 200, {
        "X-Cache": "HIT_L2",
        "X-Cache-Age": String(Math.round(l2.ageMs / 1000)),
        "X-Duration-Ms": String(totalMs),
        "X-Trace-Id": traceId,
        "X-Cache-Heatmap": heatHeaderValue(),
        "X-Cache-Stats": heatStatsHeader(),
        "Cache-Control": "public, max-age=300",
      });
    }
  }

  // 2) Coalesce concurrent identical requests — only 1 RapidAPI call for N parallel callers
  let inflight = INFLIGHT.get(cacheKey);
  let isCoalesced = true;
  const ctx = newCtx(traceId, username, type);
  if (!inflight) {
    isCoalesced = false;
    inflight = (async () => {
      try {
        const r = await buildResult(username, type, ctx, { pages });
        cacheSet(cacheKey, r);
        // Fire-and-forget write to L2 — don't slow down the response.
        // @ts-ignore EdgeRuntime is a Supabase Deno global
        if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
          // @ts-ignore
          EdgeRuntime.waitUntil(l2Set(cacheKey, username, type, pages, r));
        } else {
          l2Set(cacheKey, username, type, pages, r).catch(() => null);
        }
        return r;
      } finally {
        INFLIGHT.delete(cacheKey);
      }
    })();
    INFLIGHT.set(cacheKey, inflight);
  } else {
    slog("info", traceId, "coalesced", { cacheKey });
  }

  try {
    const payload = await inflight;
    const totalMs = Date.now() - reqStart;
    const cacheState = force ? "BYPASS" : (isCoalesced ? "COALESCED" : "MISS");
    // RapidAPI timing summary (only when we actually scraped, not coalesced).
    const rapidTotalMs = ctx.rapidCalls.reduce((s, c) => s + c.ms, 0);
    const rapidErrors = ctx.rapidCalls.filter(c => c.status === "err").length;
    const slowest = slowestRapidCalls(ctx, 5);
    slog("info", traceId, "response", {
      cache: cacheState, totalMs, coalesced: isCoalesced,
      rapidCalls: ctx.rapidCalls.length,
      rapidTotalMs, rapidErrors,
      slowestPath: slowest[0]?.path ?? null,
      slowest,
    });
    heatTrack(username, cacheState);
    metricRecord(`user:${username}`, totalMs, false);
    const reqMetrics = metricsForRequest(username, ctx);
    slog("info", traceId, "metrics", { username, ...reqMetrics });
    if (!isReplay) recordTrace({
      traceId, recordedAt: Date.now(),
      username, type, pages, cursor, force,
      cache: cacheState, totalMs,
      rapidCalls: ctx.rapidCalls.length, rapidTotalMs, rapidErrors,
      slowest,
    });
    // Attach _debug only when we actually made calls (skip pure coalesced
    // responses where ctx is empty — they share the upstream payload).
    const debugPayload = ctx.rapidCalls.length > 0
      ? { ...(payload as Record<string, unknown>), _debug: { ...buildDebugSummary(ctx, totalMs), metrics: reqMetrics } }
      : payload;
    return json(debugPayload, 200, {
      "X-Cache": cacheState,
      "X-Duration-Ms": String(totalMs),
      "X-Trace-Id": traceId,
      "X-Cache-Heatmap": heatHeaderValue(),
      "X-Cache-Stats": heatStatsHeader(),
      "Cache-Control": "public, max-age=300",
    });
  } catch (e) {
    const totalMs = Date.now() - reqStart;
    const errMsg = (e as Error).message;
    metricRecord(`user:${username}`, totalMs, true);
    slog("error", traceId, "fatal", {
      totalMs, err: errMsg,
      rapidCalls: ctx.rapidCalls.length,
      rapidErrors: ctx.rapidCalls.filter(c => c.status === "err").length,
    });
    if (!isReplay) recordTrace({
      traceId, recordedAt: Date.now(),
      username, type, pages, cursor, force,
      cache: "ERROR", totalMs,
      rapidCalls: ctx.rapidCalls.length,
      rapidTotalMs: ctx.rapidCalls.reduce((s, c) => s + c.ms, 0),
      rapidErrors: ctx.rapidCalls.filter(c => c.status === "err").length,
      slowest: slowestRapidCalls(ctx, 5),
      err: errMsg,
    });
    return json({ error: "Scrape failed", message: errMsg, traceId }, 502, { "X-Trace-Id": traceId });
  }
});

