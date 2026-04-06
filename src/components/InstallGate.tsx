import { useState, useEffect } from "react";

const InstallGate = ({ children }: { children: React.ReactNode }) => {
  const [isInstalled, setIsInstalled] = useState(true); // default true to avoid flash
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    
    // Also allow in development / Lovable preview
    const isPreview = window.location.hostname.includes("lovable") || 
                      window.location.hostname === "localhost" ||
                      window.location.hostname === "127.0.0.1";

    setIsInstalled(standalone || isPreview);
    setChecking(false);

    if (!standalone && !isPreview) {
      const ua = navigator.userAgent;
      setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

      const handler = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
  };

  if (checking) return null;
  if (isInstalled) return <>{children}</>;

  // Full-screen install gate
  return (
    <div className="fixed inset-0 z-[99999] bg-white dark:bg-black flex flex-col items-center justify-center px-6">
      {/* Instagram Logo */}
      <div className="mb-8">
        <img src="/icon-192.png" alt="Instagram" className="w-20 h-20 rounded-[22px] shadow-lg" />
      </div>

      <h1 className="text-[22px] font-bold text-gray-900 dark:text-white mb-2 text-center">
        Instagram
      </h1>
      <p className="text-[14px] text-gray-500 dark:text-gray-400 text-center mb-8 max-w-[280px] leading-relaxed">
        Install the app to continue. Get the full experience with faster loading and offline access.
      </p>

      {/* Android install button */}
      {!isIOS && deferredPrompt && (
        <button
          onClick={handleInstall}
          className="w-full max-w-[300px] py-3.5 rounded-xl bg-[#0095F6] active:bg-[#0081d6] active:scale-[0.97] text-white font-semibold text-[15px] transition-all shadow-lg shadow-blue-500/25"
        >
          Install App
        </button>
      )}

      {/* Android - no prompt available yet */}
      {!isIOS && !deferredPrompt && (
        <div className="w-full max-w-[300px] space-y-4">
          <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-xl p-4 space-y-3">
            <p className="text-[13px] font-semibold text-gray-900 dark:text-white">How to install:</p>
            <div className="flex items-start gap-3">
              <span className="text-[13px] font-bold text-[#0095F6] shrink-0">1.</span>
              <p className="text-[13px] text-gray-600 dark:text-gray-300">Tap the <strong>⋮</strong> menu button in your browser</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[13px] font-bold text-[#0095F6] shrink-0">2.</span>
              <p className="text-[13px] text-gray-600 dark:text-gray-300">Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[13px] font-bold text-[#0095F6] shrink-0">3.</span>
              <p className="text-[13px] text-gray-600 dark:text-gray-300">Open from your home screen</p>
            </div>
          </div>
        </div>
      )}

      {/* iOS instructions */}
      {isIOS && (
        <div className="w-full max-w-[300px] space-y-4">
          <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-xl p-4 space-y-3">
            <p className="text-[13px] font-semibold text-gray-900 dark:text-white">How to install:</p>
            <div className="flex items-start gap-3">
              <span className="text-[20px] shrink-0">⬆️</span>
              <p className="text-[13px] text-gray-600 dark:text-gray-300">Tap the <strong>Share</strong> button at the bottom of Safari</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[20px] shrink-0">➕</span>
              <p className="text-[13px] text-gray-600 dark:text-gray-300">Scroll down and tap <strong>"Add to Home Screen"</strong></p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[20px] shrink-0">📱</span>
              <p className="text-[13px] text-gray-600 dark:text-gray-300">Tap <strong>"Add"</strong> and open from home screen</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer branding */}
      <div className="absolute bottom-10 flex flex-col items-center gap-1">
        <span className="text-[13px] text-gray-400">from</span>
        <div className="flex items-center gap-1.5">
          <svg width="20" height="13" viewBox="0 0 100 64" fill="none">
            <defs>
              <linearGradient id="mg2" x1="0" y1="50" x2="100" y2="10" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0668E1"/>
                <stop offset="30%" stopColor="#E1306C"/>
                <stop offset="70%" stopColor="#FA7E1E"/>
                <stop offset="100%" stopColor="#FEDA75"/>
              </linearGradient>
            </defs>
            <path d="M22 4C11 4 2 18 2 32c0 14 9 28 20 28 7 0 12-5 18-14l10-16c6-9 11-14 18-14 11 0 20 10 20 28 0 14-9 24-20 24-7 0-12-5-18-14L40 38c-6-9-11-14-18-14" stroke="url(#mg2)" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[16px] font-bold text-[#E1306C]">Meta</span>
        </div>
      </div>
    </div>
  );
};

export default InstallGate;
