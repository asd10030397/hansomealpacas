import { Interface, formatEther, formatUnits, type JsonRpcProvider, type Log } from "ethers";
import { poolManagerAbi } from "./chain/poolManagerAbi";
import { config } from "./config";
import { createLogger } from "./logger";
import type { ParsedSwap, TradeDirection } from "./types";

const logger = createLogger("parser");
const iface = new Interface(poolManagerAbi);

/**
 * Decodes raw PoolManager Swap logs into ParsedSwap facts. Purely
 * blockchain-facing — knows nothing about Telegram, SQLite, or message
 * formatting (see requirement to keep chain logic isolated from Telegram
 * logic).
 */
export class SwapParser {
  private readonly blockTimestampCache = new Map<number, number>();

  constructor(private readonly provider: JsonRpcProvider) {}

  /** Call once per polling tick — avoids the cache growing unbounded across a long-running process. */
  resetTickCache(): void {
    this.blockTimestampCache.clear();
  }

  private async getBlockTimestamp(blockNumber: number): Promise<number> {
    const cached = this.blockTimestampCache.get(blockNumber);
    if (cached !== undefined) return cached;

    const block = await this.provider.getBlock(blockNumber);
    const timestamp = block?.timestamp ?? Math.floor(Date.now() / 1000);
    this.blockTimestampCache.set(blockNumber, timestamp);
    return timestamp;
  }

  async parse(log: Log): Promise<ParsedSwap | null> {
    let decoded;
    try {
      decoded = iface.parseLog({ topics: log.topics as string[], data: log.data });
    } catch (error) {
      logger.warn(`Failed to decode Swap log in tx ${log.transactionHash}`, error);
      return null;
    }
    if (!decoded || decoded.name !== "Swap") return null;

    const amount0 = decoded.args.amount0 as bigint;
    const amount1 = decoded.args.amount1 as bigint;

    logger.debug(
      `Decoded Swap in tx ${log.transactionHash}: id=${decoded.args.id} sender=${decoded.args.sender} amount0=${amount0} amount1=${amount1} sqrtPriceX96=${decoded.args.sqrtPriceX96}`,
    );

    // currency0 = ETH, currency1 = HANSOME (see lib/chain.ts POOL_KEY on the
    // website).
    //
    // IMPORTANT — verified against real transaction data (tx
    // 0xca39d9dd702fb58a1b7230f321d1866c9998488f64af4afd2f43e5ec6fea0683):
    // that tx had amount0 = -6000000000000000 (-0.006), amount1 =
    // +2852862...  (+2.85M). Ground truth from the tx's own logs: tx.value
    // = 6000000000000000 wei (the trader SENT 0.006 ETH with the call),
    // and the HANSOME Transfer log was `from=PoolManager, to=trader,
    // value=2852862...` (the trader RECEIVED the HANSOME). That is a BUY,
    // even though amount0 is negative and amount1 is positive — proving
    // amount0/amount1 are from the TRADER's perspective (negative = trader
    // pays/spends that token, positive = trader receives it), not the
    // pool's perspective. An earlier version of this code assumed the
    // opposite (pool perspective) and classified every buy as a sell and
    // vice versa. Do not flip this back without re-verifying against a
    // real transaction's actual Transfer logs.
    let direction: TradeDirection;
    if (amount0 < 0n && amount1 > 0n) {
      direction = "buy"; // trader spent ETH (negative delta), received HANSOME (positive delta)
    } else if (amount0 > 0n && amount1 < 0n) {
      direction = "sell"; // trader spent HANSOME (negative delta), received ETH (positive delta)
    } else {
      logger.warn(
        `Unexpected swap deltas in tx ${log.transactionHash} (amount0=${amount0}, amount1=${amount1}) — skipping`,
      );
      return null;
    }
    logger.debug(`Classified tx ${log.transactionHash} as ${direction.toUpperCase()}`);

    const [tx, blockTimestamp] = await Promise.all([
      this.provider.getTransaction(log.transactionHash),
      this.getBlockTimestamp(log.blockNumber),
    ]);

    if (!tx) {
      logger.warn(`Could not fetch transaction ${log.transactionHash} — skipping`);
      return null;
    }
    logger.debug(`tx ${log.transactionHash}: tx.from (trader)=${tx.from}, blockTimestamp=${blockTimestamp}`);

    const ethAmountWei = amount0 > 0n ? amount0 : -amount0;
    const hansomeAmountWei = amount1 > 0n ? amount1 : -amount1;

    return {
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      blockTimestamp,
      direction,
      // The Swap event's `sender` is the router (Universal Router), not the
      // trader — confirmed against real on-chain logs. tx.from is the
      // actual wallet that initiated the trade.
      traderAddress: tx.from,
      ethAmount: Number(formatEther(ethAmountWei)),
      hansomeAmount: Number(formatUnits(hansomeAmountWei, config.chain.tokenDecimals)),
      sqrtPriceX96: decoded.args.sqrtPriceX96 as bigint,
    };
  }
}
