import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import SplashScreen from "@/components/SplashScreen";
import LoginScreen from "@/screens/LoginScreen";
import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { isAuthenticated } from "@/lib/auth";
import KeyGuard from "@/components/KeyGuard";
import HomeScreen from "@/screens/HomeScreen";
import NotFound from "./pages/NotFound";

// Lazy load heavy screens
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

const queryClient = new QueryClient();

const LazyFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

// Layout wrapper that conditionally shows BottomNav
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const hideBottomNav = location.pathname.startsWith("/reel-insights/") || location.pathname.startsWith("/analytics");
  return (
    <div className="mx-auto max-w-[430px] min-h-screen bg-background relative shadow-2xl md:my-4 md:rounded-2xl md:min-h-[calc(100vh-2rem)] md:overflow-hidden md:border md:border-border/30">
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
                        <Suspense fallback={<LazyFallback />}>
                          <Routes>
                            <Route path="/" element={<HomeScreen />} />
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
