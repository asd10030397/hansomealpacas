import type { Address } from "viem";
import { gameRandomnessAbi, hansomeGameAbi } from "../chain/abis.js";
import {
  computeCurrentDay,
  dayWindows,
  isSeedPhaseOk,
  isSettlePhaseOk,
  phaseLabel,
  type GameTiming,
} from "../chain/phase.js";
import {
  assertGasBalance,
  createClients,
  errorMessage,
  writeContractSafe,
  type ChainClients,
} from "../chain/write.js";
import type { WorkerConfig } from "../config.js";
import { sendAlert } from "../alert.js";
import { log } from "../logger.js";
import { generateDaySeed } from "../seed.js";
import { assertChainId } from "../safety/guards.js";
import {
  actionKey,
  type DayRecord,
  type StateStore,
  type WorkerStateSnapshot,
} from "../state/store.js";
import { isBenignRevert, planSettlementStep, type CreditProgress } from "./plan.js";

export type WorkerRuntime = {
  cfg: WorkerConfig;
  clients: ChainClients;
  store: StateStore;
  getHealth: () => {
    ok: boolean;
    lastTickAt: string | null;
    lastError: string | null;
    consecutiveFailures: number;
    currentDay: number | null;
  };
  stop: () => void;
};

export async function startWorker(
  cfg: WorkerConfig,
  store: StateStore,
): Promise<WorkerRuntime> {
  const clients = createClients(cfg);
  let stopped = false;
  let lastTickAt: string | null = null;
  let lastError: string | null = null;
  let consecutiveFailures = 0;
  let currentDay: number | null = null;
  let timing: GameTiming | null = null;
  let backoffMs = 0;

  // Boot checks
  const chainId = Number(await clients.publicClient.getChainId());
  assertChainId(cfg.chainId, chainId);

  const onChainRandomness = (await clients.publicClient.readContract({
    address: cfg.gameAddress,
    abi: hansomeGameAbi,
    functionName: "randomness",
  })) as Address;
  if (onChainRandomness.toLowerCase() !== cfg.randomnessAddress.toLowerCase()) {
    throw new Error(
      `REFUSED: GAME.randomness()=${onChainRandomness} != RANDOMNESS_ADDRESS=${cfg.randomnessAddress}`,
    );
  }

  const provider = (await clients.publicClient.readContract({
    address: cfg.randomnessAddress,
    abi: gameRandomnessAbi,
    functionName: "randomnessProvider",
  })) as Address;
  if (provider.toLowerCase() !== clients.seedAccount.address.toLowerCase()) {
    throw new Error(
      `REFUSED: SEED key ${clients.seedAccount.address} is not on-chain randomnessProvider ${provider}`,
    );
  }

  timing = {
    dayZero: Number(
      await clients.publicClient.readContract({
        address: cfg.gameAddress,
        abi: hansomeGameAbi,
        functionName: "dayZero",
      }),
    ),
    dayLength: Number(
      await clients.publicClient.readContract({
        address: cfg.gameAddress,
        abi: hansomeGameAbi,
        functionName: "dayLength",
      }),
    ),
    commitDuration: Number(
      await clients.publicClient.readContract({
        address: cfg.gameAddress,
        abi: hansomeGameAbi,
        functionName: "commitDuration",
      }),
    ),
    revealDuration: Number(
      await clients.publicClient.readContract({
        address: cfg.gameAddress,
        abi: hansomeGameAbi,
        functionName: "revealDuration",
      }),
    ),
  };

  log.info("worker_boot", {
    worker: cfg.workerName,
    profile: cfg.profile,
    chainId: cfg.chainId,
    dryRun: cfg.dryRun,
    game: cfg.gameAddress,
    randomness: cfg.randomnessAddress,
    settler: clients.settlerAccount.address,
    seedWallet: clients.seedAccount.address,
    timing,
  });

  async function tick(): Promise<void> {
    if (!timing) throw new Error("timing not loaded");
    const liveChain = Number(await clients.publicClient.getChainId());
    assertChainId(cfg.chainId, liveChain);

    try {
      await assertGasBalance(
        clients.publicClient,
        clients.settlerAccount.address,
        cfg.minEthWei,
      );
      if (
        clients.seedAccount.address.toLowerCase() !==
        clients.settlerAccount.address.toLowerCase()
      ) {
        await assertGasBalance(
          clients.publicClient,
          clients.seedAccount.address,
          cfg.minEthWei,
        );
      }
    } catch (e) {
      if (cfg.dryRun) {
        log.warn("gas_balance_warn_dry_run", { error: errorMessage(e) });
      } else {
        throw e;
      }
    }

    const block = await clients.publicClient.getBlock({ blockTag: "latest" });
    const nowSec = Number(block.timestamp);
    const day = computeCurrentDay(timing, nowSec);
    currentDay = day;

    const daysToProcess: number[] = [];
    for (let d = Math.max(0, day - cfg.lookbackDays); d <= day; d++) {
      daysToProcess.push(d);
    }

    let snap = await store.load();

    for (const d of daysToProcess) {
      await processDay({
        cfg,
        clients,
        store,
        timing,
        day: d,
        nowSec,
        snap,
      });
      snap = await store.load();
    }

    lastTickAt = new Date().toISOString();
    lastError = null;
    consecutiveFailures = 0;
    backoffMs = 0;

    log.info("tick_ok", {
      day,
      nowSec,
      phase: phaseLabel(cfg.chainId, timing, day, nowSec),
      dryRun: cfg.dryRun,
    });
  }

  async function loop(): Promise<void> {
    while (!stopped) {
      try {
        const locked = await store.tryLock("tick", cfg.pollIntervalMs * 2);
        if (!locked) {
          log.debug("tick_skip_lock");
        } else {
          try {
            await tick();
          } finally {
            await store.releaseLock("tick");
          }
        }
      } catch (e) {
        consecutiveFailures += 1;
        lastError = errorMessage(e);
        backoffMs = Math.min(120_000, 2_000 * 2 ** Math.min(6, consecutiveFailures));
        log.error("tick_failed", {
          error: lastError,
          consecutiveFailures,
          backoffMs,
        });
        await sendAlert(cfg.alertWebhookUrl, {
          severity: "error",
          title: `${cfg.workerName} tick failed`,
          detail: lastError,
          fields: { consecutiveFailures, backoffMs },
        });
      }
      const wait = Math.max(cfg.pollIntervalMs, backoffMs);
      await sleep(wait);
    }
  }

  void loop();

  return {
    cfg,
    clients,
    store,
    getHealth: () => ({
      ok: consecutiveFailures < 5,
      lastTickAt,
      lastError,
      consecutiveFailures,
      currentDay,
    }),
    stop: () => {
      stopped = true;
    },
  };
}

