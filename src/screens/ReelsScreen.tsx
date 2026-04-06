import { useState, useRef, useEffect, useCallback } from "react";
import {
  Heart,
  MessageCircle,
  Send,
  MoreVertical,
  Music,
  Bookmark,
  Camera,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import CommentsSheet from "@/components/CommentsSheet";
import ShareSheet from "@/components/ShareSheet";
import { loadFeedVideos, currentUser, mockAccounts } from "@/data/mockData";

interface Reel {
  id: string;
  user: string;
  avatar: string;
  caption: string;
  likes: number;
  comments: number;
  shares: number;
  image: string;
  audio: string;
  videoUrl?: string;
}

const defaultReels: Reel[] = [
  {
    id: "1",
    user: "money_mentor",
    avatar: "https://i.pravatar.cc/150?img=12",
    caption: "5 ways to earn ₹50K/month from home 💰🔥 #earnmoney #sidehustle #passiveincome",
    likes: 45200,
    comments: 1230,
    shares: 890,
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=1067&fit=crop",
    audio: "Money Mindset · trending",
  },
  {
    id: "2",
    user: "hustle.king",
    avatar: "https://i.pravatar.cc/150?img=14",
    caption: "Start freelancing today — no degree needed 🚀💻 #freelancing #workfromhome #money",
    likes: 32100,
    comments: 876,
    shares: 456,
    image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&h=1067&fit=crop",
    audio: "Grind Mode · hustle.king",
  },
  {
    id: "3",
    user: "crypto_guru",
    avatar: "https://i.pravatar.cc/150?img=15",
    caption: "Bitcoin se daily ₹5000 kaise kamaye? 🪙📈 #crypto #bitcoin #trading #invest",
    likes: 28400,
    comments: 654,
    shares: 321,
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=1067&fit=crop",
    audio: "Crypto Beats · trending",
  },
  {
    id: "4",
    user: "skill.factory",
    avatar: "https://i.pravatar.cc/150?img=16",
    caption: "3 HIGH income skills for 2026 💡🎯 #skills #career #growth #motivation",
    likes: 51800,
    comments: 1456,
    shares: 1023,
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=1067&fit=crop",
    audio: "Level Up · skill.factory",
  },
  {
    id: "5",
    user: "dropship_pro",
    avatar: "https://i.pravatar.cc/150?img=17",
    caption: "Dropshipping se ₹1 lakh/month 🛒🤑 Step by step guide #dropshipping #ecommerce #business",
    likes: 19800,
    comments: 543,
    shares: 267,
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=1067&fit=crop",
    audio: "Boss Mode · trending",
  },
  {
    id: "6",
    user: "ai_earner",
    avatar: "https://i.pravatar.cc/150?img=18",
    caption: "ChatGPT se paise kamao — 7 secret methods 🤖💸 #ai #chatgpt #onlineearning",
    likes: 67300,
    comments: 2100,
    shares: 1500,
    image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=600&h=1067&fit=crop",
    audio: "AI Revolution · ai_earner",
  },
];

const CUSTOM_REELS_KEY = "ig_custom_reels";

const loadCustomReels = (): Reel[] => {
  try {
    const saved = localStorage.getItem(CUSTOM_REELS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const saveCustomReels = (reels: Reel[]) => {
  try {
    localStorage.setItem(CUSTOM_REELS_KEY, JSON.stringify(reels));
  } catch { }
};

const formatCount = (n: number) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};

// ─── Single Reel Card (full-screen, video auto-play) ─────────────────────────
const ReelCard = ({
  reel,
  isActive,
}: {
  reel: Reel;
  isActive: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const lastTap = useRef(0);

  // Long press for editing
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [likeCount, setLikeCount] = useState(reel.likes);
  const [commentCount, setCommentCount] = useState(reel.comments);
  const [shareCount, setShareCount] = useState(reel.shares);

  // Auto-play / pause based on isActive
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isActive) {
      vid.currentTime = 0;
      vid.play().catch(() => { });
    } else {
      vid.pause();
    }
  }, [isActive]);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap
      if (!liked) {
        setLiked(true);
        setLikeCount((c) => c + 1);
        setLikeAnimating(true);
        setTimeout(() => setLikeAnimating(false), 350);
        trackEvent("reel_like", { reel_id: reel.id });
      }
      setShowDoubleTapHeart(true);
      setTimeout(() => setShowDoubleTapHeart(false), 900);
    }
    lastTap.current = now;
  };

  const toggleLike = () => {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((c) => (liked ? c - 1 : c + 1));
    if (newLiked) {
      setLikeAnimating(true);
      setTimeout(() => setLikeAnimating(false), 350);
    }
    trackEvent("reel_like", { reel_id: reel.id });
  };

  // Long press handlers
  const startPress = useCallback(
    (field: string, currentValue: string) => {
      longPressTriggered.current = false;
      pressTimer.current = setTimeout(() => {
        longPressTriggered.current = true;
        setEditField(field);
        setEditValue(currentValue);
      }, 1500);
    },
    []
  );

  const endPress = useCallback(() => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }, []);

  const saveEdit = () => {
    if (!editField) return;
    const numVal = Math.max(0, parseInt(editValue) || 0);
    if (editField === "likes") setLikeCount(numVal);
    else if (editField === "comments") setCommentCount(numVal);
    else if (editField === "shares") setShareCount(numVal);
    setEditField(null);
  };

  return (
    <>
      <div
        className="relative w-full h-full bg-black flex-shrink-0 overflow-hidden"
        onClick={handleTap}
      >
        {/* Video or Image background */}
        {reel.videoUrl ? (
          <video
            ref={videoRef}
            src={reel.videoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : (
          <img
            src={reel.image}
            alt="Reel"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 pointer-events-none" />

        {/* Double tap heart overlay */}
        <AnimatePresence>
          {showDoubleTapHeart && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{
                duration: 0.5,
                ease: [0.175, 0.885, 0.32, 1.275],
              }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
            >
              <Heart
                size={100}
                className="fill-white text-white drop-shadow-2xl"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Side Actions */}
        <div className="absolute bottom-24 right-3 flex flex-col items-center gap-5 z-10">
          <motion.button
            whileTap={{ scale: 0.7 }}
            onClick={(e) => {
              e.stopPropagation();
              toggleLike();
            }}
            onPointerDown={() =>
              startPress("likes", String(likeCount))
            }
            onPointerUp={endPress}
            onPointerLeave={endPress}
            className={cn(
              "flex flex-col items-center gap-1",
              likeAnimating && "ig-like-bounce"
            )}
          >
            <Heart
              size={28}
              className={cn(
                liked
                  ? "fill-[hsl(var(--ig-like))] text-[hsl(var(--ig-like))]"
                  : "text-white"
              )}
            />
            <span className="text-[12px] text-white font-medium">
              {formatCount(likeCount + (liked ? 1 : 0))}
            </span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={(e) => {
              e.stopPropagation();
              setShowComments(true);
            }}
            onPointerDown={() =>
              startPress("comments", String(commentCount))
            }
            onPointerUp={endPress}
            onPointerLeave={endPress}
            className="flex flex-col items-center gap-1"
          >
            <MessageCircle size={28} className="text-white" />
            <span className="text-[12px] text-white font-medium">
              {formatCount(commentCount)}
            </span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={(e) => {
              e.stopPropagation();
              setShowShare(true);
            }}
            onPointerDown={() =>
              startPress("shares", String(shareCount))
            }
            onPointerUp={endPress}
            onPointerLeave={endPress}
            className="flex flex-col items-center gap-1"
          >
            <Send size={26} className="text-white" />
            <span className="text-[12px] text-white font-medium">
              {formatCount(shareCount)}
            </span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.7 }}
            onClick={(e) => {
              e.stopPropagation();
              setSaved(!saved);
            }}
          >
            <Bookmark
              size={26}
              className={cn(
                "transition-all duration-200",
                saved ? "fill-white" : "",
                "text-white"
              )}
            />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical size={24} className="text-white" />
          </motion.button>

          {/* Spinning audio disc */}
          <div className="mt-1 h-[28px] w-[28px] rounded-md border border-white/40 overflow-hidden">
            <img
              src={reel.avatar}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        {/* Bottom Info */}
        <div
          className="absolute bottom-6 left-3 right-16 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <img
              src={reel.avatar}
              alt={reel.user}
              className="h-9 w-9 rounded-full object-cover border-[1.5px] border-white"
            />
            <span className="text-[14px] font-bold text-white">
              {reel.user}
            </span>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setFollowing(!following)}
              className={cn(
                "ml-1 rounded-lg border px-3 py-[3px] text-[12px] font-bold transition-all duration-200",
                following
                  ? "bg-white/20 border-white/30 text-white"
                  : "bg-transparent border-white text-white"
              )}
            >
              {following ? "Following" : "Follow"}
            </motion.button>
          </div>

          <div className="text-[13px] text-white leading-[17px]">
            {showFullCaption ? (
              <p>{reel.caption}</p>
            ) : (
              <p>
                {reel.caption.length > 45
                  ? reel.caption.slice(0, 45) + "..."
                  : reel.caption}{" "}
                {reel.caption.length > 45 && (
                  <button
                    onClick={() => setShowFullCaption(true)}
                    className="text-white/60"
                  >
                    more
                  </button>
                )}
              </p>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-[3px] backdrop-blur-sm">
              <Music size={10} className="text-white" />
              <span className="text-[11px] text-white max-w-[180px] truncate">
                {reel.audio}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Comments Sheet */}
      <CommentsSheet
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        postUsername={reel.user}
      />
      <ShareSheet
        isOpen={showShare}
        onClose={() => setShowShare(false)}
      />

      {/* Edit modal (long-press) */}
      {editField && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center"
          onClick={() => setEditField(null)}
        >
          <div
            className="w-[280px] rounded-2xl bg-background p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-foreground text-center mb-4 capitalize">
              Edit {editField}
            </h3>
            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              type="number"
              min="0"
              className="w-full bg-secondary rounded-lg px-4 py-2.5 text-[16px] text-foreground text-center outline-none"
              autoFocus
            />
            <button
              onClick={saveEdit}
              className="w-full mt-3 py-2.5 rounded-lg bg-[hsl(var(--ig-blue))] text-white text-[14px] font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// ─── Main Reels Screen ─────────────────────────────────────────────────────────
const ReelsScreen = () => {
  const [customReels, setCustomReels] = useState<Reel[]>(() =>
    loadCustomReels()
  );

  // Also load home feed videos and convert to reel format
  const feedVideoReels: Reel[] = loadFeedVideos().map((v) => ({
    id: `feed_${v.id}`,
    user: v.username,
    avatar: v.avatar,
    caption: v.caption,
    likes: v.likes,
    comments: v.comments,
    shares: 0,
    image: "",
    audio: `Original audio · ${v.username}`,
    videoUrl: v.videoUrl,
  }));

  const allReels = [...feedVideoReels, ...customReels, ...defaultReels];

  const [activeIndex, setActiveIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle video upload for reels
  const handleReelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("video/")) return;

    const videoUrl = URL.createObjectURL(file);

    const newReel: Reel = {
      id: `custom_reel_${Date.now()}`,
      user: "just4abhii",
      avatar: "https://i.pravatar.cc/150?img=33",
      caption: "🔥 New reel ✨ #reels #viral",
      likes: 0,
      comments: 0,
      shares: 0,
      image: "",
      audio: "Original audio · just4abhii",
      videoUrl,
    };

    const updated = [newReel, ...customReels];
    setCustomReels(updated);
    saveCustomReels(updated);

    // Scroll to top to see the new reel
    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      setActiveIndex(0);
    }, 100);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Snap scroll handler - detect which reel is currently visible
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollTop = container.scrollTop;
        const height = container.clientHeight;
        const newIndex = Math.round(scrollTop / height);
        setActiveIndex(newIndex);
        ticking = false;
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [allReels.length]);

  return (
    <div className="fixed inset-0 bg-black z-30 flex flex-col">
      {/* Header - absolute positioned over the reels */}
      <header className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 pointer-events-none">
        <h1 className="text-[22px] font-bold text-white pointer-events-auto">
          Reels
        </h1>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-white active:scale-90 transition-transform pointer-events-auto"
        >
          <Camera size={26} />
        </button>
      </header>

      {/* Hidden file input for reel upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleReelUpload}
      />

      {/* Full-screen vertical snap scroll container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
        style={{
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          scrollBehavior: "smooth",
        }}
      >
        {allReels.map((reel, index) => (
          <div
            key={reel.id}
            className="w-full"
            style={{
              height: "calc(100vh - 56px)",
              scrollSnapAlign: "start",
              scrollSnapStop: "always",
            }}
          >
            <ReelCard reel={reel} isActive={index === activeIndex} />
          </div>
        ))}

        {/* Bottom spacer for bottom nav */}
        <div className="h-[56px] bg-black flex-shrink-0" />
      </div>
    </div>
  );
};

export default ReelsScreen;