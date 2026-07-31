import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ADMIN_COOKIE,
  ALLTIME_IP_DEDUPE_TTL_SEC,
  DAILY_DEDUPE_TTL_SEC,
  DEBOUNCE_TTL_SEC,
  VISITOR_COOKIE_MAX_AGE_SEC,
} from "@/lib/website-analytics/constants";
import {
  mintAdminCookieValue,
  secretsEqual,
  verifyAdminCookieValue,
  isAuthorizedAdmin,
} from "@/lib/website-analytics/auth";
import {
  classifyExclusion,
  isBotUserAgent,
  isPreviewDeployment,
  normalizePathname,
} from "@/lib/website-analytics/filter";
import {
  extractTrustedClientIp,
  hashIp,
  hashOpaqueId,
  normalizeIp,
} from "@/lib/website-analytics/ip";
import { WEB_ANALYTICS_KEYS, utcDayBucket } from "@/lib/website-analytics/keys";
import { recordPageView } from "@/lib/website-analytics/record";
import type { WebAnalyticsKv } from "@/lib/website-analytics/kv";

const SALT = "test-analytics-ip-salt-not-a-secret";
const NOW = new Date(Date.UTC(2026, 6, 28, 12, 0, 0));
const DAY = utcDayBucket(NOW);

type Store = Map<string, { value: unknown; ex?: number }>;

function createMemoryKv(): {
  kv: WebAnalyticsKv;
  store: Store;
  incrCalls: string[];
  setNxCalls: Array<{ key: string; nx?: boolean; ex?: number }>;
  rawValues: string[];
} {
  const store: Store = new Map();
  const incrCalls: string[] = [];
  const setNxCalls: Array<{ key: string; nx?: boolean; ex?: number }> = [];
  const rawValues: string[] = [];

  const kv: WebAnalyticsKv = {
    async get<T>(key: string) {
      const e = store.get(key);
      return (e ? (e.value as T) : null) ?? null;
    },
    async mget<T>(...keys: string[]) {
      return keys.map((k) => {
        const e = store.get(k);
        return (e ? (e.value as T) : null) ?? null;
      });
    },
    async incr(key: string) {
      incrCalls.push(key);
      const cur = Number(store.get(key)?.value ?? 0);
      const next = cur + 1;
      store.set(key, { value: next, ex: store.get(key)?.ex });
      return next;
    },
    async expire(key: string, seconds: number) {
      const e = store.get(key);
      if (!e) return 0;
      store.set(key, { ...e, ex: seconds });
      return 1;
    },
    async set(key, value, opts) {
      setNxCalls.push({ key, nx: opts?.nx, ex: opts?.ex });
      if (typeof value === "string") rawValues.push(value);
      if (opts?.nx && store.has(key)) return null;
      store.set(key, { value, ex: opts?.ex });
      return "OK";
    },
    async zincrby(key, increment, member) {
      const e = store.get(key);
      const map =
        (e?.value as Map<string, number> | undefined) ?? new Map<string, number>();
      map.set(member, (map.get(member) ?? 0) + increment);
      store.set(key, { value: map, ex: e?.ex });
      return map.get(member)!;
    },
    async zrange(key, start, end, opts) {
      const map =
        (store.get(key)?.value as Map<string, number> | undefined) ??
        new Map<string, number>();
      const sorted = [...map.entries()].sort((a, b) =>
        opts?.rev ? b[1] - a[1] : a[1] - b[1],
      );
      const slice = sorted.slice(start, end + 1);
      if (opts?.withScores) return slice;
      return slice.map(([m]) => m);
    },
  };

  return { kv, store, incrCalls, setNxCalls, rawValues };
}

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

const baseVisit = {
  pathname: "/scan",
  visitorId: "11111111-1111-4111-8111-111111111111",
  sessionId: "22222222-2222-4222-8222-222222222222",
  userAgent: "Mozilla/5.0 (compatible; HansomeTest/1.0)",
  host: "www.hansomealpacas.xyz",
  now: NOW,
  ipSalt: SALT,
  vercel: true,
};

