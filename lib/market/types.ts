export type MarketSnapshot = {
  ts: number;
  priceEth: number;
  priceUsd: number;
  tvlUsd: number;
  marketCapUsd: number;
};

export type MarketHistoryFile = {
  version: 1;
  snapshots: MarketSnapshot[];
};

export type PriceChangeKey = "h1" | "h24" | "d7";

export type MarketStatsResponse = {
  updatedAt: number;
  priceEth: number;
  priceUsd: number;
  uglyPerEth: number;
  marketCapUsd: number;
  tvlUsd: number;
  ethUsd: number;
  liquidity: {
    eth: number;
    ugly: number;
    raw: string;
  };
  tick: number;
  changes: Record<PriceChangeKey, number | null>;
  sparkline: { ts: number; priceUsd: number }[];
  historyStatus: "ready" | "building";
  snapshotCount: number;
  nextSnapshotInMs: number;
};
