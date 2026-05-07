import { Router, Request, Response } from "express";
import { z } from "zod";
import { callRapid } from "../lib/rapidapi";
import { queryOne, execute } from "../lib/db";
import { sendToAllAdmins } from "../lib/telegram";
import {
  cacheGet, cacheSet, l2Get, l2Set,
  getInflight, setInflight, deleteInflight,
} from "../lib/cache";
import {
  normalizeProfile, normalizeMediaItem, dedupeMediaItems,
  normalizeHighlight, newTraceId, str, num
} from "../lib/scraperHelpers";

const router = Router();

const ScrapeReqSchema = z.object({
  username: z.string().min(1),
  type: z.enum(["profile", "reels", "posts", "highlights", "all"]).default("all"),
  force: z.boolean().default(false),
  pages: z.number().min(1).max(10).default(1),
  cursor: z.string().optional(),
});

// ─── Instagram Looter 2 (instagram-looter2.p.rapidapi.com) helpers ───────────

/**
 * Step 1: Resolve username → numeric user ID.
 * Tries multiple endpoint variants since the API changes frequently.
 */
const userIdCache = new Map<string, string>();

async function resolveUserId(username: string): Promise<string> {
  const cached = userIdCache.get(username);
  if (cached) return cached;

  // Try multiple ID resolution endpoints
  const idPaths = [
    `/id?username=${encodeURIComponent(username)}`,
    `/user-id?username=${encodeURIComponent(username)}`,
    `/userid?username=${encodeURIComponent(username)}`,
    `/get-id?username=${encodeURIComponent(username)}`,
  ];

  for (const path of idPaths) {
    try {
      const data = await callRapid(path, { method: "GET" }, () => {});
      // Response can be: { id: "12345" } or { data: { id: "12345" } } or just a string/"12345"
      let id = str(data?.id ?? data?.data?.id ?? data?.user_id ?? data?.pk ?? data?.userId ?? data?.user?.pk ?? data?.user?.id ?? "");
      // If data is a plain number/string directly
      if (!id && (typeof data === "string" || typeof data === "number")) {
        id = str(data);
      }
      if (id && id !== "0" && /^\d+$/.test(id.trim())) {
        userIdCache.set(username, id.trim());
        console.log(`[looter2] resolved userId for @${username} via ${path}: ${id}`);
        return id.trim();
      }
    } catch (e: any) {
      console.warn(`[looter2] resolveUserId failed for path ${path}:`, e.message);
    }
  }

  throw new Error(`Could not resolve user ID for @${username}`);
}

/**
 * Step 2: Fetch profile by username — tries many endpoint variants.
 */
async function scrapeProfile(username: string): Promise<any> {
  const errors: string[] = [];

  // Attempt 1: username-based profile endpoints (no ID needed)
  const usernamePaths = [
    `/web-profile?username=${encodeURIComponent(username)}`,
    `/profile?username=${encodeURIComponent(username)}`,
    `/user-info?username=${encodeURIComponent(username)}`,
    `/user?username=${encodeURIComponent(username)}`,
    `/get-user?username=${encodeURIComponent(username)}`,
    `/userinfo?username=${encodeURIComponent(username)}`,
    `/user-by-username?username=${encodeURIComponent(username)}`,
    `/users?username=${encodeURIComponent(username)}`,
  ];

  for (const path of usernamePaths) {
    try {
      const data = await callRapid(path, { method: "GET" }, () => {});
      console.log(`[looter2] ${path} keys:`, data ? Object.keys(data).slice(0, 8).join(",") : "null");
      if (data && (data.data || data.user || data.username || data.pk || data.id || data.result)) {
        const normalized = normalizeProfile(data);
        if (normalized.username || normalized.followers) {
          console.log(`[looter2] profile success via ${path}`);
          return normalized;
        }
      }
    } catch (e: any) {
      errors.push(`${path}: ${e.message}`);
      console.warn(`[looter2] profile variant failed: ${path}`, e.message);
    }
  }

  // Attempt 2: ID-based profile endpoints
  let uid: string | null = null;
  try {
    uid = await resolveUserId(username);
  } catch (e: any) {
    errors.push(`resolveUserId: ${e.message}`);
  }

  if (uid) {
    const idPaths = [
      `/user-info?id=${encodeURIComponent(uid)}`,
      `/user?id=${encodeURIComponent(uid)}`,
      `/profile?id=${encodeURIComponent(uid)}`,
      `/user-by-id?id=${encodeURIComponent(uid)}`,
    ];
    for (const path of idPaths) {
      try {
        const data = await callRapid(path, { method: "GET" }, () => {});
        console.log(`[looter2] ${path} keys:`, data ? Object.keys(data).slice(0, 8).join(",") : "null");
        if (data && (data.data || data.user || data.username || data.pk || data.result)) {
          const normalized = normalizeProfile(data);
          if (normalized.username || normalized.followers) {
            console.log(`[looter2] profile success via ${path}`);
            return normalized;
          }
        }
      } catch (e: any) {
        errors.push(`${path}: ${e.message}`);
        console.warn(`[looter2] id-based profile variant failed: ${path}`, e.message);
      }
    }
  }

  throw new Error(`Profile not found for @${username}. Errors: ${errors.join(" | ")}`);
}

