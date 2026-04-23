const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY") ?? "";
const RAPIDAPI_HOST = Deno.env.get("RAPIDAPI_HOST") ?? "instagram-scraper-api2.p.rapidapi.com";

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function rapid(path: string, params: Record<string, string>) {
  const u = new URL(`https://${RAPIDAPI_HOST}${path}`);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u.toString(), {
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": RAPIDAPI_HOST,
    },
    signal: AbortSignal.timeout(40000),
  });
  if (!r.ok) throw new Error(`RapidAPI ${r.status}`);
  return r.json();
}

// ---------- normalizers ----------
const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v.replace(/[^\d.]/g, "")) || 0;
  return 0;
};
const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

function normalizeProfile(raw: any) {
  const d = raw?.data ?? raw?.user ?? raw ?? {};
  return {
    username: str(d.username ?? d.user_name),
    fullName: str(d.full_name ?? d.fullname ?? d.name),
    bio: str(d.biography ?? d.bio),
    avatarUrl: str(d.profile_pic_url_hd ?? d.profile_pic_url ?? d.profile_picture ?? d.avatar),
    isVerified: !!(d.is_verified ?? d.verified),
    followers: num(d.follower_count ?? d.followers ?? d.edge_followed_by?.count),
    following: num(d.following_count ?? d.following ?? d.edge_follow?.count),
    postsCount: num(d.media_count ?? d.posts_count ?? d.edge_owner_to_timeline_media?.count),
    externalUrl: str(d.external_url ?? d.website),
    category: str(d.category ?? d.category_name),
  };
}

function normalizeMediaItem(it: any) {
  const id = str(it.id ?? it.pk ?? it.media_id);
  const code = str(it.code ?? it.shortcode ?? it.shortCode);
  const caption = str(
    it.caption?.text ?? it.caption ?? it.edge_media_to_caption?.edges?.[0]?.node?.text ?? ""
  );
  const thumbnail = str(
    it.thumbnail_url ??
      it.display_url ??
      it.image_versions2?.candidates?.[0]?.url ??
      it.thumbnail_src ??
      it.cover_frame_url ??
      it.thumbnail
  );
  const videoUrl = str(
    it.video_url ?? it.video_versions?.[0]?.url ?? it.videoUrl ?? ""
  );
  return {
    id,
    code,
    caption,
    thumbnail,
    videoUrl,
    duration: num(it.video_duration ?? it.duration),
    views: num(it.play_count ?? it.video_view_count ?? it.view_count ?? it.views),
    likes: num(it.like_count ?? it.likes ?? it.edge_liked_by?.count ?? it.edge_media_preview_like?.count),
    comments: num(it.comment_count ?? it.comments ?? it.edge_media_to_comment?.count),
    shares: num(it.reshare_count ?? it.share_count ?? it.shares),
    takenAt: num(it.taken_at ?? it.taken_at_timestamp ?? it.takenAt),
  };
}

function pickItems(raw: any): any[] {
  return (
    raw?.data?.items ??
    raw?.items ??
    raw?.data?.reels ??
    raw?.reels ??
    raw?.data?.posts ??
    raw?.posts ??
    raw?.data ??
    []
  );
}

function normalizeHighlight(h: any) {
  return {
    id: str(h.id ?? h.pk),
    name: str(h.title ?? h.name),
    image: str(h.cover_media?.cropped_image_version?.url ?? h.cover_image ?? h.image ?? h.thumbnail),
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

  const result: any = { username };
  const wants = (t: string) => type === "all" || type === t;

  // PROFILE
  if (wants("profile")) {
    try {
      const raw = await rapid("/v1/info", { username_or_id_or_url: username });
      result.profile = normalizeProfile(raw);
      result.profileOk = true;
    } catch (e) {
      console.error("profile err", e);
      result.profileOk = false;
    }
  }

  // REELS
  if (wants("reels")) {
    try {
      const raw = await rapid("/v1/reels", { username_or_id_or_url: username });
      const items = pickItems(raw).slice(0, 12).map((x: any) => normalizeMediaItem(x.media ?? x));
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
      const raw = await rapid("/v1/posts", { username_or_id_or_url: username });
      const items = pickItems(raw).slice(0, 12).map((x: any) => normalizeMediaItem(x.media ?? x));
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
      const raw = await rapid("/v1/highlights", { username_or_id_or_url: username });
      const items = (raw?.data?.items ?? raw?.items ?? raw?.data ?? []).map(normalizeHighlight);
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
