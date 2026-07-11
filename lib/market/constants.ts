export const TOTAL_SUPPLY = 1_000_000_000;

export const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
export const SNAPSHOT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const MARKET_REFRESH_MS = 30 * 1000;

export const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT ?? "";

/**
 * HANSOME/ETH Uniswap v4 pool on Robinhood Chain via GeckoTerminal.
 * Not created yet — set once liquidity is live.
 */
export const GECKO_TERMINAL_POOL_ID = "";

export const GECKO_TERMINAL_POOL_API = `https://api.geckoterminal.com/api/v2/networks/robinhood/pools/${GECKO_TERMINAL_POOL_ID}?include=quote_token,base_token`;

export const GECKO_TERMINAL_TOKEN_POOLS_API = `https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/${TOKEN_ADDRESS}/pools`;

export const CHANGE_WINDOWS = {
  h1: 60 * 60 * 1000,
  h24: 24 * 60 * 60 * 1000,
  d7: 7 * 24 * 60 * 60 * 1000,
} as const;
