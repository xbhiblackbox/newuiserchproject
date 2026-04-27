import { useCallback, useEffect, useRef, useState } from "react";

export interface InstaProfile {
  username: string;
  fullName: string;
  bio: string;
  avatarUrl: string;
  isVerified: boolean;
  followers: number;
  following: number;
  postsCount: number;
  externalUrl?: string;
  category?: string;
}

export interface InstaReel {
  id: string;
  code: string;
  caption: string;
  thumbnail: string;
  videoUrl: string;
  duration: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  takenAt: number;
}

export type InstaPost = InstaReel;

export interface InstaHighlight {
  id: string;
  name: string;
  image: string;
}

export type InstaScrapeType = "profile" | "reels" | "posts" | "highlights" | "all";

export interface InstaScrapeResult {
  username: string;
  profile?: InstaProfile;
  reels?: InstaReel[];
  posts?: InstaPost[];
  highlights?: InstaHighlight[];
  profileOk?: boolean;
  reelsOk?: boolean;
  postsOk?: boolean;
  highlightsOk?: boolean;
  // Pagination tokens — empty string = no more pages.
  postsNextCursor?: string;
  postsHasMore?: boolean;
  reelsNextCursor?: string;
  reelsHasMore?: boolean;
  // True when the response is a "load more" batch (only contains the new page).
  paginated?: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

const USERNAME_KEY = "ig_connected_username";
const CACHE_PREFIX = "ig_cache_v6";
const CACHE_SOFT_TTL_MS = 5 * 60 * 1000;       // serve without background refresh
const CACHE_HARD_TTL_MS = 24 * 60 * 60 * 1000; // serve stale up to a day, refresh in bg

export const getConnectedUsername = (): string | null => {
  try {
    return localStorage.getItem(USERNAME_KEY);
  } catch {
    return null;
  }
};

export const setConnectedUsername = (u: string) => {
  try {
    localStorage.setItem(USERNAME_KEY, u);
  } catch {}
};

export const disconnectInstagram = () => {
  const prev = getConnectedUsername();
  try {
    localStorage.removeItem(USERNAME_KEY);
  } catch {}
  if (prev) clearInstagramCache(prev);
};

export const clearInstagramCache = (username?: string) => {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((k) => {
      if (!k.startsWith(CACHE_PREFIX + ":")) return;
      if (username && !k.startsWith(`${CACHE_PREFIX}:${username}:`)) return;
      localStorage.removeItem(k);
    });
  } catch {}
};

// In-flight request coalescing: if 100 components ask for the same username at
// the same time, only 1 network request is made and all of them share the result.
const inflight = new Map<string, Promise<InstaScrapeResult>>();

// Generate short, unique trace ids for end-to-end request correlation.
const newClientTraceId = (): string =>
  Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 8);

