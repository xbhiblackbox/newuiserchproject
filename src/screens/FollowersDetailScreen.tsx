import { useState, useRef, useCallback } from "react";
import { ArrowLeft, ChevronDown, Check, Film, Camera, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import reelsIcon from "@/assets/reels-icon.png";

interface FollowersData {
  totalFollowers: string;
  growthChange: string;
  compareDateLabel: string;
  startDate: string;
  endDate: string;
  overall: number;
  follows: number;
  unfollows: number;
  cities: { name: string; pct: number }[];
  countries: { name: string; pct: number }[];
  ageRanges: { range: string; pct: number }[];
  gender: { name: string; pct: number; color: string }[];
  activeDays: string[];
  activeTimes: { time: string; height: number }[];
  chartData: number[];
  chartAxis: { max: string; mid: string; min: string };
  chartDates: string[];
  topContent: { image: string; count: string; date: string }[];
}

const defaultData: FollowersData = {
  totalFollowers: "38,513",
  growthChange: "-0.7%",
  compareDateLabel: "vs Mar 6",
  startDate: "7 Mar",
  endDate: "5 Apr",
  overall: -264,
  follows: 82,
  unfollows: 346,
  cities: [
    { name: "Semnan", pct: 2.2 },
    { name: "Delhi", pct: 1.4 },
    { name: "Tehran", pct: 1.4 },
    { name: "Mumbai", pct: 1.2 },
    { name: "Kolkata", pct: 1.1 },
  ],
  countries: [
    { name: "India", pct: 20.5 },
    { name: "Iran", pct: 12.3 },
    { name: "United States", pct: 8.1 },
    { name: "Pakistan", pct: 5.2 },
  ],
  ageRanges: [
    { range: "13-17", pct: 8.4 },
    { range: "18-24", pct: 33.9 },
    { range: "25-34", pct: 34.6 },
    { range: "35-44", pct: 13.6 },
    { range: "45-54", pct: 5.0 },
    { range: "55-64", pct: 2.2 },
    { range: "65+", pct: 2.3 },
  ],
  gender: [
    { name: "Men", pct: 76.5, color: "#D946EF" },
    { name: "Women", pct: 23.5, color: "#6C3AED" },
  ],
  activeDays: ["Su", "M", "Tu", "W", "Th", "F", "Sa"],
  activeTimes: [
    { time: "12a", height: 30 },
    { time: "3a", height: 35 },
    { time: "6a", height: 60 },
    { time: "9a", height: 65 },
    { time: "2p", height: 75 },
    { time: "3p", height: 80 },
    { time: "6p", height: 100 },
    { time: "9p", height: 55 },
  ],
  chartData: [130, 110, 100, 105, 140, 85, 110, 95, 110, 110, 105, 85, 115, 100, 130],
  chartAxis: { max: "19", mid: "0", min: "-19" },
  chartDates: ["8 Mar", "21 Mar", "4 Apr"],
  topContent: [
    { image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=260&fit=crop", count: "1", date: "1 Apr" },
  ],
};

const FollowersDetailScreen = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<FollowersData>(() => {
    const saved = localStorage.getItem("ig_followers_detail_data_v3");
    return saved ? JSON.parse(saved) : defaultData;
  });
  const [isEditing, setIsEditing] = useState(false);
  const [detailTab, setDetailTab] = useState("Overall");
  const [ageTab, setAgeTab] = useState("All");
  const [locationTab, setLocationTab] = useState("Towns/cities");
  const [activeDayTab, setActiveDayTab] = useState("Su");

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
    localStorage.setItem("ig_followers_detail_data_v3", JSON.stringify(data));
    setIsEditing(false);
  };

  const updateField = (field: keyof FollowersData, value: any) => {
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

  const locationData = locationTab === "Towns/cities" ? data.cities : data.countries;

  return (
    <div className="pb-24 min-h-screen bg-background select-none relative text-foreground">
      {/* Header - sticky */}
      <header className="sticky top-0 z-40 bg-background">
        <div className="flex items-center justify-between px-4 h-[44px]">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/analytics')} className="text-foreground">
              <ArrowLeft size={24} strokeWidth={2} />
            </button>
            <h1 className="text-[16px] font-bold text-foreground cursor-pointer" onClick={() => { setIsEditing(e => !e); if (window.navigator.vibrate) window.navigator.vibrate(50); }}>Followers</h1>
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
            Last 30 days <ChevronDown size={14} strokeWidth={2} />
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
        {/* Hero Section */}
        <div className="flex flex-col items-center py-6">
          {isEditing ? (
            <input className="text-[32px] font-bold text-foreground bg-secondary rounded px-2 outline-none w-48 text-center" value={data.totalFollowers} onChange={e => updateField('totalFollowers', e.target.value)} />
          ) : (
            <span className="text-[32px] font-bold text-foreground tracking-tight">{data.totalFollowers}</span>
          )}
          <span className="text-[14px] font-semibold mt-0.5 text-foreground">Followers</span>
          <div className="flex items-center gap-1 mt-1 text-[13px] text-muted-foreground">
            {isEditing ? (
              <input className="w-16 bg-secondary/50 rounded text-center outline-none" value={data.growthChange} onChange={e => updateField('growthChange', e.target.value)} />
            ) : (
              <span>{data.growthChange}</span>
            )}
            {isEditing ? (
              <input className="w-24 bg-secondary/50 rounded text-center outline-none ml-1" value={data.compareDateLabel} onChange={e => updateField('compareDateLabel', e.target.value)} />
            ) : (
              <span>{data.compareDateLabel}</span>
            )}
          </div>
        </div>

        <div className="h-[6px] bg-secondary/40" />

        {/* Growth Section */}
        <div className="px-4 py-4">
          <h3 className="text-[15px] font-bold mb-3 text-foreground">Growth</h3>
          <div>
            {[
              { label: "Overall", value: data.overall, field: "overall" },
              { label: "Follows", value: data.follows, field: "follows" },
              { label: "Unfollows", value: data.unfollows, field: "unfollows" },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center py-3.5 border-b border-border/30 last:border-b-0">
                <span className="text-[15px] text-foreground">{item.label}</span>
                {isEditing ? (
                  <input type="number" className="w-20 bg-secondary rounded text-right text-[15px] outline-none text-foreground" value={item.value} onChange={e => updateField(item.field as keyof FollowersData, parseInt(e.target.value) || 0)} />
                ) : (
                  <span className="text-[15px] text-foreground">{item.value}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="h-[6px] bg-secondary/40" />

        {/* Follower Details (Chart) */}
        <div className="px-4 py-4">
          <h3 className="text-[15px] font-bold mb-3.5 text-foreground">Follower details</h3>
          <div className="flex gap-2 mb-6">
            {["Overall", "Follows", "Unfollows"].map(t => (
              <button key={t} onClick={() => setDetailTab(t)}
                className={cn("px-4 py-1.5 rounded-full text-[13px] font-medium border transition-colors",
                  detailTab === t 
                    ? "bg-secondary text-foreground border-border font-semibold" 
                    : "bg-transparent text-foreground border-border"
                )}>
                {t}
              </button>
            ))}
          </div>

          {/* Line Chart */}
          <div className="relative h-[180px] w-full mt-2 mb-4">
            <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[12px] text-muted-foreground">
              {isEditing ? (
                <>
                  <input className="w-8 bg-secondary/50 rounded text-center outline-none text-foreground" value={data.chartAxis.max} onChange={e => updateField('chartAxis', {...data.chartAxis, max: e.target.value})} />
                  <input className="w-8 bg-secondary/50 rounded text-center outline-none text-foreground" value={data.chartAxis.mid} onChange={e => updateField('chartAxis', {...data.chartAxis, mid: e.target.value})} />
                  <input className="w-8 bg-secondary/50 rounded text-center outline-none text-foreground" value={data.chartAxis.min} onChange={e => updateField('chartAxis', {...data.chartAxis, min: e.target.value})} />
                </>
              ) : (
                <>
                  <span>{data.chartAxis.max}</span>
                  <span>{data.chartAxis.mid}</span>
                  <span>{data.chartAxis.min}</span>
                </>
              )}
            </div>
            <div className="absolute left-10 right-0 top-0 bottom-0">
              <div className="absolute top-0 w-full h-[0.5px] bg-border/50" />
              <div className="absolute top-1/2 w-full h-[0.5px] bg-border/50" />
              <div className="absolute bottom-0 w-full h-[0.5px] bg-border/50" />
              
              <svg viewBox="0 0 540 150" className="w-full h-full overflow-visible">
                <path 
                  d={`M0,${data.chartData[0]} ${data.chartData.slice(1).map((y, i) => `L${(i+1)*40},${y}`).join(' ')}`} 
                  fill="none" stroke="#D946EF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" 
                />
              </svg>

              {isEditing && (
                <div className="absolute inset-0 flex justify-between items-center pointer-events-none">
                  {data.chartData.map((y, i) => (
                    <div key={i} className="relative flex flex-col items-center pointer-events-auto h-full justify-end">
                      <input 
                        type="range" min="0" max="150" 
                        className="h-full appearance-none bg-transparent opacity-0 cursor-pointer w-4 hover:opacity-10" 
                        value={y} 
                        onChange={e => {
                          const n = [...data.chartData]; n[i] = parseInt(e.target.value); updateField('chartData', n);
                        }} 
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="absolute left-10 right-0 bottom-[-24px] flex justify-between text-[11px] text-muted-foreground">
              {isEditing ? (data.chartDates || ["8 Mar", "21 Mar", "4 Apr"]).map((d, i) => (
                <input key={i} className="w-14 bg-secondary/50 rounded text-center text-[11px] outline-none text-muted-foreground" value={d} onChange={e => {
                  const n = [...(data.chartDates || ["8 Mar", "21 Mar", "4 Apr"])]; n[i] = e.target.value; updateField('chartDates', n);
                }} />
              )) : (data.chartDates || ["8 Mar", "21 Mar", "4 Apr"]).map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="h-[6px] bg-secondary/40 mt-8" />

        {/* Top content by follows */}
        <div className="px-4 py-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[15px] font-bold text-foreground">Top content by follows</h3>
            <button className="text-[14px] text-[#3B82F6] font-semibold">See All</button>
          </div>

          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
            {data.topContent.map((item, i) => (
              <div key={i} className="flex-shrink-0" style={{ width: 'calc((100% - 24px) / 4)' }}>
                <div 
                  onClick={() => isEditing && handleImageUpload(i)}
                  className={cn("relative rounded-[10px] overflow-hidden aspect-[3/4.5]", isEditing && "cursor-pointer ring-2 ring-[#0095f6]")}
                >
                  <img src={item.image} alt="" className="w-full h-full object-cover" />
                  <div className="absolute top-1.5 right-1.5">
                    <img src={reelsIcon} alt="" className="w-[14px] h-[14px] invert" />
                  </div>
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                    <span className="text-white text-[13px] font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{item.count}</span>
                  </div>
                </div>
                <div className="mt-1 text-center">
                  <span className="text-[11px] text-muted-foreground">{item.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-[6px] bg-secondary/40" />

        {/* Top Locations */}
        <div className="px-4 py-4">
          <h3 className="text-[15px] font-bold mb-3.5 text-foreground">Top locations</h3>
          <div className="flex gap-2 mb-4">
            {["Towns/cities", "Countries"].map(t => (
              <button key={t} onClick={() => setLocationTab(t)}
                className={cn("px-4 py-1.5 rounded-full text-[13px] font-medium border transition-colors",
                  locationTab === t 
                    ? "bg-secondary text-foreground border-border font-semibold" 
                    : "bg-transparent text-foreground border-border"
                )}>
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-[2px]">
            {locationData.map((item, i) => (
              <div key={i}>
                <p className="text-[13px] text-foreground mb-1.5">{item.name}</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-[8px] bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-[#D946EF] rounded-full" style={{ width: `${item.pct}%` }} />
                  </div>
                  <span className="text-[13px] text-foreground w-10 text-right">{item.pct}%</span>
                </div>
                {isEditing && (
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <input className="bg-secondary rounded px-1.5 py-0.5 text-[10px] outline-none text-foreground" value={item.name} onChange={e => {
                      const key = locationTab === "Towns/cities" ? "cities" : "countries";
                      const n = [...data[key as keyof FollowersData] as any[]]; n[i].name = e.target.value; updateField(key as keyof FollowersData, n);
                    }} />
                    <input className="bg-secondary rounded px-1.5 py-0.5 text-[10px] outline-none text-foreground" type="number" value={item.pct} onChange={e => {
                      const key = locationTab === "Towns/cities" ? "cities" : "countries";
                      const n = [...data[key as keyof FollowersData] as any[]]; n[i].pct = parseFloat(e.target.value) || 0; updateField(key as keyof FollowersData, n);
                    }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="h-[6px] bg-secondary/40" />

        {/* Age Range */}
        <div className="px-4 py-4">
          <h3 className="text-[15px] font-bold mb-3.5 text-foreground">Age range</h3>
          <div className="flex gap-2 mb-4">
            {["All", "Men", "Women"].map(t => (
              <button key={t} onClick={() => setAgeTab(t)}
                className={cn("px-4 py-1.5 rounded-full text-[13px] font-medium border transition-colors",
                  ageTab === t 
                    ? "bg-secondary text-foreground border-border font-semibold" 
                    : "bg-transparent text-foreground border-border"
                )}>
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-[2px]">
            {data.ageRanges.map((age, i) => (
              <div key={i}>
                <p className="text-[13px] text-foreground mb-1.5">{age.range}</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-[8px] bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-[#D946EF] rounded-full" style={{ width: `${age.pct}%` }} />
                  </div>
                  <span className="text-[13px] text-foreground w-10 text-right">{age.pct}%</span>
                </div>
                {isEditing && (
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <input className="bg-secondary rounded px-1.5 py-0.5 text-[10px] outline-none text-foreground" value={age.range} onChange={e => {
                      const n = [...data.ageRanges]; n[i].range = e.target.value; updateField('ageRanges', n);
                    }} />
                    <input className="bg-secondary rounded px-1.5 py-0.5 text-[10px] outline-none text-foreground" type="number" value={age.pct} onChange={e => {
                      const n = [...data.ageRanges]; n[i].pct = parseFloat(e.target.value) || 0; updateField('ageRanges', n);
                    }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="h-[6px] bg-secondary/40" />

        {/* Gender */}
        <div className="px-4 py-4">
          <h3 className="text-[15px] font-bold mb-3.5 text-foreground">Gender</h3>
          <div className="space-y-[2px]">
            {data.gender.map((g, i) => (
              <div key={i}>
                <p className="text-[13px] text-foreground mb-1.5">{g.name}</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-[8px] bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${g.pct}%`, backgroundColor: g.color }} />
                  </div>
                  <span className="text-[13px] text-foreground w-10 text-right">
                    {isEditing ? (
                      <input className="w-10 bg-secondary rounded text-right text-[13px] outline-none text-foreground" type="number" value={g.pct} onChange={e => {
                        const n = [...data.gender]; n[i].pct = parseFloat(e.target.value) || 0; updateField('gender', n);
                      }} />
                    ) : `${g.pct}%`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-[6px] bg-secondary/40" />

        {/* Most Active Times */}
        <div className="px-4 py-4">
          <h3 className="text-[15px] font-bold mb-3.5 text-foreground">Most active times</h3>
          <div className="flex gap-2 mb-6">
            {data.activeDays.map(d => (
              <button key={d} onClick={() => setActiveDayTab(d)}
                className={cn("w-9 h-9 rounded-full text-[12px] font-medium border flex items-center justify-center transition-colors",
                  activeDayTab === d 
                    ? "bg-secondary text-foreground border-border font-semibold" 
                    : "bg-transparent text-foreground border-border"
                )}>
                {d}
              </button>
            ))}
          </div>

          <div className="flex items-end justify-between h-[140px] px-1 mb-6">
            {data.activeTimes.map((t, i) => (
              <div key={i} className="flex flex-col items-center flex-1 h-full justify-end">
                <div className="w-[80%] bg-[#D946EF] rounded-[3px]" style={{ height: `${t.height}%` }}>
                  {isEditing && (
                    <input 
                      type="number"
                      className="absolute -top-8 left-1/2 -translate-x-1/2 w-8 bg-foreground text-background text-[9px] rounded px-0.5 text-center font-bold outline-none"
                      value={t.height}
                      onChange={e => {
                        const n = [...data.activeTimes]; n[i].height = Math.min(100, Math.max(0, parseInt(e.target.value) || 0)); updateField('activeTimes', n);
                      }}
                    />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground mt-2">{t.time}</span>
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

export default FollowersDetailScreen;
