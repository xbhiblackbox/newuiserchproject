import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import * as React from "react";

import { ArrowLeft, MoreVertical, Heart, MessageCircle, Send, Bookmark, Repeat2, Info, Pencil, X, Plus, TrendingUp, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { mockAccounts, currentUser } from "@/data/mockData";
import { loadReelsData, saveReelsData } from "@/data/reelInsightsData";
import { cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, CartesianGrid, ReferenceLine, LineChart, Line } from "recharts";
import GraphEditorModal from "@/components/GraphEditorModal";
import RetentionEditorModal from "@/components/RetentionEditorModal";
import { supabase } from "@/integrations/supabase/client";
import { uploadToCloudinary } from "@/lib/cloudinary";

// Seeded pseudo-random number generator
const seededRandom = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

// Auto-calculate the next nice Y-axis interval (Instagram style: steps of 1, 2, 2.5, 5, 10)
const getNiceTopValue = (val: number) => {
  if (val <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(val)));
  const norm = val / magnitude;
  let nextNorm;
  if (norm <= 1) nextNorm = 1;
  else if (norm <= 2) nextNorm = 2;
  else if (norm <= 2.5) nextNorm = 2.5;
  else if (norm <= 5) nextNorm = 5;
  else nextNorm = 10;
  return nextNorm * magnitude;
};

// Generate graph: pink line peaks at center (bell curve), gray line flat at top
const generateOrganicGraph = (totalViews: number, seed: number, startDate: string, typicalTop?: number) => {
  // Parse start date
  const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const parts = startDate.trim().split(" ");
  const day = parseInt(parts[0]) || 1;
  const monthStr = parts[1] || "Jan";
  const month = months[monthStr] ?? 0;
  const baseDate = new Date(2025, month, day);

  const rng = seededRandom(seed + totalViews + 7);
  const numPoints = 5;
  const points: { day: string; thisReel: number; typical: number }[] = [];
  const peak = totalViews;
  const topVal = typicalTop ?? Math.round(peak * 0.55);

  // Bell curve ratios for pink line with slight randomization
  const bellBase = [0, 0.55, 1.0, 0.65, 0.15];
  const typicalBase = [0, 0.45, 0.75, 0.9, 0.95];

  for (let i = 0; i < numPoints; i++) {
    const dayOffset = i === 0 ? 0 : Math.round((i * 22) / (numPoints - 1));
    const date = new Date(baseDate);
    date.setDate(date.getDate() + dayOffset);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const label = i === 0 || i === 2 || i === 4 ? `${date.getDate()} ${monthNames[date.getMonth()]}` : "";

    // Add slight variation per reel (±10%)
    const bellVar = i === 0 ? 0 : bellBase[i] * (0.9 + rng() * 0.2);
    const typVar = i === 0 ? 0 : typicalBase[i] * (0.85 + rng() * 0.3);

    points.push({
      day: label,
      thisReel: Math.round(peak * bellVar),
      typical: Math.round(topVal * typVar),
    });
  }

  return points;
};

// Helper: compute 3 X-axis date labels from a start date string like "23 Jan"
const computeXDates = (startDate: string): [string, string, string] => {
  const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11, January: 0, February: 1, March: 2, April: 3, June: 5, July: 6, August: 7, September: 8, October: 9, November: 10, December: 11 };
  const parts = startDate.trim().split(" ");
  const day = parseInt(parts[0]) || 1;
  const monthStr = parts[1] || "Jan";
  const month = months[monthStr] ?? months[monthStr.slice(0, 3)] ?? 0;
  const baseDate = new Date(2025, month, day);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const offsets = [0, 11, 22]; // indices 0, 2, 4 → dayOffset formula
  return offsets.map(off => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + off);
    return `${d.getDate()} ${monthNames[d.getMonth()]}`;
  }) as [string, string, string];
};

const ReelInsightsScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const searchParams = new URLSearchParams(window.location.search);
  const accountUsername = searchParams.get("account") || "just4abhii";
  const account = mockAccounts[accountUsername] || mockAccounts["just4abhii"] || Object.values(mockAccounts)[0];
  const postIndex = parseInt(id || "0");

  const isMainAccount = accountUsername === "just4abhii" || account?.profile === currentUser;
  const reelsData = isMainAccount ? loadReelsData() : null;
  const post = isMainAccount && reelsData ? reelsData[postIndex] : null;
  console.log("[Insights] isMain:", isMainAccount, "postIndex:", postIndex, "graphStartDate:", post?.graphStartDate, "views:", post?.insights?.views, "caption:", post?.caption?.slice(0, 20));
  const fallbackPost = account?.posts?.[postIndex] || account?.posts?.[0];
  // Thumbnail: prioritize custom thumbnail, then auto-generate from video URL
  const getPostImage = () => {
    if (post?.thumbnail) return post.thumbnail;
    if (post?.videoUrl?.includes("streamable.com")) {
      const idMatch = post.videoUrl.match(/streamable\.com\/(?:e\/|o\/)?([a-zA-Z0-9]+)/);
      const videoId = idMatch ? idMatch[1] : post.videoUrl.split("/").pop();
      return `https://cdn-cf-east.streamable.com/image/${videoId}.jpg`;
    }
    return fallbackPost?.thumbnail;
  };
  const [postImage, setPostImage] = useState(getPostImage());
  const [postVideoUrl, setPostVideoUrl] = useState(post?.videoUrl || "");
  const [postCaption, setPostCaption] = useState(post?.caption || "❤️🤍...");
  const [retentionImageUrl, setRetentionImageUrl] = useState<string>('');

  // Get insights data
  const ins = post?.insights || null;

  const [viewsFilter, setViewsFilter] = useState("All");
  const filterOrder = ["All", "Followers", "Non-followers"];
  const [audienceTab, setAudienceTab] = useState("Gender");

  // Editable state - all values can be long-pressed to edit
  const [editViews, setEditViews] = useState(ins?.views ?? 1000);
  const [editLikes, setEditLikes] = useState(ins?.likes ?? 69);
  const [editComments, setEditComments] = useState(ins?.comments ?? 11);
  const [editShares, setEditShares] = useState(ins?.shares ?? 2);
  const [editSaves, setEditSaves] = useState(ins?.saves ?? 8);
  const [editReposts, setEditReposts] = useState(ins?.reposts ?? 0);
  const [editFollowerPct, setEditFollowerPct] = useState(ins?.followerViewsPct ?? 89);
  const [editGenderMale, setEditGenderMale] = useState(ins?.genderMale ?? 92);
  const [editViewRate, setEditViewRate] = useState(ins?.viewRatePast3Sec ?? 42);
  const [editStartDate, setEditStartDate] = useState(post?.graphStartDate || ins?.viewsOverTime?.[0]?.day || "23 Jan");
  const [editDisplayDate, setEditDisplayDate] = useState(post?.graphStartDate || "5 February");
  const [editDuration, setEditDuration] = useState(post?.duration || "0:10");
  const [isEditMode, setIsEditMode] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [graphEditorOpen, setGraphEditorOpen] = useState(false);
  const [customGraphData, setCustomGraphData] = useState<{ day: string; thisReel: number; typical: number }[] | null>(null);
  const [editTypicalTop, setEditTypicalTop] = useState(Math.round((ins?.views ?? 1000) * 0.55));

  // Watch time editable state
  const [editWatchTime, setEditWatchTime] = useState(ins?.watchTime || "1h 3m 53s");
  const [editAvgWatchTime, setEditAvgWatchTime] = useState(ins?.avgWatchTime || "6 sec");

  // Retention state
  const [editSkipRate, setEditSkipRate] = useState(ins?.skipRate ?? 28.2);
  const [editTypicalSkipRate, setEditTypicalSkipRate] = useState(ins?.typicalSkipRate ?? 54.7);
  const [editRetentionCurve, setEditRetentionCurve] = useState<{ t: string; pct: number }[]>(
    ins?.retentionCurve || [
      { t: "0:00", pct: 100 },
      { t: "", pct: 68 },
      { t: "0:12", pct: 42 },
      { t: "", pct: 2 },
      { t: "0:19", pct: 2 },
    ]
  );
  const [typicalRetentionCurve, setTypicalRetentionCurve] = useState<{ t: string; pct: number }[]>(
    ins?.typicalRetentionCurve || [
      { t: "0:00", pct: 100 },
      { t: "", pct: 55 },
      { t: "", pct: 32 },
      { t: "", pct: 15 },
      { t: "0:19", pct: 8 },
    ]
  );
  const [retentionEditorOpen, setRetentionEditorOpen] = useState(false);
  const [editYCenter, setEditYCenter] = useState(post?.yCenter ?? 500);
  const [editYTop, setEditYTop] = useState(post?.yTop ?? 1000);


  // Prefer saved viewsOverTime labels (e.g. "0", "12h", "24h") over computed dates
  const [editXDate1, setEditXDate1] = useState(() => {
    const vot = ins?.viewsOverTime;
    if (vot && vot.length >= 5 && vot[0].day) return vot[0].day;
    const dates = computeXDates(post?.graphStartDate || vot?.[0]?.day || "23 Jan");
    return dates[0];
  });
  const [editXDate2, setEditXDate2] = useState(() => {
    const vot = ins?.viewsOverTime;
    if (vot && vot.length >= 5 && vot[2].day) return vot[2].day;
    const dates = computeXDates(post?.graphStartDate || vot?.[0]?.day || "23 Jan");
    return dates[1];
  });
  const [editXDate3, setEditXDate3] = useState(() => {
    const vot = ins?.viewsOverTime;
    if (vot && vot.length >= 5 && vot[4].day) return vot[4].day;
    const dates = computeXDates(post?.graphStartDate || vot?.[0]?.day || "23 Jan");
    return dates[2];
  });
  const [timeRangeMode, setTimeRangeMode] = useState<"custom" | "12h" | "24h">("custom");
  const [showGraph, setShowGraph] = useState(post?.showGraph !== false);
  const [editCountries, setEditCountries] = useState(ins?.countries || [
    { name: "India", pct: 54.1 }, { name: "Iran", pct: 19.9 }, { name: "Uzbekistan", pct: 5.7 }, { name: "Türkiye", pct: 2.6 }, { name: "Kazakhstan", pct: 1.6 },
  ]);
  const [editAgeGroups, setEditAgeGroups] = useState(ins?.ageGroups || [
    { range: "13-17", pct: 32.3 }, { range: "18-24", pct: 35.9 }, { range: "25-34", pct: 20.2 }, { range: "35-44", pct: 7.1 }, { range: "45-54", pct: 2.3 }, { range: "55-64", pct: 0.8 }, { range: "65+", pct: 1.4 },
  ]);
  const [editSources, setEditSources] = useState(ins?.sources || [
    { name: "Feed", pct: 63.4 }, { name: "Reels tab", pct: 11.1 }, { name: "Stories", pct: 10.6 }, { name: "Explore", pct: 7.4 }, { name: "Profile", pct: 6.0 },
  ]);
  const [editAccountsReached, setEditAccountsReached] = useState(ins?.accountsReached ?? 567);
  const [editFollows, setEditFollows] = useState(ins?.follows ?? 0);
  const [monetisationStatus, setMonetisationStatus] = useState((post as any)?.monetisationStatus || "Not monetising");
  const [editTypicalViewRate, setEditTypicalViewRate] = useState((post as any)?.typicalViewRate ?? 41.1);
  const longPressTimerRef = useRef<any>(null);

  // ── Supabase: save all editable state ──────────────────────────────────────
  const saveToSupabase = useCallback(async (overrides?: Record<string, unknown>) => {
    const data = {
      views: editViews, likes: editLikes, comments: editComments,
      shares: editShares, saves: editSaves, reposts: editReposts,
      followerViewsPct: editFollowerPct, genderMale: editGenderMale,
      viewRatePast3Sec: editViewRate,
      typicalViewRate: editTypicalViewRate,
      monetisationStatus,
      graphStartDate: editStartDate, displayDate: editDisplayDate,
      duration: editDuration,
      watchTime: editWatchTime, avgWatchTime: editAvgWatchTime,
      skipRate: editSkipRate, typicalSkipRate: editTypicalSkipRate,
      retentionCurve: editRetentionCurve,
      typicalRetentionCurve,
      customGraphData,
      yCenter: editYCenter, yTop: editYTop,
      editTypicalTop,
      xDate1: editXDate1, xDate2: editXDate2, xDate3: editXDate3,
      timeRangeMode,
      showGraph,
      sources: editSources,
      countries: editCountries,
      ageGroups: editAgeGroups,
      accountsReached: editAccountsReached,
      follows: editFollows,
      thumbnail: postImage,
      videoUrl: postVideoUrl,
      caption: postCaption,
      retentionImage: retentionImageUrl,
      ...overrides,
    };
    try {
      await (supabase as any).from('reels_data').upsert(
        { account: accountUsername, post_index: postIndex, data, updated_at: new Date().toISOString() },
        { onConflict: 'account,post_index' }
      );
    } catch (e) {
      console.warn('[Supabase] Save failed, using localStorage only:', e);
    }
  }, [
    editViews, editLikes, editComments, editShares, editSaves, editReposts,
    editFollowerPct, editGenderMale, editViewRate,
    editStartDate, editDisplayDate, editDuration,
    editWatchTime, editAvgWatchTime,
    editSkipRate, editTypicalSkipRate, editRetentionCurve, typicalRetentionCurve,
    customGraphData, editYCenter, editYTop, editTypicalTop,
    editXDate1, editXDate2, editXDate3, timeRangeMode, showGraph,
    editSources, editCountries, editAgeGroups, editAccountsReached, editFollows,
    accountUsername, postIndex,
  ]);

  // ── Load from Supabase on mount (non-blocking) ─────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data: rows } = await (supabase as any)
          .from('reels_data')
          .select('data')
          .eq('account', accountUsername)
          .eq('post_index', postIndex)
          .maybeSingle();
        if (!rows?.data) return;
        const d = rows.data as Record<string, unknown>;
        if (d.views != null) setEditViews(d.views as number);
        if (d.likes != null) setEditLikes(d.likes as number);
        if (d.comments != null) setEditComments(d.comments as number);
        if (d.shares != null) setEditShares(d.shares as number);
        if (d.saves != null) setEditSaves(d.saves as number);
        if (d.reposts != null) setEditReposts(d.reposts as number);
        if (d.followerViewsPct != null) setEditFollowerPct(d.followerViewsPct as number);
        if (d.genderMale != null) setEditGenderMale(d.genderMale as number);
        if (d.viewRatePast3Sec != null) setEditViewRate(d.viewRatePast3Sec as number);
        if (d.graphStartDate) setEditStartDate(d.graphStartDate as string);
        if (d.displayDate) setEditDisplayDate(d.displayDate as string);
        if (d.duration) setEditDuration(d.duration as string);
        if (d.watchTime) setEditWatchTime(d.watchTime as string);
        if (d.avgWatchTime) setEditAvgWatchTime(d.avgWatchTime as string);
        if (d.skipRate != null) setEditSkipRate(d.skipRate as number);
        if (d.typicalSkipRate != null) setEditTypicalSkipRate(d.typicalSkipRate as number);
        if (d.typicalViewRate != null) setEditTypicalViewRate(d.typicalViewRate as number);
        if (d.monetisationStatus && typeof d.monetisationStatus === 'string') setMonetisationStatus(d.monetisationStatus);
        if (d.retentionCurve) setEditRetentionCurve(d.retentionCurve as { t: string; pct: number }[]);
        if (d.typicalRetentionCurve) setTypicalRetentionCurve(d.typicalRetentionCurve as { t: string; pct: number }[]);
        if (d.customGraphData) setCustomGraphData(d.customGraphData as { day: string; thisReel: number; typical: number }[]);
        if (d.yCenter != null) setEditYCenter(d.yCenter as number);
        if (d.yTop != null) setEditYTop(d.yTop as number);
        if (d.editTypicalTop != null) setEditTypicalTop(d.editTypicalTop as number);
        if (d.xDate1) setEditXDate1(d.xDate1 as string);
        if (d.xDate2) setEditXDate2(d.xDate2 as string);
        if (d.xDate3) setEditXDate3(d.xDate3 as string);
        if (d.timeRangeMode) setTimeRangeMode(d.timeRangeMode as 'custom' | '12h' | '24h');
        if (d.showGraph != null) setShowGraph(d.showGraph as boolean);
        if (d.sources) setEditSources(d.sources as { name: string; pct: number }[]);
        if (d.countries) setEditCountries(d.countries as { name: string; pct: number }[]);
        if (d.ageGroups) setEditAgeGroups(d.ageGroups as { range: string; pct: number }[]);
        if (d.accountsReached != null) setEditAccountsReached(d.accountsReached as number);
        if (d.follows != null) setEditFollows(d.follows as number);
        if (d.thumbnail) setPostImage(d.thumbnail as string);
        if (d.videoUrl) setPostVideoUrl(d.videoUrl as string);
        if (d.caption) setPostCaption(d.caption as string);
        if (d.retentionImage) setRetentionImageUrl(d.retentionImage as string);
      } catch (e) {
        console.warn('[Supabase] Load failed, using localStorage data:', e);
      }
    })();
  }, [accountUsername, postIndex]);
  // If saved viewsOverTime has custom labels at ANY of the 3 positions, mark as manually edited
  const hasCustomLabels = (() => {
    const vot = ins?.viewsOverTime;
    if (!vot || vot.length < 5) return false;
    const computed = computeXDates(post?.graphStartDate || vot[0]?.day || "23 Jan");
    return (vot[0].day && vot[0].day !== computed[0]) ||
      (vot[2].day && vot[2].day !== computed[1]) ||
      (vot[4].day && vot[4].day !== computed[2]);
  })();
  const xDatesManuallyEdited = useRef(!!hasCustomLabels);

  // Sync X-axis dates when editStartDate changes (from display date edit) — skip if user manually edited
  useEffect(() => {
    if (timeRangeMode === "custom" && !xDatesManuallyEdited.current) {
      const newDates = computeXDates(editStartDate);
      setEditXDate1(newDates[0]);
      setEditXDate2(newDates[1]);
      setEditXDate3(newDates[2]);
    }
  }, [editStartDate]);

  // Edit modal state
  const [editModal, setEditModal] = useState<{ label: string; value: string; onSave: (v: number) => void; isText?: boolean } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  // Use editable values
  const views = editViews;
  const likes = editLikes;
  const comments = editComments;
  const shares = editShares;
  const saves = editSaves;
  const reposts = editReposts;
  const followerPct = editFollowerPct;
  const nonFollowerPct = 100 - followerPct;
  const viewRate = editViewRate;
  const genderMale = editGenderMale;
  const genderFemale = 100 - genderMale;
  const watchTime = editWatchTime;
  const avgWatchTime = editAvgWatchTime;
  const countries = editCountries;
  const ageGroups = editAgeGroups;
  const sources = editSources;
  const accountsReached = editAccountsReached;
  const follows = editFollows;

  // Generate separate graphs for All, Followers, Non-followers
  // customGraphData = user-drawn graph (Draw ON + save). Otherwise auto-generate from views count.
  // Compute effective X-axis labels based on time range mode
  const effectiveXLabels = useMemo(() => {
    if (timeRangeMode === "12h") {
      return ["0h", "6h", "12h"];
    }
    if (timeRangeMode === "24h") {
      return ["0h", "12h", "24h"];
    }
    return [editXDate1, editXDate2, editXDate3];
  }, [timeRangeMode, editXDate1, editXDate2, editXDate3]);

  const viewsOverTimeAll = useMemo(() => {
    if (customGraphData) {
      const labeled = customGraphData.map((d, i) => {
        const labelIdx = i === 0 ? 0 : i === 2 ? 1 : i === 4 ? 2 : -1;
        return { 
          ...d, 
          day: labelIdx >= 0 ? effectiveXLabels[labelIdx] : d.day,
        };
      });
      return labeled;
    }
    // Auto-generate, then override labels
    const generated = generateOrganicGraph(editViews, postIndex, editStartDate, editTypicalTop);
    return generated.map((d, i) => {
      const labelIdx = i === 0 ? 0 : i === 2 ? 1 : i === 4 ? 2 : -1;
      return { ...d, day: labelIdx >= 0 ? effectiveXLabels[labelIdx] : "" };
    });
  }, [customGraphData, editViews, postIndex, editStartDate, editTypicalTop, effectiveXLabels]);

  const viewsOverTimeFollowers = useMemo(() => {
    const ratio = followerPct / 100;
    return viewsOverTimeAll.map(d => ({ ...d, thisReel: Math.round(d.thisReel * ratio), typical: Math.round(d.typical * ratio) }));
  }, [viewsOverTimeAll, followerPct]);

  const viewsOverTimeNonFollowers = useMemo(() => {
    const ratio = nonFollowerPct / 100;
    return viewsOverTimeAll.map(d => ({ ...d, thisReel: Math.round(d.thisReel * ratio), typical: Math.round(d.typical * ratio) }));
  }, [viewsOverTimeAll, nonFollowerPct]);

  const viewsOverTime = viewsFilter === "Followers" ? viewsOverTimeFollowers
    : viewsFilter === "Non-followers" ? viewsOverTimeNonFollowers
      : viewsOverTimeAll;

  const computedInteractions = likes + comments + shares + saves;
  const [editInteractions, setEditInteractions] = useState<number | null>(null);
  const totalInteractions = editInteractions ?? computedInteractions;
  const fmtNum = (n: number) => n >= 1000 ? n.toLocaleString() : String(n);

  // Persist current edits back to localStorage
  const persistEdits = useCallback(() => {
    if (!isMainAccount) return;
    const freshData = loadReelsData();
    const reel = freshData[postIndex];
    if (!reel) return;
    reel.insights = {
      ...reel.insights,
      views: editViews,
      likes: editLikes,
      comments: editComments,
      shares: editShares,
      saves: editSaves,
      reposts: editReposts,
      followerViewsPct: editFollowerPct,
      genderMale: editGenderMale,
      genderFemale: 100 - editGenderMale,
      viewRatePast3Sec: editViewRate,
      skipRate: editSkipRate,
      typicalSkipRate: editTypicalSkipRate,
      retentionCurve: editRetentionCurve,
      watchTime: editWatchTime,
      avgWatchTime: editAvgWatchTime,
      sources: editSources,
      countries: editCountries,
      ageGroups: editAgeGroups,
      accountsReached: editAccountsReached,
      follows: editFollows,
    };
    reel.graphStartDate = editStartDate;
    reel.duration = editDuration;
    // Save custom X-axis labels into viewsOverTime
    if (reel.insights.viewsOverTime && reel.insights.viewsOverTime.length >= 5) {
      reel.insights.viewsOverTime[0].day = editXDate1;
      reel.insights.viewsOverTime[2].day = editXDate2;
      reel.insights.viewsOverTime[4].day = editXDate3;
    }
    if (customGraphData) {
      reel.insights.viewsOverTime = customGraphData.map((d, i) => {
        const labelIdx = i === 0 ? 0 : i === 2 ? 1 : i === 4 ? 2 : -1;
        return { ...d, day: labelIdx === 0 ? editXDate1 : labelIdx === 1 ? editXDate2 : labelIdx === 2 ? editXDate3 : d.day };
      });
    }
    reel.yCenter = editYCenter;
    reel.yTop = editYTop;
    reel.showGraph = showGraph;
    if (postImage !== undefined) reel.thumbnail = postImage;
    if (postCaption !== undefined) reel.caption = postCaption;
    if (postVideoUrl !== undefined) reel.videoUrl = postVideoUrl;
    freshData[postIndex] = reel;
    saveReelsData(freshData);
    console.log("[InsightsPersist] Saved edits for reel", postIndex);
  }, [isMainAccount, postIndex, editViews, editLikes, editComments, editShares, editSaves, editReposts, editFollowerPct, editGenderMale, editViewRate, editStartDate, editDuration, editXDate1, editXDate2, editXDate3, customGraphData, editYCenter, editYTop, editSkipRate, editTypicalSkipRate, editRetentionCurve, editWatchTime, editAvgWatchTime, showGraph, editSources, editCountries, editAgeGroups, editAccountsReached, editFollows, postImage, postCaption, postVideoUrl]);

  // Auto-persist edits to localStorage (skip initial mount)
  const hasMounted = useRef(false);
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    const timer = setTimeout(() => persistEdits(), 100);
    return () => clearTimeout(timer);
  }, [persistEdits]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleStart = (e: any) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      longPressTimerRef.current = setTimeout(() => {
        setIsEditMode(prev => !prev);
        toast.info(isEditMode ? "View mode" : "Edit mode active");
      }, 2000);
    };
    const handleEnd = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };
    const main = document.getElementById('insights-main');
    if (main) {
      main.addEventListener('mousedown', handleStart);
      main.addEventListener('mouseup', handleEnd);
      main.addEventListener('touchstart', handleStart);
      main.addEventListener('touchend', handleEnd);
      return () => {
        main.removeEventListener('mousedown', handleStart);
        main.removeEventListener('mouseup', handleEnd);
        main.removeEventListener('touchstart', handleStart);
        main.removeEventListener('touchend', handleEnd);
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      };
    }
  }, [isEditMode]);

  if (loading) {
    return (
      <div className="pb-20 min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3.5 bg-background">
          <div className="flex items-center gap-5">
            <button onClick={() => navigate('/profile')} className="text-foreground">
              <ArrowLeft size={22} strokeWidth={1.8} />
            </button>
            <h1 className="text-[17px] font-semibold text-foreground">Reel insights</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="h-7 w-7 rounded-full border-[1.5px] border-muted-foreground/25 border-t-muted-foreground/60 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div id="insights-main" className="pb-20 min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3.5 bg-background">
        <div className="flex items-center gap-5">
          <button onClick={() => navigate('/profile')} className="text-foreground p-1">
            <ArrowLeft size={22} strokeWidth={1.8} />
          </button>
          <h1 
            className="text-[17px] font-semibold text-foreground cursor-pointer"
            onClick={() => { if (!isEditMode) { setIsEditMode(true); toast.info("Edit mode active"); } }}
          >
            Reel insights
          </h1>
        </div>
        {!isEditMode ? (
          <button 
            onClick={() => { setIsActionMenuOpen(true); }}
            className="p-1 text-foreground active:opacity-60"
          >
            <MoreVertical size={21} />
          </button>
        ) : (
          <button 
            onClick={() => { setIsEditMode(false); saveToSupabase(); persistEdits(); toast.success("All changes saved"); }}
            className="text-[14px] font-bold text-[hsl(var(--ig-blue))] p-1"
          >
            Done
          </button>
        )}
      </header>

      {/* Reel Preview */}
      <div className="flex flex-col items-center py-4 px-4">
        <label 
          className={cn("w-[100px] rounded-lg overflow-hidden shadow-lg relative block", isEditMode && "cursor-pointer active:opacity-60")}
        >
          {isEditMode && (
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const tid = toast.loading("Uploading thumbnail...");
                try {
                  const url = await uploadToCloudinary(file);
                  setPostImage(url);
                  saveToSupabase({ thumbnail: url });
                  toast.success("Thumbnail updated!", { id: tid });
                } catch (err) {
                  toast.error("Upload failed", { id: tid });
                }
              }} 
            />
          )}
          <img src={postImage} alt="Reel thumbnail" className="w-full aspect-[9/16] object-cover" />
          {isEditMode && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
              <Plus size={24} className="text-white drop-shadow-lg" />
            </div>
          )}
        </label>
        <p 
          className={cn("mt-3 text-[13px] text-foreground text-center leading-[18px] whitespace-pre-wrap break-words w-full px-2", isEditMode && "cursor-pointer active:bg-secondary/40 rounded py-1")}
          onClick={() => isEditMode && setEditModal({
            label: "Caption",
            value: postCaption,
            isText: true,
            onSave: ((v: string) => { setPostCaption(v); persistEdits(); }) as any
          })}
        >{postCaption}</p>
        <p
          className={cn("text-[12px] text-muted-foreground mt-2.5 cursor-pointer active:opacity-60", isEditMode && "bg-secondary/40 px-2 py-0.5 rounded")}
          onClick={() => isEditMode && setEditModal({
            label: "Date & Duration (e.g. 5 February · Duration 0:10)",
            value: `${editDisplayDate} · Duration ${editDuration}`,
            onSave: ((v: any) => {
              const str = String(v).trim();
              const match = str.match(/^(.+?)\s*[·.\-]\s*Duration\s+(.+)$/i)
                || str.match(/^(.+?)\s+Duration\s+(.+)$/i);
              const dateStr = match ? match[1].trim() : str;
              setEditDisplayDate(dateStr);
              if (match) {
                setEditDuration(match[2].trim());
              }
              const monthMap: Record<string, string> = { January: "Jan", February: "Feb", March: "Mar", April: "Apr", May: "May", June: "Jun", July: "Jul", August: "Aug", September: "Sep", October: "Oct", November: "Nov", December: "Dec" };
              const dm = dateStr.match(/^(\d{1,2})\s+(\w+)$/);
              if (dm) {
                const shortMonth = monthMap[dm[2]] || dm[2].slice(0, 3);
                const newStart = `${dm[1]} ${shortMonth}`;
                setEditStartDate(newStart);
                const newDates = computeXDates(newStart);
                setEditXDate1(newDates[0]);
                setEditXDate2(newDates[1]);
                setEditXDate3(newDates[2]);
              }
              persistEdits();
            }) as any,
          })}
        >
          {editDisplayDate} · Duration {editDuration}
        </p>
      </div>

      {/* Engagement Stats */}
      <div className="flex justify-around px-4 py-4 border-b border-border">
        {/* Heart */}
        <div 
          className="flex flex-col items-center gap-1.5 cursor-pointer"
          onClick={() => isEditMode && setEditModal({ label: "Likes", value: String(likes), onSave: setEditLikes })}
        >
          <Heart size={24} className="text-foreground fill-foreground" />
          <span className="text-[13px] font-medium text-foreground">{fmtNum(likes)}</span>
        </div>
        {/* Comment — flipped */}
        <div 
          className="flex flex-col items-center gap-1.5 cursor-pointer"
          onClick={() => isEditMode && setEditModal({ label: "Comments", value: String(comments), onSave: setEditComments })}
        >
          <MessageCircle size={24} className="text-foreground fill-foreground -scale-x-100" />
          <span className="text-[13px] font-medium text-foreground">{fmtNum(comments)}</span>
        </div>
        {/* Send */}
        <div 
          className="flex flex-col items-center gap-1.5 cursor-pointer"
          onClick={() => isEditMode && setEditModal({ label: "Shares", value: String(shares), onSave: setEditShares })}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" className="text-foreground">
            <path d="M21.39 2.97c.46-.46.06-1.24-.56-1.06L2.42 6.86c-.56.16-.6.95-.06 1.18l6.93 2.97 6.18-4.47c.24-.18.5.1.3.32l-4.47 6.18 2.97 6.93c.22.54 1.02.5 1.18-.06l4.94-18.41c.04-.14.02-.28-.04-.4l.04-.13z" fill="currentColor" />
          </svg>
          <span className="text-[13px] font-medium text-foreground">{fmtNum(shares)}</span>
        </div>
        {/* Repost — custom SVG matching Instagram */}
        <div 
          className="flex flex-col items-center gap-1.5 cursor-pointer"
          onClick={() => isEditMode && setEditModal({ label: "Reposts", value: String(reposts), onSave: setEditReposts })}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 12V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 12v3a4 4 0 0 1-4 4H3" />
          </svg>
          <span className="text-[13px] font-medium text-foreground">{fmtNum(reposts)}</span>
        </div>
        {/* Bookmark */}
        <div 
          className="flex flex-col items-center gap-1.5 cursor-pointer"
          onClick={() => isEditMode && setEditModal({ label: "Saves", value: String(saves), onSave: setEditSaves })}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" className="text-foreground">
            <path d="M4 2h16v20l-8-5.5L4 22V2z" fill="currentColor" />
          </svg>
          <span className="text-[13px] font-medium text-foreground">{fmtNum(saves)}</span>
        </div>
      </div>

      <div className="h-[6px] bg-secondary" />

      {/* Overview */}
      <div className="px-4 py-5">
        <div className="flex items-center gap-2 mb-5">
          <h2 className="text-[18px] font-bold text-foreground">Overview</h2>
          <Info size={16} className="text-muted-foreground" />
        </div>
        <div className="space-y-4">
          {[
            { label: "Views", value: fmtNum(views), onEdit: () => setEditModal({ label: "Views", value: String(views), onSave: setEditViews }) },
            { label: "Watch time", value: watchTime, onEdit: () => setEditModal({ label: "Watch time", value: String(watchTime), isText: true, onSave: (v) => setEditWatchTime(String(v)) }) },
            { label: "Interactions", value: fmtNum(totalInteractions), onEdit: () => setEditModal({ label: "Likes (Part of Interactions)", value: String(likes), onSave: setEditLikes }) },
            { label: "Profile activity", value: fmtNum(follows), onEdit: () => setEditModal({ label: "Follows", value: String(follows), onSave: setEditFollows }) },
          ].map((item) => (
            <div 
              key={item.label} 
              className={cn("flex items-center justify-between", isEditMode && "cursor-pointer active:opacity-60")}
              onClick={() => isEditMode && item.onEdit()}
            >
              <span className="text-[15px] text-foreground">{item.label}</span>
              <span className="text-[15px] text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-[6px] bg-secondary" />

      {/* Views Donut */}
      <div className="px-4 py-5">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-[18px] font-bold text-foreground">Views</h2>
          <Info size={16} className="text-muted-foreground" />
        </div>
        <div className="flex justify-center py-4">
          <div className="relative w-[240px] h-[240px]">
            <svg viewBox="0 0 240 240" className="w-full h-full -rotate-90">
              <circle cx="120" cy="120" r="100" fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
              <circle cx="120" cy="120" r="100" fill="none" stroke="#E040FB" strokeWidth="10"
                strokeDasharray={`${(followerPct / 100) * 2 * Math.PI * 100} ${2 * Math.PI * 100}`}
                strokeLinecap="round" />
              <circle cx="120" cy="120" r="100" fill="none" stroke="#7C4DFF" strokeWidth="10"
                strokeDasharray={`${(nonFollowerPct / 100) * 2 * Math.PI * 100} ${2 * Math.PI * 100}`}
                strokeDashoffset={`${-(followerPct / 100) * 2 * Math.PI * 100}`}
                strokeLinecap="round" />
            </svg>
            <div
              className={cn("absolute inset-0 flex flex-col items-center justify-center", isEditMode && "cursor-pointer active:bg-secondary/20 rounded-full transition-colors")}
              onClick={() => isEditMode && setEditModal({ label: "Views", value: String(views), onSave: setEditViews })}
            >
              <span className="text-[13px] text-muted-foreground">Views</span>
              <span className="text-[32px] font-bold text-foreground">{fmtNum(views)}</span>
            </div>
          </div>
        </div>
        <div className="space-y-2 mt-2">
          <div
            className={cn("flex items-center justify-between", isEditMode && "cursor-pointer active:bg-secondary/20 rounded px-2 relative -left-2 w-[calc(100%+16px)] py-1 transition-colors")}
            onClick={() => isEditMode && setEditModal({ label: "Followers %", value: String(followerPct), onSave: (v) => setEditFollowerPct(Math.min(100, v)) })}
          >
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-[#E040FB]" />
              <span className="text-[14px] text-foreground">Followers</span>
            </div>
            <span className="text-[14px] text-foreground">{followerPct.toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-[#7C4DFF]" />
              <span className="text-[14px] text-foreground">Non-followers</span>
            </div>
            <span className="text-[14px] text-foreground">{nonFollowerPct.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="border-t border-border mx-4" />

      {/* Views over time — heading always visible, chart hidden if showGraph off */}
      <div className="px-4 py-5">
        <div className="flex items-center justify-between mb-3">
          <h3
            className="text-[16px] font-bold text-foreground cursor-pointer select-none"
            onClick={() => isEditMode && setGraphEditorOpen(true)}
          >Views over time</h3>
        </div>
        {showGraph && (<>
          <div className="flex gap-2 mb-4">
            {["All", "Followers", "Non-followers"].map((f) => (
              <button
                key={f}
                onClick={() => setViewsFilter(f)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-[13px] font-medium border transition-colors",
                  viewsFilter === f
                    ? "bg-muted text-foreground border-border"
                    : "bg-background text-foreground border-border"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className={cn("h-44 overflow-hidden relative", isEditMode && "cursor-pointer active:opacity-80 rounded-lg transition-opacity")} onClick={() => isEditMode && setGraphEditorOpen(true)}>
            <div
              className="flex transition-transform duration-300 ease-in-out h-full"
              style={{ width: '300%', transform: `translateX(-${filterOrder.indexOf(viewsFilter) * (100 / 3)}%)` }}
            >
              {[viewsOverTimeAll, viewsOverTimeFollowers, viewsOverTimeNonFollowers].map((data, gi) => (
                <div key={gi} className="h-full" style={{ width: `${100 / 3}%` }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 20, right: 10, left: -5, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`reelGrad${gi}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#E040FB" stopOpacity={0.1} />
                          <stop offset="100%" stopColor="#E040FB" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      {(() => {
                        const ratios = [1, followerPct / 100, nonFollowerPct / 100];
                        const r = ratios[gi];
                        const overallMax = Math.max(Math.max(...data.map(d => d.thisReel)) * r, Math.max(...data.map(d => d.typical)) * r, 100);
                        const topVal = getNiceTopValue(overallMax);
                        const centerVal = topVal / 2;
                        const yTicks = [0, centerVal, topVal];
                        // Domain max = topVal so reference lines space evenly: 0 (bottom), center (middle), top (top)
                        const yDomain: [number, number] = [0, topVal];
                        return (
                          <>
                            <CartesianGrid horizontal={false} vertical={false} />
                            <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                            <YAxis 
                              fontSize={11} 
                              tickLine={false} 
                              axisLine={false} 
                              width={40} 
                              tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                              domain={yDomain} 
                              ticks={yTicks} 
                              tickCount={3} 
                              tickFormatter={(v: number) => { 
                                if (v === 0) return '0'; 
                                if (v >= 1000) { 
                                  const k = v / 1000; 
                                  return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`; 
                                } 
                                return String(v); 
                              }} 
                            />
                            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                            <ReferenceLine y={centerVal} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                            <ReferenceLine y={topVal} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                          </>
                        );
                      })()}
                      <Area type="monotone" dataKey="thisReel" stroke="#E040FB" fill="none" strokeWidth={3} dot={false} />
                      <Area type="monotone" dataKey="typical" stroke="#9CA3AF" fill="none" strokeWidth={2.5} strokeDasharray="8 6" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 mt-2">
            <div 
              className={cn("flex items-center gap-1.5", isEditMode && "cursor-pointer active:opacity-60")}
              onClick={() => isEditMode && setEditModal({ label: "This Reel Views", value: String(editViews), onSave: setEditViews })}
            >
              <div className="h-2 w-2 rounded-full bg-[#E040FB]" />
              <span className="text-[12px] text-muted-foreground">This reel</span>
            </div>
            <div 
              className={cn("flex items-center gap-1.5", isEditMode && "cursor-pointer active:opacity-60")}
              onClick={() => isEditMode && setEditModal({ 
                label: "Typical Reel Views (Peak)", 
                value: String(editTypicalTop), 
                onSave: (v) => { setEditTypicalTop(v); saveToSupabase({ editTypicalTop: v }); setCustomGraphData(null); } 
              })}
            >
              <div className="h-2 w-2 rounded-full bg-[#9CA3AF]" />
              <span className="text-[12px] text-muted-foreground">Your typical reel views</span>
            </div>
          </div>
        </>)}
      </div>

      <div className="h-[6px] bg-secondary" />

      {/* Top sources */}
      <div className="px-4 py-5">
        <h3 className="text-[16px] font-bold text-foreground mb-4">Top sources of views</h3>
        <div className="space-y-2">
          {sources.map((item, idx) => (
            <div key={idx}>
              <span
                className={cn("text-[11px] text-foreground block mb-1 select-none", isEditMode && "cursor-pointer active:bg-secondary/20 rounded px-1 -ml-1 transition-colors")}
                onClick={() => {
                  setEditModal({
                    label: `Source name #${idx + 1}`,
                    value: item.name,
                    isText: true,
                    onSave: ((v: any) => {
                      const updated = [...editSources];
                      updated[idx] = { ...updated[idx], name: String(v) };
                      setEditSources(updated);
                    }) as any,
                  });
                }}
              >{item.name}</span>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-[8px] rounded-full bg-secondary/50 overflow-hidden">
                  <div className="h-full ig-bar-gradient" style={{ width: `${item.pct}%` }} />
                </div>
                <span
                  className={cn("text-[11px] text-foreground w-[36px] text-right select-none", isEditMode && "cursor-pointer active:bg-secondary/20 rounded px-1 -ml-1 transition-colors")}
                  onClick={() => {
                    if (!isEditMode) return;
                    setEditModal({
                      label: `${item.name} %`,
                      value: String(item.pct),
                      isText: false,
                      onSave: ((v: any) => {
                        const updated = [...editSources];
                        updated[idx] = { ...updated[idx], pct: Math.min(100, Number(v)) };
                        setEditSources(updated);
                      }) as any,
                    });
                  }}
                >{item.pct}%</span>
              </div>
            </div>
          ))}
        </div>
        <div
          className={cn("border-t border-border mt-5 pt-4 flex items-center justify-between", isEditMode && "cursor-pointer active:bg-secondary/20 rounded px-2 relative -left-2 w-[calc(100%+16px)] transition-colors")}
          onClick={() => isEditMode && setEditModal({ label: "Accounts reached", value: String(accountsReached), onSave: setEditAccountsReached })}
        >
          <span className="text-[14px] text-foreground">Accounts reached</span>
          <span className="text-[14px] text-foreground">{fmtNum(accountsReached)}</span>
        </div>
      </div>

      <div className="h-[6px] bg-secondary" />

      {/* Watch time */}
      <div className="px-4 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-bold text-foreground">Watch time</h3>
            <Info size={14} className="text-muted-foreground" />
          </div>
          <span className="text-[16px] font-bold text-foreground">{watchTime}</span>
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-[14px] text-foreground">Average watch time</span>
          <span className="text-[14px] text-foreground">{avgWatchTime}</span>
        </div>
      </div>

      <div className="h-[6px] bg-secondary" />

      {/* ── Retention ── */}
      <div className="px-4 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-bold text-foreground">Retention</h3>
            <Info size={14} className="text-muted-foreground" />
          </div>
          {isEditMode && (
             <div className="flex items-center gap-3">
               {retentionImageUrl && (
                 <button onClick={() => { setRetentionImageUrl(''); saveToSupabase({ retentionImage: '' }); }} className="text-[11px] font-bold text-red-500">Remove Image</button>
               )}
               <label className="text-[11px] text-[hsl(var(--ig-blue))] font-bold flex items-center gap-1 cursor-pointer active:opacity-60">
                 <Plus size={12} /> Upload Image
                 <input 
                   type="file" 
                   accept="image/*" 
                   className="hidden" 
                   onChange={async (e) => {
                     const file = e.target.files?.[0];
                     if (!file) return;
                     const tid = toast.loading("Uploading graph...");
                     try {
                       const url = await uploadToCloudinary(file);
                       setRetentionImageUrl(url);
                       saveToSupabase({ retentionImage: url });
                       toast.success("Graph updated!", { id: tid });
                     } catch (err) {
                       toast.error("Upload failed", { id: tid });
                     }
                   }} 
                 />
               </label>
             </div>
          )}
        </div>

        {/* Phone mockup with thumbnail */}
        <div className="flex justify-center mb-4">
          <div className="relative w-[100px] h-[178px] rounded-[18px] overflow-hidden bg-black shadow-lg">
            <img
              src={postImage}
              alt="Reel thumbnail"
              className="w-full h-full object-cover"
            />
            {/* overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            {/* centered play triangle - border only, no circle */}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round">
                <polygon points="6,3 21,12 6,21" />
              </svg>
            </div>
          </div>
        </div>

        {/* Retention graph — long-press 2s to edit OR show uploaded image */}
        <div className="relative select-none -mx-2">
          {retentionImageUrl ? (
            <img src={retentionImageUrl} alt="Retention graph" className="w-full h-auto object-contain rounded-lg shadow-sm" />
          ) : (
            <div className={cn("h-[150px]", isEditMode && "cursor-pointer active:opacity-80 transition-opacity")} onClick={() => isEditMode && setRetentionEditorOpen(true)}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={editRetentionCurve} margin={{ top: 5, right: 5, left: -5, bottom: 0 }}>
                  <CartesianGrid horizontal={true} vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.3} />
                  <XAxis dataKey="t" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} width={46} domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v: number) => v === 0 ? '0' : `${v}%`} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Line type="linear" dataKey="pct" stroke="#E040FB" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border my-4" />

        {/* Skip rate */}
        <h4 className="text-[15px] font-bold text-foreground mb-3">Skip rate</h4>
        <div
          className={cn("flex items-center justify-between py-1", isEditMode && "cursor-pointer active:bg-secondary/20 rounded px-2 relative -left-2 w-[calc(100%+16px)] transition-colors")}
          onClick={() => isEditMode && setEditModal({ label: "This reel's skip rate (%)", value: String(editSkipRate), onSave: (v) => setEditSkipRate(Math.min(100, v)) })}
        >
          <span className="text-[14px] text-foreground">This reel's skip rate</span>
          <span className="text-[14px] text-foreground">{editSkipRate.toFixed(1)}%</span>
        </div>
        <div
          className={cn("flex items-center justify-between py-1", isEditMode && "cursor-pointer active:bg-secondary/20 rounded px-2 relative -left-2 w-[calc(100%+16px)] transition-colors")}
          onClick={() => isEditMode && setEditModal({ label: "Your typical skip rate (%)", value: String(editTypicalSkipRate), onSave: (v) => setEditTypicalSkipRate(Math.min(100, v)) })}
        >
          <span className="text-[14px] text-foreground">Your typical skip rate</span>
          <span className="text-[14px] text-foreground">{editTypicalSkipRate.toFixed(1)}%</span>
        </div>

        {/* Divider */}
        <div className="border-t border-border my-4" />

        {/* Watch time rows */}
        <div
          className={cn("flex items-center justify-between py-1", isEditMode && "cursor-pointer active:bg-secondary/20 rounded px-2 relative -left-2 w-[calc(100%+16px)] transition-colors")}
          onClick={() => isEditMode && setEditModal({ label: "Watch time (e.g. 4h 49m 17s)", value: editWatchTime, isText: true, onSave: ((v: any) => setEditWatchTime(String(v))) as any })}
        >
          <span className="text-[14px] text-foreground">Watch time</span>
          <span className="text-[14px] text-foreground">{watchTime}</span>
        </div>
        <div
          className={cn("flex items-center justify-between py-1", isEditMode && "cursor-pointer active:bg-secondary/20 rounded px-2 relative -left-2 w-[calc(100%+16px)] transition-colors")}
          onClick={() => isEditMode && setEditModal({ label: "Average watch time (e.g. 10 sec)", value: editAvgWatchTime, isText: true, onSave: ((v: any) => setEditAvgWatchTime(String(v))) as any })}
        >
          <span className="text-[14px] text-foreground">Average watch time</span>
          <span className="text-[14px] text-foreground">{avgWatchTime}</span>
        </div>
      </div>

      <div className="h-[6px] bg-secondary" />

      {/* View rate */}
      <div className="px-4 py-5">
        <h3 className="text-[16px] font-bold text-foreground mb-3">View rate past first 3 seconds</h3>
        <div className="flex gap-2 mb-4">
          {["All", "Followers", "Non-followers"].map((f) => (
            <button
              key={f}
              className={cn(
                "rounded-full px-4 py-1.5 text-[13px] font-medium border",
                f === "All"
                  ? "bg-muted text-foreground border-border"
                  : "bg-background text-foreground border-border"
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="h-[8px] rounded-full bg-secondary/50 overflow-hidden flex">
          <div className="h-full ig-bar-gradient" style={{ width: `${viewRate}%` }} />
          <div className="h-full w-[2px] bg-muted-foreground" />
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#E040FB]" />
            <span className="text-[13px] text-muted-foreground">This reel</span>
          </div>
          <span className="text-[13px] text-foreground">{viewRate.toFixed(1)}%</span>
        </div>
        <div 
          className={cn("flex items-center justify-between mt-1", isEditMode && "cursor-pointer active:opacity-60")}
          onClick={() => isEditMode && setEditModal({
            label: "Typical View Rate (%)",
            value: "41.1",
            onSave: (v) => {
              // Note: Normally this would be a local state, but since we're using static values for típical, 
              // we just save the intent to edit what should be a constant.
              // For robustness, we'll use a local state for Typical View Rate too.
              setEditTypicalViewRate(v);
              persistEdits();
            }
          })}
        >
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#9CA3AF]" />
            <span className="text-[13px] text-muted-foreground">Your typical reel</span>
          </div>
          <span className="text-[13px] text-foreground">{editTypicalViewRate.toFixed(1)}%</span>
        </div>
      </div>

      <div className="h-[6px] bg-secondary" />

      {/* Interactions donut */}
      <div className="px-4 py-5">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-[18px] font-bold text-foreground">Interactions</h3>
          <Info size={16} className="text-muted-foreground" />
        </div>
        <div className="flex justify-center py-4">
          <div className="relative w-[220px] h-[220px]">
            <svg viewBox="0 0 220 220" className="w-full h-full -rotate-90">
              <circle cx="110" cy="110" r="90" fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
              <circle cx="110" cy="110" r="90" fill="none" stroke="#E040FB" strokeWidth="10"
                strokeDasharray={`${(followerPct / 100) * 2 * Math.PI * 90} ${2 * Math.PI * 90}`}
                strokeLinecap="round" />
              <circle cx="110" cy="110" r="90" fill="none" stroke="#7C4DFF" strokeWidth="10"
                strokeDasharray={`${(nonFollowerPct / 100) * 2 * Math.PI * 90} ${2 * Math.PI * 90}`}
                strokeDashoffset={`${-(followerPct / 100) * 2 * Math.PI * 90}`}
                strokeLinecap="round" />
            </svg>
            <div
              className={cn("absolute inset-0 flex flex-col items-center justify-center", isEditMode && "cursor-pointer active:bg-secondary/20 rounded-full transition-colors")}
              onClick={() => isEditMode && setEditModal({ label: "Interactions", value: String(totalInteractions), onSave: setEditInteractions })}
            >
              <span className="text-[13px] text-muted-foreground">Interactions</span>
              <span className="text-[32px] font-bold text-foreground">{fmtNum(totalInteractions)}</span>
            </div>
          </div>
        </div>
        <div className="space-y-2 mt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-[#E040FB]" />
              <span className="text-[14px] text-foreground">Followers</span>
            </div>
            <span className="text-[14px] text-foreground">{followerPct.toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-[#7C4DFF]" />
              <span className="text-[14px] text-foreground">Non-followers</span>
            </div>
            <span className="text-[14px] text-foreground">{nonFollowerPct.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="border-t border-border mx-4" />

      {/* Interactions breakdown */}
      <div className="px-4 py-5">
        <div className="space-y-3">
          {[
            { label: "Likes", value: likes, set: setEditLikes },
            { label: "Shares", value: shares, set: setEditShares },
            { label: "Saves", value: saves, set: setEditSaves },
            { label: "Comments", value: comments, set: setEditComments },
          ].map((item) => (
            <div key={item.label} 
              className={cn("flex items-center justify-between", isEditMode && "cursor-pointer active:bg-secondary/20 rounded px-2 relative -left-2 w-[calc(100%+16px)] py-1 transition-colors")}
              onClick={() => isEditMode && setEditModal({ label: item.label, value: String(item.value), onSave: item.set })}
            >
              <span className="text-[15px] text-foreground">{item.label}</span>
              <span className="text-[15px] text-foreground">{fmtNum(item.value)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-[6px] bg-secondary" />

      {/* Profile activity */}
      <div className="px-4 py-5">
        <div
          className={cn("flex items-center justify-between mb-3", isEditMode && "cursor-pointer active:bg-secondary/20 rounded px-2 relative -left-2 w-[calc(100%+16px)] py-1 transition-colors")}
          onClick={() => isEditMode && setEditModal({ label: "Follows", value: String(follows), onSave: setEditFollows })}
        >
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-bold text-foreground">Profile activity</h3>
            <Info size={14} className="text-muted-foreground" />
          </div>
          <span className="text-[16px] font-bold text-foreground">{follows}</span>
        </div>
        <div 
          className={cn("flex items-center justify-between", isEditMode && "cursor-pointer active:bg-secondary/20 rounded px-2 relative -left-2 w-[calc(100%+16px)] py-1 transition-colors")}
          onClick={() => isEditMode && setEditModal({ label: "Follows", value: String(follows), onSave: setEditFollows })}
        >
          <span className="text-[14px] text-foreground">Follows</span>
          <span className="text-[14px] text-foreground">{follows}</span>
        </div>
      </div>

      <div className="h-[6px] bg-secondary" />

      {/* Audience */}
      <div className="px-4 py-5">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-[18px] font-bold text-foreground">Audience</h3>
          <Info size={16} className="text-muted-foreground" />
        </div>
        <div className="flex gap-2 mb-5">
          {["Gender", "Country", "Age"].map((tab) => (
            <button
              key={tab}
              onClick={() => setAudienceTab(tab)}
              className={cn(
                "rounded-full px-4 py-1.5 text-[13px] font-medium border transition-colors",
                audienceTab === tab
                  ? "bg-muted text-foreground border-border"
                  : "bg-background text-foreground border-border"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {audienceTab === "Gender" && (
          <div className="space-y-1">
            {[
              { label: "Men", pct: genderMale, color: "ig-bar-gradient" },
              { label: "Women", pct: genderFemale, color: "ig-bar-gradient-blue" },
            ].map((g) => (
              <div key={g.label}>
                <span className="text-[14px] text-foreground block mb-0.5">{g.label}</span>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-[8px] rounded-full bg-secondary/50 overflow-hidden">
                    <div className={`h-full ${g.color}`} style={{ width: `${g.pct}%` }} />
                  </div>
                  <span className="text-[14px] text-foreground w-[48px] text-right">{g.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {audienceTab === "Country" && (
          <div className="space-y-2">
            {countries.map((c, idx) => (
              <div key={idx}>
                <span
                  className={cn("text-[11px] text-foreground block mb-1 select-none", isEditMode && "cursor-pointer active:bg-secondary/20 rounded px-1 -ml-1 transition-colors")}
                  onClick={() => {
                    if (!isEditMode) return;
                    setEditModal({
                      label: `Country name #${idx + 1}`,
                      value: c.name,
                      isText: true,
                      onSave: ((v: any) => {
                        const updated = [...editCountries];
                        updated[idx] = { ...updated[idx], name: String(v) };
                        setEditCountries(updated);
                      }) as any,
                    });
                  }}
                >{c.name}</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-[8px] rounded-full bg-secondary/50 overflow-hidden">
                    <div className="h-full ig-bar-gradient" style={{ width: `${c.pct}%` }} />
                  </div>
                  <span
                    className={cn("text-[11px] text-foreground w-[36px] text-right select-none", isEditMode && "cursor-pointer active:bg-secondary/20 rounded px-1 -ml-1 transition-colors")}
                    onClick={() => {
                      if (!isEditMode) return;
                      setEditModal({
                        label: `${c.name} %`,
                        value: String(c.pct),
                        isText: false,
                        onSave: ((v: any) => {
                          const updated = [...editCountries];
                          updated[idx] = { ...updated[idx], pct: Math.min(100, Number(v)) };
                          setEditCountries(updated);
                        }) as any,
                      });
                    }}
                  >{c.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {audienceTab === "Age" && (
          <div className="space-y-1">
            {ageGroups.map((a, idx) => (
              <div key={idx}>
                <span
                  className={cn("text-[14px] text-foreground block mb-0.5 select-none", isEditMode && "cursor-pointer active:bg-secondary/20 rounded px-1 -ml-1 transition-colors")}
                  onClick={() => {
                    if (!isEditMode) return;
                    setEditModal({
                      label: `Age range #${idx + 1}`,
                      value: a.range,
                      isText: true,
                      onSave: ((v: any) => {
                        const updated = [...editAgeGroups];
                        updated[idx] = { ...updated[idx], range: String(v) };
                        setEditAgeGroups(updated);
                      }) as any,
                    });
                  }}
                >{a.range}</span>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-[8px] rounded-full bg-secondary/50 overflow-hidden">
                    <div className="h-full ig-bar-gradient" style={{ width: `${a.pct}%` }} />
                  </div>
                  <span
                    className={cn("text-[14px] text-foreground w-[48px] text-right select-none", isEditMode && "cursor-pointer active:bg-secondary/20 rounded px-1 -ml-1 transition-colors")}
                    onClick={() => {
                      if (!isEditMode) return;
                      setEditModal({
                        label: `${a.range} %`,
                        value: String(a.pct),
                        isText: false,
                        onSave: ((v: any) => {
                          const updated = [...editAgeGroups];
                          updated[idx] = { ...updated[idx], pct: Math.min(100, Number(v)) };
                          setEditAgeGroups(updated);
                        }) as any,
                      });
                    }}
                  >{a.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="h-[6px] bg-secondary" />

      {/* Monetisation */}
      <div className="px-4 py-5">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-[18px] font-bold text-foreground">Monetisation</h3>
          <Info size={16} className="text-muted-foreground" />
        </div>
        <h4 className="text-[15px] font-bold text-foreground mb-2">Gifts</h4>
        <div 
          className={cn("flex items-center justify-between", isEditMode && "cursor-pointer active:opacity-60")}
          onClick={() => isEditMode && setEditModal({
            label: "Monetisation Status",
            value: monetisationStatus,
            isText: true,
            onSave: ((v: string) => { setMonetisationStatus(v); persistEdits(); }) as any
          })}
        >
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#E040FB]" />
            <span className="text-[14px] text-foreground">{monetisationStatus}</span>
          </div>
          <button className="text-[14px] text-[#0095f6] font-medium" onClick={(e) => { e.stopPropagation(); toast.success("Feature coming soon!"); }}>{monetisationStatus.includes("Not") ? "Add payment details" : "View settings"}</button>
        </div>
      </div>

      {/* Edit Modal / Form */}
      {
        (editModal || graphEditorOpen || retentionEditorOpen) && (
          <div className="fixed inset-0 z-[90] bg-black/50 flex items-end justify-center" onClick={() => { setEditModal(null); setGraphEditorOpen(false); setRetentionEditorOpen(false); }}>
            <div className="w-full max-w-[420px] max-h-[85vh] overflow-y-auto rounded-t-2xl bg-background p-5 pb-8 animate-in slide-in-from-bottom" onClick={(e) => e.stopPropagation()}>
              {editModal && !graphEditorOpen && (
                <>
                  <h3 className="text-base font-bold text-foreground text-center mb-4">{editModal.label}</h3>
                  <input
                    value={editModal.value}
                    onChange={(e) => setEditModal({ ...editModal, value: e.target.value })}
                    type={editModal.isText || editModal.label.includes("Date") || editModal.label.includes("time") ? "text" : "number"}
                    min="0"
                    className="w-full bg-secondary rounded-lg px-4 py-2.5 text-[16px] text-foreground text-center outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (editModal.isText || editModal.label.includes("Date") || editModal.label.includes("time")) {
                        (editModal.onSave as any)(editModal.value);
                      } else {
                        editModal.onSave(Math.max(0, parseFloat(editModal.value) || 0));
                      }
                      setEditModal(null);
                      saveToSupabase();
                    }}
                    className="w-full mt-3 py-2.5 rounded-lg bg-[hsl(var(--ig-blue))] text-white text-[14px] font-semibold"
                  >
                    Done
                  </button>
                </>
              )}
              {graphEditorOpen && (
                <>
                  {/* Show Graph Toggle */}
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-[13px] text-foreground font-semibold">Show Graph</label>
                    <button
                      onClick={() => {
                        const newVal = !showGraph;
                        setShowGraph(newVal);
                        saveToSupabase({ showGraph: newVal });
                      }}
                      className={`w-[44px] h-[24px] rounded-full transition-colors ${showGraph ? 'bg-[hsl(var(--ig-blue))]' : 'bg-muted'}`}
                    >
                      <div className={`w-[20px] h-[20px] rounded-full bg-white shadow transition-transform mx-[2px] ${showGraph ? 'translate-x-[20px]' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground -mt-3 mb-3">Toggle off to hide the Views over time graph</p>

                  {/* Time Range Mode */}
                  <div className="mb-3">
                    <label className="text-[10px] text-muted-foreground mb-1 block">Time Range</label>
                    <div className="flex gap-1.5">
                      {(["custom", "12h", "24h"] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setTimeRangeMode(mode)}
                          className={cn(
                            "flex-1 py-1.5 rounded-lg text-[12px] font-semibold border transition-all",
                            timeRangeMode === mode
                              ? "border-foreground bg-foreground/10 text-foreground"
                              : "border-border bg-secondary/50 text-muted-foreground"
                          )}
                        >
                          {mode === "custom" ? "Custom" : mode}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Custom X-axis date editors */}
                  {timeRangeMode === "custom" && (
                    <div className="flex gap-1.5 mb-3">
                      {[
                        { val: editXDate1, set: setEditXDate1, label: "Start" },
                        { val: editXDate2, set: setEditXDate2, label: "Mid" },
                        { val: editXDate3, set: setEditXDate3, label: "End" },
                      ].map(({ val, set, label }) => (
                        <div key={label} className="flex-1">
                          <label className="text-[10px] text-muted-foreground mb-0.5 block">{label}</label>
                          <input
                            value={val}
                            onChange={(e) => { xDatesManuallyEdited.current = true; set(e.target.value); }}
                            className="w-full bg-secondary rounded-lg px-2 py-1.5 text-[11px] text-foreground outline-none text-center"
                            placeholder="23 Jan"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <GraphEditorModal
                    open={graphEditorOpen}
                    onClose={() => setGraphEditorOpen(false)}
                    onSave={(data) => {
                      setCustomGraphData(data);
                      if (data.length >= 5) {
                        xDatesManuallyEdited.current = true;
                        if (data[0].day) { setEditXDate1(data[0].day); setEditStartDate(data[0].day); }
                        if (data[2].day) setEditXDate2(data[2].day);
                        if (data[4].day) setEditXDate3(data[4].day);
                      }
                      saveToSupabase({ customGraphData: data });
                    }}
                    onDatesChange={(nd) => {
                      xDatesManuallyEdited.current = true;
                      setEditXDate1(nd[0]);
                      setEditXDate2(nd[1]);
                      setEditXDate3(nd[2]);
                    }}
                    controlledDates={[editXDate1, editXDate2, editXDate3] as [string, string, string]}
                    initialData={viewsOverTimeAll}
                    maxViews={editViews}
                    inline={true}
                  />
                </>
              )}
              {retentionEditorOpen && (
                <RetentionEditorModal
                  open={retentionEditorOpen}
                  onClose={() => setRetentionEditorOpen(false)}
                  initialData={editRetentionCurve}
                  initialTypical={typicalRetentionCurve}
                  onSave={(thisReel, typical) => {
                    setEditRetentionCurve(thisReel);
                    setTypicalRetentionCurve(typical);
                    saveToSupabase({ retentionCurve: thisReel, typicalRetentionCurve: typical });
                  }}
                  inline={true}
                />
              )}
            </div>
          </div>
        )
      }

      {/* 3 Dot Action Menu (Bottom Sheet) */}
      {isActionMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div 
            className="absolute inset-0"
            onClick={() => setIsActionMenuOpen(false)}
          />
          <div className="w-full bg-background rounded-t-3xl shadow-lg pb-10 mt-auto z-10 relative" style={{ animation: "slide-up 0.2s ease-out" }}>
            <style>{`
              @keyframes slide-up {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
              }
            `}</style>
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 flex-shrink-0 rounded-full bg-border" />
            </div>

            {/* Buttons List */}
            <div className="px-3 flex flex-col gap-2 pt-2">
              {/* Button 1: Boost this reel */}
              <button 
                className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-secondary/50 active:bg-secondary/70 transition-colors"
                onClick={() => setIsActionMenuOpen(false)}
              >
                <div className="flex items-center gap-3">
                  <TrendingUp size={22} className="text-foreground" />
                  <span className="text-[15px] font-medium text-foreground">Boost this reel</span>
                </div>
                <ChevronRight size={20} className="text-muted-foreground" />
              </button>

              {/* Button 2: View on Edits */}
              <button 
                className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-secondary/50 active:bg-secondary/70 transition-colors"
                onClick={() => setIsActionMenuOpen(false)}
              >
                <div className="flex items-center gap-3">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="12" y1="3" x2="12" y2="21" />
                  </svg>
                  <span className="text-[15px] font-medium text-foreground">View on Edits</span>
                </div>
                <ChevronRight size={20} className="text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReelInsightsScreen;
