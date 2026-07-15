/**
 * Mirrors lib/market/eth-usd.ts from the website (same CoinGecko endpoint,
 * same cache/fallback strategy). Copied — not imported — for the same
 * build-isolation reason documented in shared/format.ts. The only change
 * is the fallback env var name (ETH_USD_FALLBACK instead of
 * NEXT_PUBLIC_ETH_USD) to match this service's own .env convention.
 */

let cachedEthUsd: { value: number; fetchedAt: number } | null = null;
const ETH_USD_CACHE_MS = 60_000;

export async function fetchEthUsd(): Promise<number> {
  const fallback = Number(process.env.ETH_USD_FALLBACK ?? "");
  const now = Date.now();

  if (cachedEthUsd && now - cachedEthUsd.fetchedAt < ETH_USD_CACHE_MS) {
    return cachedEthUsd.value;
  }

  try {
    // Node's built-in fetch (undici) has no request-level cache layer like
    // Next.js's extended fetch does, so there's no `cache: "no-store"`
    // option to pass here — the in-memory cache above is this module's
    // own, separate caching.
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    );

    if (!response.ok) {
      throw new Error(`CoinGecko ${response.status}`);
    }

    const data = (await response.json()) as { ethereum?: { usd?: number } };
    const value = data.ethereum?.usd;

    if (typeof value === "number" && value > 0) {
      cachedEthUsd = { value, fetchedAt: now };
      return value;
    }
  } catch {
    // fall through to cache or env fallback
  }

  if (cachedEthUsd) return cachedEthUsd.value;
  if (Number.isFinite(fallback) && fallback > 0) return fallback;

  return 3000;
}
