/**
 * Record a pageview with UV / UIP / session dedupe.
 * Never throws to callers; never stores raw IP.
 */

import {
  ALLTIME_IP_DEDUPE_TTL_SEC,
  ALLTIME_VISITOR_DEDUPE_TTL_SEC,
  DAILY_AGGREGATE_TTL_SEC,
  DAILY_DEDUPE_TTL_SEC,
  DEBOUNCE_TTL_SEC,
  WEB_ANALYTICS_SCHEMA_VERSION,
} from "@/lib/website-analytics/constants";
import { classifyExclusion, normalizePathname, normalizeReferrer } from "@/lib/website-analytics/filter";
import {
  extractTrustedClientIp,
  extractTrustedCountry,
  hashIp,
  hashOpaqueId,
} from "@/lib/website-analytics/ip";
import { WEB_ANALYTICS_KEYS, utcDayBucket } from "@/lib/website-analytics/keys";
import {
  getWebAnalyticsKv,
  incrWithTtl,
  setNxEx,
  type WebAnalyticsKv,
} from "@/lib/website-analytics/kv";

export type VisitInput = {
  pathname: string;
  visitorId: string;
  sessionId: string;
  referrer?: string | null;
  userAgent?: string | null;
  host?: string | null;
  optOut?: boolean;
  headers?: Headers;
  now?: Date;
  /** Injected for tests */
  kvClient?: WebAnalyticsKv | null;
  vercel?: boolean;
  trustProxy?: boolean;
  ipSalt?: string | null;
};

export type VisitResult = {
  ok: boolean;
  counted: boolean;
  excluded?: string;
  debounced?: boolean;
  pageViewsIncr?: boolean;
  uniqueVisitorDay?: boolean;
  uniqueIpDay?: boolean;
  uniqueSessionDay?: boolean;
};

function safeWarn(message: string): void {
  // Never log raw IPs, salts, visitor IDs, or full headers.
  console.warn(`[website-analytics] ${message}`);
}

async function bumpUnique(
  kv: WebAnalyticsKv,
  dedupeKey: string,
  counterKey: string,
  dedupeTtl: number,
  counterTtl: number | null,
): Promise<boolean> {
  const first = await setNxEx(kv, dedupeKey, dedupeTtl);
  if (!first) return false;
  if (counterTtl != null) {
    await incrWithTtl(kv, counterKey, counterTtl);
  } else {
    await kv.incr(counterKey);
  }
  return true;
}

/**
 * Persist one visit observation. Never throws.
 */
