import { Router, Request, Response } from "express";
import { z } from "zod";
import { queryOne, execute } from "../lib/db";
import {
  cacheGet, cacheSet, l2Get, l2Set,
  getInflight, setInflight, deleteInflight,
} from "../lib/cache";
import {
  normalizeProfile, normalizeMediaItem, dedupeMediaItems,
  normalizeHighlight, str,
} from "../lib/scraperHelpers";

const router = Router();

// ─── Request Schema ────────────────────────────────────────────────────────────
const ScrapeReqSchema = z.object({
  username: z.string().min(1),
  type: z.enum(["profile", "reels", "posts", "highlights", "all"]).default("all"),
  force: z.boolean().default(false),
  pages: z.number().min(1).max(10).default(1),
  cursor: z.string().optional(),
});

// ─── API Config ────────────────────────────────────────────────────────────────
// Set in Railway: RAPIDAPI_KEY and RAPIDAPI_HOST
const RAPID_HOST = process.env.RAPIDAPI_HOST ?? "instagram-looter2.p.rapidapi.com";
const RAPID_KEY  = process.env.RAPIDAPI_KEY  ?? "";

// ─── HTTP helper ───────────────────────────────────────────────────────────────
async function igGet(path: string, timeoutMs = 25000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(`https://${RAPID_HOST}${path}`, {
      method: "GET",
      headers: {
        "x-rapidapi-host": RAPID_HOST,
        "x-rapidapi-key":  RAPID_KEY,
        "Content-Type":    "application/json",
      },
      signal: controller.signal,
    }) as any;
    clearTimeout(timer);
    const text = await r.text();
    if (!r.ok) throw new Error(`API ${r.status}: ${text.slice(0, 200)}`);
    try { return JSON.parse(text); } catch { return null; }
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ─── User ID resolution (cached in-process) ────────────────────────────────────
const uidCache = new Map<string, string>();

async function resolveUserId(username: string): Promise<string> {
  if (uidCache.has(username)) return uidCache.get(username)!;
  const data = await igGet(`/id?username=${encodeURIComponent(username)}`);
  const id = str(data?.id ?? data?.data?.id ?? data?.user_id ?? data?.pk ?? data);
  if (!id || id === "0") throw new Error(`Cannot resolve user ID for @${username}`);
  uidCache.set(username, id);
  return id;
}

// ─── Profile ───────────────────────────────────────────────────────────────────
async function scrapeProfile(username: string): Promise<any> {
  // Try direct profile endpoints first
  for (const path of [
    `/web-profile?username=${encodeURIComponent(username)}`,
    `/profile?username=${encodeURIComponent(username)}`,
  ]) {
    try {
      const data = await igGet(path);
      if (data && (data.data || data.user || data.username || data.pk)) {
        return normalizeProfile(data);
      }
    } catch (e: any) {
      console.warn(`[looter2] ${path} failed:`, e.message);
    }
  }

  // Fallback: resolve user ID → user-info
  const uid = await resolveUserId(username);
  const data = await igGet(`/user-info?id=${encodeURIComponent(uid)}`);
  if (data && (data.data || data.user || data.username || data.pk)) {
    return normalizeProfile(data);
  }
  throw new Error(`Profile not found for @${username}`);
}

// ─── Media (Reels / Posts) ──────────────────────────────────────────────────────
async function scrapeMedia(
  username: string,
  mediaType: "reels" | "posts",
  pages: number,
  cursor?: string,
): Promise<{ items: any[]; hasNext: boolean; nextCursor: string }> {
  const uid = await resolveUserId(username);
  const primaryEp  = mediaType === "reels" ? "/reels"      : "/user-feeds";
  const fallbackEp = mediaType === "reels" ? "/user-reels" : "/posts";

  const allItems: any[] = [];
  let currentCursor = cursor ?? "";
  let hasNext = false;

  for (let page = 0; page < pages; page++) {
    const cursorParam = currentCursor ? `&max_id=${encodeURIComponent(currentCursor)}` : "";
    let data: any = null;

    for (const ep of [primaryEp, fallbackEp]) {
      try {
        data = await igGet(`${ep}?id=${encodeURIComponent(uid)}&count=12${cursorParam}`);
        if (data && (data.items || data.data || data.reels || data.posts || data.feeds || Array.isArray(data))) break;
        data = null;
      } catch (e: any) {
        console.warn(`[looter2] ${mediaType} ${ep} failed:`, e.message);
      }
    }

    if (!data) break;

    const rawArr: any[] = (
      data?.items ?? data?.data?.items ??
      data?.reels ?? data?.data?.reels ??
      data?.feeds ?? data?.data?.feeds ??
      data?.posts ?? data?.data?.posts ??
      (Array.isArray(data) ? data : [])
    );

    allItems.push(...dedupeMediaItems(rawArr).map(normalizeMediaItem).filter(Boolean));

    const nextId = str(
      data?.next_max_id ?? data?.data?.next_max_id ??
      data?.pagination?.next_max_id ?? data?.page_info?.end_cursor ?? ""
    );
    hasNext = !!(data?.more_available ?? data?.data?.more_available ?? (nextId && nextId !== currentCursor));
    currentCursor = nextId;
    if (!currentCursor || !hasNext) break;
  }

  return { items: allItems, hasNext, nextCursor: currentCursor };
}

// ─── Highlights ────────────────────────────────────────────────────────────────
async function scrapeHighlights(username: string): Promise<any[]> {
  try {
    const uid = await resolveUserId(username);
    const data = await igGet(`/highlights?id=${encodeURIComponent(uid)}`);
    const arr: any[] = data?.items ?? data?.data ?? (Array.isArray(data) ? data : []);
    return arr.map(normalizeHighlight).filter(Boolean);
  } catch {
    return []; // Highlights are optional — never fail the request
  }
}

// ─── Route ─────────────────────────────────────────────────────────────────────
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const traceId = (req as any).traceId ?? "?";

  // Auth: check x-access-key against db (or open if MASTER_ACCESS_KEY not set)
  const masterKey = process.env.MASTER_ACCESS_KEY;
  if (masterKey) {
    const provided = req.headers["x-access-key"] as string | undefined;
    if (!provided) { res.status(401).json({ error: "Missing x-access-key" }); return; }

    const row = await queryOne<{
      id: string; active: boolean; expires_at: string | null;
      device_fingerprints: string[]; max_devices: number;
    }>(
      "SELECT id, active, expires_at, device_fingerprints, max_devices FROM access_keys WHERE key = $1 LIMIT 1",
      [provided]
    ).catch(() => null);

    if (!row || !row.active || (row.expires_at && new Date(row.expires_at) < new Date())) {
      res.status(401).json({ error: "Invalid or expired key" }); return;
    }

    const fp = req.headers["x-device-fp"] as string | undefined;
    if (fp) {
      const fps = row.device_fingerprints ?? [];
      if (!fps.includes(fp)) {
        if (fps.length >= (row.max_devices ?? 1)) {
          res.status(401).json({ error: "Device limit reached" }); return;
        }
        fps.push(fp);
        execute("UPDATE access_keys SET device_fingerprints=$1, updated_at=now() WHERE id=$2", [fps, row.id]).catch(() => null);
      }
    }
  }

  const parsed = ScrapeReqSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const { username, type, force, pages, cursor } = parsed.data;
  const u = username.toLowerCase().replace(/^@/, "");
  const fp = req.headers["x-device-fp"] as string | undefined;
  const cacheKey = `v3:${fp ?? "anon"}:${u}:${type}:${pages}${cursor ? `:${cursor.slice(0, 20)}` : ""}`;

  // ── Cache lookup ──
  if (!force) {
    const l1 = cacheGet(cacheKey);
    if (l1 && !l1.isStale) {
      res.setHeader("X-Cache", "HIT-L1");
      res.setHeader("X-Cache-Age", String(Math.round(l1.ageMs / 1000)));
      res.json(l1.payload);
      return;
    }
    const l2 = await l2Get(cacheKey);
    if (l2 && l2.ageMs < 10 * 60 * 1000) { // 10 min fresh
      cacheSet(cacheKey, l2.payload);
      res.setHeader("X-Cache", "HIT-L2");
      res.setHeader("X-Cache-Age", String(Math.round(l2.ageMs / 1000)));
      res.json(l2.payload);
      return;
    }
  }

  // ── In-flight coalescing ──
  const existing = getInflight(cacheKey);
  if (existing) {
    try {
      const data = await existing;
      res.setHeader("X-Cache", "INFLIGHT");
      res.json(data);
      return;
    } catch (e: any) {
      res.status(502).json({ error: e.message });
      return;
    }
  }

  // ── Scrape ──
  const doScrape = async () => {
    const result: any = { username: u };

    if (type === "profile" || type === "all") {
      try {
        result.profile = await scrapeProfile(u);
        result.profileOk = true;
      } catch (e: any) {
        result.profileOk = false;
        result.profileError = e.message;
        console.warn(`[looter2] profile @${u}:`, e.message);
      }
    }

    if (type === "reels" || type === "all") {
      try {
        const r = await scrapeMedia(u, "reels", pages, cursor);
        result.reels = r.items;
        result.reelsOk = true;
        result.reelsHasMore = r.hasNext;
        result.reelsNextCursor = r.nextCursor;
      } catch (e: any) {
        result.reelsOk = false;
        result.reels = [];
        console.warn(`[looter2] reels @${u}:`, e.message);
      }
    }

    if (type === "posts" || type === "all") {
      try {
        const p = await scrapeMedia(u, "posts", pages, cursor);
        result.posts = p.items;
        result.postsOk = true;
        result.postsHasMore = p.hasNext;
        result.postsNextCursor = p.nextCursor;
      } catch (e: any) {
        result.postsOk = false;
        result.posts = [];
        console.warn(`[looter2] posts @${u}:`, e.message);
      }
    }

    if (type === "highlights" || type === "all") {
      result.highlights = await scrapeHighlights(u);
      result.highlightsOk = true;
    }

    if (cursor) result.paginated = true;

    // Save to both cache layers
    cacheSet(cacheKey, result);
    l2Set(cacheKey, u, type, pages, result).catch(() => null);
    // Also save by plain username for stale fallback
    l2Set(`${u}:all`, u, type, pages, result).catch(() => null);

    console.log(`[looter2:${traceId}] done @${u} profile=${result.profileOk} reels=${result.reels?.length ?? 0} posts=${result.posts?.length ?? 0}`);
    return result;
  };

  const p = doScrape();
  setInflight(cacheKey, p);

  try {
    const data = await p;
    res.setHeader("X-Cache", "MISS");
    res.setHeader("X-Trace-Id", traceId);
    res.json(data);
  } catch (e: any) {
    // Last resort: try stale L2 cache (ignore TTL)
    try {
      const stale = await l2Get(`${u}:all`, true);
      if (stale?.payload) {
        console.log(`[looter2:${traceId}] serving stale cache for @${u}`);
        cacheSet(cacheKey, stale.payload);
        res.setHeader("X-Cache", "STALE");
        res.json(stale.payload);
        return;
      }
    } catch {}
    console.error(`[looter2:${traceId}] fatal @${u}:`, e.message);
    res.status(502).json({ error: e.message });
  } finally {
    deleteInflight(cacheKey);
  }
});

export default router;
