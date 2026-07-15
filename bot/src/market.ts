import { config } from "./config";
import { createLogger } from "./logger";

const logger = createLogger("market");

export type MarketContext = {
  liquidityUsd: number | null;
  volume24hUsd: number | null;
};

type GeckoPoolResponse = {
  data?: {
    attributes?: {
      reserve_in_usd?: string;
      volume_usd?: { h24?: string };
    };
  };
};

let cached: { value: MarketContext; at: number } | null = null;

function parseNum(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lightweight GeckoTerminal lookup for liquidity/24h volume context shown
 * in notifications and /status /liquidity — inspired by the website's
 * lib/market/geckoterminal.ts (same endpoint, same idea of caching +
 * graceful stale-data fallback), reimplemented natively here rather than
 * imported because that file resolves its imports through the website's
 * `@/` tsconfig path alias, which this standalone service does not (and
 * should not) depend on. Buy/sell detection never depends on this — it's
 * purely supplementary context and degrades to `null` on failure.
 */
export async function fetchMarketContext(): Promise<MarketContext> {
  const now = Date.now();
  if (cached && now - cached.at < config.market.cacheTtlMs) {
    return cached.value;
  }

  try {
    const response = await fetch(config.market.geckoTerminalPoolApi, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      throw new Error(`GeckoTerminal HTTP ${response.status}`);
    }

    const json = (await response.json()) as GeckoPoolResponse;
    const attrs = json.data?.attributes;

    const value: MarketContext = {
      liquidityUsd: parseNum(attrs?.reserve_in_usd),
      volume24hUsd: parseNum(attrs?.volume_usd?.h24),
    };

    cached = { value, at: now };
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    logger.warn(`GeckoTerminal fetch failed (${message}) — liquidity/volume will show as unavailable`);
    return cached?.value ?? { liquidityUsd: null, volume24hUsd: null };
  }
}
