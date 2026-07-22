import { loadConfig } from "./config.js";
import { createHealthServer, type HealthStatus } from "./health.js";
import { log } from "./logger.js";
import { startWorker } from "./loop/worker.js";
import { createStateStore } from "./state/store.js";
import { sendAlert } from "./alert.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const store = createStateStore({
    redisUrl: cfg.redisUrl,
    redisNamespace: cfg.redisNamespace,
    allowMemoryState: cfg.allowMemoryState,
    logDir: cfg.logDir,
  });

  const runtime = await startWorker(cfg, store);

  const getStatus = (): HealthStatus => {
    const h = runtime.getHealth();
    return {
      ok: h.ok,
      worker: cfg.workerName,
      profile: cfg.profile,
      chainId: cfg.chainId,
      dryRun: cfg.dryRun,
      startedAt: new Date(Date.now()).toISOString(),
      lastTickAt: h.lastTickAt,
      lastError: h.lastError,
      consecutiveFailures: h.consecutiveFailures,
      currentDay: h.currentDay,
      settler: runtime.clients.settlerAccount.address,
      seedWallet: runtime.clients.seedAccount.address,
    };
  };

  // Fix startedAt to boot time
  const startedAt = new Date().toISOString();
  const server = createHealthServer(cfg.healthHost, cfg.healthPort, () => ({
    ...getStatus(),
    startedAt,
  }));

  await sendAlert(cfg.alertWebhookUrl, {
    severity: "info",
    title: `${cfg.workerName} started`,
    fields: {
      profile: cfg.profile,
      chainId: cfg.chainId,
      dryRun: cfg.dryRun,
      settler: runtime.clients.settlerAccount.address,
    },
  });

  const shutdown = async (signal: string) => {
    log.info("shutdown", { signal });
    runtime.stop();
    server.close();
    await store.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch(async (e) => {
  log.error("fatal", { error: e instanceof Error ? e.message : String(e) });
  process.exit(1);
});