/**
 * Fetch reels or posts — tries many endpoint variants.
 */
async function scrapeMedia(
  username: string,
  mediaType: "reels" | "posts",
  pages: number,
  cursor?: string
): Promise<{ items: any[]; hasNext: boolean; nextCursor: string }> {
  const allItems: any[] = [];
  let currentCursor = cursor || "";
  let hasNext = false;

  // Try to get UID, but don't fail if we can't
  let uid: string | null = null;
  try { uid = await resolveUserId(username); } catch {}

  // Build ordered list of endpoints to try (ID-based first, then username-based)
  const reelEndpoints = uid ? [
    `/reels?id=${uid}`,
    `/user-reels?id=${uid}`,
    `/user-reels?userId=${uid}`,
    `/reels?userid=${uid}`,
    `/get-reels?id=${uid}`,
    `/reels-by-user?id=${uid}`,
  ] : [];
  const postEndpoints = uid ? [
    `/user-feeds?id=${uid}`,
    `/posts?id=${uid}`,
    `/user-posts?id=${uid}`,
    `/feed?id=${uid}`,
    `/user-feed?id=${uid}`,
    `/timeline?id=${uid}`,
  ] : [];
  // Username-based fallbacks
  const reelUserEndpoints = [
    `/reels?username=${username}`,
    `/user-reels?username=${username}`,
    `/get-reels?username=${username}`,
  ];
  const postUserEndpoints = [
    `/user-feeds?username=${username}`,
    `/posts?username=${username}`,
    `/user-posts?username=${username}`,
    `/feed?username=${username}`,
  ];

  const endpoints = mediaType === "reels"
    ? [...reelEndpoints, ...reelUserEndpoints]
    : [...postEndpoints, ...postUserEndpoints];

  for (let page = 0; page < pages; page++) {
    let data: any = null;
    const cursorParam = currentCursor ? `&max_id=${encodeURIComponent(currentCursor)}` : "";

    for (const basePath of endpoints) {
      try {
        const path = `${basePath}&count=12${cursorParam}`;
        data = await callRapid(path, { method: "GET" }, () => {});
        const hasContent = data && (
          data.items?.length > 0 ||
          data.data?.items?.length > 0 ||
          data.reels?.length > 0 ||
          data.posts?.length > 0 ||
          data.feeds?.length > 0 ||
          (Array.isArray(data) && data.length > 0)
        );
        if (hasContent) {
          console.log(`[looter2] ${mediaType} success via ${basePath}`);
          break;
        }
        // If we got data but it has no content array, still break if it has some structure
        if (data && (data.items || data.data || data.reels || data.posts || data.feeds || Array.isArray(data))) {
          break;
        }
        data = null;
      } catch (e: any) {
        console.warn(`[looter2] ${mediaType} variant failed: ${basePath}`, e.message);
        data = null;
      }
    }

    if (!data) break;

    // Normalize items from response
    const rawArr: any[] = (
      data?.items ??
      data?.data?.items ??
      data?.reels ??
      data?.data?.reels ??
      data?.feeds ??
      data?.data?.feeds ??
      data?.posts ??
      data?.data?.posts ??
      (Array.isArray(data) ? data : null) ??
      []
    );

    const normalized = dedupeMediaItems(rawArr)
      .map(normalizeMediaItem)
      .filter(Boolean);
    allItems.push(...normalized);

    // Pagination
    const nextMaxId = str(
      data?.next_max_id ??
      data?.data?.next_max_id ??
      data?.pagination?.next_max_id ??
      data?.page_info?.end_cursor ??
      ""
    );
    hasNext = !!(data?.more_available ?? data?.data?.more_available ?? (nextMaxId && nextMaxId !== currentCursor));
    currentCursor = nextMaxId;
    if (!currentCursor || !hasNext) break;
  }

  return {
    items: allItems,
    hasNext,
    nextCursor: currentCursor,
  };
}

/**
 * Fetch highlights — tries multiple endpoints and falls back gracefully.
 */
async function scrapeHighlights(username: string): Promise<any[]> {
  let uid: string | null = null;
  try { uid = await resolveUserId(username); } catch {}

  const highlightPaths: string[] = [
    ...(uid ? [
      `/highlights?id=${uid}`,
      `/user-highlights?id=${uid}`,
      `/story-highlights?id=${uid}`,
      `/highlights?userId=${uid}`,
    ] : []),
    `/highlights?username=${username}`,
    `/user-highlights?username=${username}`,
    `/story-highlights?username=${username}`,
  ];

  for (const path of highlightPaths) {
    try {
      const data = await callRapid(path, { method: "GET" }, () => {});
      const rawArr: any[] = data?.items ?? data?.data ?? data?.highlights ?? (Array.isArray(data) ? data : []);
      if (rawArr.length > 0) {
        return rawArr.map(normalizeHighlight).filter(Boolean);
      }
    } catch {}
  }
  // Highlights not available — return empty, don't fail the whole request
  return [];
}

