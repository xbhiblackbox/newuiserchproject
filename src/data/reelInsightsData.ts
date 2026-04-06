// Extended PostItem with full insights data
export interface ReelInsights {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  reposts: number;
  saves: number;
  watchTime: string;
  avgWatchTime: string;
  followerViewsPct: number;
  viewRatePast3Sec: number;
  genderMale: number;
  genderFemale: number;
  countries: { name: string; pct: number }[];
  ageGroups: { range: string; pct: number }[];
  sources: { name: string; pct: number }[];
  accountsReached: number;
  follows: number;
  viewsOverTime: { day: string; thisReel: number; typical: number }[];
  // Retention
  skipRate: number;
  typicalSkipRate: number;
  retentionCurve?: { t: string; pct: number }[];
  typicalRetentionCurve?: { t: string; pct: number }[];
}

export interface ExtendedPostItem {
  thumbnail: string;
  videoUrl?: string;
  caption?: string;
  duration?: string;
  musicTitle?: string;
  musicIcon?: string;
  graphStartDate?: string;
  yCenter?: number;
  yTop?: number;
  showGraph?: boolean;
  insights: ReelInsights;
}

const defaultRetentionCurve = (skipRate: number) => [
  { t: "0:00", pct: 100 },
  { t: "", pct: Math.round(100 - skipRate * 0.3) },
  { t: "", pct: Math.round(60 - skipRate * 0.2) },
  { t: "", pct: Math.round(30 - skipRate * 0.1) },
  { t: "0:19", pct: Math.max(2, Math.round(10 - skipRate * 0.05)) },
];

