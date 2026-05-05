import { useEffect, useRef } from "react";
import { getDeviceFingerprint, clearAuthSession, getAuthSession } from "@/lib/auth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function KeyGuard({ children }: { children: React.ReactNode }) {
    const failCountRef = useRef(0);

    useEffect(() => {
        let mounted = true;

        const checkKey = async () => {
            const session = getAuthSession();
            if (!session) {
                clearAuthSession();
                if (window.location.pathname !== "/") {
                    window.location.href = "/";
                }
                return;
            }

            try {
                const currentFingerprint = session.deviceFingerprint || getDeviceFingerprint();

                const res = await fetch(`${SUPABASE_URL}/functions/v1/check-key-status`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({
                        key: session.key,
                        deviceFingerprint: currentFingerprint
                    }),
                    signal: AbortSignal.timeout(15000)
                });

                const data = await res.json().catch(() => ({}));

                if (!mounted) return;

                if (!res.ok) {
                    // Key revoked/expired/invalid — logout immediately
                    if (res.status === 401 || res.status === 403 || res.status === 404 || data.valid === false) {
                        console.log("[KeyGuard] Key rejected — logging out immediately");
                        clearAuthSession();
                        window.location.href = "/";
                        return;
                    } else {
                        // Server error — don't logout
                        console.log("[KeyGuard] Server error, staying logged in.");
                    }
                }
            } catch (err) {
                // Network error — never logout
                console.log("[KeyGuard] Network error, staying logged in.", err);
            }
        };

        checkKey();

        // Check every 2 minutes instead of 60s to reduce unnecessary calls
        const interval = setInterval(checkKey, 30000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []); // No dependencies — stable interval

    return <>{children}</>;
}