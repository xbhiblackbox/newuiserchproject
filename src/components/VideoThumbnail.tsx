import { useState, useRef, useEffect } from "react";

interface VideoThumbnailProps {
  videoUrl: string;
  fallbackThumbnail?: string;
  /** Optional alternate thumbnail URLs to try in order if the primary fails (e.g. raw IG CDN URL when the proxy fails). */
  altThumbnails?: string[];
  className?: string;
  alt?: string;
}

/** Try the primary thumb, then each alt, then the video poster, then a neutral placeholder. */
const useThumbCandidates = (primary: string | undefined, alts: string[] | undefined) => {
  const list = [primary, ...(alts || [])].filter((u): u is string => !!u);
  const [idx, setIdx] = useState(0);
  const fail = () => setIdx((i) => i + 1);
  return { current: list[idx], exhausted: idx >= list.length, fail };
};

const getStreamableId = (url: string): string | null => {
  const match = url.match(/streamable\.com\/(?:e\/|o\/)?([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
};

const getScreenPalId = (url: string): string | null => {
  // Handle: screenpal.com/watch/ID, go.screenpal.com/watch/ID, screenpal.com/player/ID, screenpal.com/content/video/ID
  const match = url.match(/screenpal\.com\/(?:watch|player|content\/video)\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
};

const VideoThumbnail = ({ videoUrl, fallbackThumbnail, altThumbnails, className = "", alt = "" }: VideoThumbnailProps) => {
  const [thumbError, setThumbError] = useState(0);
  const [posterFailed, setPosterFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const isStreamable = videoUrl.includes("streamable.com") && !videoUrl.includes("screenpal");
  const isScreenPal = videoUrl.includes("screenpal.com");

  // For Instagram CDN URLs that go through our proxy: try to derive the raw URL as a fallback
  const derivedAlts: string[] = [];
  if (fallbackThumbnail?.includes("/functions/v1/ig-image-proxy")) {
    try {
      const u = new URL(fallbackThumbnail);
      const raw = u.searchParams.get("url");
      if (raw) derivedAlts.push(raw);
    } catch {}
  }
  const candidate = useThumbCandidates(fallbackThumbnail, [...derivedAlts, ...(altThumbnails || [])]);

  // ScreenPal thumbnail — prefer fallback image, otherwise use iframe snapshot
  if (isScreenPal) {
    if (fallbackThumbnail) {
      return <img src={fallbackThumbnail} alt={alt} className={className} loading="lazy" draggable={false} />;
    }
    const videoId = getScreenPalId(videoUrl);
    if (!videoId) {
      return <div className={className + " bg-secondary"} />;
    }
    return (
      <div className={"relative overflow-hidden " + className}>
        <div className="absolute inset-0 bg-secondary" />
        <iframe
          src={`https://screenpal.com/player/${videoId}?width=180&height=320&ff=1&title=0&controls=0&autoplay=0`}
          className="absolute inset-0 w-full h-full border-0 pointer-events-none"
          style={{ transform: "scale(1.8)", transformOrigin: "center center" }}
          loading="lazy"
        />
      </div>
    );
  }

  if (isStreamable) {
    if (fallbackThumbnail) {
      return (
        <img
          src={fallbackThumbnail}
          alt={alt}
          className={className}
          loading="lazy"
          draggable={false}
        />
      );
    }

    const videoId = getStreamableId(videoUrl);
    if (!videoId) {
      return <div className={className + " bg-secondary"} />;
    }

    const thumbUrls = [
      `https://cdn-cf-east.streamable.com/image/${videoId}.jpg`,
      `https://cdn-eu-west.streamable.com/image/${videoId}.jpg`,
      `https://thumbs-east.streamable.com/image/${videoId}.jpg`,
    ];

    const currentThumbUrl = thumbError < thumbUrls.length ? thumbUrls[thumbError] : null;

    if (!currentThumbUrl) {
      return (
        <div className={"relative overflow-hidden " + className}>
          <iframe
            src={`https://streamable.com/e/${videoId}?autoplay=0&loop=0&muted=1&controls=0&nocontrols=1`}
            className="absolute inset-0 w-full h-full border-0 pointer-events-none"
            allow="autoplay"
            style={{ transform: "scale(1.5)", transformOrigin: "center" }}
          />
        </div>
      );
    }

    return (
      <img
        src={currentThumbUrl}
        alt={alt}
        className={className}
        loading="lazy"
        draggable={false}
        onError={() => setThumbError((prev) => prev + 1)}
      />
    );
  }

  const isVideo =
    videoUrl.match(/\.(mp4|webm|mov|ogg)(\?|$)/i) ||
    videoUrl.includes("video") ||
    videoUrl.startsWith("blob:");

  // 1) Try image candidates (proxied → raw IG → user-supplied alts)
  if (!candidate.exhausted && candidate.current) {
    return (
      <img
        src={candidate.current}
        alt={alt}
        className={className}
        loading="lazy"
        draggable={false}
        onError={candidate.fail}
      />
    );
  }

  // 2) Captured poster frame from the video itself
  if (capturedFrame) {
    return <img src={capturedFrame} alt={alt} className={className} loading="lazy" draggable={false} />;
  }

  // 3) Render a hidden <video> to extract a poster frame, fall back to a neutral placeholder
  if (isVideo) {
    return (
      <div className={"relative overflow-hidden bg-secondary " + className}>
        <video
          ref={videoRef}
          src={videoUrl}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
          crossOrigin="anonymous"
          onLoadedData={() => {
            const v = videoRef.current;
            if (!v) return;
            try {
              const c = document.createElement("canvas");
              c.width = v.videoWidth || 320;
              c.height = v.videoHeight || 568;
              const ctx = c.getContext("2d");
              if (!ctx) return;
              ctx.drawImage(v, 0, 0, c.width, c.height);
              setCapturedFrame(c.toDataURL("image/jpeg", 0.7));
            } catch {
              // CORS-blocked: just leave the <video> tag rendering its first frame natively
            }
          }}
          onError={() => setPosterFailed(true)}
          style={{ pointerEvents: "none" }}
        />
      </div>
    );
  }

  // 4) Last resort — neutral placeholder block (instead of a black image)
  return (
    <div className={"flex items-center justify-center bg-secondary text-muted-foreground text-xs " + className}>
      <span>No preview</span>
    </div>
  );
};

export default VideoThumbnail;
