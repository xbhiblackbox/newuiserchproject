import { useState, useRef, useCallback } from "react";
import { ArrowLeft, ChevronRight, Settings, Check, History, GraduationCap, Lightbulb, Share2, TrendingUp, Presentation, Sparkles, Contact2, Gift, MessageSquareReply, ArrowUpRight } from "lucide-react";
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
    { label: "Branded content", icon: <Contact2 size={24} strokeWidth={1.5} /> },
    { label: "Partnership ads", icon: <Share2 size={24} strokeWidth={1.5} /> },
    { label: "Ad tools", icon: <TrendingUp size={24} strokeWidth={1.5} /> },
    { label: "Trial reels", icon: <Presentation size={24} strokeWidth={1.5} />, badge: "New" },
    { label: "Gifts", icon: <Gift size={24} strokeWidth={1.5} /> },
    { label: "Saved replies", icon: <MessageSquareReply size={24} strokeWidth={1.5} />, subtitle: "Save replies to common questions" },
  ];

  return (
    <div className="pb-24 min-h-screen bg-background select-none overflow-x-hidden relative text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-background">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/profile')} className="text-foreground">
            <ArrowLeft size={24} strokeWidth={1.8} />
          </button>
          <h1 className="text-[16px] font-semibold tracking-tight">Professional dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          {isEditing && (
            <button onClick={saveChanges} className="bg-[#0095f6] text-white p-1.5 rounded-full shadow-lg">
              <Check size={18} strokeWidth={3} />
            </button>
          )}
          <Settings size={24} strokeWidth={1.5} className="text-foreground" />
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
        <div className="px-4 pt-4 pb-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[15px] font-bold text-foreground">Insights</h2>
            {isEditing ? (
              <input 
                className="text-[13px] text-muted-foreground font-normal bg-secondary rounded px-2 py-0.5 outline-none text-right w-28" 
                value={data.dateRangeLabel} 
                onChange={e => updateField('dateRangeLabel', e.target.value)} 
              />
            ) : (
              <span className="text-[13px] text-muted-foreground font-normal">{data.dateRangeLabel}</span>
            )}
          </div>
          
          <div>
            {insightRows.map((row, i) => (
              <div key={row.field}>
                <div 
                  onClick={() => !isEditing && row.route && navigate(row.route)} 
                  className="flex justify-between items-center py-3.5 cursor-pointer"
                >
                  <span className="text-[14px] font-normal text-foreground">{row.label}</span>
                  <div className="flex items-center gap-1.5">
                    {row.hasArrow && !isEditing && (
                      <ArrowUpRight size={16} strokeWidth={2.5} className="text-green-500" />
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
                    <ChevronRight size={16} className="text-muted-foreground" strokeWidth={2} />
                  </div>
                </div>
                {i < insightRows.length - 1 && (
                  <div className="h-px bg-border/50" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="h-[6px] bg-secondary/40" />

        {/* Your tools Section */}
        <div className="px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[15px] font-bold text-foreground">Your tools</h2>
            <button className="text-[14px] text-[#0095f6] font-semibold">See all</button>
          </div>

          <div>
            {toolItems.map((tool, i) => (
              <div key={i} className="flex items-center gap-3.5 py-3">
                <div className="text-foreground/80 w-7 flex items-center justify-center">
                  {tool.icon}
                </div>
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[14px] font-normal text-foreground">{tool.label}</span>
                    {tool.subtitle && (
                      <span className="text-[12px] text-muted-foreground leading-tight mt-0.5 truncate">
                        {tool.subtitle}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    {tool.badge && (
                      <span className="bg-green-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                        {tool.badge}
                      </span>
                    )}
                    <ChevronRight size={16} className="text-muted-foreground" strokeWidth={2} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-[6px] bg-secondary/40" />

        {/* Tips and resources */}
        <div className="px-4 py-4">
          <h2 className="text-[15px] font-bold text-foreground mb-4">Tips and resources</h2>
          <div className="flex items-center gap-3.5 py-3">
            <div className="text-foreground/80 w-7 flex items-center justify-center">
              <TrendingUp size={24} strokeWidth={1.5} />
            </div>
            <div className="flex-1 flex items-center justify-between">
              <span className="text-[14px] font-normal text-foreground">Trending audio</span>
              <ChevronRight size={16} className="text-muted-foreground" strokeWidth={2} />
            </div>
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
