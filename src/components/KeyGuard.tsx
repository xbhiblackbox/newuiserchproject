import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getDeviceFingerprint, clearAuthSession, getAuthSession } from "@/lib/auth";

export default function KeyGuard({ children }: { children: React.ReactNode }) {
    const navigate = useNavigate();
    const [isValidating, setIsValidating] = useState(true);
    const [isInitialCheck, setIsInitialCheck] = useState(true);
    const [failCount, setFailCount] = useState(0);

    const checkKey = useCallback(async () => {
        const session = getAuthSession();
        if (!session) {
            clearAuthSession();
            if (window.location.pathname !== "/") {
                window.location.href = "/"; // Force full reload to show login screen
            }
            return;
        }

        try {
            // Use existing fingerprint from session if possible for stability
            const currentFingerprint = session.deviceFingerprint || getDeviceFingerprint();

            const res = await fetch("/api/check-key-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    key: session.key,
                    deviceFingerprint: currentFingerprint
                }),
                // Add a timeout to prevent hanging on slow connections during recording
                signal: AbortSignal.timeout(10000)
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                // If it's a server error (500), don't logout easily.
                // Log only for explicit rejections (401/403/404) or if the server says invalid.
                if (res.status === 401 || res.status === 403 || res.status === 404 || data.valid === false) {
                    console.log("[KeyGuard] Key invalid or revoked, incrementing fail count.");
                    
                    // Require 2 consecutive failures to avoid logout on temporary network/server glitches
                    if (failCount >= 1) {
                        clearAuthSession();
                        window.location.href = "/";
                        return;
                    } else {
                        setFailCount(prev => prev + 1);
                    }
                } else {
                    console.log("[KeyGuard] Server error but not explicitly invalid. Staying logged in.");
                    setFailCount(0);
                }
            } else {
                setFailCount(0);
            }
        } catch (err) {
            console.log("[KeyGuard] Network error during validation. Staying logged in.", err);
        } finally {
            if (isInitialCheck) setIsInitialCheck(false);
            setIsValidating(false);
        }
    }, [failCount, isInitialCheck]);

    useEffect(() => {
        checkKey();

        // Check key status every 60 seconds (increased from 30s)
        const interval = setInterval(checkKey, 60000); 

        return () => {
            clearInterval(interval);
        };
    }, [checkKey]);

    if (isValidating && isInitialCheck) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-black/95 z-[9999]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-white/60 text-xs font-medium tracking-wide">Validating your access...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
