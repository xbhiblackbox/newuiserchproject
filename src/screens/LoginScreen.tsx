import { useState, useEffect } from "react";
import { ArrowRight, Smartphone, AlertTriangle, Lock } from "lucide-react";
import { validateAndLogin, getDeviceFingerprint, getYoutubeUrl } from "@/lib/auth";

interface LoginScreenProps {
    onLoginSuccess: () => void;
}

const LoginScreen = ({ onLoginSuccess }: LoginScreenProps) => {
    const [key, setKey] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [deviceId, setDeviceId] = useState("");

    useEffect(() => {
        setDeviceId(getDeviceFingerprint());
    }, []);

    const handleKeyChange = (raw: string) => {
        setKey(raw);
        setError("");
    };

    const handleLogin = async () => {
        if (!key.trim()) {
            setError("Please enter your access key");
            return;
        }
        setLoading(true);
        setError("");
        await new Promise((r) => setTimeout(r, 800));
        const result = await validateAndLogin(key.trim());
        setLoading(false);
        if (result.success) {
            onLoginSuccess();
        } else {
            setError("error" in result ? result.error : "Login failed");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleLogin();
    };

    return (
        <div className="fixed inset-0 z-[99999] overflow-y-auto" style={{ background: "linear-gradient(180deg, #e6f0fb 0%, #d8e8f7 100%)" }}>
            {/* Scrollable content */}
            <div className="min-h-full flex flex-col items-center justify-center px-5 py-8">

                {/* ── Blue Instagram-style Logo ── */}
                <div className="flex flex-col items-center mb-6">
                    <div className="w-[78px] h-[78px] rounded-[20px] flex items-center justify-center mb-5" style={{ background: "#1877f2", boxShadow: "0 8px 24px rgba(24,119,242,0.25)" }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="5" />
                            <circle cx="12" cy="12" r="5" />
                            <circle cx="17.5" cy="6.5" r="1.2" fill="white" stroke="none" />
                        </svg>
                    </div>
                    <h1 style={{ fontFamily: "'Segoe UI', -apple-system, sans-serif", fontSize: "32px", fontWeight: 800, color: "#0a2540", letterSpacing: "-0.5px" }}>
                        Real Insights
                    </h1>
                    <p style={{ fontSize: "12px", color: "#1877f2", marginTop: "6px", fontWeight: 700, letterSpacing: "2px" }}>
                        PREMIUM INSIGHTS TOOL
                    </p>
                </div>

                {/* ── Access Key Card (IG style) ── */}
                <div className="w-full max-w-md">
                    <div style={{
                        background: "#ffffff",
                        border: "1px solid #e6eef7",
                        borderRadius: "16px",
                        padding: "28px 24px 24px",
                        boxShadow: "0 4px 16px rgba(10,37,64,0.04)",
                    }}>
                        {/* Lock icon */}
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
                            <div style={{
                                width: "48px", height: "48px", borderRadius: "12px",
                                background: "#e6f0fb", display: "flex",
                                alignItems: "center", justifyContent: "center",
                            }}>
                                <Lock size={22} color="#1877f2" strokeWidth={2.2} />
                            </div>
                        </div>
                        {/* Title */}
                        <div style={{ textAlign: "center", marginBottom: "20px" }}>
                            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0a2540", marginBottom: "4px" }}>
                                Enter Access Key
                            </h2>
                            <p style={{ fontSize: "13px", color: "#7b8a9b" }}>
                                Each key is locked to one device
                            </p>
                        </div>

                        {/* Key Input - IG style */}
                        <div style={{ position: "relative", marginBottom: "12px" }}>
                            <input
                                type="text"
                                value={key}
                                onChange={(e) => handleKeyChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="XXXX  -  XXXX  -  XXXX"

                                autoComplete="off"
                                spellCheck={false}
                                autoFocus
                                style={{
                                    width: "100%",
                                    padding: "16px 14px",
                                    borderRadius: "12px",
                                    border: "1.5px solid #1877f2",
                                    background: "#ffffff",
                                    fontSize: "16px",
                                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                                    letterSpacing: "3px",
                                    color: "#0a2540",
                                    outline: "none",
                                    textAlign: "center",
                                    transition: "border-color 0.2s",
                                }}
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "8px",
                                padding: "10px 12px",
                                borderRadius: "8px",
                                background: "#fff0f0",
                                border: "1px solid #ffdddd",
                                marginBottom: "12px",
                                fontSize: "12px",
                                color: "#ed4956",
                            }}>
                                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Login Button - light blue */}
                        <button
                            onClick={handleLogin}
                            disabled={loading || !key.trim()}
                            style={{
                                width: "100%",
                                padding: "16px",
                                borderRadius: "12px",
                                border: "none",
                                background: loading || !key.trim() ? "#bcd7f5" : "#7eb6ee",
                                color: "#ffffff",
                                fontSize: "16px",
                                fontWeight: 700,
                                cursor: loading || !key.trim() ? "default" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "8px",
                                transition: "all 0.2s",
                                marginTop: "4px",
                            }}
                        >
                            {loading ? (
                                <div style={{
                                    width: "18px", height: "18px",
                                    border: "2px solid rgba(255,255,255,0.3)",
                                    borderTopColor: "white",
                                    borderRadius: "50%",
                                    animation: "spin 0.6s linear infinite"
                                }} />
                            ) : (
                                <>
                                    Log In
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>

                        {/* Divider */}
                        <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "20px 0 16px" }}>
                            <div style={{ flex: 1, height: "1px", background: "#e6eef7" }} />
                            <span style={{ fontSize: "12px", color: "#7b8a9b", fontWeight: 600 }}>OR</span>
                            <div style={{ flex: 1, height: "1px", background: "#e6eef7" }} />
                        </div>

                        {/* Device ID */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px", color: "#7b8a9b" }}>
                            <Smartphone size={14} />
                            <span>Device: {deviceId}</span>
                        </div>
                    </div>
                </div>

                {/* ── Get Key CTA ── */}
                <div className="w-full max-w-md" style={{ marginTop: "16px" }}>
                    <a
                        href="https://t.me/whopcampaign"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "14px",
                            width: "100%",
                            padding: "16px 18px",
                            borderRadius: "16px",
                            background: "#ffffff",
                            border: "1px solid #e6eef7",
                            textDecoration: "none",
                            transition: "all 0.2s",
                            boxShadow: "0 4px 16px rgba(10,37,64,0.04)",
                        }}
                    >
                        {/* TG Icon */}
                        <div style={{
                            width: "44px", height: "44px", borderRadius: "12px",
                            background: "linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                        }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                            </svg>
                        </div>

                        {/* Text */}
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: "15px", fontWeight: 700, color: "#0a2540" }}>
                                Don't have a key?
                            </p>
                            <p style={{ fontSize: "13px", color: "#1877f2", marginTop: "2px", fontWeight: 500 }}>
                                Get instant access via Telegram →
                            </p>
                        </div>

                        <ArrowRight size={18} style={{ color: "#7b8a9b", flexShrink: 0 }} />
                    </a>
                </div>

                {/* ── Footer ── */}
                <div style={{
                    marginTop: "28px", display: "flex", alignItems: "center",
                    gap: "14px", fontSize: "12px", color: "#7b8a9b",
                }}>
                    <span>🔒 Encrypted</span>
                    <span style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#bccad9" }} />
                    <span>⚡ Instant</span>
                    <span style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#bccad9" }} />
                    <span>🛡️ 1-Device</span>
                </div>

                <p style={{ marginTop: "10px", fontSize: "12px", color: "#7b8a9b" }}>
                    from <span style={{ fontWeight: 700, color: "#0a2540" }}>Real Insights</span>
                </p>

            </div>

            {/* Spin animation */}
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default LoginScreen;