async function processDay(input: {
  cfg: WorkerConfig;
  clients: ChainClients;
  store: StateStore;
  timing: GameTiming;
  day: number;
  nowSec: number;
  snap: WorkerStateSnapshot;
}): Promise<void> {
  const { cfg, clients, store, timing, day, nowSec } = input;
  let snap = input.snap;

  const windows = dayWindows(timing, day);
  if (nowSec < windows.dayStart) return;

  let hasDaySeed = Boolean(
    await clients.publicClient.readContract({
      address: cfg.randomnessAddress,
      abi: gameRandomnessAbi,
      functionName: "hasDaySeed",
      args: [BigInt(day)],
    }),
  );

  const progressRaw = (await clients.publicClient.readContract({
    address: cfg.gameAddress,
    abi: hansomeGameAbi,
    functionName: "creditProgress",
    args: [BigInt(day)],
  })) as readonly [bigint, bigint, boolean, boolean];

  const progress: CreditProgress = {
    cursor: Number(progressRaw[0]),
    total: Number(progressRaw[1]),
    finalized: progressRaw[2],
    settled: progressRaw[3],
  };

  const seedPhaseOk = isSeedPhaseOk(windows, nowSec);
  const settlePhaseOk = isSettlePhaseOk(cfg.chainId, windows, nowSec);

  let creditsThisTick = 0;

  for (;;) {
    const plan = planSettlementStep({
      hasDaySeed,
      seedPhaseOk,
      settlePhaseOk,
      progress,
      batchLimit: cfg.creditBatchLimit,
    });

    if (plan.action === "noop" || plan.action === "done") {
      if (plan.action === "done") {
        await markDay(store, snap, day, { settledAt: new Date().toISOString() });
      }
      return;
    }

    if (plan.action === "credit") {
      creditsThisTick += 1;
      if (creditsThisTick > cfg.maxCreditsPerTick) {
        log.info("credit_budget_pause", { day, creditsThisTick });
        return;
      }
    }

    const key = actionKey(
      day,
      plan.action,
      plan.action === "credit" ? String(plan.cursor) : "",
    );

    if (snap.done[key]) {
      const refreshed = await refreshProgress(clients, cfg, day);
      hasDaySeed = refreshed.hasDaySeed;
      Object.assign(progress, refreshed.progress);
      if (plan.action === "seed") {
        if (hasDaySeed) continue;
        // dry-run marked done without chain update
        return;
      }
      if (plan.action === "finalize" && progress.finalized) continue;
      if (plan.action === "credit" && progress.cursor > plan.cursor) continue;
      if (plan.action !== "credit") return;
    }

    if (snap.inflight[key]) {
      log.info("await_inflight", { key, hash: snap.inflight[key] });
      try {
        const receipt = await clients.publicClient.waitForTransactionReceipt({
          hash: snap.inflight[key] as `0x${string}`,
        });
        if (receipt.status === "success") {
          snap.done[key] = snap.inflight[key];
          delete snap.inflight[key];
          await store.save(snap);
        } else {
          delete snap.inflight[key];
          await store.save(snap);
        }
      } catch {
        delete snap.inflight[key];
        await store.save(snap);
      }
      const refreshed = await refreshProgress(clients, cfg, day);
      Object.assign(progress, refreshed.progress);
      continue;
    }

    try {
      if (plan.action === "seed") {
        if (!seedPhaseOk) {
          throw new Error("REFUSED: seed before day start");
        }
        const seed = generateDaySeed(day, cfg.workerName);
        const hash = await writeContractSafe({
          cfg,
          publicClient: clients.publicClient,
          walletClient: clients.seedWallet,
          account: clients.seedAccount,
          address: cfg.randomnessAddress,
          abi: gameRandomnessAbi,
          functionName: "fulfillDaySeed",
          args: [BigInt(day), seed],
        });
        await afterTx(store, snap, key, hash, day, {
          seededAt: new Date().toISOString(),
          lastTxHash: hash === "dry-run" ? undefined : hash,
        });
        // Update local seed flag for planner
        snap = await store.load();
        const refreshed = await refreshProgress(clients, cfg, day);
        hasDaySeed = refreshed.hasDaySeed || hash === "dry-run";
        Object.assign(progress, refreshed.progress);
        if (hash === "dry-run") return;
        continue;
      }

      if (plan.action === "finalize") {
        if (!settlePhaseOk) {
          throw new Error("REFUSED: finalize before settle phase");
        }
        const hash = await writeContractSafe({
          cfg,
          publicClient: clients.publicClient,
          walletClient: clients.settlerWallet,
          account: clients.settlerAccount,
          address: cfg.gameAddress,
          abi: hansomeGameAbi,
          functionName: "finalizeDay",
          args: [BigInt(day)],
        });
        await afterTx(store, snap, key, hash, day, {
          finalizedAt: new Date().toISOString(),
          lastTxHash: hash === "dry-run" ? undefined : hash,
        });
        snap = await store.load();
        const refreshed = await refreshProgress(clients, cfg, day);
        hasDaySeed = refreshed.hasDaySeed;
        Object.assign(progress, refreshed.progress);
        if (!refreshed.progress.finalized && hash === "dry-run") return;
        continue;
      }

      if (plan.action === "credit") {
        if (!settlePhaseOk && !progress.finalized) {
          throw new Error("REFUSED: credit before settle phase");
        }
        const hash = await writeContractSafe({
          cfg,
          publicClient: clients.publicClient,
          walletClient: clients.settlerWallet,
          account: clients.settlerAccount,
          address: cfg.gameAddress,
          abi: hansomeGameAbi,
          functionName: "creditBatch",
          args: [BigInt(day), BigInt(plan.limit)],
        });
        await afterTx(store, snap, key, hash, day, {
          lastCreditCursor: plan.cursor,
          lastTxHash: hash === "dry-run" ? undefined : hash,
        });
        snap = await store.load();
        const refreshed = await refreshProgress(clients, cfg, day);
        hasDaySeed = refreshed.hasDaySeed;
        Object.assign(progress, refreshed.progress);
        if (hash === "dry-run") return;
        continue;
      }
    } catch (e) {
      const msg = errorMessage(e);
      if (isBenignRevert(msg)) {
        log.info("benign_revert", { day, action: plan.action, msg });
        const refreshed = await refreshProgress(clients, cfg, day);
        hasDaySeed = refreshed.hasDaySeed;
        Object.assign(progress, refreshed.progress);
        snap.done[key] = "benign";
        await store.save(snap);
        continue;
      }
      snap.days[String(day)] = {
        ...(snap.days[String(day)] || { day }),
        lastError: msg,
      };
      await store.save(snap);
      throw e;
    }
  }
}

