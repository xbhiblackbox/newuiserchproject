import { useState, useRef, useEffect, useCallback } from "react";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, BadgeCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import CommentsSheet from "@/components/CommentsSheet";
import ShareSheet from "@/components/ShareSheet";
import { trackEvent } from "@/lib/analytics";
import type { FeedVideo } from "@/data/mockData";

interface VideoFeedCardProps {
    video: FeedVideo;
    /** Editable fields: long-press to edit likes, comments, caption */
    onEdit?: (id: string, field: string, value: string) => void;
}

const VideoFeedCard = ({ video, onEdit }: VideoFeedCardProps) => {
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [liked, setLiked] = useState(false);
    const [saved, setSaved] = useState(false);
    const [likeCount, setLikeCount] = useState(video.likes);
    const [commentCount, setCommentCount] = useState(video.comments);
    const [caption, setCaption] = useState(video.caption);
    const [showHeart, setShowHeart] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [likeAnimating, setLikeAnimating] = useState(false);
    const [expanded, setExpanded] = useState(false);

    // Edit modal states
    const [editField, setEditField] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressTriggered = useRef(false);

    // Auto-play when visible (IntersectionObserver)
    useEffect(() => {
        const el = containerRef.current;
        const vid = videoRef.current;
        if (!el || !vid) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    vid.play().catch(() => { });
                } else {
                    vid.pause();
                }
            },
            { threshold: 0.6 }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const handleDoubleTap = () => {
        if (!liked) {
            setLiked(true);
            setLikeCount((c) => c + 1);
            setLikeAnimating(true);
            setTimeout(() => setLikeAnimating(false), 350);
            trackEvent("like", { video_id: video.id, method: "double_tap" });
        }
        setShowHeart(true);
        setTimeout(() => setShowHeart(false), 900);
    };

    const toggleLike = () => {
        const newLiked = !liked;
        setLiked(newLiked);
        setLikeCount((c) => (liked ? c - 1 : c + 1));
        if (newLiked) {
            setLikeAnimating(true);
            setTimeout(() => setLikeAnimating(false), 350);
        }
        trackEvent(newLiked ? "like" : "unlike", { video_id: video.id });
    };

    const toggleSave = () => {
        setSaved((v) => !v);
        trackEvent(saved ? "unsave" : "save", { video_id: video.id });
    };

    // Long press handlers for editing
    const startPress = useCallback((field: string, currentValue: string) => {
        longPressTriggered.current = false;
        pressTimer.current = setTimeout(() => {
            longPressTriggered.current = true;
            setEditField(field);
            setEditValue(currentValue);
        }, 1500);
    }, []);

    const endPress = useCallback(() => {
        if (pressTimer.current) clearTimeout(pressTimer.current);
    }, []);

    const saveEdit = () => {
        if (!editField) return;
        if (editField === "likes") {
            setLikeCount(Math.max(0, parseInt(editValue) || 0));
        } else if (editField === "comments") {
            setCommentCount(Math.max(0, parseInt(editValue) || 0));
        } else if (editField === "caption") {
            setCaption(editValue);
        }
        onEdit?.(video.id, editField, editValue);
        setEditField(null);
    };

    const isLongCaption = caption.length > 80;
    const formatCount = (n: number) =>
        n >= 1000000
            ? `${(n / 1000000).toFixed(1)}M`
            : n >= 1000
                ? `${(n / 1000).toFixed(1)}K`
                : n.toLocaleString();

    return (
        <>
            <article className="border-b border-border">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2.5">
                        <div className="story-ring">
                            <div className="rounded-full bg-background p-[1.5px]">
                                <img
                                    src={video.avatar}
                                    alt={video.username}
                                    className="h-[32px] w-[32px] rounded-full object-cover"
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => navigate("/profile")}
                                    className="text-[13px] font-semibold text-foreground"
                                >
                                    {video.username}
                                </button>
                                {video.isVerified && (
                                    <BadgeCheck
                                        size={14}
                                        className="fill-[hsl(var(--ig-blue))] text-white"
                                    />
                                )}
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-tight">
                                Suggested for you
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="rounded-lg bg-[hsl(var(--ig-blue))] px-4 py-[5px] text-[13px] font-semibold text-white active:opacity-80 transition-opacity">
                            Follow
                        </button>
                        <button className="text-foreground p-1 active:opacity-50 transition-opacity">
                            <MoreHorizontal size={20} />
                        </button>
                    </div>
                </div>

                {/* Video - auto-play, no controls, muted, loop */}
                <div
                    ref={containerRef}
                    className="relative select-none"
                    onDoubleClick={handleDoubleTap}
                >
                    <video
                        ref={videoRef}
                        src={video.videoUrl}
                        className="w-full aspect-square object-cover"
                        muted
                        loop
                        playsInline
                        autoPlay
                        preload="metadata"
                    />

                    {/* Double-tap heart animation */}
                    <AnimatePresence>
                        {showHeart && (
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 1.5, opacity: 0 }}
                                transition={{
                                    duration: 0.5,
                                    ease: [0.175, 0.885, 0.32, 1.275],
                                }}
                                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                            >
                                <Heart
                                    size={90}
                                    className="fill-white text-white drop-shadow-2xl"
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 px-3 pt-3 pb-1">
                    <motion.button
                        whileTap={{ scale: 0.7 }}
                        onClick={toggleLike}
                        onPointerDown={() => startPress("likes", String(likeCount))}
                        onPointerUp={endPress}
                        onPointerLeave={endPress}
                        className={cn(
                            "flex items-center gap-1.5",
                            likeAnimating && "ig-like-bounce"
                        )}
                    >
                        <Heart
                            size={24}
                            className={cn(
                                "transition-colors duration-200",
                                liked
                                    ? "fill-[hsl(var(--ig-like))] text-[hsl(var(--ig-like))]"
                                    : "text-foreground"
                            )}
                        />
                        <span className="text-[13px] font-medium text-foreground">
                            {formatCount(likeCount)}
                        </span>
                    </motion.button>

                    <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={() => setShowComments(true)}
                        onPointerDown={() => startPress("comments", String(commentCount))}
                        onPointerUp={endPress}
                        onPointerLeave={endPress}
                        className="flex items-center gap-1.5"
                    >
                        <MessageCircle
                            size={24}
                            className="text-foreground"
                            style={{ transform: "scaleX(-1)" }}
                        />
                        <span className="text-[13px] font-medium text-foreground">
                            {commentCount > 0 ? formatCount(commentCount) : ""}
                        </span>
                    </motion.button>

                    {/* Repost / reshare icon */}
                    <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5"
                    >
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-foreground"
                        >
                            <path d="M17 2l4 4-4 4" />
                            <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                            <path d="M7 22l-4-4 4-4" />
                            <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                        </svg>
                    </motion.button>

                    <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={() => setShowShare(true)}
                    >
                        <Send size={22} className="text-foreground" />
                    </motion.button>
                </div>

                {/* Caption */}
                <div className="px-3 pb-3 pt-1">
                    <p
                        className="mt-0.5 text-[13px] text-foreground leading-[18px]"
                        onPointerDown={() => startPress("caption", caption)}
                        onPointerUp={endPress}
                        onPointerLeave={endPress}
                    >
                        <span className="font-semibold">{video.username}</span>{" "}
                        {isLongCaption && !expanded ? (
                            <>
                                {caption.slice(0, 80)}...{" "}
                                <button
                                    onClick={() => setExpanded(true)}
                                    className="text-muted-foreground"
                                >
                                    more
                                </button>
                            </>
                        ) : (
                            caption
                        )}
                    </p>
                    {commentCount > 0 && (
                        <button
                            onClick={() => setShowComments(true)}
                            className="mt-1 text-[13px] text-muted-foreground"
                        >
                            View all {commentCount} comments
                        </button>
                    )}
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {video.timeAgo}
                    </p>
                </div>
            </article>

            <CommentsSheet
                isOpen={showComments}
                onClose={() => setShowComments(false)}
                postUsername={video.username}
            />
            <ShareSheet
                isOpen={showShare}
                onClose={() => setShowShare(false)}
            />

            {/* Edit modal (long-press) */}
            {editField && (
                <div
                    className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center"
                    onClick={() => setEditField(null)}
                >
                    <div
                        className="w-[280px] rounded-2xl bg-background p-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-base font-bold text-foreground text-center mb-4 capitalize">
                            Edit {editField}
                        </h3>
                        {editField === "caption" ? (
                            <textarea
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                rows={3}
                                className="w-full bg-secondary rounded-lg px-4 py-2.5 text-[14px] text-foreground outline-none resize-none"
                                autoFocus
                            />
                        ) : (
                            <input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                type="number"
                                min="0"
                                className="w-full bg-secondary rounded-lg px-4 py-2.5 text-[16px] text-foreground text-center outline-none"
                                autoFocus
                            />
                        )}
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

export default VideoFeedCard;
