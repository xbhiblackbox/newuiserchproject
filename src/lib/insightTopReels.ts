import { loadReelsData, type ExtendedPostItem } from "@/data/reelInsightsData";

type TopReelMetric = "views" | "likes" | "follows";

const fallbackDates = ["3 Apr", "1 Apr", "31 Mar", "16 Mar", "12 Mar", "8 Mar"];

export const formatCompactMetric = (value: number) => {
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}M`;
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(1))}K`;
  return String(Math.max(0, Math.round(value)));
};

const thumbnailFromReel = (reel: ExtendedPostItem) => {
  if (reel.thumbnail) return reel.thumbnail;
  if (reel.videoUrl?.includes("streamable.com")) {
    const idMatch = reel.videoUrl.match(/streamable\.com\/(?:e\/|o\/)?([a-zA-Z0-9]+)/);
    const videoId = idMatch ? idMatch[1] : reel.videoUrl.split("/").pop();
    return `https://cdn-cf-east.streamable.com/image/${videoId}.jpg`;
  }
  return "";
};

export const getInsightTopReels = (metric: TopReelMetric, limit = 4) => {
  return loadReelsData()
    .map((reel, index) => {
      const views = Number(reel.insights?.views) || 0;
      const rawMetric = Number(reel.insights?.[metric]) || 0;
      const displayMetric = metric === "follows" && rawMetric <= 0 ? Math.max(1, Math.round(views / 12000)) : rawMetric;

      return {
        image: thumbnailFromReel(reel),
        value: formatCompactMetric(displayMetric),
        date: reel.graphStartDate || fallbackDates[index % fallbackDates.length],
        sortValue: metric === "follows" ? rawMetric || views : rawMetric || views,
      };
    })
    .filter((item) => item.image)
    .sort((a, b) => b.sortValue - a.sortValue)
    .slice(0, limit);
};