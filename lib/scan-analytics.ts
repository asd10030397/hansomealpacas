/**
 * Privacy-minimal Scan analytics (KV).
 *
 * On successful /api/scan only: aggregate counters for normalized contract
 * addresses. Never stores IP, wallet, or other personal identifiers.
 *
 * Writes are best-effort — callers must fire-and-forget; failures never
 * propagate to the Scan response path.
 */

import { getAddress, isAddress } from "viem";
import { scopedKvKey } from "@/lib/hansome-score/deployment-scope";

export const SCAN_ANALYTICS_SCHEMA_VERSION = 1;
export const SCAN_ANALYTICS_PREFIX = "analytics:scan:v1";

function analyticsKey(...parts: Array<string | number>): string {
  return scopedKvKey(SCAN_ANALYTICS_PREFIX, ...parts);
}

/** Hourly bucket retention (~48h covers 24h windows + skew). */
export const SCAN_ANALYTICS_HOUR_TTL_SEC = 48 * 60 * 60;
/** Daily bucket retention (~8d covers 7d windows + skew). */
export const SCAN_ANALYTICS_DAY_TTL_SEC = 8 * 24 * 60 * 60;

export type ScanAnalyticsKv = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  set(key: string, value: unknown): Promise<unknown>;
  sadd(key: string, ...members: string[]): Promise<number>;
  zincrby(key: string, increment: number, member: string): Promise<number>;
};

/** Keys begin with deploymentScope (Phase 12C). */
export const SCAN_ANALYTICS_KEYS = {
  meta: () => analyticsKey("meta"),
  total: () => analyticsKey("total"),
  uniq: () => analyticsKey("uniq"),
  hits: (addr: string) => analyticsKey("hits", addr),
  last: (addr: string) => analyticsKey("last", addr),
  rankAll: () => analyticsKey("rank", "all"),
  hourHits: (bucket: string, addr: string) =>
    analyticsKey("h", bucket, addr),
  dayHits: (bucket: string, addr: string) =>
    analyticsKey("d", bucket, addr),
  hourTotal: (bucket: string) => analyticsKey("h", bucket, "_total"),
  dayTotal: (bucket: string) => analyticsKey("d", bucket, "_total"),
} as const;

/** Normalize CA for analytics keys; null if invalid (do not count). */
export function normalizeScanAnalyticsAddress(address: string): string | null {
  const trimmed = address.trim();
  if (!trimmed || !isAddress(trimmed)) return null;
  return getAddress(trimmed).toLowerCase();
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** UTC hour bucket `yyyyMMddHH`. */
export function utcHourBucket(date: Date = new Date()): string {
  return (
    `${date.getUTCFullYear()}` +
    pad2(date.getUTCMonth() + 1) +
    pad2(date.getUTCDate()) +
    pad2(date.getUTCHours())
  );
}

/** UTC day bucket `yyyyMMdd`. */
export function utcDayBucket(date: Date = new Date()): string {
  return (
    `${date.getUTCFullYear()}` +
    pad2(date.getUTCMonth() + 1) +
    pad2(date.getUTCDate())
  );
}

/** Last 24 UTC hour buckets (newest last), for 24H aggregation. */
export function hourBucketsForLast24h(now: Date = new Date()): string[] {
  const buckets: string[] = [];
  for (let i = 23; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000);
    buckets.push(utcHourBucket(d));
  }
  return buckets;
}

/** Last 7 UTC day buckets (newest last), for 7D aggregation. */
export function dayBucketsForLast7d(now: Date = new Date()): string[] {
  const buckets: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i),
    );
    buckets.push(utcDayBucket(d));
  }
  return buckets;
}

export function isScanAnalyticsKvConfigured(): boolean {
  const url =
    process.env.KV_REST_API_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    "";
  const token =
    process.env.KV_REST_API_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    "";
  return Boolean(url && token);
}

async function getKv(): Promise<ScanAnalyticsKv | null> {
  if (!isScanAnalyticsKvConfigured()) return null;
  const { kv } = await import("@vercel/kv");
  return kv as unknown as ScanAnalyticsKv;
}

async function incrWithTtl(
  kv: ScanAnalyticsKv,
  key: string,
  ttlSec: number,
): Promise<void> {
  await kv.incr(key);
  await kv.expire(key, ttlSec);
}

/**
 * Persist one successful Scan observation. Never throws.
 * Prefer {@link scheduleSuccessfulScanAnalytics} from request handlers.
 */
export async function recordSuccessfulScan(
  address: string,
  now: Date = new Date(),
  kvClient?: ScanAnalyticsKv | null,
): Promise<boolean> {
  try {
    const addr = normalizeScanAnalyticsAddress(address);
    if (!addr) return false;

    const kv = kvClient === undefined ? await getKv() : kvClient;
    if (!kv) return false;

    const hour = utcHourBucket(now);
    const day = utcDayBucket(now);
    const iso = now.toISOString();

    await Promise.all([
      kv.incr(SCAN_ANALYTICS_KEYS.total()),
      kv.sadd(SCAN_ANALYTICS_KEYS.uniq(), addr),
      kv.incr(SCAN_ANALYTICS_KEYS.hits(addr)),
      kv.set(SCAN_ANALYTICS_KEYS.last(addr), iso),
      kv.zincrby(SCAN_ANALYTICS_KEYS.rankAll(), 1, addr),
      incrWithTtl(
        kv,
        SCAN_ANALYTICS_KEYS.hourHits(hour, addr),
        SCAN_ANALYTICS_HOUR_TTL_SEC,
      ),
      incrWithTtl(
        kv,
        SCAN_ANALYTICS_KEYS.dayHits(day, addr),
        SCAN_ANALYTICS_DAY_TTL_SEC,
      ),
      incrWithTtl(
        kv,
        SCAN_ANALYTICS_KEYS.hourTotal(hour),
        SCAN_ANALYTICS_HOUR_TTL_SEC,
      ),
      incrWithTtl(
        kv,
        SCAN_ANALYTICS_KEYS.dayTotal(day),
        SCAN_ANALYTICS_DAY_TTL_SEC,
      ),
      kv.set(SCAN_ANALYTICS_KEYS.meta(), {
        schemaVersion: SCAN_ANALYTICS_SCHEMA_VERSION,
        updatedAt: iso,
      }),
    ]);
    return true;
  } catch (err) {
    console.warn("[scan-analytics] record failed:", err);
    return false;
  }
}

/**
 * Fire-and-forget wrapper — never throws; safe beside Scan response path.
 */
export function scheduleSuccessfulScanAnalytics(address: string): void {
  try {
    void recordSuccessfulScan(address).catch((err) => {
      console.warn("[scan-analytics] schedule failed:", err);
    });
  } catch (err) {
    console.warn("[scan-analytics] schedule sync failed:", err);
  }
}
