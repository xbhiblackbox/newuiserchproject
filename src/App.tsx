import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import InstallGate from "@/components/InstallGate";
import SplashScreen from "@/components/SplashScreen";
import LoginScreen from "@/screens/LoginScreen";
import { useState, useCallback, useEffect } from "react";
import { isAuthenticated } from "@/lib/auth";
import KeyGuard from "@/components/KeyGuard";
import HomeScreen from "@/screens/HomeScreen";
import SearchScreen from "@/screens/SearchScreen";
import MessagesScreen from "@/screens/MessagesScreen";
import ReelsScreen from "@/screens/ReelsScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import AnalyticsScreen from "@/screens/AnalyticsScreen";
import ReelInsightsScreen from "@/screens/ReelInsightsScreen";
import ReelDetailScreen from "@/screens/ReelDetailScreen";
import ViewsDetailScreen from "@/screens/ViewsDetailScreen";
import InteractionsDetailScreen from "@/screens/InteractionsDetailScreen";
import FollowersDetailScreen from "@/screens/FollowersDetailScreen";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Layout wrapper that conditionally shows BottomNav
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const hideBottomNav = location.pathname.startsWith("/reel-insights/");
  return (
    <div className="mx-auto max-w-lg min-h-screen bg-background">
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
            {/* Direct access for APK - Auth required, but NO InstallGate */}
            <Route
              path="*"
              element={
                !authed ? (
                  <LoginScreen onLoginSuccess={handleLoginSuccess} />
                ) : (
                  <>
                    {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
                    {showSplash && <div className="fixed inset-0 z-[9998] bg-white" />}
                    <AppLayout>
                      <KeyGuard>
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
                          <Route path="/reel-insights/:id" element={<ReelInsightsScreen />} />
                          <Route path="/reel/:id" element={<ReelDetailScreen />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
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
