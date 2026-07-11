export const UGLY_TOTAL_SUPPLY = 1_000_000_000;

export const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
export const SNAPSHOT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const MARKET_REFRESH_MS = 30 * 1000;

export const UGLY_TOKEN_ADDRESS = "0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c";

export const GECKO_TERMINAL_POOL_ID =
  "0x7b0294d1917fb2b47417582f84b57850266c43bf77bcdc80ad39da0d94045056";

export const GECKO_TERMINAL_POOL_API = `https://api.geckoterminal.com/api/v2/networks/robinhood/pools/${GECKO_TERMINAL_POOL_ID}?include=quote_token,base_token`;

export const GECKO_TERMINAL_UGLY_POOLS_API = `https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/${UGLY_TOKEN_ADDRESS}/pools`;

export const CHANGE_WINDOWS = {
  h1: 60 * 60 * 1000,
  h24: 24 * 60 * 60 * 1000,
  d7: 7 * 24 * 60 * 60 * 1000,
} as const;
