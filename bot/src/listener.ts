import { id as ethersId, type JsonRpcProvider } from "ethers";
import { config } from "./config";
import { createLogger } from "./logger";
import { createProvider, recreateProvider } from "./chain/provider";
import { SwapParser } from "./parser";
import type { ParsedSwap } from "./types";

const logger = createLogger("listener");

const SWAP_EVENT_SIGNATURE = "Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)";
const SWAP_TOPIC = ethersId(SWAP_EVENT_SIGNATURE);

export type SwapHandler = (swap: ParsedSwap) => Promise<void>;

/**
 * Polls PoolManager for Swap logs filtered to our PoolId, resuming from
 * the last persisted block on every tick (and after restarts). Robinhood
 * Chain's free public RPC has no standard WSS log-subscription support
 * (see chain/provider.ts) — WSS is a documented future extension point,
 * not wired up in v1 per the approved plan.
 *
 * Verbose per-tick tracing (block numbers, eth_getLogs calls/results,
 * decoded swaps) is logged at `debug` level — set LOG_LEVEL=debug in
 * .env to see it. At the default `info` level only real events (a swap
 * was found, a provider was recreated, an error occurred) are logged.
 */
export class SwapListener {
  private provider: JsonRpcProvider;
  private parser: SwapParser;
  private running = false;
  private consecutiveErrors = 0;
  private timer: NodeJS.Timeout | null = null;
  private tickCount = 0;

  constructor(
    private readonly getLastProcessedBlock: () => number,
    private readonly setLastProcessedBlock: (block: number) => void,
    private readonly onSwap: SwapHandler,
  ) {
    this.provider = createProvider();
    this.parser = new SwapParser(this.provider);
    logger.debug(
      `Listener constructed — pollIntervalMs=${config.listener.pollIntervalMs}, maxBlockRange=${config.listener.maxBlockRange}, initialLookbackBlocks=${config.listener.initialLookbackBlocks}, poolManager=${config.chain.poolManagerAddress}, poolId=${config.chain.poolId}, swapTopic=${SWAP_TOPIC}`,
    );
  }

  async start(): Promise<void> {
    this.running = true;
    logger.debug("Listener.start() called — running first tick now");
    await this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }

  private scheduleNext(delayMs: number): void {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
  }

  private async tick(): Promise<void> {
    this.tickCount += 1;
    const tickId = this.tickCount;
    logger.debug(`Tick #${tickId} starting at ${new Date().toISOString()}`);

    try {
      await this.processNewBlocks(tickId);
      this.consecutiveErrors = 0;
      logger.debug(`Tick #${tickId} completed OK — next tick in ${config.listener.pollIntervalMs}ms`);
      this.scheduleNext(config.listener.pollIntervalMs);
    } catch (error) {
      this.consecutiveErrors += 1;
      const backoff = Math.min(
        config.listener.pollIntervalMs * 2 ** this.consecutiveErrors,
        config.listener.maxBackoffMs,
      );
      logger.error(
        `Tick #${tickId} failed (consecutive error #${this.consecutiveErrors}) — retrying in ${backoff}ms; last_processed_block was not advanced, so nothing will be missed or duplicated. ${
          error instanceof Error ? `${error.name}: ${error.message}` : String(error)
        }`,
        error,
      );

      if (this.consecutiveErrors >= 3) {
        try {
          this.provider = recreateProvider(this.provider);
          this.parser = new SwapParser(this.provider);
          logger.info("Recreated RPC provider after repeated failures");
        } catch (recreateError) {
          logger.error("Failed to recreate RPC provider", recreateError);
        }
      }

      this.scheduleNext(backoff);
    }
  }

  private async processNewBlocks(tickId: number): Promise<void> {
    const latestBlock = await this.provider.getBlockNumber();
    const lastProcessed = this.getLastProcessedBlock();
    logger.debug(`Tick #${tickId}: currentBlock=${latestBlock}, last_processed_block=${lastProcessed}`);

    const fromBlock =
      lastProcessed > 0
        ? lastProcessed + 1
        : Math.max(latestBlock - config.listener.initialLookbackBlocks, 0);

    if (fromBlock > latestBlock) {
      logger.debug(`Tick #${tickId}: fromBlock (${fromBlock}) > currentBlock (${latestBlock}) — nothing new yet`);
      return;
    }

    this.parser.resetTickCache();

    let cursor = fromBlock;
    while (cursor <= latestBlock) {
      const toBlock = Math.min(cursor + config.listener.maxBlockRange - 1, latestBlock);

      logger.debug(
        `Tick #${tickId}: eth_getLogs address=${config.chain.poolManagerAddress} topics=[${SWAP_TOPIC}, ${config.chain.poolId}] fromBlock=${cursor} toBlock=${toBlock}`,
      );

      const logs = await this.provider.getLogs({
        address: config.chain.poolManagerAddress,
        topics: [SWAP_TOPIC, config.chain.poolId],
        fromBlock: cursor,
        toBlock,
      });

      if (logs.length > 0) {
        logger.info(`Blocks ${cursor}-${toBlock}: ${logs.length} Swap log(s) for our pool`);
      } else {
        logger.debug(`Tick #${tickId}: eth_getLogs returned 0 log(s) for blocks ${cursor}-${toBlock}`);
      }

      for (const [i, log] of logs.entries()) {
        logger.debug(
          `Tick #${tickId}: raw log ${i + 1}/${logs.length} — tx=${log.transactionHash} block=${log.blockNumber} topics=${JSON.stringify(log.topics)}`,
        );

        const parsed = await this.parser.parse(log);

        if (parsed) {
          logger.debug(
            `Tick #${tickId}: parsed OK — tx=${parsed.txHash} direction=${parsed.direction} ethAmount=${parsed.ethAmount} hansomeAmount=${parsed.hansomeAmount} trader=${parsed.traderAddress}`,
          );
          await this.onSwap(parsed);
        } else {
          logger.debug(`Tick #${tickId}: parser returned null for tx=${log.transactionHash} — see parser.ts warning above for the reason`);
        }
      }

      this.setLastProcessedBlock(toBlock);
      logger.debug(`Tick #${tickId}: last_processed_block advanced to ${toBlock}`);
      cursor = toBlock + 1;
    }
  }
}
