const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY") ?? "";
const RAPIDAPI_HOST = Deno.env.get("RAPIDAPI_HOST") ?? "instagram120.p.rapidapi.com";

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v.replace(/[^\d.]/g, "")) || 0;
  return 0;
};
const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

async function callRapid(path: string, init: RequestInit) {
  const url = `https://${RAPIDAPI_HOST}${path}`;
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
    console.error(`RapidAPI ${r.status} ${path} :: ${text.slice(0, 300)}`);
    throw new Error(`RapidAPI ${r.status}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

// Try multiple endpoint shapes (different RapidAPI providers use different paths/params)
async function tryEndpoints(
  variants: Array<{ path: string; method?: "GET" | "POST"; query?: Record<string, string>; body?: Record<string, string> }>
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
      return { data: await callRapid(u.pathname + u.search, init), variant: v };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("All endpoints failed");
}

function readPageInfo(raw: any) {
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
function normalizeProfile(raw: any) {
  // instagram120: { result: [{ status:"ok", user: {...} }] }
  // others: { result: { user: {...} } } | { data: {...} } | direct user
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
  return {
    id,
    code,
    caption,
    thumbnail,
    videoUrl,
    duration: num(m.video_duration ?? m.duration),
    views: num(m.play_count ?? m.video_view_count ?? m.view_count ?? m.views),
    likes: num(
      m.like_count ?? m.likes ?? m.edge_liked_by?.count ?? m.edge_media_preview_like?.count
    ),
    comments: num(m.comment_count ?? m.comments ?? m.edge_media_to_comment?.count),
    shares: num(m.reshare_count ?? m.share_count ?? m.shares),
    takenAt: num(m.taken_at ?? m.taken_at_timestamp ?? m.takenAt),
  };
}

function pickItems(raw: any): any[] {
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
async function fetchMediaDetail(codeOrId: string): Promise<any | null> {
  if (!codeOrId) return null;
  try {
    // /api/instagram/links is the confirmed working endpoint on instagram120
    const { data } = await tryEndpoints([
      { path: "/api/instagram/links", method: "POST", body: { url: `https://www.instagram.com/reel/${codeOrId}/` } },
      { path: "/api/instagram/links", method: "POST", body: { url: `https://www.instagram.com/p/${codeOrId}/` } },
      { path: "/api/instagram/get", method: "POST", body: { url: `https://www.instagram.com/reel/${codeOrId}/` } },
      { path: "/api/instagram/get", method: "POST", body: { url: `https://www.instagram.com/p/${codeOrId}/` } },
    ]);
    return data;
  } catch (e) {
    console.warn("media detail fetch failed", codeOrId, (e as Error).message);
    return null;
  }
}

