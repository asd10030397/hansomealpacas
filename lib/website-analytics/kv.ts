export type WebAnalyticsKv = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  get<T = unknown>(key: string): Promise<T | null>;
  mget<T = unknown>(...keys: string[]): Promise<Array<T | null>>;
  set(
    key: string,
    value: unknown,
    opts?: { ex?: number; nx?: boolean },
  ): Promise<"OK" | null>;
  zincrby(key: string, increment: number, member: string): Promise<number>;
  zrange(
    key: string,
    start: number,
    end: number,
    opts?: { rev?: boolean; withScores?: boolean },
  ): Promise<string[] | Array<[string, number]> | unknown>;
};

export function isWebAnalyticsKvConfigured(): boolean {
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

export async function getWebAnalyticsKv(): Promise<WebAnalyticsKv | null> {
  if (!isWebAnalyticsKvConfigured()) return null;
  const { kv } = await import("@vercel/kv");
  return kv as unknown as WebAnalyticsKv;
}

/**
 * Race-safe unique marker: SET NX + EX.
 * Returns true when this call won the race (first observation).
 */
export async function setNxEx(
  kv: WebAnalyticsKv,
  key: string,
  ttlSec: number,
): Promise<boolean> {
  const result = await kv.set(key, "1", { nx: true, ex: ttlSec });
  return result === "OK";
}

export async function incrWithTtl(
  kv: WebAnalyticsKv,
  key: string,
  ttlSec: number,
): Promise<number> {
  const n = await kv.incr(key);
  await kv.expire(key, ttlSec);
  return n;
}
