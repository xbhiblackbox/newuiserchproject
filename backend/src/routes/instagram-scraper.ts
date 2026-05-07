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

// ─── HARDCODED credentials — env vars optional ───────────────────────────────
const RAPID_KEY  = "765e47e809mshda12294101b09acp144800jsn331f56f88be4";
const RAPID_HOST = "instagram-scraper-stable-api.p.rapidapi.com";

// ─── core fetch wrapper ───────────────────────────────────────────────────────
async function stablePost(endpoint: string, body: Record<string, string>): Promise<any> {
  const params = new URLSearchParams(body).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  let r: Response | undefined;
  try {
    r = await fetch(`https://${RAPID_HOST}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-rapidapi-host": RAPID_HOST,
        "x-rapidapi-key": process.env.RAPIDAPI_KEY ?? RAPID_KEY,
      },
      body: params,
      signal: controller.signal,
    }) as any;
  } finally {
    clearTimeout(timer);
  }

  if (!r) throw new Error("fetch returned nothing");
  const text = await (r as any).text();

  if (!(r as any).ok) {
    throw new Error(`HTTP ${(r as any).status}: ${text.slice(0, 200)}`);
  }

  let j: any;
  try { j = JSON.parse(text); } catch { return null; }

  // "Please try again later" — transient Instagram block
  if (j?.error && typeof j.error === "string") {
    throw new Error(`blocked:${j.error}`);
  }
  return j;
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
// /ig_get_fb_profile_v3.php  — confirmed endpoint (Account Data V2)
// param: username_or_url = plain username (not full URL)

function buildStubProfile(username: string) {
  return {
    username,
    fullName: username,
    bio: "",
    avatarUrl: "",
    isVerified: false,
    followers: 0,
    following: 0,
    postsCount: 0,
    externalUrl: "",
    category: "",
    _stub: true,          // flag so frontend knows data is partial
  };
}

async function scrapeProfile(username: string): Promise<any> {
  // All candidate endpoints — try each until one returns usable data
  const endpoints = [
    "/ig_get_fb_profile_v3.php",
    "/ig_get_fb_profile_v2.php",
    "/ig_get_fb_profile.php",
  ];

  for (const ep of endpoints) {
    try {
      const data = await stablePost(ep, { username_or_url: username });
      if (!data) continue;

      // Try scraperHelpers normalizer first (covers many shapes)
      const p1 = helperNormalizeProfile(data);
      if (p1?.username) { console.log(`[stable] profile OK via ${ep}`); return p1; }

      // Manual fallback — some APIs return flat object
      const u = data?.data?.user ?? data?.user ?? data?.data ?? data;
      const p2 = {
        username: str(u?.username ?? u?.user_name ?? ""),
        fullName: str(u?.full_name ?? u?.fullname ?? u?.name ?? ""),
        bio: str(u?.biography ?? u?.bio ?? ""),
        avatarUrl: str(
          u?.hd_profile_pic_url_info?.url ?? u?.profile_pic_url_hd ??
          u?.profile_pic_url ?? u?.profile_picture ?? ""
        ),
        isVerified: !!(u?.is_verified ?? u?.verified ?? false),
        followers: num(u?.follower_count ?? u?.followers ?? u?.edge_followed_by?.count ?? 0),
        following: num(u?.following_count ?? u?.following ?? u?.edge_follow?.count ?? 0),
        postsCount: num(u?.media_count ?? u?.posts_count ?? u?.edge_owner_to_timeline_media?.count ?? 0),
        externalUrl: str(u?.external_url ?? u?.bio_links?.[0]?.url ?? ""),
        category: str(u?.category ?? u?.category_name ?? ""),
      };
      if (p2.username) { console.log(`[stable] profile OK (manual) via ${ep}`); return p2; }

    } catch (e: any) {
      console.warn(`[stable] ${ep} failed: ${e.message.slice(0, 80)}`);
    }
  }

  // All API calls failed — return stub so app loads with username at least
  console.warn(`[stable] all profile endpoints failed for @${username}, returning stub`);
  return buildStubProfile(username);
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

  // Endpoint candidates
  const postEps = ["/ig_get_user_posts_v2.php", "/ig_get_user_posts.php"];
  const reelEps = ["/ig_get_user_reels_v2.php", "/ig_get_user_reels.php"];
  const candidates = mediaType === "reels" ? reelEps : postEps;

  for (let page = 0; page < pages; page++) {
    const body: Record<string, string> = { username_or_url: username, amount: "12" };
    if (currentCursor) body.pagination_token = currentCursor;

    let data: any = null;
    for (const ep of candidates) {
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

    // pickItems handles many response shapes
    const rawArr = pickItems(data);
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
  const eps = ["/ig_get_user_highlights_v2.php", "/ig_get_user_highlights.php"];
  for (const ep of eps) {
    try {
      const data = await stablePost(ep, { username_or_url: username });
      const arr: any[] =
        data?.data ?? data?.tray ?? data?.highlights ??
        (Array.isArray(data) ? data : []);
      if (arr.length > 0) return arr.map(normalizeHighlight).filter(Boolean);
    } catch {}
  }
  return [];
}

// ─── ROUTE ────────────────────────────────────────────────────────────────────
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const traceId = (req as any).traceId;

  // Auth — only enforced if MASTER_ACCESS_KEY is set in env
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
    // L1 / L2 cache check
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

    let profile: any = null;
    let reels: any[] = [];
    let posts: any[] = [];
    let highlights: any[] = [];
    let reelsMeta = { hasNext: false, nextCursor: "" };
    let postsMeta  = { hasNext: false, nextCursor: "" };

    // Run all fetches — individual failures are caught inside each fn
    if (type === "profile" || type === "all") {
      profile = await scrapeProfile(username);
    }
    if (type === "reels" || type === "all") {
      try {
        const r = await scrapeMedia(username, "reels", pages, cursor);
        reels = r.items; reelsMeta = { hasNext: r.hasNext, nextCursor: r.nextCursor };
      } catch { reels = []; }
    }
    if (type === "posts" || type === "all") {
      try {
        const p = await scrapeMedia(username, "posts", pages, cursor);
        posts = p.items; postsMeta = { hasNext: p.hasNext, nextCursor: p.nextCursor };
      } catch { posts = []; }
    }
    if (type === "highlights" || type === "all") {
      try { highlights = await scrapeHighlights(username); } catch { highlights = []; }
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

    // Cache result
    cacheSet(username, result);
    l2Set(`${username}:${type}:${pages}`, username, type, pages, result).catch(() => null);

    console.log(
      `[scraper:${traceId}] done @${username}` +
      ` profile=${!!profile?.username}(stub=${!!(profile as any)?._stub})` +
      ` reels=${reels.length} posts=${posts.length}`
    );

    res.json({ ok: true, cached: false, data: result });

  } catch (e: any) {
    console.error(`[scraper:${traceId}] fatal @${username}:`, e.message);
    res.status(502).json({ ok: false, error: e.message });
  } finally {
    deleteInflight(inflightKey);
  }
});

export default router;
