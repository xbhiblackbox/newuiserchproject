import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "ig_analytics_session";

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

let currentPath = "";
let pageEnteredAt = 0;

export function trackPageView(path: string) {
  if (currentPath && pageEnteredAt) {
    const duration = Date.now() - pageEnteredAt;
    supabase.from("page_views").insert({
      session_id: getSessionId(),
      page_path: currentPath,
      duration_ms: duration,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
    } as any).then(() => {});
  }
  currentPath = path;
  pageEnteredAt = Date.now();
}

export function trackEvent(eventType: string, eventData: Record<string, unknown> = {}) {
  supabase.from("analytics_events").insert({
    session_id: getSessionId(),
    event_type: eventType,
    event_data: eventData,
    page_path: window.location.pathname,
  } as any).then(() => {});
}
