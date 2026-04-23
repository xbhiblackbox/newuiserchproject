export const isPlayableVideoUrl = (url?: string | null): boolean => {
  if (!url) return false;
  if (url.startsWith("blob:") || url.startsWith("data:video/")) return true;
  return /\.(mp4|webm|mov|m4v|ogg|m3u8)(\?|#|$)/i.test(url);
};

export const getPlayableVideoUrl = (...urls: Array<string | undefined | null>): string => {
  for (const u of urls) {
    if (u && isPlayableVideoUrl(u)) return u;
  }
  return "";
};

export interface IgMediaLike {
  id?: string;
  code?: string;
}

export const getIgMediaByCode = <T extends IgMediaLike>(
  media: T[] | undefined | null,
  igCode?: string | null,
  fallbackIndex = 0
): T | undefined => {
  if (!media || media.length === 0) return undefined;
  if (igCode) {
    const found = media.find((m) => m.code === igCode || m.id === igCode);
    if (found) return found;
  }
  return media[fallbackIndex] ?? media[0];
};
