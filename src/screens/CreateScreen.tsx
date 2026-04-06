import { useState, useRef } from "react";
import { Camera, Image, X, Type, MapPin, Users, ChevronRight, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const CreateScreen = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setSelectedImage(url);
      trackEvent("create_image_selected");
    }
  };

  const handlePost = () => {
    toast.success("Post shared successfully! 🎉");
    trackEvent("create_post");
    setSelectedImage(null);
    setCaption("");
    setLocation("");
  };

  if (selectedImage) {
    return (
      <div className="pb-16 min-h-screen bg-background">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background px-4 py-2.5">
          <button onClick={() => setSelectedImage(null)} className="text-foreground">
            <X size={24} />
          </button>
          <h1 className="text-[16px] font-bold text-foreground">New post</h1>
          <button onClick={handlePost} className="text-[14px] font-bold text-[hsl(var(--ig-blue))]">
            Share
          </button>
        </header>

        <div className="p-4">
          <div className="flex gap-4 border-b border-border pb-4">
            <img src={selectedImage} alt="Preview" className="h-[72px] w-[72px] rounded object-cover flex-shrink-0" />
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption..."
              className="flex-1 border-none resize-none text-[14px] bg-transparent focus-visible:ring-0 p-0 min-h-[72px]"
            />
          </div>

          <div className="divide-y divide-border">
            {[
              { icon: MapPin, label: "Add location" },
              { icon: Users, label: "Tag people" },
              { icon: Type, label: "Add alt text" },
              { icon: Settings, label: "Advanced settings" },
            ].map(({ icon: Icon, label }) => (
              <button key={label} className="flex w-full items-center justify-between py-3.5">
                <div className="flex items-center gap-3">
                  <Icon size={20} className="text-foreground" />
                  <span className="text-[14px] text-foreground">{label}</span>
                </div>
                <ChevronRight size={18} className="text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-6 px-6 pb-16">
      <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />

      <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30">
        <Camera size={36} className="text-muted-foreground/50" />
      </div>

      <div className="text-center">
        <h2 className="text-[20px] font-bold text-foreground">Create new post</h2>
        <p className="mt-1.5 text-[14px] text-muted-foreground max-w-[260px]">
          Share photos and videos with your followers
        </p>
      </div>

      <Button
        onClick={() => fileRef.current?.click()}
        className="rounded-lg bg-[hsl(var(--ig-blue))] hover:bg-[hsl(var(--ig-blue))]/90 text-white px-6 h-[36px] text-[14px] font-semibold"
      >
        <Image size={18} className="mr-2" /> Select from gallery
      </Button>
    </div>
  );
};

export default CreateScreen;