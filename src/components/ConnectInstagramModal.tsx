import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Instagram, Loader2, Unlink } from "lucide-react";
import {
  fetchInstagramData,
  setConnectedUsername,
  getConnectedUsername,
  disconnectInstagram,
} from "@/lib/instagramApi";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConnected?: (username: string) => void;
  onDisconnected?: () => void;
}

const USERNAME_RE = /^[a-zA-Z0-9._]{1,30}$/;

const ConnectInstagramModal = ({ open, onOpenChange, onConnected, onDisconnected }: Props) => {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    if (open) setCurrent(getConnectedUsername());
  }, [open]);

  const handleConnect = async () => {
    const clean = value.trim().replace(/^@/, "");
    if (!USERNAME_RE.test(clean)) {
      toast.error("Invalid username");
      return;
    }
    setLoading(true);
    try {
      const res = await fetchInstagramData(clean, "profile");
      if (!res.profileOk || !res.profile?.username) {
        toast.error(`Error: ${res.profileError || "Account not found or private"}`);
        return;
      }
      setConnectedUsername(clean);
      toast.success(`Connected @${clean}`);
      onConnected?.(clean);
      onOpenChange(false);
      setValue("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to verify");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    disconnectInstagram();
    setCurrent(null);
    toast.success("Disconnected");
    onDisconnected?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram size={18} /> Connect Instagram
          </DialogTitle>
          <DialogDescription>
            Enter a public Instagram username to load live data.
          </DialogDescription>
        </DialogHeader>

        {current && (
          <div className="text-xs text-muted-foreground -mt-2">
            Currently connected: <span className="font-semibold">@{current}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">@</span>
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/^@/, ""))}
            placeholder="username"
            onKeyDown={(e) => e.key === "Enter" && !loading && handleConnect()}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={handleConnect} disabled={loading || !value.trim()}>
            {loading ? <Loader2 className="animate-spin" size={16} /> : "Connect"}
          </Button>
          {current && (
            <Button variant="outline" onClick={handleDisconnect} disabled={loading}>
              <Unlink size={14} className="mr-1" /> Disconnect
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectInstagramModal;
