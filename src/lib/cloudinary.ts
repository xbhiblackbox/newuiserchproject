/**
 * Media Upload Utility
 * Uses Lovable Cloud Storage (reel-media bucket) for permanent file hosting.
 * Falls back to base64 if upload fails.
 */

import { supabase } from "@/integrations/supabase/client";

export interface UploadResponse {
  url: string;
}

/**
 * Upload a file to Lovable Cloud Storage
 * @param file - File to upload
 * @param onProgress - Optional progress callback (0-100)
 * @returns The permanent public URL of the uploaded file
 */
export async function uploadToCloudinary(
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  // Generate a unique filename
  const ext = file.name.split(".").pop() || (file.type.includes("video") ? "mp4" : "jpg");
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const filePath = `uploads/${timestamp}-${random}.${ext}`;

  onProgress?.(10);

  const { data, error } = await supabase.storage
    .from("reel-media")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("[Storage] Upload failed:", error.message);
    throw new Error(`Upload failed: ${error.message}`);
  }

  onProgress?.(90);

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("reel-media")
    .getPublicUrl(data.path);

  onProgress?.(100);

  console.log("[Storage] Upload success:", urlData.publicUrl);
  return urlData.publicUrl;
}
