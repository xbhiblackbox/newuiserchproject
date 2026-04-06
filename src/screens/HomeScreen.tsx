import { useState, useCallback, useRef, useMemo } from "react";
import { Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import StoryCircle from "@/components/StoryCircle";
import StoryViewer from "@/components/StoryViewer";
import PostCard from "@/components/PostCard";
import VideoFeedCard from "@/components/VideoFeedCard";
import {
  stories,
  posts,
  currentUser,
  mockAccounts,
  loadFeedVideos,
  saveFeedVideo,
} from "@/data/mockData";
import type { FeedVideo } from "@/data/mockData";
import { motion } from "framer-motion";
import instagramLogo from "@/assets/instagram-wordmark.png";

// Instagram wordmark using actual logo image
const InstagramLogo = () => (
  <img
    src={instagramLogo}
    alt="Instagram"
    className="h-[42px] w-auto dark:invert"
    draggable={false}
  />
);

const HomeScreen = () => {
  const navigate = useNavigate();
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [dmCount, setDmCount] = useState(2);
  const [dmEditOpen, setDmEditOpen] = useState(false);
  const [dmEditValue, setDmEditValue] = useState("");

  // Feed videos state
  const [feedVideos, setFeedVideos] = useState<FeedVideo[]>(() =>
    loadFeedVideos()
  );

  const videoInputRef = useRef<HTMLInputElement>(null);

  const dmPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dmLongPressTriggered = useRef(false);

  const startDmPress = useCallback(() => {
    dmLongPressTriggered.current = false;
    dmPressTimer.current = setTimeout(() => {
      dmLongPressTriggered.current = true;
      setDmEditValue(String(dmCount));
      setDmEditOpen(true);
    }, 1500);
  }, [dmCount]);

  const endDmPress = useCallback(() => {
    if (dmPressTimer.current) clearTimeout(dmPressTimer.current);
  }, []);

  const openStory = useCallback((index: number) => {
    if (stories[index].isOwn) return;
    setStoryIndex(index);
    setStoryViewerOpen(true);
  }, []);

  // Handle video upload from device
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's a video file
    if (!file.type.startsWith("video/")) return;

    const videoUrl = URL.createObjectURL(file);

    // Get current user avatar from mockAccounts
    const userAccount = mockAccounts["just4abhii"];
    const avatar = userAccount?.profile?.avatar || currentUser.avatar;
    const username =
      userAccount?.profile?.username || currentUser.username;

    const newVideo: FeedVideo = {
      id: `feed_video_${Date.now()}`,
      videoUrl,
      username,
      avatar,
      caption: "🔥 New video ✨",
      likes: 0,
      comments: 0,
      timeAgo: "Just now",
      isVerified: currentUser.isVerified,
    };

    saveFeedVideo(newVideo);
    setFeedVideos((prev) => [newVideo, ...prev]);

    // Reset input
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  // Merge videos & posts for the feed - videos come between posts
  const feedItems = useMemo(() => {
    const items: Array<
      | { type: "post"; data: (typeof posts)[0]; key: string }
      | { type: "video"; data: FeedVideo; key: string }
    > = [];

    // Put all uploaded videos at the top first
    feedVideos.forEach((v) => {
      items.push({ type: "video", data: v, key: `v_${v.id}` });
    });

    // Then all regular image posts follow
    posts.forEach((p) => {
      items.push({ type: "post", data: p, key: `p_${p.id}` });
    });

    return items;
  }, [feedVideos]);

  return (
    <div className="pb-16">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between bg-background px-4 py-3 border-none shadow-none">
        <button
          onClick={() => navigate("/create")}
          className="text-foreground active:scale-90 transition-transform"
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <InstagramLogo />
        <div className="flex items-center">
          <button className="relative text-foreground active:scale-90 transition-transform">
            <Heart size={30} strokeWidth={1.5} />
            <span className="absolute -right-0.5 -top-0.5 h-[8px] w-[8px] rounded-full bg-[hsl(var(--ig-like))]" />
          </button>
        </div>
      </header>

      {/* Hidden video file input */}
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleVideoUpload}
      />

      {/* Stories */}
      <div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar px-3 pt-4 pb-3">
          {stories.map((story, i) => {
            const displayStory = story.isOwn
              ? {
                ...story,
                avatar:
                  mockAccounts["just4abhii"]?.profile?.avatar ||
                  currentUser.avatar ||
                  story.avatar,
                storyNote: mockAccounts["just4abhii"]?.storyNote || story.storyNote,
              }
              : story;
            return (
              <div key={story.id}>
                <StoryCircle
                  story={displayStory}
                  onClick={() => openStory(i)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Feed - videos + posts */}
      <div>
        {feedItems.map((item) =>
          item.type === "video" ? (
            <VideoFeedCard key={item.key} video={item.data as FeedVideo} />
          ) : (
            <PostCard key={item.key} post={item.data as (typeof posts)[0]} />
          )
        )}
      </div>

      {/* Story Viewer */}
      {storyViewerOpen && (
        <StoryViewer
          stories={stories.filter((s) => !s.isOwn)}
          initialIndex={Math.max(0, storyIndex - 1)}
          onClose={() => setStoryViewerOpen(false)}
        />
      )}

      {/* DM Count Edit Modal */}
      {dmEditOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center"
          onClick={() => setDmEditOpen(false)}
        >
          <div
            className="w-[280px] rounded-2xl bg-background p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-foreground text-center mb-4">
              Message Count
            </h3>
            <input
              value={dmEditValue}
              onChange={(e) => setDmEditValue(e.target.value)}
              type="number"
              min="0"
              className="w-full bg-secondary rounded-lg px-4 py-2.5 text-[16px] text-foreground text-center outline-none"
              autoFocus
            />
            <button
              onClick={() => {
                setDmCount(Math.max(0, parseInt(dmEditValue) || 0));
                setDmEditOpen(false);
              }}
              className="w-full mt-3 py-2.5 rounded-lg bg-[hsl(var(--ig-blue))] text-white text-[14px] font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeScreen;