import type { JsonRpcProvider } from "ethers";
import type { BotDatabase } from "./database";
import { checkIsNewHolder, fetchTotalHoldersBestEffort } from "./holders";
import { computeUsdPricing, getCurrentSqrtPriceX96 } from "./pricing";
import { fetchMarketContext } from "./market";
import type { EnrichedTrade, ParsedSwap, StatusSnapshot } from "./types";


/**
 * Orchestrates pricing + holder enrichment + persistence for freshly
 * decoded swaps, and assembles the read-side snapshot used by /status,
 * /stats, /price, /liquidity. Keeps database.ts (pure SQL) and
 * telegram.ts (pure formatting/sending) decoupled from each other.
 */
export class StatsService {
  constructor(
    private readonly db: BotDatabase,
    private readonly provider: JsonRpcProvider,
  ) {}

  async enrich(swap: ParsedSwap): Promise<EnrichedTrade> {
    const [{ priceEth, priceUsd, marketCapUsd }, market, isNewHolder, totalHolders] = await Promise.all([
      computeUsdPricing(swap.sqrtPriceX96),
      fetchMarketContext(),
      swap.direction === "buy"
        ? checkIsNewHolder(this.provider, this.db, swap.traderAddress, swap.blockNumber)
        : Promise.resolve(false),
      fetchTotalHoldersBestEffort(),
    ]);

    return {
      ...swap,
      priceEth,
      priceUsd,
      usdValue: swap.hansomeAmount * priceUsd,
      marketCapUsd,
      liquidityUsd: market.liquidityUsd,
      isNewHolder,
      totalHolders,
    };
  }

  /** Returns true if this trade was newly recorded (i.e. should be notified), false if it was a dedupe hit. */
  persist(trade: EnrichedTrade): boolean {
    return this.db.recordTrade(trade);
  }

  async getStatusSnapshot(): Promise<StatusSnapshot> {
    const [sqrtPriceX96, market, totalHolders] = await Promise.all([
      getCurrentSqrtPriceX96(this.provider),
      fetchMarketContext(),
      fetchTotalHoldersBestEffort(),
    ]);

    const { priceEth, priceUsd, marketCapUsd } = await computeUsdPricing(sqrtPriceX96);
    const state = this.db.getBotState();
    const window24h = this.db.get24hStats();

    return {
      state,
      volume24hEth: window24h.volumeEth,
      buyVolume24hEth: window24h.buyVolumeEth,
      sellVolume24hEth: window24h.sellVolumeEth,
      buys24h: window24h.buys,
      sells24h: window24h.sells,
      largestBuy24hEth: window24h.largestBuyEth,
      largestBuy24hTx: window24h.largestBuyTx,
      largestSell24hEth: window24h.largestSellEth,
      largestSell24hTx: window24h.largestSellTx,
      priceUsd,
      priceEth,
      marketCapUsd,
      liquidityUsd: market.liquidityUsd,
      totalHolders,
    };
  }
}
