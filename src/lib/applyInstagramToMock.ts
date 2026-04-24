import { mockAccounts, currentUser, saveProfileOverrides, type PostItem } from "@/data/mockData";
import { fetchInstagramData, proxyIgImage, type InstaScrapeResult } from "@/lib/instagramApi";

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

  // Build post grid: combine real posts + reels thumbnails
  const combined = [...posts, ...reels];
  const postItems: PostItem[] = combined.slice(0, 21).map((m) => ({
    thumbnail: proxyIgImage(m.thumbnail) || m.thumbnail,
    videoUrl: m.videoUrl || undefined,
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

  saveProfileOverrides();

  // Notify any listeners
  try {
    window.dispatchEvent(new CustomEvent("ig-account-cloned", { detail: { username: p.username } }));
  } catch {}

  return data;
}
