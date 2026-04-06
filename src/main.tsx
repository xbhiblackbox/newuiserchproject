import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 🛡️ ANTI-INSPECT PROTECTION 🛡️
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("keydown", (e) => {
    if (e.key === "F12" || 
       (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
       (e.ctrlKey && e.key === "U")) {
        e.preventDefault();
        return false;
    }
});
setInterval(() => {
    const start = new Date().getTime();
    debugger; // Freezes if devtools is open
    const end = new Date().getTime();
    if (end - start > 100) {
        document.body.innerHTML = "Security Breach Detected.";
    }
}, 1000);

// Restore saved theme
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
