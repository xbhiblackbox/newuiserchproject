import { useState, useRef, useEffect } from "react";

interface VideoThumbnailProps {
  videoUrl: string;
  fallbackThumbnail?: string;
  className?: string;
  alt?: string;
}

const getStreamableId = (url: string): string | null => {
  const match = url.match(/streamable\.com\/(?:e\/|o\/)?([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
};

const getScreenPalId = (url: string): string | null => {
  // Handle: screenpal.com/watch/ID, go.screenpal.com/watch/ID, screenpal.com/player/ID, screenpal.com/content/video/ID
  const match = url.match(/screenpal\.com\/(?:watch|player|content\/video)\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
};

const VideoThumbnail = ({ videoUrl, fallbackThumbnail, className = "", alt = "" }: VideoThumbnailProps) => {
  const [thumbError, setThumbError] = useState(0);
  const isStreamable = videoUrl.includes("streamable.com") && !videoUrl.includes("screenpal");
  const isScreenPal = videoUrl.includes("screenpal.com");

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
    // Prefer fallback thumbnail if available (static image from data)
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

    // Try CDN thumbnail URLs
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
        onError={() => setThumbError(prev => prev + 1)}
      />
    );
  }

  // For direct video URLs (.mp4 etc), show first frame using video element
  const isVideo = videoUrl.match(/\.(mp4|webm|mov|ogg)(\?|$)/i) || videoUrl.includes("video") || videoUrl.startsWith("blob:");
  
  if (isVideo) {
    return (
      <video
        src={videoUrl}
        className={className}
        muted
        playsInline
        preload="metadata"
        poster={fallbackThumbnail}
        style={{ pointerEvents: "none" }}
      />
    );
  }

  // Fallback: treat as image thumbnail
  const src = fallbackThumbnail || videoUrl;
  return <img src={src} alt={alt} className={className} loading="lazy" draggable={false} />;
};

export default VideoThumbnail;
