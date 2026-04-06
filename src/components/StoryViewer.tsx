import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Heart, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Story } from "@/data/mockData";

interface StoryViewerProps {
  stories: Story[];
  initialIndex: number;
  onClose: () => void;
}

const StoryViewer = ({ stories, initialIndex, onClose }: StoryViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [reply, setReply] = useState("");
  const story = stories[currentIndex];

  const goNext = useCallback(() => {
    if (currentIndex < stories.length - 1) setCurrentIndex((i) => i + 1);
    else onClose();
  }, [currentIndex, stories.length, onClose]);

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
      if (elapsed >= duration) {
        goNext();
      }
    }, interval);
    return () => clearInterval(timer);
  }, [currentIndex, goNext]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
      >
        {/* Progress bars */}
        <div className="absolute top-2 left-2 right-2 flex gap-[3px] z-10">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-[2px] rounded-full bg-white/30 overflow-hidden">
              <motion.div
                className="h-full bg-white rounded-full"
                style={{
                  width: i < currentIndex ? "100%" : i === currentIndex ? `${progress}%` : "0%",
                }}
                transition={{ duration: 0.05 }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-4 left-3 right-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5 mt-2">
            <img src={story.avatar} alt="" className="h-8 w-8 rounded-full object-cover border border-white/50" />
            <span className="text-[13px] font-semibold text-white">{story.username}</span>
            <span className="text-[12px] text-white/50">just now</span>
          </div>
          <button onClick={onClose} className="mt-2 text-white active:scale-90 transition-transform">
            <X size={24} />
          </button>
        </div>

        {/* Story image with transition */}
        <motion.img
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          src={story.avatar.replace("150", "600")}
          alt="Story"
          className="h-full w-full object-cover"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/30" />

        {/* Nav areas */}
        <button onClick={goPrev} className="absolute left-0 top-0 bottom-16 w-1/3 z-10" />
        <button onClick={goNext} className="absolute right-0 top-0 bottom-16 w-1/3 z-10" />

        {/* Reply bar at bottom */}
        <div className="absolute bottom-4 left-3 right-3 flex items-center gap-2 z-10">
          <Input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Send message"
            className="flex-1 h-[40px] rounded-full bg-transparent border border-white/40 text-white text-[14px] placeholder:text-white/50 focus-visible:ring-0 px-4"
          />
          <button className="text-white active:scale-90 transition-transform">
            <Heart size={24} />
          </button>
          <button className="text-white active:scale-90 transition-transform">
            <Send size={24} />
          </button>
        </div>

        {/* Desktop arrows */}
        {currentIndex > 0 && (
          <button onClick={goPrev} className="absolute left-2 top-1/2 -translate-y-1/2 hidden md:flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white z-10">
            <ChevronLeft size={20} />
          </button>
        )}
        {currentIndex < stories.length - 1 && (
          <button onClick={goNext} className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white z-10">
            <ChevronRight size={20} />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default StoryViewer;