import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config";
import { createLogger } from "./logger";
import type { BotState, EnrichedTrade } from "./types";

const logger = createLogger("database");

/**
 * Uses Node's built-in `node:sqlite` (stable since Node 22.5+, no
 * `--experimental` flag needed on the Node versions this project targets)
 * rather than a third-party native binding. That avoids requiring a C++
 * toolchain (Visual Studio Build Tools on Windows, build-essential on
 * Linux) just to install this bot — a meaningful reliability win for a
 * "run continuously as a standalone service" requirement. The API
 * (prepare/run/get/all, named `@param` binding, `.changes`) is close
 * enough to better-sqlite3 that swapping later would be a small, isolated
 * change confined to this file.
 */

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_hash TEXT NOT NULL UNIQUE,
  block_number INTEGER NOT NULL,
  block_timestamp INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('buy','sell')),
  trader_address TEXT NOT NULL,
  eth_amount REAL NOT NULL,
  hansome_amount REAL NOT NULL,
  usd_value REAL,
  price_usd REAL,
  is_new_holder INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trades_block_timestamp ON trades(block_timestamp);
CREATE INDEX IF NOT EXISTS idx_trades_direction ON trades(direction);

CREATE TABLE IF NOT EXISTS daily_stats (
  date TEXT PRIMARY KEY,
  buys INTEGER NOT NULL DEFAULT 0,
  sells INTEGER NOT NULL DEFAULT 0,
  buy_volume_eth REAL NOT NULL DEFAULT 0,
  sell_volume_eth REAL NOT NULL DEFAULT 0,
  new_holders INTEGER NOT NULL DEFAULT 0,
  largest_buy_eth REAL NOT NULL DEFAULT 0,
  largest_sell_eth REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bot_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  last_processed_block INTEGER NOT NULL DEFAULT 0,
  total_buys INTEGER NOT NULL DEFAULT 0,
  total_sells INTEGER NOT NULL DEFAULT 0,
  buy_volume_eth REAL NOT NULL DEFAULT 0,
  sell_volume_eth REAL NOT NULL DEFAULT 0,
  largest_buy_eth REAL NOT NULL DEFAULT 0,
  largest_buy_tx TEXT,
  largest_sell_eth REAL NOT NULL DEFAULT 0,
  largest_sell_tx TEXT,
  last_buy_at INTEGER,
  last_sell_at INTEGER,
  backfill_done INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO bot_state (id) VALUES (1);

CREATE TABLE IF NOT EXISTS known_holders (
  address TEXT PRIMARY KEY,
  first_seen_at INTEGER NOT NULL,
  first_seen_tx TEXT NOT NULL
);
`;

export class BotDatabase {
  private readonly db: DatabaseSync;

  constructor(filePath: string = config.database.path) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new DatabaseSync(filePath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec(MIGRATIONS);
    this.runAdditiveMigrations();
    logger.info(`SQLite ready → ${filePath}`);
  }

  /**
   * Additive, idempotent column migrations for databases created before a
   * given column existed (SQLite has no `ADD COLUMN IF NOT EXISTS`, so we
   * check `PRAGMA table_info` ourselves). Keeps existing deployments'
   * databases upgradable in place without a manual reset.
   */
  private runAdditiveMigrations(): void {
    const columns = this.db.prepare("PRAGMA table_info(bot_state)").all() as Array<{ name: string }>;
    const hasBackfillDone = columns.some((c) => c.name === "backfill_done");
    if (!hasBackfillDone) {
      this.db.exec("ALTER TABLE bot_state ADD COLUMN backfill_done INTEGER NOT NULL DEFAULT 0");
      logger.info("Migrated bot_state: added backfill_done column");
    }
  }

  getLastProcessedBlock(): number {
    const row = this.db
      .prepare("SELECT last_processed_block AS lastProcessedBlock FROM bot_state WHERE id = 1")
      .get() as { lastProcessedBlock: number };
    return row.lastProcessedBlock;
  }

  setLastProcessedBlock(blockNumber: number): void {
    this.db
      .prepare("UPDATE bot_state SET last_processed_block = ? WHERE id = 1")
      .run(blockNumber);
  }

  /** Returns true if this trade was newly inserted, false if it was a duplicate (already seen). */
  private insertTradeRow(trade: EnrichedTrade): boolean {
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO trades
          (tx_hash, block_number, block_timestamp, direction, trader_address,
           eth_amount, hansome_amount, usd_value, price_usd, is_new_holder, created_at)
         VALUES (@txHash, @blockNumber, @blockTimestamp, @direction, @traderAddress,
                 @ethAmount, @hansomeAmount, @usdValue, @priceUsd, @isNewHolder, @createdAt)`,
      )
      .run({
        txHash: trade.txHash,
        blockNumber: trade.blockNumber,
        blockTimestamp: trade.blockTimestamp,
        direction: trade.direction,
        traderAddress: trade.traderAddress,
        ethAmount: trade.ethAmount,
        hansomeAmount: trade.hansomeAmount,
        usdValue: trade.usdValue,
        priceUsd: trade.priceUsd,
        isNewHolder: trade.isNewHolder ? 1 : 0,
        createdAt: Math.floor(Date.now() / 1000),
      });
    return result.changes > 0;
  }

  private bumpBotState(trade: EnrichedTrade): void {
    const nowSec = trade.blockTimestamp;
    if (trade.direction === "buy") {
      this.db
        .prepare(
          `UPDATE bot_state SET
             total_buys = total_buys + 1,
             buy_volume_eth = buy_volume_eth + @ethAmount,
             last_buy_at = @nowSec,
             largest_buy_eth = CASE WHEN @ethAmount > largest_buy_eth THEN @ethAmount ELSE largest_buy_eth END,
             largest_buy_tx = CASE WHEN @ethAmount > largest_buy_eth THEN @txHash ELSE largest_buy_tx END
           WHERE id = 1`,
        )
        .run({ ethAmount: trade.ethAmount, nowSec, txHash: trade.txHash });
    } else {
      this.db
        .prepare(
          `UPDATE bot_state SET
             total_sells = total_sells + 1,
             sell_volume_eth = sell_volume_eth + @ethAmount,
             last_sell_at = @nowSec,
             largest_sell_eth = CASE WHEN @ethAmount > largest_sell_eth THEN @ethAmount ELSE largest_sell_eth END,
             largest_sell_tx = CASE WHEN @ethAmount > largest_sell_eth THEN @txHash ELSE largest_sell_tx END
           WHERE id = 1`,
        )
        .run({ ethAmount: trade.ethAmount, nowSec, txHash: trade.txHash });
    }
  }

  private bumpDailyStats(trade: EnrichedTrade): void {
    const date = new Date(trade.blockTimestamp * 1000).toISOString().slice(0, 10);
    this.db
      .prepare(`INSERT OR IGNORE INTO daily_stats (date) VALUES (?)`)
      .run(date);

    if (trade.direction === "buy") {
      this.db
        .prepare(
          `UPDATE daily_stats SET
             buys = buys + 1,
             buy_volume_eth = buy_volume_eth + @ethAmount,
             new_holders = new_holders + @newHolder,
             largest_buy_eth = CASE WHEN @ethAmount > largest_buy_eth THEN @ethAmount ELSE largest_buy_eth END
           WHERE date = @date`,
        )
        .run({ ethAmount: trade.ethAmount, newHolder: trade.isNewHolder ? 1 : 0, date });
    } else {
      this.db
        .prepare(
          `UPDATE daily_stats SET
             sells = sells + 1,
             sell_volume_eth = sell_volume_eth + @ethAmount,
             largest_sell_eth = CASE WHEN @ethAmount > largest_sell_eth THEN @ethAmount ELSE largest_sell_eth END
           WHERE date = @date`,
        )
        .run({ ethAmount: trade.ethAmount, date });
    }
  }

  private markHolderIfNew(trade: EnrichedTrade): void {
    if (!trade.isNewHolder) return;
    this.db
      .prepare(`INSERT OR IGNORE INTO known_holders (address, first_seen_at, first_seen_tx) VALUES (?, ?, ?)`)
      .run(trade.traderAddress.toLowerCase(), trade.blockTimestamp, trade.txHash);
  }

  /**
   * Persists a fully-enriched trade. Returns false (no-op) if the tx_hash
   * was already recorded — this is the dedupe guard that prevents duplicate
   * notifications when the listener re-scans a block range after a restart.
   */
  recordTrade(trade: EnrichedTrade): boolean {
    const inserted = this.insertTradeRow(trade);
    if (!inserted) {
      logger.debug(`Duplicate trade skipped (already recorded): ${trade.txHash}`);
      return false;
    }
    this.bumpBotState(trade);
    this.bumpDailyStats(trade);
    this.markHolderIfNew(trade);
    return true;
  }

  getBotState(): BotState {
    const row = this.db
      .prepare(
        `SELECT
           last_processed_block AS lastProcessedBlock,
           total_buys AS totalBuys,
           total_sells AS totalSells,
           buy_volume_eth AS buyVolumeEth,
           sell_volume_eth AS sellVolumeEth,
           largest_buy_eth AS largestBuyEth,
           largest_buy_tx AS largestBuyTx,
           largest_sell_eth AS largestSellEth,
           largest_sell_tx AS largestSellTx,
           last_buy_at AS lastBuyAt,
           last_sell_at AS lastSellAt
         FROM bot_state WHERE id = 1`,
      )
      .get() as BotState;
    return row;
  }

  /**
   * Every field here is computed live from the `trades` table for a
   * rolling 24h window — NOT from incrementally-bumped bot_state counters.
   * That's deliberate: bot_state's all-time counters only reflect trades
   * observed while a listener process happened to be running (plus
   * whatever the one-time backfill added), whereas this always reflects
   * exactly "the last 24 hours" regardless of process uptime/restarts,
   * and largest buy/sell here can never go stale the way an all-time
   * running max would (an all-time max never "ages out").
   */
  get24hStats(): {
    volumeEth: number;
    buyVolumeEth: number;
    sellVolumeEth: number;
    buys: number;
    sells: number;
    largestBuyEth: number;
    largestBuyTx: string | null;
    largestSellEth: number;
    largestSellTx: string | null;
  } {
    const since = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

    const totals = this.db
      .prepare(
        `SELECT
           COALESCE(SUM(eth_amount), 0) AS volumeEth,
           COALESCE(SUM(CASE WHEN direction = 'buy' THEN eth_amount ELSE 0 END), 0) AS buyVolumeEth,
           COALESCE(SUM(CASE WHEN direction = 'sell' THEN eth_amount ELSE 0 END), 0) AS sellVolumeEth,
           COALESCE(SUM(CASE WHEN direction = 'buy' THEN 1 ELSE 0 END), 0) AS buys,
           COALESCE(SUM(CASE WHEN direction = 'sell' THEN 1 ELSE 0 END), 0) AS sells
         FROM trades WHERE block_timestamp >= ?`,
      )
      .get(since) as {
      volumeEth: number;
      buyVolumeEth: number;
      sellVolumeEth: number;
      buys: number;
      sells: number;
    };

    const largestBuy = this.db
      .prepare(
        `SELECT eth_amount AS ethAmount, tx_hash AS txHash FROM trades
         WHERE direction = 'buy' AND block_timestamp >= ?
         ORDER BY eth_amount DESC LIMIT 1`,
      )
      .get(since) as { ethAmount: number; txHash: string } | undefined;

    const largestSell = this.db
      .prepare(
        `SELECT eth_amount AS ethAmount, tx_hash AS txHash FROM trades
         WHERE direction = 'sell' AND block_timestamp >= ?
         ORDER BY eth_amount DESC LIMIT 1`,
      )
      .get(since) as { ethAmount: number; txHash: string } | undefined;

    return {
      ...totals,
      largestBuyEth: largestBuy?.ethAmount ?? 0,
      largestBuyTx: largestBuy?.txHash ?? null,
      largestSellEth: largestSell?.ethAmount ?? 0,
      largestSellTx: largestSell?.txHash ?? null,
    };
  }

  isBackfillDone(): boolean {
    const row = this.db.prepare("SELECT backfill_done AS backfillDone FROM bot_state WHERE id = 1").get() as {
      backfillDone: number;
    };
    return row.backfillDone === 1;
  }

  markBackfillDone(): void {
    this.db.prepare("UPDATE bot_state SET backfill_done = 1 WHERE id = 1").run();
  }

  isKnownHolder(address: string): boolean {
    const row = this.db
      .prepare(`SELECT 1 FROM known_holders WHERE address = ?`)
      .get(address.toLowerCase());
    return Boolean(row);
  }

  close(): void {
    this.db.close();
  }
}
