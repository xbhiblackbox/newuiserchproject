import { useState } from "react";
import { X, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

interface Comment {
  id: string;
  username: string;
  avatar: string;
  text: string;
  timeAgo: string;
  likes: number;
}

const mockComments: Comment[] = [
  { id: "1", username: "sarah_j", avatar: "https://i.pravatar.cc/150?img=1", text: "This is absolutely stunning! 😍", timeAgo: "1h", likes: 12 },
  { id: "2", username: "mike.design", avatar: "https://i.pravatar.cc/150?img=3", text: "Great capture! What camera did you use?", timeAgo: "2h", likes: 5 },
  { id: "3", username: "priya_k", avatar: "https://i.pravatar.cc/150?img=5", text: "Love the colors 🎨", timeAgo: "3h", likes: 8 },
  { id: "4", username: "alex.dev", avatar: "https://i.pravatar.cc/150?img=7", text: "Beautiful! Adding to my travel list ✈️", timeAgo: "4h", likes: 3 },
  { id: "5", username: "nina_art", avatar: "https://i.pravatar.cc/150?img=9", text: "Can I paint this? 🖼️", timeAgo: "5h", likes: 15 },
  { id: "6", username: "raj_photo", avatar: "https://i.pravatar.cc/150?img=11", text: "The lighting is perfect here 📸", timeAgo: "6h", likes: 7 },
];

interface CommentsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  postUsername: string;
}

const CommentsSheet = ({ isOpen, onClose, postUsername }: CommentsSheetProps) => {
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState(mockComments);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());

  const handleSubmit = () => {
    if (!comment.trim()) return;
    const newComment: Comment = {
      id: Date.now().toString(),
      username: "b4by_4ngel_",
      avatar: "https://i.pravatar.cc/150?img=47",
      text: comment,
      timeAgo: "now",
      likes: 0,
    };
    setComments([newComment, ...comments]);
    setComment("");
  };

  const toggleCommentLike = (id: string) => {
    setLikedComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[90] bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 350 }}
            className="absolute bottom-0 left-0 right-0 max-h-[70vh] rounded-t-xl bg-background flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center py-2">
              <div className="h-[4px] w-10 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Title */}
            <div className="flex items-center justify-center px-4 pb-3 border-b border-border relative">
              <h3 className="text-[14px] font-bold text-foreground">Comments</h3>
              <button onClick={onClose} className="absolute right-4 active:scale-90 transition-transform">
                <X size={20} className="text-foreground" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {comments.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex gap-3"
                >
                  <img src={c.avatar} alt={c.username} className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-[13px] text-foreground">
                      <span className="font-semibold">{c.username}</span>{" "}
                      {c.text}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{c.timeAgo}</span>
                      <button className="font-semibold">{c.likes + (likedComments.has(c.id) ? 1 : 0)} likes</button>
                      <button className="font-semibold">Reply</button>
                    </div>
                  </div>
                  <button onClick={() => toggleCommentLike(c.id)} className="flex-shrink-0 mt-1 active:scale-75 transition-transform">
                    <Heart size={12} className={likedComments.has(c.id) ? "fill-[hsl(var(--ig-like))] text-[hsl(var(--ig-like))]" : "text-muted-foreground"} />
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Comment Input */}
            <div className="flex items-center gap-3 border-t border-border px-4 py-3">
              <img src="https://i.pravatar.cc/150?img=47" alt="You" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={`Add a comment for ${postUsername}...`}
                className="flex-1 h-9 border-none bg-transparent text-[13px] focus-visible:ring-0 px-0"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              <AnimatePresence>
                {comment.trim() && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={handleSubmit}
                    className="text-[hsl(var(--ig-blue))] font-semibold text-[14px]"
                  >
                    Post
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CommentsSheet;