export async function recordPageView(input: VisitInput): Promise<VisitResult> {
  try {
    const exclusion = classifyExclusion({
      userAgent: input.userAgent,
      host: input.host,
      pathname: input.pathname,
      optOut: input.optOut,
    });

    const date = utcDayBucket(input.now ?? new Date());
    const kv =
      input.kvClient === undefined ? await getWebAnalyticsKv() : input.kvClient;

    if (exclusion === "bot") {
      // Record bot-excluded count separately for debugging (no PII).
      if (kv) {
        try {
          await Promise.all([
            incrWithTtl(kv, WEB_ANALYTICS_KEYS.dayBots(date), DAILY_AGGREGATE_TTL_SEC),
            kv.incr(WEB_ANALYTICS_KEYS.allBots()),
          ]);
        } catch {
          /* ignore */
        }
      }
      return { ok: true, counted: false, excluded: "bot" };
    }

    if (exclusion) {
      return { ok: true, counted: false, excluded: exclusion };
    }

    const pathname = normalizePathname(input.pathname);
    if (!pathname) {
      return { ok: true, counted: false, excluded: "asset" };
    }

    if (!input.visitorId?.trim() || !input.sessionId?.trim()) {
      return { ok: true, counted: false, excluded: "empty_path" };
    }

    if (!kv) {
      return { ok: true, counted: false, excluded: "disabled" };
    }

    const salt = input.ipSalt === undefined ? undefined : input.ipSalt;
    const visitorHash = hashOpaqueId(input.visitorId.trim(), salt ?? undefined);
    const sessionHash = hashOpaqueId(input.sessionId.trim(), salt ?? undefined);

    // Debounce repeated refreshes (same visitor + pathname).
    const debounced = !(await setNxEx(
      kv,
      WEB_ANALYTICS_KEYS.debounce(date, visitorHash, pathname),
      DEBOUNCE_TTL_SEC,
    ));
    if (debounced) {
      // Still allow UV/UIP day markers if somehow missing, but skip PV.
      // Spec: PV may debounce; UV/UIP once per period — ensure markers exist.
      await Promise.all([
        bumpUnique(
          kv,
          WEB_ANALYTICS_KEYS.uvDedupe(date, visitorHash),
          WEB_ANALYTICS_KEYS.dayUv(date),
          DAILY_DEDUPE_TTL_SEC,
          DAILY_AGGREGATE_TTL_SEC,
        ),
        bumpUnique(
          kv,
          WEB_ANALYTICS_KEYS.uvDedupeAll(visitorHash),
          WEB_ANALYTICS_KEYS.allUv(),
          ALLTIME_VISITOR_DEDUPE_TTL_SEC,
          null,
        ),
        bumpUnique(
          kv,
          WEB_ANALYTICS_KEYS.sessionDedupe(date, sessionHash),
          WEB_ANALYTICS_KEYS.daySessions(date),
          DAILY_DEDUPE_TTL_SEC,
          DAILY_AGGREGATE_TTL_SEC,
        ),
      ]);
      return {
        ok: true,
        counted: true,
        debounced: true,
        pageViewsIncr: false,
      };
    }

    let ipHash: string | null = null;
    if (input.headers) {
      const ip = extractTrustedClientIp(input.headers, {
        vercel: input.vercel,
        trustProxy: input.trustProxy,
      });
      if (ip) {
        ipHash = hashIp(ip, salt ?? undefined);
        // Defense: never persist `ip` variable beyond this block.
      }
    }

    const uniqueVisitorDay = await bumpUnique(
      kv,
      WEB_ANALYTICS_KEYS.uvDedupe(date, visitorHash),
      WEB_ANALYTICS_KEYS.dayUv(date),
      DAILY_DEDUPE_TTL_SEC,
      DAILY_AGGREGATE_TTL_SEC,
    );
    await bumpUnique(
      kv,
      WEB_ANALYTICS_KEYS.uvDedupeAll(visitorHash),
      WEB_ANALYTICS_KEYS.allUv(),
      ALLTIME_VISITOR_DEDUPE_TTL_SEC,
      null,
    );

    let uniqueIpDay = false;
    if (ipHash) {
      uniqueIpDay = await bumpUnique(
        kv,
        WEB_ANALYTICS_KEYS.uipDedupe(date, ipHash),
        WEB_ANALYTICS_KEYS.dayUip(date),
        DAILY_DEDUPE_TTL_SEC,
        DAILY_AGGREGATE_TTL_SEC,
      );
      await bumpUnique(
        kv,
        WEB_ANALYTICS_KEYS.uipDedupeAll(ipHash),
        WEB_ANALYTICS_KEYS.allUip(),
        ALLTIME_IP_DEDUPE_TTL_SEC,
        null,
      );
      await bumpUnique(
        kv,
        WEB_ANALYTICS_KEYS.pageUipDedupe(date, pathname, ipHash),
        WEB_ANALYTICS_KEYS.pageUip(date, pathname),
        DAILY_DEDUPE_TTL_SEC,
        DAILY_AGGREGATE_TTL_SEC,
      );
    }

    const uniqueSessionDay = await bumpUnique(
      kv,
      WEB_ANALYTICS_KEYS.sessionDedupe(date, sessionHash),
      WEB_ANALYTICS_KEYS.daySessions(date),
      DAILY_DEDUPE_TTL_SEC,
      DAILY_AGGREGATE_TTL_SEC,
    );
    await bumpUnique(
      kv,
      WEB_ANALYTICS_KEYS.sessionDedupeAll(sessionHash),
      WEB_ANALYTICS_KEYS.allSessions(),
      ALLTIME_VISITOR_DEDUPE_TTL_SEC,
      null,
    );

    await bumpUnique(
      kv,
      WEB_ANALYTICS_KEYS.pageUvDedupe(date, pathname, visitorHash),
      WEB_ANALYTICS_KEYS.pageUv(date, pathname),
      DAILY_DEDUPE_TTL_SEC,
      DAILY_AGGREGATE_TTL_SEC,
    );

    await Promise.all([
      incrWithTtl(kv, WEB_ANALYTICS_KEYS.dayPv(date), DAILY_AGGREGATE_TTL_SEC),
      kv.incr(WEB_ANALYTICS_KEYS.allPv()),
      incrWithTtl(
        kv,
        WEB_ANALYTICS_KEYS.pagePv(date, pathname),
        DAILY_AGGREGATE_TTL_SEC,
      ),
      kv.zincrby(WEB_ANALYTICS_KEYS.dayPages(date), 1, pathname).then(() =>
        kv.expire(WEB_ANALYTICS_KEYS.dayPages(date), DAILY_AGGREGATE_TTL_SEC),
      ),
    ]);

    const ref = normalizeReferrer(input.referrer);
    if (ref) {
      await kv.zincrby(WEB_ANALYTICS_KEYS.dayRefs(date), 1, ref);
      await kv.expire(WEB_ANALYTICS_KEYS.dayRefs(date), DAILY_AGGREGATE_TTL_SEC);
    }

    if (input.headers) {
      const country = extractTrustedCountry(input.headers);
      if (country) {
        await kv.zincrby(WEB_ANALYTICS_KEYS.dayCountries(date), 1, country);
        await kv.expire(
          WEB_ANALYTICS_KEYS.dayCountries(date),
          DAILY_AGGREGATE_TTL_SEC,
        );
      }
    }

    await kv.set(WEB_ANALYTICS_KEYS.meta(), {
      schemaVersion: WEB_ANALYTICS_SCHEMA_VERSION,
      updatedAt: (input.now ?? new Date()).toISOString(),
    });

    return {
      ok: true,
      counted: true,
      debounced: false,
      pageViewsIncr: true,
      uniqueVisitorDay,
      uniqueIpDay,
      uniqueSessionDay,
    };
  } catch (err) {
    safeWarn(`record failed: ${err instanceof Error ? err.name : "error"}`);
    return { ok: false, counted: false };
  }
}

/** Fire-and-forget — never throws. */
export function schedulePageView(input: VisitInput): void {
  try {
    void recordPageView(input).catch(() => {
      safeWarn("schedule failed");
    });
  } catch {
    safeWarn("schedule sync failed");
  }
}