export async function fetchInstagramData(
  username: string,
  type: InstaScrapeType = "all",
  opts: { force?: boolean } = {}
): Promise<InstaScrapeResult> {
  const u = username.trim().replace(/^@/, "").toLowerCase();
  const key = `${u}::${type}::${opts.force ? "f" : ""}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const traceId = newClientTraceId();
  const startedAt = Date.now();

  const p = (async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/instagram-scraper`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_KEY}`,
          apikey: SUPABASE_KEY,
          "x-trace-id": traceId,
        },
        body: JSON.stringify({ username: u, type, force: !!opts.force }),
        signal: AbortSignal.timeout(45000),
      });
      const ms = Date.now() - startedAt;
      const serverTrace = res.headers.get("x-trace-id") || traceId;
      const cache = res.headers.get("x-cache") || "?";
      const cacheAge = res.headers.get("x-cache-age");
      const serverMs = res.headers.get("x-duration-ms");
      if (!res.ok) {
        const t = await res.text();
        console.warn(
          `[ig-scraper] ${u} ${type} FAIL ${res.status} ms=${ms} trace=${serverTrace} :: ${t.slice(0, 200)}`,
        );
        throw new Error(`Scraper ${res.status}: ${t}`);
      }
      console.log(
        `[ig-scraper] ${u} ${type} ${cache}${cacheAge ? `(${cacheAge}s)` : ""} clientMs=${ms} serverMs=${serverMs ?? "?"} trace=${serverTrace}`,
      );
      return (await res.json()) as InstaScrapeResult;
    } finally {
      // Clear after settle so next non-overlapping call can fire fresh
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}


interface CacheEntry {
  cachedAt: number;
  data: InstaScrapeResult;
}

const readCache = (k: string): CacheEntry | null => {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
const writeCache = (k: string, data: InstaScrapeResult) => {
  try {
    localStorage.setItem(k, JSON.stringify({ cachedAt: Date.now(), data }));
  } catch {}
};

export function useInstagramData(usernameArg?: string, type: InstaScrapeType = "all") {
  const [username, setUsername] = useState<string | null>(
    () => usernameArg ?? getConnectedUsername()
  );
  const [data, setData] = useState<InstaScrapeResult | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef(0);

  // sync with localStorage changes / arg changes
  useEffect(() => {
    setUsername(usernameArg ?? getConnectedUsername());
    const onStorage = () => setUsername(usernameArg ?? getConnectedUsername());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [usernameArg]);

  const load = useCallback(
    async (force = false) => {
      if (!username) {
        setData(null);
        setCachedAt(null);
        return;
      }
      const key = `${CACHE_PREFIX}:${username}:${type}`;
      const cached = readCache(key);
      const age = cached ? Date.now() - cached.cachedAt : Infinity;
      const fresh = cached && age < CACHE_SOFT_TTL_MS;
      const usableStale = cached && age < CACHE_HARD_TTL_MS;

      // Always paint cached data instantly if usable (even if stale).
      if (cached && usableStale) {
        setData(cached.data);
        setCachedAt(cached.cachedAt);
      }

      // Fresh + not forced → done, no network call.
      if (fresh && !force) return;

      // Stale-but-usable + not forced → silent background refresh (no spinner).
      const isBackground = !force && !!usableStale;

      const reqId = ++reqRef.current;
      if (!isBackground) setLoading(true);
      setError(null);
      try {
        const next = await fetchInstagramData(username, type, { force });
        if (reqRef.current !== reqId) return;
        writeCache(key, next);
        setData(next);
        setCachedAt(Date.now());
      } catch (e: any) {
        if (reqRef.current !== reqId) return;
        // Don't surface errors when we already have stale data on screen.
        if (!isBackground) setError(e?.message || "Failed to load");
      } finally {
        if (reqRef.current === reqId && !isBackground) setLoading(false);
      }
    },
    [username, type]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const refetch = useCallback((force = true) => load(force), [load]);

  return { data, loading, error, refetch, username, cachedAt };
}

export const proxyIgImage = (url?: string | null): string => {
  if (!url) return "";
  if (!/cdninstagram\.com|fbcdn\.net|instagram\.com/.test(url)) return url;
  const base = SUPABASE_URL || (PROJECT_ID ? `https://${PROJECT_ID}.supabase.co` : "");
  return `${base}/functions/v1/ig-image-proxy?url=${encodeURIComponent(url)}`;
};

export const formatCount = (n: number): string => {
  if (!n || n < 0) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "") + "K";
  if (n < 1_000_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
};

export interface AggregateInsights {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  interactions: number;
  contentShared: number;
  followers: number;
  following: number;
  postsCount: number;
}

export const aggregateInsights = (d?: InstaScrapeResult | null): AggregateInsights => {
  const reels = d?.reels ?? [];
  const posts = d?.posts ?? [];
  const all = [...reels, ...posts];
  const sum = (k: keyof InstaReel) => all.reduce((a, x) => a + (Number(x[k]) || 0), 0);
  const views = sum("views");
  const likes = sum("likes");
  const comments = sum("comments");
  const shares = sum("shares");
  return {
    views,
    likes,
    comments,
    shares,
    interactions: likes + comments + shares,
    contentShared: all.length,
    followers: d?.profile?.followers ?? 0,
    following: d?.profile?.following ?? 0,
    postsCount: d?.profile?.postsCount ?? 0,
  };
};
