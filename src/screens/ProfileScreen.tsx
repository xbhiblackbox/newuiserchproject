import { Grid3X3, ChevronDown, Plus, Menu, Play, Eye, TrendingUp, Contact, Search, X, BadgeCheck, ChevronRight, ArrowUpRight, LogOut, Settings, HelpCircle, Bookmark, Clock, Star } from "lucide-react";
import threadsLogo from "@/assets/threads-logo.png";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { currentUser, mockAccounts, findMockAccount, saveProfileOverrides, type MockAccount } from "@/data/mockData";
import { loadReelsData, saveReelsData, defaultJust4abhiiReels, type ExtendedPostItem } from "@/data/reelInsightsData";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import EditProfileModal from "@/components/EditProfileModal";
import ReelEditModal from "@/components/ReelEditModal";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import VideoThumbnail from "@/components/VideoThumbnail";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthSession } from "@/lib/auth";

const ProfileScreen = () => {
  const [activeTab, setActiveTab] = useState("posts");
  const [editOpen, setEditOpen] = useState(false);
  const navigate = useNavigate();

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isPulling = useRef(false);
  const PULL_THRESHOLD = 60;
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeUsername, setActiveUsername] = useState(() => {
    // Load saved username - check if just4abhii still exists, otherwise find the renamed account
    if (mockAccounts["just4abhii"]) return "just4abhii";
    // Find account that was originally just4abhii (shares currentUser reference)
    const found = Object.entries(mockAccounts).find(([_, acc]) => acc.profile === currentUser);
    return found ? found[0] : "just4abhii";
  });

  // Reel edit state
  const [reelsData, setReelsData] = useState<ExtendedPostItem[]>(loadReelsData);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingReelIndex, setEditingReelIndex] = useState(0);

  // Long press state for reels
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressingIndex, setPressingIndex] = useState<number | null>(null);
  const longPressTriggered = useRef(false);

  // Highlight edit state
  const [highlightEditOpen, setHighlightEditOpen] = useState(false);
  const [editingHighlightIndex, setEditingHighlightIndex] = useState(-1);
  const [highlightName, setHighlightName] = useState("");
  const [highlightImageUrl, setHighlightImageUrl] = useState("");
  const highlightLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressingHighlight, setPressingHighlight] = useState<number | null>(null);
  const highlightLongPressTriggered = useRef(false);
  const [highlightVersion, setHighlightVersion] = useState(0);

  // Show/hide highlights toggle
  const [showHighlights, setShowHighlights] = useState(() => {
    const saved = localStorage.getItem('showHighlights');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleHighlights = useCallback((val: boolean) => {
    setShowHighlights(val);
    localStorage.setItem('showHighlights', String(val));
  }, []);

  // Highlight viewer state
  const [highlightViewerOpen, setHighlightViewerOpen] = useState(false);
  const [viewingHighlightIndex, setViewingHighlightIndex] = useState(0);
  const [highlightProgress, setHighlightProgress] = useState(0);

  // Dashboard views edit state
  const [dashboardEditOpen, setDashboardEditOpen] = useState(false);
  const [dashboardViewsEdit, setDashboardViewsEdit] = useState("");
  const dashboardLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dashboardLongPressTriggered = useRef(false);
  const [dashboardVersion, setDashboardVersion] = useState(0);

  // Settings menu state
  const [settingsOpen, setSettingsOpen] = useState(false);

  const account: MockAccount = useMemo(() => {
    return mockAccounts[activeUsername] || mockAccounts["b4by_4ngel_"];
  }, [activeUsername, highlightVersion, dashboardVersion]);

  const profile = account.profile;
  const highlights = account.highlights;

  const isJust4abhii = activeUsername === "just4abhii" || account.profile === currentUser;

  // Load media (thumbnails, videos) from Supabase for cross-device sync
  useEffect(() => {
    if (!isJust4abhii) return;
    (async () => {
      try {
        const { data: rows } = await (supabase as any)
          .from('reels_data')
          .select('post_index, data')
          .eq('account', 'just4abhii');
        if (!rows || rows.length === 0) return;
        setReelsData(prev => {
          const updated = [...prev];
          for (const row of rows) {
            const idx = row.post_index;
            const d = row.data as Record<string, unknown>;
            if (idx >= 0 && idx < updated.length) {
              const reel = { ...updated[idx] };
              if (d.thumbnail && typeof d.thumbnail === 'string') reel.thumbnail = d.thumbnail;
              if (d.videoUrl && typeof d.videoUrl === 'string') reel.videoUrl = d.videoUrl;
              if (d.caption && typeof d.caption === 'string') reel.caption = d.caption;
              if (d.musicTitle && typeof d.musicTitle === 'string') reel.musicTitle = d.musicTitle;
              if (d.musicIcon && typeof d.musicIcon === 'string') reel.musicIcon = d.musicIcon;
              if (d.views != null) reel.insights = { ...reel.insights, views: d.views as number };
              if (d.likes != null) reel.insights = { ...reel.insights, likes: d.likes as number };
              updated[idx] = reel;
            }
          }
          return updated;
        });
      } catch (err) {
        console.warn('[Profile] Failed to load media from Supabase:', err);
      }
    })();
  }, [isJust4abhii]);

  const getThumb = (post: { thumbnail: string; videoUrl?: string }) => {
    // Always prioritize user-set thumbnail
    if (post.thumbnail) {
      return post.thumbnail;
    }
    // Auto-generate from streamable only if no thumbnail set
    if (post.videoUrl?.includes("streamable.com")) {
      const idMatch = post.videoUrl.match(/streamable\.com\/(?:e\/|o\/)?([a-zA-Z0-9]+)/);
      const videoId = idMatch ? idMatch[1] : post.videoUrl.split("/").pop();
      return `https://cdn-cf-east.streamable.com/image/${videoId}.jpg`;
    }
    return post.thumbnail;
  };

  // Build user posts from either reelsData (for just4abhii) or account posts
  const userPosts = useMemo(() => {
    if (isJust4abhii) {
      return reelsData.map((reel, i) => ({
        image: getThumb(reel),
        videoUrl: reel.videoUrl,
        isReel: true,
        views: reel.insights.views,
        likes: reel.insights.likes,
      }));
    }
    return account.posts.map((post, i) => ({
      image: getThumb(post),
      videoUrl: post.videoUrl,
      isReel: true,
      views: [93, 37, 764, 1200, 458, 89, 234, 567, 123][i] || Math.floor(Math.random() * 500 + 50),
      likes: Math.floor(Math.random() * 500 + 100),
    }));
  }, [isJust4abhii, reelsData, account.posts]);

  // Long press handlers
  const startPress = useCallback((index: number) => {
    if (!isJust4abhii) return;
    longPressTriggered.current = false;
    setPressingIndex(index);
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setEditingReelIndex(index);
      setEditModalOpen(true);
      setPressingIndex(null);
    }, 2300);
  }, [isJust4abhii]);

  const endPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setPressingIndex(null);
  }, []);

  const handleReelClick = useCallback((index: number) => {
    endPress();
    // Don't navigate if long press just opened the edit modal
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    navigate(`/reel/${index}?account=${profile.username}`);
  }, [endPress, navigate, profile.username]);

  const handleReelSave = useCallback((index: number, updated: ExtendedPostItem) => {
    console.log("[ProfileSave] Receiving reel", index, "musicTitle:", updated.musicTitle, "musicIcon:", updated.musicIcon?.slice(0, 50), "caption:", updated.caption?.slice(0, 30));
    
    setReelsData(prev => {
      const newData = [...prev];
      newData[index] = updated;
      
      // Save to localStorage immediately inside the state update or after
      saveReelsData(newData);
      return newData;
    });

    toast.success(`Reel #${index + 1} updated!`);
  }, []);

  const handleReelDelete = useCallback((index: number) => {
    const newData = reelsData.filter((_, i) => i !== index);
    setReelsData(newData);
    saveReelsData(newData);
    toast.success(`Reel #${index + 1} deleted!`);
  }, [reelsData]);

  const handleAddReel = useCallback(() => {
    const newReel: ExtendedPostItem = {
      thumbnail: `https://images.unsplash.com/photo-${1500000000000 + reelsData.length * 5000000}?w=300&h=300&fit=crop`,
      insights: defaultJust4abhiiReels[0].insights,
    };
    const newData = [...reelsData, newReel];
    setReelsData(newData);
    saveReelsData(newData);
    setEditingReelIndex(newData.length - 1);
    setEditModalOpen(true);
  }, [reelsData]);

  // Highlight long press handlers
  const startHighlightPress = useCallback((index: number) => {
    highlightLongPressTriggered.current = false;
    setPressingHighlight(index);
    highlightLongPressTimer.current = setTimeout(() => {
      highlightLongPressTriggered.current = true;
      const acc = mockAccounts[activeUsername];
      if (acc && acc.highlights[index]) {
        setEditingHighlightIndex(index);
        setHighlightName(acc.highlights[index].name);
        setHighlightImageUrl(acc.highlights[index].image);
        setHighlightEditOpen(true);
      }
      setPressingHighlight(null);
    }, 2000);
  }, [activeUsername]);

  const endHighlightPress = useCallback(() => {
    if (highlightLongPressTimer.current) {
      clearTimeout(highlightLongPressTimer.current);
      highlightLongPressTimer.current = null;
    }
    setPressingHighlight(null);
  }, []);

  const handleHighlightSave = useCallback(() => {
    const acc = mockAccounts[activeUsername];
    if (acc) {
      if (editingHighlightIndex === -1) {
        // Adding new
        acc.highlights.push({ name: highlightName || "New", image: highlightImageUrl || "https://i.pravatar.cc/150?img=1" });
      } else {
        acc.highlights[editingHighlightIndex] = { name: highlightName, image: highlightImageUrl };
      }
    }
    setHighlightEditOpen(false);
    setHighlightVersion(v => v + 1);
    toast.success("Highlight updated!");
    saveProfileOverrides();
  }, [activeUsername, editingHighlightIndex, highlightName, highlightImageUrl]);

  const handleHighlightDelete = useCallback(() => {
    const acc = mockAccounts[activeUsername];
    if (acc && editingHighlightIndex >= 0) {
      acc.highlights.splice(editingHighlightIndex, 1);
    }
    setHighlightEditOpen(false);
    setHighlightVersion(v => v + 1);
    toast.success("Highlight deleted!");
    saveProfileOverrides();
  }, [activeUsername, editingHighlightIndex]);

  const highlightFileInputRef = useRef<HTMLInputElement>(null);

  const handleHighlightFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setHighlightImageUrl(dataUrl);
      // Always open modal after file is selected
      setHighlightEditOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const handleAddHighlight = useCallback(() => {
    setEditingHighlightIndex(-1);
    setHighlightName("");
    setHighlightImageUrl("");
    // Open file picker directly
    highlightFileInputRef.current?.click();
  }, []);

  // Dashboard long press handlers
  const startDashboardPress = useCallback(() => {
    dashboardLongPressTriggered.current = false;
    dashboardLongPressTimer.current = setTimeout(() => {
      dashboardLongPressTriggered.current = true;
      setDashboardViewsEdit(account.dashboardViews || "37.3K");
      setDashboardEditOpen(true);
    }, 2000);
  }, [account]);

  const endDashboardPress = useCallback(() => {
    if (dashboardLongPressTimer.current) {
      clearTimeout(dashboardLongPressTimer.current);
      dashboardLongPressTimer.current = null;
    }
  }, []);

  const handleDashboardSave = useCallback(() => {
    const acc = mockAccounts[activeUsername];
    if (acc) {
      acc.dashboardViews = dashboardViewsEdit;
    }
    setDashboardEditOpen(false);
    setDashboardVersion(v => v + 1);
    toast.success("Dashboard views updated!");
    saveProfileOverrides();
  }, [activeUsername, dashboardViewsEdit]);

  const handleSave = (data: { fullName: string; username: string; bio: string; website: string; posts: number; followers: number; following: number; storyNote: string; category: string; showCategory: boolean; isVerified: boolean; avatar?: string; postsDisplay?: string; followersDisplay?: string; followingDisplay?: string }) => {
    // Update the account profile in-place for this session
    const acc = mockAccounts[activeUsername];
    if (acc) {
      acc.profile.fullName = data.fullName;
      acc.profile.username = data.username;
      acc.profile.bio = data.bio;
      acc.profile.website = data.website;
      acc.profile.posts = data.posts;
      acc.profile.followers = data.followers;
      acc.profile.following = data.following;
      acc.profile.isVerified = data.isVerified;
      acc.profile.avatar = data.avatar || acc.profile.avatar;
      acc.storyNote = data.storyNote;
      acc.category = data.showCategory ? data.category : "";
      // Save display strings
      acc.postsDisplay = data.postsDisplay;
      acc.followersDisplay = data.followersDisplay;
      acc.followingDisplay = data.followingDisplay;

      // Sync reels count with posts count for just4abhii
      if (isJust4abhii) {
        const targetCount = data.posts;
        const currentReels = [...reelsData];
        if (targetCount > currentReels.length) {
          // Add new default reels
          for (let i = currentReels.length; i < targetCount; i++) {
            const defaultReel = defaultJust4abhiiReels[i % defaultJust4abhiiReels.length];
            currentReels.push({
              ...JSON.parse(JSON.stringify(defaultReel)),
              thumbnail: defaultReel.thumbnail,
              caption: `New reel #${i + 1} 🔥`,
            });
          }
        } else if (targetCount < currentReels.length) {
          currentReels.splice(targetCount);
        }
        setReelsData(currentReels);
        saveReelsData(currentReels);
      }

      // If username changed, update active
      if (data.username !== activeUsername) {
        mockAccounts[data.username] = acc;
        delete mockAccounts[activeUsername];
        setActiveUsername(data.username);
      }
    }
    // Also update currentUser if it's the main account
    if (isJust4abhii) {
      currentUser.fullName = data.fullName;
      currentUser.username = data.username;
      currentUser.bio = data.bio;
      currentUser.followers = data.followers;
      currentUser.following = data.following;
      currentUser.posts = data.posts;
      currentUser.avatar = data.avatar || currentUser.avatar;
      currentUser.isVerified = data.isVerified;
    }
    // Force re-render
    setDashboardVersion(v => v + 1);
    setEditOpen(false);
    toast.success("Profile updated!");
    saveProfileOverrides();
  };

  const formatCount = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 10000) return `${Math.round(n / 1000)}K`;
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    return String(n);
  };

  const handleSearch = () => {
    const found = findMockAccount(searchQuery);
    if (found) {
      setActiveUsername(found.profile.username);
      setSearchOpen(false);
      setSearchQuery("");
      toast.success(`Switched to @${found.profile.username}`);
    } else {
      toast.error("Account not found! Try: virat.kohli, foodie_queen, tech_guru_, photography_art");
    }
  };

  const allUsernames = Object.keys(mockAccounts);

  const PostsGridIcon = ({ active }: { active: boolean }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "currentColor" : "hsl(var(--muted-foreground))"} strokeWidth={active ? 2.8 : 2.4} shapeRendering="crispEdges">
      <rect x="2" y="2" width="20" height="20" rx="0" />
      <line x1="9" y1="2" x2="9" y2="22" />
      <line x1="15" y1="2" x2="15" y2="22" />
      <line x1="2" y1="9" x2="22" y2="9" />
      <line x1="2" y1="15" x2="22" y2="15" />
    </svg>
  );

  const ReelsTabIcon = ({ active }: { active: boolean }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="4" />
      <polygon points="10,8 10,16 17,12" fill={active ? "hsl(var(--background))" : "none"} stroke={active ? "hsl(var(--background))" : "currentColor"} strokeWidth={1.8} />
    </svg>
  );

  const RepostIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 12V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 12v3a4 4 0 0 1-4 4H3" />
    </svg>
  );

  const TaggedIcon = ({ active }: { active: boolean }) => (
    <svg width="24" height="22" viewBox="0 0 28 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4a2 2 0 0 1 2-2h7l2-2 2 2h7a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4z" />
      <circle cx="14" cy="10" r="3" stroke={active ? "hsl(var(--background))" : "currentColor"} fill={active ? "hsl(var(--background))" : "none"} />
      <path d="M9 20a5 5 0 0 1 10 0" stroke={active ? "hsl(var(--background))" : "currentColor"} fill="none" />
    </svg>
  );

  const tabs = [
    { value: "posts" },
    { value: "reels" },
    { value: "reposts" },
    { value: "tagged" },
  ];

  const renderGridItem = (post: typeof userPosts[0], i: number, aspectClass: string, clean = false) => (
    <button
      key={i}
      className={cn("relative overflow-hidden bg-secondary select-none", aspectClass, pressingIndex === i && "scale-95 transition-transform")}
      style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
      onClick={() => handleReelClick(i)}
      onContextMenu={(e) => e.preventDefault()}
      onTouchStart={() => startPress(i)}
      onTouchEnd={endPress}
      onTouchCancel={endPress}
      onMouseDown={() => startPress(i)}
      onMouseUp={endPress}
      onMouseLeave={endPress}
    >
      {post.videoUrl ? (
        <VideoThumbnail videoUrl={post.videoUrl} fallbackThumbnail={post.image} className="h-full w-full object-cover pointer-events-none" />
      ) : post.image ? (
        <img src={post.image} alt="Post" className="h-full w-full object-cover pointer-events-none" loading="lazy" draggable={false} />
      ) : (
        <div className="h-full w-full bg-secondary" />
      )}
      {!clean && (
        <>
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
          {post.isReel && (
            <div className="absolute top-[6px] right-[6px]">
              <svg width="22" height="22" viewBox="0 0 24 24" className="drop-shadow-lg">
                <defs>
                  <mask id={`reels-icon-mask-${i}`}>
                    <rect width="24" height="24" fill="white" />
                    <path d="M9.5 7.5v9l7-4.5-7-4.5z" fill="black" />
                  </mask>
                </defs>
                <rect x="2" y="2" width="20" height="20" rx="4" fill="white" mask={`url(#reels-icon-mask-${i})`} />
              </svg>
            </div>
          )}
          <div className="absolute bottom-[4px] left-[5px] flex items-center gap-[2px]">
            <svg width="12" height="10" viewBox="0 0 120 100" className="drop-shadow-lg">
              <defs>
                <mask id={`eye-mask-post-${post.views}-${i}`}>
                  <rect width="120" height="100" fill="white" />
                  <circle cx="74" cy="48" r="14" fill="black" />
                </mask>
              </defs>
              <path d="M15 45 C30 8, 90 8, 105 45" stroke="white" strokeWidth="10" strokeLinecap="round" fill="none" />
              <circle cx="60" cy="62" r="30" fill="white" mask={`url(#eye-mask-post-${post.views}-${i})`} />
            </svg>
            <span className="text-[10px] font-semibold text-white drop-shadow-lg">{formatCount(post.views)}</span>
          </div>
        </>
      )}
      {clean && (
        <div className="absolute bottom-[4px] left-[5px] flex items-center gap-[2px]">
          <svg width="12" height="10" viewBox="0 0 120 100" className="drop-shadow-lg">
            <defs>
              <mask id={`eye-mask-${post.views}-${i}`}>
                <rect width="120" height="100" fill="white" />
                <circle cx="74" cy="48" r="14" fill="black" />
              </mask>
            </defs>
            <path d="M15 45 C30 8, 90 8, 105 45" stroke="white" strokeWidth="10" strokeLinecap="round" fill="none" />
            <circle cx="60" cy="62" r="30" fill="white" mask={`url(#eye-mask-${post.views}-${i})`} />
          </svg>
          <span className="text-[10px] font-semibold text-white drop-shadow-lg">{formatCount(post.views)}</span>
        </div>
      )}
    </button>
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop <= 0 && !isRefreshing) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.4, 80));
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(() => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 1200);
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, PULL_THRESHOLD]);

  return (
    <div
      ref={scrollContainerRef}
      className="pb-16 overflow-y-auto h-screen"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Search Overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <button onClick={() => setSearchOpen(false)} className="text-foreground">
                <X size={24} />
              </button>
              <div className="flex-1 relative">
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Enter username..."
                  className="w-full bg-secondary rounded-lg px-4 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
              <button onClick={handleSearch} className="text-[hsl(var(--ig-blue))] font-semibold text-[14px]">
                Search
              </button>
            </div>

            <div className="px-4 pt-4">
              <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Available Accounts</p>
              {allUsernames.map((uname) => {
                const acc = mockAccounts[uname];
                return (
                  <button
                    key={uname}
                    onClick={() => {
                      setActiveUsername(uname);
                      setSearchOpen(false);
                      setSearchQuery("");
                    }}
                    className={cn(
                      "flex items-center gap-3 w-full py-2.5 px-1 rounded-lg transition-colors",
                      activeUsername === uname ? "bg-secondary" : ""
                    )}
                  >
                    <img src={acc.profile.avatar} alt="" className="h-[44px] w-[44px] rounded-full object-cover" />
                    <div className="text-left flex-1">
                      <div className="flex items-center gap-1">
                        <p className="text-[14px] font-semibold text-foreground">{acc.profile.username}</p>
                        {acc.profile.isVerified && <BadgeCheck size={14} className="text-[hsl(var(--ig-blue))] fill-[hsl(var(--ig-blue))]" stroke="white" />}
                      </div>
                      <p className="text-[12px] text-muted-foreground">{acc.profile.fullName} • {formatCount(acc.profile.followers)} followers</p>
                    </div>
                    {activeUsername === uname && (
                      <div className="h-2 w-2 rounded-full bg-[hsl(var(--ig-blue))]" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 mx-auto max-w-lg bg-background">
        <header className="grid grid-cols-[40px_1fr_auto] items-center bg-background px-4 py-4 ">
          <button className="text-foreground justify-self-start relative">
            <Plus size={28} strokeWidth={1.5} />
            <div className="absolute top-[4px] right-[5px] h-[6px] w-[6px] rounded-full bg-[hsl(var(--ig-like))]" />
          </button>
          <button onClick={() => setSearchOpen(true)} className="flex items-center gap-1.5 justify-self-center">
            <span className="text-[16px] font-medium text-foreground">{profile.username}</span>
            {profile.isVerified && <BadgeCheck size={16} className="text-[hsl(var(--ig-blue))] fill-[hsl(var(--ig-blue))]" stroke="white" />}
            <ChevronDown size={16} className="text-foreground" />
            <div className="h-[7px] w-[7px] rounded-full bg-[hsl(0,100%,50%)] ml-0.5" />
          </button>
          <div className="flex items-center gap-5">
            <button className="text-foreground">
              <img src={threadsLogo} alt="Threads" className="w-[26px] h-[26px] dark:invert" />
            </button>
            <button className="text-foreground" onClick={() => setSettingsOpen(true)}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </header>
      </div>
      {/* Spacer for fixed header */}
      <div className="h-[48px]" />

      {/* Pull-to-refresh spinner */}
      <div
        className="flex justify-center overflow-hidden transition-all duration-200 bg-secondary"
        style={{ height: pullDistance > 0 || isRefreshing ? `${Math.max(pullDistance, isRefreshing ? PULL_THRESHOLD : 0)}px` : '0px' }}
      >
        <div className="flex items-center justify-center py-2">
          <svg
            className={isRefreshing ? "animate-spin" : ""}
            style={{
              transform: !isRefreshing ? `rotate(${pullDistance * 4}deg)` : undefined,
              opacity: Math.min(pullDistance / PULL_THRESHOLD, 1),
            }}
            width="22"
            height="22"
            viewBox="0 0 40 40"
            fill="none"
          >
            <circle cx="20" cy="20" r="17" stroke="hsl(var(--muted-foreground) / 0.15)" strokeWidth="2" />
            <path d="M20 3a17 17 0 0 1 17 17" stroke="hsl(var(--muted-foreground) / 0.35)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Profile Info */}
      <div className="px-4 pt-0 overflow-visible">
        <div className="flex items-center gap-5 overflow-visible">
          <div className="relative flex-shrink-0 flex flex-col items-center mt-10">
            {/* Notes bubble overlapping avatar */}
            {account.storyNote && (
              <div className="absolute -top-[18px] left-1/2 -translate-x-1/2 z-10 w-max animate-in fade-in zoom-in duration-300 pointer-events-none">
                <div className="relative bg-white dark:bg-[#262626] border border-black/5 dark:border-white/10 rounded-[18px] px-3.5 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.15)] min-w-[50px] max-w-[100px]">
                  <p className="text-[11px] leading-tight text-foreground line-clamp-2 text-center font-normal">
                    {account.storyNote}
                  </p>
                  {/* Thought bubble tails (circles) - themed */}
                  <div className="absolute -bottom-[3px] left-[52%] w-[8px] h-[8px] rounded-full bg-white dark:bg-[#262626] border-b border-r border-black/5 dark:border-white/10" />
                  <div className="absolute -bottom-[8px] left-[46%] w-[5px] h-[5px] rounded-full bg-white dark:bg-[#262626] border-b border-r border-black/5 dark:border-white/10" />
                </div>
              </div>
            )}
            <div className="rounded-full border-[2.5px] border-muted-foreground/30 p-[2.5px]">
              <img src={profile.avatar} alt={profile.username} className="h-[72px] w-[72px] rounded-full object-cover" />
            </div>
            <div className="absolute bottom-[4px] right-[0px] flex h-[20px] w-[20px] items-center justify-center rounded-full border-[2px] border-background bg-foreground text-background">
              <Plus size={12} strokeWidth={2.5} />
            </div>
          </div>

          <div className="flex-1 pt-1">
            <p className="text-[15px] font-semibold text-foreground mb-1.5">{profile.fullName}</p>
            <div className="flex w-full">
              {[
                { label: "posts", value: account.postsDisplay || String(isJust4abhii ? reelsData.length : account.posts?.length || profile.posts) },
                { label: "followers", value: account.followersDisplay || String(profile.followers) },
                { label: "following", value: account.followingDisplay || String(profile.following) },
              ].map((s, i) => (
                <button key={s.label} className={`flex flex-col items-center ${i === 0 ? 'pr-5' : 'flex-1'}`}>
                  <p className="text-[16px] font-medium text-foreground leading-tight">{s.value}</p>
                  <p className="text-[13px] text-foreground">{s.label}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-0.5">
          {account.category && <p className="text-[12px] text-muted-foreground leading-tight">{account.category}</p>}
          <p className="text-[12px] text-foreground leading-[15px] whitespace-pre-line">{profile.bio.replace(`${account.category}\n`, '')}</p>
          {profile.website && (
            <div className="mt-0 flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="hsl(225 73% 57%)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <span className="text-[12px] text-[hsl(225,73%,57%)] font-medium">{profile.website}</span>
            </div>
          )}
        </div>


        <div
          className="mt-2.5 rounded-lg bg-secondary/60 px-3 py-2.5 w-full text-left"
          onTouchStart={startDashboardPress}
          onTouchEnd={endDashboardPress}
          onTouchCancel={endDashboardPress}
          onMouseDown={startDashboardPress}
          onMouseUp={endDashboardPress}
          onMouseLeave={endDashboardPress}
          onClick={() => { if (!dashboardLongPressTriggered.current) navigate('/analytics'); }}
        >
          <p className="text-[13px] font-semibold text-foreground">Professional dashboard</p>
          <div className="flex items-center gap-1 mt-0.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--ig-blue))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="7" y1="17" x2="17" y2="7" />
              <polyline points="7 7 17 7 17 17" />
            </svg>
            <p className="text-[11px] text-muted-foreground">{account.dashboardViews || "37.3K"} views in the last 30 days.</p>
          </div>
        </div>

        {/* Dashboard Views Edit Modal */}
        {dashboardEditOpen && (
          <div className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setDashboardEditOpen(false)}>
            <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-background" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <button onClick={() => setDashboardEditOpen(false)} className="text-foreground"><X size={24} /></button>
                <h3 className="text-base font-bold text-foreground">Edit Dashboard</h3>
                <button onClick={handleDashboardSave} className="text-sm font-bold text-[hsl(var(--ig-blue))]">Done</button>
              </div>
              <div className="px-4 py-5">
                <label className="text-xs text-muted-foreground mb-1 block">Views in the last 30 days</label>
                <input
                  value={dashboardViewsEdit}
                  onChange={(e) => setDashboardViewsEdit(e.target.value)}
                  placeholder="e.g. 98.5M"
                  className="w-full bg-secondary rounded-lg px-4 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
            </div>
          </div>
        )}

        <div className="mt-2.5 flex gap-1.5">
          <Button variant="secondary" className="flex-1 h-[32px] text-[13px] font-semibold rounded-lg" onClick={() => setEditOpen(true)}>
            Edit profile
          </Button>
          <Button variant="secondary" className="flex-1 h-[32px] text-[13px] font-semibold rounded-lg" onClick={() => { navigator.clipboard?.writeText(window.location.origin + "/profile"); toast.success("Profile link copied!"); }}>
            Share profile
          </Button>
        </div>
      </div>

      {/* Highlights */}
      {showHighlights && (
        <div className="flex gap-3 overflow-x-auto px-4 py-3 hide-scrollbar">
          {/* Hidden file input for highlights */}
          <input
            ref={highlightFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              handleHighlightFileUpload(e);
              // If it's a new highlight, open modal after file selected
              if (editingHighlightIndex === -1) {
                // Modal will open from the callback
              }
            }}
          />
          <button onClick={handleAddHighlight} className="flex flex-col items-center gap-1 min-w-[72px]">
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[1.5px] border-foreground/50">
              <Plus size={30} className="text-foreground" strokeWidth={1.2} />
            </div>
            <span className="text-[11px] text-foreground">New</span>
          </button>
          {highlights.map((h, idx) => (
            <div
              key={`${h.name}-${idx}`}
              className={cn("flex flex-col items-center gap-1 min-w-[72px] select-none cursor-pointer", pressingHighlight === idx && "scale-95 transition-transform")}
              style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
              onContextMenu={(e) => e.preventDefault()}
              onTouchStart={() => startHighlightPress(idx)}
              onTouchEnd={endHighlightPress}
              onTouchCancel={endHighlightPress}
              onMouseDown={() => startHighlightPress(idx)}
              onMouseUp={endHighlightPress}
              onMouseLeave={endHighlightPress}
              onClick={() => {
                if (highlightLongPressTriggered.current) {
                  highlightLongPressTriggered.current = false;
                  return;
                }
                setViewingHighlightIndex(idx);
                setHighlightViewerOpen(true);
              }}
            >
              <div className="h-[72px] w-[72px] rounded-full overflow-hidden border-[1.5px] border-foreground/30 p-[2px]">
                <img src={h.image} alt={h.name} className="h-full w-full rounded-full object-cover pointer-events-none" draggable={false} />
              </div>
              <span className="text-[11px] text-foreground max-w-[72px] truncate">{h.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Highlight Edit Modal */}
      {highlightEditOpen && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setHighlightEditOpen(false)}>
          <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-background" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <button onClick={() => setHighlightEditOpen(false)} className="text-foreground"><X size={24} /></button>
              <h3 className="text-base font-bold text-foreground">{editingHighlightIndex === -1 ? "Add Highlight" : "Edit Highlight"}</h3>
              <button onClick={handleHighlightSave} className="text-sm font-bold text-[hsl(var(--ig-blue))]">Done</button>
            </div>
            <div className="px-4 py-5 space-y-4">
              {highlightImageUrl && (
                <div className="flex justify-center">
                  <img src={highlightImageUrl} alt="Preview" className="h-[80px] w-[80px] rounded-full object-cover border border-border" />
                </div>
              )}
              {/* Upload photo button */}
              <button
                onClick={() => highlightFileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-secondary rounded-lg px-4 py-2.5 text-[14px] text-foreground font-medium active:scale-95 transition-transform"
              >
                <Plus size={18} />
                {highlightImageUrl ? "Change Photo" : "Upload Photo"}
              </button>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Highlight Name</label>
                <input
                  value={highlightName}
                  onChange={(e) => setHighlightName(e.target.value)}
                  placeholder="e.g. 🔥 Attitude"
                  className="w-full bg-secondary rounded-lg px-4 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Or paste Image URL</label>
                <input
                  value={highlightImageUrl?.startsWith("data:") ? "" : highlightImageUrl}
                  onChange={(e) => setHighlightImageUrl(e.target.value)}
                  placeholder="Paste image URL here..."
                  className="w-full bg-secondary rounded-lg px-4 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
              {/* Delete button - only for existing highlights */}
              {editingHighlightIndex >= 0 && (
                <button
                  onClick={handleHighlightDelete}
                  className="w-full text-center py-2.5 text-[14px] font-semibold text-destructive active:scale-95 transition-transform"
                >
                  Delete Highlight
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button key={tab.value} onClick={() => setActiveTab(tab.value)} className={cn("flex-1 flex flex-col items-center justify-center pt-3 pb-3 relative")}>
              {isActive && <div className="absolute bottom-[2px] dark:bottom-[5px] inset-x-0 mx-auto w-[60%] h-[2.5px] bg-foreground" style={tab.value === "reels" ? { transform: 'translateX(-4px)' } : undefined} />}
              {tab.value === "posts" && <div className={isActive ? "text-foreground" : "text-muted-foreground"}><PostsGridIcon active={isActive} /></div>}
              {tab.value === "reels" && <div className={cn("flex items-center justify-center gap-0.5 w-full", isActive ? "text-foreground" : "text-muted-foreground")}><ReelsTabIcon active={isActive} />{isActive && <ChevronDown size={12} />}</div>}
              {tab.value === "reposts" && <div className={isActive ? "text-foreground" : "text-muted-foreground"}><RepostIcon /></div>}
              {tab.value === "tagged" && <div className={isActive ? "text-foreground" : "text-muted-foreground"}><TaggedIcon active={isActive} /></div>}
            </button>
          );
        })}
      </div>

      {/* Posts Grid */}
      {activeTab === "posts" && (
        <div className="grid grid-cols-3 gap-[1.5px]">
          {userPosts.map((post, i) => renderGridItem(post, i, "aspect-[4/5]"))}
          {/* Add new reel button for just4abhii */}
          {isJust4abhii && (
            <button
              onClick={handleAddReel}
              className="relative aspect-[4/5] overflow-hidden bg-secondary flex flex-col items-center justify-center gap-2"
            >
              <Plus size={32} className="text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground font-medium">Add Reel</span>
            </button>
          )}
        </div>
      )}

      {/* Reels Grid */}
      {activeTab === "reels" && (
        <div className="grid grid-cols-3 gap-[1.5px] dark:gap-[3px]">
          {userPosts.filter(p => p.isReel).map((post, i) => renderGridItem(post, i, "aspect-[2/3]", true))}
          {isJust4abhii && (
            <button
              onClick={handleAddReel}
              className="relative aspect-[2/3] overflow-hidden bg-secondary flex flex-col items-center justify-center gap-2"
            >
              <Plus size={32} className="text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground font-medium">Add Reel</span>
            </button>
          )}
        </div>
      )}

      {activeTab === "reposts" && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <RepostIcon />
          <p className="mt-3 text-sm font-medium">No reposts yet</p>
        </div>
      )}

      {activeTab === "tagged" && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Contact size={48} strokeWidth={1} />
          <p className="mt-3 text-sm font-medium">No tagged posts yet</p>
        </div>
      )}

      <EditProfileModal isOpen={editOpen} onClose={() => setEditOpen(false)} profile={profile} storyNote={account.storyNote} category={account.category} postsDisplay={account.postsDisplay} followersDisplay={account.followersDisplay} followingDisplay={account.followingDisplay} onSave={handleSave} showHighlights={showHighlights} onToggleHighlights={toggleHighlights} />

      {/* Reel Edit Modal */}
      <ReelEditModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        reel={reelsData[editingReelIndex] || null}
        reelIndex={editingReelIndex}
        onSave={handleReelSave}
        onDelete={isJust4abhii ? handleReelDelete : undefined}
      />

      {/* Highlight Viewer */}
      <AnimatePresence>
        {highlightViewerOpen && highlights[viewingHighlightIndex] && (
          <HighlightViewer
            highlights={highlights}
            initialIndex={viewingHighlightIndex}
            username={profile.username}
            avatar={profile.avatar}
            onClose={() => setHighlightViewerOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Settings Drawer */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100] bg-black/50"
              onClick={() => setSettingsOpen(false)}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 z-[101] w-[280px] bg-background border-l border-border shadow-2xl overflow-y-auto"
            >
              <div className="px-4 py-4">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-[18px] font-bold text-foreground">Settings</h2>
                  <button onClick={() => setSettingsOpen(false)} className="p-1 rounded-full hover:bg-secondary">
                    <X size={22} className="text-foreground" />
                  </button>
                </div>

                <div className="space-y-1">
                  <button className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-secondary transition-colors text-left">
                    <Settings size={22} className="text-foreground" />
                    <span className="text-[15px] text-foreground">Settings and privacy</span>
                  </button>
                  <button className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-secondary transition-colors text-left">
                    <Clock size={22} className="text-foreground" />
                    <span className="text-[15px] text-foreground">Your activity</span>
                  </button>
                  <button className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-secondary transition-colors text-left">
                    <Bookmark size={22} className="text-foreground" />
                    <span className="text-[15px] text-foreground">Saved</span>
                  </button>
                  <button className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-secondary transition-colors text-left">
                    <Star size={22} className="text-foreground" />
                    <span className="text-[15px] text-foreground">Favorites</span>
                  </button>
                  <button className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-secondary transition-colors text-left">
                    <HelpCircle size={22} className="text-foreground" />
                    <span className="text-[15px] text-foreground">Help</span>
                  </button>
                </div>

                <div className="mt-6 pt-4 border-t border-border">
                  <button
                    onClick={() => {
                      const confirmed = window.confirm("Are you sure you want to log out?");
                      if (!confirmed) return;
                      clearAuthSession();
                      window.location.reload();
                    }}
                    className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-red-500/10 transition-colors text-left"
                  >
                    <LogOut size={22} className="text-red-500" />
                    <span className="text-[15px] text-red-500 font-semibold">Log out</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// Highlight fullscreen viewer component
const HighlightViewer = ({
  highlights,
  initialIndex,
  username,
  avatar,
  onClose,
}: {
  highlights: { name: string; image: string }[];
  initialIndex: number;
  username: string;
  avatar: string;
  onClose: () => void;
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);

  const goNext = useCallback(() => {
    if (currentIndex < highlights.length - 1) setCurrentIndex((i) => i + 1);
    else onClose();
  }, [currentIndex, highlights.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }, [currentIndex]);

  useEffect(() => {
    setProgress(0);
    const duration = 5000;
    const interval = 30;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += interval;
      setProgress((elapsed / duration) * 100);
      if (elapsed >= duration) goNext();
    }, interval);
    return () => clearInterval(timer);
  }, [currentIndex, goNext]);

  const h = highlights[currentIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
    >
      {/* Progress bars */}
      <div className="absolute top-2 left-2 right-2 flex gap-[3px] z-10">
        {highlights.map((_, i) => (
          <div key={i} className="flex-1 h-[2px] rounded-full bg-white/30 overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-75"
              style={{ width: i < currentIndex ? "100%" : i === currentIndex ? `${progress}%` : "0%" }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-4 left-3 right-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5 mt-2">
          <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover border border-white/50" />
          <span className="text-[13px] font-semibold text-white">{username}</span>
          <span className="text-[12px] text-white/50">{h.name}</span>
        </div>
        <button onClick={onClose} className="mt-2 text-white active:scale-90 transition-transform">
          <X size={24} />
        </button>
      </div>

      {/* Highlight image */}
      <motion.img
        key={currentIndex}
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        src={h.image}
        alt={h.name}
        className="h-full w-full object-cover"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/30 pointer-events-none" />

      {/* Nav areas */}
      <button onClick={goPrev} className="absolute left-0 top-0 bottom-16 w-1/3 z-10" />
      <button onClick={goNext} className="absolute right-0 top-0 bottom-16 w-1/3 z-10" />
    </motion.div>
  );
};

export default ProfileScreen;
