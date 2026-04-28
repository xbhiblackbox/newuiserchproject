import { supabase } from "@/integrations/supabase/client";
import type { ExtendedPostItem } from "@/data/reelInsightsData";

export type OverrideData = Record<string, any>;
export const OWNED_REELS_ACCOUNT = "just4abhii";

const INSIGHT_KEYS = [
  "views", "likes", "comments", "shares", "reposts", "saves",
  "watchTime", "avgWatchTime", "followerViewsPct", "viewRatePast3Sec",
  "genderMale", "genderFemale", "countries", "ageGroups", "sources",
  "accountsReached", "follows", "skipRate", "typicalSkipRate",
  "retentionCurve", "engagementCurve", "typicalRetentionCurve",
] as const;

export function getReelsAccountKey(account: string, isMainAccount: boolean): string {
  return isMainAccount ? OWNED_REELS_ACCOUNT : account;
}

export function applyOverrideToReel(reel: ExtendedPostItem, override?: OverrideData | null): ExtendedPostItem {
  if (!override) return reel;
  const next: ExtendedPostItem = {
    ...reel,
    insights: {
      ...reel.insights,
      viewsOverTime: reel.insights.viewsOverTime?.map((point) => ({ ...point })) ?? [],
    },
  };

  for (const key of ["thumbnail", "videoUrl", "caption", "duration", "musicTitle", "musicIcon", "graphStartDate", "displayDate", "yCenter", "yTop", "showGraph", "profileVisits", "audienceText", "typicalViewRate", "monetisationStatus", "editTypicalTop", "timeRangeMode", "retentionImage"] as const) {
    if (override[key] !== undefined && override[key] !== null) (next as any)[key] = override[key];
  }
  if (override.engagementYCenter != null) (next as any).engagementYCenter = override.engagementYCenter;
  if (override.engagementYTop != null) (next as any).engagementYTop = override.engagementYTop;

  for (const key of INSIGHT_KEYS) {
    if (override[key] !== undefined && override[key] !== null) (next.insights as any)[key] = override[key];
  }
  if (Array.isArray(override.customGraphData)) next.insights.viewsOverTime = override.customGraphData;
  if (next.insights.viewsOverTime?.length >= 5) {
    if (override.xDate1) next.insights.viewsOverTime[0].day = String(override.xDate1);
    if (override.xDate2) next.insights.viewsOverTime[2].day = String(override.xDate2);
    if (override.xDate3) next.insights.viewsOverTime[4].day = String(override.xDate3);
  }

  return next;
}

export async function getOverride(account: string, postIndex: number): Promise<OverrideData | null> {
  const { data, error } = await supabase
    .from("reels_data")
    .select("data")
    .eq("account", account)
    .eq("post_index", postIndex)
    .maybeSingle();
  if (error) {
    console.error("getOverride", error);
    return null;
  }
  return (data?.data as OverrideData) ?? null;
}

export async function getAllOverrides(account: string): Promise<Record<number, OverrideData>> {
  const { data, error } = await supabase
    .from("reels_data")
    .select("post_index, data")
    .eq("account", account);
  if (error) {
    console.error("getAllOverrides", error);
    return {};
  }
  const out: Record<number, OverrideData> = {};
  (data ?? []).forEach((r: any) => {
    out[r.post_index] = (r.data as OverrideData) ?? {};
  });
  return out;
}

export async function saveOverride(
  account: string,
  postIndex: number,
  data: OverrideData
): Promise<boolean> {
  const { error } = await supabase
    .from("reels_data")
    .upsert(
      { account, post_index: postIndex, data, updated_at: new Date().toISOString() },
      { onConflict: "account,post_index" }
    );
  if (error) {
    console.error("saveOverride", error);
    return false;
  }
  return true;
}

export async function mergeAndSaveOverride(
  account: string,
  postIndex: number,
  data: OverrideData
): Promise<boolean> {
  const existing = await getOverride(account, postIndex);
  return saveOverride(account, postIndex, { ...(existing ?? {}), ...data });
}