const defaultInsights = (i: number): ReelInsights => ({
  views: [1000, 2500, 5000, 800, 12000, 3400, 7800, 950, 4200, 6100, 1500, 9200, 3000, 11000, 2200, 4500, 8700, 1800, 6500, 3900][i] || 1000,
  likes: [69, 180, 340, 55, 890, 210, 520, 70, 290, 410, 100, 650, 200, 780, 150, 300, 600, 120, 440, 260][i] || 69,
  comments: [11, 25, 48, 8, 120, 35, 75, 12, 40, 60, 18, 90, 28, 105, 20, 42, 82, 15, 55, 33][i] || 11,
  shares: [2, 15, 30, 4, 80, 20, 45, 6, 25, 38, 10, 55, 18, 70, 12, 28, 50, 8, 35, 22][i] || 2,
  reposts: [5, 12, 25, 3, 60, 15, 35, 4, 20, 30, 8, 40, 14, 55, 10, 22, 38, 6, 28, 18][i] || 5,
  saves: [8, 22, 45, 6, 100, 28, 60, 9, 32, 50, 14, 72, 24, 85, 16, 35, 65, 11, 48, 30][i] || 8,
  watchTime: ["1h 3m", "2h 30m", "5h 12m", "45m", "12h 5m", "3h 20m", "7h 45m", "50m", "4h 10m", "6h 30m", "1h 25m", "9h 15m", "2h 55m", "10h 40m", "2h 5m", "4h 30m", "8h 20m", "1h 40m", "6h 15m", "3h 45m"][i] || "1h 3m",
  avgWatchTime: ["6s", "8s", "12s", "5s", "15s", "9s", "11s", "5s", "10s", "13s", "7s", "14s", "8s", "16s", "7s", "10s", "12s", "6s", "11s", "9s"][i] || "6s",
  followerViewsPct: [89, 75, 60, 92, 45, 70, 55, 88, 65, 50, 82, 48, 72, 42, 78, 62, 52, 85, 58, 68][i] || 89,
  viewRatePast3Sec: [42, 55, 68, 38, 72, 50, 65, 40, 58, 70, 45, 67, 52, 74, 48, 60, 66, 43, 62, 54][i] || 42,
  genderMale: [92, 70, 55, 88, 45, 65, 50, 90, 60, 48, 80, 52, 68, 40, 75, 58, 47, 85, 55, 63][i] || 92,
  genderFemale: [8, 30, 45, 12, 55, 35, 50, 10, 40, 52, 20, 48, 32, 60, 25, 42, 53, 15, 45, 37][i] || 8,
  countries: [
    { name: "India", pct: [54, 45, 35, 60, 25, 40, 30, 58, 38, 28, 50, 32, 42, 22, 48, 36, 27, 55, 33, 44][i] || 54 },
    { name: "Iran", pct: [20, 18, 15, 12, 22, 16, 20, 15, 18, 24, 14, 22, 17, 25, 16, 19, 23, 13, 20, 18][i] || 20 },
    { name: "USA", pct: [10, 15, 22, 8, 25, 18, 20, 10, 16, 20, 12, 18, 15, 22, 14, 17, 20, 10, 18, 14][i] || 10 },
    { name: "Uzbekistan", pct: [6, 8, 12, 5, 10, 9, 12, 6, 10, 11, 7, 10, 8, 12, 7, 9, 11, 6, 10, 8][i] || 6 },
    { name: "Türkiye", pct: [3, 5, 8, 4, 8, 6, 7, 3, 6, 7, 4, 7, 5, 9, 4, 6, 8, 3, 7, 5][i] || 3 },
  ],
  ageGroups: [
    { range: "13-17", pct: [32, 25, 18, 35, 12, 22, 15, 33, 20, 14, 28, 16, 24, 10, 30, 20, 13, 34, 18, 26][i] || 32 },
    { range: "18-24", pct: [36, 38, 40, 34, 42, 38, 40, 35, 38, 42, 37, 40, 38, 44, 36, 39, 41, 35, 39, 37][i] || 36 },
    { range: "25-34", pct: [20, 22, 25, 18, 28, 24, 26, 19, 24, 27, 21, 26, 23, 29, 20, 24, 27, 19, 25, 22][i] || 20 },
    { range: "35-44", pct: [7, 8, 10, 6, 11, 9, 10, 7, 9, 10, 8, 10, 8, 10, 7, 9, 11, 6, 10, 8][i] || 7 },
    { range: "45-54", pct: [2, 3, 4, 3, 4, 3, 5, 3, 4, 4, 3, 4, 3, 4, 3, 4, 4, 3, 4, 3][i] || 2 },
    { range: "55-64", pct: [1, 2, 1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 2, 1, 2, 2, 2, 1, 2, 2][i] || 1 },
    { range: "65+", pct: [2, 2, 2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2][i] || 2 },
  ],
  sources: [
    { name: "Feed", pct: [63, 55, 45, 68, 35, 50, 40, 65, 48, 38, 58, 42, 52, 32, 60, 46, 36, 64, 44, 54][i] || 63 },
    { name: "Reels tab", pct: [11, 15, 20, 10, 25, 18, 22, 12, 18, 24, 14, 20, 16, 28, 13, 19, 24, 11, 20, 16][i] || 11 },
    { name: "Stories", pct: [11, 12, 15, 8, 18, 14, 16, 10, 14, 16, 12, 16, 13, 18, 11, 14, 17, 9, 15, 12][i] || 11 },
    { name: "Explore", pct: [7, 10, 12, 6, 14, 10, 12, 7, 10, 13, 8, 12, 10, 14, 8, 11, 13, 7, 12, 9][i] || 7 },
    { name: "Profile", pct: [6, 8, 8, 8, 8, 8, 10, 6, 10, 9, 8, 10, 9, 8, 8, 10, 10, 9, 9, 9][i] || 6 },
  ],
  accountsReached: [567, 1200, 2800, 450, 6500, 1800, 4200, 520, 2300, 3400, 850, 5100, 1600, 6000, 1200, 2500, 4800, 980, 3600, 2100][i] || 567,
  follows: [0, 5, 12, 0, 35, 8, 20, 1, 10, 15, 3, 22, 6, 30, 4, 12, 18, 2, 14, 8][i] || 0,
  skipRate: [28.2, 32.5, 18.4, 45.1, 15.8, 38.7, 22.3, 41.6, 19.9, 35.4, 27.1, 16.5, 33.8, 12.4, 42.3, 25.6, 20.1, 37.9, 23.7, 30.2][i] ?? 28.2,
  typicalSkipRate: [54.7, 54.7, 54.7, 54.7, 54.7, 54.7, 54.7, 54.7, 54.7, 54.7, 54.7, 54.7, 54.7, 54.7, 54.7, 54.7, 54.7, 54.7, 54.7, 54.7][i] ?? 54.7,
  retentionCurve: defaultRetentionCurve([28.2, 32.5, 18.4, 45.1, 15.8, 38.7, 22.3, 41.6, 19.9, 35.4, 27.1, 16.5, 33.8, 12.4, 42.3, 25.6, 20.1, 37.9, 23.7, 30.2][i] ?? 28.2),
  viewsOverTime: [
    { day: "23 Jan", thisReel: 0, typical: 0 },
    { day: "", thisReel: [12000, 8000, 15000, 5000, 30000, 10000, 20000, 4000, 12000, 18000, 6000, 24000, 9000, 28000, 7000, 13000, 22000, 5000, 16000, 11000][i] || 12000, typical: 50 },
    { day: "2 Feb", thisReel: [16000, 10000, 18000, 6000, 35000, 12000, 25000, 5000, 15000, 22000, 8000, 28000, 11000, 32000, 9000, 16000, 26000, 6000, 20000, 14000][i] || 16000, typical: 80 },
    { day: "", thisReel: [15800, 9500, 17000, 5800, 33000, 11500, 24000, 4800, 14000, 21000, 7500, 27000, 10500, 31000, 8500, 15000, 25000, 5800, 19000, 13000][i] || 15800, typical: 60 },
    { day: "13 Feb", thisReel: [15500, 9000, 16500, 5500, 32000, 11000, 23000, 4500, 13500, 20000, 7000, 26000, 10000, 30000, 8000, 14500, 24000, 5500, 18000, 12500][i] || 15500, typical: 40 },
  ],
});

