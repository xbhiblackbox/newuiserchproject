import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, Video, Loader2 } from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import GraphEditorModal from "@/components/GraphEditorModal";
import type { ExtendedPostItem } from "@/data/reelInsightsData";

const SectionTitle = ({ children }: { children: string }) => (
  <h3 className="text-[14px] font-bold text-foreground mt-4 mb-2 uppercase tracking-wide">{children}</h3>
);

const Field = ({ label, value, onChange, type = "number" }: { label: string; value: string | number; onChange: (v: string) => void; type?: string }) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <span className="text-[13px] text-foreground flex-shrink-0">{label}</span>
    <Input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-[120px] h-8 text-[13px] bg-secondary border-border text-right"
    />
  </div>
);

interface ReelEditModalProps {
  open: boolean;
  onClose: () => void;
  reel: ExtendedPostItem | null;
  reelIndex: number;
  onSave: (index: number, updated: ExtendedPostItem) => void;
  onDelete?: (index: number) => void;
}

const ReelEditModal = ({ open, onClose, reel, reelIndex, onSave, onDelete }: ReelEditModalProps) => {
  const [data, setData] = useState<ExtendedPostItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const musicIconInputRef = useRef<HTMLInputElement>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const sheetContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reel) setData(JSON.parse(JSON.stringify(reel)));
  }, [reel]);

  // Fix mobile keyboard pushing sheet down - prevent viewport resize from closing keyboard
  useEffect(() => {
    if (!open) return;

    // Prevent mobile browser from scrolling/resizing the page when keyboard opens
    const metaViewport = document.querySelector('meta[name=viewport]');
    const originalContent = metaViewport?.getAttribute('content') || '';
    metaViewport?.setAttribute('content', originalContent + ', interactive-widget=resizes-content');

    // Use visualViewport to keep input in view without sheet jumping
    const vv = window.visualViewport;
    if (!vv) return;

    let rafId: number;
    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const el = sheetContentRef.current;
        if (!el) return;
        const keyboardHeight = window.innerHeight - vv.height;
        if (keyboardHeight > 100) {
          // Shrink the sheet to fit above keyboard
          el.style.height = `${vv.height * 0.85}px`;
          el.style.maxHeight = `${vv.height}px`;
          el.style.transform = `translateY(0)`;
          // Keep focused input visible
          const active = document.activeElement as HTMLElement;
          if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
            setTimeout(() => {
              active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }, 50);
          }
        } else {
          el.style.height = '';
          el.style.maxHeight = '';
          el.style.transform = '';
        }
      });
    };

    vv.addEventListener('resize', handleResize);
    return () => {
      vv.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId);
      metaViewport?.setAttribute('content', originalContent);
    };
  }, [open]);

  if (!data) return null;

  const ins = data.insights;

  const setIns = (key: string, value: any) => {
    setData((prev) => prev ? { ...prev, insights: { ...prev.insights, [key]: value } } : prev);
  };

  const handleSave = async (e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (videoUploading) return; // Don't save while uploading
    const fixedData = { ...data };
    fixedData.insights = { ...fixedData.insights, genderFemale: 100 - fixedData.insights.genderMale };
    // Explicitly preserve music fields - but only if they exist
    if (data.musicTitle) fixedData.musicTitle = data.musicTitle;
    if (data.musicIcon) fixedData.musicIcon = data.musicIcon;
    if (data.caption) fixedData.caption = data.caption;
    
    // Auto-generate thumbnail from streamable video URL only if no custom thumbnail set
    if (fixedData.videoUrl?.includes("streamable.com") && !fixedData.thumbnail) {
      const videoId = fixedData.videoUrl.split("/").pop();
      fixedData.thumbnail = `https://cdn-cf-east.streamable.com/image/${videoId}.jpg`;
    }
    console.log("[ReelEdit] Saving reel", reelIndex, "musicTitle:", fixedData.musicTitle, "musicIcon:", fixedData.musicIcon?.slice(0, 50), "caption:", fixedData.caption?.slice(0, 30));
    onSave(reelIndex, fixedData);

    // Also persist ALL fields to Supabase for cross-device sync
    try {
      const syncData: Record<string, unknown> = {};
      // Only save non-blob, non-base64 URLs to Supabase (they work cross-device)
      if (fixedData.videoUrl && !fixedData.videoUrl.startsWith('blob:')) {
        syncData.videoUrl = fixedData.videoUrl;
      }
      if (fixedData.thumbnail && !fixedData.thumbnail.startsWith('data:')) {
        syncData.thumbnail = fixedData.thumbnail;
      }
      if (fixedData.musicIcon && !fixedData.musicIcon.startsWith('data:')) {
        syncData.musicIcon = fixedData.musicIcon;
      }
      syncData.musicTitle = fixedData.musicTitle;
      syncData.caption = fixedData.caption;
      syncData.duration = fixedData.duration;
      // Save all insights stats too
      syncData.views = fixedData.insights.views;
      syncData.likes = fixedData.insights.likes;
      syncData.comments = fixedData.insights.comments;
      syncData.shares = fixedData.insights.shares;
      syncData.saves = fixedData.insights.saves;
      syncData.followerViewsPct = fixedData.insights.followerViewsPct;
      syncData.genderMale = fixedData.insights.genderMale;
      syncData.viewRatePast3Sec = fixedData.insights.viewRatePast3Sec;
      syncData.skipRate = fixedData.insights.skipRate;
      syncData.typicalSkipRate = fixedData.insights.typicalSkipRate;
      syncData.watchTime = fixedData.insights.watchTime;
      syncData.avgWatchTime = fixedData.insights.avgWatchTime;
      syncData.accountsReached = fixedData.insights.accountsReached;
      syncData.follows = fixedData.insights.follows;
      syncData.sources = fixedData.insights.sources;
      syncData.countries = fixedData.insights.countries;
      syncData.ageGroups = fixedData.insights.ageGroups;
      syncData.showGraph = fixedData.showGraph !== false;

      // Read existing Supabase data and merge
      const { data: existing } = await (supabase as any)
        .from('reels_data')
        .select('data')
        .eq('account', 'just4abhii')
        .eq('post_index', reelIndex)
        .maybeSingle();

      const merged = { ...(existing?.data || {}), ...syncData };
      await (supabase as any).from('reels_data').upsert(
        { account: 'just4abhii', post_index: reelIndex, data: merged, updated_at: new Date().toISOString() },
        { onConflict: 'account,post_index' }
      );
      console.log("[ReelEdit] Saved media to Supabase for reel", reelIndex);
    } catch (err) {
      console.warn("[ReelEdit] Failed to save media to Supabase:", err);
    }

    onClose();
  };


  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v && !videoUploading) handleSave(); }}>
      <SheetContent ref={sheetContentRef} side="bottom" className="h-[85vh] overflow-y-auto rounded-t-2xl bg-background" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-center justify-between px-1 pb-2 border-b border-border sticky top-0 bg-background z-10">
          <button onClick={onClose} className="text-foreground text-sm">Cancel</button>
          <SheetHeader className="flex-1 text-center">
            <SheetTitle className="text-[16px] font-bold">Edit Reel #{reelIndex + 1}</SheetTitle>
          </SheetHeader>
          <button onClick={(e) => handleSave(e)} disabled={videoUploading} className={`text-sm font-bold ${videoUploading ? 'text-muted-foreground' : 'text-[hsl(var(--ig-blue))]'}`}>{videoUploading ? 'Uploading...' : 'Done'}</button>
        </div>

        <div className="pb-8 space-y-1">
          {/* Caption */}
          <SectionTitle>Caption</SectionTitle>
          <div className="py-1.5">
            <textarea
              placeholder="Enter caption..."
              value={data.caption || ""}
              onChange={(e) => setData((prev) => prev ? { ...prev, caption: e.target.value } : prev)}
              rows={3}
              className="w-full rounded-md px-3 py-2 text-[13px] bg-secondary border border-border resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Music Title */}
          <SectionTitle>Music</SectionTitle>
          <div className="py-1.5 space-y-2">
            <Input
              type="text"
              placeholder="e.g. Sofia Camara • Ingrained (DN..."
              value={data.musicTitle || ""}
              onChange={(e) => setData((prev) => prev ? { ...prev, musicTitle: e.target.value } : prev)}
              className="h-8 text-[13px] bg-secondary border-border"
            />
            {/* Music Icon Upload */}
            {data.musicTitle && (
              <>
                <span className="text-[12px] text-muted-foreground">Music Cover Art</span>
                {data.musicIcon && (
                  <div className="relative w-10 h-10 rounded-md overflow-hidden border border-border">
                    <img src={data.musicIcon} alt="Music icon" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setData((prev) => prev ? { ...prev, musicIcon: "" } : prev)}
                      className="absolute top-0 right-0 bg-black/60 rounded-full p-0.5"
                    >
                      <X size={10} className="text-white" />
                    </button>
                  </div>
                )}
                <input
                  ref={musicIconInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB"); return; }
                    try {
                      const url = await uploadToCloudinary(file);
                      setData((prev) => prev ? { ...prev, musicIcon: url } : prev);
                    } catch (err) {
                      console.warn('[MusicIcon] Cloudinary failed, using base64 fallback', err);
                      toast.error("Cloudinary upload failed, using temporary local storage");
                      const reader = new FileReader();
                      reader.onload = (ev) => setData((prev) => prev ? { ...prev, musicIcon: ev.target?.result as string } : prev);
                      reader.readAsDataURL(file);
                    }
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 text-[13px]"
                  onClick={() => musicIconInputRef.current?.click()}
                >
                  <ImagePlus size={16} />
                  Upload Music Cover
                </Button>
                <Input
                  type="url"
                  placeholder="Or paste music cover URL here..."
                  value={data.musicIcon?.startsWith("data:") ? "" : data.musicIcon || ""}
                  onChange={(e) => setData((prev) => prev ? { ...prev, musicIcon: e.target.value } : prev)}
                  className="h-8 text-[13px] bg-secondary border-border"
                />
              </>
            )}
          </div>

          {/* Video */}
          <SectionTitle>Video</SectionTitle>
          <div className="py-1.5 space-y-2">
            {/* Video preview if uploaded */}
            {data.videoUrl && (
              <div className="relative w-full rounded-md overflow-hidden border border-border bg-black">
                <video src={data.videoUrl} className="w-full aspect-[9/16] object-cover" muted playsInline preload="metadata" />
                <button
                  onClick={() => setData((prev) => prev ? { ...prev, videoUrl: "" } : prev)}
                  className="absolute top-1 right-1 bg-black/60 rounded-full p-1"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
            )}
            {/* Upload from gallery */}
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 100 * 1024 * 1024) {
                  alert("Video must be under 100MB");
                  return;
                }

                // Show blob URL immediately for instant preview
                const blobUrl = URL.createObjectURL(file);
                setData((prev) => prev ? { ...prev, videoUrl: blobUrl } : prev);

                // Upload to Cloudinary for permanent URL
                setVideoUploading(true);
                setUploadProgress(0);
                try {
                  const url = await uploadToCloudinary(file, (pct) => setUploadProgress(pct));
                  setData((prev) => prev ? { ...prev, videoUrl: url } : prev);
                  console.log("[VideoUpload] Cloudinary success:", url);
                } catch (err: any) {
                  console.warn("[VideoUpload] Cloudinary failed, keeping blob URL:", err?.message);
                  toast.error("Video Cloudinary upload failed. Video will only work in this session.");
                  // blob URL already set — works for current session
                } finally {
                  setTimeout(() => {
                    setVideoUploading(false);
                    setUploadProgress(0);
                  }, 500);
                  e.target.value = "";
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 text-[13px]"
              onClick={() => videoInputRef.current?.click()}
              disabled={videoUploading}
            >
              {videoUploading ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />}
              {videoUploading ? `Uploading... ${uploadProgress}%` : "Upload Video from Gallery"}
            </Button>
            {/* URL fallback */}
            <Input
              type="url"
              placeholder="Or paste video URL here..."
              value={data.videoUrl || ""}
              onChange={(e) => setData((prev) => prev ? { ...prev, videoUrl: e.target.value } : prev)}
              className="h-8 text-[13px] bg-secondary border-border"
            />
          </div>

          {/* Duration */}
          <SectionTitle>Duration</SectionTitle>
          <div className="py-1.5">
            <Input
              type="text"
              placeholder="0:10"
              value={data.duration || ""}
              onChange={(e) => setData((prev) => prev ? { ...prev, duration: e.target.value } : prev)}
              className="h-8 text-[13px] bg-secondary border-border"
            />
          </div>

          {/* Thumbnail */}
          <SectionTitle>Thumbnail</SectionTitle>
          <div className="py-1.5 space-y-2">
            {/* Preview */}
            {data.thumbnail && (
              <div className="relative w-20 h-28 rounded-md overflow-hidden border border-border">
                <img src={data.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
                <button
                  onClick={() => setData((prev) => prev ? { ...prev, thumbnail: "" } : prev)}
                  className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5"
                >
                  <X size={12} className="text-white" />
                </button>
              </div>
            )}
            {/* Upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 10 * 1024 * 1024) {
                  alert("Image must be under 10MB");
                  return;
                }
                // Upload to Cloudinary
                try {
                  const url = await uploadToCloudinary(file);
                  setData((prev) => prev ? { ...prev, thumbnail: url } : prev);
                  console.log('[ThumbUpload] Cloudinary success:', url);
                } catch (err) {
                  console.warn('[ThumbUpload] Cloudinary failed, using base64 fallback:', err);
                  toast.error("Thumbnail Cloudinary upload failed. Fallback to local base64.");
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    setData((prev) => prev ? { ...prev, thumbnail: ev.target?.result as string } : prev);
                  };
                  reader.readAsDataURL(file);
                }
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 text-[13px]"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus size={16} />
              Upload Thumbnail
            </Button>
            {/* URL fallback */}
            <Input
              type="url"
              placeholder="Or paste URL here..."
              value={data.thumbnail?.startsWith("data:") ? "" : data.thumbnail || ""}
              onChange={(e) => setData((prev) => prev ? { ...prev, thumbnail: e.target.value } : prev)}
              className="h-8 text-[13px] bg-secondary border-border"
            />
          </div>
          <SectionTitle>Engagement</SectionTitle>
          <Field label="Views" value={ins.views} onChange={(v) => setIns("views", Number(v))} />
          <Field label="Likes" value={ins.likes} onChange={(v) => setIns("likes", Number(v))} />
          <Field label="Comments" value={ins.comments} onChange={(v) => setIns("comments", Number(v))} />
          <Field label="Shares" value={ins.shares} onChange={(v) => setIns("shares", Number(v))} />
          <Field label="Reposts" value={ins.reposts || 0} onChange={(v) => setIns("reposts", Number(v))} />
          <Field label="Saves" value={ins.saves} onChange={(v) => setIns("saves", Number(v))} />

          {/* Watch Time */}
          <SectionTitle>Watch Time</SectionTitle>
          <Field label="Total Watch Time" value={ins.watchTime} onChange={(v) => setIns("watchTime", v)} type="text" />
          <Field label="Avg Watch Time" value={ins.avgWatchTime} onChange={(v) => setIns("avgWatchTime", v)} type="text" />

          {/* Views Split */}
          <SectionTitle>Views Split</SectionTitle>
          <Field label="Followers %" value={ins.followerViewsPct} onChange={(v) => setIns("followerViewsPct", Number(v))} />
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[13px] text-muted-foreground">Non-followers %</span>
            <span className="text-[13px] text-muted-foreground w-[120px] text-right">{100 - ins.followerViewsPct}%</span>
          </div>

          {/* View Rate */}
          <SectionTitle>View Rate Past 3 Sec</SectionTitle>
          <Field label="Rate %" value={ins.viewRatePast3Sec} onChange={(v) => setIns("viewRatePast3Sec", Number(v))} />

          {/* Sources - name + percentage */}
          <SectionTitle>Sources</SectionTitle>
          {ins.sources.map((src, idx) => (
            <div key={idx} className="flex items-center gap-2 py-1">
              <Input
                value={src.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setData((prev) => {
                    if (!prev) return prev;
                    const newSources = [...prev.insights.sources];
                    newSources[idx] = { ...newSources[idx], name: val };
                    return { ...prev, insights: { ...prev.insights, sources: newSources } };
                  });
                }}
                className="flex-1 h-8 text-[13px] bg-secondary border-border"
                placeholder="Source name"
              />
              <Input
                type="number"
                value={src.pct}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setData((prev) => {
                    if (!prev) return prev;
                    const newSources = [...prev.insights.sources];
                    newSources[idx] = { ...newSources[idx], pct: val };
                    return { ...prev, insights: { ...prev.insights, sources: newSources } };
                  });
                }}
                className="w-[80px] h-8 text-[13px] bg-secondary border-border text-right"
              />
              <span className="text-[12px] text-muted-foreground">%</span>
            </div>
          ))}

          {/* Accounts Reached */}
          <SectionTitle>Accounts Reached</SectionTitle>
          <Field label="Reached" value={ins.accountsReached} onChange={(v) => setIns("accountsReached", Number(v))} />

          {/* Gender */}
          <SectionTitle>Gender</SectionTitle>
          <Field label="Male %" value={ins.genderMale} onChange={(v) => {
            const male = Math.min(100, Math.max(0, Number(v)));
            setData((prev) => prev ? { ...prev, insights: { ...prev.insights, genderMale: male, genderFemale: 100 - male } } : prev);
          }} />
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[13px] text-muted-foreground">Female %</span>
            <span className="text-[13px] text-muted-foreground w-[120px] text-right">{ins.genderFemale}%</span>
          </div>

          {/* Countries */}
          <SectionTitle>Countries</SectionTitle>
          {ins.countries.map((c, idx) => (
            <div key={idx} className="flex items-center gap-2 py-1">
              <Input
                value={c.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setData((prev) => {
                    if (!prev) return prev;
                    const newC = [...prev.insights.countries];
                    newC[idx] = { ...newC[idx], name: val };
                    return { ...prev, insights: { ...prev.insights, countries: newC } };
                  });
                }}
                className="flex-1 h-8 text-[13px] bg-secondary border-border"
                placeholder="Country"
              />
              <Input
                type="number"
                value={c.pct}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setData((prev) => {
                    if (!prev) return prev;
                    const newC = [...prev.insights.countries];
                    newC[idx] = { ...newC[idx], pct: val };
                    return { ...prev, insights: { ...prev.insights, countries: newC } };
                  });
                }}
                className="w-[80px] h-8 text-[13px] bg-secondary border-border text-right"
              />
              <span className="text-[12px] text-muted-foreground">%</span>
            </div>
          ))}

          {/* Age Groups - name + percentage */}
          <SectionTitle>Age Groups</SectionTitle>
          {ins.ageGroups.map((a, idx) => (
            <div key={idx} className="flex items-center gap-2 py-1">
              <Input
                value={a.range}
                onChange={(e) => {
                  const val = e.target.value;
                  setData((prev) => {
                    if (!prev) return prev;
                    const newA = [...prev.insights.ageGroups];
                    newA[idx] = { ...newA[idx], range: val };
                    return { ...prev, insights: { ...prev.insights, ageGroups: newA } };
                  });
                }}
                className="flex-1 h-8 text-[13px] bg-secondary border-border"
                placeholder="Age range"
              />
              <Input
                type="number"
                value={a.pct}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setData((prev) => {
                    if (!prev) return prev;
                    const newA = [...prev.insights.ageGroups];
                    newA[idx] = { ...newA[idx], pct: val };
                    return { ...prev, insights: { ...prev.insights, ageGroups: newA } };
                  });
                }}
                className="w-[80px] h-8 text-[13px] bg-secondary border-border text-right"
              />
              <span className="text-[12px] text-muted-foreground">%</span>
            </div>
          ))}

          {/* Profile Activity */}
          <SectionTitle>Profile Activity</SectionTitle>
          <Field label="Follows" value={ins.follows} onChange={(v) => setIns("follows", Number(v))} />

          {/* Graph Start Date */}
          <SectionTitle>Graph Start Date</SectionTitle>
          <div className="py-1.5">
            <Input
              type="text"
              placeholder="23 Jan"
              value={data.graphStartDate || ins.viewsOverTime?.[0]?.day || "23 Jan"}
              onChange={(e) => setData((prev) => prev ? { ...prev, graphStartDate: e.target.value } : prev)}
              className="h-8 text-[13px] bg-secondary border-border"
            />
          </div>

          {/* Show/Hide Graph Toggle */}
          <SectionTitle>Graph Visibility</SectionTitle>
          <div className="flex items-center justify-between py-2">
            <span className="text-[13px] text-foreground">Show Graph</span>
            <button
              onClick={() => setData((prev) => prev ? { ...prev, showGraph: !(prev.showGraph !== false) } : prev)}
              className={`w-[44px] h-[24px] rounded-full transition-colors ${data.showGraph !== false ? 'bg-[#0095f6]' : 'bg-muted'}`}
            >
              <div className={`w-[20px] h-[20px] rounded-full bg-white shadow transition-transform mx-[2px] ${data.showGraph !== false ? 'translate-x-[20px]' : 'translate-x-0'}`} />
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-1 mb-2">Toggle off to hide the "Views over time" graph in insights</p>

          {/* Views Over Time (5 Points) */}
          <SectionTitle>Views Over Time (5 Points)</SectionTitle>
          {ins.viewsOverTime.map((point, idx) => (
            <div key={idx} className="flex items-center gap-2 py-1">
              <Input
                value={point.day}
                onChange={(e) => {
                  const val = e.target.value;
                  setData((prev) => {
                    if (!prev) return prev;
                    const newV = [...prev.insights.viewsOverTime];
                    newV[idx] = { ...newV[idx], day: val };
                    return { ...prev, insights: { ...prev.insights, viewsOverTime: newV } };
                  });
                }}
                className="w-[80px] h-8 text-[13px] bg-secondary border-border"
                placeholder="Label"
              />
              <Input
                type="number"
                value={point.thisReel}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setData((prev) => {
                    if (!prev) return prev;
                    const newV = [...prev.insights.viewsOverTime];
                    newV[idx] = { ...newV[idx], thisReel: val };
                    return { ...prev, insights: { ...prev.insights, viewsOverTime: newV } };
                  });
                }}
                className="flex-1 h-8 text-[13px] bg-secondary border-border text-right"
                placeholder="This Reel"
              />
              <Input
                type="number"
                value={point.typical}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setData((prev) => {
                    if (!prev) return prev;
                    const newV = [...prev.insights.viewsOverTime];
                    newV[idx] = { ...newV[idx], typical: val };
                    return { ...prev, insights: { ...prev.insights, viewsOverTime: newV } };
                  });
                }}
                className="w-[70px] h-8 text-[13px] bg-secondary border-border text-right"
                placeholder="Typical"
              />
            </div>
          ))}

          {/* Y-Axis Lines */}
          <SectionTitle>Y-Axis Lines</SectionTitle>
          <div className="flex items-center gap-2 py-1">
            <span className="text-[12px] text-muted-foreground w-[80px]">Center</span>
            <Input
              type="number"
              value={data.yCenter ?? 500}
              onChange={(e) => setData((prev) => prev ? { ...prev, yCenter: Number(e.target.value) } : prev)}
              className="flex-1 h-8 text-[13px] bg-secondary border-border text-right"
              placeholder="500"
            />
          </div>
          <div className="flex items-center gap-2 py-1">
            <span className="text-[12px] text-muted-foreground w-[80px]">Top</span>
            <Input
              type="number"
              value={data.yTop ?? 1000}
              onChange={(e) => setData((prev) => prev ? { ...prev, yTop: Number(e.target.value) } : prev)}
              className="flex-1 h-8 text-[13px] bg-secondary border-border text-right"
              placeholder="1000"
            />
          </div>

          {/* Graph Drawing Editor */}
          <SectionTitle>Draw Graph</SectionTitle>
          <GraphEditorModal
            open={true}
            onClose={() => { }}
            onSave={(graphData) => {
              setData((prev) => prev ? { ...prev, insights: { ...prev.insights, viewsOverTime: graphData } } : prev);
            }}
            initialData={ins.viewsOverTime}
            maxViews={ins.views}
            inline={true}
          />
          <Button onClick={(e) => handleSave(e)} className="w-full mt-6 bg-[#0095f6] hover:bg-[#0081d6] text-white font-semibold">
            Save Changes
          </Button>

          {onDelete && (
            <Button
              variant="ghost"
              onClick={() => {
                onDelete(reelIndex);
                onClose();
              }}
              className="w-full mt-2 text-destructive hover:text-destructive hover:bg-destructive/10 font-semibold"
            >
              Delete Reel
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ReelEditModal;
