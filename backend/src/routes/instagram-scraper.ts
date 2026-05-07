import { Router, Request, Response } from "express";
import { z } from "zod";
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

// ─── instagram-scraper-stable-api.p.rapidapi.com ─────────────────────────────
// POST endpoints with form-urlencoded body
// Set in Railway env vars:
//   RAPIDAPI_HOST = instagram-scraper-stable-api.p.rapidapi.com
//   RAPIDAPI_KEY  = 765e47e809mshda12294101b09acp144800jsn331f56f88be4

async function stableCall(path: string, body: Record<string, string>): Promise<any> {
  const host = process.env.RAPIDAPI_HOST ?? "instagram-scraper-stable-api.p.rapidapi.com";
  const key  = process.env.RAPIDAPI_KEY  ?? "";

  const params = new URLSearchParams(body).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const r = await fetch(`https://${host}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-rapidapi-host": host,
        "x-rapidapi-key":  key,
      },
      body: params,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await r.text();
    if (!r.ok) throw new Error(`API ${r.status}: ${text.slice(0, 200)}`);
    try { return JSON.parse(text); } catch { return null; }
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

function igUrl(username: string) {
  return `https://www.instagram.com/${username}/`;
}

// ── Profile ──────────────────────────────────────────────────────────────────
function normalizeStableProfile(raw: any, username: string) {
  // instagram-scraper-stable-api returns data directly or inside data{}
  const d = raw?.data ?? raw?.user ?? raw ?? {};
  return {
    username:    str(d.username ?? d.user_name ?? username),
    fullName:    str(d.full_name ?? d.fullname ?? d.fullName ?? d.name ?? ""),
    bio:         str(d.biography ?? d.bio ?? ""),
    avatarUrl:   str(d.hd_profile_pic_url_info?.url ?? d.profile_pic_url_hd ?? d.profile_pic_url ?? d.profile_picture ?? ""),
    isVerified:  !!(d.is_verified ?? d.verified),
    followers:   num(d.follower_count ?? d.followers_count ?? d.edge_followed_by?.count ?? 0),
    following:   num(d.following_count ?? d.following ?? d.edge_follow?.count ?? 0),
    postsCount:  num(d.media_count ?? d.posts_count ?? d.edge_owner_to_timeline_media?.count ?? 0),
    externalUrl: str(d.external_url ?? d.bio_links?.[0]?.url ?? ""),
    category:    str(d.category ?? d.category_name ?? ""),
  };
}

async function scrapeProfile(username: string): Promise<any> {
  // Try multiple profile endpoints this API may have
  const endpoints = [
    "/get_ig_user_info_v2.php",
    "/get_ig_profile.php",
    "/profile.php",
    "/get_profile.php",
    "/user_info.php",
  ];

  for (const ep of endpoints) {
    try {
      const data = await stableCall(ep, { username_or_url: igUrl(username) });
      if (!data) continue;
      const p = normalizeStableProfile(data, username);
      if (p.username && p.username !== "") {
        console.log(`[stable] profile OK via ${ep}`);
        return p;
      }
    } catch (e: any) {
      console.warn(`[stable] ${ep} failed:`, e.message);
    }
  }
  throw new Error(`Profile not found for @${username}`);
}

// ── Media (reels / posts) ─────────────────────────────────────────────────────
async function scrapeMedia(
  username: string,
  mediaType: "reels" | "posts",
  pages: number,
  cursor?: string
): Promise<{ items: any[]; hasNext: boolean; nextCursor: string }> {
  const allItems: any[] = [];
  let currentCursor = cursor ?? "";
  let hasNext = false;

  const reelEndpoints = ["/get_ig_user_reels_v2.php", "/get_ig_reels.php", "/reels.php"];
  const postEndpoints = ["/get_ig_user_posts_v2.php", "/get_ig_posts.php",  "/posts.php", "/get_ig_user_media_v2.php"];
  const endpoints = mediaType === "reels" ? reelEndpoints : postEndpoints;

  for (let page = 0; page < pages; page++) {
    const body: Record<string, string> = { username_or_url: igUrl(username), amount: "12" };
    if (currentCursor) body.pagination_token = currentCursor;

    let data: any = null;
    for (const ep of endpoints) {
      try {
        data = await stableCall(ep, body);
        if (data && (data.data || data.items || Array.isArray(data))) {
          console.log(`[stable] ${mediaType} OK via ${ep}`);
          break;
        }
        data = null;
      } catch (e: any) {
        console.warn(`[stable] ${ep} failed:`, e.message);
        data = null;
      }
    }

    if (!data) break;

    const rawArr: any[] =
      data?.data?.items ??
      data?.data ??
      data?.items ??
      data?.reels_media ??
      (Array.isArray(data) ? data : []);

    const normalized = dedupeMediaItems(rawArr).map(normalizeMediaItem).filter(Boolean);
    allItems.push(...normalized);

    const nextToken = str(data?.pagination_token ?? data?.next_max_id ?? data?.next_cursor ?? "");
    hasNext = !!(nextToken && nextToken !== currentCursor);
    currentCursor = nextToken;
    if (!currentCursor || !hasNext) break;
  }

  return { items: allItems, hasNext, nextCursor: currentCursor };
}

// ── Highlights ────────────────────────────────────────────────────────────────
async function scrapeHighlights(username: string): Promise<any[]> {
  const endpoints = ["/get_ig_highlights.php", "/highlights.php", "/get_ig_user_highlights_v2.php"];
  for (const ep of endpoints) {
    try {
      const data = await stableCall(ep, { username_or_url: igUrl(username) });
      const rawArr: any[] = data?.data ?? data?.tray ?? data?.highlights ?? (Array.isArray(data) ? data : []);
      if (rawArr.length > 0) return rawArr.map(normalizeHighlight).filter(Boolean);
    } catch {}
  }
  return [];
}

// ─── Express Route ────────────────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const traceId = (req as any).traceId;

  // Auth: if MASTER_ACCESS_KEY env var is set, enforce it. Otherwise open.
  const masterKey = process.env.MASTER_ACCESS_KEY;
  if (masterKey) {
    const accessKey = req.headers["x-access-key"] as string | undefined;
    if (accessKey !== masterKey) {
      res.status(403).json({ error: "Invalid access key" });
      return;
    }
  }

  const parsed = ScrapeReqSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
    return;
  }
  const { username, type, force, pages, cursor } = parsed.data;

  const inflightKey = `${username}:${type}`;
  if (!force && getInflight(inflightKey)) {
    res.status(202).json({ ok: false, queued: true });
    return;
  }
  setInflight(inflightKey, Promise.resolve());

  try {
    if (!force) {
      const l1 = cacheGet(username);
      const l2 = l1 ? null : await l2Get(username);
      const cached = l1?.payload ?? l2?.payload ?? null;
      if (cached) {
        res.json({ ok: true, cached: true, data: cached });
        return;
      }
    }

    console.log(`[scraper:${traceId}] @${username} type=${type}`);

    let profile: any = null;
    let reels: any[] = [];
    let posts: any[] = [];
    let highlights: any[] = [];
    let reelsMeta = { hasNext: false, nextCursor: "" };
    let postsMeta  = { hasNext: false, nextCursor: "" };

    if (type === "profile" || type === "all") profile = await scrapeProfile(username);
    if (type === "reels"   || type === "all") { const r = await scrapeMedia(username, "reels", pages, cursor); reels = r.items; reelsMeta = { hasNext: r.hasNext, nextCursor: r.nextCursor }; }
    if (type === "posts"   || type === "all") { const p = await scrapeMedia(username, "posts", pages, cursor); posts = p.items; postsMeta = { hasNext: p.hasNext, nextCursor: p.nextCursor }; }
    if (type === "highlights" || type === "all") highlights = await scrapeHighlights(username);

    const result = { profile, reels, posts, highlights, reelsMeta, postsMeta, scrapedAt: new Date().toISOString() };
    cacheSet(username, result);
    l2Set(`${username}:${type}:${pages}`, username, type, pages, result).catch(() => null);

    console.log(`[scraper:${traceId}] done @${username} reels=${reels.length} posts=${posts.length}`);
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
