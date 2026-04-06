import { useState, useRef, useCallback } from "react";
import { ArrowLeft, ChevronDown, Check, Film, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface InteractionsData {
  interactions: number;
  followerPct: number;
  nonFollowerPct: number;
  dateRange: string;
  startDate: string;
  endDate: string;
  contentTypes: { name: string; followerPct: number; nonFollowerPct: number; total: number }[];
  breakdown: { label: string; value: string }[];
  topReels: { image: string; count: string; date: string }[];
}

const defaultData: InteractionsData = {
  interactions: 1356,
  followerPct: 36.2,
  nonFollowerPct: 63.8,
  dateRange: "Last 30 days",
  startDate: "10 Feb",
  endDate: "11 Mar",
  contentTypes: [
    { name: "Reels", followerPct: 34.2, nonFollowerPct: 60, total: 94.2 },
    { name: "Stories", followerPct: 2, nonFollowerPct: 3.8, total: 5.8 },
  ],
  breakdown: [
    { label: "Likes", value: "907" },
    { label: "Comments", value: "80" },
    { label: "Saves", value: "51" },
    { label: "Shares", value: "120" },
    { label: "Reposts", value: "77" },
  ],
  topReels: [
    { image: "https://images.unsplash.com/photo-1501432377862-3d0432b87a14?w=200&h=260&fit=crop", count: "257", date: "17 Feb" },
    { image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=260&fit=crop", count: "167", date: "1 Mar" },
    { image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=260&fit=crop", count: "162", date: "14 Feb" },
    { image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=260&fit=crop", count: "72", date: "12 Feb" },
  ],
};

const InteractionsDetailScreen = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<InteractionsData>(() => {
    const saved = localStorage.getItem("ig_interactions_detail_data_v2");
    return saved ? JSON.parse(saved) : defaultData;
  });
  const [isEditing, setIsEditing] = useState(false);
  const [contentTab, setContentTab] = useState("All");

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
    localStorage.setItem("ig_interactions_detail_data_v2", JSON.stringify(data));
    setIsEditing(false);
  };

  const updateField = (field: keyof InteractionsData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = (index: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
          const content = [...data.topReels];
          content[index] = { ...content[index], image: readerEvent.target?.result as string };
          updateField('topReels', content);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  return (
    <div className="pb-24 min-h-screen bg-background select-none overflow-x-hidden relative text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 h-[48px] bg-background">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/analytics')} className="text-foreground">
            <ArrowLeft size={24} strokeWidth={2} />
          </button>
          <h1 className="text-[17px] font-bold">Interactions</h1>
        </div>
        <div className="flex items-center gap-3">
          {isEditing && (
            <button onClick={saveChanges} className="bg-[#0095f6] text-white p-1.5 rounded-full shadow-lg">
              <Check size={18} strokeWidth={3} />
            </button>
          )}
          <div className="w-[24px] h-[24px] rounded-full border-[2px] border-foreground flex items-center justify-center">
            <span className="text-[13px] font-bold leading-none">i</span>
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
        {/* Date Selector Row */}
        <div className="flex items-center justify-between px-4 py-3">
          <button className="flex items-center gap-1 border border-border rounded-lg px-3 py-1.5 text-[13px] font-semibold text-foreground">
            {data.dateRange} <ChevronDown size={16} strokeWidth={2} />
          </button>
          <div className="text-[13px] font-semibold text-foreground flex items-center gap-1">
            {isEditing ? (
              <>
                <input className="w-12 bg-secondary rounded text-center outline-none text-foreground" value={data.startDate} onChange={e => updateField('startDate', e.target.value)} />
                <span>-</span>
                <input className="w-12 bg-secondary rounded text-center outline-none text-foreground" value={data.endDate} onChange={e => updateField('endDate', e.target.value)} />
              </>
            ) : (
              <span>{data.startDate} - {data.endDate}</span>
            )}
          </div>
        </div>

        <div className="h-px bg-border/60 mx-4" />

        {/* Donut Area */}
        <div className="flex justify-center py-8">
          <div className="relative w-[200px] h-[200px]">
            <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
              <circle cx="100" cy="100" r="80" fill="none" stroke="hsl(var(--secondary))" strokeWidth="10" />
              <circle cx="100" cy="100" r="80" fill="none" stroke="#B025C3" strokeWidth="12"
                strokeDasharray={`${(data.followerPct / 100) * 2 * Math.PI * 80} ${2 * Math.PI * 80}`}
                strokeLinecap="round" />
              <circle cx="100" cy="100" r="80" fill="none" stroke="#4B12C2" strokeWidth="12"
                strokeDasharray={`${(data.nonFollowerPct / 100) * 2 * Math.PI * 80} ${2 * Math.PI * 80}`}
                strokeDashoffset={`${-(data.followerPct / 100) * 2 * Math.PI * 80 - (2 * Math.PI * 80 * 0.005)}`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[12px] text-muted-foreground mb-0.5">Interactions</span>
              {isEditing ? (
                <input 
                  type="number"
                  value={data.interactions} 
                  onChange={e => updateField('interactions', parseInt(e.target.value) || 0)}
                  className="text-[28px] font-bold text-foreground bg-secondary rounded px-1 outline-none w-28 text-center"
                />
              ) : (
                <span className="text-[28px] font-bold text-foreground tracking-tight">{data.interactions.toLocaleString()}</span>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-4 space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-2 w-2 rounded-full bg-[#B025C3]" />
              <span className="text-[14px] text-foreground">Followers</span>
            </div>
            {isEditing ? (
              <input className="w-16 bg-secondary rounded text-right text-[14px] font-semibold outline-none text-foreground" value={data.followerPct} onChange={e => updateField('followerPct', parseFloat(e.target.value) || 0)} />
            ) : (
              <span className="text-[14px] text-foreground">{data.followerPct}%</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-2 w-2 rounded-full bg-[#4B12C2]" />
              <span className="text-[14px] text-foreground">Non-followers</span>
            </div>
            <span className="text-[14px] text-foreground">{data.nonFollowerPct}%</span>
          </div>
        </div>

        <div className="h-px bg-border/60 mx-4" />

        {/* By content type */}
        <div className="px-4 py-5">
          <h3 className="text-[15px] font-bold mb-4">By content type</h3>
          
          <div className="flex gap-2 mb-5">
            {["All", "Followers", "Non-followers"].map(t => (
              <button key={t} onClick={() => setContentTab(t)}
                className={cn("px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border transition-colors",
                  contentTab === t 
                    ? "bg-foreground text-background border-foreground" 
                    : "bg-transparent text-foreground border-border"
                )}>
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {data.contentTypes.map((type, i) => (
              <div key={type.name}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[13px] text-foreground">{type.name}</span>
                  <span className="text-[13px] font-semibold text-foreground">
                    {isEditing ? (
                      <input className="w-12 bg-secondary rounded text-right text-[13px] font-semibold outline-none text-foreground" value={type.total} onChange={e => {
                        const n = [...data.contentTypes]; n[i].total = parseFloat(e.target.value) || 0; updateField('contentTypes', n);
                      }} />
                    ) : `${type.total}%`}
                  </span>
                </div>
                <div className="h-[6px] w-full bg-secondary rounded-full flex overflow-hidden">
                  <div className="bg-[#B025C3]" style={{ width: `${type.followerPct}%` }} />
                  <div className="bg-[#4B12C2]" style={{ width: `${type.nonFollowerPct}%` }} />
                </div>
                {isEditing && (
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#B025C3]" />
                      <input className="w-12 bg-secondary rounded text-[11px] font-bold outline-none text-foreground" value={type.followerPct} onChange={e => {
                        const n = [...data.contentTypes]; n[i].followerPct = parseFloat(e.target.value) || 0; updateField('contentTypes', n);
                      }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#4B12C2]" />
                      <input className="w-12 bg-secondary rounded text-[11px] font-bold outline-none text-foreground" value={type.nonFollowerPct} onChange={e => {
                        const n = [...data.contentTypes]; n[i].nonFollowerPct = parseFloat(e.target.value) || 0; updateField('contentTypes', n);
                      }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-8 mt-5">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-[#B025C3]" />
              <span className="text-[11px] text-foreground">Followers</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-[#4B12C2]" />
              <span className="text-[11px] text-foreground">Non-followers</span>
            </div>
          </div>
        </div>

        <div className="h-px bg-border/60 mx-4" />

        {/* Stats List */}
        <div className="px-4 py-4 space-y-4">
          {data.breakdown.map((item, i) => (
            <div key={item.label} className="flex justify-between items-center h-[36px]">
              <span className="text-[14px] text-foreground">{item.label}</span>
              {isEditing ? (
                <input className="w-20 bg-secondary rounded text-right font-semibold text-[14px] outline-none text-foreground" value={item.value} onChange={e => {
                  const nb = [...data.breakdown]; nb[i].value = e.target.value; updateField('breakdown', nb);
                }} />
              ) : (
                <span className="text-[14px] font-semibold text-foreground">{item.value}</span>
              )}
            </div>
          ))}
        </div>

        <div className="h-px bg-border/60 mx-4" />

        {/* Top reels */}
        <div className="px-4 py-5">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-[15px] font-bold">Top reels</h3>
            <button className="text-[13px] text-[#0095f6] font-semibold">See All</button>
          </div>
          <p className="text-[11px] text-muted-foreground mb-4">Based on likes</p>

          <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-3">
            {data.topReels.map((reel, i) => (
              <div key={i} className="flex-shrink-0 w-[90px]">
                <div 
                  onClick={() => isEditing && handleImageUpload(i)}
                  className={cn("relative rounded-[8px] overflow-hidden aspect-[3/4] shadow-sm", isEditing && "cursor-pointer ring-2 ring-[#0095f6]")}
                >
                  <img src={reel.image} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-white/95 rounded-full px-2 py-0.5 flex items-center gap-1">
                    <Film size={9} fill="black" stroke="none" />
                    <span className="text-[10px] font-bold text-black">{reel.count}</span>
                  </div>
                  {isEditing && (
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1">
                      <input className="w-16 bg-white text-black rounded text-center text-[9px] font-bold outline-none py-0.5" onClick={e => e.stopPropagation()} value={reel.count} onChange={e => {
                        const nt = [...data.topReels]; nt[i].count = e.target.value; updateField('topReels', nt);
                      }} />
                      <div className="bg-white/90 p-1 rounded-full">
                        <Camera size={12} className="text-[#0095f6]" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-1.5 text-center">
                  {isEditing ? (
                    <input className="bg-secondary rounded text-[10px] w-full text-center outline-none text-foreground" value={reel.date} onChange={e => {
                      const nt = [...data.topReels]; nt[i].date = e.target.value; updateField('topReels', nt);
                    }} />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">{reel.date}</span>
                  )}
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

export default InteractionsDetailScreen;
