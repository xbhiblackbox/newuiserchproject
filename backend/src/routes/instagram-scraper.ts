import { Router, Request, Response } from "express";
import { z } from "zod";
import { callRapid, getAdminChatIds } from "../lib/rapidapi";
import { queryOne, execute } from "../lib/db";
import { sendToAllAdmins } from "../lib/telegram";
import {
  cacheGet, cacheSet, l2Get, l2Set,
  getInflight, setInflight, deleteInflight,
  isRevalidating, markRevalidating, clearRevalidating,
  CacheLookup
} from "../lib/cache";
import {
  normalizeProfile, normalizeMediaItem, pickItems, dedupeMediaItems,
  normalizeHighlight, readPageInfo, paginationVariants,
  mergeProfile, extractDetailFields, newTraceId, Variant, encodeCursor, decodeCursor
} from "../lib/scraperHelpers";

const router = Router();

const ScrapeReqSchema = z.object({
  username: z.string().min(1),
  type: z.enum(["profile", "reels", "posts", "highlights", "all"]).default("all"),
  force: z.boolean().default(false),
  pages: z.number().min(1).max(10).default(1),
  cursor: z.string().optional(),
});

type InstaScrapeResult = any;

const PROFILE_VARIANTS: Variant[] = [
  { path: "/v1.2/info", query: {} },
  { path: "/api/v1/users/web_profile_info/", query: {} },
  { path: "/v1/info", query: {} }
];
const REELS_VARIANTS: Variant[] = [
  { path: "/v1.2/reels", query: {} },
  { path: "/v1/reels", query: {} },
  { path: "/api/v1/feed/user/", query: {} }
];
const POSTS_VARIANTS: Variant[] = [
  { path: "/v1.2/posts", query: {} },
  { path: "/v1/posts", query: {} },
  { path: "/api/v1/feed/user/", query: {} }
];
const HIGHLIGHTS_VARIANTS: Variant[] = [
  { path: "/v1/highlights", query: {} }
];

async function tryVariants(variants: Variant[], username: string, cursor?: string): Promise<{ data: any; variantUsed: Variant } | null> {
  const varsToTry = cursor ? [decodeCursor(cursor)?.v].filter(Boolean) as Variant[] : variants;
  if (varsToTry.length === 0) return null;

  const errors: any[] = [];
  for (const variant of varsToTry) {
    try {
      const q = new URLSearchParams({ username_or_id_or_url: username, ...variant.query });
      if (cursor && !variant.query?.max_id && !variant.query?.maxId && !variant.query?.cursor) {
         q.set("max_id", cursor);
      }
      const data = await callRapid(`${variant.path}?${q.toString()}`, { method: variant.method || "GET" }, () => {});
      if (data && (data.data || data.result || data.user || data.items || data.graphql || data.edge_owner_to_timeline_media)) {
        return { data, variantUsed: variant };
      } else if (data && data.message) {
         throw new Error(`RapidAPI Error: ${data.message}`);
      }
    } catch (e: any) {
      errors.push(e.message);
      console.warn(`Variant failed: ${variant.path}`, e.message);
    }
  }
  throw new Error(`All variants failed. Errors: ${errors.join(" | ")}`);
}

async function scrapeProfile(username: string): Promise<any> {
  const res = await tryVariants(PROFILE_VARIANTS, username);
  if (!res) throw new Error("Profile not found");
  return normalizeProfile(res.data);
}

async function scrapeMedia(username: string, variants: Variant[], pages: number, cursor?: string): Promise<{ items: any[], hasNext: boolean, nextCursor: string }> {
  let allItems: any[] = [];
  let currentCursor = cursor;
  let hasNext = true;
  let variantToUse: Variant | undefined;

  for (let i = 0; i < pages && hasNext; i++) {
    const res = await tryVariants(variantToUse ? [variantToUse] : variants, username, currentCursor);
    if (!res) break;
    variantToUse = res.variantUsed;
    
    const rawItems = pickItems(res.data);
    const normalized = dedupeMediaItems(rawItems).map(normalizeMediaItem).filter(Boolean);
    allItems = allItems.concat(normalized);
    
    const pageInfo = readPageInfo(res.data);
    hasNext = pageInfo.hasNext;
    currentCursor = pageInfo.cursor;
    if (!currentCursor) hasNext = false;
  }

  return {
    items: allItems,
    hasNext,
    nextCursor: currentCursor ? encodeCursor({ c: currentCursor, v: variantToUse! }) : ""
  };
}


router.post("/", async (req: Request, res: Response): Promise<void> => {
  const traceId = (req as any).traceId;
  const accessKey = req.headers["x-access-key"] as string;
  const deviceFp = req.headers["x-device-fp"] as string;

  if (!accessKey) {
    res.status(401).json({ error: "Missing x-access-key" });
    return;
  }

  // Authorize via db
  const row = await queryOne<{ id: string; active: boolean; expires_at: string | null; device_fingerprints: string[]; max_devices: number; label: string }>(
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

  // Scope cache to device fingerprint so data doesn't mix across users
  const cacheKey = `v1:${deviceFp || "anon"}:${u}:${type}:${pages}${cursor ? `:${cursor}` : ""}`;
  
  if (!force) {
    const l1 = cacheGet(cacheKey);
    if (l1 && !l1.isStale) {
      res.setHeader("X-Cache", "HIT-L1");
      res.setHeader("X-Cache-Age", String(Math.round(l1.ageMs / 1000)));
      res.status(200).json(l1.payload);
      return;
    }
    const l2 = await l2Get(cacheKey);
    if (l2 && l2.ageMs < 5 * 60 * 1000) { // 5 min soft TTL for L2
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
       try { result.profile = await scrapeProfile(u); result.profileOk = true; } catch (e: any) { result.profileOk = false; result.profileError = e.message; }
    }
    if (type === "reels" || type === "all") {
       try {
         const r = await scrapeMedia(u, REELS_VARIANTS, pages, cursor);
         result.reels = r.items; result.reelsHasMore = r.hasNext; result.reelsNextCursor = r.nextCursor; result.reelsOk = true;
       } catch (e: any) { result.reelsOk = false; result.reelsError = e.message; }
    }
    if (type === "posts" || type === "all") {
       try {
         const p = await scrapeMedia(u, POSTS_VARIANTS, pages, cursor);
         result.posts = p.items; result.postsHasMore = p.hasNext; result.postsNextCursor = p.nextCursor; result.postsOk = true;
       } catch (e: any) { result.postsOk = false; result.postsError = e.message; }
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
    res.status(200).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    deleteInflight(cacheKey);
  }
});

export default router;
