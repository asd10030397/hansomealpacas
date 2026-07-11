export const TOTAL_SUPPLY = 1_000_000_000;

export const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
export const SNAPSHOT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const MARKET_REFRESH_MS = 30 * 1000;

export const TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT ?? "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875";

/**
 * HANSOME/ETH Uniswap v4 pool on Robinhood Chain via GeckoTerminal.
 * Official pool created on-chain (Fee 0.05%, tick spacing 10). GeckoTerminal
 * may take some time to index a newly created pool — until then
 * fetchGeckoTerminalPoolStats() will throw and the UI falls back to
 * loading/unavailable copy (see MarketStatsSection + useMarketStats).
 */
export const GECKO_TERMINAL_POOL_ID = "0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d";

export const GECKO_TERMINAL_POOL_API = `https://api.geckoterminal.com/api/v2/networks/robinhood/pools/${GECKO_TERMINAL_POOL_ID}?include=quote_token,base_token`;

export const GECKO_TERMINAL_TOKEN_POOLS_API = `https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/${TOKEN_ADDRESS}/pools`;

export const CHANGE_WINDOWS = {
  h1: 60 * 60 * 1000,
  h24: 24 * 60 * 60 * 1000,
  d7: 7 * 24 * 60 * 60 * 1000,
} as const;
