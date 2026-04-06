import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowLeft, ChevronDown, Check, AlertCircle, Plus, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
  ageRanges: { range: string; pct: number }[];
  gender: { name: string; pct: number; color: string }[];
  activeDays: string[];
  activeTimes: { time: string; height: number }[];
  chartData: number[]; // 5-7 points to control the line chart
  chartAxis: { max: string; mid: string; min: string };
}

const defaultData: FollowersData = {
  totalFollowers: "38,748",
  growthChange: "-0.9%",
  compareDateLabel: "vs Feb 9",
  startDate: "10 Feb",
  endDate: "11 Mar",
  overall: -336,
  follows: 52,
  unfollows: 388,
  cities: [
    { name: "Semnan", pct: 2.2 },
    { name: "Delhi", pct: 1.4 },
    { name: "Tehran", pct: 1.4 },
    { name: "Iranshahr", pct: 1.4 },
    { name: "Mumbai", pct: 1.3 },
  ],
  ageRanges: [
    { range: "13-17", pct: 11.4 },
    { range: "18-24", pct: 38.3 },
    { range: "25-34", pct: 32.5 },
    { range: "35-44", pct: 10.9 },
    { range: "45-54", pct: 3.1 },
    { range: "55-64", pct: 1.2 },
    { range: "65+", pct: 2.5 },
  ],
  gender: [
    { name: "Men", pct: 76.5, color: "#D32FE0" },
    { name: "Women", pct: 23.5, color: "#5B21B6" },
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
  chartAxis: { max: "26", mid: "0", min: "-26" },
};

const FollowersDetailScreen = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<FollowersData>(() => {
    const saved = localStorage.getItem("ig_followers_detail_data_v2");
    return saved ? JSON.parse(saved) : defaultData;
  });
  const [isEditing, setIsEditing] = useState(false);
  const [detailTab, setDetailTab] = useState("Overall");
  const [ageTab, setAgeTab] = useState("All");
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
    localStorage.setItem("ig_followers_detail_data_v2", JSON.stringify(data));
    setIsEditing(false);
  };

  const updateField = (field: keyof FollowersData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="pb-24 min-h-screen bg-background select-none overflow-x-hidden relative text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-background border-b border-transparent">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/analytics')} className="text-foreground">
            <ArrowLeft size={30} strokeWidth={2} />
          </button>
          <h1 className="text-[20px] font-bold">Followers</h1>
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
            Last 30 days <ChevronDown size={18} strokeWidth={2.5} />
          </button>
          <div className="text-[14px] font-bold text-foreground flex items-center gap-1">
             {isEditing ? (
                <>
                  <input className="w-12 bg-secondary/50 rounded text-center outline-none" value={data.startDate} onChange={e => updateField('startDate', e.target.value)} />
                  <span>-</span>
                  <input className="w-12 bg-secondary/50 rounded text-center outline-none" value={data.endDate} onChange={e => updateField('endDate', e.target.value)} />
                </>
             ) : (
                <span>{data.startDate} - {data.endDate}</span>
             )}
          </div>
        </div>

        <div className="h-[0.5px] bg-border mx-4 mt-2" />

        {/* Hero Section */}
        <div className="flex flex-col items-center py-10">
          {isEditing ? (
             <input className="text-[36px] font-bold text-foreground bg-secondary/50 rounded px-2 outline-none w-56 text-center" value={data.totalFollowers} onChange={e => updateField('totalFollowers', e.target.value)} />
          ) : (
              <span className="text-[36px] font-bold text-foreground tracking-tighter">{data.totalFollowers}</span>
          )}
          <span className="text-[16px] font-bold mt-0.5">Followers</span>
          <div className="flex items-center gap-1 mt-1 text-[13px] text-muted-foreground font-bold">
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

        <div className="h-[6px] bg-secondary/50 w-full" />

        {/* Growth Section */}
        <div className="px-4 py-7">
          <h3 className="text-[18px] font-bold mb-7 text-foreground">Growth</h3>
          <div className="space-y-7">
            <div className="flex justify-between items-center">
               <span className="text-[15px] font-medium">Overall</span>
               {isEditing ? (
                  <input type="number" className="w-20 bg-secondary/50 rounded text-right font-bold outline-none" value={data.overall} onChange={e => updateField('overall', parseInt(e.target.value) || 0)} />
               ) : (
                  <span className="text-[15px] font-bold">{data.overall}</span>
               )}
            </div>
            <div className="flex justify-between items-center">
               <span className="text-[15px] font-medium">Follows</span>
               {isEditing ? (
                  <input type="number" className="w-20 bg-secondary/50 rounded text-right font-bold outline-none" value={data.follows} onChange={e => updateField('follows', parseInt(e.target.value) || 0)} />
               ) : (
                  <span className="text-[15px] font-bold">{data.follows}</span>
               )}
            </div>
            <div className="flex justify-between items-center">
               <span className="text-[15px] font-medium">Unfollows</span>
               {isEditing ? (
                  <input type="number" className="w-20 bg-secondary/50 rounded text-right font-bold outline-none" value={data.unfollows} onChange={e => updateField('unfollows', parseInt(e.target.value) || 0)} />
               ) : (
                  <span className="text-[15px] font-bold">{data.unfollows}</span>
               )}
            </div>
          </div>
        </div>

        <div className="h-[0.5px] bg-border mx-4" />

        {/* Follower Details (Chart) */}
        <div className="px-4 py-8">
           <h3 className="text-[18px] font-bold mb-7 text-foreground">Follower details</h3>
           <div className="flex gap-2 mb-10">
              {["Overall", "Follows", "Unfollows"].map(t => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={cn("px-5 py-2 rounded-full text-[14px] font-bold border transition-colors",
                    detailTab === t ? "bg-white text-[#000000] border-transparent" : "bg-[#262626] text-white border-transparent"
                  )}>
                  {t}
                </button>
              ))}
           </div>

           {/* Line Chart UI */}
           <div className="relative h-[180px] w-full mt-2 mb-4">
              <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[13px] text-gray-300 font-bold -translate-y-2">
                 {isEditing ? (
                    <>
                       <input className="w-8 bg-secondary/50 rounded text-center outline-none text-white" value={data.chartAxis.max} onChange={e => updateField('chartAxis', {...data.chartAxis, max: e.target.value})} />
                       <input className="w-8 bg-secondary/50 rounded text-center outline-none text-white" value={data.chartAxis.mid} onChange={e => updateField('chartAxis', {...data.chartAxis, mid: e.target.value})} />
                       <input className="w-8 bg-secondary/50 rounded text-center outline-none text-white" value={data.chartAxis.min} onChange={e => updateField('chartAxis', {...data.chartAxis, min: e.target.value})} />
                    </>
                 ) : (
                    <>
                       <span className="text-white">{data.chartAxis.max}</span>
                       <span className="text-white">{data.chartAxis.mid}</span>
                       <span className="text-white">{data.chartAxis.min}</span>
                    </>
                 )}
              </div>
              <div className="absolute left-10 right-0 top-0 bottom-0">
                 {/* Grid lines */}
                 <div className="absolute top-0 w-full h-[0.5px] bg-border/50" />
                 <div className="absolute top-1/2 w-full h-[0.5px] bg-border/50" />
                 <div className="absolute bottom-0 w-full h-[0.5px] bg-border/50" />
                 
                 {/* Line Path */}
                 <svg viewBox="0 0 540 150" className="w-full h-full preserve-3d overflow-visible">
                    <path 
                      d={`M0,${data.chartData[0]} ${data.chartData.slice(1).map((y, i) => `L${(i+1)*40},${y}`).join(' ')}`} 
                      fill="none" stroke="#D32FE0" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" 
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
              <div className="absolute left-10 right-0 bottom-[-28px] flex justify-between text-[13px] text-muted-foreground font-bold">
                 <span>11 Feb</span>
                 <span>24 Feb</span>
                 <span>10 Mar</span>
              </div>
           </div>

           {/* Error message */}
           <div className="mt-16 bg-secondary/50 rounded-[12px] p-5 flex items-start gap-4 mx-[-4px]">
              <div className="mt-0.5">
                 <div className="w-7 h-7 rounded-full border-[2.5px] border-foreground flex items-center justify-center">
                    <span className="text-[16px] font-extrabold">!</span>
                 </div>
              </div>
              <p className="text-[14px] text-white font-medium leading-[1.4]">
                 There was an error while loading your insights. Try again later.
              </p>
           </div>
        </div>

        <div className="h-[6px] bg-secondary/50 w-full" />

        {/* Top Locations Section */}
        <div className="py-8">
           <div className="px-4 flex gap-2 mb-8">
               {["Top locations"].map(t => (
                  <button key={t} className="px-5 py-2 rounded-full text-[14px] font-bold bg-white text-[#000000]">
                    {t}
                  </button>
               ))}
           </div>
           <div className="px-4 flex gap-2 mb-8">
                {["Towns/Cities", "Countries"].map(t => (
                   <button key={t} className={cn("px-5 py-2 rounded-full text-[14px] font-bold border transition-colors", t === "Towns/Cities" ? "bg-white text-[#000000] border-transparent" : "bg-[#262626] text-white border-transparent")}>
                     {t}
                   </button>
                ))}
           </div>
           
           <div className="px-4 space-y-7">
              {data.cities.map((city, i) => (
                <div key={i}>
                   <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[14px] font-medium">{city.name}</span>
                      <span className="text-[14px] font-bold">{city.pct}%</span>
                   </div>
                   <div className="h-[10px] w-full bg-secondary/50 rounded-full overflow-hidden">
                      <div className="h-full bg-[#D32FE0] rounded-full" style={{ width: `${city.pct * 10}%` }} />
                   </div>
                   {isEditing && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                         <input className="bg-secondary/50 rounded px-2 text-[12px] py-1" value={city.name} onChange={e => {
                           const n = [...data.cities]; n[i].name = e.target.value; updateField('cities', n);
                         }} />
                         <input className="bg-secondary/50 rounded px-2 text-[12px] py-1" type="number" value={city.pct} onChange={e => {
                           const n = [...data.cities]; n[i].pct = parseFloat(e.target.value) || 0; updateField('cities', n);
                         }} />
                      </div>
                   )}
                </div>
              ))}
           </div>
        </div>

        <div className="h-[0.5px] bg-border mx-4" />

        {/* Age Range Section */}
        <div className="px-4 py-8">
           <h3 className="text-[18px] font-bold mb-7 text-foreground">Age range</h3>
           <div className="flex gap-2 mb-9">
              {["All", "Men", "Women"].map(t => (
                 <button key={t} onClick={() => setAgeTab(t)}
                   className={cn("px-5 py-2 rounded-full text-[14px] font-bold border transition-colors",
                     ageTab === t ? "bg-white text-[#000000] border-transparent" : "bg-[#262626] text-white border-transparent"
                   )}>
                   {t}
                 </button>
              ))}
           </div>

           <div className="space-y-8">
              {data.ageRanges.map((age, i) => (
                <div key={i}>
                   <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[14px] font-medium">{age.range}</span>
                      <span className="text-[14px] font-bold">{age.pct}%</span>
                   </div>
                   <div className="h-[10px] w-full bg-secondary/50 rounded-full overflow-hidden">
                      <div className="h-full bg-[#D32FE0] rounded-full" style={{ width: `${age.pct}%` }} />
                   </div>
                   {isEditing && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                         <input className="bg-secondary/50 rounded px-2 text-[12px] py-1" value={age.range} onChange={e => {
                           const n = [...data.ageRanges]; n[i].range = e.target.value; updateField('ageRanges', n);
                         }} />
                         <input className="bg-secondary/50 rounded px-2 text-[12px] py-1" type="number" value={age.pct} onChange={e => {
                           const n = [...data.ageRanges]; n[i].pct = parseFloat(e.target.value) || 0; updateField('ageRanges', n);
                         }} />
                      </div>
                   )}
                </div>
              ))}
           </div>
        </div>

        <div className="h-[0.5px] bg-border mx-4" />

        {/* Gender Breakdown */}
        <div className="px-4 py-8">
           <h3 className="text-[18px] font-bold mb-10 text-foreground">Gender</h3>
           <div className="space-y-12">
              {data.gender.map((g, i) => (
                <div key={i}>
                   <div className="flex justify-between items-center mb-3">
                      <span className="text-[15px] font-medium">{g.name}</span>
                      {isEditing ? (
                         <input className="w-16 bg-secondary/50 rounded text-right text-[15px] font-bold outline-none" type="number" value={g.pct} onChange={e => {
                           const n = [...data.gender]; n[i].pct = parseFloat(e.target.value) || 0; updateField('gender', n);
                         }} />
                      ) : (
                         <span className="text-[15px] font-bold">{g.pct}%</span>
                      )}
                   </div>
                   <div className="h-3 w-full bg-secondary/50 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${g.pct}%`, backgroundColor: g.color }} />
                   </div>
                </div>
              ))}
           </div>
        </div>

        <div className="h-[0.5px] bg-border mx-4" />

        {/* Most Active Times */}
        <div className="px-4 py-8">
           <h3 className="text-[18px] font-bold mb-7 text-foreground">Most active times</h3>
           <div className="flex gap-2.5 mb-12">
              {data.activeDays.map(d => (
                <button key={d} onClick={() => setActiveDayTab(d)}
                  className={cn("w-10 h-10 rounded-full text-[13px] font-bold border flex items-center justify-center transition-colors",
                    activeDayTab === d ? "bg-secondary/50 border-transparent text-foreground" : "bg-background border-border text-foreground"
                  )}>
                  {d}
                </button>
              ))}
           </div>

           <div className="flex items-end justify-between h-[160px] px-2 mb-10">
              {data.activeTimes.map((t, i) => (
                 <div key={i} className="flex flex-col items-center flex-1 h-full justify-end group relative cursor-pointer">
                    <div className="w-[85%] bg-[#D32FE0] rounded-[4px] relative" style={{ height: `${t.height}%` }}>
                       {isEditing && (
                          <input 
                             type="number"
                             className="absolute -top-10 left-1/2 -translate-x-1/2 w-10 bg-foreground text-background text-[10px] rounded px-1 text-center font-bold outline-none"
                             value={t.height}
                             onChange={e => {
                                const n = [...data.activeTimes]; n[i].height = Math.min(100, Math.max(0, parseInt(e.target.value) || 0)); updateField('activeTimes', n);
                             }}
                          />
                       )}
                    </div>
                    <span className="text-[12px] text-muted-foreground font-bold mt-4">{t.time}</span>
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

export default FollowersDetailScreen;
