import { mockAccounts, currentUser, saveProfileOverrides, type PostItem } from "@/data/mockData";
import { fetchInstagramData, proxyIgImage, setConnectedUsername, type InstaScrapeResult } from "@/lib/instagramApi";
import { saveReelsData, type ExtendedPostItem } from "@/data/reelInsightsData";
import { supabase } from "@/integrations/supabase/client";

const MAX_REELS = 15;

/**
 * Clone a real Instagram account's data into the local mock store
 * so the existing UI (Home/Profile/Reels) shows it without any UI changes.
 */
export async function cloneInstagramAccount(usernameRaw: string): Promise<InstaScrapeResult> {
  const username = usernameRaw.trim().replace(/^@/, "");
  // Cloning needs ~15 reels — request 3 pages up-front (server will SWR-cache it).
  const data = await fetchInstagramData(username, "all", { pages: 3 });

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

  const randInt = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1));

  const reelItems: ExtendedPostItem[] = combined.map((m, index) => {
    const views = Number(m.views) > 0 ? Number(m.views) : randInt(10000, 20000);
    const likes = Number(m.likes) > 0 ? Number(m.likes) : Math.floor(views * (0.04 + Math.random() * 0.04));
    const comments = Number(m.comments) > 0 ? Number(m.comments) : Math.floor(views * (0.005 + Math.random() * 0.01));
    const shares = Number(m.shares) > 0 ? Number(m.shares) : Math.floor(views * (0.01 + Math.random() * 0.02));
    return {
      thumbnail: proxyIgImage(m.thumbnail) || m.thumbnail,
      videoUrl: m.videoUrl || undefined,
      caption: m.caption || "",
      duration: m.duration ? String(m.duration) : undefined,
      musicTitle: m.code ? `Original audio · ${p.username}` : "",
      musicIcon: proxyIgImage(p.avatarUrl) || p.avatarUrl || currentUser.avatar,
      insights: {
        views,
        likes,
        comments,
        shares,
        reposts: 0,
        saves: Math.floor(views * (0.01 + Math.random() * 0.02)),
        watchTime: "0m",
        avgWatchTime: "0s",
        followerViewsPct: 0,
        viewRatePast3Sec: 0,
        genderMale: 0,
        genderFemale: 0,
        countries: [],
        ageGroups: [],
        sources: [],
        accountsReached: views,
        follows: 0,
        viewsOverTime: [],
        skipRate: 0,
        typicalSkipRate: 0,
      },
    };
  });

  // Apply to the canonical "just4abhii" slot which the UI uses everywhere.
  // We REPLACE posts entirely (no padding from previous account) to avoid leakage.
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

  const slot = mockAccounts["just4abhii"];
  if (slot) {
    Object.assign(slot.profile, profilePatch);
    slot.posts = postItems;
    slot.highlights = highlights.length
      ? highlights.slice(0, 8).map((h) => ({
          name: h.name || "Highlight",
          image: proxyIgImage(h.image) || h.image,
        }))
      : [];
    if (p.category) slot.category = p.category;
  }

  // Mirror onto currentUser (live reference in many screens)
  Object.assign(currentUser, profilePatch);

  setConnectedUsername(p.username);

  // Replace saved reel overrides for this slot so previous-account
  // thumbnails/videos/captions don't leak into the newly cloned username.
  try {
    const rows = reelItems.map((reel, post_index) => ({
      account: "just4abhii",
      post_index,
      data: {
        sourceUsername: p.username,
        thumbnail: reel.thumbnail,
        videoUrl: reel.videoUrl || "",
        caption: reel.caption || "",
        duration: reel.duration || "",
        musicTitle: reel.musicTitle || "",
        musicIcon: reel.musicIcon || "",
        views: reel.insights.views,
        likes: reel.insights.likes,
        comments: reel.insights.comments,
        shares: reel.insights.shares,
        saves: reel.insights.saves,
      },
      updated_at: new Date().toISOString(),
    }));

    if (rows.length) {
      await (supabase as any)
        .from("reels_data")
        .upsert(rows, { onConflict: "account,post_index" });
    }
  } catch (e) {
    console.warn("[Clone] Failed to replace stale reels_data:", e);
  }

  // Always save reels (even if empty) so localStorage reflects the new account
  saveReelsData(reelItems);

  saveProfileOverrides();

  // Notify any listeners
  try {
    window.dispatchEvent(new CustomEvent("ig-account-cloned", { detail: { username: p.username } }));
  } catch {}

  return data;
}
