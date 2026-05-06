// ---- Helper utils (ported from instagram-scraper Deno edge function) ----

export const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  const s = (v as string).replace(/,/g, "").trim();
  const m = s.match(/([\d.]+)\s*([kmb])?/i);
  if (!m) return 0;
  const base = Number(m[1]) || 0;
  const mult = m[2]?.toLowerCase() === "k" ? 1_000 : m[2]?.toLowerCase() === "m" ? 1_000_000 : m[2]?.toLowerCase() === "b" ? 1_000_000_000 : 1;
  return Math.round(base * mult);
};

export const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return key[0] + "•••" + key[key.length - 1];
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export const newTraceId = (): string =>
  Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 8);

// ---- unwrap / normalizers ----
export function unwrap(raw: any): any {
  if (raw && typeof raw === "object" && raw.data &&
    (raw.data.result || raw.data.user || raw.data.items || raw.data.posts || raw.data.reels || raw.data.edges || raw.data.tray)) {
    return raw.data;
  }
  return raw;
}

export function pickFirst<T = any>(root: any, paths: string[][]): T | undefined {
  for (const path of paths) {
    let cur = root;
    for (const part of path) cur = cur?.[part];
    if (cur !== undefined && cur !== null && cur !== "") return cur as T;
  }
  return undefined;
}

export function deepFindByKeys(root: any, keys: string[], depth = 5): any {
  const wanted = new Set(keys);
  const seen = new Set<any>();
  const walk = (node: any, d: number): any => {
    if (!node || typeof node !== "object" || d < 0 || seen.has(node)) return undefined;
    seen.add(node);
    for (const key of keys) {
      const val = node[key];
      if (val !== undefined && val !== null && val !== "") return val;
    }
    for (const [key, val] of Object.entries(node)) {
      if (wanted.has(key)) continue;
      const hit = walk(val, d - 1);
      if (hit !== undefined && hit !== null && hit !== "") return hit;
    }
    return undefined;
  };
  return walk(root, depth);
}

export function normalizeProfile(rawIn: any) {
  const raw = unwrap(rawIn);
  const resultArr = Array.isArray(raw?.result) ? raw.result[0] : raw?.result;
  const d = resultArr?.user ?? raw?.result?.user ?? raw?.graphql?.user ?? raw?.data?.user ?? raw?.user_info?.user ?? raw?.data ?? raw?.user ?? raw ?? {};
  const root = rawIn;
  return {
    username: str(d.username ?? d.user_name ?? deepFindByKeys(root, ["username", "user_name"])),
    fullName: str(d.full_name ?? d.fullname ?? d.fullName ?? d.name ?? deepFindByKeys(root, ["full_name", "fullname", "fullName", "name"])),
    bio: str(d.biography ?? d.bio ?? deepFindByKeys(root, ["biography", "bio"])),
    avatarUrl: str(d.hd_profile_pic_url_info?.url ?? d.profile_pic_url_info?.url ?? d.hd_profile_pic_versions?.slice(-1)?.[0]?.url ?? d.profile_pic_url_hd ?? d.profile_pic_url ?? d.profile_pic_url_proxy ?? d.avatarUrl ?? d.profile_picture ?? d.avatar ?? deepFindByKeys(root, ["profile_pic_url_hd", "profile_pic_url", "profile_picture", "avatarUrl", "avatar"])),
    isVerified: !!(d.is_verified ?? d.verified),
    followers: num(d.follower_count ?? d.followers ?? d.followers_count ?? d.edge_followed_by?.count ?? deepFindByKeys(root, ["follower_count", "followers_count", "followers"])),
    following: num(d.following_count ?? d.following ?? d.followings ?? d.edge_follow?.count ?? deepFindByKeys(root, ["following_count", "following", "followings"])),
    postsCount: num(d.media_count ?? d.posts_count ?? d.post_count ?? d.edge_owner_to_timeline_media?.count ?? deepFindByKeys(root, ["media_count", "posts_count", "post_count"])),
    externalUrl: str(d.external_url ?? d.website ?? d.bio_links?.[0]?.url),
    category: str(d.category ?? d.category_name),
  };
}

