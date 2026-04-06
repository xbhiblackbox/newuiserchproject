import { useState, useRef, useCallback } from "react";
import { ArrowLeft, ChevronDown, Check, Film, Camera, Info } from "lucide-react";
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
  profileActivityCompare: string;
  profileVisits: number;
  profileVisitsChange: string;
  linkTaps: number;
}

const defaultData: ViewsData = {
  views: 19652,
  followerPct: 7.9,
  nonFollowerPct: 92.1,
  accountsReached: 1164,
  accountsReachedChange: "-68.2%",
  dateRange: "Last 30 days",
  startDate: "7 Mar",
  endDate: "5 Apr",
  contentTypes: [
    { name: "Reels", followerPct: 7.9, nonFollowerPct: 92.0, total: 99.9 },
    { name: "Stories", followerPct: 0.1, nonFollowerPct: 0, total: 0.1 },
  ],
  topContent: [
    { image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=260&fit=crop", views: "28K", date: "3 Apr" },
    { image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=260&fit=crop", views: "25K", date: "1 Apr" },
    { image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=260&fit=crop", views: "9.4K", date: "3 Apr" },
    { image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&h=260&fit=crop", views: "8.7K", date: "3 Apr" },
  ],
  countries: [
    { name: "India", pct: 43.7 },
    { name: "United States", pct: 9.2 },
    { name: "Uzbekistan", pct: 4.3 },
    { name: "Syria", pct: 4.0 },
  ],
  cities: [
    { name: "Delhi", pct: 1.7 },
    { name: "Mumbai", pct: 1.1 },
    { name: "New York", pct: 1.0 },
    { name: "Hyderabad", pct: 0.8 },
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
  profileActivityTotal: 210,
  profileActivityChange: "-17.0%",
  profileActivityCompare: "vs 5 Feb-6 Mar",
  profileVisits: 210,
  profileVisitsChange: "-17.0%",
  linkTaps: 0,
};

const ViewsDetailScreen = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<ViewsData>(() => {
    const saved = localStorage.getItem("ig_views_detail_data");
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

  // Donut math
  const R = 82;
  const C = 2 * Math.PI * R;
  const followerArc = (data.followerPct / 100) * C;
  const nonFollowerArc = (data.nonFollowerPct / 100) * C;
  const gap = C * 0.005;

  return (
    <div className="pb-24 min-h-screen bg-background select-none relative text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background">
        <div className="flex items-center justify-between px-4 h-[44px]">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/analytics')} className="text-foreground">
              <ArrowLeft size={24} strokeWidth={2} />
            </button>
            <h1 className="text-[16px] font-bold text-foreground">Views</h1>
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
              {/* Non-followers (purple, major arc) */}
              <circle cx="100" cy="100" r={R} fill="none" stroke="#6C3AED" strokeWidth="11"
                strokeDasharray={`${nonFollowerArc} ${C}`}
                strokeLinecap="round" />
              {/* Followers (pink/magenta, minor arc) */}
              <circle cx="100" cy="100" r={R} fill="none" stroke="#D946EF" strokeWidth="11"
                strokeDasharray={`${followerArc} ${C}`}
                strokeDashoffset={`${-nonFollowerArc - gap}`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] text-muted-foreground mb-0.5">Views</span>
              {isEditing ? (
                <input 
                  type="number" value={data.views} 
                  onChange={e => updateField('views', parseInt(e.target.value) || 0)}
                  className="text-[36px] font-bold text-foreground bg-secondary rounded px-1 outline-none w-36 text-center"
                />
              ) : (
                <span className="text-[36px] font-bold text-foreground tracking-tight">{formatCount(data.views)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-4 space-y-1 mb-3">
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

        <div className="h-px bg-border/40 mx-4" />

        {/* Accounts Reached */}
        <div className="px-4 py-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-foreground">Accounts reached</span>
            <div className="text-right">
              {isEditing ? (
                <input className="w-20 bg-secondary rounded text-right text-[14px] font-semibold outline-none text-foreground" value={data.accountsReached} onChange={e => updateField('accountsReached', parseInt(e.target.value) || 0)} />
              ) : (
                <span className="text-[14px] text-foreground font-semibold">{formatCount(data.accountsReached)}</span>
              )}
              {isEditing ? (
                <input className="w-14 bg-secondary rounded text-right text-[11px] outline-none text-muted-foreground block ml-auto mt-0.5" value={data.accountsReachedChange} onChange={e => updateField('accountsReachedChange', e.target.value)} />
              ) : (
                <p className="text-[11px] text-muted-foreground">{data.accountsReachedChange}</p>
              )}
            </div>
          </div>
        </div>

        <div className="h-px bg-border/40 mx-4" />

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

        {/* By top content */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-bold text-foreground">By top content</h3>
            <button className="text-[13px] text-[#3B82F6] font-semibold">See All</button>
          </div>
          
          <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-2">
            {data.topContent.map((item, i) => (
              <div key={i} className="flex-shrink-0 w-[100px]">
                <div 
                  onClick={() => isEditing && handleImageUpload(i)}
                  className={cn("relative rounded-[12px] overflow-hidden aspect-[3/4]", isEditing && "cursor-pointer ring-2 ring-[#0095f6]")}
                >
                  <img src={item.image} alt="" className="w-full h-full object-cover" />
                  <div className="absolute top-1 right-1 flex items-center gap-0.5 bg-black/20 rounded-full p-0.5">
                    <Film size={9} className="text-white" />
                  </div>
                  <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1.5 py-0.5">
                    <span className="text-white text-[10px] font-bold">{item.views}</span>
                  </div>
                  {isEditing && (
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1">
                      <input className="w-14 bg-white text-black rounded text-center text-[9px] font-bold outline-none py-0.5" value={item.views} onClick={e => e.stopPropagation()} onChange={e => {
                        const n = [...data.topContent]; n[i].views = e.target.value; updateField('topContent', n);
                      }} />
                      <div className="bg-white/90 p-1 rounded-full">
                        <Camera size={12} className="text-[#0095f6]" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-1 text-center">
                  {isEditing ? (
                    <input className="bg-secondary rounded text-[10px] w-full text-center outline-none text-foreground" value={item.date} onChange={e => {
                      const n = [...data.topContent]; n[i].date = e.target.value; updateField('topContent', n);
                    }} />
                  ) : (
                    <span className="text-[11px] text-muted-foreground">{item.date}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-[6px] bg-secondary/40" />

        {/* Audience */}
        <div className="py-4">
          <div className="px-4 flex items-center gap-2 mb-3">
            <h3 className="text-[15px] font-bold text-foreground">Audience</h3>
            <Info size={16} strokeWidth={1.5} className="text-muted-foreground" />
          </div>

          <div className="flex gap-1.5 overflow-x-auto hide-scrollbar px-4 pb-3">
            {/* Towns/Cities */}
            <div className="flex-shrink-0 w-[65vw] bg-secondary/40 rounded-[14px] p-4">
              <h4 className="text-[14px] font-bold text-foreground mb-4">Top towns/cities</h4>
              <div className="space-y-2">
                {data.cities.map((city, i) => (
                  <div key={city.name}>
                    <p className="text-[13px] text-foreground mb-1.5">{city.name}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-[6px] bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-[#D946EF] rounded-full" style={{ width: `${Math.max(city.pct * 5, 3)}%` }} />
                      </div>
                      <span className="text-[13px] text-foreground w-10 text-right">{city.pct}%</span>
                    </div>
                    {isEditing && (
                      <div className="mt-1.5 grid grid-cols-2 gap-2">
                        <input className="bg-secondary rounded px-1.5 py-0.5 text-[10px] outline-none text-foreground" value={city.name} onChange={e => {
                          const n = [...data.cities]; n[i].name = e.target.value; updateField('cities', n);
                        }} />
                        <input className="bg-secondary rounded px-1.5 py-0.5 text-[10px] outline-none text-foreground" type="number" value={city.pct} onChange={e => {
                          const n = [...data.cities]; n[i].pct = parseFloat(e.target.value) || 0; updateField('cities', n);
                        }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Countries */}
            <div className="flex-shrink-0 w-[65vw] bg-secondary/40 rounded-[14px] p-4">
              <h4 className="text-[14px] font-bold text-foreground mb-4">Top countries</h4>
              <div className="space-y-2">
                {data.countries.map((country, i) => (
                  <div key={country.name}>
                    <p className="text-[13px] text-foreground mb-1.5">{country.name}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-[6px] bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-[#D946EF] rounded-full" style={{ width: `${Math.max(country.pct, 3)}%` }} />
                      </div>
                      <span className="text-[13px] text-foreground w-10 text-right">{country.pct}%</span>
                    </div>
                    {isEditing && (
                      <div className="mt-1.5 grid grid-cols-2 gap-2">
                        <input className="bg-secondary rounded px-1.5 py-0.5 text-[10px] outline-none text-foreground" value={country.name} onChange={e => {
                          const n = [...data.countries]; n[i].name = e.target.value; updateField('countries', n);
                        }} />
                        <input className="bg-secondary rounded px-1.5 py-0.5 text-[10px] outline-none text-foreground" type="number" value={country.pct} onChange={e => {
                          const n = [...data.countries]; n[i].pct = parseFloat(e.target.value) || 0; updateField('countries', n);
                        }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Age Ranges */}
            <div className="flex-shrink-0 w-[65vw] bg-secondary/40 rounded-[14px] p-4">
              <h4 className="text-[14px] font-bold text-foreground mb-4">Top age ranges</h4>
              <div className="space-y-2">
                {data.ageRanges.map((range, i) => (
                  <div key={range.range}>
                    <p className="text-[13px] text-foreground mb-1.5">{range.range}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-[6px] bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-[#D946EF] rounded-full" style={{ width: `${range.pct}%` }} />
                      </div>
                      <span className="text-[13px] text-foreground w-10 text-right">{range.pct}%</span>
                    </div>
                    {isEditing && (
                      <div className="mt-1.5 grid grid-cols-2 gap-2">
                        <input className="bg-secondary rounded px-1.5 py-0.5 text-[10px] outline-none text-foreground" value={range.range} onChange={e => {
                          const n = [...data.ageRanges]; n[i].range = e.target.value; updateField('ageRanges', n);
                        }} />
                        <input className="bg-secondary rounded px-1.5 py-0.5 text-[10px] outline-none text-foreground" type="number" value={range.pct} onChange={e => {
                          const n = [...data.ageRanges]; n[i].pct = parseFloat(e.target.value) || 0; updateField('ageRanges', n);
                        }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Gender */}
            <div className="flex-shrink-0 w-[65vw] bg-secondary/40 rounded-[14px] p-4">
              <h4 className="text-[14px] font-bold text-foreground mb-4">Gender</h4>
              <div className="space-y-2">
                {data.gender.map((g, i) => (
                  <div key={g.name}>
                    <p className="text-[13px] text-foreground mb-1.5">{g.name}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-[6px] bg-secondary rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${g.pct}%`, backgroundColor: g.color }} />
                      </div>
                      <span className="text-[13px] text-foreground w-10 text-right">{g.pct}%</span>
                    </div>
                    {isEditing && (
                      <div className="mt-1.5 grid grid-cols-2 gap-2">
                        <input className="bg-secondary rounded px-1.5 py-0.5 text-[10px] outline-none text-foreground" value={g.name} onChange={e => {
                          const n = [...data.gender]; n[i].name = e.target.value; updateField('gender', n);
                        }} />
                        <input className="bg-secondary rounded px-1.5 py-0.5 text-[10px] outline-none text-foreground" type="number" value={g.pct} onChange={e => {
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

        <div className="h-[6px] bg-secondary/40" />

        {/* Profile activity */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-bold text-foreground">Profile activity</h3>
              <div className="w-[16px] h-[16px] rounded-full border-[1.5px] border-foreground/50 flex items-center justify-center">
                <span className="text-[9px] font-semibold text-foreground/50 leading-none">i</span>
              </div>
            </div>
            <div className="text-right">
              {isEditing ? (
                <input className="w-14 bg-secondary rounded text-right font-semibold text-[15px] outline-none text-foreground" value={data.profileActivityTotal} onChange={e => updateField('profileActivityTotal', parseInt(e.target.value) || 0)} />
              ) : (
                <span className="text-[15px] font-semibold text-foreground">{data.profileActivityTotal}</span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] text-muted-foreground">
              {isEditing ? (
                <input className="w-28 bg-secondary rounded text-[11px] outline-none text-muted-foreground" value={data.profileActivityCompare} onChange={e => updateField('profileActivityCompare', e.target.value)} />
              ) : data.profileActivityCompare}
            </span>
            {isEditing ? (
              <input className="w-14 bg-secondary rounded text-right text-[11px] text-muted-foreground outline-none" value={data.profileActivityChange} onChange={e => updateField('profileActivityChange', e.target.value)} />
            ) : (
              <span className="text-[11px] text-muted-foreground">{data.profileActivityChange}</span>
            )}
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[14px] text-foreground">Profile visits</p>
              <div className="text-right">
                {isEditing ? (
                  <input className="w-14 bg-secondary rounded text-right font-semibold text-[14px] outline-none text-foreground" value={data.profileVisits} onChange={e => updateField('profileVisits', parseInt(e.target.value) || 0)} />
                ) : (
                  <p className="text-[14px] text-foreground font-semibold">{data.profileVisits}</p>
                )}
                <p className="text-[11px] text-muted-foreground">{data.profileVisitsChange}</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[14px] text-foreground">External link taps</p>
              <div className="text-right">
                {isEditing ? (
                  <input className="w-14 bg-secondary rounded text-right font-semibold text-[14px] outline-none text-foreground" value={data.linkTaps} onChange={e => updateField('linkTaps', parseInt(e.target.value) || 0)} />
                ) : (
                  <p className="text-[14px] text-foreground font-semibold">{data.linkTaps}</p>
                )}
                <p className="text-[11px] text-muted-foreground">--</p>
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

export default ViewsDetailScreen;