function extractDetailFields(raw: any): { videoUrl: string; caption: string; thumbnail: string } {
  // Some endpoints return a top-level array (e.g. /api/instagram/links -> [{urls, meta}])
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

// ---------- main ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  if (!RAPIDAPI_KEY) return json({ error: "RAPIDAPI_KEY missing" }, 500);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const username = str(body.username).trim().replace(/^@/, "");
  const type = str(body.type || "all");
  if (!username) return json({ error: "username required" }, 400);

  if (type === "debug") {
    return json({ host: RAPIDAPI_HOST, hasKey: !!RAPIDAPI_KEY }, 200);
  }

  const result: any = { username };
  const wants = (t: string) => type === "all" || type === t;

  // PROFILE — try all known endpoint shapes
  if (wants("profile")) {
    try {
      const raw = await tryEndpoints([
        // instagram120
        { path: "/api/instagram/userInfo", method: "POST", body: { username } },
        { path: "/api/instagram/userInfoByUsername", method: "POST", body: { username } },
        // instagram-scraper-api2
        { path: "/v1/info", query: { username_or_id_or_url: username } },
        // generic GET
        { path: "/userinfo", query: { username } },
        { path: "/api/v1/users/web_profile_info", query: { username } },
      ]);
      result.profile = normalizeProfile(raw);
      result.profileOk = !!result.profile.username;
      if (body.debug) result._raw_profile = raw;
    } catch (e) {
      console.error("profile err", e);
      result.profileOk = false;
    }
  }

  // REELS
  if (wants("reels")) {
    try {
      const first = await tryEndpoints([
        { path: "/api/instagram/reels", method: "POST", body: { username } },
        { path: "/api/instagram/userReels", method: "POST", body: { username } },
        { path: "/v1/reels", query: { username_or_id_or_url: username } },
        { path: "/reels", query: { username } },
      ]);
      let allRaw: any[] = [pickItems(first.data)];
      let cur = readPageInfo(first.data);
      let lastVariant = first.variant;
      let pages = 1;
      const MAX_PAGES = 3;
      while (cur.hasNext && cur.cursor && pages < MAX_PAGES) {
        try {
          const next = await tryEndpoints(paginationVariants(lastVariant, cur.cursor));
          allRaw.push(pickItems(next.data));
          cur = readPageInfo(next.data);
          lastVariant = next.variant;
          pages++;
        } catch (e) {
          console.warn(`reels page ${pages + 1} err`, e);
          break;
        }
      }
      const items = dedupeMediaItems(allRaw.flat()).map(normalizeMediaItem).filter(Boolean).slice(0, 120);
      result.reels = items;
      result.reelsOk = true;
      if (body.debug) result._raw_reels = first.data;
    } catch (e) {
      console.error("reels err", e);
      result.reels = [];
      result.reelsOk = false;
    }
  }

  // POSTS
  if (wants("posts")) {
    try {
      const first = await tryEndpoints([
        { path: "/api/instagram/posts", method: "POST", body: { username } },
        { path: "/api/instagram/userPosts", method: "POST", body: { username } },
        { path: "/v1/posts", query: { username_or_id_or_url: username } },
        { path: "/posts", query: { username } },
      ]);
      let allRaw: any[] = [pickItems(first.data)];
      let cur = readPageInfo(first.data);
      let lastVariant = first.variant;
      let pages = 1;
      const MAX_PAGES = 3;
      while (cur.hasNext && cur.cursor && pages < MAX_PAGES) {
        try {
          const next = await tryEndpoints(paginationVariants(lastVariant, cur.cursor));
          allRaw.push(pickItems(next.data));
          cur = readPageInfo(next.data);
          lastVariant = next.variant;
          pages++;
        } catch (e) {
          console.warn(`posts page ${pages + 1} err`, e);
          break;
        }
      }
      const items = dedupeMediaItems(allRaw.flat()).map(normalizeMediaItem).filter(Boolean).slice(0, 120);
      result.posts = items;
      result.postsOk = true;
      if (body.debug) result._raw_posts = first.data;
    } catch (e) {
      console.error("posts err", e);
      result.posts = [];
      result.postsOk = false;
    }
  }

  // HIGHLIGHTS
  if (wants("highlights")) {
    try {
      const raw = await tryEndpoints([
        { path: "/api/instagram/highlights", method: "POST", body: { username } },
        { path: "/api/instagram/userHighlights", method: "POST", body: { username } },
        { path: "/v1/highlights", query: { username_or_id_or_url: username } },
      ]);
      const r0 = Array.isArray(raw?.result) ? raw.result[0] : raw?.result;
      const items = (
        r0?.items ??
        r0?.tray ??
        r0 ??
        raw?.result?.items ??
        raw?.result ??
        raw?.data?.items ??
        raw?.data ??
        raw?.items ??
        []
      );
      result.highlights = (Array.isArray(items) ? items : []).map(normalizeHighlight);
      result.highlightsOk = true;
      if (body.debug) result._raw_highlights = raw;
    } catch (e) {
      console.error("highlights err", e);
      result.highlights = [];
      result.highlightsOk = false;
    }
  }

  // ---------- ENRICHMENT ----------
  // 1) Merge captions from posts into reels (match by id or code).
  // 2) Fetch missing reel video URLs in parallel (cap to first N to limit RapidAPI load).
  if (Array.isArray(result.reels) && result.reels.length) {
    const postsArr: any[] = Array.isArray(result.posts) ? result.posts : [];
    if (postsArr.length) {
      const byId = new Map<string, any>();
      const byCode = new Map<string, any>();
      for (const p of postsArr) {
        if (p?.id) byId.set(String(p.id), p);
        if (p?.code) byCode.set(String(p.code), p);
      }
      result.reels = result.reels.map((r: any) => {
        if (r?.caption && r?.thumbnail) return r;
        const match = (r?.id && byId.get(String(r.id))) || (r?.code && byCode.get(String(r.code)));
        if (!match) return r;
        return {
          ...r,
          caption: r.caption || match.caption || "",
          thumbnail: r.thumbnail || match.thumbnail || "",
          videoUrl: r.videoUrl || match.videoUrl || "",
          views: r.views || match.views || 0,
          likes: r.likes || match.likes || 0,
          comments: r.comments || match.comments || 0,
          takenAt: r.takenAt || match.takenAt || 0,
        };
      });
    }

    const MAX_DETAIL_FETCH = 8;
    const targets = result.reels
      .map((r: any, idx: number) => ({ r, idx }))
      .filter(({ r }: any) => !r?.videoUrl || !r?.caption)
      .filter(({ r }: any) => r?.code || r?.id)
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

  return json(result, 200);
});
