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
): Promise<any> {
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
      return await callRapid(u.pathname + u.search, init);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("All endpoints failed");
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
  const m = it.media ?? it.node ?? it;
  const id = str(m.id ?? m.pk ?? m.media_id);
  const code = str(m.code ?? m.shortcode ?? m.shortCode);
  const caption = str(
    m.caption?.text ??
      (typeof m.caption === "string" ? m.caption : "") ??
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
  // instagram120 wraps in result[0]
  const r0 = Array.isArray(raw?.result) ? raw.result[0] : null;
  return (
    r0?.items ??
    r0?.posts ??
    r0?.reels ??
    r0?.data?.items ??
    r0?.user?.edge_owner_to_timeline_media?.edges ??
    raw?.result?.items ??
    raw?.result?.posts ??
    raw?.result?.reels ??
    raw?.data?.items ??
    raw?.data?.posts ??
    raw?.data?.reels ??
    raw?.items ??
    raw?.posts ??
    raw?.reels ??
    raw?.edges ??
    (Array.isArray(raw?.result) ? raw.result : null) ??
    (Array.isArray(raw?.data) ? raw.data : null) ??
    []
  );
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
      console.log("profile raw:", JSON.stringify(raw).slice(0, 800));
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
      const raw = await tryEndpoints([
        { path: "/api/instagram/reels", method: "POST", body: { username } },
        { path: "/api/instagram/userReels", method: "POST", body: { username } },
        { path: "/v1/reels", query: { username_or_id_or_url: username } },
        { path: "/reels", query: { username } },
      ]);
      const items = pickItems(raw)
        .map(normalizeMediaItem)
        .filter(Boolean)
        .slice(0, 12);
      result.reels = items;
      result.reelsOk = true;
    } catch (e) {
      console.error("reels err", e);
      result.reels = [];
      result.reelsOk = false;
    }
  }

  // POSTS
  if (wants("posts")) {
    try {
      const raw = await tryEndpoints([
        { path: "/api/instagram/posts", method: "POST", body: { username } },
        { path: "/api/instagram/userPosts", method: "POST", body: { username } },
        { path: "/v1/posts", query: { username_or_id_or_url: username } },
        { path: "/posts", query: { username } },
      ]);
      const items = pickItems(raw)
        .map(normalizeMediaItem)
        .filter(Boolean)
        .slice(0, 12);
      result.posts = items;
      result.postsOk = true;
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
      const items = (
        raw?.result?.items ??
        raw?.result ??
        raw?.data?.items ??
        raw?.data ??
        raw?.items ??
        []
      ).map(normalizeHighlight);
      result.highlights = items;
      result.highlightsOk = true;
    } catch (e) {
      console.error("highlights err", e);
      result.highlights = [];
      result.highlightsOk = false;
    }
  }

  return json(result, 200);
});
