import { Router, Request, Response } from "express";
import { z } from "zod";
import { callRapid } from "../lib/rapidapi";
import {
  cacheGet, cacheSet, l2Get, l2Set,
  getInflight, setInflight, deleteInflight,
} from "../lib/cache";
import {
  normalizeMediaItem, dedupeMediaItems,
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

// ─── instagram-scraper-api2.p.rapidapi.com helpers ───────────────────────────
// Set RAPIDAPI_HOST=instagram-scraper-api2.p.rapidapi.com in Railway env vars.
// Free tier: 100 req/month. Subscribe at: https://rapidapi.com/herosAPI/api/instagram-scraper-api2

function normalizeProfile(raw: any) {
  // instagram-scraper-api2 wraps data in data.data or data.data.user
  const u =
    raw?.data?.data?.user ??
    raw?.data?.user ??
    raw?.data ??
    raw?.user ??
    raw ?? {};
  return {
    username: str(u.username ?? u.user_name),
    fullName: str(u.full_name ?? u.fullname ?? u.fullName ?? u.name),
    bio: str(u.biography ?? u.bio),
    avatarUrl: str(
      u.hd_profile_pic_url_info?.url ??
      u.profile_pic_url_hd ??
      u.profile_pic_url ??
      u.profile_picture
    ),
    isVerified: !!(u.is_verified ?? u.verified),
    followers: num(u.follower_count ?? u.followers_count ?? u.edge_followed_by?.count),
    following: num(u.following_count ?? u.following ?? u.edge_follow?.count),
    postsCount: num(u.media_count ?? u.posts_count ?? u.edge_owner_to_timeline_media?.count),
    externalUrl: str(u.external_url ?? u.bio_links?.[0]?.url),
    category: str(u.category ?? u.category_name),
  };
}

async function scrapeProfile(username: string): Promise<any> {
  const data = await callRapid(
    `/v1/info?username_or_id_or_url=${encodeURIComponent(username)}`,
    { method: "GET" },
    () => {}
  );
  const p = normalizeProfile(data);
  if (!p.username) throw new Error(`Profile not found for @${username}`);
  return p;
}

async function scrapeMedia(
  username: string,
  mediaType: "reels" | "posts",
  pages: number,
  cursor?: string
): Promise<{ items: any[]; hasNext: boolean; nextCursor: string }> {
  const allItems: any[] = [];
  let currentCursor = cursor || "";
  let hasNext = false;

  const basePath = mediaType === "reels" ? "/v1/reels" : "/v1/posts";

  for (let page = 0; page < pages; page++) {
    const cursorParam = currentCursor ? `&max_id=${encodeURIComponent(currentCursor)}` : "";
    let data: any = null;

    try {
      data = await callRapid(
        `${basePath}?username_or_id_or_url=${encodeURIComponent(username)}${cursorParam}`,
        { method: "GET" },
        () => {}
      );
    } catch (e: any) {
      console.warn(`[scraper] ${mediaType} page ${page} failed:`, e.message);
      break;
    }

    if (!data) break;

    // instagram-scraper-api2 response shape
    const edges: any[] =
      data?.data?.user?.edge_owner_to_timeline_media?.edges ??
      data?.data?.user?.edge_felix_video_timeline?.edges ??
      data?.data?.items ??
      data?.data?.reels_media ??
      data?.items ??
      (Array.isArray(data?.data) ? data.data : []);

    const normalized = dedupeMediaItems(edges)
      .map(normalizeMediaItem)
      .filter(Boolean);
    allItems.push(...normalized);

    const pageInfo =
      data?.data?.user?.edge_owner_to_timeline_media?.page_info ??
      data?.data?.user?.edge_felix_video_timeline?.page_info ??
      data?.data?.page_info ??
      data?.page_info;

    const nextCursor = str(
      pageInfo?.end_cursor ??
      data?.data?.next_max_id ??
      data?.next_max_id ??
      ""
    );
    hasNext = !!(pageInfo?.has_next_page ?? (nextCursor && nextCursor !== currentCursor));
    currentCursor = nextCursor;
    if (!currentCursor || !hasNext) break;
  }

  return { items: allItems, hasNext, nextCursor: currentCursor };
}

async function scrapeHighlights(username: string): Promise<any[]> {
  try {
    const data = await callRapid(
      `/v1/highlights?username_or_id_or_url=${encodeURIComponent(username)}`,
      { method: "GET" },
      () => {}
    );
    const rawArr: any[] =
      data?.data?.tray ??
      data?.data?.highlights ??
      data?.tray ??
      (Array.isArray(data?.data) ? data.data : []);
    return rawArr.map(normalizeHighlight).filter(Boolean);
  } catch {
    return [];
  }
}

// ─── Express Route ────────────────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const traceId = (req as any).traceId;

  // Auth is bypass-able via MASTER_ACCESS_KEY env var for personal use.
  // If MASTER_ACCESS_KEY is not set, all keys are accepted (open mode).
  const accessKey = req.headers["x-access-key"] as string | undefined;
  const masterKey = process.env.MASTER_ACCESS_KEY;
  if (masterKey && accessKey !== masterKey) {
    // Only enforce if MASTER_ACCESS_KEY is explicitly set
    res.status(403).json({ error: "Invalid access key" });
    return;
  }

  const parsed = ScrapeReqSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
    return;
  }
  const { username, type, force, pages, cursor } = parsed.data;

  const inflightKey = `${username}:${type}`;
  if (!force && getInflight(inflightKey)) {
    res.status(202).json({ ok: false, queued: true, message: "Already in progress" });
    return;
  }
  setInflight(inflightKey, Promise.resolve());

  try {
    // Cache check
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

    console.log(`[scraper:${traceId}] scraping @${username} type=${type}`);

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

    const result = { profile, reels, posts, highlights, reelsMeta, postsMeta, scrapedAt: new Date().toISOString() };

    cacheSet(username, result);
    const cacheKey = `${username}:${type}:${pages}`;
    l2Set(cacheKey, username, type, pages, result).catch(() => null);

    console.log(`[scraper:${traceId}] done @${username}: profile=${!!profile?.username} reels=${reels.length} posts=${posts.length}`);
    res.json({ ok: true, cached: false, data: result });
  } catch (e: any) {
    console.error(`[scraper:${traceId}] error @${username}:`, e.message);
    const isNotFound = /not found|private|doesn't exist/i.test(e.message);
    res.status(isNotFound ? 404 : 502).json({ ok: false, error: e.message, profileOk: false });
  } finally {
    deleteInflight(inflightKey);
  }
});

export default router;
