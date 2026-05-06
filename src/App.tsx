import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import SplashScreen from "@/components/SplashScreen";
import LoginScreen from "@/screens/LoginScreen";
import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { isAuthenticated } from "@/lib/auth";
import KeyGuard from "@/components/KeyGuard";
import LoadingRing from "@/components/LoadingRing";
const HomeScreen = lazy(() => import("@/screens/HomeScreen"));
const SearchScreen = lazy(() => import("@/screens/SearchScreen"));
const MessagesScreen = lazy(() => import("@/screens/MessagesScreen"));
const ReelsScreen = lazy(() => import("@/screens/ReelsScreen"));
const ProfileScreen = lazy(() => import("@/screens/ProfileScreen"));
const AnalyticsScreen = lazy(() => import("@/screens/AnalyticsScreen"));
const ReelInsightsScreen = lazy(() => import("@/screens/ReelInsightsScreen"));
const ReelDetailScreen = lazy(() => import("@/screens/ReelDetailScreen"));
const ViewsDetailScreen = lazy(() => import("@/screens/ViewsDetailScreen"));
const InteractionsDetailScreen = lazy(() => import("@/screens/InteractionsDetailScreen"));
const FollowersDetailScreen = lazy(() => import("@/screens/FollowersDetailScreen"));
const CreatorSettingsScreen = lazy(() => import("@/screens/CreatorSettingsScreen"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Layout wrapper that conditionally shows BottomNav
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const hideBottomNav = location.pathname.startsWith("/reel-insights/") || location.pathname.startsWith("/analytics");
  const shellRef = useRef<HTMLDivElement>(null);
  const lastTouchY = useRef<number | null>(null);

  const scrollShellBy = useCallback((delta: number) => {
    const shell = shellRef.current;
    if (!shell || Math.abs(delta) < 1) return;
    shell.scrollTop += delta;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const y = e.touches[0]?.clientY;
    if (y == null || lastTouchY.current == null) return;
    scrollShellBy(lastTouchY.current - y);
    lastTouchY.current = y;
  }, [scrollShellBy]);

  return (
    <div
      ref={shellRef}
      className="mx-auto max-w-[430px] h-[100dvh] overflow-y-auto overscroll-contain bg-background relative shadow-2xl md:my-4 md:h-[calc(100dvh-2rem)] md:rounded-2xl md:border md:border-border/30"
      style={{ WebkitOverflowScrolling: "touch" }}
      onWheel={(e) => scrollShellBy(e.deltaY)}
      onTouchStart={(e) => { lastTouchY.current = e.touches[0]?.clientY ?? null; }}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => { lastTouchY.current = null; }}
      onTouchCancel={() => { lastTouchY.current = null; }}
    >
      <AnalyticsTracker />
      {children}
      {!hideBottomNav && <BottomNav />}
    </div>
  );
};

const App = () => {
  const [showSplash, setShowSplash] = useState(() => {
    return !sessionStorage.getItem("darksidex_splash_shown");
  });
  const [authed, setAuthed] = useState(() => isAuthenticated());
  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
    sessionStorage.setItem("darksidex_splash_shown", "true");
  }, []);

  useEffect(() => {
    if (!authed) {
      (window as any).__removeSplash?.();
    }
  }, [authed]);

  // Allow toggling dark mode via ?theme=dark or ?theme=light in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const theme = params.get("theme");
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (theme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      // Default: light mode. Clear any stale persisted dark setting.
      document.documentElement.classList.remove("dark");
      localStorage.removeItem("theme");
    }
  }, []);

  const handleLoginSuccess = () => {
    setAuthed(true);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route
              path="*"
              element={
                !authed ? (
                  <LoginScreen onLoginSuccess={handleLoginSuccess} />
                ) : (
                  <>
                    {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
                    {showSplash && <div className="fixed inset-0 z-[9998] bg-black" />}
                    <AppLayout>
                      <KeyGuard>
                        <Suspense fallback={<LoadingRing />}>
                        <Routes>
                          <Route path="/" element={<HomeScreen />} />
                          <Route path="/index" element={<HomeScreen />} />
                          <Route path="/search" element={<SearchScreen />} />
                          <Route path="/create" element={<MessagesScreen />} />
                          <Route path="/reels" element={<ReelsScreen />} />
                          <Route path="/profile" element={<ProfileScreen />} />
                          <Route path="/analytics" element={<AnalyticsScreen />} />
                          <Route path="/analytics/views" element={<ViewsDetailScreen />} />
                          <Route path="/analytics/interactions" element={<InteractionsDetailScreen />} />
                          <Route path="/analytics/followers" element={<FollowersDetailScreen />} />
                          <Route path="/analytics/settings" element={<CreatorSettingsScreen />} />
                          <Route path="/reel-insights/:id" element={<ReelInsightsScreen />} />
                          <Route path="/reel/:id" element={<ReelDetailScreen />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                        </Suspense>
                      </KeyGuard>
                    </AppLayout>
                  </>
                )
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
