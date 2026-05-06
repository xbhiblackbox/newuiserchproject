import { motion } from "framer-motion";

const LoadingRing = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background"
    >
      {/* Instagram-style logo wordmark */}
      <div
        className="text-[34px] leading-none"
        style={{
          fontFamily: '"Billabong", "Snell Roundhand", "Brush Script MT", cursive',
          background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Instagram
      </div>

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
            r="18"
            stroke="hsl(var(--border))"
            strokeWidth="2.5"
          />
          <path
            d="M20 2a18 18 0 0 1 18 18"
            stroke="hsl(var(--foreground))"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </motion.div>
  );
};

export default LoadingRing;
