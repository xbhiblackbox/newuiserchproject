import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowLeft, Info, ChevronDown, Check, Film, Plus, ChevronRight, Camera } from "lucide-react";
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
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-background border-b border-transparent">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/analytics')} className="text-foreground">
            <ArrowLeft size={30} strokeWidth={2} />
          </button>
          <h1 className="text-[20px] font-bold">Interactions</h1>
        </div>
        <div className="flex items-center gap-3">
          {isEditing && (
             <button onClick={saveChanges} className="bg-[#0095f6] text-white p-1.5 rounded-full shadow-lg">
               <Check size={20} strokeWidth={3} />
             </button>
          )}
          <div className="border-[2px] border-foreground rounded-full w-7 h-7 flex items-center justify-center">
            <span className="text-[15px] font-bold">i</span>
          </div>
        </div>
      </header>

      <div
        onTouchStart={startPress}
        onTouchEnd={endPress}
        onMouseDown={startPress}
        onMouseUp={endPress}
        onMouseLeave={endPress}
        className="pt-2"
      >
        {/* Date Selector Row */}
        <div className="flex items-center justify-between px-4 py-2 mt-2">
          <button className="flex items-center gap-1 bg-secondary/50 rounded-[10px] px-3 py-1.5 text-[14px] font-bold text-foreground">
            {data.dateRange} <ChevronDown size={18} strokeWidth={2.5} />
          </button>
          <div className="text-[14px] font-bold text-black flex items-center gap-1">
             {isEditing ? (
                <>
                  <input className="w-12 bg-gray-100 rounded text-center outline-none" value={data.startDate} onChange={e => updateField('startDate', e.target.value)} />
                  <span>-</span>
                  <input className="w-12 bg-gray-100 rounded text-center outline-none" value={data.endDate} onChange={e => updateField('endDate', e.target.value)} />
                </>
             ) : (
                <span>{data.startDate} - {data.endDate}</span>
             )}
          </div>
        </div>

        <div className="h-[0.5px] bg-gray-100 mx-4 mt-2" />

        {/* Donut Area */}
        <div className="flex justify-center py-12">
          <div className="relative w-[230px] h-[230px]">
            <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
              <circle cx="100" cy="100" r="85" fill="none" stroke="#F2F2F2" strokeWidth="8" />
              <circle cx="100" cy="100" r="85" fill="none" stroke="#B025C3" strokeWidth="10"
                strokeDasharray={`${(data.followerPct / 100) * 2 * Math.PI * 85} ${2 * Math.PI * 85}`}
                strokeLinecap="round" />
              <circle cx="100" cy="100" r="85" fill="none" stroke="#4B12C2" strokeWidth="10"
                strokeDasharray={`${(data.nonFollowerPct / 100) * 2 * Math.PI * 85} ${2 * Math.PI * 85}`}
                strokeDashoffset={`${-(data.followerPct / 100) * 2 * Math.PI * 85 - (2 * Math.PI * 85 * 0.005)}`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[14px] text-foreground/80 font-medium mb-1">Interactions</span>
              {isEditing ? (
                 <input 
                   type="number"
                   value={data.interactions} 
                   onChange={e => updateField('interactions', parseInt(e.target.value) || 0)}
                   className="text-[32px] font-bold text-black bg-gray-100 rounded px-1 outline-none w-32 text-center"
                 />
              ) : (
                <span className="text-[32px] font-bold text-foreground tracking-tight">{data.interactions.toLocaleString()}</span>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-6 space-y-4 mb-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#B025C3]" />
              <span className="text-[15px] font-medium">Followers</span>
            </div>
            {isEditing ? (
               <input className="w-16 bg-gray-100 rounded text-right text-[15px] font-bold outline-none" value={data.followerPct} onChange={e => updateField('followerPct', parseFloat(e.target.value) || 0)} />
            ) : (
               <span className="text-[15px] font-medium">{data.followerPct}%</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#4B12C2]" />
              <span className="text-[15px] font-medium">Non-followers</span>
            </div>
            <span className="text-[15px] font-medium">{data.nonFollowerPct}%</span>
          </div>
        </div>

        <div className="h-[0.5px] bg-gray-100 mx-4" />

        {/* By content type */}
        <div className="px-4 py-8">
           <h3 className="text-[18px] font-bold mb-6">By content type</h3>
           
           <div className="flex gap-2 mb-8">
              {["All", "Followers", "Non-followers"].map(t => (
                <button key={t} onClick={() => setContentTab(t)}
                  className={cn("px-5 py-2 rounded-full text-[14px] font-bold border transition-colors",
                    contentTab === t ? "bg-white text-[#000000] border-transparent" : "bg-[#262626] text-white border-transparent"
                  )}>
                  {t}
                </button>
              ))}
           </div>

           <div className="space-y-8">
              {data.contentTypes.map((type, i) => (
                <div key={type.name}>
                   <div className="flex justify-between items-center mb-3">
                      <span className="text-[15px] font-medium">{type.name}</span>
                      <div className="flex items-center gap-1">
                         {isEditing ? (
                            <input className="w-12 bg-gray-100 rounded text-right text-[15px] font-bold outline-none" value={type.total} onChange={e => {
                              const n = [...data.contentTypes]; n[i].total = parseFloat(e.target.value) || 0; updateField('contentTypes', n);
                            }} />
                         ) : (
                            <span className="text-[15px] font-bold">{type.total}%</span>
                         )}
                      </div>
                   </div>
                   <div className="h-3 w-full bg-secondary/30 dark:bg-[#262629] rounded-full flex overflow-hidden">
                      <div className="bg-[#B025C3]" style={{ width: `${type.followerPct}%` }} />
                      <div className="bg-[#4B12C2]" style={{ width: `${type.nonFollowerPct}%` }} />
                   </div>
                   {isEditing && (
                     <div className="mt-2 grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                           <div className="h-2 w-2 rounded-full bg-[#B025C3]" />
                           <input className="w-12 bg-gray-100 rounded text-[11px] font-bold outline-none" value={type.followerPct} onChange={e => {
                             const n = [...data.contentTypes]; n[i].followerPct = parseFloat(e.target.value) || 0; updateField('contentTypes', n);
                           }} />
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="h-2 w-2 rounded-full bg-[#4B12C2]" />
                           <input className="w-12 bg-gray-100 rounded text-[11px] font-bold outline-none" value={type.nonFollowerPct} onChange={e => {
                             const n = [...data.contentTypes]; n[i].nonFollowerPct = parseFloat(e.target.value) || 0; updateField('contentTypes', n);
                           }} />
                        </div>
                     </div>
                   )}
                </div>
              ))}
           </div>

           <div className="flex justify-center gap-10 mt-10">
              <div className="flex items-center gap-2">
                 <div className="h-2 w-2 rounded-full bg-[#B025C3]" />
                 <span className="text-[13px] text-white font-bold">Followers</span>
              </div>
              <div className="flex items-center gap-2">
                 <div className="h-2 w-2 rounded-full bg-[#4B12C2]" />
                 <span className="text-[13px] text-white font-bold">Non-followers</span>
              </div>
           </div>
        </div>

        <div className="h-[0.5px] bg-gray-100 mx-4" />

        {/* Stats List */}
        <div className="px-4 py-6 space-y-6">
           {data.breakdown.map((item, i) => (
             <div key={item.label} className="flex justify-between items-center">
                <span className="text-[15px] font-medium">{item.label}</span>
                {isEditing ? (
                   <input className="w-20 bg-gray-100 rounded text-right font-bold outline-none" value={item.value} onChange={e => {
                     const nb = [...data.breakdown]; nb[i].value = e.target.value; updateField('breakdown', nb);
                   }} />
                ) : (
                  <span className="text-[15px] font-bold">{item.value}</span>
                )}
             </div>
           ))}
        </div>

        <div className="h-[0.5px] bg-gray-100 mx-4" />

        {/* Top reels */}
        <div className="px-4 py-8">
           <div className="flex justify-between items-center mb-1">
              <h3 className="text-[18px] font-bold">Top reels</h3>
              <button className="text-[15px] text-[#4B12C2] font-bold">See All</button>
           </div>
           <p className="text-[13px] text-foreground font-bold mb-6">Based on likes</p>

           <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-4">
              {data.topReels.map((reel, i) => (
                <div key={i} className="flex-shrink-0 w-[124px]">
                   <div 
                     onClick={() => isEditing && handleImageUpload(i)}
                     className={cn("relative rounded-[16px] overflow-hidden aspect-[3/4.2] mb-2 shadow-sm", isEditing && "cursor-pointer ring-2 ring-[#0095f6] ring-offset-2")}
                   >
                      <img src={reel.image} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/95 rounded-full px-3 py-1 flex items-center gap-1.5 shadow-sm">
                          <Film size={12} fill="black" stroke="none" />
                          <span className="text-[12px] font-bold text-black">{reel.count}</span>
                       </div>
                      {isEditing && (
                         <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-2 gap-2">
                            <input className="w-full bg-white text-foreground rounded text-center text-[10px] font-bold outline-none py-1" onClick={e => e.stopPropagation()} value={reel.count} onChange={e => {
                              const nt = [...data.topReels]; nt[i].count = e.target.value; updateField('topReels', nt);
                            }} />
                             <div className="bg-white/90 p-2 rounded-full shadow-lg border border-gray-200">
                                <Camera size={18} className="text-[#0095f6]" />
                             </div>
                         </div>
                      )}
                   </div>
                   <div className="text-center">
                      {isEditing ? (
                        <input className="bg-gray-100 rounded text-[12px] w-full text-center font-medium outline-none" value={reel.date} onChange={e => {
                           const nt = [...data.topReels]; nt[i].date = e.target.value; updateField('topReels', nt);
                        }} />
                      ) : (
                        <span className="text-[12px] text-muted-foreground font-bold">{reel.date}</span>
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
              className="bg-[#0095f6] text-white font-bold py-3.5 px-12 rounded-full shadow-2xl active:scale-[0.98] flex items-center gap-2"
            >
              <Check size={20} strokeWidth={3} />
              SAVE CHANGES
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InteractionsDetailScreen;
