import { useState, useMemo } from "react";
import { Search, BadgeCheck, Loader2, AlertCircle } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import {
  fetchInstagramData,
  proxyIgImage,
  formatCount,
  type InstaScrapeResult,
} from "@/lib/instagramApi";

// Device-based seeded shuffle - different order on each device
const getDeviceSeed = () => {
  const ua = navigator.userAgent || '';
  const screen = `${window.screen.width}x${window.screen.height}`;
  let hash = 0;
  const str = ua + screen + (navigator.language || '');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const seededShuffle = <T,>(arr: T[], seed: number): T[] => {
  const shuffled = [...arr];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Curated explore images that actually load well from Unsplash
const exploreGrid = [
  { image: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=500&fit=crop", isReel: true, views: "1.7M" },
  { image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=400&fit=crop", isReel: true, views: "567K" },
  { image: "https://images.unsplash.com/photo-1511497584788-876760111969?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=500&fit=crop", isReel: true, views: "2.5M" },
  { image: "https://images.unsplash.com/photo-1504439904031-93ded9f93e4e?w=400&h=400&fit=crop", isReel: true, views: "3.2M" },
  { image: "https://images.unsplash.com/photo-1545291730-faff8ca1d4b0?w=400&h=500&fit=crop", isReel: true, views: "2.4M" },
  { image: "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=500&fit=crop", isReel: true, views: "4.8M" },
  { image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=500&fit=crop", isReel: true, views: "1.3M" },
  { image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=500&fit=crop", isReel: true, views: "22.1M" },
  { image: "https://images.unsplash.com/photo-1493106819501-66d381c466f3?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&h=500&fit=crop", isReel: true, views: "890K" },
  { image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop", isReel: true, views: "1.7M" },
  { image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=500&fit=crop", isReel: true, views: "439K" },
  { image: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=400&fit=crop", isReel: true, views: "2.3M" },
  { image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop", isReel: true, views: "3.4M" },
  { image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=500&fit=crop", isReel: true, views: "1.1M" },
  { image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=500&fit=crop", isReel: true, views: "780K" },
  { image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop", isReel: true, views: "4.8M" },
  { image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&h=500&fit=crop", isReel: true, views: "567K" },
  { image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=500&fit=crop", isReel: true, views: "2.1M" },
  { image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=500&fit=crop", isReel: true, views: "12.4M" },
  { image: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=400&h=500&fit=crop", isReel: true, views: "3.8M" },
  { image: "https://images.unsplash.com/photo-1488161628813-04466f0cc7d4?w=400&h=400&fit=crop", isReel: false },
];

const SearchScreen = () => {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [result, setResult] = useState<InstaScrapeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shuffle images differently per device
  const shuffledGrid = useMemo(() => seededShuffle(exploreGrid, getDeviceSeed()), []);

  const searchSessionId = useRef<number>(0);

  const runSearch = async (raw: string) => {
    const u = raw.trim().replace(/^@/, "").toLowerCase();
    if (!u) return;
    
    const currentSession = ++searchSessionId.current;
    
    setSubmitted(u);
    setLoading(true);
    setError(null);
    setResult(null);
    trackEvent("user_search", { username: u });
    try {
      const data = await fetchInstagramData(u, "all");
      if (currentSession !== searchSessionId.current) return;
      if (!data?.profile?.username) {
        setError("User not found. Username check karo.");
      } else {
        setResult(data);
      }
    } catch (e: any) {
      if (currentSession !== searchSessionId.current) return;
      setError(e?.message || "Search failed. Try again.");
    } finally {
      if (currentSession === searchSessionId.current) {
        setLoading(false);
      }
    }
  };

  const clearAll = () => {
    setQuery("");
    setSubmitted("");
    setResult(null);
    setError(null);
  };

  return (
    <div className="pb-16">
      {/* Search Bar - Instagram Meta AI style */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md px-4 py-2">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query);
          }}
        >
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value)
                trackEvent("search", { query: e.target.value });
            }}
            placeholder="Search username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full h-[40px] rounded-[12px] bg-secondary pl-10 pr-3 text-[15px] text-foreground placeholder:text-muted-foreground outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={clearAll}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-[hsl(var(--ig-blue))]"
            >
              Cancel
            </button>
          )}
        </form>
      </div>

      {/* Search states */}
      {submitted && (
        <div className="px-4 py-3">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground text-[14px]">
              <Loader2 size={16} className="animate-spin" />
              Loading <span className="font-semibold">@{submitted}</span>…
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-2 text-destructive text-[14px]">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {!loading && !error && result?.profile && (
            <div className="space-y-4">
              {/* Profile header */}
              <div className="flex items-center gap-4">
                <img
                  src={proxyIgImage(result.profile.avatarUrl)}
                  alt={result.profile.username}
                  className="w-20 h-20 rounded-full object-cover bg-secondary"
                  loading="lazy"
                />
                <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[16px] font-semibold">
                      {formatCount(result.profile.postsCount)}
                    </div>
                    <div className="text-[12px] text-muted-foreground">posts</div>
                  </div>
                  <div>
                    <div className="text-[16px] font-semibold">
                      {formatCount(result.profile.followers)}
                    </div>
                    <div className="text-[12px] text-muted-foreground">followers</div>
                  </div>
                  <div>
                    <div className="text-[16px] font-semibold">
                      {formatCount(result.profile.following)}
                    </div>
                    <div className="text-[12px] text-muted-foreground">following</div>
                  </div>
                </div>
              </div>

              {/* Name + bio */}
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-[14px] font-semibold">
                    {result.profile.fullName || result.profile.username}
                  </span>
                  {result.profile.isVerified && (
                    <BadgeCheck size={16} className="text-[hsl(var(--ig-blue))]" />
                  )}
                </div>
                <div className="text-[13px] text-muted-foreground">
                  @{result.profile.username}
                </div>
                {result.profile.category && (
                  <div className="text-[13px] text-muted-foreground mt-0.5">
                    {result.profile.category}
                  </div>
                )}
                {result.profile.bio && (
                  <p className="text-[14px] mt-1 whitespace-pre-line">
                    {result.profile.bio}
                  </p>
                )}
                {result.profile.externalUrl && (
                  <a
                    href={result.profile.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] text-[hsl(var(--ig-blue))] font-medium break-all"
                  >
                    {result.profile.externalUrl}
                  </a>
                )}
              </div>

              {/* Posts/reels grid */}
              {(() => {
                const items = [
                  ...(result.posts ?? []),
                  ...(result.reels ?? []),
                ];
                if (items.length === 0) {
                  return (
                    <div className="text-center text-muted-foreground text-[13px] py-6">
                      No posts found.
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-3 gap-[2px] -mx-4">
                    {items.slice(0, 30).map((p) => (
                      <div
                        key={p.id || p.code}
                        className="relative aspect-square overflow-hidden bg-secondary"
                      >
                        <img
                          src={proxyIgImage(p.thumbnail)}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {p.views > 0 && (
                          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="white"
                              className="drop-shadow-md"
                            >
                              <polygon points="5,3 19,12 5,21" />
                            </svg>
                            <span className="text-[11px] font-semibold text-white drop-shadow-md">
                              {formatCount(p.views)}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Explore Grid - Instagram-style 3-column with large tiles */}
      {!submitted && (
      <div className="grid grid-cols-3 gap-[2px]">
        {shuffledGrid.map((item, i) => {
          // Every group of 6: first 3 are small squares, then 1 large (2x2) + 2 small stacked
          // Simulating Instagram's explore layout pattern
          const groupIndex = Math.floor(i / 6);
          const posInGroup = i % 6;
          const isLargeTile =
            posInGroup === 3 && groupIndex % 2 === 0;
          const isLargeTileAlt =
            posInGroup === 3 && groupIndex % 2 !== 0;

          return (
            <div
              key={i}
              className={cn(
                "relative overflow-hidden bg-secondary",
                isLargeTile ? "col-span-2 row-span-2" : "",
                isLargeTileAlt ? "col-span-1 row-span-2" : ""
              )}
            >
              <img
                src={item.image}
                alt="Explore"
                className={cn(
                  "w-full object-cover",
                  isLargeTile || isLargeTileAlt
                    ? "h-full aspect-auto"
                    : "aspect-square"
                )}
                loading="lazy"
              />

              {/* Reel play icon with view count */}
              {item.isReel && item.views && (
                <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="white"
                    className="drop-shadow-md"
                  >
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                  <span className="text-[12px] font-semibold text-white drop-shadow-md">
                    {item.views}
                  </span>
                </div>
              )}

              {/* Multi-image icon for non-reels occasionally */}
              {!item.isReel && i % 7 === 0 && (
                <div className="absolute top-2 right-2">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2.5"
                    className="drop-shadow-md"
                  >
                    <rect x="3" y="3" width="15" height="15" rx="2" />
                    <path d="M8 21h10a2 2 0 002-2V8" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};

export default SearchScreen;