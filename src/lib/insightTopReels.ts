import { loadReelsData, type ExtendedPostItem } from "@/data/reelInsightsData";
import { mockAccounts, currentUser } from "@/data/mockData";

type TopReelMetric = "views" | "likes" | "follows";

const fallbackDates = ["3 Apr", "1 Apr", "31 Mar", "16 Mar", "12 Mar", "8 Mar"];

export const formatCompactMetric = (value: number) => {
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}M`;
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(1))}K`;
  return String(Math.max(0, Math.round(value)));
};

const thumbnailFromUrl = (videoUrl?: string, fallback?: string) => {
  if (videoUrl?.includes("streamable.com")) {
    const idMatch = videoUrl.match(/streamable\.com\/(?:e\/|o\/)?([a-zA-Z0-9]+)/);
    const videoId = idMatch ? idMatch[1] : videoUrl.split("/").pop();
    return `https://cdn-cf-east.streamable.com/image/${videoId}.jpg`;
  }
  return fallback || "";
};

const thumbnailFromReel = (reel: ExtendedPostItem) => {
  if (reel.thumbnail) return reel.thumbnail;
  return thumbnailFromUrl(reel.videoUrl);
};

const getActiveUsername = (): string => {
  try {
    return localStorage.getItem("ig_active_profile_username") || "just4abhii";
  } catch {
    return "just4abhii";
  }
};

const isMainAccount = (username: string): boolean => {
  if (username === "just4abhii") return true;
  const lower = username.toLowerCase();
  if (lower === (currentUser.username || "").toLowerCase()) return true;
  const acc = mockAccounts[username];
  return !!(acc && acc.profile === currentUser);
};

interface TopReelItem {
  image: string;
  value: string;
  date: string;
  sortValue: number;
}

const buildFromMainAccount = (metric: TopReelMetric, limit: number): TopReelItem[] => {
  return loadReelsData()
    .map((reel, index) => {
      const views = Number(reel.insights?.views) || 0;
      const rawMetric = Number(reel.insights?.[metric]) || 0;
      const displayMetric =
        metric === "follows" && rawMetric <= 0 ? Math.max(1, Math.round(views / 12000)) : rawMetric;
      return {
        image: thumbnailFromReel(reel),
        value: formatCompactMetric(displayMetric),
        date: reel.graphStartDate || fallbackDates[index % fallbackDates.length],
        sortValue: rawMetric || views,
      };
    })
    .filter((item) => item.image)
    .sort((a, b) => b.sortValue - a.sortValue)
    .slice(0, limit);
};

const buildFromMockAccount = (username: string, metric: TopReelMetric, limit: number): TopReelItem[] => {
  const acc = mockAccounts[username];
  if (!acc) return [];
  // Prefer reels (videoUrl present); fall back to all posts if not enough.
  const reels = acc.posts.filter((p) => !!p.videoUrl);
  const source = reels.length > 0 ? reels : acc.posts;

  return source
    .map((post, index) => {
      const likes = Number(post.likes) || 0;
      // Synthesize views from likes (typical engagement ratio)
      const views = Math.max(likes * 10, 100);
      const follows = Math.max(1, Math.round(views / 12000));
      const rawMetric = metric === "likes" ? likes : metric === "views" ? views : follows;
      return {
        image: thumbnailFromUrl(post.videoUrl, post.image),
        value: formatCompactMetric(rawMetric),
        date: fallbackDates[index % fallbackDates.length],
        sortValue: rawMetric,
      };
    })
    .filter((item) => item.image)
    .sort((a, b) => b.sortValue - a.sortValue)
    .slice(0, limit);
};

export const getInsightTopReels = (metric: TopReelMetric, limit = 4): TopReelItem[] => {
  const username = getActiveUsername();
  if (isMainAccount(username)) {
    return buildFromMainAccount(metric, limit);
  }
  return buildFromMockAccount(username, metric, limit);
};
