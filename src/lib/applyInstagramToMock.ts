import { mockAccounts, currentUser, saveProfileOverrides, type PostItem } from "@/data/mockData";
import { fetchInstagramData, proxyIgImage, type InstaScrapeResult } from "@/lib/instagramApi";
import { saveReelsData, type ExtendedPostItem } from "@/data/reelInsightsData";
import { supabase } from "@/integrations/supabase/client";

const MAX_REELS = 15;

/**
 * Clone a real Instagram account's data into the local mock store
 * so the existing UI (Home/Profile/Reels) shows it without any UI changes.
 */
export async function cloneInstagramAccount(usernameRaw: string): Promise<InstaScrapeResult> {
  const username = usernameRaw.trim().replace(/^@/, "");
  const data = await fetchInstagramData(username, "all");

  const p = data.profile;
  if (!p?.username) throw new Error("Account not found");

  const reels = data.reels ?? [];
  const posts = data.posts ?? [];
  const highlights = data.highlights ?? [];

  // Merge posts + reels, dedupe by id/code, then sort latest-first by takenAt and cap to MAX_REELS
  const seen = new Set<string>();
  const merged: typeof posts = [];
  for (const item of [...posts, ...reels]) {
    const key = String((item as any).id || (item as any).code || "");
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    merged.push(item);
  }
  merged.sort((a, b) => (Number((b as any).takenAt) || 0) - (Number((a as any).takenAt) || 0));
  const combined = merged.slice(0, MAX_REELS);
  const postItems: PostItem[] = combined.map((m) => ({
    thumbnail: proxyIgImage(m.thumbnail) || m.thumbnail,
    videoUrl: m.videoUrl || undefined,
  }));

  const reelItems: ExtendedPostItem[] = combined.map((m, index) => ({
    thumbnail: proxyIgImage(m.thumbnail) || m.thumbnail,
    videoUrl: m.videoUrl || undefined,
    caption: m.caption || "",
    duration: m.duration ? String(m.duration) : undefined,
    musicTitle: m.code ? `Original audio · ${p.username}` : "",
    musicIcon: proxyIgImage(p.avatarUrl) || p.avatarUrl || currentUser.avatar,
    insights: {
      views: Number(m.views) || 0,
      likes: Number(m.likes) || 0,
      comments: Number(m.comments) || 0,
      shares: Number(m.shares) || 0,
      reposts: 0,
      saves: 0,
      watchTime: "0m",
      avgWatchTime: "0s",
      followerViewsPct: 0,
      viewRatePast3Sec: 0,
      genderMale: 0,
      genderFemale: 0,
      countries: [],
      ageGroups: [],
      sources: [],
      accountsReached: Number(m.views) || 0,
      follows: 0,
      viewsOverTime: [],
      skipRate: 0,
      typicalSkipRate: 0,
    },
  }));

  // Pad if fewer than expected — keep existing thumbnails
  const existingPosts = mockAccounts["just4abhii"]?.posts ?? [];
  while (postItems.length < Math.min(21, existingPosts.length)) {
    postItems.push(existingPosts[postItems.length]);
  }

  const profilePatch = {
    username: p.username,
    fullName: p.fullName || p.username,
    avatar: proxyIgImage(p.avatarUrl) || p.avatarUrl || currentUser.avatar,
    bio: p.bio || "",
    posts: p.postsCount || postItems.length,
    followers: p.followers || 0,
    following: p.following || 0,
    isVerified: !!p.isVerified,
    website: p.externalUrl || "",
  };

  // Apply to the canonical "just4abhii" slot which the UI uses everywhere
  const slot = mockAccounts["just4abhii"];
  if (slot) {
    Object.assign(slot.profile, profilePatch);
    slot.posts = postItems.length ? postItems : slot.posts;
    slot.highlights = highlights.length
      ? highlights.slice(0, 8).map((h) => ({
          name: h.name || "Highlight",
          image: proxyIgImage(h.image) || h.image,
        }))
      : slot.highlights;
    if (p.category) slot.category = p.category;
  }

  // Mirror onto currentUser (live reference in many screens)
  Object.assign(currentUser, profilePatch);

  if (reelItems.length) {
    saveReelsData(reelItems);
  }

  saveProfileOverrides();

  // Notify any listeners
  try {
    window.dispatchEvent(new CustomEvent("ig-account-cloned", { detail: { username: p.username } }));
  } catch {}

  return data;
}
