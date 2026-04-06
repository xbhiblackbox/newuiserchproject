import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

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
  { image: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=400&h=400&fit=crop", isReel: true, views: "5.2M" },
  { image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop", isReel: true, views: "1.7M" },
  { image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&h=400&fit=crop", isReel: true, views: "275K" },
  { image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop", isReel: true, views: "1.3M" },
  { image: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=400&h=400&fit=crop", isReel: true, views: "3.2M" },
  { image: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=400&h=400&fit=crop", isReel: true, views: "2.4M" },
  { image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=400&h=400&fit=crop", isReel: true, views: "4.8M" },
  { image: "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?w=400&h=400&fit=crop", isReel: true, views: "12.4M" },
  { image: "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=400&h=400&fit=crop", isReel: true, views: "1.7M" },
  { image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop", isReel: true, views: "439K" },
  { image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=400&fit=crop", isReel: true, views: "22.1M" },
  { image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop", isReel: true, views: "4.8M" },
  { image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=400&fit=crop", isReel: true, views: "890K" },
  { image: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=400&h=400&fit=crop", isReel: true, views: "1.1M" },
  { image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=400&fit=crop", isReel: true, views: "567K" },
  { image: "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=400&h=400&fit=crop", isReel: true, views: "2.3M" },
  { image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=400&h=400&fit=crop", isReel: true, views: "3.4M" },
  { image: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=400&h=400&fit=crop", isReel: false },
  { image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=400&fit=crop", isReel: true, views: "780K" },
  { image: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=400&fit=crop", isReel: false },
];

const SearchScreen = () => {
  const [query, setQuery] = useState("");

  // Shuffle images differently per device
  const shuffledGrid = useMemo(() => seededShuffle(exploreGrid, getDeviceSeed()), []);

  const filteredItems = query
    ? shuffledGrid.filter((_, i) => i % 2 === 0)
    : shuffledGrid;

  return (
    <div className="pb-16">
      {/* Search Bar - Instagram Meta AI style */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md px-4 py-2">
        <div className="relative">
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
            placeholder="Search with Meta AI"
            className="w-full h-[40px] rounded-[12px] bg-secondary pl-10 pr-3 text-[15px] text-foreground placeholder:text-muted-foreground outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-[hsl(var(--ig-blue))]"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Explore Grid - Instagram-style 3-column with large tiles */}
      <div className="grid grid-cols-3 gap-[2px]">
        {filteredItems.map((item, i) => {
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
    </div>
  );
};

export default SearchScreen;