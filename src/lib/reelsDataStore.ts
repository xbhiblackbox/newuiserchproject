import { supabase } from "@/integrations/supabase/client";

export type OverrideData = Record<string, any>;

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
