import { Copy, Link, MessageCircle, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const shareContacts = [
  { name: "sarah_j", avatar: "https://i.pravatar.cc/150?img=1" },
  { name: "mike.design", avatar: "https://i.pravatar.cc/150?img=3" },
  { name: "priya_k", avatar: "https://i.pravatar.cc/150?img=5" },
  { name: "alex.dev", avatar: "https://i.pravatar.cc/150?img=7" },
  { name: "nina_art", avatar: "https://i.pravatar.cc/150?img=9" },
  { name: "raj_photo", avatar: "https://i.pravatar.cc/150?img=11" },
];

const shareOptions = [
  { icon: Link, label: "Copy link" },
  { icon: Send, label: "Share to..." },
  { icon: MessageCircle, label: "SMS" },
  { icon: Copy, label: "More" },
];

const ShareSheet = ({ isOpen, onClose }: ShareSheetProps) => {
  const handleShare = (label: string) => {
    toast.success(`${label} — shared!`);
    onClose();
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
            className="absolute bottom-0 left-0 right-0 rounded-t-xl bg-background pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center py-2">
              <div className="h-[4px] w-10 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Search contacts */}
            <div className="px-4 py-2">
              <div className="h-[36px] rounded-[10px] bg-secondary flex items-center px-3">
                <span className="text-[14px] text-muted-foreground">Search</span>
              </div>
            </div>

            {/* Contact circles - horizontal scroll */}
            <div className="flex gap-3 overflow-x-auto px-4 py-3 hide-scrollbar">
              {shareContacts.map((contact, i) => (
                <motion.button
                  key={contact.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => handleShare(contact.name)}
                  className="flex flex-col items-center gap-1.5 min-w-[64px] active:scale-95 transition-transform"
                >
                  <img src={contact.avatar} alt={contact.name} className="h-[56px] w-[56px] rounded-full object-cover" />
                  <span className="text-[11px] text-foreground max-w-[64px] truncate">{contact.name}</span>
                </motion.button>
              ))}
            </div>

            {/* Divider */}
            <div className="h-[0.5px] bg-border mx-4" />

            {/* Share options */}
            <div className="flex justify-around px-4 py-4">
              {shareOptions.map((opt, i) => (
                <motion.button
                  key={opt.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.04 }}
                  onClick={() => handleShare(opt.label)}
                  className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
                >
                  <div className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-secondary">
                    <opt.icon size={22} className="text-foreground" />
                  </div>
                  <span className="text-[11px] text-foreground">{opt.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShareSheet;