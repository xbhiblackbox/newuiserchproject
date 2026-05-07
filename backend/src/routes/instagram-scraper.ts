import { Router, Request, Response } from "express";
import { z } from "zod";
import { queryOne } from "../lib/db";
import {
  cacheGet, cacheSet, l2Get, l2Set,
  getInflight, setInflight, deleteInflight,
} from "../lib/cache";
import {
  normalizeProfile, normalizeMediaItem, dedupeMediaItems,
  normalizeHighlight, str, num
} from "../lib/scraperHelpers";

const router = Router();

const ScrapeReqSchema = z.object({
  username: z.string().min(1),
  type: z.enum(["profile", "reels", "posts", "highlights", "all"]).default("all"),
  force: z.boolean().default(false),
  pages: z.number().min(1).max(10).default(1),
  cursor: z.string().optional(),
});

// ─── Instagram Direct (No API Key Required) ──────────────────────────────────

// Realistic browser headers to avoid 429/403
function igHeaders(): Record<string, string> {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "X-IG-App-ID": "936619743392459",
    "X-ASBD-ID": "198387",
    "X-IG-WWW-Claim": "0",
    "Origin": "https://www.instagram.com",
    "Referer": "https://www.instagram.com/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  };
}

async function igFetch(url: string, timeout = 15000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const r = await fetch(url, {
      headers: igHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();
    try { return JSON.parse(text); } catch { return null; }
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

/**
 * Fetch profile directly from Instagram's web API — no third-party API key needed.
 */
async function scrapeProfile(username: string): Promise<any> {
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  try {
    const data = await igFetch(url);
    if (data?.data?.user) {
      const u = data.data.user;
      return {
        username: str(u.username),
        fullName: str(u.full_name),
        bio: str(u.biography),
        avatarUrl: str(u.profile_pic_url_hd ?? u.profile_pic_url),
        isVerified: !!(u.is_verified),
        followers: num(u.edge_followed_by?.count ?? u.follower_count),
        following: num(u.edge_follow?.count ?? u.following_count),
        postsCount: num(u.edge_owner_to_timeline_media?.count ?? u.media_count),
        externalUrl: str(u.external_url ?? u.bio_links?.[0]?.url),
        category: str(u.category_name ?? u.category),
      };
    }
  } catch (e: any) {
    console.warn(`[ig-direct] web_profile_info failed: ${e.message}`);
  }

  // Fallback: try the old ?__a=1 endpoint (sometimes still works)
  try {
    const data2 = await igFetch(`https://www.instagram.com/${encodeURIComponent(username)}/?__a=1&__d=dis`);
    if (data2?.graphql?.user || data2?.user) {
      return normalizeProfile(data2);
    }
  } catch (e: any) {
    console.warn(`[ig-direct] ?__a=1 failed: ${e.message}`);
  }

  throw new Error(`Profile not found for @${username}`);
}

/**
 * Fetch media using Instagram's GraphQL endpoint.
 */
async function scrapeMedia(
  username: string,
  mediaType: "reels" | "posts",
  pages: number,
  cursor?: string
): Promise<{ items: any[]; hasNext: boolean; nextCursor: string }> {
  const allItems: any[] = [];
  let currentCursor = cursor || "";
  let hasNext = false;

  // First get user_id from profile
  let userId: string | null = null;
  try {
    const profileUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
    const profileData = await igFetch(profileUrl);
    userId = str(profileData?.data?.user?.id ?? profileData?.data?.user?.pk ?? "");
  } catch {}

  for (let page = 0; page < pages; page++) {
    const cursorParam = currentCursor ? `,"after":"${currentCursor}"` : "";
    let data: any = null;

    if (mediaType === "reels" && userId) {
      // Reels via clips endpoint
      try {
        const url = `https://www.instagram.com/api/v1/clips/user/?target_user_id=${userId}&page_size=12${currentCursor ? `&max_id=${encodeURIComponent(currentCursor)}` : ""}`;
        data = await igFetch(url);
      } catch (e: any) {
        console.warn(`[ig-direct] clips failed:`, e.message);
      }
    }

    if (!data && userId) {
      // Posts via timeline GraphQL
      const query = mediaType === "posts"
        ? `query_hash=be13233562af2d229b008d2976b998b5&variables={"id":"${userId}","first":12${cursorParam}}`
        : `query_hash=d4d88dc1500312af6f937f7b804c68c3&variables={"user_id":"${userId}","include_reel":true,"fetch_mutual":false,"count":12${cursorParam}}`;
      try {
        data = await igFetch(`https://www.instagram.com/graphql/query/?${query}`);
      } catch (e: any) {
        console.warn(`[ig-direct] graphql failed:`, e.message);
      }
    }

    if (!data) break;

    // Normalize items
    const rawArr: any[] =
      data?.items ??
      data?.data?.user?.edge_owner_to_timeline_media?.edges ??
      data?.data?.user?.edge_felix_video_timeline?.edges ??
      data?.data?.items ??
      (Array.isArray(data) ? data : []);

    const normalized = dedupeMediaItems(rawArr)
      .map(normalizeMediaItem)
      .filter(Boolean);
    allItems.push(...normalized);

    // Pagination
    const pageInfo =
      data?.paging_info ??
      data?.data?.user?.edge_owner_to_timeline_media?.page_info ??
      data?.data?.user?.edge_felix_video_timeline?.page_info;
    const nextMaxId = str(pageInfo?.end_cursor ?? pageInfo?.max_id ?? data?.next_max_id ?? "");
    hasNext = !!(pageInfo?.has_next_page ?? (nextMaxId && nextMaxId !== currentCursor));
    currentCursor = nextMaxId;
    if (!currentCursor || !hasNext) break;
  }

  return { items: allItems, hasNext, nextCursor: currentCursor };
}

/**
 * Fetch highlights from Instagram.
 */
async function scrapeHighlights(username: string): Promise<any[]> {
  try {
    const profileUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
    const profileData = await igFetch(profileUrl);
    const userId = str(profileData?.data?.user?.id ?? profileData?.data?.user?.pk ?? "");
    if (!userId) return [];

    const data = await igFetch(
      `https://www.instagram.com/api/v1/highlights/${userId}/highlights_tray/`
    );
    const rawArr: any[] = data?.tray ?? data?.data?.tray ?? [];
    return rawArr.map(normalizeHighlight).filter(Boolean);
  } catch {
    return [];
  }
}

// ─── Express Route ────────────────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const traceId = (req as any).traceId;
  const rawBody = req.body;

  // ── 1. Auth: verify x-access-key ─────────────────────────────────────────
  const accessKey = req.headers["x-access-key"] as string | undefined;
  if (!accessKey) {
    res.status(401).json({ error: "Missing x-access-key header" });
    return;
  }
  const keyRow = await queryOne<{ status: string; user_id: string }>(
    `SELECT status, user_id FROM access_keys WHERE key = $1 LIMIT 1`,
    [accessKey]
  ).catch(() => null);
  if (!keyRow || keyRow.status !== "active") {
    res.status(403).json({ error: "Invalid or inactive access key" });
    return;
  }

  // ── 2. Parse & validate body ──────────────────────────────────────────────
  const parsed = ScrapeReqSchema.safeParse(rawBody);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
    return;
  }
  const { username, type, force, pages, cursor } = parsed.data;

  // ── 3. Inflight dedup ─────────────────────────────────────────────────────
  const inflightKey = `${username}:${type}`;
  if (!force && getInflight(inflightKey)) {
    console.log(`[scraper] inflight dedup for ${inflightKey}`);
    res.status(202).json({ ok: false, queued: true, message: "Already in progress" });
    return;
  }
  setInflight(inflightKey, Promise.resolve());

  try {
    // ── 4. Cache check ──────────────────────────────────────────────────────
    if (!force) {
      const l1 = cacheGet(username);
      const l2 = l1 ? null : await l2Get(username);
      const cached = l1?.payload ?? l2?.payload ?? null;
      if (cached) {
        console.log(`[scraper] cache hit for @${username}`);
        res.json({ ok: true, cached: true, data: cached });
        return;
      }
    }

    // ── 5. Scrape ───────────────────────────────────────────────────────────
    console.log(`[scraper:${traceId}] starting scrape for @${username} type=${type}`);

    let profile: any = null;
    let reels: any[] = [];
    let posts: any[] = [];
    let highlights: any[] = [];
    let reelsMeta = { hasNext: false, nextCursor: "" };
    let postsMeta = { hasNext: false, nextCursor: "" };

    if (type === "profile" || type === "all") {
      profile = await scrapeProfile(username);
    }

    if (type === "reels" || type === "all") {
      const r = await scrapeMedia(username, "reels", pages, cursor);
      reels = r.items;
      reelsMeta = { hasNext: r.hasNext, nextCursor: r.nextCursor };
    }

    if (type === "posts" || type === "all") {
      const p = await scrapeMedia(username, "posts", pages, cursor);
      posts = p.items;
      postsMeta = { hasNext: p.hasNext, nextCursor: p.nextCursor };
    }

    if (type === "highlights" || type === "all") {
      highlights = await scrapeHighlights(username);
    }

    const result = {
      profile,
      reels,
      posts,
      highlights,
      reelsMeta,
      postsMeta,
      scrapedAt: new Date().toISOString(),
    };

    // ── 6. Cache the result ─────────────────────────────────────────────────
    cacheSet(username, result);
    const cacheKey = `${username}:${type}:${pages}`;
    l2Set(cacheKey, username, type, pages, result).catch(() => null); // fire-and-forget

    console.log(`[scraper:${traceId}] done for @${username}: profile=${!!profile?.username} reels=${reels.length} posts=${posts.length}`);
    res.json({ ok: true, cached: false, data: result });
  } catch (e: any) {
    console.error(`[scraper:${traceId}] error for @${username}:`, e.message);
    const isNotFound = /not found|private|doesn't exist/i.test(e.message);
    res.status(isNotFound ? 404 : 502).json({
      ok: false,
      error: e.message,
      profileOk: false,
    });
  } finally {
    deleteInflight(inflightKey);
  }
});

export default router;
