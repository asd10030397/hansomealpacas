/**
 * First-party website analytics (pageviews / unique visitors / unique IPs).
 * Isolated from Scan KV counters (`analytics:scan:v1:*`).
 */

export const WEB_ANALYTICS_SCHEMA_VERSION = 1;
export const WEB_ANALYTICS_PREFIX = "analytics:web:v1";

/** Cookie: anonymous visitor UUID (not HttpOnly — set/read by beacon). */
export const VISITOR_COOKIE = "ha_vid";
/** Cookie: short-lived session id. */
export const SESSION_COOKIE = "ha_sid";
/** Cookie: analytics opt-out. */
export const OPT_OUT_COOKIE = "ha_analytics_opt_out";
/** Cookie: admin session after secret check. */
export const ADMIN_COOKIE = "ha_analytics_admin";

/** Visitor anonymous ID lifetime (90 days). */
export const VISITOR_COOKIE_MAX_AGE_SEC = 90 * 24 * 60 * 60;
/** Session cookie lifetime (30 minutes). */
export const SESSION_COOKIE_MAX_AGE_SEC = 30 * 60;
/** Admin cookie lifetime (12 hours). */
export const ADMIN_COOKIE_MAX_AGE_SEC = 12 * 60 * 60;

/** Same visitor + pathname refresh debounce. */
export const DEBOUNCE_TTL_SEC = 5;

/** Daily dedupe keys (UV / UIP / session / page uniques). */
export const DAILY_DEDUPE_TTL_SEC = 48 * 60 * 60;
/** All-time visitor dedupe — matches cookie lifetime + skew. */
export const ALLTIME_VISITOR_DEDUPE_TTL_SEC = 100 * 24 * 60 * 60;
/** All-time IP-hash dedupe retention. */
export const ALLTIME_IP_DEDUPE_TTL_SEC = 400 * 24 * 60 * 60;
/** Daily aggregate buckets retained for 30d windows + skew. */
export const DAILY_AGGREGATE_TTL_SEC = 40 * 24 * 60 * 60;

/** Known crawler / uptime / internal smoke UAs (substring, case-insensitive). */
export const BOT_UA_PATTERNS = [
  "bot",
  "spider",
  "crawl",
  "slurp",
  "mediapartners-google",
  "apis-google",
  "adsbot",
  "bingpreview",
  "yandex",
  "baidu",
  "duckduckbot",
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "embedly",
  "quora link preview",
  "showyoubot",
  "outbrain",
  "pinterest",
  "redditbot",
  "applebot",
  "semrush",
  "ahrefs",
  "mj12bot",
  "dotbot",
  "petalbot",
  "bytespider",
  "gptbot",
  "claudebot",
  "amazonbot",
  "uptime",
  "pingdom",
  "statuscake",
  "site24x7",
  "better uptime",
  "vercel-favicon",
  "vercel-screenshot",
  "hansome-smoke",
  "hansome-analytics-smoke",
  "headlesschrome",
  "phantomjs",
  "python-requests",
  "curl/",
  "wget/",
  "go-http-client",
  "httpclient",
  "java/",
] as const;

export const INTERNAL_SMOKE_UA = "hansome-analytics-smoke";
