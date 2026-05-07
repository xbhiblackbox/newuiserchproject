import { Router, Request, Response } from "express";
import { z } from "zod";
import { callRapid, incrementApiUsageAndAlert } from "../lib/rapidapi";
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

// ─── API helper (uses callRapid → key from Supabase api_settings or env var) ──
async function igGet(path: string): Promise<any> {
  return callRapid(path, { method: "GET" }, () => {
    // Count each profile/media call for quota alerts
    incrementApiUsageAndAlert().catch(() => null);
  });
}

// ─── User ID resolution (in-memory cache for request lifecycle) ────────────────
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

  // Fallback via user ID
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
        const hasItems = data && (
          data.items || data.data || data.reels || data.posts || data.feeds || Array.isArray(data)
        );
        if (hasItems) break;
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
    return []; // Highlights are optional — never block the request
  }
}

// ─── Route ─────────────────────────────────────────────────────────────────────
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const traceId = (req as any).traceId ?? "?";

  // ── Auth ──────────────────────────────────────────────────────────────────────
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
        execute(
          "UPDATE access_keys SET device_fingerprints=$1, updated_at=now() WHERE id=$2",
          [fps, row.id]
        ).catch(() => null);
      }
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────────────
  const parsed = ScrapeReqSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const { username, type, force, pages, cursor } = parsed.data;
  const u = username.toLowerCase().replace(/^@/, "");
  const fp = req.headers["x-device-fp"] as string | undefined;
  const cacheKey = `v3:${fp ?? "anon"}:${u}:${type}:${pages}${cursor ? `:${cursor.slice(0, 20)}` : ""}`;

  // ── Cache lookup ──────────────────────────────────────────────────────────────
  if (!force) {
    const l1 = cacheGet(cacheKey);
    if (l1 && !l1.isStale) {
      res.setHeader("X-Cache", "HIT-L1").setHeader("X-Cache-Age", String(Math.round(l1.ageMs / 1000)));
      res.json(l1.payload); return;
    }
    const l2 = await l2Get(cacheKey);
    if (l2 && l2.ageMs < 10 * 60 * 1000) {
      cacheSet(cacheKey, l2.payload);
      res.setHeader("X-Cache", "HIT-L2").setHeader("X-Cache-Age", String(Math.round(l2.ageMs / 1000)));
      res.json(l2.payload); return;
    }
  }

  // ── In-flight coalescing ──────────────────────────────────────────────────────
  const existing = getInflight(cacheKey);
  if (existing) {
    try {
      const data = await existing;
      res.setHeader("X-Cache", "INFLIGHT").json(data);
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
    return;
  }

  // ── Scrape ────────────────────────────────────────────────────────────────────
  const doScrape = async () => {
    const result: any = { username: u };

    // Pre-resolve user ID once (needed by all media endpoints)
    // Profile can run in parallel since it uses username directly
    const needsId = type === "reels" || type === "posts" || type === "highlights" || type === "all";

    const [profileRes, uidRes] = await Promise.allSettled([
      (type === "profile" || type === "all") ? scrapeProfile(u) : Promise.resolve(null),
      needsId ? resolveUserId(u).catch(() => null) : Promise.resolve(null),
    ]);

    // Handle profile result
    if (type === "profile" || type === "all") {
      if (profileRes.status === "fulfilled" && profileRes.value) {
        result.profile = profileRes.value;
        result.profileOk = true;
      } else {
        result.profileOk = false;
        result.profileError = profileRes.status === "rejected" ? profileRes.reason?.message : "No data";
        console.warn(`[looter2:${traceId}] profile @${u}:`, result.profileError);
      }
    }

    // Now fetch media in parallel (UID already resolved above)
    const mediaPromises: Promise<void>[] = [];

    if (type === "reels" || type === "all") {
      mediaPromises.push(
        scrapeMedia(u, "reels", pages, cursor)
          .then((r) => {
            result.reels = r.items;
            result.reelsOk = true;
            result.reelsHasMore = r.hasNext;
            result.reelsNextCursor = r.nextCursor;
          })
          .catch((e: any) => {
            result.reelsOk = false;
            result.reels = [];
            console.warn(`[looter2:${traceId}] reels @${u}:`, e.message);
          })
      );
    }

    if (type === "posts" || type === "all") {
      mediaPromises.push(
        scrapeMedia(u, "posts", pages, cursor)
          .then((p) => {
            result.posts = p.items;
            result.postsOk = true;
            result.postsHasMore = p.hasNext;
            result.postsNextCursor = p.nextCursor;
          })
          .catch((e: any) => {
            result.postsOk = false;
            result.posts = [];
            console.warn(`[looter2:${traceId}] posts @${u}:`, e.message);
          })
      );
    }

    if (type === "highlights" || type === "all") {
      mediaPromises.push(
        scrapeHighlights(u)
          .then((h) => {
            result.highlights = h;
            result.highlightsOk = true;
          })
          .catch(() => {
            result.highlights = [];
            result.highlightsOk = true;
          })
      );
    }

    // Run all media fetches in parallel
    await Promise.all(mediaPromises);

    if (cursor) result.paginated = true;

    // Persist to both cache layers (7-day TTL via cache.ts)
    cacheSet(cacheKey, result);
    l2Set(cacheKey, u, type, pages, result).catch(() => null);
    l2Set(`${u}:all`, u, type, pages, result).catch(() => null);

    console.log(
      `[looter2:${traceId}] done @${u} ` +
      `profile=${result.profileOk} reels=${result.reels?.length ?? 0} posts=${result.posts?.length ?? 0}`
    );
    return result;
  };

  const p = doScrape();
  setInflight(cacheKey, p);

  try {
    const data = await p;
    res.setHeader("X-Cache", "MISS").setHeader("X-Trace-Id", traceId).json(data);
  } catch (e: any) {
    // Last resort: stale Supabase cache (ignoreExpiry=true)
    try {
      const stale = await l2Get(`${u}:all`, true);
      if (stale?.payload) {
        console.log(`[looter2:${traceId}] serving stale cache for @${u}`);
        cacheSet(cacheKey, stale.payload);
        res.setHeader("X-Cache", "STALE").json(stale.payload);
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
