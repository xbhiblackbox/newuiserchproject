import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  cacheGet, cacheSet, l2Get, l2Set,
  getInflight, setInflight, deleteInflight,
} from "../lib/cache";
import {
  normalizeMediaItem, dedupeMediaItems,
  normalizeHighlight, str, num,
  normalizeProfile as helperNormalizeProfile,
  pickItems,
} from "../lib/scraperHelpers";

const router = Router();

const ScrapeReqSchema = z.object({
  username: z.string().min(1),
  type: z.enum(["profile", "reels", "posts", "highlights", "all"]).default("all"),
  force: z.boolean().default(false),
  pages: z.number().min(1).max(10).default(1),
  cursor: z.string().optional(),
});

// ─── Hardcoded credentials ─────────────────────────────────────────────────
const RAPID_KEY  = "765e47e809mshda12294101b09acp144800jsn331f56f88be4";
const RAPID_HOST = "instagram-scraper-stable-api.p.rapidapi.com";

function getKey() { return process.env.RAPIDAPI_KEY ?? RAPID_KEY; }

// ─── POST helper ──────────────────────────────────────────────────────────────
async function apiPost(endpoint: string, body: Record<string, string>, timeoutMs = 20000): Promise<any> {
  const params = new URLSearchParams(body).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(`https://${RAPID_HOST}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-rapidapi-host": RAPID_HOST,
        "x-rapidapi-key": getKey(),
      },
      body: params,
      signal: controller.signal,
    }) as any;
    clearTimeout(timer);
    const text = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
    let j: any;
    try { j = JSON.parse(text); } catch { return null; }
    if (j?.error && typeof j.error === "string") throw new Error(`blocked:${j.error}`);
    return j;
  } catch (e) { clearTimeout(timer); throw e; }
}

// ─── GET helper ───────────────────────────────────────────────────────────────
async function apiGet(endpoint: string, query: Record<string, string>, timeoutMs = 20000): Promise<any> {
  const qs = new URLSearchParams(query).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(`https://${RAPID_HOST}${endpoint}?${qs}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-host": RAPID_HOST,
        "x-rapidapi-key": getKey(),
      },
      signal: controller.signal,
    }) as any;
    clearTimeout(timer);
    const text = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
    let j: any;
    try { j = JSON.parse(text); } catch { return null; }
    if (j?.error && typeof j.error === "string") throw new Error(`blocked:${j.error}`);
    return j;
  } catch (e) { clearTimeout(timer); throw e; }
}