async function refreshProgress(
  clients: ChainClients,
  cfg: WorkerConfig,
  day: number,
): Promise<{ hasDaySeed: boolean; progress: CreditProgress }> {
  const hasDaySeed = Boolean(
    await clients.publicClient.readContract({
      address: cfg.randomnessAddress,
      abi: gameRandomnessAbi,
      functionName: "hasDaySeed",
      args: [BigInt(day)],
    }),
  );
  const progressRaw = (await clients.publicClient.readContract({
    address: cfg.gameAddress,
    abi: hansomeGameAbi,
    functionName: "creditProgress",
    args: [BigInt(day)],
  })) as readonly [bigint, bigint, boolean, boolean];
  return {
    hasDaySeed,
    progress: {
      cursor: Number(progressRaw[0]),
      total: Number(progressRaw[1]),
      finalized: progressRaw[2],
      settled: progressRaw[3],
    },
  };
}

async function afterTx(
  store: StateStore,
  snap: WorkerStateSnapshot,
  key: string,
  hash: string,
  day: number,
  patch: Partial<DayRecord>,
): Promise<void> {
  if (hash !== "dry-run") {
    snap.inflight[key] = hash;
    await store.save(snap);
    snap.done[key] = hash;
    delete snap.inflight[key];
  } else {
    snap.done[key] = "dry-run";
  }
  snap.days[String(day)] = {
    ...(snap.days[String(day)] || { day }),
    ...patch,
  };
  await store.save(snap);
}

async function markDay(
  store: StateStore,
  snap: WorkerStateSnapshot,
  day: number,
  patch: Partial<DayRecord>,
): Promise<void> {
  snap.days[String(day)] = {
    ...(snap.days[String(day)] || { day }),
    ...patch,
  };
  await store.save(snap);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
