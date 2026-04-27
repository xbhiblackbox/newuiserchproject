import { AlertTriangle, RefreshCcw, X, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { LoadFailure } from "@/lib/instagramApi";
import { cn } from "@/lib/utils";

interface LoadErrorPanelProps {
  failure: LoadFailure;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const stepLabel: Record<LoadFailure["step"], string> = {
  fetch: "Network fetch",
  cache: "Local cache",
  parse: "Response parse",
};

const stepHint: Record<LoadFailure["step"], string> = {
  fetch: "Server request failed before data arrived.",
  cache: "Local cache read/write failed.",
  parse: "Server response could not be parsed.",
};

export const LoadErrorPanel = ({ failure, onRetry, onDismiss, className }: LoadErrorPanelProps) => {
  const [copied, setCopied] = useState(false);
  const trace = failure.serverTraceId || failure.traceId;

  const copyDetails = async () => {
    const payload = [
      `step: ${failure.step}`,
      `message: ${failure.message}`,
      trace ? `traceId: ${trace}` : null,
      failure.status ? `status: ${failure.status}` : null,
      failure.username ? `username: ${failure.username}` : null,
      failure.type ? `type: ${failure.type}` : null,
      failure.url ? `url: ${failure.url}` : null,
      `at: ${new Date(failure.at).toISOString()}`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div
      role="alert"
      className={cn(
        "mx-4 my-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-foreground shadow-sm",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">
              Couldn't load — failed at {stepLabel[failure.step]}
            </div>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className="rounded p-1 text-muted-foreground hover:bg-background/50 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{stepHint[failure.step]}</p>
          <p className="mt-1 break-words text-xs text-foreground/80">{failure.message}</p>

          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {trace && (
              <>
                <dt>Trace ID</dt>
                <dd className="truncate font-mono text-foreground">{trace}</dd>
              </>
            )}
            {failure.status != null && (
              <>
                <dt>Status</dt>
                <dd className="font-mono text-foreground">{failure.status}</dd>
              </>
            )}
            {failure.username && (
              <>
                <dt>User</dt>
                <dd className="truncate font-mono text-foreground">@{failure.username}</dd>
              </>
            )}
            {failure.type && (
              <>
                <dt>Type</dt>
                <dd className="font-mono text-foreground">{failure.type}</dd>
              </>
            )}
          </dl>

          <div className="mt-2.5 flex flex-wrap gap-2">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background hover:opacity-90"
              >
                <RefreshCcw className="h-3 w-3" />
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={copyDetails}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/50 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-background"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy details"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadErrorPanel;
