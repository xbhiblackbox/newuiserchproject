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
    // Analytics tracking disabled - tables not configured
  }
  currentPath = path;
  pageEnteredAt = Date.now();
}

export function trackEvent(eventType: string, eventData: Record<string, unknown> = {}) {
  // Analytics tracking disabled - tables not configured
}