// ─── Express Route ────────────────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const traceId = (req as any).traceId;
  const accessKey = req.headers["x-access-key"] as string;
  const deviceFp = req.headers["x-device-fp"] as string;

  if (!accessKey) {
    res.status(401).json({ error: "Missing x-access-key" });
    return;
  }

  // Authorize via db
  const row = await queryOne<{
    id: string; active: boolean; expires_at: string | null;
    device_fingerprints: string[]; max_devices: number; label: string;
  }>(
    "SELECT id, active, expires_at, device_fingerprints, max_devices, label FROM access_keys WHERE key = $1 LIMIT 1",
    [accessKey]
  );

  if (!row || !row.active || (row.expires_at && new Date(row.expires_at) < new Date())) {
    res.status(401).json({ error: "Invalid or expired key" });
    return;
  }

  if (deviceFp) {
    const fps = row.device_fingerprints || [];
    if (!fps.includes(deviceFp)) {
      if (fps.length >= (row.max_devices || 1)) {
        res.status(401).json({ error: "Device limit reached" });
        return;
      }
      fps.push(deviceFp);
      await execute("UPDATE access_keys SET device_fingerprints=$1, updated_at=now() WHERE id=$2", [fps, row.id]);
    }
  }

  const parsed = ScrapeReqSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error });
    return;
  }

  const { username, type, force, pages, cursor } = parsed.data;
  const u = username.toLowerCase().replace(/^@/, "");

  // Cache key scoped to device fingerprint
  const cacheKey = `v2:${deviceFp || "anon"}:${u}:${type}:${pages}${cursor ? `:${cursor.slice(0, 20)}` : ""}`;

  if (!force) {
    const l1 = cacheGet(cacheKey);
    if (l1 && !l1.isStale) {
      res.setHeader("X-Cache", "HIT-L1");
      res.setHeader("X-Cache-Age", String(Math.round(l1.ageMs / 1000)));
      res.status(200).json(l1.payload);
      return;
    }
    const l2 = await l2Get(cacheKey);
    if (l2 && l2.ageMs < 5 * 60 * 1000) {
      cacheSet(cacheKey, l2.payload);
      res.setHeader("X-Cache", "HIT-L2");
      res.setHeader("X-Cache-Age", String(Math.round(l2.ageMs / 1000)));
      res.status(200).json(l2.payload);
      return;
    }
  }

  const inflight = getInflight(cacheKey);
  if (inflight) {
    try {
      const data = await inflight;
      res.setHeader("X-Cache", "INFLIGHT");
      res.status(200).json(data);
      return;
    } catch (e: any) {
      res.status(500).json({ error: e.message });
      return;
    }
  }

  const doScrape = async () => {
    const result: any = { username: u };

    if (type === "profile" || type === "all") {
      try {
        result.profile = await scrapeProfile(u);
        result.profileOk = true;
      } catch (e: any) {
        result.profileOk = false;
        result.profileError = e.message;
        console.warn(`[looter2] profile failed for @${u}:`, e.message);
      }
    }

    if (type === "reels" || type === "all") {
      try {
        const r = await scrapeMedia(u, "reels", pages, cursor);
        result.reels = r.items;
        result.reelsHasMore = r.hasNext;
        result.reelsNextCursor = r.nextCursor;
        result.reelsOk = true;
      } catch (e: any) {
        result.reelsOk = false;
        result.reelsError = e.message;
        console.warn(`[looter2] reels failed for @${u}:`, e.message);
      }
    }

    if (type === "posts" || type === "all") {
      try {
        const p = await scrapeMedia(u, "posts", pages, cursor);
        result.posts = p.items;
        result.postsHasMore = p.hasNext;
        result.postsNextCursor = p.nextCursor;
        result.postsOk = true;
      } catch (e: any) {
        result.postsOk = false;
        result.postsError = e.message;
        console.warn(`[looter2] posts failed for @${u}:`, e.message);
      }
    }

    if (type === "highlights" || type === "all") {
      try {
        result.highlights = await scrapeHighlights(u);
        result.highlightsOk = true;
      } catch (e: any) {
        result.highlightsOk = false;
        result.highlights = [];
        result.highlightsError = e.message;
      }
    }

    if (cursor) result.paginated = true;

    cacheSet(cacheKey, result);
    await l2Set(cacheKey, u, type, pages, result);
    return result;
  };

  const p = doScrape();
  setInflight(cacheKey, p);

  try {
    const data = await p;
    res.setHeader("X-Cache", "MISS");
    res.setHeader("X-Trace-Id", traceId || "");
    res.status(200).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    deleteInflight(cacheKey);
  }
});

export default router;
