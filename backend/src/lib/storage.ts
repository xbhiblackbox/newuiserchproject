import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let s3Client: S3Client | null = null;

function getS3(): S3Client | null {
  if (
    !process.env.R2_ACCOUNT_ID ||
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY
  ) {
    return null;
  }
  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

export async function uploadFile(
  path: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const s3 = getS3();
  const bucket = process.env.R2_BUCKET || "reel-media";

  if (s3) {
    // R2 upload
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        Body: body,
        ContentType: contentType,
      })
    );
    const baseUrl = process.env.R2_PUBLIC_URL || "";
    return `${baseUrl}/${path}`;
  }

  // Fallback: local Railway volume
  const fs = await import("fs/promises");
  const nodePath = await import("path");
  const dir = "/data/reel-media";
  await fs.mkdir(nodePath.dirname(`${dir}/${path}`), { recursive: true });
  await fs.writeFile(`${dir}/${path}`, body);
  const base = process.env.PUBLIC_BASE_URL || "";
  return `${base}/storage/${path}`;
}

export function getPublicUrl(path: string): string {
  const s3 = getS3();
  const baseUrl = process.env.R2_PUBLIC_URL || "";
  if (s3 && baseUrl) {
    return `${baseUrl}/${path}`;
  }
  const base = process.env.PUBLIC_BASE_URL || "";
  return `${base}/storage/${path}`;
}