// Generate 20 posts for just4abhii with unique thumbnails
const just4abhiiThumbnails = [
  "https://cdn-cf-east.streamable.com/image/owo7oy.jpg",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1463453091185-61582044d556?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=400&fit=crop",
];

const defaultCaptions = [
  "Nancy doll 😘🌹 ...", "Attitude level 💀🔥", "King vibes only 👑", "Dark mode on 🖤", "Boss energy ⚡",
  "No cap 🧢", "Real ones know 💯", "Savage mode 😈", "Unstoppable 🚀", "Legend in making 🏆",
  "Vibe check ✨", "Built different 💪", "Main character 🎬", "No limits 🔥", "Stay real 💎",
  "Grind never stops 🏋️", "Different breed 🐺", "Crown me 👑", "Pure fire 🔥", "Game over 🎮",
];

const defaultMusicTitles = [
  "Sofia Camara • Ingrained (DN...",
  "Eminem • Lose Yourself",
  "The Weeknd • Blinding Lights",
];

const defaultMusicIcons = [
  "https://i.pravatar.cc/80?img=10",
  "https://i.pravatar.cc/80?img=12",
  "https://i.pravatar.cc/80?img=14",
];

export const defaultJust4abhiiReels: ExtendedPostItem[] = Array.from({ length: 20 }, (_, i) => ({
  thumbnail: just4abhiiThumbnails[i],
  videoUrl: i === 0 ? "https://streamable.com/owo7oy" : i === 1 ? "https://go.screenpal.com/watch/cOnobNn0qGq" : undefined,
  caption: defaultCaptions[i],
  duration: "0:10",
  musicTitle: i < 3 ? defaultMusicTitles[i] : "",
  musicIcon: i < 3 ? defaultMusicIcons[i] : "",
  insights: defaultInsights(i),
}));

// localStorage key — bump version to force refresh with new video URLs
const STORAGE_KEY = "just4abhii_reels_data_v3";

export const loadReelsData = (): ExtendedPostItem[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch { }
  return defaultJust4abhiiReels;
};

export const saveReelsData = (reels: ExtendedPostItem[]) => {
  try {
    // Strip base64/blob data before saving to localStorage to avoid exceeding ~5MB limit
    // These are already uploaded to Supabase Storage with permanent URLs
    const cleaned = reels.map(r => {
      const copy = { ...r };
      if (copy.thumbnail?.startsWith('blob:')) {
        copy.thumbnail = '';
      }
      if (copy.musicIcon?.startsWith('blob:')) {
        copy.musicIcon = '';
      }
      if (copy.videoUrl?.startsWith('blob:')) {
        copy.videoUrl = '';
      }
      return copy;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    console.log("[SaveReels] Saved", reels.length, "reels. graphStartDate[0]:", reels[0]?.graphStartDate, "graphStartDate[1]:", reels[1]?.graphStartDate, "views[1]:", reels[1]?.insights?.views);
  } catch (e) {
    console.error("[SaveReels] Failed to save:", e);
  }
};
