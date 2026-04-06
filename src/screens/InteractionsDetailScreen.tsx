import { useState, useRef, useCallback } from "react";
import { ArrowLeft, ChevronDown, Check, Film, Camera, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import reelsIcon from "@/assets/reels-icon.png";

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
  interactions: 4094,
  followerPct: 0.8,
  nonFollowerPct: 99.2,
  dateRange: "Last 30 days",
  startDate: "7 Mar",
  endDate: "5 Apr",
  contentTypes: [
    { name: "Reels", followerPct: 0.8, nonFollowerPct: 99.1, total: 99.9 },
    { name: "Stories", followerPct: 0.1, nonFollowerPct: 0, total: 0.1 },
  ],
  breakdown: [
    { label: "Likes", value: "2,383" },
    { label: "Comments", value: "163" },
    { label: "Saves", value: "376" },
    { label: "Shares", value: "552" },
    { label: "Reposts", value: "68" },
  ],
  topReels: [
    { image: "https://images.unsplash.com/photo-1501432377862-3d0432b87a14?w=200&h=260&fit=crop", count: "310", date: "3 Apr" },
    { image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=260&fit=crop", count: "214", date: "16 Mar" },
    { image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=260&fit=crop", count: "149", date: "31 Mar" },
    { image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=260&fit=crop", count: "120", date: "16 Mar" },
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

  const formatCount = (n: number) => n.toLocaleString();

  // Donut math
  const R = 82;
  const C = 2 * Math.PI * R;
  const followerArc = (data.followerPct / 100) * C;
  const nonFollowerArc = (data.nonFollowerPct / 100) * C;
  const gap = C * 0.005;

  return (
    <div className="pb-24 min-h-screen bg-background select-none relative text-foreground">
      {/* Header - sticky */}
      <header className="sticky top-0 z-40 bg-background">
        <div className="flex items-center justify-between px-4 h-[44px]">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/analytics')} className="text-foreground">
              <ArrowLeft size={24} strokeWidth={2} />
            </button>
            <h1 className="text-[16px] font-bold text-foreground cursor-pointer" onClick={() => { setIsEditing(e => !e); if (window.navigator.vibrate) window.navigator.vibrate(50); }}>Interactions</h1>
          </div>
          <div className="flex items-center gap-3">
            {isEditing && (
              <button onClick={saveChanges} className="bg-[#0095f6] text-white p-1.5 rounded-full shadow-lg">
                <Check size={18} strokeWidth={3} />
              </button>
            )}
            <Info size={22} strokeWidth={1.5} className="text-foreground" />
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5">
          <button className="flex items-center gap-1 bg-secondary border border-border rounded-full px-3 py-1 text-[13px] font-medium text-foreground">
            {isEditing ? (
              <input className="bg-transparent text-[13px] font-medium outline-none w-20 text-foreground" value={data.dateRange} onChange={e => updateField('dateRange', e.target.value)} />
            ) : data.dateRange} <ChevronDown size={14} strokeWidth={2} />
          </button>
          <span className="text-[13px] font-semibold text-foreground">
            {isEditing ? (
              <span className="flex items-center gap-1">
                <input className="w-12 bg-secondary rounded text-center text-[13px] outline-none text-foreground" value={data.startDate} onChange={e => updateField('startDate', e.target.value)} />
                -
                <input className="w-12 bg-secondary rounded text-center text-[13px] outline-none text-foreground" value={data.endDate} onChange={e => updateField('endDate', e.target.value)} />
              </span>
            ) : `${data.startDate} - ${data.endDate}`}
          </span>
        </div>
        <div className="h-[0.5px] bg-border" />
      </header>

      <div
        onTouchStart={startPress}
        onTouchEnd={endPress}
        onMouseDown={startPress}
        onMouseUp={endPress}
        onMouseLeave={endPress}
      >
        {/* Donut Chart */}
        <div className="flex justify-center pt-4 pb-6">
          <div className="relative w-[210px] h-[210px]">
            <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
              <circle cx="100" cy="100" r={R} fill="none" stroke="hsl(var(--secondary))" strokeWidth="11" />
              <circle cx="100" cy="100" r={R} fill="none" stroke="#6C3AED" strokeWidth="11"
                strokeDasharray={`${nonFollowerArc} ${C}`}
                strokeLinecap="round" />
              <circle cx="100" cy="100" r={R} fill="none" stroke="#D946EF" strokeWidth="11"
                strokeDasharray={`${followerArc} ${C}`}
                strokeDashoffset={`${-nonFollowerArc - gap}`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] text-muted-foreground mb-0.5">Interactions</span>
              {isEditing ? (
                <input 
                  type="number" value={data.interactions} 
                  onChange={e => updateField('interactions', parseInt(e.target.value) || 0)}
                  className="text-[36px] font-bold text-foreground bg-secondary rounded px-1 outline-none w-36 text-center"
                />
              ) : (
                <span className="text-[36px] font-bold text-foreground tracking-tight">{formatCount(data.interactions)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-4 space-y-2.5 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-[7px] w-[7px] rounded-full bg-[#D946EF]" />
              <span className="text-[14px] text-foreground">Followers</span>
            </div>
            {isEditing ? (
              <input className="w-16 bg-secondary rounded text-right text-[14px] outline-none text-foreground" value={data.followerPct} onChange={e => updateField('followerPct', parseFloat(e.target.value) || 0)} />
            ) : (
              <span className="text-[14px] text-foreground">{data.followerPct}%</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-[7px] w-[7px] rounded-full bg-[#6C3AED]" />
              <span className="text-[14px] text-foreground">Non-followers</span>
            </div>
            {isEditing ? (
              <input className="w-16 bg-secondary rounded text-right text-[14px] outline-none text-foreground" value={data.nonFollowerPct} onChange={e => updateField('nonFollowerPct', parseFloat(e.target.value) || 0)} />
            ) : (
              <span className="text-[14px] text-foreground">{data.nonFollowerPct}%</span>
            )}
          </div>
        </div>

        <div className="h-[6px] bg-secondary/40" />

        {/* By content type */}
        <div className="px-4 py-4">
          <h3 className="text-[15px] font-bold text-foreground mb-3.5">By content type</h3>
          <div className="flex gap-2 mb-4">
            {["All", "Followers", "Non-followers"].map(t => (
              <button key={t} onClick={() => setContentTab(t)}
                className={cn("px-4 py-1.5 rounded-full text-[13px] font-medium border transition-colors",
                  contentTab === t 
                    ? "bg-secondary text-foreground border-border font-semibold" 
                    : "bg-transparent text-foreground border-border"
                )}>
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-3.5">
            {data.contentTypes.map((type, i) => (
              <div key={type.name}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[13px] text-foreground">{type.name}</span>
                  <span className="text-[13px] font-semibold text-foreground">
                    {isEditing ? (
                      <input className="w-12 bg-secondary rounded text-right text-[13px] font-semibold outline-none text-foreground" value={type.total} onChange={e => {
                        const n = [...data.contentTypes]; n[i].total = parseFloat(e.target.value) || 0; updateField('contentTypes', n);
                      }} />
                    ) : `${type.total}%`}
                  </span>
                </div>
                <div className="h-[8px] w-full bg-secondary rounded-full flex overflow-hidden">
                  <div className="bg-[#D946EF]" style={{ width: `${type.followerPct}%` }} />
                  <div className="bg-[#6C3AED]" style={{ width: `${type.nonFollowerPct}%` }} />
                </div>
                {isEditing && (
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#D946EF]" />
                      <input className="w-12 bg-secondary rounded text-[11px] font-bold outline-none text-foreground" value={type.followerPct} onChange={e => {
                        const n = [...data.contentTypes]; n[i].followerPct = parseFloat(e.target.value) || 0; updateField('contentTypes', n);
                      }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#6C3AED]" />
                      <input className="w-12 bg-secondary rounded text-[11px] font-bold outline-none text-foreground" value={type.nonFollowerPct} onChange={e => {
                        const n = [...data.contentTypes]; n[i].nonFollowerPct = parseFloat(e.target.value) || 0; updateField('contentTypes', n);
                      }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Legend dots */}
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-1.5">
              <div className="h-[6px] w-[6px] rounded-full bg-[#D946EF]" />
              <span className="text-[11px] text-muted-foreground">Followers</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-[6px] w-[6px] rounded-full bg-[#6C3AED]" />
              <span className="text-[11px] text-muted-foreground">Non-followers</span>
            </div>
          </div>
        </div>

        <div className="h-[6px] bg-secondary/40" />

        {/* Stats List */}
        <div className="px-4 py-2">
          {data.breakdown.map((item, i) => (
            <div key={item.label} className="flex justify-between items-center py-3.5 border-b border-border/30 last:border-b-0">
              <span className="text-[15px] text-foreground">{item.label}</span>
              {isEditing ? (
                <input className="w-20 bg-secondary rounded text-right font-semibold text-[15px] outline-none text-foreground" value={item.value} onChange={e => {
                  const nb = [...data.breakdown]; nb[i].value = e.target.value; updateField('breakdown', nb);
                }} />
              ) : (
                <span className="text-[15px] text-foreground">{item.value}</span>
              )}
            </div>
          ))}
        </div>

        <div className="h-[6px] bg-secondary/40" />

        {/* Top reels */}
        <div className="px-4 py-4">
          <div className="flex justify-between items-center mb-0.5">
            <h3 className="text-[15px] font-bold text-foreground">Top reels</h3>
            <button className="text-[14px] text-[#3B82F6] font-semibold">See All</button>
          </div>
          <p className="text-[12px] text-muted-foreground mb-3">Based on likes</p>

          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
            {data.topReels.map((reel, i) => (
              <div key={i} className="flex-shrink-0" style={{ width: 'calc((100% - 24px) / 4)' }}>
                <div 
                  onClick={() => isEditing && handleImageUpload(i)}
                  className={cn("relative rounded-[10px] overflow-hidden aspect-[3/4.5]", isEditing && "cursor-pointer ring-2 ring-[#0095f6]")}
                >
                  <img src={reel.image} alt="" className="w-full h-full object-cover" />
                  <div className="absolute top-1.5 right-1.5">
                    <img src={reelsIcon} alt="" className="w-[14px] h-[14px] invert" />
                  </div>
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                    <span className="text-white text-[13px] font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{reel.count}</span>
                  </div>
                  {isEditing && (
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1">
                      <input className="w-14 bg-white text-black rounded text-center text-[9px] font-bold outline-none py-0.5" onClick={e => e.stopPropagation()} value={reel.count} onChange={e => {
                        const nt = [...data.topReels]; nt[i].count = e.target.value; updateField('topReels', nt);
                      }} />
                      <div className="bg-white/90 p-1 rounded-full">
                        <Camera size={12} className="text-[#0095f6]" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-1 text-center">
                  {isEditing ? (
                    <input className="bg-secondary rounded text-[10px] w-full text-center outline-none text-foreground" value={reel.date} onChange={e => {
                      const nt = [...data.topReels]; nt[i].date = e.target.value; updateField('topReels', nt);
                    }} />
                  ) : (
                    <span className="text-[11px] text-muted-foreground">{reel.date}</span>
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
