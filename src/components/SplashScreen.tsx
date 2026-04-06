import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import igIcon from "@/assets/instagram-icon.png";
import fromMeta from "@/assets/from-meta.png";

const SplashScreen = ({ onFinish }: { onFinish: () => void }) => {
  const [visible, setVisible] = useState(true);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    // Remove HTML splash if exists
    (window as any).__removeSplash?.();
    
    const timer = setTimeout(() => {
      setVisible(false);
      onFinishRef.current();
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ background: "#ffffff" }}
        >
          {/* Instagram gradient outline icon */}
          <motion.div
            initial={{ scale: 1, opacity: 1 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <img src={igIcon} alt="Instagram" width={80} height={80} />
          </motion.div>

          {/* "from Meta" */}
          <div className="absolute bottom-10 flex flex-col items-center gap-0.5">
            <span style={{ fontSize: 15, color: '#a8a8a8', fontWeight: 400, fontFamily: '-apple-system, Helvetica Neue, Arial, sans-serif', letterSpacing: 0.2 }}>from</span>
            <div className="flex items-center gap-1.5">
              <svg width="24" height="16" viewBox="0 0 100 64" fill="none">
                <defs>
                  <linearGradient id="meta-g" x1="0" y1="50" x2="100" y2="10" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#0668E1" />
                    <stop offset="30%" stopColor="#E1306C" />
                    <stop offset="70%" stopColor="#FA7E1E" />
                    <stop offset="100%" stopColor="#FEDA75" />
                  </linearGradient>
                </defs>
                <path d="M22 4C11 4 2 18 2 32c0 14 9 28 20 28 7 0 12-5 18-14l10-16c6-9 11-14 18-14 11 0 20 10 20 28 0 14-9 24-20 24-7 0-12-5-18-14L40 38c-6-9-11-14-18-14" stroke="url(#meta-g)" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#E1306C', letterSpacing: 0.3, fontFamily: '-apple-system, Helvetica Neue, Arial, sans-serif' }}>Meta</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
