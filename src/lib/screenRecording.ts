import { supabase } from "@/integrations/supabase/client";

interface RecordingEvent {
  type: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

let sessionId = "";
let events: RecordingEvent[] = [];
let isRecording = false;
let startTime = 0;
let flushInterval: ReturnType<typeof setInterval> | null = null;

function getSessionId(): string {
  let id = sessionStorage.getItem("ig_analytics_session");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("ig_analytics_session", id);
  }
  return id;
}

export function startRecording() {
  if (isRecording) return;
  isRecording = true;
  sessionId = getSessionId();
  startTime = Date.now();
  events = [];

  document.addEventListener("click", handleClick, true);
  document.addEventListener("scroll", handleScroll, true);
  window.addEventListener("popstate", handleNav);

  supabase.from("session_recordings").insert({
    session_id: sessionId,
    started_at: new Date().toISOString(),
  } as any).then(() => {});

  flushInterval = setInterval(flushEvents, 10000);
}

export function stopRecording() {
  if (!isRecording) return;
  isRecording = false;

  document.removeEventListener("click", handleClick, true);
  document.removeEventListener("scroll", handleScroll, true);
  window.removeEventListener("popstate", handleNav);

  if (flushInterval) clearInterval(flushInterval);
  flushEvents();

  supabase.from("session_recordings")
    .update({
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      events: JSON.parse(JSON.stringify(events)),
    } as any)
    .eq("session_id", sessionId)
    .then(() => {});
}

function handleClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  events.push({
    type: "click",
    timestamp: Date.now() - startTime,
    data: {
      tag: target.tagName,
      text: target.textContent?.slice(0, 50) || "",
      path: window.location.pathname,
      x: e.clientX,
      y: e.clientY,
    },
  });
}

function handleScroll() {
  events.push({
    type: "scroll",
    timestamp: Date.now() - startTime,
    data: { scrollY: window.scrollY, path: window.location.pathname },
  });
}

function handleNav() {
  events.push({
    type: "navigation",
    timestamp: Date.now() - startTime,
    data: { path: window.location.pathname },
  });
}

function flushEvents() {
  if (events.length === 0) return;
  supabase.from("session_recordings")
    .update({
      events: JSON.parse(JSON.stringify(events)),
      duration_ms: Date.now() - startTime,
    } as any)
    .eq("session_id", sessionId)
    .then(() => {});
}

export function getRecordingStatus() {
  return isRecording;
}
