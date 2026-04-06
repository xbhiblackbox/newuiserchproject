import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowLeft, ChevronRight, Settings, Check, History, GraduationCap, Lightbulb, Share2, TrendingUp, Presentation, Sparkles, Contact2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface DashboardData {
  views: string;
  interactions: string;
  newFollowers: string;
  contentShared: string;
  dateRangeLabel: string; // e.g., "10 Feb-11 Mar"
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

  const toolItems = [
    { label: "Monthly recap", icon: <History size={24} />, badge: "New" },
    { label: "Best practices", icon: <GraduationCap size={24} /> },
    { label: "Inspiration", icon: <Lightbulb size={24} /> },
    { label: "Partnership ads", icon: <Share2 size={24} /> },
    { label: "Ad tools", icon: <TrendingUp size={24} /> },
    { label: "Trial reels", icon: <Presentation size={24} />, badge: "New" },
    { label: "Your Als", icon: <Sparkles size={24} /> },
    { label: "Branded content", icon: <Contact2 size={24} />, subtitle: "Partner with a brand or creator for your next post" },
  ];

  return (
    <div className="pb-24 min-h-screen bg-background select-none overflow-x-hidden relative text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-background border-b border-transparent">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/profile')} className="text-foreground">
            <ArrowLeft size={30} strokeWidth={2} />
          </button>
          <h1 className="text-[20px] font-bold tracking-tight">Professional dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          {isEditing && (
            <button onClick={saveChanges} className="bg-[#0095f6] text-white p-1.5 rounded-full shadow-lg">
              <Check size={20} strokeWidth={3} />
            </button>
          )}
          <Settings size={28} strokeWidth={1.8} className="text-foreground" />
        </div>
      </header>

      <div 
        className="pt-4"
        onTouchStart={startPress}
        onTouchEnd={endPress}
        onMouseDown={startPress}
        onMouseUp={endPress}
        onMouseLeave={endPress}
      >
        {/* Insights Section */}
        <div className="px-4 mb-8">
           <div className="flex justify-between items-center mb-6">
             <h2 className="text-[17px] font-bold text-foreground">Insights</h2>
             {isEditing ? (
                <input 
                  className="text-[13px] text-gray-500 font-medium bg-gray-100 rounded px-2 py-0.5 outline-none text-right" 
                  value={data.dateRangeLabel} 
                  onChange={e => updateField('dateRangeLabel', e.target.value)} 
                />
             ) : (
                <span className="text-[13px] text-gray-400 font-medium">{data.dateRangeLabel}</span>
             )}
           </div>
           
           <div className="space-y-7">
              <div onClick={() => !isEditing && navigate('/analytics/views')} className="flex justify-between items-center cursor-pointer">
                 <span className="text-[15px] font-medium">Views</span>
                 <div className="flex items-center gap-2">
                    {isEditing ? (
                      <input className="bg-gray-100 rounded px-2 py-0.5 w-20 text-right font-bold outline-none" value={data.views} onChange={e => updateField('views', e.target.value)} />
                    ) : (
                      <span className="text-[15px] font-bold">{data.views}</span>
                    )}
                    <ChevronRight size={20} className="text-gray-300" strokeWidth={2.5} />
                 </div>
              </div>

              <div onClick={() => !isEditing && navigate('/analytics/interactions')} className="flex justify-between items-center cursor-pointer">
                 <span className="text-[15px] font-medium">Interactions</span>
                 <div className="flex items-center gap-2">
                    {isEditing ? (
                      <input className="bg-gray-100 rounded px-2 py-0.5 w-20 text-right font-bold outline-none" value={data.interactions} onChange={e => updateField('interactions', e.target.value)} />
                    ) : (
                      <span className="text-[15px] font-bold">{data.interactions}</span>
                    )}
                    <ChevronRight size={20} className="text-gray-300" strokeWidth={2.5} />
                 </div>
              </div>

              <div onClick={() => !isEditing && navigate('/analytics/followers')} className="flex justify-between items-center cursor-pointer">
                 <span className="text-[15px] font-medium">New followers</span>
                 <div className="flex items-center gap-2">
                    {isEditing ? (
                      <input className="bg-gray-100 rounded px-2 py-0.5 w-20 text-right font-bold outline-none" value={data.newFollowers} onChange={e => updateField('newFollowers', e.target.value)} />
                    ) : (
                      <span className="text-[15px] font-bold">{data.newFollowers}</span>
                    )}
                    <ChevronRight size={20} className="text-gray-300" strokeWidth={2.5} />
                 </div>
              </div>

              <div className="flex justify-between items-center">
                 <span className="text-[15px] font-medium">Content you shared</span>
                 <div className="flex items-center gap-2">
                    {isEditing ? (
                      <input className="bg-gray-100 rounded px-2 py-0.5 w-20 text-right font-bold outline-none" value={data.contentShared} onChange={e => updateField('contentShared', e.target.value)} />
                    ) : (
                      <span className="text-[15px] font-bold">{data.contentShared}</span>
                    )}
                    <ChevronRight size={20} className="text-gray-300" strokeWidth={2.5} />
                 </div>
              </div>
           </div>
        </div>

        <div className="h-[0.5px] bg-gray-100 w-full" />

        {/* Your tools Section */}
        <div className="px-4 py-6">
           <div className="flex justify-between items-center mb-6">
              <h2 className="text-[17px] font-bold text-foreground">Your tools</h2>
              <button className="text-[14px] text-[#0095f6] font-bold">See all</button>
           </div>

           <div className="space-y-6">
              {toolItems.map((tool, i) => (
                <div key={i} className="flex items-center gap-4 group">
                   <div className="text-foreground">
                      {tool.icon}
                   </div>
                   <div className="flex-1 flex items-center justify-between">
                      <div className="flex flex-col">
                         <div className="flex items-center gap-2">
                           <span className="text-[16px] font-medium">{tool.label}</span>
                           {tool.badge && (
                              <span className="bg-[#4169E1] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                                {tool.badge}
                              </span>
                           )}
                         </div>
                         {tool.subtitle && (
                            <span className="text-[13px] text-gray-500 leading-tight mt-0.5">
                              {tool.subtitle}
                            </span>
                         )}
                      </div>
                      <ChevronRight size={20} className="text-muted-foreground" strokeWidth={2.5} />
                   </div>
                </div>
              ))}
           </div>
        </div>

        <div className="h-[0.5px] bg-secondary/30 w-full" />

        <div className="px-4 py-8">
           <h2 className="text-[17px] font-bold text-foreground">Tips and resources</h2>
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
              className="bg-[#0095f6] text-white font-bold py-3.5 px-12 rounded-full shadow-2xl active:scale-[0.98] flex items-center gap-2"
            >
              <Check size={20} strokeWidth={3} />
              SAVE CHANGES
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Shadow at bottom to match screenshot hint */}
      <div className="fixed bottom-0 left-0 right-0 h-2 bg-gradient-to-t from-gray-100/30 to-transparent pointer-events-none" />
    </div>
  );
};

export default AnalyticsScreen;
