import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowLeft, Info, ChevronDown, Check, Film, Plus, ChevronRight, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ViewsData {
  views: number;
  followerPct: number;
  nonFollowerPct: number;
  accountsReached: number;
  accountsReachedChange: string;
  dateRange: string;
  startDate: string;
  endDate: string;
  contentTypes: { name: string; followerPct: number; nonFollowerPct: number; total: number }[];
  topContent: { image: string; views: string; date: string }[];
  countries: { name: string; pct: number }[];
  cities: { name: string; pct: number }[];
  ageRanges: { range: string; pct: number }[];
  gender: { name: string; pct: number; color: string }[];
  profileActivityTotal: number;
  profileActivityChange: string;
  profileVisits: number;
  profileVisitsChange: string;
  linkTaps: number;
}

const defaultData: ViewsData = {
  views: 11565,
  followerPct: 51.6,
  nonFollowerPct: 48.4,
  accountsReached: 3117,
  accountsReachedChange: "-84.3%",
  dateRange: "Last 30 days",
  startDate: "10 Feb",
  endDate: "11 Mar",
  contentTypes: [
    { name: "Reels", followerPct: 50, nonFollowerPct: 43.3, total: 93.3 },
    { name: "Stories", followerPct: 6.6, nonFollowerPct: 0, total: 6.6 },
    { name: "Posts", followerPct: 0.1, nonFollowerPct: 0, total: 0.1 },
  ],
  topContent: [
    { image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=260&fit=crop", views: "38K", date: "1 Mar" },
    { image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=260&fit=crop", views: "6.8K", date: "17 Feb" },
    { image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=260&fit=crop", views: "2.1K", date: "21 Feb" },
    { image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&h=260&fit=crop", views: "1.8K", date: "14 Feb" },
  ],
  countries: [
    { name: "India", pct: 86.8 },
    { name: "Iran", pct: 2.1 },
    { name: "Pakistan", pct: 1.7 },
    { name: "Uzbekistan", pct: 0.8 },
  ],
  cities: [
    { name: "Delhi", pct: 2.7 },
    { name: "Mumbai", pct: 1.7 },
    { name: "Bangalore", pct: 1.5 },
    { name: "Kolkata", pct: 1.4 },
  ],
  ageRanges: [
    { range: "18-24", pct: 35.8 },
    { range: "13-17", pct: 29.0 },
    { range: "25-34", pct: 22.1 },
    { range: "35-44", pct: 7.9 },
  ],
  gender: [
    { name: "Men", pct: 75.4, color: "#D32FE0" },
    { name: "Women", pct: 24.6, color: "#5B21B6" },
  ],
  profileActivityTotal: 218,
  profileActivityChange: "-47.8%",
  profileVisits: 218,
  profileVisitsChange: "-47.8%",
  linkTaps: 0,
};

const ViewsDetailScreen = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<ViewsData>(() => {
    const saved = localStorage.getItem("ig_views_detail_data");
    return saved ? JSON.parse(saved) : defaultData;
  });
  const [isEditing, setIsEditing] = useState(false);
  const [audienceTab, setAudienceTab] = useState("Countries");
  const [activityTab, setActivityTab] = useState("Followers");
  const [ageTab, setAgeTab] = useState("Followers");

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
    localStorage.setItem("ig_views_detail_data", JSON.stringify(data));
    setIsEditing(false);
  };

  const updateField = (field: keyof ViewsData, value: any) => {
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
          const content = [...data.topContent];
          content[index] = { ...content[index], image: readerEvent.target?.result as string };
          updateField('topContent', content);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const formatCount = (n: number) => n.toLocaleString();

  return (
    <div className="pb-24 min-h-screen bg-background select-none overflow-x-hidden relative text-foreground">
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-background border-b border-transparent">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/analytics')} className="text-foreground">
            <ArrowLeft size={28} strokeWidth={2.5} />
          </button>
          <h1 className="text-[20px] font-bold text-foreground">Views</h1>
        </div>
        <div className="flex items-center gap-3">
          {isEditing && (
            <button onClick={saveChanges} className="bg-[#0095f6] text-white p-1.5 rounded-full shadow-lg h-8 w-8 flex items-center justify-center">
              <Check size={20} strokeWidth={3} />
            </button>
          )}
          <button className="text-foreground">
            <div className="border-[2.5px] border-foreground rounded-full p-0.5 flex items-center justify-center w-6 h-6">
              <span className="text-[14px] font-bold">i</span>
            </div>
          </button>
        </div>
      </header>

      <div
        onTouchStart={startPress}
        onTouchEnd={endPress}
        onMouseDown={startPress}
        onMouseUp={endPress}
        onMouseLeave={endPress}
      >
        {/* Date line */}
        {/* Date line */}
        <div className="flex items-center justify-between px-4 py-3 mt-1">
          <button className="flex items-center gap-1 bg-secondary/50 rounded-[10px] px-3 py-1.5 text-[14px] font-bold text-foreground">
            {isEditing ? (
               <input className="bg-transparent text-[14px] font-bold outline-none w-24" value={data.dateRange} onChange={e => updateField('dateRange', e.target.value)} />
            ) : data.dateRange} <ChevronDown size={18} strokeWidth={2.5} />
          </button>
          <div className="flex items-center gap-1 font-bold text-[14px]">
            {isEditing ? (
               <>
                 <input className="w-12 bg-secondary/50 rounded text-center outline-none px-1" value={data.startDate} onChange={e => updateField('startDate', e.target.value)} />
                 <span className="text-foreground">-</span>
                 <input className="w-12 bg-secondary/50 rounded text-center outline-none px-1" value={data.endDate} onChange={e => updateField('endDate', e.target.value)} />
               </>
            ) : (
               <span className="text-foreground">{data.startDate} - {data.endDate}</span>
            )}
          </div>
        </div>

        <div className="border-b border-border/60 mx-4 mt-1" />

        {/* Donut Area */}
        <div className="flex justify-center py-10">
          <div className="relative w-[220px] h-[220px]">
            <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
              <circle cx="100" cy="100" r="80" fill="none" stroke="hsl(var(--secondary)/0.5)" strokeWidth="10" />
              <circle cx="100" cy="100" r="80" fill="none" stroke="#D32FE0" strokeWidth="14"
                strokeDasharray={`${(data.followerPct / 100) * 2 * Math.PI * 80} ${2 * Math.PI * 80}`}
                strokeLinecap="round" />
              <circle cx="100" cy="100" r="80" fill="none" stroke="#5B21B6" strokeWidth="14"
                strokeDasharray={`${(data.nonFollowerPct / 100) * 2 * Math.PI * 80} ${2 * Math.PI * 80}`}
                strokeDashoffset={`${-(data.followerPct / 100) * 2 * Math.PI * 80 - (2 * Math.PI * 80 * 0.005)}`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[14px] text-white font-medium mb-1">Views</span>
              {isEditing ? (
                <input 
                  type="number"
                  value={data.views} 
                  onChange={e => updateField('views', parseInt(e.target.value) || 0)}
                  className="text-[28px] font-bold text-foreground bg-secondary/50 rounded px-1 outline-none w-28 text-center"
                />
              ) : (
                <span className="text-[28px] font-bold text-foreground tracking-tight">{formatCount(data.views)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-6 space-y-4 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-[#D32FE0]" />
              <span className="text-[15px] text-foreground font-medium">Followers</span>
            </div>
            {isEditing ? (
               <div className="flex items-center gap-1">
                 <input className="w-16 bg-secondary/50 rounded text-right text-[15px] font-bold outline-none px-1" value={data.followerPct} onChange={e => updateField('followerPct', parseFloat(e.target.value) || 0)} /> %
               </div>
            ) : (
               <span className="text-[15px] text-foreground font-bold">{data.followerPct.toFixed(1)}%</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-[#5B21B6]" />
              <span className="text-[15px] text-white font-medium">Non-followers</span>
            </div>
            {isEditing ? (
               <div className="flex items-center gap-1">
                  <input className="w-12 bg-secondary/50 rounded text-right text-[15px] font-bold outline-none text-white" value={data.nonFollowerPct} onChange={e => updateField('nonFollowerPct', parseFloat(e.target.value) || 0)} />
                  <span className="text-white">%</span>
               </div>
            ) : (
               <span className="text-[15px] text-white font-medium">{data.nonFollowerPct}%</span>
            )}
          </div>
          <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                   <button className={cn("px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors", ageTab === 'Followers' ? "bg-white text-[#000000]" : "bg-[#262626] text-white")} onClick={() => setAgeTab('Followers')}>Followers</button>
                   <button className={cn("px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors", ageTab === 'Non-followers' ? "bg-white text-[#000000]" : "bg-[#262626] text-white")} onClick={() => setAgeTab('Non-followers')}>Non-followers</button>
                </div>
          </div>
        </div>

        <div className="border-b border-border/60 mx-4" />

        {/* Reach */}
        <div className="px-4 py-6">
          <div className="flex items-center justify-between">
            <span className="text-[16px] text-foreground font-medium">Accounts reached</span>
            <div className="text-right">
              {isEditing ? (
                 <input className="w-24 bg-secondary/50 rounded text-right text-[16px] font-bold outline-none" value={data.accountsReached} onChange={e => updateField('accountsReached', parseInt(e.target.value) || 0)} />
              ) : (
                 <span className="text-[16px] text-foreground font-bold">{formatCount(data.accountsReached)}</span>
              )}
              {isEditing ? (
                 <input className="w-16 bg-secondary/50 rounded text-right text-[12px] font-bold outline-none block ml-auto mt-1" value={data.accountsReachedChange} onChange={e => updateField('accountsReachedChange', e.target.value)} />
              ) : (
                 <p className={cn("text-[12px] font-bold mt-0.5", data.accountsReachedChange.startsWith('-') ? "text-muted-foreground/60" : "text-green-500")}>
                   {data.accountsReachedChange}
                 </p>
              )}
            </div>
          </div>
        </div>

        <div className="border-b border-border/60 mx-4" />

        {/* Content Type */}
        <div className="px-4 py-7">
           <h3 className="text-[18px] font-bold text-foreground mb-6">Views by content type</h3>
           <div className="space-y-6">
              {data.contentTypes.map((type, i) => (
                <div key={type.name}>
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-[15px] font-medium text-foreground">{type.name}</span>
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <input className="w-12 bg-secondary/50 rounded text-right text-[14px] font-bold outline-none" value={type.total} onChange={e => {
                          const n = [...data.contentTypes]; n[i].total = parseFloat(e.target.value) || 0; updateField('contentTypes', n);
                        }} />
                      ) : (
                        <span className="text-[14px] font-bold text-foreground">{type.total}%</span>
                      )}
                    </div>
                  </div>
                  <div className="h-[14px] w-full bg-secondary/30 rounded-full flex overflow-hidden">
                    <div className="bg-[#D32FE0]" style={{ width: `${type.followerPct}%` }} />
                    <div className="bg-[#5B21B6]" style={{ width: `${type.nonFollowerPct}%` }} />
                  </div>
                  {isEditing && (
                    <div className="mt-2 grid grid-cols-2 gap-4">
                       <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-[#D32FE0]" />
                          <input className="w-12 bg-secondary/30 rounded text-[11px] font-bold outline-none" value={type.followerPct} onChange={e => {
                            const n = [...data.contentTypes]; n[i].followerPct = parseFloat(e.target.value) || 0; updateField('contentTypes', n);
                          }} />
                       </div>
                       <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-[#5B21B6]" />
                          <input className="w-12 bg-secondary/30 rounded text-[11px] font-bold outline-none" value={type.nonFollowerPct} onChange={e => {
                            const n = [...data.contentTypes]; n[i].nonFollowerPct = parseFloat(e.target.value) || 0; updateField('contentTypes', n);
                          }} />
                       </div>
                    </div>
                  )}
                </div>
              ))}
           </div>
        </div>

        <div className="h-[6px] bg-secondary/30" />

        {/* Top Content */}
        <div className="px-4 py-7">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[18px] font-bold text-foreground">Top content</h3>
            <button className="text-[15px] text-[#5B21B6] font-bold">See All</button>
          </div>
           <p className="text-[13px] text-muted-foreground font-bold mb-6">Based on reach</p>
          
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            {data.topContent.map((item, i) => (
              <div key={i} className="flex-shrink-0 w-[124px]">
                <div 
                  onClick={() => isEditing && handleImageUpload(i)}
                  className={cn("relative rounded-[12px] overflow-hidden aspect-[1/1.5] shadow-sm", isEditing && "cursor-pointer ring-2 ring-[#0095f6] ring-offset-2")}
                >
                  <img src={item.image} alt="" className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/20 rounded-full p-1">
                     <Film size={14} className="text-white" />
                  </div>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/80 rounded-full px-3 py-1 flex items-center gap-1 shadow-sm">
                     <span className="text-white text-[11px] font-bold">{item.views}</span>
                  </div>
                   {isEditing && (
                     <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
                        <input className="w-20 bg-white text-black rounded text-center text-[10px] font-bold outline-none py-1" value={item.views} onClick={e => e.stopPropagation()} onChange={e => {
                          const n = [...data.topContent]; n[i].views = e.target.value; updateField('topContent', n);
                        }} />
                        <div className="bg-white/90 p-2 rounded-full shadow-lg border border-gray-200">
                           <Camera size={18} className="text-[#0095f6]" />
                        </div>
                     </div>
                   )}
                </div>
                <div className="mt-2 text-center">
                   {isEditing ? (
                      <input className="bg-secondary/50 rounded text-[12px] w-full text-center font-medium outline-none text-foreground" value={item.date} onChange={e => {
                         const n = [...data.topContent]; n[i].date = e.target.value; updateField('topContent', n);
                      }} />
                   ) : (
                      <span className="text-[12px] text-muted-foreground font-bold">{item.date}</span>
                   )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-[6px] bg-secondary/30" />

        {/* Audience */}
        <div className="py-7">
          <div className="px-4 flex items-center gap-2 mb-4">
            <h3 className="text-[18px] font-bold text-foreground">Audience</h3>
            <Info size={18} strokeWidth={2.5} className="text-foreground" />
          </div>

          <div className="flex gap-4 overflow-x-auto hide-scrollbar px-4 pb-4">
            {/* Towns/Cities */}
            <div className="flex-shrink-0 w-[300px] bg-white dark:bg-[#0F0F0F] text-black dark:text-white rounded-[16px] border border-gray-100 dark:border-gray-800 p-3 shadow-sm transition-colors">
                <h4 className="text-[17px] font-bold mb-6">Top towns/cities</h4>
                <div className="space-y-6">
                    {data.cities.map((city, i) => (
                        <div key={city.name}>
                            <p className="text-[14px] font-medium mb-1.5">{city.name}</p>
                            <div className="flex items-center gap-4">
                                <div className="flex-1 h-3 bg-secondary/30 dark:bg-[#262629] rounded-full overflow-hidden">
                                    <div className="h-full bg-[#D32FE0] rounded-full" style={{ width: `${city.pct}%` }} />
                                </div>
                                <span className="text-[13px] font-bold w-10 text-right">{city.pct}%</span>
                            </div>
                            {isEditing && (
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <input className="bg-gray-50 rounded px-2 py-1 text-[11px] font-bold outline-none" value={city.name} onChange={e => {
                                        const n = [...data.cities]; n[i].name = e.target.value; updateField('cities', n);
                                    }} />
                                    <input className="bg-gray-50 rounded px-2 py-1 text-[11px] font-bold outline-none" type="number" value={city.pct} onChange={e => {
                                        const n = [...data.cities]; n[i].pct = parseFloat(e.target.value) || 0; updateField('cities', n);
                                    }} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Countries */ }
            <div className="flex-shrink-0 w-[300px] bg-white dark:bg-[#0F0F0F] text-black dark:text-white rounded-[16px] border border-gray-100 dark:border-gray-800 p-3 shadow-sm transition-colors">
                <h4 className="text-[17px] font-bold mb-6">Top countries</h4>
                <div className="space-y-6">
                    {data.countries.map((country, i) => (
                        <div key={country.name}>
                            <p className="text-[14px] font-medium mb-1.5">{country.name}</p>
                            <div className="flex items-center gap-4">
                                <div className="flex-1 h-3 bg-secondary/30 dark:bg-[#262629] rounded-full overflow-hidden">
                                    <div className="h-full bg-[#D32FE0] rounded-full" style={{ width: `${country.pct}%` }} />
                                </div>
                                <span className="text-[13px] font-bold w-10 text-right">{country.pct}%</span>
                            </div>
                            {isEditing && (
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <input className="bg-gray-50 rounded px-2 py-1 text-[11px] font-bold outline-none" value={country.name} onChange={e => {
                                        const n = [...data.countries]; n[i].name = e.target.value; updateField('countries', n);
                                    }} />
                                    <input className="bg-gray-50 rounded px-2 py-1 text-[11px] font-bold outline-none" type="number" value={country.pct} onChange={e => {
                                        const n = [...data.countries]; n[i].pct = parseFloat(e.target.value) || 0; updateField('countries', n);
                                    }} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Age Ranges */}
            <div className="flex-shrink-0 w-[300px] bg-white dark:bg-[#0F0F0F] text-black dark:text-white rounded-[16px] border border-gray-100 dark:border-gray-800 p-3 shadow-sm transition-colors">
                <h4 className="text-[17px] font-bold mb-6">Top age ranges</h4>
                <div className="space-y-6">
                    {data.ageRanges.map((range, i) => (
                        <div key={range.range}>
                            <p className="text-[14px] font-medium mb-1.5">{range.range}</p>
                            <div className="flex items-center gap-4">
                                <div className="flex-1 h-3 bg-secondary/30 dark:bg-[#262629] rounded-full overflow-hidden">
                                    <div className="h-full bg-[#D32FE0] rounded-full" style={{ width: `${range.pct}%` }} />
                                </div>
                                <span className="text-[13px] font-bold w-10 text-right">{range.pct}%</span>
                            </div>
                            {isEditing && (
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <input className="bg-gray-50 rounded px-2 py-1 text-[11px] font-bold outline-none" value={range.range} onChange={e => {
                                        const n = [...data.ageRanges]; n[i].range = e.target.value; updateField('ageRanges', n);
                                    }} />
                                    <input className="bg-gray-50 rounded px-2 py-1 text-[11px] font-bold outline-none" type="number" value={range.pct} onChange={e => {
                                        const n = [...data.ageRanges]; n[i].pct = parseFloat(e.target.value) || 0; updateField('ageRanges', n);
                                    }} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Gender */}
            <div className="flex-shrink-0 w-[300px] bg-white dark:bg-[#0F0F0F] text-black dark:text-white rounded-[16px] border border-gray-100 dark:border-gray-800 p-3 shadow-sm transition-colors">
                <h4 className="text-[17px] font-bold mb-6">Gender</h4>
                <div className="space-y-6 mt-12">
                    {data.gender.map((g, i) => (
                        <div key={g.name}>
                            <p className="text-[14px] font-medium mb-1.5">{g.name}</p>
                            <div className="flex items-center gap-4">
                                <div className="flex-1 h-3 bg-secondary/30 dark:bg-[#262629] rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${g.pct}%`, backgroundColor: g.color }} />
                                </div>
                                <span className="text-[13px] font-bold w-10 text-right">{g.pct}%</span>
                            </div>
                            {isEditing && (
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <input className="bg-gray-50 rounded px-2 py-1 text-[11px] font-bold outline-none" value={g.name} onChange={e => {
                                        const n = [...data.gender]; n[i].name = e.target.value; updateField('gender', n);
                                    }} />
                                    <input className="bg-gray-50 rounded px-2 py-1 text-[11px] font-bold outline-none" type="number" value={g.pct} onChange={e => {
                                        const n = [...data.gender]; n[i].pct = parseFloat(e.target.value) || 0; updateField('gender', n);
                                    }} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
          </div>
        </div>

        <div className="h-[6px] bg-secondary/30" />

        {/* Profile activity */}
        <div className="px-4 py-7">
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-[18px] font-bold text-foreground">Profile activity</h3>
              <Info size={18} strokeWidth={2.5} className="text-foreground" />
            </div>
            <div className="text-right">
              {isEditing ? (
                 <input className="w-16 bg-secondary/50 rounded text-right font-bold outline-none" value={data.profileActivityTotal} onChange={e => updateField('profileActivityTotal', parseInt(e.target.value) || 0)} />
              ) : (
                 <span className="text-[18px] font-bold text-foreground">{data.profileActivityTotal}</span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mb-6">
             {isEditing ? (
                <input className="text-[12px] text-muted-foreground font-medium bg-secondary/30 rounded outline-none w-32" value="vs 11 Jan-9 Feb" readOnly />
             ) : (
                <span className="text-[12px] text-muted-foreground font-medium">vs 11 Jan-9 Feb</span>
             )}
             {isEditing ? (
                <input className="w-16 bg-secondary/30 rounded text-right text-[12px] text-muted-foreground font-medium outline-none" value={data.profileActivityChange} onChange={e => updateField('profileActivityChange', e.target.value)} />
             ) : (
                <span className="text-[12px] text-muted-foreground font-medium">{data.profileActivityChange}</span>
             )}
          </div>
          
          <div className="space-y-7 mt-6">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-medium">Profile visits</p>
              <div className="text-right">
                {isEditing ? (
                  <input className="w-16 bg-secondary/30 rounded text-right font-bold outline-none" value={data.profileVisits} onChange={e => updateField('profileVisits', parseInt(e.target.value) || 0)} />
                ) : (
                  <p className="text-[15px] text-foreground font-bold">{data.profileVisits}</p>
                )}
                {isEditing ? (
                   <input className="w-16 bg-secondary/30 rounded text-right text-[12px] text-muted-foreground font-medium outline-none mt-1" value={data.profileVisitsChange} onChange={e => updateField('profileVisitsChange', e.target.value)} />
                ) : (
                   <p className="text-[12px] text-muted-foreground font-medium">{data.profileVisitsChange}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[15px] font-medium">External link taps</p>
              <div className="text-right">
                {isEditing ? (
                  <input className="w-16 bg-secondary/30 rounded text-right font-bold outline-none" value={data.linkTaps} onChange={e => updateField('linkTaps', parseInt(e.target.value) || 0)} />
                ) : (
                  <p className="text-[15px] text-foreground font-bold">{data.linkTaps}</p>
                )}
                <p className="text-[12px] text-muted-foreground font-medium">--</p>
              </div>
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

export default ViewsDetailScreen;
