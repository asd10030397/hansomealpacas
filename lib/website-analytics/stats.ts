import { dayBucketsForLastN, utcDayBucket, WEB_ANALYTICS_KEYS } from "@/lib/website-analytics/keys";
import { getWebAnalyticsKv, type WebAnalyticsKv } from "@/lib/website-analytics/kv";

export type WindowTotals = {
  pageViews: number;
  uniqueVisitors: number;
  uniqueIps: number;
  uniqueSessions: number;
  botsExcluded: number;
};

export type TopEntry = { name: string; pageViews: number };

export type PageStats = {
  pathname: string;
  pageViews: number;
  uniqueVisitors: number;
  uniqueIps: number;
};

export type AnalyticsDashboardStats = {
  schemaVersion: number;
  freshAsOf: string | null;
  generatedAt: string;
  today: WindowTotals;
  last7d: WindowTotals;
  last30d: WindowTotals;
  allTime: WindowTotals;
  topPages: PageStats[];
  topReferrers: TopEntry[];
  countries: TopEntry[];
};

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return 0;
}

async function sumKeys(kv: WebAnalyticsKv, keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  const values = await kv.mget<string | number>(...keys);
  return values.reduce<number>((acc, v) => acc + num(v), 0);
}

async function windowTotals(
  kv: WebAnalyticsKv,
  days: string[],
): Promise<WindowTotals> {
  const [pageViews, uniqueVisitors, uniqueIps, uniqueSessions, botsExcluded] =
    await Promise.all([
      sumKeys(
        kv,
        days.map((d) => WEB_ANALYTICS_KEYS.dayPv(d)),
      ),
      sumKeys(
        kv,
        days.map((d) => WEB_ANALYTICS_KEYS.dayUv(d)),
      ),
      sumKeys(
        kv,
        days.map((d) => WEB_ANALYTICS_KEYS.dayUip(d)),
      ),
      sumKeys(
        kv,
        days.map((d) => WEB_ANALYTICS_KEYS.daySessions(d)),
      ),
      sumKeys(
        kv,
        days.map((d) => WEB_ANALYTICS_KEYS.dayBots(d)),
      ),
    ]);
  return {
    pageViews,
    uniqueVisitors,
    uniqueIps,
    uniqueSessions,
    botsExcluded,
  };
}

