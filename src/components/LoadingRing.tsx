import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LoadingRing = () => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
        >
          <div className="relative h-10 w-10">
            <svg
              className="animate-spin"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="20"
                cy="20"
                r="17"
                stroke="hsl(var(--border))"
                strokeWidth="3"
              />
              <path
                d="M20 3a17 17 0 0 1 17 17"
                stroke="url(#ig-ring-gradient)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="ig-ring-gradient" x1="20" y1="3" x2="37" y2="20" gradientUnits="userSpaceOnUse">
                  <stop stopColor="hsl(280, 70%, 50%)" />
                  <stop offset="0.5" stopColor="hsl(350, 80%, 55%)" />
                  <stop offset="1" stopColor="hsl(37, 97%, 55%)" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingRing;
