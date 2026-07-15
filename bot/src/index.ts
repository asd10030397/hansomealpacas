// NOTE: this import must stay first — config.ts loads .env via dotenv as a
// side effect, and every other module (starting with logger.ts) reads
// process.env at module-load time.
import { config } from "./config";

import { JsonRpcProvider } from "ethers";
import { createLogger } from "./logger";
import { BotDatabase } from "./database";
import { SwapListener } from "./listener";
import { StatsService } from "./stats";
import { createBot, sendTradeNotification } from "./telegram";
import { registerCommands } from "./commands";
import { runBackfillIfNeeded } from "./backfill";

const logger = createLogger("index");

async function main(): Promise<void> {
  logger.info("Starting HANSOME buy bot...");
  logger.info(`Pool: ${config.chain.poolId}`);
  logger.info(`Token: ${config.chain.tokenAddress}`);
  logger.info(`RPC: ${config.chain.rpcUrl}`);

  const db = new BotDatabase();

  // Separate from the listener's own provider (chain/provider.ts) so the
  // listener can recreate/reset its connection after RPC failures without
  // disrupting on-demand reads triggered by Telegram commands.
  const readProvider = new JsonRpcProvider(config.chain.rpcUrl, config.chain.chainId, {
    staticNetwork: true,
  });

  const stats = new StatsService(db, readProvider);
  const bot = createBot();
  registerCommands(bot, stats);

  // Runs once (tracked in bot_state.backfill_done) so 24h stats — volume,
  // largest buy/sell, buy/sell counts — are accurate from the very first
  // /status call instead of only reflecting trades observed after this
  // process happened to start. No Telegram notifications are sent for
  // backfilled trades. See backfill.ts.
  await runBackfillIfNeeded(db, readProvider, stats);

  const listener = new SwapListener(
    () => db.getLastProcessedBlock(),
    (block) => db.setLastProcessedBlock(block),
    async (swap) => {
      logger.debug(`onSwap received tx=${swap.txHash} direction=${swap.direction} — enriching...`);
      try {
        const enriched = await stats.enrich(swap);
        logger.debug(
          `onSwap enriched tx=${swap.txHash} priceUsd=${enriched.priceUsd} usdValue=${enriched.usdValue} marketCapUsd=${enriched.marketCapUsd} liquidityUsd=${enriched.liquidityUsd} isNewHolder=${enriched.isNewHolder}`,
        );

        const isNewTrade = stats.persist(enriched);
        if (isNewTrade) {
          logger.info(
            `New ${enriched.direction.toUpperCase()} tx=${enriched.txHash} eth=${enriched.ethAmount} hansome=${enriched.hansomeAmount} usd=${enriched.usdValue} — sending Telegram notification`,
          );
          await sendTradeNotification(bot, enriched);
          logger.debug(`onSwap notification sent for tx=${swap.txHash}`);
        } else {
          // Exact skip reason: tx_hash already exists in `trades` (UNIQUE
          // constraint), i.e. this swap was already recorded and notified
          // in a previous tick/run. Prevents duplicate alerts when a block
          // range is re-scanned after a restart.
          logger.debug(
            `onSwap skipped notification for tx=${swap.txHash} — reason: duplicate (tx_hash already recorded in the trades table)`,
          );
        }
      } catch (error) {
        logger.error(`onSwap failed for tx=${swap.txHash} — exception during enrich/persist/notify`, error);
      }
    },
  );

  // IMPORTANT: do NOT `await` this. Telegraf's launch() internally awaits
  // its own long-polling loop (telegraf/lib/telegraf.js: `await
  // this.startPolling(...)`), which only resolves once `bot.stop()` is
  // called — i.e. `await bot.launch()` blocks for the entire lifetime of
  // the process. Awaiting it here previously meant `listener.start()` on
  // the next line was never reached, so the listener never ran a single
  // tick even though Telegram commands worked fine (the polling loop
  // dispatches updates independently of whether launch()'s own promise
  // has resolved). Attach a rejection handler instead, in case launch()
  // fails fast (e.g. an invalid token).
  bot.launch({ dropPendingUpdates: true }).catch((error) => {
    logger.error("Telegram bot.launch() rejected", error);
  });
  logger.debug("Telegram bot.launch() called (not awaited) — long-polling loop starting in background");

  await listener.start();
  logger.info("Swap listener started");

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully...`);
    listener.stop();
    bot.stop(signal);
    db.close();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", reason);
  });
}

main().catch((error) => {
  logger.error("Fatal error during startup", error);
  process.exit(1);
});