// ─── Extract posts embedded in profile response ───────────────────────────────
// Instagram profile endpoints often include last 12 posts in edge_owner_to_timeline_media
function extractEmbeddedMedia(profileRaw: any): any[] {
  try {
    // Deep search for edges array (contains post nodes)
    const findEdges = (obj: any, depth = 5): any[] => {
      if (!obj || typeof obj !== "object" || depth < 0) return [];
      if (Array.isArray(obj?.edges) && obj.edges.length > 0) return obj.edges;
      for (const val of Object.values(obj)) {
        const found = findEdges(val, depth - 1);
        if (found.length > 0) return found;
      }
      return [];
    };

    // Also check for items/posts arrays directly
    const findItems = (obj: any, depth = 5): any[] => {
      if (!obj || typeof obj !== "object" || depth < 0) return [];
      if (Array.isArray(obj?.items) && obj.items.length > 0) return obj.items;
      if (Array.isArray(obj?.posts) && obj.posts.length > 0) return obj.posts;
      if (Array.isArray(obj?.reels) && obj.reels.length > 0) return obj.reels;
      for (const val of Object.values(obj)) {
        const found = findItems(val, depth - 1);
        if (found.length > 0) return found;
      }
      return [];
    };

    const edges = findEdges(profileRaw);
    if (edges.length > 0) return edges;
    return findItems(profileRaw);
  } catch { return []; }
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
function buildStubProfile(username: string) {
  return { username, fullName: username, bio: "", avatarUrl: "", isVerified: false, followers: 0, following: 0, postsCount: 0, externalUrl: "", category: "", _stub: true };
}

async function scrapeProfile(username: string): Promise<{ profile: any; embeddedMedia: any[] }> {
  const profileEndpoints = [
    "/ig_get_fb_profile_v3.php",
    "/ig_get_fb_profile_v2.php",
    "/ig_get_fb_profile.php",
  ];

  for (const ep of profileEndpoints) {
    try {
      const data = await apiPost(ep, { username_or_url: username });
      if (!data) continue;

      // Extract embedded media (last 12 posts often included in profile)
      const embeddedMedia = extractEmbeddedMedia(data);

      // Normalize profile using the comprehensive helper
      const p1 = helperNormalizeProfile(data);
      if (p1?.username) {
        console.log(`[stable] profile OK via ${ep} embedded_media=${embeddedMedia.length}`);
        return { profile: p1, embeddedMedia };
      }

      // Manual fallback
      const u = data?.data?.user ?? data?.user ?? data?.data ?? data ?? {};
      if (u?.username || u?.user_name) {
        return {
          embeddedMedia,
          profile: {
            username: str(u.username ?? u.user_name),
            fullName: str(u.full_name ?? u.fullname ?? u.name ?? ""),
            bio: str(u.biography ?? u.bio ?? ""),
            avatarUrl: str(u.hd_profile_pic_url_info?.url ?? u.profile_pic_url_hd ?? u.profile_pic_url ?? ""),
            isVerified: !!(u.is_verified ?? u.verified ?? false),
            followers: num(u.follower_count ?? u.followers ?? u.edge_followed_by?.count ?? 0),
            following: num(u.following_count ?? u.following ?? u.edge_follow?.count ?? 0),
            postsCount: num(u.media_count ?? u.posts_count ?? u.edge_owner_to_timeline_media?.count ?? 0),
            externalUrl: str(u.external_url ?? u.bio_links?.[0]?.url ?? ""),
            category: str(u.category ?? u.category_name ?? ""),
          },
        };
      }
    } catch (e: any) {
      console.warn(`[stable] ${ep} failed: ${e.message.slice(0, 80)}`);
    }
  }

  console.warn(`[stable] all profile endpoints failed for @${username}, returning stub`);
  return { profile: buildStubProfile(username), embeddedMedia: [] };
}

// ─── MEDIA (Posts / Reels) ────────────────────────────────────────────────────
// Confirmed working endpoint pattern from scan: /get_ig_user_posts.php (no "ig_" prefix)
// For reels, same pattern

async function scrapeMedia(
  username: string,
  mediaType: "reels" | "posts",
  pages: number,
  cursor?: string,
  seedItems?: any[]     // items extracted from profile response
): Promise<{ items: any[]; hasNext: boolean; nextCursor: string }> {
  const allItems: any[] = [];
  let currentCursor = cursor ?? "";
  let hasNext = false;

  // Seed with embedded profile media first
  if (seedItems && seedItems.length > 0) {
    const normalized = dedupeMediaItems(seedItems).map(normalizeMediaItem).filter(Boolean);
    allItems.push(...normalized);
    console.log(`[stable] seeded ${normalized.length} items from profile response`);
  }

  // Correct endpoint names (from scan: /get_ig_user_posts.php exists, no "ig_" prefix for media)
  const postEps = [
    "/get_ig_user_posts.php",
    "/get_ig_user_posts_v2.php",
    "/ig_get_user_posts.php",
    "/ig_get_user_posts_v2.php",
  ];
  const reelEps = [
    "/get_ig_user_reels.php",
    "/get_ig_user_reels_v2.php",
    "/ig_get_user_reels.php",
    "/ig_get_user_reels_v2.php",
  ];
  const candidates = mediaType === "reels" ? reelEps : postEps;

  for (let page = 0; page < pages; page++) {
    const body: Record<string, string> = {
      username_or_url: username,
      amount: "12",
    };
    if (currentCursor) body.pagination_token = currentCursor;

    let data: any = null;
    for (const ep of candidates) {
      try {
        data = await apiPost(ep, body, 18000);
        if (data && (data.data || data.items || data.posts || data.reels || Array.isArray(data))) {
          console.log(`[stable] ${mediaType} OK via ${ep}`);
          break;
        }
        data = null;
      } catch (e: any) {
        console.warn(`[stable] ${ep}: ${e.message.slice(0, 60)}`);
      }
    }

    if (!data) {
      console.warn(`[stable] all ${mediaType} endpoints failed page=${page}`);
      break;
    }

    const rawArr = pickItems(data);
    const normalized = dedupeMediaItems(rawArr).map(normalizeMediaItem).filter(Boolean);
    allItems.push(...normalized);

    const nextToken = str(data?.pagination_token ?? data?.next_max_id ?? "");
    hasNext = !!(nextToken && nextToken !== currentCursor);
    currentCursor = nextToken;
    if (!currentCursor || !hasNext) break;
  }

  return { items: dedupeMediaItems(allItems).map(normalizeMediaItem).filter(Boolean), hasNext, nextCursor: currentCursor };
}

// ─── HIGHLIGHTS ───────────────────────────────────────────────────────────────
async function scrapeHighlights(username: string): Promise<any[]> {
  const eps = ["/get_ig_user_highlights.php", "/get_ig_user_highlights_v2.php", "/ig_get_user_highlights.php"];
  for (const ep of eps) {
    try {
      const data = await apiPost(ep, { username_or_url: username }, 15000);
      const arr: any[] = data?.data ?? data?.tray ?? data?.highlights ?? (Array.isArray(data) ? data : []);
      if (arr.length > 0) return arr.map(normalizeHighlight).filter(Boolean);
    } catch {}
  }
  return [];
}

// ─── ROUTE ────────────────────────────────────────────────────────────────────
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const traceId = (req as any).traceId;

  const masterKey = process.env.MASTER_ACCESS_KEY;
  if (masterKey) {
    const provided = req.headers["x-access-key"] as string | undefined;
    if (provided !== masterKey) {
      res.status(403).json({ ok: false, error: "Invalid access key" });
      return;
    }
  }

  const parsed = ScrapeReqSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Invalid request", issues: parsed.error.issues });
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
      const cached = (l1 as any)?.payload ?? (l2 as any)?.payload ?? null;
      if (cached) {
        res.json({ ok: true, cached: true, data: cached });
        return;
      }
    }

    console.log(`[scraper:${traceId}] start @${username} type=${type}`);

    // Fetch profile first — it may include embedded posts
    let profile: any = null;
    let embeddedMedia: any[] = [];

    if (type === "profile" || type === "all" || type === "posts" || type === "reels") {
      const r = await scrapeProfile(username);
      profile = r.profile;
      embeddedMedia = r.embeddedMedia;
    }

    let reels: any[] = [];
    let posts: any[] = [];
    let highlights: any[] = [];
    let reelsMeta = { hasNext: false, nextCursor: "" };
    let postsMeta  = { hasNext: false, nextCursor: "" };

    if (type === "reels" || type === "all") {
      try {
        const r = await scrapeMedia(username, "reels", pages, cursor, embeddedMedia);
        reels = r.items; reelsMeta = { hasNext: r.hasNext, nextCursor: r.nextCursor };
      } catch { reels = embeddedMedia.map(normalizeMediaItem).filter(Boolean); }
    }
    if (type === "posts" || type === "all") {
      try {
        const p = await scrapeMedia(username, "posts", pages, cursor, embeddedMedia);
        posts = p.items; postsMeta = { hasNext: p.hasNext, nextCursor: p.nextCursor };
      } catch { posts = embeddedMedia.map(normalizeMediaItem).filter(Boolean); }
    }
    if (type === "highlights" || type === "all") {
      try { highlights = await scrapeHighlights(username); } catch { highlights = []; }
    }

    const result = { profile, reels, posts, highlights, reelsMeta, postsMeta, scrapedAt: new Date().toISOString() };

    cacheSet(username, result);
    l2Set(`${username}:${type}:${pages}`, username, type, pages, result).catch(() => null);

    console.log(`[scraper:${traceId}] done @${username} profile=${!!profile?.username}(stub=${!!(profile as any)?._stub}) embedded=${embeddedMedia.length} reels=${reels.length} posts=${posts.length}`);
    res.json({ ok: true, cached: false, data: result });

  } catch (e: any) {
    console.error(`[scraper:${traceId}] fatal @${username}:`, e.message);
    res.status(502).json({ ok: false, error: e.message });
  } finally {
    deleteInflight(inflightKey);
  }
});

export default router;