export function normalizeMediaItem(it: any) {
  if (!it) return null;
  const m = it?.node?.media ?? it?.node?.item ?? it?.node?.post ?? it?.media ?? it?.item ?? it?.post ?? it?.node ?? it;
  const owner = m.owner ?? m.user ?? it?.owner ?? it?.user ?? {};
  const id = str(m.id ?? m.pk ?? m.media_id ?? m.taken_at_timestamp ?? m.code ?? m.shortcode);
  const code = str(m.code ?? m.shortcode ?? m.shortCode);
  const caption = str(m.caption?.text ?? (typeof m.caption === "string" ? m.caption : undefined) ?? m.title ?? m.accessibility_caption ?? m.edge_media_to_caption?.edges?.[0]?.node?.text ?? "");
  const thumbnail = str(m.thumbnail_url ?? m.display_url ?? m.image_versions2?.candidates?.[0]?.url ?? m.image_versions2?.additional_candidates?.first_frame?.url ?? m.image_versions?.items?.[0]?.url ?? m.display_resources?.slice(-1)?.[0]?.src ?? m.thumbnail_src ?? m.cover_frame_url ?? m.thumbnail ?? m.cover_pic_url ?? m.preview_image_url ?? m.image_url ?? m.cover?.url ?? m.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url ?? m.carousel_media?.[0]?.display_url ?? deepFindByKeys(m, ["thumbnail_url", "display_url", "cover_frame_url", "image_url", "thumbnail"], 3));
  const videoUrl = str(m.video_url ?? m.video_versions?.[0]?.url ?? m.videoUrl ?? m.video?.url ?? m.playback_url ?? m.video_playback_url ?? "");
  const productType = str(m.product_type ?? m.media_type_name ?? m.type ?? "").toLowerCase();
  const mediaType = num(m.media_type);
  const isVideo = !!videoUrl || ["clips", "video", "reel"].includes(productType) || mediaType === 2 || !!m.is_video || !!m.video_versions;
  return {
    id, code, caption, thumbnail, videoUrl,
    duration: num(m.video_duration ?? m.duration ?? m.clips_metadata?.duration),
    views: num(m.play_count ?? m.ig_play_count ?? m.video_play_count ?? m.video_view_count ?? m.view_count ?? m.views ?? m.fb_play_count),
    likes: num(m.like_count ?? m.likes ?? m.edge_liked_by?.count ?? m.edge_media_preview_like?.count),
    comments: num(m.comment_count ?? m.comments ?? m.edge_media_to_comment?.count),
    shares: num(m.reshare_count ?? m.share_count ?? m.shares),
    takenAt: num(m.taken_at ?? m.taken_at_timestamp ?? m.takenAt),
    productType, isVideo,
    ownerUsername: str(owner.username),
    ownerFullName: str(owner.full_name ?? owner.fullname ?? owner.name),
    ownerAvatar: str(owner.profile_pic_url ?? owner.profile_pic_url_hd ?? owner.profile_picture ?? owner.avatar),
  };
}

export function pickItems(rawIn: any): any[] {
  const raw = unwrap(rawIn);
  const r0 = Array.isArray(raw?.result) ? raw.result[0] : raw?.result;
  return r0?.data?.user?.edge_owner_to_timeline_media?.edges ?? r0?.user?.media?.nodes ?? r0?.data?.user?.media?.nodes ?? r0?.items ?? r0?.posts ?? r0?.reels ?? r0?.edges ?? r0?.data?.items ?? r0?.user?.edge_owner_to_timeline_media?.edges ?? raw?.data?.user?.edge_owner_to_timeline_media?.edges ?? raw?.data?.items ?? raw?.data?.posts ?? raw?.data?.reels ?? raw?.items ?? raw?.posts ?? raw?.reels ?? raw?.edges ?? (Array.isArray(raw?.result) ? raw.result : null) ?? (Array.isArray(raw?.data) ? raw.data : null) ?? [];
}

