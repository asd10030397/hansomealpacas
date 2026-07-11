let cachedEthUsd: { value: number; fetchedAt: number } | null = null;
const ETH_USD_CACHE_MS = 60_000;

export async function fetchEthUsd(): Promise<number> {
  const fallback = Number(process.env.NEXT_PUBLIC_ETH_USD ?? "");
  const now = Date.now();

  if (cachedEthUsd && now - cachedEthUsd.fetchedAt < ETH_USD_CACHE_MS) {
    return cachedEthUsd.value;
  }

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { cache: "no-store" },
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
