import { useState, useEffect } from "react";
import { X } from "lucide-react";

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed as standalone
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // Check if dismissed recently (12 hours)
    const dismissed = localStorage.getItem("install-dismissed");
    if (dismissed && Date.now() - parseInt(dismissed) < 43200000) return;

    // iOS detection
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isiOS);

    if (isiOS) {
      // Show iOS instructions after a delay
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android/Chrome install prompt
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 2000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Also show a manual prompt if beforeinstallprompt doesn't fire after 5s
    const fallbackTimer = setTimeout(() => {
      if (!deferredPrompt) {
        setShowPrompt(true);
      }
    }, 5000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        localStorage.setItem("install-dismissed", String(Date.now() + 999999999));
      }
      setDeferredPrompt(null);
    }
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("install-dismissed", Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-16 left-3 right-3 z-[9999] mx-auto max-w-lg animate-in slide-in-from-bottom duration-300">
      <div className="rounded-2xl bg-white dark:bg-[#262626] shadow-2xl border border-gray-100 dark:border-[#363636] p-4">
        <div className="flex items-start gap-3">
          <img src="/icon-192.png" alt="Instagram" className="w-12 h-12 rounded-xl shadow-md" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white text-[15px]">Install Instagram</h3>
            <p className="text-gray-500 dark:text-gray-400 text-[13px] mt-0.5">
              {isIOS
                ? "Tap the Share button ↗ then 'Add to Home Screen'"
                : "Install app for the best experience"}
            </p>
          </div>
          <button onClick={handleDismiss} className="p-1 text-gray-400 dark:text-gray-500 shrink-0">
            <X size={18} />
          </button>
        </div>
        {!isIOS && (
          <button
            onClick={handleInstall}
            className="w-full mt-3 py-2.5 rounded-xl bg-[#0095F6] hover:bg-[#0081d6] active:scale-[0.98] text-white font-semibold text-[14px] transition-all"
          >
            Install
          </button>
        )}
        {isIOS && (
          <div className="mt-3 flex items-center gap-2 bg-gray-50 dark:bg-[#1a1a1a] rounded-xl p-3">
            <div className="text-[24px]">⬆️</div>
            <div>
              <p className="text-[13px] font-medium text-gray-900 dark:text-white">Step 1: Tap Share button</p>
              <p className="text-[12px] text-gray-500 dark:text-gray-400">Step 2: Scroll & tap "Add to Home Screen"</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstallPrompt;
