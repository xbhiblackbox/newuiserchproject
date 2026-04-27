const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trace-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-trace-id, x-cache, x-cache-age, x-duration-ms",
};

const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY") ?? "";
const RAPIDAPI_HOST = Deno.env.get("RAPIDAPI_HOST") ?? "instagram120.p.rapidapi.com";

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

// Fire-and-forget background refresh. EdgeRuntime.waitUntil keeps the isolate
// alive past the response so the refresh actually completes.
function scheduleRevalidation(cacheKey: string, username: string, type: string) {
  if (REVALIDATING.has(cacheKey) || INFLIGHT.has(cacheKey)) return;
  REVALIDATING.add(cacheKey);
  const task = (async () => {
    try {
      const r = await buildResult(username, type);
      cacheSet(cacheKey, r);
    } catch (e) {
      console.warn("bg revalidate failed", cacheKey, (e as Error).message);
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
  if (typeof v === "string") return Number(v.replace(/[^\d.]/g, "")) || 0;
  return 0;
};
const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

async function callRapid(path: string, init: RequestInit, ctx?: ReqCtx) {
  const url = `https://${RAPIDAPI_HOST}${path}`;
  const startedAt = Date.now();
  let status: "ok" | "err" = "ok";
  let errMsg: string | undefined;
  try {
    const r = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        "x-rapidapi-key": RAPIDAPI_KEY,
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
    if (ctx) ctx.rapidCalls.push({ path, ms: Date.now() - startedAt, status, err: errMsg });
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
    raw?.data?.user ??
    raw?.data ??
    raw?.user ??
    raw ??
    {};
  return {
    username: str(d.username ?? d.user_name),
    fullName: str(d.full_name ?? d.fullname ?? d.name),
    bio: str(d.biography ?? d.bio),
    avatarUrl: str(
      d.hd_profile_pic_url_info?.url ??
        d.hd_profile_pic_versions?.slice(-1)?.[0]?.url ??
        d.profile_pic_url_hd ??
        d.profile_pic_url ??
        d.profile_picture ??
        d.avatar
    ),
    isVerified: !!(d.is_verified ?? d.verified),
    followers: num(
      d.follower_count ?? d.followers ?? d.followers_count ?? d.edge_followed_by?.count
    ),
    following: num(
      d.following_count ?? d.following ?? d.followings ?? d.edge_follow?.count
    ),
    postsCount: num(
      d.media_count ?? d.posts_count ?? d.post_count ?? d.edge_owner_to_timeline_media?.count
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
      m.thumbnail_src ??
      m.cover_frame_url ??
      m.thumbnail ??
      m.cover?.url
  );
  const videoUrl = str(
    m.video_url ?? m.video_versions?.[0]?.url ?? m.videoUrl ?? m.video?.url ?? ""
  );
  const productType = str(m.product_type ?? m.media_type_name ?? "");
  const mediaType = num(m.media_type);
  const isVideo = !!videoUrl || productType === "clips" || mediaType === 2;
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

// ---------- workers (each one self-contained, run in parallel) ----------
async function fetchProfile(username: string) {
  const raw = await tryEndpoints([
    { path: "/api/instagram/userInfo", method: "POST", body: { username } },
    { path: "/api/instagram/userInfoByUsername", method: "POST", body: { username } },
    { path: "/v1/info", query: { username_or_id_or_url: username } },
    { path: "/userinfo", query: { username } },
    { path: "/api/v1/users/web_profile_info", query: { username } },
  ]);
  return normalizeProfile(raw);
}

async function fetchPaginated(
  variants: Array<{ path: string; method?: "GET" | "POST"; query?: Record<string, string>; body?: Record<string, string> }>,
  maxPages = 3,
  cap = 120,
) {
  const first = await tryEndpoints(variants);
  const allRaw: any[] = [pickItems(first.data)];
  let cur = readPageInfo(first.data);
  let lastVariant = first.variant;
  let pages = 1;
  while (cur.hasNext && cur.cursor && pages < maxPages) {
    try {
      const next = await tryEndpoints(paginationVariants(lastVariant, cur.cursor));
      allRaw.push(pickItems(next.data));
      cur = readPageInfo(next.data);
      lastVariant = next.variant;
      pages++;
    } catch (e) {
      console.warn(`page ${pages + 1} err`, (e as Error).message);
      break;
    }
  }
  return dedupeMediaItems(allRaw.flat()).map(normalizeMediaItem).filter(Boolean).slice(0, cap);
}

async function fetchPosts(username: string) {
  return fetchPaginated([
    { path: "/api/instagram/posts", method: "POST", body: { username } },
    { path: "/api/instagram/userPosts", method: "POST", body: { username } },
    { path: "/v1/posts", query: { username_or_id_or_url: username } },
    { path: "/posts", query: { username } },
  ]);
}

async function fetchHighlights(username: string) {
  const resp = await tryEndpoints([
    { path: "/api/instagram/highlights", method: "POST", body: { username } },
    { path: "/api/instagram/userHighlights", method: "POST", body: { username } },
    { path: "/v1/highlights", query: { username_or_id_or_url: username } },
  ]);
  const raw = unwrap(resp.data);
  const r0 = Array.isArray(raw?.result) ? raw.result[0] : raw?.result;
  const items = r0?.items ?? r0?.tray ?? r0 ?? raw?.items ?? [];
  return (Array.isArray(items) ? items : []).map(normalizeHighlight);
}

// Build the full result for a username — runs profile/posts/highlights IN PARALLEL.
async function buildResult(username: string, type: string): Promise<any> {
  const wants = (t: string) => type === "all" || type === t;

  const [profileRes, postsRes, highlightsRes] = await Promise.allSettled([
    wants("profile") ? fetchProfile(username) : Promise.resolve(null),
    (wants("posts") || wants("reels")) ? fetchPosts(username) : Promise.resolve(null),
    wants("highlights") ? fetchHighlights(username) : Promise.resolve(null),
  ]);

  const result: any = { username };

  if (wants("profile")) {
    if (profileRes.status === "fulfilled" && profileRes.value) {
      result.profile = profileRes.value;
      result.profileOk = !!result.profile.username;
    } else {
      result.profileOk = false;
      if (profileRes.status === "rejected") console.error("profile err", profileRes.reason);
    }
  }

  let postsArr: any[] = [];
  if (postsRes.status === "fulfilled" && Array.isArray(postsRes.value)) {
    postsArr = postsRes.value;
  } else if (postsRes.status === "rejected") {
    console.error("posts err", postsRes.reason);
  }

  if (wants("posts")) {
    result.posts = postsArr;
    result.postsOk = postsRes.status === "fulfilled";
  }

  if (wants("reels")) {
    // Provider's dedicated /reels endpoint always 404s — derive from video posts.
    const videoPosts = postsArr.filter(
      (p: any) => p?.isVideo || p?.videoUrl || p?.productType === "clips"
    );
    result.reels = videoPosts.slice(0, 120);
    result.reelsOk = postsRes.status === "fulfilled";
  }

  if (wants("highlights")) {
    if (highlightsRes.status === "fulfilled" && highlightsRes.value) {
      result.highlights = highlightsRes.value;
      result.highlightsOk = true;
    } else {
      result.highlights = [];
      result.highlightsOk = false;
      if (highlightsRes.status === "rejected") console.error("highlights err", highlightsRes.reason);
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
      const detailResults = await Promise.allSettled(
        targets.map(({ r }: any) => fetchMediaDetail(str(r.code || r.id)))
      );
      detailResults.forEach((res, i) => {
        if (res.status !== "fulfilled" || !res.value) return;
        const fields = extractDetailFields(res.value);
        const { idx } = targets[i];
        const cur = result.reels[idx];
        result.reels[idx] = {
          ...cur,
          videoUrl: cur.videoUrl || fields.videoUrl || "",
          caption: cur.caption || fields.caption || "",
          thumbnail: cur.thumbnail || fields.thumbnail || "",
        };
      });
    }
  }

  return result;
}

// ---------- main ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!RAPIDAPI_KEY) return json({ error: "RAPIDAPI_KEY missing" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const username = str(body.username).trim().replace(/^@/, "").toLowerCase();
  const type = str(body.type || "all");
  if (!username) return json({ error: "username required" }, 400);

  if (type === "debug") return json({ host: RAPIDAPI_HOST, hasKey: !!RAPIDAPI_KEY });

  const cacheKey = `${username}::${type}`;
  const force = !!body.force;

  // 1) Stale-While-Revalidate: serve from cache instantly when available.
  //    - Fresh hit → just serve.
  //    - Stale hit → serve immediately AND kick off a background refresh so
  //      the next user gets fresh data without waiting on a cold scrape.
  if (!force) {
    const cached = cacheGet(cacheKey);
    if (cached) {
      if (cached.isStale) scheduleRevalidation(cacheKey, username, type);
      return json(cached.payload, 200, {
        "X-Cache": cached.isStale ? "STALE" : "HIT",
        "X-Cache-Age": String(Math.round(cached.ageMs / 1000)),
        "Cache-Control": "public, max-age=300",
      });
    }
  }

  // 2) Coalesce concurrent identical requests — only 1 RapidAPI call for N parallel callers
  let inflight = INFLIGHT.get(cacheKey);
  if (!inflight) {
    inflight = (async () => {
      try {
        const r = await buildResult(username, type);
        cacheSet(cacheKey, r);
        return r;
      } finally {
        INFLIGHT.delete(cacheKey);
      }
    })();
    INFLIGHT.set(cacheKey, inflight);
  }

  try {
    const payload = await inflight;
    return json(payload, 200, { "X-Cache": force ? "BYPASS" : "MISS", "Cache-Control": "public, max-age=300" });
  } catch (e) {
    console.error("buildResult fatal", e);
    return json({ error: "Scrape failed", message: (e as Error).message }, 502);
  }
});

