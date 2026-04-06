import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Anti-inspect protection disabled for Lovable preview compatibility

// Restore saved theme — default to dark
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "light") {
  document.documentElement.classList.remove("dark");
} else {
  document.documentElement.classList.add("dark");
  if (!savedTheme) localStorage.setItem("theme", "dark");
}

const shouldRegisterServiceWorker = import.meta.env.PROD;

const resetPreviewCaches = async () => {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
  }
};

const bootstrap = async () => {
  if ("serviceWorker" in navigator) {
    if (shouldRegisterServiceWorker) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    } else {
      await resetPreviewCaches();
    }
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
};

bootstrap();
