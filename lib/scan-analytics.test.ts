import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dayBucketsForLast7d,
  hourBucketsForLast24h,
  normalizeScanAnalyticsAddress,
  recordSuccessfulScan,
  SCAN_ANALYTICS_KEYS,
  scheduleSuccessfulScanAnalytics,
  utcDayBucket,
  utcHourBucket,
  type ScanAnalyticsKv,
} from "@/lib/scan-analytics";

const SAMPLE =
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const SAMPLE_LC = SAMPLE.toLowerCase();

function createMockKv(overrides?: Partial<ScanAnalyticsKv>): {
  kv: ScanAnalyticsKv;
  incrCalls: string[];
  expireCalls: Array<{ key: string; ttl: number }>;
  saddCalls: Array<{ key: string; members: string[] }>;
  zincrbyCalls: Array<{ key: string; inc: number; member: string }>;
  setCalls: Array<{ key: string; value: unknown }>;
} {
  const incrCalls: string[] = [];
  const expireCalls: Array<{ key: string; ttl: number }> = [];
  const saddCalls: Array<{ key: string; members: string[] }> = [];
  const zincrbyCalls: Array<{
    key: string;
    inc: number;
    member: string;
  }> = [];
  const setCalls: Array<{ key: string; value: unknown }> = [];

  const kv: ScanAnalyticsKv = {
    incr: vi.fn(async (key: string) => {
      incrCalls.push(key);
      return incrCalls.length;
    }),
    expire: vi.fn(async (key: string, ttl: number) => {
      expireCalls.push({ key, ttl });
      return 1;
    }),
    set: vi.fn(async (key: string, value: unknown) => {
      setCalls.push({ key, value });
      return "OK";
    }),
    sadd: vi.fn(async (key: string, ...members: string[]) => {
      saddCalls.push({ key, members });
      return 1;
    }),
    zincrby: vi.fn(async (key: string, inc: number, member: string) => {
      zincrbyCalls.push({ key, inc, member });
      return inc;
    }),
    ...overrides,
  };

  return { kv, incrCalls, expireCalls, saddCalls, zincrbyCalls, setCalls };
}

describe("scan-analytics helpers", () => {
  it("normalizes valid CA to lowercase checksum form", () => {
    expect(normalizeScanAnalyticsAddress(SAMPLE)).toBe(SAMPLE_LC);
    expect(normalizeScanAnalyticsAddress(`  ${SAMPLE}  `)).toBe(SAMPLE_LC);
  });

  it("rejects invalid CA", () => {
    expect(normalizeScanAnalyticsAddress("not-an-address")).toBeNull();
    expect(normalizeScanAnalyticsAddress("0x1234")).toBeNull();
    expect(normalizeScanAnalyticsAddress("")).toBeNull();
  });

  it("builds UTC hour/day buckets", () => {
    const d = new Date(Date.UTC(2026, 6, 28, 2, 15, 0)); // Jul 28 02:15 UTC
    expect(utcHourBucket(d)).toBe("2026072802");
    expect(utcDayBucket(d)).toBe("20260728");
  });

  it("lists 24 hour buckets and 7 day buckets", () => {
    const now = new Date(Date.UTC(2026, 6, 28, 10, 0, 0));
    const hours = hourBucketsForLast24h(now);
    expect(hours).toHaveLength(24);
    expect(hours[0]).toBe("2026072711");
    expect(hours[23]).toBe("2026072810");

    const days = dayBucketsForLast7d(now);
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("20260722");
    expect(days[6]).toBe("20260728");
  });

  it("aggregation keys include total, uniq, per-CA, rank, hour/day", () => {
    // Phase 12C: keys begin with deploymentScope
    expect(SCAN_ANALYTICS_KEYS.total()).toContain("analytics:scan:v1:total");
    expect(SCAN_ANALYTICS_KEYS.uniq()).toContain("analytics:scan:v1:uniq");
    expect(SCAN_ANALYTICS_KEYS.hits(SAMPLE_LC)).toContain(
      `analytics:scan:v1:hits:${SAMPLE_LC}`,
    );
    expect(SCAN_ANALYTICS_KEYS.rankAll()).toContain("analytics:scan:v1:rank:all");
    expect(SCAN_ANALYTICS_KEYS.hourHits("2026072810", SAMPLE_LC)).toContain(
      `analytics:scan:v1:h:2026072810:${SAMPLE_LC}`,
    );
    expect(SCAN_ANALYTICS_KEYS.dayHits("20260728", SAMPLE_LC)).toContain(
      `analytics:scan:v1:d:20260728:${SAMPLE_LC}`,
    );
  });
});

describe("recordSuccessfulScan", () => {
  const now = new Date(Date.UTC(2026, 6, 28, 10, 30, 0));

  it("increments totals, uniq, per-CA hits, rank, and window buckets", async () => {
    const { kv, incrCalls, saddCalls, zincrbyCalls, setCalls, expireCalls } =
      createMockKv();

    const ok = await recordSuccessfulScan(SAMPLE, now, kv);
    expect(ok).toBe(true);

    expect(incrCalls).toContain(SCAN_ANALYTICS_KEYS.total());
    expect(incrCalls).toContain(SCAN_ANALYTICS_KEYS.hits(SAMPLE_LC));
    expect(incrCalls).toContain(
      SCAN_ANALYTICS_KEYS.hourHits("2026072810", SAMPLE_LC),
    );
    expect(incrCalls).toContain(SCAN_ANALYTICS_KEYS.dayHits("20260728", SAMPLE_LC));
    expect(incrCalls).toContain(SCAN_ANALYTICS_KEYS.hourTotal("2026072810"));
    expect(incrCalls).toContain(SCAN_ANALYTICS_KEYS.dayTotal("20260728"));

    expect(saddCalls).toEqual([
      { key: SCAN_ANALYTICS_KEYS.uniq(), members: [SAMPLE_LC] },
    ]);
    expect(zincrbyCalls).toEqual([
      { key: SCAN_ANALYTICS_KEYS.rankAll(), inc: 1, member: SAMPLE_LC },
    ]);
    expect(
      setCalls.some(
        (c) =>
          c.key === SCAN_ANALYTICS_KEYS.last(SAMPLE_LC) &&
          c.value === now.toISOString(),
      ),
    ).toBe(true);
    expect(expireCalls.length).toBeGreaterThanOrEqual(4);
  });

  it("skips invalid address without writing", async () => {
    const { kv, incrCalls } = createMockKv();
    const ok = await recordSuccessfulScan("nope", now, kv);
    expect(ok).toBe(false);
    expect(incrCalls).toHaveLength(0);
  });

  it("returns false when KV unavailable", async () => {
    const ok = await recordSuccessfulScan(SAMPLE, now, null);
    expect(ok).toBe(false);
  });

  it("isolates KV failures (never throws)", async () => {
    const { kv } = createMockKv({
      incr: vi.fn(async () => {
        throw new Error("kv down");
      }),
    });
    await expect(recordSuccessfulScan(SAMPLE, now, kv)).resolves.toBe(false);
  });
});

describe("scheduleSuccessfulScanAnalytics failure isolation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not throw when record rejects", async () => {
    expect(() => scheduleSuccessfulScanAnalytics("not-valid")).not.toThrow();
    // allow microtask drain
    await Promise.resolve();
    await Promise.resolve();
  });
});
