import { query, queryOne, execute } from "./db";

// L1 in-memory cache (per process) — same as Supabase edge per-isolate cache
interface CacheRec {
  storedAt: number;
  hardExp: number;
  payload: unknown;
  hits: number;
}

const RESP_CACHE = new Map<string, CacheRec>();
const RESP_CACHE_MAX = 500;
const SOFT_TTL_MS = 5 * 60 * 1000;   // 5 min
const HARD_TTL_MS = 60 * 60 * 1000;  // 60 min

// L2 Postgres cache TTL — 7 days so data survives API downtime windows
const L2_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface CacheLookup {
  payload: unknown;
  isStale: boolean;
  ageMs: number;
}

export function cacheGet(k: string): CacheLookup | null {
  const r = RESP_CACHE.get(k);
  if (!r) return null;
  const age = Date.now() - r.storedAt;
  if (Date.now() > r.hardExp) { RESP_CACHE.delete(k); return null; }
  r.hits++;
  return { payload: r.payload, isStale: age > SOFT_TTL_MS, ageMs: age };
}

export function cacheSet(k: string, payload: unknown): void {
  if (RESP_CACHE.size >= RESP_CACHE_MAX) {
    // Evict least-popular (fewest hits)
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
}

export function cacheDelete(k: string): void {
  RESP_CACHE.delete(k);
}

// L2 Postgres cache
export async function l2Get(
  cacheKey: string,
  ignoreExpiry = false
): Promise<{ payload: unknown; ageMs: number } | null> {
  try {
    const row = await queryOne<{
      payload: unknown;
      stored_at: string;
      expires_at: string;
    }>(
      "SELECT payload, stored_at, expires_at FROM search_cache WHERE cache_key = $1 LIMIT 1",
      [cacheKey]
    );
    if (!row) return null;
    if (!ignoreExpiry && Date.now() > new Date(row.expires_at).getTime()) return null;
    return {
      payload: row.payload,
      ageMs: Date.now() - new Date(row.stored_at).getTime(),
    };
  } catch {
    return null;
  }
}

export async function l2Set(
  cacheKey: string,
  username: string,
  type: string,
  pages: number,
  payload: unknown
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + L2_TTL_SECONDS * 1000).toISOString();
    await execute(
      `INSERT INTO search_cache (cache_key, username, type, pages, payload, stored_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, now(), $6)
       ON CONFLICT (cache_key) DO UPDATE SET
         username=EXCLUDED.username, type=EXCLUDED.type, pages=EXCLUDED.pages,
         payload=EXCLUDED.payload, stored_at=now(), expires_at=EXCLUDED.expires_at`,
      [cacheKey, username, type, pages, JSON.stringify(payload), expiresAt]
    );
  } catch {
    // best-effort, never block
  }
}

// In-flight coalescing
const INFLIGHT = new Map<string, Promise<unknown>>();
const REVALIDATING = new Set<string>();

export function getInflight(k: string): Promise<unknown> | undefined {
  return INFLIGHT.get(k);
}
export function setInflight(k: string, p: Promise<unknown>): void {
  INFLIGHT.set(k, p);
}
export function deleteInflight(k: string): void {
  INFLIGHT.delete(k);
}
export function isRevalidating(k: string): boolean {
  return REVALIDATING.has(k);
}
export function markRevalidating(k: string): void {
  REVALIDATING.add(k);
}
export function clearRevalidating(k: string): void {
  REVALIDATING.delete(k);
}
