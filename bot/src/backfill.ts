import { id as ethersId, type JsonRpcProvider } from "ethers";
import { config } from "./config";
import { createLogger } from "./logger";
import type { BotDatabase } from "./database";
import { SwapParser } from "./parser";
import type { StatsService } from "./stats";

const logger = createLogger("backfill");

const SWAP_EVENT_SIGNATURE = "Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)";
const SWAP_TOPIC = ethersId(SWAP_EVENT_SIGNATURE);

/**
 * Binary-searches for the highest block number whose timestamp is <= the
 * target timestamp. Robust to any block-time regardless of how fast/slow
 * the chain produces blocks — O(log2(latestBlock)) `getBlock` calls.
 */
async function findBlockAtOrBefore(
  provider: JsonRpcProvider,
  targetTimestamp: number,
  latestBlock: number,
): Promise<number> {
  let lo = 0;
  let hi = latestBlock;

  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const block = await provider.getBlock(mid);
    const ts = block?.timestamp ?? 0;
    if (ts <= targetTimestamp) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

/**
 * One-time historical backfill so 24h statistics (volume, largest
 * buy/sell, buy/sell counts) are correct immediately, not just built up
 * from whatever the live listener happens to observe after this process
 * started. Persists trades silently (no Telegram notifications) — the
 * live listener picks up from where this leaves off and notifies for
 * genuinely new trades going forward.
 *
 * Safe to call on every startup: it's a no-op (after one quick DB check)
 * once `bot_state.backfill_done` is set.
 */
export async function runBackfillIfNeeded(
  db: BotDatabase,
  provider: JsonRpcProvider,
  stats: StatsService,
): Promise<void> {
  if (db.isBackfillDone()) {
    logger.debug("Backfill already completed previously — skipping");
    return;
  }

  const startedAt = Date.now();
  const latestBlockAtStart = await provider.getBlockNumber();
  const targetTimestamp = Math.floor(Date.now() / 1000) - config.listener.backfillHours * 60 * 60;

  logger.info(
    `Starting one-time historical backfill (last ${config.listener.backfillHours}h) — locating start block...`,
  );
  const startBlock = await findBlockAtOrBefore(provider, targetTimestamp, latestBlockAtStart);
  logger.info(
    `Backfill scanning blocks ${startBlock} → ${latestBlockAtStart} (~${config.listener.backfillHours}h of history)`,
  );

  const parser = new SwapParser(provider);
  let logsFound = 0;
  let newlyRecorded = 0;
  let cursor = startBlock;

  while (cursor <= latestBlockAtStart) {
    const toBlock = Math.min(cursor + config.listener.maxBlockRange - 1, latestBlockAtStart);

    const logs = await provider.getLogs({
      address: config.chain.poolManagerAddress,
      topics: [SWAP_TOPIC, config.chain.poolId],
      fromBlock: cursor,
      toBlock,
    });

    for (const log of logs) {
      const parsed = await parser.parse(log);
      if (!parsed) continue;
      logsFound += 1;

      try {
        const enriched = await stats.enrich(parsed);
        const isNew = stats.persist(enriched);
        if (isNew) newlyRecorded += 1;
      } catch (error) {
        logger.error(`Backfill: failed to enrich/persist tx ${parsed.txHash} — skipping`, error);
      }
    }

    cursor = toBlock + 1;
  }

  // Only advance forward — never rewind a live listener that may already
  // be further ahead (e.g. this ran slowly and new blocks arrived, or a
  // previous partial run already advanced last_processed_block).
  const currentLastProcessed = db.getLastProcessedBlock();
  if (latestBlockAtStart > currentLastProcessed) {
    db.setLastProcessedBlock(latestBlockAtStart);
  }
  db.markBackfillDone();

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  logger.info(
    `Backfill complete in ${elapsedSec}s — found ${logsFound} real swap(s) in the last ${config.listener.backfillHours}h, recorded ${newlyRecorded} new trade(s). Live listener resumes from block ${latestBlockAtStart + 1}.`,
  );
}
