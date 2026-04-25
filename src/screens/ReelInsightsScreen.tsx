import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import * as React from "react";

import { ArrowLeft, MoreVertical, Heart, MessageCircle, Bookmark, Repeat2, Info, Pencil, X, Plus, TrendingUp, ChevronRight, Clock } from "lucide-react";
import InstagramShareIcon from "@/components/icons/InstagramShareIcon";
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
  const [editGraphYMax, setEditGraphYMax] = useState<number | null>(null);

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
    { name: "Feed", pct: 63.4 }, { name: "Reels tab", pct: 11.1 }, { name: "Stories", pct: 10.6 }, { name: "Explore", pct: 7.4 },
  ]);
  const [editAccountsReached, setEditAccountsReached] = useState(ins?.accountsReached ?? 567);
  const [editFollows, setEditFollows] = useState(ins?.follows ?? 0);
  const [monetisationStatus, setMonetisationStatus] = useState((post as any)?.monetisationStatus || "Not monetising");
  const [editTypicalViewRate, setEditTypicalViewRate] = useState((post as any)?.typicalViewRate ?? 41.1);
  const [editProfileVisits, setEditProfileVisits] = useState((post as any)?.profileVisits ?? 0);
  const [editAudienceText, setEditAudienceText] = useState((post as any)?.audienceText ?? "Audience demographics, such as top locations, age ranges and gender, are not available because fewer than 100 accounts interacted with your content during the selected time period.");
  const [activeTab, setActiveTab] = useState<"Overview" | "Engagement" | "Audience">("Overview");
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
        if (d.graphYMax != null) setEditGraphYMax(d.graphYMax as number);
        if (d.sources) setEditSources((d.sources as { name: string; pct: number }[]).slice(0, 4));
        if (d.countries) setEditCountries(d.countries as { name: string; pct: number }[]);
        if (d.ageGroups) setEditAgeGroups(d.ageGroups as { range: string; pct: number }[]);
        if (d.accountsReached != null) setEditAccountsReached(d.accountsReached as number);
        if (d.follows != null) setEditFollows(d.follows as number);
        if (d.thumbnail) setPostImage(d.thumbnail as string);
        if (d.videoUrl) setPostVideoUrl(d.videoUrl as string);
        if (d.caption) setPostCaption(d.caption as string);
        if (d.retentionImage) setRetentionImageUrl(d.retentionImage as string);
        if (d.audienceText) setEditAudienceText(d.audienceText as string);
        if (d.profileVisits != null) setEditProfileVisits(d.profileVisits as number);
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
  const sources = editSources.slice(0, 4);
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
          <div className="w-[29px] h-[29px] shrink-0" />
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
          <button onClick={() => navigate('/profile')} className="text-foreground">
            <ArrowLeft size={22} strokeWidth={1.8} />
          </button>
          <h1 
            className="text-[17px] font-semibold text-foreground"
            onClick={() => { if (!isEditMode) { setIsEditMode(true); toast.info("Edit mode active"); } }}
          >
            Reel insights
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <TrendingUp size={22} className="text-foreground" />
          {!isEditMode ? (
            <button onClick={() => setIsActionMenuOpen(true)} className="p-1 text-foreground active:opacity-60">
              <MoreVertical size={21} />
            </button>
          ) : (
            <button 
              onClick={() => { setIsEditMode(false); saveToSupabase(); persistEdits(); toast.success("All changes saved"); }}
              className="text-[14px] font-bold text-[hsl(var(--ig-blue))] leading-none"
            >
              Done
            </button>
          )}
        </div>
      </header>

      {/* Reel Preview - Large square thumbnail */}
      <div className="flex flex-col items-center pt-2 pb-3 px-4">
        <label className={cn("w-[120px] rounded-lg overflow-hidden shadow-md relative block", isEditMode && "cursor-pointer active:opacity-60")}>
          {isEditMode && (
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const tid = toast.loading("Uploading thumbnail...");
              try {
                const url = await uploadToCloudinary(file);
                setPostImage(url);
                saveToSupabase({ thumbnail: url });
                toast.success("Thumbnail updated!", { id: tid });
              } catch (err) { toast.error("Upload failed", { id: tid }); }
            }} />
          )}
          <img src={postImage} alt="Reel thumbnail" className="w-full aspect-[9/16] object-cover" />
          {isEditMode && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
              <Plus size={24} className="text-white drop-shadow-lg" />
            </div>
          )}
        </label>
      </div>

      {/* Engagement Stats Row */}
      <div className="flex justify-around px-4 py-3">
        {[
          { icon: <Heart size={18} className="text-foreground" />, val: likes, set: setEditLikes, label: "Likes" },
          { icon: <MessageCircle size={18} className="text-foreground -scale-x-100" />, val: comments, set: setEditComments, label: "Comments" },
          { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground"><polyline points="17 1 21 5 17 9" /><path d="M3 12V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 12v3a4 4 0 0 1-4 4H3" /></svg>, val: reposts, set: setEditReposts, label: "Reposts" },
          { icon: <InstagramShareIcon size={18} className="text-foreground" />, val: shares, set: setEditShares, label: "Shares" },
          { icon: <Bookmark size={18} className="text-foreground" />, val: saves, set: setEditSaves, label: "Saves" },
        ].map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => isEditMode && setEditModal({ label: item.label, value: String(item.val), onSave: item.set })}>
            {item.icon}
            <span className="text-[13px] font-medium text-foreground">{fmtNum(item.val)}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["Overview", "Engagement", "Audience"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-3 text-[14px] font-medium text-center transition-colors relative",
              activeTab === tab ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {tab}
            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />}
          </button>
        ))}
      </div>

      {/* ═══════════ OVERVIEW TAB ═══════════ */}
      {activeTab === "Overview" && (
        <div>
          {/* Summary section */}
          <div className="px-4 py-5">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-[16px] font-bold text-foreground">Summary</h2>
              <Info size={14} className="text-muted-foreground" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Views", value: fmtNum(views), onEdit: () => setEditModal({ label: "Views", value: String(views), onSave: setEditViews }) },
                { label: "Accounts reached", value: fmtNum(accountsReached), onEdit: () => setEditModal({ label: "Accounts reached", value: String(accountsReached), onSave: setEditAccountsReached }) },
                { label: "Average watch time", value: avgWatchTime, onEdit: () => setEditModal({ label: "Average watch time", value: editAvgWatchTime, isText: true, onSave: ((v: any) => setEditAvgWatchTime(String(v))) as any }) },
                { label: "Follows", value: String(follows), onEdit: () => setEditModal({ label: "Follows", value: String(follows), onSave: setEditFollows }) },
              ].map((item) => (
                <div 
                  key={item.label}
                  className={cn("bg-secondary rounded-xl p-4", isEditMode && "cursor-pointer active:opacity-60")}
                  onClick={() => isEditMode && item.onEdit()}
                >
                  <span className="text-[12px] text-muted-foreground block mb-1">{item.label}</span>
                  <span className="text-[20px] font-bold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Views row */}
          <div className="px-4 pb-2">
            <div className={cn("flex items-center justify-between", isEditMode && "cursor-pointer active:opacity-60")} onClick={() => isEditMode && setEditModal({ label: "Views", value: String(views), onSave: setEditViews })}>
              <div className="flex items-center gap-2">
                <span className="text-[16px] font-bold text-foreground">Views</span>
                <Info size={14} className="text-muted-foreground" />
              </div>
              <span className="text-[16px] font-bold text-foreground">{fmtNum(views)}</span>
            </div>
          </div>

          {/* Views over time graph (editable) */}
          {showGraph && (
            <div className="px-4 pt-2 pb-4">
              {/* All / Followers / Non-followers pills */}
              <div className="flex gap-2 mb-3">
                {(["All", "Followers", "Non-followers"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setViewsFilter(opt)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-[13px] font-semibold border transition-colors",
                      viewsFilter === opt
                        ? "bg-secondary text-foreground border-transparent"
                        : "bg-transparent text-foreground border-border"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              {/* Chart */}
              <div
                className={cn("h-[180px] -ml-2 relative", isEditMode && "cursor-pointer active:opacity-80 transition-opacity")}
                onClick={() => isEditMode && setGraphEditorOpen(true)}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={viewsOverTime} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={42}
                      domain={[0, editYTop]}
                      ticks={[0, editYCenter, editYTop]}
                      interval={0}
                      tickFormatter={(v: number) => v === 0 ? '0' : v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K` : String(v)}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    {/* Always show 3 horizontal grid lines: bottom, middle, top */}
                    <ReferenceLine y={0} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <ReferenceLine y={editYCenter} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <ReferenceLine y={editYTop} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <Line type="monotone" dataKey="typical" stroke="hsl(var(--muted-foreground))" strokeWidth={2.5} strokeDasharray="6 6" dot={false} />
                    <Line type="monotone" dataKey="thisReel" stroke="#E040FB" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                {isEditMode && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditModal({ label: "Y-axis Top value", value: String(editYTop), onSave: (v) => { setEditYTop(Math.max(1, v)); } }); }}
                      className="absolute left-0 top-[6px] w-[42px] h-[26px] bg-[hsl(var(--ig-blue))]/15 rounded"
                      aria-label="Edit top Y value"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditModal({ label: "Y-axis Middle value", value: String(editYCenter), onSave: (v) => { setEditYCenter(Math.max(0, v)); } }); }}
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[42px] h-[26px] bg-[hsl(var(--ig-blue))]/15 rounded"
                      aria-label="Edit middle Y value"
                    />
                  </>
                )}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-5 mt-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#E040FB]" />
                  <span className="text-[12px] text-foreground">This reel</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                  <span className="text-[12px] text-foreground">Your typical reel</span>
                </div>
              </div>
            </div>
          )}

          {/* What affects your views */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[16px] font-bold text-foreground">What affects your views</h3>
              <Info size={14} className="text-muted-foreground" />
            </div>
            <p className="text-[12px] text-muted-foreground mb-3">Rates are listed in order of importance to reach.</p>
            <div className="space-y-1">
              {[
                { icon: Clock, label: "Skip rate", pct: editSkipRate, onEdit: () => setEditModal({ label: "Skip rate %", value: String(editSkipRate), onSave: (v) => setEditSkipRate(Math.min(100, Math.max(0, v))) }) },
                { icon: InstagramShareIcon, label: "Share rate", pct: views > 0 ? (editShares / views) * 100 : 0, onEdit: () => setEditModal({ label: "Share rate %", value: String(views > 0 ? ((editShares / views) * 100).toFixed(2) : "0"), onSave: (v) => setEditShares(Math.round((Math.min(100, Math.max(0, v)) / 100) * views)) }) },
                { icon: Heart, label: "Like rate", pct: views > 0 ? (editLikes / views) * 100 : 0, onEdit: () => setEditModal({ label: "Like rate %", value: String(views > 0 ? ((editLikes / views) * 100).toFixed(2) : "0"), onSave: (v) => setEditLikes(Math.round((Math.min(100, Math.max(0, v)) / 100) * views)) }) },
                { icon: Bookmark, label: "Save rate", pct: views > 0 ? (editSaves / views) * 100 : 0, onEdit: () => setEditModal({ label: "Save rate %", value: String(views > 0 ? ((editSaves / views) * 100).toFixed(2) : "0"), onSave: (v) => setEditSaves(Math.round((Math.min(100, Math.max(0, v)) / 100) * views)) }) },
                { icon: Repeat2, label: "Repost rate", pct: views > 0 ? (editReposts / views) * 100 : 0, onEdit: () => setEditModal({ label: "Repost rate %", value: String(views > 0 ? ((editReposts / views) * 100).toFixed(2) : "0"), onSave: (v) => setEditReposts(Math.round((Math.min(100, Math.max(0, v)) / 100) * views)) }) },
                { icon: MessageCircle, label: "Comment rate", pct: views > 0 ? (editComments / views) * 100 : 0, onEdit: () => setEditModal({ label: "Comment rate %", value: String(views > 0 ? ((editComments / views) * 100).toFixed(2) : "0"), onSave: (v) => setEditComments(Math.round((Math.min(100, Math.max(0, v)) / 100) * views)) }) },
              ].map(({ icon: Icon, label, pct, onEdit }) => (
                <div
                  key={label}
                  className={cn("flex items-center justify-between py-2.5", isEditMode && "cursor-pointer active:opacity-60")}
                  onClick={() => isEditMode && onEdit()}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
                      <Icon size={18} className="text-foreground" strokeWidth={1.8} />
                    </div>
                    <span className="text-[15px] text-foreground">{label}</span>
                  </div>
                  <span className="text-[15px] font-bold text-foreground">{pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* How long people watched your reel */}
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-[16px] font-bold text-foreground">How long people watched your reel</h3>
              <Info size={14} className="text-muted-foreground" />
            </div>

            {/* Phone mockup with thumbnail */}
            <div className="flex justify-center mb-4">
              <div className="relative w-[100px] h-[178px] rounded-[18px] overflow-hidden bg-black shadow-lg">
                <img src={postImage} alt="Reel thumbnail" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round">
                    <polygon points="6,3 21,12 6,21" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Retention graph */}
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
            {isEditMode && (
              <div className="flex items-center gap-3 mt-2 justify-end">
                {retentionImageUrl && (
                  <button onClick={() => { setRetentionImageUrl(''); saveToSupabase({ retentionImage: '' }); }} className="text-[11px] font-bold text-red-500">Remove Image</button>
                )}
                <label className="text-[11px] text-[hsl(var(--ig-blue))] font-bold flex items-center gap-1 cursor-pointer active:opacity-60">
                  <Plus size={12} /> Upload Image
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const tid = toast.loading("Uploading graph...");
                    try {
                      const url = await uploadToCloudinary(file);
                      setRetentionImageUrl(url);
                      saveToSupabase({ retentionImage: url });
                      toast.success("Graph updated!", { id: tid });
                    } catch (err) { toast.error("Upload failed", { id: tid }); }
                  }} />
                </label>
              </div>
            )}
          </div>

          <div className="h-[1px] bg-border mx-4" />

          {/* Top sources of views */}
          <div className="px-4 py-5">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-[16px] font-bold text-foreground">Top sources of views</h3>
              <Info size={14} className="text-muted-foreground" />
            </div>
            <div className="space-y-3">
              {sources.map((item, idx) => (
                <div key={idx}>
                  <span className={cn("text-[13px] text-foreground block mb-1 select-none", isEditMode && "cursor-pointer active:bg-secondary/20 rounded px-1 -ml-1")}
                    onClick={() => isEditMode && setEditModal({ label: `Source name #${idx + 1}`, value: item.name, isText: true, onSave: ((v: any) => { const updated = [...editSources]; updated[idx] = { ...updated[idx], name: String(v) }; setEditSources(updated); }) as any })}
                  >{item.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-[8px] rounded-full bg-secondary/50 overflow-hidden">
                      <div className="h-full ig-bar-gradient" style={{ width: `${item.pct}%` }} />
                    </div>
                    <span className={cn("text-[13px] text-foreground w-[42px] text-right select-none", isEditMode && "cursor-pointer active:bg-secondary/20 rounded px-1")}
                      onClick={() => isEditMode && setEditModal({ label: `${item.name} %`, value: String(item.pct), onSave: ((v: any) => { const updated = [...editSources]; updated[idx] = { ...updated[idx], pct: Math.min(100, Number(v)) }; setEditSources(updated); }) as any })}
                    >{item.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="h-[1px] bg-border mx-4" />

          {/* Ad section */}
          <div className="px-4 py-5">
            <h3 className="text-[16px] font-bold text-foreground mb-3">Ad</h3>
            <button className="w-full flex items-center justify-between py-2" onClick={() => {}}>
              <div className="flex items-center gap-3">
                <TrendingUp size={22} className="text-foreground" />
                <span className="text-[15px] text-foreground">Boost this Reel</span>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ ENGAGEMENT TAB ═══════════ */}
      {activeTab === "Engagement" && (
        <div>
          {/* When people liked your reel */}
          <div className="px-4 py-5">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-[16px] font-bold text-foreground">When people liked your reel</h3>
              <Info size={14} className="text-muted-foreground" />
            </div>
            <div className="relative select-none">
              <div className={cn("h-[180px]", isEditMode && "cursor-pointer active:opacity-80")} onClick={() => isEditMode && setRetentionEditorOpen(true)}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={editRetentionCurve} margin={{ top: 5, right: 5, left: -5, bottom: 0 }}>
                    <CartesianGrid horizontal={true} vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.3} />
                    <XAxis dataKey="t" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} width={46} domain={[0, 100]} ticks={[0, 25, 50]} tickFormatter={(v: number) => v === 0 ? '0' : `${v}%`} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Line type="linear" dataKey="pct" stroke="#E040FB" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-border mx-4" />

          {/* Actions after viewing */}
          <div className="px-4 py-5">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-[16px] font-bold text-foreground">Actions after viewing</h3>
              <Info size={14} className="text-muted-foreground" />
            </div>
            <div className="space-y-3">
              <div className={cn("flex items-center justify-between", isEditMode && "cursor-pointer active:opacity-60")} onClick={() => isEditMode && setEditModal({ label: "Follows", value: String(follows), onSave: setEditFollows })}>
                <span className="text-[15px] text-foreground">Follows</span>
                <span className="text-[15px] font-bold text-foreground">{follows}</span>
              </div>
              <div className={cn("flex items-center justify-between", isEditMode && "cursor-pointer active:opacity-60")} onClick={() => isEditMode && setEditModal({ label: "Profile visits", value: String(editProfileVisits), onSave: setEditProfileVisits })}>
                <span className="text-[15px] text-foreground">Profile visits</span>
                <span className="text-[15px] font-bold text-foreground">{editProfileVisits}</span>
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-border mx-4" />

          {/* Interactions */}
          <div className="px-4 py-5">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-[16px] font-bold text-foreground">Interactions</h3>
              <Info size={14} className="text-muted-foreground" />
            </div>
            <div className="space-y-3">
              {[
                { label: "Likes", value: likes, set: setEditLikes },
                { label: "Comments", value: comments, set: setEditComments },
                { label: "Reposts", value: reposts, set: setEditReposts },
                { label: "Shares", value: shares, set: setEditShares },
                { label: "Saves", value: saves, set: setEditSaves },
              ].map((item) => (
                <div key={item.label} className={cn("flex items-center justify-between", isEditMode && "cursor-pointer active:opacity-60")} onClick={() => isEditMode && setEditModal({ label: item.label, value: String(item.value), onSave: item.set })}>
                  <span className="text-[15px] text-foreground">{item.label}</span>
                  <span className="text-[15px] font-bold text-foreground">{fmtNum(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ AUDIENCE TAB ═══════════ */}
      {activeTab === "Audience" && (
        <div>
          {/* Who viewed your reel */}
          <div className="px-4 py-5">
            <div className="flex items-center gap-2 mb-5">
              <h3 className="text-[16px] font-bold text-foreground">Who viewed your reel</h3>
              <Info size={14} className="text-muted-foreground" />
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-[14px] text-foreground block mb-1.5">Followers</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-[8px] rounded-full bg-secondary/50 overflow-hidden">
                    <div className="h-full ig-bar-gradient" style={{ width: `${followerPct}%` }} />
                  </div>
                  <span className={cn("text-[14px] text-foreground w-[42px] text-right", isEditMode && "cursor-pointer active:opacity-60 bg-secondary/30 rounded px-1")}
                    onClick={() => isEditMode && setEditModal({ label: "Followers %", value: String(followerPct), onSave: (v) => setEditFollowerPct(Math.min(100, v)) })}
                  >{followerPct}%</span>
                </div>
              </div>
              <div>
                <span className="text-[14px] text-foreground block mb-1.5">Non-followers</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-[8px] rounded-full bg-secondary/50 overflow-hidden">
                    <div className="h-full bg-[#7C4DFF]" style={{ width: `${nonFollowerPct}%` }} />
                  </div>
                  <span className={cn("text-[14px] text-foreground w-[42px] text-right", isEditMode && "cursor-pointer active:opacity-60 bg-secondary/30 rounded px-1")}
                    onClick={() => isEditMode && setEditModal({ label: "Non-followers % (auto = 100 - followers)", value: String(nonFollowerPct), onSave: (v) => setEditFollowerPct(100 - Math.min(100, v)) })}
                  >{nonFollowerPct}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-border mx-4" />

          {/* Audience details */}
          <div className="px-4 py-5">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-[16px] font-bold text-foreground">Audience details</h3>
              <Info size={14} className="text-muted-foreground" />
            </div>
            {/* Age / Country / Gender pill tabs */}
            <div className="flex items-center gap-2 mb-5">
              {(["Age", "Country", "Gender"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAudienceTab(tab)}
                  className={cn(
                    "px-5 py-2 rounded-full text-[14px] font-medium border transition-colors",
                    audienceTab === tab
                      ? "bg-secondary text-foreground border-transparent"
                      : "bg-transparent text-foreground border-border"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Age view */}
            {audienceTab === "Age" && (
              <div className="space-y-1">
                {ageGroups.map((g, idx) => (
                  <div key={g.range}>
                    <div className="text-[13px] text-foreground mb-1">{g.range}</div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-[8px] rounded-full bg-secondary/50 overflow-hidden">
                        <div
                          className="h-full ig-bar-gradient"
                          style={{ width: `${Math.min(100, g.pct)}%` }}
                        />
                      </div>
                      <span
                        className={cn("text-[14px] text-foreground min-w-[48px] text-right", isEditMode && "cursor-pointer")}
                        onClick={() => isEditMode && setEditModal({
                          label: `${g.range} %`,
                          value: String(g.pct),
                          onSave: (v) => {
                            const next = [...editAgeGroups];
                            next[idx] = { ...next[idx], pct: Math.min(100, Math.max(0, v)) };
                            setEditAgeGroups(next);
                          },
                        })}
                      >
                        {g.pct % 1 === 0 ? `${g.pct}%` : `${g.pct.toFixed(1)}%`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Country view */}
            {audienceTab === "Country" && (
              <div className="space-y-1">
                {editCountries.map((c, idx) => (
                  <div key={c.name}>
                    <div
                      className={cn("text-[13px] text-foreground mb-1", isEditMode && "cursor-pointer")}
                      onClick={() => isEditMode && setEditModal({
                        label: "Country name",
                        value: c.name,
                        isText: true,
                        onSave: ((v: any) => {
                          const next = [...editCountries];
                          next[idx] = { ...next[idx], name: String(v) };
                          setEditCountries(next);
                        }) as any,
                      })}
                    >
                      {c.name}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-[8px] rounded-full bg-secondary/50 overflow-hidden">
                        <div
                          className="h-full ig-bar-gradient"
                          style={{ width: `${Math.min(100, c.pct)}%` }}
                        />
                      </div>
                      <span
                        className={cn("text-[14px] text-foreground min-w-[48px] text-right", isEditMode && "cursor-pointer")}
                        onClick={() => isEditMode && setEditModal({
                          label: `${c.name} %`,
                          value: String(c.pct),
                          onSave: (v) => {
                            const next = [...editCountries];
                            next[idx] = { ...next[idx], pct: Math.min(100, Math.max(0, v)) };
                            setEditCountries(next);
                          },
                        })}
                      >
                        {c.pct % 1 === 0 ? `${c.pct}%` : `${c.pct.toFixed(1)}%`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Gender view */}
            {audienceTab === "Gender" && (
              <div className="space-y-1">
                {[
                  { label: "Men", pct: editGenderMale },
                  { label: "Women", pct: 100 - editGenderMale },
                ].map(({ label, pct }) => (
                  <div key={label}>
                    <div className="text-[13px] text-foreground mb-1">{label}</div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-[8px] rounded-full bg-secondary/50 overflow-hidden">
                        <div
                          className="h-full ig-bar-gradient"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span
                        className={cn("text-[14px] text-foreground min-w-[48px] text-right", isEditMode && label === "Men" && "cursor-pointer")}
                        onClick={() => isEditMode && label === "Men" && setEditModal({
                          label: "Men %",
                          value: String(editGenderMale),
                          onSave: (v) => setEditGenderMale(Math.min(100, Math.max(0, v))),
                        })}
                      >
                        {pct % 1 === 0 ? `${pct}%` : `${pct.toFixed(1)}%`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal / Form */}
      {(editModal || graphEditorOpen || retentionEditorOpen) && (
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
                <div className="flex items-center justify-between mb-4">
                  <label className="text-[13px] text-foreground font-semibold">Show Graph</label>
                  <button
                    onClick={() => { const newVal = !showGraph; setShowGraph(newVal); saveToSupabase({ showGraph: newVal }); }}
                    className={`w-[44px] h-[24px] rounded-full transition-colors ${showGraph ? 'bg-[hsl(var(--ig-blue))]' : 'bg-muted'}`}
                  >
                    <div className={`w-[20px] h-[20px] rounded-full bg-white shadow transition-transform mx-[2px] ${showGraph ? 'translate-x-[20px]' : 'translate-x-0'}`} />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground -mt-3 mb-3">Toggle off to hide the Views over time graph</p>
                <div className="mb-3">
                  <label className="text-[10px] text-muted-foreground mb-1 block">Time Range</label>
                  <div className="flex gap-1.5">
                    {(["custom", "12h", "24h"] as const).map((mode) => (
                      <button key={mode} onClick={() => setTimeRangeMode(mode)}
                        className={cn("flex-1 py-1.5 rounded-lg text-[12px] font-semibold border transition-all", timeRangeMode === mode ? "border-foreground bg-foreground/10 text-foreground" : "border-border bg-secondary/50 text-muted-foreground")}>
                        {mode === "custom" ? "Custom" : mode}
                      </button>
                    ))}
                  </div>
                </div>
                {timeRangeMode === "custom" && (
                  <div className="flex gap-1.5 mb-3">
                    {[{ val: editXDate1, set: setEditXDate1, label: "Start" }, { val: editXDate2, set: setEditXDate2, label: "Mid" }, { val: editXDate3, set: setEditXDate3, label: "End" }].map(({ val, set, label }) => (
                      <div key={label} className="flex-1">
                        <label className="text-[10px] text-muted-foreground mb-0.5 block">{label}</label>
                        <input value={val} onChange={(e) => { xDatesManuallyEdited.current = true; set(e.target.value); }} className="w-full bg-secondary rounded-lg px-2 py-1.5 text-[11px] text-foreground outline-none text-center" placeholder="23 Jan" />
                      </div>
                    ))}
                  </div>
                )}
                <GraphEditorModal
                  open={graphEditorOpen} onClose={() => setGraphEditorOpen(false)}
                  onSave={(data) => { setCustomGraphData(data); if (data.length >= 5) { xDatesManuallyEdited.current = true; if (data[0].day) { setEditXDate1(data[0].day); setEditStartDate(data[0].day); } if (data[2].day) setEditXDate2(data[2].day); if (data[4].day) setEditXDate3(data[4].day); } saveToSupabase({ customGraphData: data }); }}
                  onDatesChange={(nd) => { xDatesManuallyEdited.current = true; setEditXDate1(nd[0]); setEditXDate2(nd[1]); setEditXDate3(nd[2]); }}
                  controlledDates={[editXDate1, editXDate2, editXDate3] as [string, string, string]}
                  initialData={viewsOverTimeAll} maxViews={editYTop} inline={true}
                />
              </>
            )}
            {retentionEditorOpen && (
              <RetentionEditorModal
                open={retentionEditorOpen} onClose={() => setRetentionEditorOpen(false)}
                initialData={editRetentionCurve} initialTypical={typicalRetentionCurve}
                onSave={(thisReel, typical) => { setEditRetentionCurve(thisReel); setTypicalRetentionCurve(typical); saveToSupabase({ retentionCurve: thisReel, typicalRetentionCurve: typical }); }}
                inline={true}
              />
            )}
          </div>
        </div>
      )}

      {/* 3 Dot Action Menu */}
      {isActionMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="absolute inset-0" onClick={() => setIsActionMenuOpen(false)} />
          <div className="w-full bg-background rounded-t-3xl shadow-lg pb-10 mt-auto z-10 relative" style={{ animation: "slide-up 0.2s ease-out" }}>
            <style>{`@keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 flex-shrink-0 rounded-full bg-border" />
            </div>
            <div className="px-3 flex flex-col gap-2 pt-2">
              <button className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-secondary/50 active:bg-secondary/70 transition-colors" onClick={() => setIsActionMenuOpen(false)}>
                <div className="flex items-center gap-3">
                  <TrendingUp size={22} className="text-foreground" />
                  <span className="text-[15px] font-medium text-foreground">Boost this reel</span>
                </div>
                <ChevronRight size={20} className="text-muted-foreground" />
              </button>
              <button className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-secondary/50 active:bg-secondary/70 transition-colors" onClick={() => setIsActionMenuOpen(false)}>
                <div className="flex items-center gap-3">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="12" y1="3" x2="12" y2="21" /></svg>
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
