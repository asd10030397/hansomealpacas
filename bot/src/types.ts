export type TradeDirection = "buy" | "sell";

/** Raw on-chain facts decoded from a single PoolManager Swap log. */
export type ParsedSwap = {
  txHash: string;
  blockNumber: number;
  blockTimestamp: number; // unix seconds
  direction: TradeDirection;
  traderAddress: string; // tx.from — NOT the Swap event's `sender` (that's the router)
  ethAmount: number; // always positive, human units
  hansomeAmount: number; // always positive, human units
  sqrtPriceX96: bigint;
};

/** ParsedSwap enriched with pricing + holder info, ready to persist/notify. */
export type EnrichedTrade = ParsedSwap & {
  priceUsd: number;
  priceEth: number;
  usdValue: number;
  marketCapUsd: number;
  liquidityUsd: number | null;
  isNewHolder: boolean;
  /** Best-effort total holder count (Blockscout) — approximate, see holders.ts. */
  totalHolders: number | null;
};

export type BotState = {
  lastProcessedBlock: number;
  totalBuys: number;
  totalSells: number;
  buyVolumeEth: number;
  sellVolumeEth: number;
  largestBuyEth: number;
  largestBuyTx: string | null;
  largestSellEth: number;
  largestSellTx: string | null;
  lastBuyAt: number | null;
  lastSellAt: number | null;
};

export type StatusSnapshot = {
  state: BotState;
  volume24hEth: number;
  buyVolume24hEth: number;
  sellVolume24hEth: number;
  buys24h: number;
  sells24h: number;
  /** Largest buy/sell within the last 24h, computed live from `trades` — see database.ts get24hStats(). */
  largestBuy24hEth: number;
  largestBuy24hTx: string | null;
  largestSell24hEth: number;
  largestSell24hTx: string | null;
  priceUsd: number;
  priceEth: number;
  marketCapUsd: number;
  liquidityUsd: number | null;
  totalHolders: number | null;
};
