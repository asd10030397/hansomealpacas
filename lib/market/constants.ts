export const UGLY_TOTAL_SUPPLY = 1_000_000_000;

export const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
export const SNAPSHOT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const MARKET_REFRESH_MS = 30 * 1000;

export const CHANGE_WINDOWS = {
  h1: 60 * 60 * 1000,
  h24: 24 * 60 * 60 * 1000,
  d7: 7 * 24 * 60 * 60 * 1000,
} as const;
