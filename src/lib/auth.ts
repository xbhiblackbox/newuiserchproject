/**
 * Simplified Authentication & License Key System
 * Uses custom Edge Function for strict validation.
 */

const AUTH_STORAGE_KEY = "darksidex_auth_session";

// ==================== DEVICE FINGERPRINT ====================
const DEVICE_ID_KEY = "darksidex_device_id";

export function getDeviceFingerprint(): string {
    // Check if we already have a persistent ID on this device/browser
    const existingId = localStorage.getItem(DEVICE_ID_KEY);
    if (existingId) return existingId;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
        ctx.textBaseline = "top";
        ctx.font = "14px Arial";
        ctx.fillText("fingerprint", 2, 2);
    }
    const canvasHash = canvas.toDataURL().slice(-50);

    const components = [
        navigator.userAgent,
        navigator.language,
        screen.width + "x" + screen.height,
        screen.colorDepth.toString(),
        new Date().getTimezoneOffset().toString(),
        navigator.hardwareConcurrency?.toString() || "0",
        (navigator as any).deviceMemory?.toString() || "0",
        navigator.platform || "",
        canvasHash,
    ];

    let hash = 0;
    const str = components.join("|");
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    const newId = "DX-" + Math.abs(hash).toString(36).toUpperCase().padStart(8, "0");
    
    // Store it permanently on this browser
    localStorage.setItem(DEVICE_ID_KEY, newId);
    
    return newId;
}

// ==================== SESSION MANAGEMENT ====================

interface AuthSession {
    key: string;
    deviceFingerprint: string;
    loginAt: string;
}

export function getAuthSession(): AuthSession | null {
    try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function saveAuthSession(session: AuthSession) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
}

// ==================== LOGIN VALIDATION ====================

export type LoginResult =
    | { success: true }
    | { success: false; error: string };

export async function validateAndLogin(accessKey: string): Promise<LoginResult> {
    const normalizedKey = accessKey.trim();

    if (!normalizedKey) {
        return { success: false, error: "Please enter your access key." };
    }

    try {
        const deviceFP = getDeviceFingerprint();

        const result = await fetch("/api/check-key-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                key: normalizedKey,
                deviceFingerprint: deviceFP,
            }),
        });

        const data = await result.json();

        if (result.ok && data.valid) {
            saveAuthSession({
                key: normalizedKey,
                deviceFingerprint: deviceFP,
                loginAt: new Date().toISOString(),
            });

            // --- Telegram Login Alert ---
            try {
                let ipInfo = { ip: "Unknown", city: "Unknown", country_name: "Unknown" };
                try {
                    const geoRes = await fetch("https://ipapi.co/json/");
                    if (geoRes.ok) ipInfo = await geoRes.json();
                } catch (e) {
                    console.log("Could not fetch location", e);
                }

                const label = data.label || "User";
                const timeStr = new Date().toLocaleString();

                const message = `🔓 <b>New Login Alert!</b>
────────────────
📦 <b>User:</b> ${label}
🔑 <b>Key:</b> <code>${normalizedKey}</code>
📍 <b>Location:</b> ${ipInfo.city}, ${ipInfo.country_name}
🌐 <b>IP:</b> <a href="http://ip-api.com/#${ipInfo.ip}">${ipInfo.ip}</a>
📱 <b>Device:</b> <code>${deviceFP}</code>
⏱ <b>Time:</b> ${timeStr}
────────────────
Powered by DarkSideX 🚀`;

                await fetch("/api/telegram", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: message }),
                });
            } catch (alertErr) {
                console.error("Failed to send login alert:", alertErr);
            }
            // -----------------------------

            return { success: true };
        }

        return { success: false, error: data.error || "Login failed. Please try again." };
    } catch (err: any) {
        console.error("[Auth] Login error:", err);
        return { success: false, error: "Server error. Please try again." };
    }
}

export function isAuthenticated(): boolean {
    const session = getAuthSession();
    return !!session;
}

export async function isAuthenticatedAsync(): Promise<boolean> {
    return isAuthenticated(); // Handled by KeyGuard
}

export async function getYoutubeUrl(): Promise<string> {
    return "https://www.youtube.com/embed/pYfpNRmoRC0?rel=0&modestbranding=1&showinfo=0";
}
