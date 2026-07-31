import { scopedKvKey } from "@/lib/hansome-score/deployment-scope";
import { WEB_ANALYTICS_PREFIX } from "@/lib/website-analytics/constants";

function webKey(...parts: Array<string | number>): string {
  return scopedKvKey(WEB_ANALYTICS_PREFIX, ...parts);
}

/** Keys begin with deploymentScope (Phase 12C). */
export const WEB_ANALYTICS_KEYS = {
  meta: () => webKey("meta"),

  dayPv: (date: string) => webKey("day", date, "pv"),
  dayUv: (date: string) => webKey("day", date, "uv"),
  dayUip: (date: string) => webKey("day", date, "uip"),
  daySessions: (date: string) => webKey("day", date, "sessions"),
  dayBots: (date: string) => webKey("day", date, "bots"),
  dayPages: (date: string) => webKey("day", date, "pages"),
  dayRefs: (date: string) => webKey("day", date, "refs"),
  dayCountries: (date: string) => webKey("day", date, "countries"),

  allPv: () => webKey("all", "pv"),
  allUv: () => webKey("all", "uv"),
  allUip: () => webKey("all", "uip"),
  allSessions: () => webKey("all", "sessions"),
  allBots: () => webKey("all", "bots"),

  /** Daily visitor dedupe — value "1", NX. */
  uvDedupe: (date: string, visitorHash: string) =>
    webKey("uv", date, visitorHash),
  /** All-time visitor dedupe. */
  uvDedupeAll: (visitorHash: string) => webKey("uv", "all", visitorHash),
  /** Daily IP dedupe. */
  uipDedupe: (date: string, ipHash: string) => webKey("uip", date, ipHash),
  /** All-time IP dedupe. */
  uipDedupeAll: (ipHash: string) => webKey("uip", "all", ipHash),
  /** Daily session dedupe. */
  sessionDedupe: (date: string, sessionHash: string) =>
    webKey("session", date, sessionHash),
  sessionDedupeAll: (sessionHash: string) =>
    webKey("session", "all", sessionHash),

  pagePv: (date: string, pathname: string) => webKey("pv", date, pathname),
  pageUvDedupe: (date: string, pathname: string, visitorHash: string) =>
    webKey("page_uv", date, pathname, visitorHash),
  pageUipDedupe: (date: string, pathname: string, ipHash: string) =>
    webKey("page_uip", date, pathname, ipHash),
  pageUv: (date: string, pathname: string) =>
    webKey("page", date, pathname, "uv"),
  pageUip: (date: string, pathname: string) =>
    webKey("page", date, pathname, "uip"),

  debounce: (date: string, visitorHash: string, pathname: string) =>
    webKey("debounce", date, visitorHash, pathname),
} as const;

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** UTC day bucket `yyyyMMdd`. */
export function utcDayBucket(date: Date = new Date()): string {
  return (
    `${date.getUTCFullYear()}` +
    pad2(date.getUTCMonth() + 1) +
    pad2(date.getUTCDate())
  );
}

/** Last N UTC day buckets (newest last). */
export function dayBucketsForLastN(n: number, now: Date = new Date()): string[] {
  const buckets: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i),
    );
    buckets.push(utcDayBucket(d));
  }
  return buckets;
}
