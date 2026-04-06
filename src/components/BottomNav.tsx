import { Search } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { currentUser } from "@/data/mockData";
import { useRef, useCallback, useState } from "react";

// Instagram Reels icon - rounded square with play triangle
const ReelsIcon = ({ size = 26, active = false }: { size?: number; active?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    {active ? (
      <>
        <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" stroke="none" />
        <polygon points="10,7.5 10,16.5 17,12" fill="hsl(var(--background))" stroke="none" />
      </>
    ) : (
      <>
        <rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <polygon points="10,7.5 10,16.5 17,12" fill="none" stroke="currentColor" strokeWidth="2" />
      </>
    )}
  </svg>
);

// Instagram Messenger/DM icon - paper plane style
const MessengerIcon = ({ size = 26, active = false }: { size?: number; active?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M21.39 2.97c.46-.46.06-1.24-.56-1.06L2.42 6.86c-.56.16-.6.95-.06 1.18l6.93 2.97 6.18-4.47c.24-.18.5.1.3.32l-4.47 6.18 2.97 6.93c.22.54 1.02.5 1.18-.06l4.94-18.41c.04-.14.02-.28-.04-.4l.04-.13z" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isReelsPage = location.pathname === "/reels";
  const isReelDetail = location.pathname.startsWith("/reel/");
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const msgLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgLongPressTriggered = useRef(false);
  const [msgCount, setMsgCount] = useState(() => {
    const saved = localStorage.getItem("msg-badge-count");
    return saved ? Number(saved) : 2;
  });

  const toggleTheme = useCallback(() => {
    const html = document.documentElement;
    const isDark = html.classList.contains("dark");
    html.classList.toggle("dark", !isDark);
    localStorage.setItem("theme", isDark ? "light" : "dark");
  }, []);

  // Hide bottom nav on reel detail page
  if (isReelDetail) return null;

  const tabs = [
    { path: "/", key: "home" },
    { path: "/reels", key: "reels" },
    { path: "/create", key: "create" },
    { path: "/search", key: "search" },
    { path: "/profile", key: "profile" },
  ];

  return (
    <nav className={cn(
      "fixed bottom-0 left-0 right-0 z-50 backdrop-blur-md transition-colors duration-200",
      isReelsPage
        ? "border-t border-white/10 bg-black/90"
        : "bg-background/95"
    )}>
      <div className="mx-auto flex max-w-lg items-center justify-around py-1">
        {tabs.map(({ path, key }) => {
          const isActive = location.pathname === path;
          const color = isActive
            ? isReelsPage ? "text-white" : "text-foreground"
            : isReelsPage ? "text-white/60" : "text-foreground";

          return (
            <motion.button
              key={path}
              whileTap={{ scale: 0.82 }}
              onClick={() => {
                if (key === "search" && longPressTriggered.current) return;
                if (key === "create" && msgLongPressTriggered.current) return;
                navigate(path);
              }}
              onPointerDown={key === "search" ? () => {
                longPressTriggered.current = false;
                longPressRef.current = setTimeout(() => {
                  longPressTriggered.current = true;
                  toggleTheme();
                }, 2000);
              } : key === "create" ? () => {
                msgLongPressTriggered.current = false;
                msgLongPressRef.current = setTimeout(() => {
                  msgLongPressTriggered.current = true;
                  const newCount = prompt("Enter message count:", String(msgCount));
                  if (newCount !== null && !isNaN(Number(newCount))) {
                    setMsgCount(Number(newCount));
                    localStorage.setItem("msg-badge-count", newCount);
                  }
                }, 2000);
              } : undefined}
              onPointerUp={key === "search" ? () => { if (longPressRef.current) clearTimeout(longPressRef.current); } : key === "create" ? () => { if (msgLongPressRef.current) clearTimeout(msgLongPressRef.current); } : undefined}
              onPointerLeave={key === "search" ? () => { if (longPressRef.current) clearTimeout(longPressRef.current); } : key === "create" ? () => { if (msgLongPressRef.current) clearTimeout(msgLongPressRef.current); } : undefined}
              className={cn("flex items-center justify-center p-2 transition-colors duration-150", color)}
              aria-label={key}
            >
              {key === "home" && (
                isActive ? (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <path d="M5 21a2 2 0 01-2-2v-7.59a2 2 0 01.65-1.48L11.3 3.7a1 1 0 011.4 0l7.65 6.23a2 2 0 01.65 1.48V19a2 2 0 01-2 2h-4a1 1 0 01-1-1v-4.5a2 2 0 00-4 0V20a1 1 0 01-1 1H5z" />
                  </svg>
                ) : (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 21a1 1 0 01-1-1V11.4L12 4.5L20 11.4V20a1 1 0 01-1 1h-4v-6.5a2 2 0 00-2-2h-2a2 2 0 00-2 2V21H5z" fill="hsl(var(--background))" />
                  </svg>
                )
              )}
              {key === "reels" && (
                <ReelsIcon size={26} active={isActive} />
              )}
              {key === "create" && (
                <div className="relative">
                  <MessengerIcon size={26} active={isActive} />
                  {msgCount > 0 && <span className="absolute -right-2 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[hsl(var(--ig-like))] px-1 text-[11px] font-bold text-white">{msgCount}</span>}
                </div>
              )}
              {key === "search" && (
                <Search size={26} strokeWidth={isActive ? 2.5 : 1.5} />
              )}
              {key === "profile" && (
                <div className="relative">
                  <div className={cn(
                    "h-[26px] w-[26px] rounded-full overflow-hidden transition-all duration-200",
                    isActive
                      ? isReelsPage ? "ring-[1.5px] ring-white" : "ring-[1.5px] ring-foreground"
                      : ""
                  )}>
                    <img src={currentUser.avatar} alt="Profile" className="h-full w-full object-cover" />
                  </div>
                  <span className="absolute -right-0.5 bottom-0 h-[8px] w-[8px] rounded-full bg-[hsl(var(--ig-like))] border border-background" />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;