export function dedupeMediaItems(items: any[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = str(item?.id || item?.code || item?.shortcode || item?.pk || item?.media_id);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeHighlight(h: any) {
  return {
    id: str(h.id ?? h.pk),
    name: str(h.title ?? h.name),
    image: str(h.cover_media?.cropped_image_version?.url ?? h.cover_media?.url ?? h.cover_image ?? h.cover?.url ?? h.image ?? h.thumbnail),
  };
}

export function readPageInfo(rawIn: any) {
  const raw = unwrap(rawIn);
  const result = Array.isArray(raw?.result) ? raw.result[0] : raw?.result;
  const pageInfo = result?.page_info ?? result?.data?.page_info ?? raw?.data?.page_info ?? raw?.page_info ?? null;
  return {
    hasNext: !!(pageInfo?.has_next_page ?? pageInfo?.hasNextPage),
    cursor: str(pageInfo?.end_cursor ?? pageInfo?.next_cursor ?? pageInfo?.max_id ?? pageInfo?.maxId ?? raw?.next_max_id ?? raw?.max_id),
  };
}

export type Variant = { path: string; method?: "GET" | "POST"; query?: Record<string, string>; body?: Record<string, string> };

export function encodeCursor(tok: { c: string; v: Variant }): string {
  try { return Buffer.from(JSON.stringify(tok)).toString("base64"); } catch { return ""; }
}

export function decodeCursor(s: string): { c: string; v: Variant } | null {
  if (!s) return null;
  try {
    const tok = JSON.parse(Buffer.from(s, "base64").toString("utf8"));
    if (tok && typeof tok.c === "string" && tok.v && typeof tok.v.path === "string") return tok;
  } catch {}
  return null;
}

export function paginationVariants(variant: Variant, cursor: string): Variant[] {
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
    { ...variant, query: { ...(variant.query ?? {}), cursor } },
  ];
}

export function mergeProfile(primary: any, fallback: any, username: string) {
  const fb = fallback ? normalizeProfile(fallback) : null;
  return {
    username: primary?.username || fb?.username || username,
    fullName: primary?.fullName || fb?.fullName || username,
    bio: primary?.bio || fb?.bio || "",
    avatarUrl: primary?.avatarUrl || fb?.avatarUrl || "",
    isVerified: !!(primary?.isVerified || fb?.isVerified),
    followers: primary?.followers || fb?.followers || 0,
    following: primary?.following || fb?.following || 0,
    postsCount: primary?.postsCount || fb?.postsCount || 0,
    externalUrl: primary?.externalUrl || fb?.externalUrl || "",
    category: primary?.category || fb?.category || "",
  };
}

export function extractDetailFields(rawIn: any): { videoUrl: string; caption: string; thumbnail: string } {
  const raw = unwrap(rawIn);
  const top = Array.isArray(raw) ? raw[0] : raw;
  const r0 = Array.isArray(top?.result) ? top.result[0] : top?.result;
  const m = r0?.media ?? r0?.item ?? r0?.items?.[0] ?? r0 ?? top?.data?.media ?? top?.data?.item ?? top?.data ?? top?.media ?? top?.item ?? top ?? {};
  let videoUrl = str(m.video_url ?? m.video_versions?.[0]?.url ?? m.video?.url ?? m.videoUrl ?? m.node?.video_url ?? m.carousel_media?.[0]?.video_versions?.[0]?.url ?? "");
  if (!videoUrl) {
    const linkArr = m.urls ?? m.links ?? m.video ?? r0?.urls ?? r0?.links ?? top?.urls ?? top?.links ?? null;
    if (Array.isArray(linkArr)) {
      const mp4s = linkArr.filter((l: any) => { const u = str(l?.url ?? l?.link ?? l); const ext = str(l?.extension); return /\.mp4($|\?)/i.test(u) || ext.toLowerCase() === "mp4"; });
      const best = mp4s.sort((a: any, b: any) => num(b?.quality) - num(a?.quality))[0];
      if (best) videoUrl = str(best?.url ?? best?.link ?? best);
      if (!videoUrl) videoUrl = str(linkArr[0]?.url ?? linkArr[0]?.link ?? linkArr[0]);
    }
  }
  const meta = m.meta ?? r0?.meta ?? top?.meta ?? {};
  const caption = str(m.caption?.text ?? (typeof m.caption === "string" ? m.caption : undefined) ?? m.edge_media_to_caption?.edges?.[0]?.node?.text ?? meta.title ?? meta.caption ?? "");
  const thumbnail = str(m.thumbnail_url ?? m.display_url ?? m.image_versions2?.candidates?.[0]?.url ?? m.cover?.url ?? meta.thumbnail ?? meta.image ?? "");
  return { videoUrl, caption, thumbnail };
}
