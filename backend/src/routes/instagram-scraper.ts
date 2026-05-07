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
// All endpoints are POST with application/x-www-form-urlencoded
// HARDCODED key & host — no env var needed

const RAPID_KEY  = "765e47e809mshda12294101b09acp144800jsn331f56f88be4";
const RAPID_HOST = "instagram-scraper-stable-api.p.rapidapi.com";

async function stablePost(endpoint: string, body: Record<string, string>): Promise<any> {
  const params = new URLSearchParams(body).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const r = await fetch(`https://${RAPID_HOST}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-rapidapi-host": RAPID_HOST,
        "x-rapidapi-key":  process.env.RAPIDAPI_KEY ?? RAPID_KEY,
      },
      body: params,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await r.text();
    if (!r.ok) throw new Error(`Stable API ${r.status}: ${text.slice(0, 200)}`);
    try {
      const j = JSON.parse(text);
      // API returns error field when Instagram blocks the proxy
      if (j?.error && typeof j.error === "string") {
        throw new Error(`Instagram blocked: ${j.error}`);
      }
      return j;
    } catch (e: any) {
      if (e.message.startsWith("Instagram blocked")) throw e;
      return null;
    }
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
// Endpoint confirmed from RapidAPI playground: /ig_get_fb_profile_v3.php
// Parameter: username_or_url = just the username (NOT full URL)

function normalizeProfile(raw: any, username: string) {
  // Account Data V2 (/ig_get_fb_profile_v3.php) response shape
  const u =
    raw?.data?.user ??
    raw?.user ??
    raw?.data ??
    raw ?? {};

  return {
    username:    str(u.username ?? u.user_name ?? username),
    fullName:    str(u.full_name ?? u.fullname ?? u.name ?? ""),
    bio:         str(u.biography ?? u.bio ?? ""),
    avatarUrl:   str(
      u.hd_profile_pic_url_info?.url ??
      u.profile_pic_url_hd ??
      u.profile_pic_url ??
      u.profile_picture ?? ""
    ),
    isVerified:  !!(u.is_verified ?? u.verified ?? false),
    followers:   num(u.follower_count ?? u.followers ?? u.edge_followed_by?.count ?? 0),
    following:   num(u.following_count ?? u.following ?? u.edge_follow?.count ?? 0),
    postsCount:  num(u.media_count ?? u.posts ?? u.edge_owner_to_timeline_media?.count ?? 0),
    externalUrl: str(u.external_url ?? u.bio_links?.[0]?.url ?? ""),
    category:    str(u.category ?? u.category_name ?? ""),
  };
}

async function scrapeProfile(username: string): Promise<any> {
  // Primary: Account Data V2
  try {
    const data = await stablePost("/ig_get_fb_profile_v3.php", { username_or_url: username });
    if (data) {
      const p = normalizeProfile(data, username);
      if (p.username) {
        console.log(`[stable] profile OK via ig_get_fb_profile_v3`);
        return p;
      }
    }
  } catch (e: any) {
    console.warn("[stable] ig_get_fb_profile_v3 failed:", e.message);
  }

  // Fallback: Account Data (v2)
  const fallbacks = ["/ig_get_fb_profile_v2.php", "/ig_get_fb_profile.php", "/get_ig_profile_v2.php"];
  for (const ep of fallbacks) {
    try {
      const data = await stablePost(ep, { username_or_url: username });
      if (data) {
        const p = normalizeProfile(data, username);
        if (p.username) {
          console.log(`[stable] profile OK via ${ep}`);
          return p;
        }
      }
    } catch {}
  }

  throw new Error(`Profile not found for @${username}`);
}

// ─── MEDIA (Posts / Reels) ────────────────────────────────────────────────────
async function scrapeMedia(
  username: string,
  mediaType: "reels" | "posts",
  pages: number,
  cursor?: string
): Promise<{ items: any[]; hasNext: boolean; nextCursor: string }> {
  const allItems: any[] = [];
  let currentCursor = cursor ?? "";
  let hasNext = false;

  // Endpoint candidates for posts/reels
  const postEps  = ["/ig_get_user_posts_v2.php", "/ig_get_user_posts.php", "/get_ig_user_posts.php"];
  const reelEps  = ["/ig_get_user_reels_v2.php", "/ig_get_user_reels.php", "/get_ig_user_reels.php"];
  const endpoints = mediaType === "reels" ? reelEps : postEps;

  for (let page = 0; page < pages; page++) {
    const body: Record<string, string> = { username_or_url: username, amount: "12" };
    if (currentCursor) body.pagination_token = currentCursor;

    let data: any = null;
    for (const ep of endpoints) {
      try {
        data = await stablePost(ep, body);
        if (data && (data.data || data.items || Array.isArray(data))) {
          console.log(`[stable] ${mediaType} OK via ${ep}`);
          break;
        }
        data = null;
      } catch {}
    }

    if (!data) break;

    const rawArr: any[] =
      data?.data?.items ?? data?.data ?? data?.items ??
      (Array.isArray(data) ? data : []);

    const normalized = dedupeMediaItems(rawArr).map(normalizeMediaItem).filter(Boolean);
    allItems.push(...normalized);

    const nextToken = str(data?.pagination_token ?? data?.next_max_id ?? "");
    hasNext = !!(nextToken && nextToken !== currentCursor);
    currentCursor = nextToken;
    if (!currentCursor || !hasNext) break;
  }

  return { items: allItems, hasNext, nextCursor: currentCursor };
}

// ─── HIGHLIGHTS ───────────────────────────────────────────────────────────────
async function scrapeHighlights(username: string): Promise<any[]> {
  const eps = ["/ig_get_user_highlights_v2.php", "/ig_get_user_highlights.php", "/get_ig_highlights.php"];
  for (const ep of eps) {
    try {
      const data = await stablePost(ep, { username_or_url: username });
      const arr: any[] = data?.data ?? data?.tray ?? data?.highlights ?? (Array.isArray(data) ? data : []);
      if (arr.length > 0) return arr.map(normalizeHighlight).filter(Boolean);
    } catch {}
  }
  return [];
}

// ─── EXPRESS ROUTE ────────────────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const traceId = (req as any).traceId;

  // Auth: MASTER_ACCESS_KEY env var se enforce, nahi set toh open
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
    // Cache check
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

    if (type === "profile" || type === "all") {
      profile = await scrapeProfile(username);
    }
    if (type === "reels" || type === "all") {
      const r = await scrapeMedia(username, "reels", pages, cursor);
      reels = r.items; reelsMeta = { hasNext: r.hasNext, nextCursor: r.nextCursor };
    }
    if (type === "posts" || type === "all") {
      const p = await scrapeMedia(username, "posts", pages, cursor);
      posts = p.items; postsMeta = { hasNext: p.hasNext, nextCursor: p.nextCursor };
    }
    if (type === "highlights" || type === "all") {
      highlights = await scrapeHighlights(username);
    }

    const result = {
      profile, reels, posts, highlights,
      reelsMeta, postsMeta,
      scrapedAt: new Date().toISOString(),
    };

    cacheSet(username, result);
    l2Set(`${username}:${type}:${pages}`, username, type, pages, result).catch(() => null);

    console.log(`[scraper:${traceId}] done @${username} profile=${!!profile?.username} reels=${reels.length} posts=${posts.length}`);
    res.json({ ok: true, cached: false, data: result });

  } catch (e: any) {
    console.error(`[scraper:${traceId}] error @${username}:`, e.message);
    const isNotFound = /not found|private|doesn't exist/i.test(e.message);
    const isBlocked  = /blocked|try again/i.test(e.message);
    res.status(isNotFound ? 404 : 502).json({
      ok: false,
      error: isBlocked ? "Instagram is temporarily blocking requests. Try again in a few minutes." : e.message,
      profileOk: false,
    });
  } finally {
    deleteInflight(inflightKey);
  }
});

export default router;