describe("website-analytics", () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    process.env.ANALYTICS_IP_SALT = SALT;
    process.env.ANALYTICS_ADMIN_SECRET = "admin-test-secret";
    delete process.env.ANALYTICS_DISABLED;
    delete process.env.ANALYTICS_FORCE_PREVIEW;
    delete process.env.ANALYTICS_TRUST_PROXY;
  });

  afterEach(() => {
    process.env = { ...prevEnv };
  });

  it("1. duplicate IP dedupe — same IP counted once per day", async () => {
    const { kv, store } = createMemoryKv();
    const h = headers({
      "x-real-ip": "203.0.113.10",
      "user-agent": baseVisit.userAgent,
    });

    await recordPageView({
      ...baseVisit,
      visitorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      headers: h,
      kvClient: kv,
    });
    await recordPageView({
      ...baseVisit,
      visitorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      sessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      headers: h,
      kvClient: kv,
    });

    expect(Number(store.get(WEB_ANALYTICS_KEYS.dayUip(DAY))?.value)).toBe(1);
    expect(Number(store.get(WEB_ANALYTICS_KEYS.dayUv(DAY))?.value)).toBe(2);
  });

  it("2. duplicate visitor dedupe — same visitor UV once per day", async () => {
    const { kv, store } = createMemoryKv();
    const h = headers({ "x-real-ip": "203.0.113.20" });

    await recordPageView({ ...baseVisit, headers: h, kvClient: kv });
    // Different path after debounce window key differs — UV still once
    await recordPageView({
      ...baseVisit,
      pathname: "/",
      headers: h,
      kvClient: kv,
    });

    expect(Number(store.get(WEB_ANALYTICS_KEYS.dayUv(DAY))?.value)).toBe(1);
    expect(Number(store.get(WEB_ANALYTICS_KEYS.dayPv(DAY))?.value)).toBe(2);
  });

  it("3. shared IP multiple visitors — UV=2, UIP=1", async () => {
    const { kv, store } = createMemoryKv();
    const h = headers({ "x-real-ip": "198.51.100.5" });
    await recordPageView({
      ...baseVisit,
      visitorId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      sessionId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
      headers: h,
      kvClient: kv,
    });
    await recordPageView({
      ...baseVisit,
      visitorId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      sessionId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
      headers: h,
      kvClient: kv,
    });
    expect(Number(store.get(WEB_ANALYTICS_KEYS.dayUv(DAY))?.value)).toBe(2);
    expect(Number(store.get(WEB_ANALYTICS_KEYS.dayUip(DAY))?.value)).toBe(1);
  });

  it("4. same visitor across IP changes — UV=1, UIP=2", async () => {
    const { kv, store } = createMemoryKv();
    await recordPageView({
      ...baseVisit,
      headers: headers({ "x-real-ip": "203.0.113.1" }),
      kvClient: kv,
    });
    await recordPageView({
      ...baseVisit,
      pathname: "/litepaper",
      headers: headers({ "x-real-ip": "203.0.113.2" }),
      kvClient: kv,
    });
    expect(Number(store.get(WEB_ANALYTICS_KEYS.dayUv(DAY))?.value)).toBe(1);
    expect(Number(store.get(WEB_ANALYTICS_KEYS.dayUip(DAY))?.value)).toBe(2);
  });

  it("5. IPv6 normalization is stable", () => {
    const a = normalizeIp("2001:db8::1");
    const b = normalizeIp("2001:0db8:0000:0000:0000:0000:0000:0001");
    expect(a).toBe(b);
    expect(a).toBe("2001:0db8:0000:0000:0000:0000:0000:0001");
    expect(normalizeIp("::ffff:192.0.2.10")).toBe("192.0.2.10");
    const h1 = hashIp(a!, SALT);
    const h2 = hashIp(b!, SALT);
    expect(h1).toBe(h2);
  });

  it("6. trusted proxy extraction on Vercel", () => {
    const ip = extractTrustedClientIp(
      headers({
        "x-real-ip": "203.0.113.50",
        "x-forwarded-for": "198.51.100.1, 10.0.0.1",
      }),
      { vercel: true },
    );
    expect(ip).toBe("203.0.113.50");

    const fromVercelFwd = extractTrustedClientIp(
      headers({ "x-vercel-forwarded-for": "203.0.113.60, 10.0.0.2" }),
      { vercel: true },
    );
    expect(fromVercelFwd).toBe("203.0.113.60");
  });

  it("7. spoofed forwarded header ignored off Vercel", () => {
    const spoofed = extractTrustedClientIp(
      headers({ "x-forwarded-for": "8.8.8.8" }),
      { vercel: false, trustProxy: false },
    );
    expect(spoofed).toBeNull();
  });

  it("8. bot exclusion + bot counter", async () => {
    expect(isBotUserAgent("Googlebot/2.1")).toBe(true);
    expect(isBotUserAgent("hansome-analytics-smoke")).toBe(true);
    const { kv, store } = createMemoryKv();
    const r = await recordPageView({
      ...baseVisit,
      userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)",
      headers: headers({ "x-real-ip": "203.0.113.9" }),
      kvClient: kv,
    });
    expect(r.excluded).toBe("bot");
    expect(r.counted).toBe(false);
    expect(Number(store.get(WEB_ANALYTICS_KEYS.dayPv(DAY))?.value ?? 0)).toBe(0);
    expect(Number(store.get(WEB_ANALYTICS_KEYS.dayBots(DAY))?.value)).toBe(1);
  });

  it("9. preview exclusion", () => {
    expect(
      isPreviewDeployment(
        { NODE_ENV: "production", VERCEL_ENV: "preview" } as NodeJS.ProcessEnv,
      ),
    ).toBe(true);
    expect(
      isPreviewDeployment(
        { NODE_ENV: "production" } as NodeJS.ProcessEnv,
        "foo-bar.vercel.app",
      ),
    ).toBe(true);
    expect(
      classifyExclusion({
        userAgent: baseVisit.userAgent,
        host: "hansome-git-abc.vercel.app",
        pathname: "/",
      }),
    ).toBe("preview");
  });

  it("10. debounce behavior — rapid refresh skips PV", async () => {
    const { kv, store, setNxCalls } = createMemoryKv();
    const h = headers({ "x-real-ip": "203.0.113.77" });
    const r1 = await recordPageView({ ...baseVisit, headers: h, kvClient: kv });
    const r2 = await recordPageView({ ...baseVisit, headers: h, kvClient: kv });
    expect(r1.pageViewsIncr).toBe(true);
    expect(r2.debounced).toBe(true);
    expect(r2.pageViewsIncr).toBe(false);
    expect(Number(store.get(WEB_ANALYTICS_KEYS.dayPv(DAY))?.value)).toBe(1);
    expect(Number(store.get(WEB_ANALYTICS_KEYS.dayUv(DAY))?.value)).toBe(1);
    const debounceSets = setNxCalls.filter((c) =>
      c.key.includes(":debounce:"),
    );
    expect(debounceSets[0]?.ex).toBe(DEBOUNCE_TTL_SEC);
  });

  it("11. race-safe atomic increments — SET NX wins once", async () => {
    const { kv, store } = createMemoryKv();
    const visitorHash = hashOpaqueId(baseVisit.visitorId, SALT);
    const key = WEB_ANALYTICS_KEYS.uvDedupe(DAY, visitorHash);

    const parallel = await Promise.all([
      recordPageView({
        ...baseVisit,
        pathname: "/a",
        headers: headers({ "x-real-ip": "203.0.113.1" }),
        kvClient: kv,
      }),
      recordPageView({
        ...baseVisit,
        pathname: "/b",
        headers: headers({ "x-real-ip": "203.0.113.1" }),
        kvClient: kv,
      }),
    ]);
    expect(parallel.every((r) => r.ok)).toBe(true);
    expect(store.has(key)).toBe(true);
    expect(Number(store.get(WEB_ANALYTICS_KEYS.dayUv(DAY))?.value)).toBe(1);
    expect(store.get(key)?.ex).toBe(DAILY_DEDUPE_TTL_SEC);
  });

  it("12. analytics outage fallback — KV null does not throw", async () => {
    const r = await recordPageView({
      ...baseVisit,
      headers: headers({ "x-real-ip": "203.0.113.1" }),
      kvClient: null,
    });
    expect(r.ok).toBe(true);
    expect(r.counted).toBe(false);
  });

  it("13. no raw IP stored in KV values or keys", async () => {
    const { kv, store, rawValues } = createMemoryKv();
    const rawIp = "203.0.113.222";
    await recordPageView({
      ...baseVisit,
      headers: headers({ "x-real-ip": rawIp }),
      kvClient: kv,
    });
    const allKeys = [...store.keys()].join("\n");
    expect(allKeys).not.toContain(rawIp);
    expect(rawValues.join("\n")).not.toContain(rawIp);
    for (const [, entry] of store) {
      const serialized = JSON.stringify(entry.value);
      expect(serialized).not.toContain(rawIp);
    }
    const ipHash = hashIp(normalizeIp(rawIp)!, SALT)!;
    expect(allKeys).toContain(ipHash.slice(0, 16));
  });

  it("14. dashboard authorization", () => {
    const secret = "admin-test-secret";
    expect(secretsEqual(secret, secret)).toBe(true);
    expect(secretsEqual("nope", secret)).toBe(false);

    const token = mintAdminCookieValue(secret)!;
    expect(verifyAdminCookieValue(token, secret)).toBe(true);
    expect(verifyAdminCookieValue("v1.1.deadbeef", secret)).toBe(false);

    const okReq = new Request("https://example.com/api/analytics/stats", {
      headers: {
        cookie: `${ADMIN_COOKIE}=${encodeURIComponent(token)}`,
      },
    });
    expect(isAuthorizedAdmin(okReq)).toBe(true);

    const bearer = new Request("https://example.com/api/analytics/stats", {
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(isAuthorizedAdmin(bearer)).toBe(true);

    const bad = new Request("https://example.com/api/analytics/stats");
    expect(isAuthorizedAdmin(bad)).toBe(false);
  });

  it("15. retention TTL on dedupe keys", async () => {
    const { kv, store } = createMemoryKv();
    await recordPageView({
      ...baseVisit,
      headers: headers({ "x-real-ip": "2001:db8::abcd" }),
      kvClient: kv,
    });
    const visitorHash = hashOpaqueId(baseVisit.visitorId, SALT);
    const ipHash = hashIp(normalizeIp("2001:db8::abcd")!, SALT)!;

    expect(store.get(WEB_ANALYTICS_KEYS.uvDedupe(DAY, visitorHash))?.ex).toBe(
      DAILY_DEDUPE_TTL_SEC,
    );
    expect(store.get(WEB_ANALYTICS_KEYS.uipDedupe(DAY, ipHash))?.ex).toBe(
      DAILY_DEDUPE_TTL_SEC,
    );
    expect(store.get(WEB_ANALYTICS_KEYS.uipDedupeAll(ipHash))?.ex).toBe(
      ALLTIME_IP_DEDUPE_TTL_SEC,
    );
    expect(VISITOR_COOKIE_MAX_AGE_SEC).toBe(90 * 24 * 60 * 60);
  });

  it("extra: pathname filters exclude api/assets", () => {
    expect(normalizePathname("/api/scan")).toBeNull();
    expect(normalizePathname("/_next/static/chunk.js")).toBeNull();
    expect(normalizePathname("/logo.png")).toBeNull();
    expect(normalizePathname("/scan")).toBe("/scan");
    expect(normalizePathname("/scan/")).toBe("/scan");
  });

  it("extra: localhost excluded", () => {
    expect(
      classifyExclusion({
        userAgent: baseVisit.userAgent,
        host: "localhost:3000",
        pathname: "/",
      }),
    ).toBe("localhost");
  });
});