async function readZTop(
  kv: WebAnalyticsKv,
  key: string,
  limit: number,
): Promise<TopEntry[]> {
  try {
    const rows = (await kv.zrange(key, 0, limit - 1, {
      rev: true,
      withScores: true,
    })) as unknown;

    // @vercel/kv may return flat [member, score, ...] or [[member, score], ...]
    if (!Array.isArray(rows) || rows.length === 0) return [];

    if (Array.isArray(rows[0])) {
      return (rows as Array<[string, number]>).map(([name, score]) => ({
        name: String(name),
        pageViews: num(score),
      }));
    }

    const out: TopEntry[] = [];
    for (let i = 0; i < rows.length; i += 2) {
      out.push({
        name: String(rows[i]),
        pageViews: num(rows[i + 1]),
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function mergeTopAcrossDays(
  kv: WebAnalyticsKv,
  days: string[],
  keyFn: (day: string) => string,
  limit: number,
): Promise<TopEntry[]> {
  const map = new Map<string, number>();
  for (const day of days) {
    const rows = await readZTop(kv, keyFn(day), 50);
    for (const row of rows) {
      map.set(row.name, (map.get(row.name) ?? 0) + row.pageViews);
    }
  }
  return [...map.entries()]
    .map(([name, pageViews]) => ({ name, pageViews }))
    .sort((a, b) => b.pageViews - a.pageViews)
    .slice(0, limit);
}

async function enrichPages(
  kv: WebAnalyticsKv,
  day: string,
  tops: TopEntry[],
): Promise<PageStats[]> {
  const result: PageStats[] = [];
  for (const t of tops) {
    const [uv, uip] = await kv.mget<string | number>(
      WEB_ANALYTICS_KEYS.pageUv(day, t.name),
      WEB_ANALYTICS_KEYS.pageUip(day, t.name),
    );
    result.push({
      pathname: t.name,
      pageViews: t.pageViews,
      uniqueVisitors: num(uv),
      uniqueIps: num(uip),
    });
  }
  return result;
}

export async function getDashboardStats(options?: {
  kvClient?: WebAnalyticsKv | null;
  now?: Date;
  topLimit?: number;
}): Promise<AnalyticsDashboardStats | null> {
  const kv =
    options?.kvClient === undefined
      ? await getWebAnalyticsKv()
      : options.kvClient;
  if (!kv) return null;

  const now = options?.now ?? new Date();
  const limit = options?.topLimit ?? 15;
  const today = utcDayBucket(now);
  const last7 = dayBucketsForLastN(7, now);
  const last30 = dayBucketsForLastN(30, now);

  const meta = await kv.get<{ schemaVersion?: number; updatedAt?: string }>(
    WEB_ANALYTICS_KEYS.meta(),
  );

  const [todayT, last7d, last30d, allPv, allUv, allUip, allSessions, allBots] =
    await Promise.all([
      windowTotals(kv, [today]),
      windowTotals(kv, last7),
      windowTotals(kv, last30),
      kv.get<string | number>(WEB_ANALYTICS_KEYS.allPv()),
      kv.get<string | number>(WEB_ANALYTICS_KEYS.allUv()),
      kv.get<string | number>(WEB_ANALYTICS_KEYS.allUip()),
      kv.get<string | number>(WEB_ANALYTICS_KEYS.allSessions()),
      kv.get<string | number>(WEB_ANALYTICS_KEYS.allBots()),
    ]);

  const topPageEntries = await mergeTopAcrossDays(
    kv,
    last7,
    WEB_ANALYTICS_KEYS.dayPages,
    limit,
  );

  // Enrich UV/UIP from today's page keys when available; else sum approx from today only.
  const topPages = await enrichPages(kv, today, topPageEntries);

  // For pages not seen today, fill UV/UIP from 7d merge of page counters approximately via today zeros.
  for (let i = 0; i < topPages.length; i++) {
    if (topPages[i]!.uniqueVisitors === 0 && topPages[i]!.pageViews > 0) {
      // Sum page UV across last 7 days (daily uniques — overestimate if summed; label as period sum).
      let uvSum = 0;
      let uipSum = 0;
      let pvSum = 0;
      for (const d of last7) {
        const [pv, uv, uip] = await kv.mget<string | number>(
          WEB_ANALYTICS_KEYS.pagePv(d, topPages[i]!.pathname),
          WEB_ANALYTICS_KEYS.pageUv(d, topPages[i]!.pathname),
          WEB_ANALYTICS_KEYS.pageUip(d, topPages[i]!.pathname),
        );
        pvSum += num(pv);
        uvSum += num(uv);
        uipSum += num(uip);
      }
      topPages[i] = {
        pathname: topPages[i]!.pathname,
        pageViews: pvSum || topPages[i]!.pageViews,
        uniqueVisitors: uvSum,
        uniqueIps: uipSum,
      };
    }
  }

  const [topReferrers, countries] = await Promise.all([
    mergeTopAcrossDays(kv, last7, WEB_ANALYTICS_KEYS.dayRefs, limit),
    mergeTopAcrossDays(kv, last7, WEB_ANALYTICS_KEYS.dayCountries, limit),
  ]);

  return {
    schemaVersion: meta?.schemaVersion ?? 1,
    freshAsOf: meta?.updatedAt ?? null,
    generatedAt: now.toISOString(),
    today: todayT,
    last7d,
    last30d,
    allTime: {
      pageViews: num(allPv),
      uniqueVisitors: num(allUv),
      uniqueIps: num(allUip),
      uniqueSessions: num(allSessions),
      botsExcluded: num(allBots),
    },
    topPages,
    topReferrers,
    countries,
  };
}
