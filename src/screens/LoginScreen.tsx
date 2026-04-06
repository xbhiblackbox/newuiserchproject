import { useState, useEffect } from "react";
import { KeyRound, ArrowRight, Smartphone, AlertTriangle } from "lucide-react";
import { validateAndLogin, getDeviceFingerprint, getYoutubeUrl } from "@/lib/auth";

interface LoginScreenProps {
    onLoginSuccess: () => void;
}

const LoginScreen = ({ onLoginSuccess }: LoginScreenProps) => {
    const [key, setKey] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [deviceId, setDeviceId] = useState("");
    const [ytUrl, setYtUrl] = useState("https://www.youtube.com/embed/pYfpNRmoRC0?rel=0&modestbranding=1&showinfo=0");

    useEffect(() => {
        setDeviceId(getDeviceFingerprint());
        getYoutubeUrl().then(setYtUrl);
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
        <div className="fixed inset-0 z-[99999] overflow-y-auto" style={{ background: "linear-gradient(180deg, #fafafa 0%, #f0f0f0 100%)" }}>
            {/* Scrollable content */}
            <div className="min-h-full flex flex-col items-center px-4 py-6 pb-10">

                {/* ── Instagram-style Logo ── */}
                <div className="flex flex-col items-center mb-5 mt-2">
                    <div className="w-[72px] h-[72px] rounded-[22px] flex items-center justify-center mb-3" style={{ background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)" }}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="5" />
                            <circle cx="12" cy="12" r="5" />
                            <circle cx="17.5" cy="6.5" r="1.2" fill="white" stroke="none" />
                        </svg>
                    </div>
                    <h1 style={{ fontFamily: "'Segoe UI', -apple-system, sans-serif", fontSize: "24px", fontWeight: 700, color: "#262626", letterSpacing: "-0.5px" }}>
                        DarkSideX
                    </h1>
                    <p style={{ fontSize: "13px", color: "#8e8e8e", marginTop: "2px", fontWeight: 400 }}>
                        Premium Instagram Insights Tool
                    </p>
                </div>

                {/* ── Embedded Video ── */}
                <div className="w-full max-w-md mb-5">
                    <div style={{
                        borderRadius: "12px",
                        overflow: "hidden",
                        border: "1px solid #dbdbdb",
                        background: "#000",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
                    }}>
                        <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%" }}>
                            <iframe
                                src={ytUrl}
                                title="DarkSideX Demo"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                            />
                        </div>
                    </div>
                    <p style={{ textAlign: "center", fontSize: "11px", color: "#8e8e8e", marginTop: "8px" }}>
                        Watch demo to see all features ▶
                    </p>
                </div>

                {/* ── Access Key Card (IG style) ── */}
                <div className="w-full max-w-md">
                    <div style={{
                        background: "#ffffff",
                        border: "1px solid #dbdbdb",
                        borderRadius: "12px",
                        padding: "24px 20px 20px",
                    }}>
                        {/* Title */}
                        <div style={{ textAlign: "center", marginBottom: "16px" }}>
                            <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#262626", marginBottom: "4px" }}>
                                Enter Access Key
                            </h2>
                            <p style={{ fontSize: "12px", color: "#8e8e8e" }}>
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
                                placeholder="Enter password or access key"

                                autoComplete="off"
                                spellCheck={false}
                                autoFocus
                                style={{
                                    width: "100%",
                                    padding: "12px 14px",
                                    borderRadius: "8px",
                                    border: "1px solid #dbdbdb",
                                    background: "#fafafa",
                                    fontSize: "15px",
                                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                                    letterSpacing: "2.5px",
                                    color: "#262626",
                                    outline: "none",
                                    textAlign: "center",
                                    transition: "border-color 0.2s",
                                }}
                                onFocus={(e) => e.target.style.borderColor = "#a8a8a8"}
                                onBlur={(e) => e.target.style.borderColor = "#dbdbdb"}
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

                        {/* Login Button - IG blue */}
                        <button
                            onClick={handleLogin}
                            disabled={loading || !key.trim()}
                            style={{
                                width: "100%",
                                padding: "12px",
                                borderRadius: "10px",
                                border: "none",
                                background: loading || !key.trim() ? "rgba(0,149,246,0.3)" : "#0095f6",
                                color: "#ffffff",
                                fontSize: "14px",
                                fontWeight: 600,
                                cursor: loading || !key.trim() ? "default" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "8px",
                                transition: "all 0.2s",
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
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>

                        {/* Divider */}
                        <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "16px 0" }}>
                            <div style={{ flex: 1, height: "1px", background: "#dbdbdb" }} />
                            <span style={{ fontSize: "12px", color: "#8e8e8e", fontWeight: 600 }}>OR</span>
                            <div style={{ flex: 1, height: "1px", background: "#dbdbdb" }} />
                        </div>

                        {/* Device ID */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "11px", color: "#8e8e8e" }}>
                            <Smartphone size={12} />
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
                            gap: "12px",
                            width: "100%",
                            padding: "14px 16px",
                            borderRadius: "12px",
                            background: "#ffffff",
                            border: "1px solid #dbdbdb",
                            textDecoration: "none",
                            transition: "all 0.2s",
                        }}
                    >
                        {/* TG Icon */}
                        <div style={{
                            width: "40px", height: "40px", borderRadius: "12px",
                            background: "linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                        }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                            </svg>
                        </div>

                        {/* Text */}
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: "13px", fontWeight: 600, color: "#262626" }}>
                                Don't have a key?
                            </p>
                            <p style={{ fontSize: "11px", color: "#0095f6", marginTop: "1px", fontWeight: 500 }}>
                                Get instant access via Telegram →
                            </p>
                        </div>

                        <ArrowRight size={16} style={{ color: "#c7c7c7", flexShrink: 0 }} />
                    </a>
                </div>

                {/* ── Pricing Pills ── */}
                <div style={{
                    display: "flex", flexWrap: "wrap" as const, justifyContent: "center",
                    gap: "6px", marginTop: "16px", maxWidth: "400px"
                }}>
                    {[
                        { icon: "🎟️", text: "24h — $1" },
                        { icon: "⚡", text: "7d — $5" },
                        { icon: "🔥", text: "30d — $20" },
                        { icon: "👑", text: "Lifetime — $49" },
                    ].map((p) => (
                        <span key={p.text} style={{
                            padding: "4px 10px", borderRadius: "20px",
                            background: "#ffffff", border: "1px solid #efefef",
                            fontSize: "11px", color: "#8e8e8e",
                            display: "flex", alignItems: "center", gap: "4px"
                        }}>
                            {p.icon} {p.text}
                        </span>
                    ))}
                </div>

                {/* ── Footer ── */}
                <div style={{
                    marginTop: "20px", display: "flex", alignItems: "center",
                    gap: "12px", fontSize: "11px", color: "#c7c7c7",
                }}>
                    <span>🔒 Encrypted</span>
                    <span style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#dbdbdb" }} />
                    <span>⚡ Instant</span>
                    <span style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#dbdbdb" }} />
                    <span>🛡️ 1-Device</span>
                </div>

                <p style={{ marginTop: "12px", fontSize: "11px", color: "#c7c7c7" }}>
                    from <span style={{ fontWeight: 600 }}>DarkSideX</span>
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
