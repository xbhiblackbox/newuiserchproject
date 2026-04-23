import { supabase } from "@/integrations/supabase/client";

export async function uploadReelMedia(
  file: File,
  account: string,
  postIndex: number
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${account}/${postIndex}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from("reel-media")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("reel-media").getPublicUrl(path);
  return data.publicUrl;
}
