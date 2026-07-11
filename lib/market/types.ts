/** @deprecated Legacy on-chain snapshot types (history/snapshots modules). */
export type MarketSnapshot = {
  ts: number;
  priceEth: number;
  priceUsd: number;
  tvlUsd: number;
  marketCapUsd: number;
};

/** @deprecated */
export type MarketHistoryFile = {
  version: 1;
  snapshots: MarketSnapshot[];
};

/** @deprecated */
export type PriceChangeKey = "h1" | "h24" | "d7";

export type MarketTransactions24h = {
  buys: number | null;
  sells: number | null;
  buyers: number | null;
  sellers: number | null;
};

export type MarketStatsResponse = {
  updatedAt: number;
  source: "geckoterminal";
  poolName: string;
  priceUsd: number;
  priceEth: number;
  change24h: number | null;
  volume24hUsd: number;
  liquidityUsd: number;
  transactions24h: MarketTransactions24h | null;
};
