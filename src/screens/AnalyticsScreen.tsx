import { useState, useRef, useCallback } from "react";
import { ArrowLeft, ChevronRight, Check, History, GraduationCap, Lightbulb, TrendingUp, Gift, ArrowUpRight, Link2, Tv, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

interface DashboardData {
  views: string;
  interactions: string;
  newFollowers: string;
  contentShared: string;
  dateRangeLabel: string;
}

const defaultData: DashboardData = {
  views: "11.6K",
  interactions: "1.4K",
  newFollowers: "54",
  contentShared: "14",
  dateRangeLabel: "10 Feb-11 Mar",
};

const AnalyticsScreen = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>(() => {
    const saved = localStorage.getItem("ig_dashboard_data_v2");
    return saved ? JSON.parse(saved) : defaultData;
  });

  const [isEditing, setIsEditing] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPress = useCallback(() => {
    if (isEditing) return;
    longPressTimer.current = setTimeout(() => {
      setIsEditing(true);
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    }, 2000);
  }, [isEditing]);

  const endPress = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const saveChanges = () => {
    localStorage.setItem("ig_dashboard_data_v2", JSON.stringify(data));
    setIsEditing(false);
  };

  const updateField = (field: keyof DashboardData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const insightRows = [
    { label: "Views", value: data.views, field: "views" as keyof DashboardData, hasArrow: true, route: "/analytics/views" },
    { label: "Interactions", value: data.interactions, field: "interactions" as keyof DashboardData, hasArrow: true, route: "/analytics/interactions" },
    { label: "New followers", value: data.newFollowers, field: "newFollowers" as keyof DashboardData, hasArrow: true, route: "/analytics/followers" },
    { label: "Content you shared", value: data.contentShared, field: "contentShared" as keyof DashboardData, hasArrow: false, route: null },
  ];

  const toolItems = [
    { label: "Monthly recap", icon: <History size={24} strokeWidth={1.5} />, badge: "New", subtitle: "See what you made happen last month." },
    { label: "Best practices", icon: <GraduationCap size={24} strokeWidth={1.5} /> },
    { label: "Inspiration", icon: <Lightbulb size={24} strokeWidth={1.5} /> },
    { label: "Branded content", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M7 21v-1a5 5 0 0 1 10 0v1"/></svg> },
    { label: "Partnership ads", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3"/><path d="M9 13c-3.31 0-6 2.69-6 6v1"/><circle cx="17" cy="8" r="2.5"/><path d="M17 13c2.76 0 5 2.24 5 5v1"/></svg> },
    { label: "Ad tools", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 17 7 13 11 16 17 7 21 11"/></svg> },
    { label: "Trial reels", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="6" width="16" height="13" rx="2"/><line x1="8" y1="22" x2="8" y2="19"/><line x1="16" y1="22" x2="16" y2="19"/><line x1="7" y1="2" x2="9" y2="6"/><line x1="17" y1="2" x2="15" y2="6"/></svg>, badge: "New" },
    { label: "Gifts", icon: <Gift size={24} strokeWidth={1.5} /> },
    { label: "Saved replies", icon: <Send size={24} strokeWidth={1.5} />, subtitle: "Save replies to common questions" },
  ];

  const tipItems = [
    { label: "Trending audio", icon: <TrendingUp size={24} strokeWidth={1.5} /> },
    { label: "Other helpful resources", icon: <Link2 size={24} strokeWidth={1.5} /> },
  ];

  return (
    <div className="pb-24 min-h-screen bg-background select-none overflow-x-hidden relative text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 h-[48px] bg-background">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/profile')} className="text-foreground">
            <ArrowLeft size={24} strokeWidth={2} />
          </button>
          <h1 className="text-[17px] font-bold">Professional dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          {isEditing && (
            <button onClick={saveChanges} className="bg-[#0095f6] text-white p-1.5 rounded-full shadow-lg">
              <Check size={18} strokeWidth={3} />
            </button>
          )}
          <div className="w-[26px] h-[26px] flex items-center justify-center">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </div>
        </div>
      </header>

      <div 
        onTouchStart={startPress}
        onTouchEnd={endPress}
        onMouseDown={startPress}
        onMouseUp={endPress}
        onMouseLeave={endPress}
      >
        {/* Insights Section */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-[15px] font-bold text-foreground">Insights</h2>
            {isEditing ? (
              <input 
                className="text-[13px] text-muted-foreground bg-secondary rounded px-2 py-0.5 outline-none text-right w-28" 
                value={data.dateRangeLabel} 
                onChange={e => updateField('dateRangeLabel', e.target.value)} 
              />
            ) : (
              <span className="text-[13px] text-muted-foreground">{data.dateRangeLabel}</span>
            )}
          </div>
          
          {/* Thin line under insights header */}
          <div className="h-px bg-border/60 mb-1" />
          
          <div>
            {insightRows.map((row, i) => (
              <div 
                key={row.field}
                onClick={() => !isEditing && row.route && navigate(row.route)} 
                className="flex justify-between items-center h-[44px] cursor-pointer"
              >
                <span className="text-[14px] text-foreground">{row.label}</span>
                <div className="flex items-center gap-1">
                  {row.hasArrow && !isEditing && (
                    <ArrowUpRight size={15} strokeWidth={2.5} className="text-green-500" />
                  )}
                  {isEditing ? (
                    <input 
                      className="bg-secondary rounded px-2 py-0.5 w-20 text-right font-semibold text-[14px] outline-none text-foreground" 
                      value={row.value} 
                      onChange={e => updateField(row.field, e.target.value)} 
                    />
                  ) : (
                    <span className="text-[14px] font-semibold text-foreground">{row.value}</span>
                  )}
                  <ChevronRight size={15} className="text-muted-foreground/60" strokeWidth={2} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Thick separator */}
        <div className="h-[6px] bg-secondary/50" />

        {/* Your tools Section */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-[15px] font-bold text-foreground">Your tools</h2>
            <button className="text-[14px] text-[#0095f6] font-semibold">See all</button>
          </div>

          <div>
            {toolItems.map((tool, i) => (
              <div key={i} className="flex items-center gap-4 h-[52px]">
                <div className="text-foreground/70 w-[28px] flex items-center justify-center shrink-0">
                  {tool.icon}
                </div>
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[14px] text-foreground">{tool.label}</span>
                    {tool.subtitle && (
                      <span className="text-[12px] text-muted-foreground leading-tight mt-0.5 truncate">
                        {tool.subtitle}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    {tool.badge && (
                      <span className="bg-green-600 text-white text-[11px] font-bold px-2 py-[1px] rounded-full">
                        {tool.badge}
                      </span>
                    )}
                    <ChevronRight size={15} className="text-muted-foreground/60" strokeWidth={2} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Thick separator */}
        <div className="h-[6px] bg-secondary/50" />

        {/* Tips and resources */}
        <div className="px-4 pt-4 pb-6">
          <h2 className="text-[15px] font-bold text-foreground mb-2">Tips and resources</h2>
          <div>
            {tipItems.map((tip, i) => (
              <div key={i} className="flex items-center gap-4 h-[52px]">
                <div className="text-foreground/70 w-[28px] flex items-center justify-center shrink-0">
                  {tip.icon}
                </div>
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-[14px] text-foreground">{tip.label}</span>
                  <ChevronRight size={15} className="text-muted-foreground/60" strokeWidth={2} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isEditing && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-10 left-0 right-0 flex justify-center z-[60]"
          >
            <button 
              onClick={saveChanges}
              className="bg-[#0095f6] text-white font-bold py-3 px-10 rounded-full shadow-2xl active:scale-[0.98] flex items-center gap-2 text-[14px]"
            >
              <Check size={18} strokeWidth={3} />
              SAVE CHANGES
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AnalyticsScreen;
