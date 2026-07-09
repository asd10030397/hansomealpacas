export type AnalyticsProvider = "plausible" | "ga" | "none";

export type AnalyticsConfig =
  | { provider: "none" }
  | { provider: "plausible"; domain: string }
  | { provider: "ga"; measurementId: string };

export const AnalyticsEvents = {
  PAGE_VIEW: "page_view",
  DEER_VOTE_STARTED: "deer_vote_started",
  DEER_VOTE_COMPLETED: "deer_vote_completed",
  DEER_IDENTITY_SELECTED: "deer_identity_selected",
  SHARE_X_CLICKED: "share_x_clicked",
  LANGUAGE_CHANGED: "language_changed",
  AMBIENT_STARTED: "ambient_started",
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

export type AnalyticsEventParams = Record<string, string | number | boolean>;

type QueuedGaEvent = {
  name: string;
  props?: AnalyticsEventParams;
};

type DataLayer = unknown[] & {
  push: (...args: unknown[]) => number;
};

let gaEventQueue: QueuedGaEvent[] = [];
let gaFlushHookInstalled = false;

export function getAnalyticsConfig(): AnalyticsConfig {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
  if (plausibleDomain) {
    return { provider: "plausible", domain: plausibleDomain };
  }

  const gaId = process.env.NEXT_PUBLIC_GA_ID?.trim();
  if (gaId) {
    return { provider: "ga", measurementId: gaId };
  }

  return { provider: "none" };
}

export function isGaDebugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GA_DEBUG === "true";
}

function toPlausibleProps(props?: AnalyticsEventParams): Record<string, string> | undefined {
  if (!props) return undefined;

  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => [key, String(value)]),
  );
}

function getGtag(): ((...args: unknown[]) => void) | undefined {
  return (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
}

function getDataLayer(): DataLayer {
  const win = window as Window & { dataLayer?: DataLayer };
  if (!win.dataLayer) {
    win.dataLayer = [] as unknown as DataLayer;
  }
  return win.dataLayer;
}

function flushGaEventQueue(): void {
  const gtag = getGtag();
  if (!gtag || gaEventQueue.length === 0) return;

  const events = gaEventQueue;
  gaEventQueue = [];

  for (const event of events) {
    gtag("event", event.name, event.props);
  }
}

function installGaFlushHook(): void {
  if (gaFlushHookInstalled || typeof window === "undefined") return;
  gaFlushHookInstalled = true;

  const dataLayer = getDataLayer();
  const originalPush = dataLayer.push.bind(dataLayer);

  dataLayer.push = (...args: unknown[]) => {
    const result = originalPush(...args);
    flushGaEventQueue();
    return result;
  };

  flushGaEventQueue();
}

function sendGaEvent(name: string, props?: AnalyticsEventParams): void {
  const gtag = getGtag();
  if (gtag) {
    flushGaEventQueue();
    gtag("event", name, props);
    return;
  }

  gaEventQueue.push({ name, props });
  installGaFlushHook();
}

export function trackEvent(name: AnalyticsEventName, props?: AnalyticsEventParams): void;
export function trackEvent(name: string, props?: AnalyticsEventParams): void;
export function trackEvent(name: string, props?: AnalyticsEventParams): void {
  if (typeof window === "undefined") return;

  const config = getAnalyticsConfig();

  if (config.provider === "plausible" && "plausible" in window) {
    const plausible = (
      window as Window & {
        plausible: (event: string, options?: { props: Record<string, string> }) => void;
      }
    ).plausible;
    const plausibleProps = toPlausibleProps(props);
    if (plausibleProps) {
      plausible(name, { props: plausibleProps });
    } else {
      plausible(name);
    }
    return;
  }

  if (config.provider === "ga") {
    sendGaEvent(name, props);
  }
}

export function trackPageView(path: string): void {
  trackEvent(AnalyticsEvents.PAGE_VIEW, {
    page_path: path,
    page_title: document.title,
  });
}
