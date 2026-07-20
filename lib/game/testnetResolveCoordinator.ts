/**
 * Single-flight Testnet gasless resolve coordinator (client).
 * Prevents AutoReveal + SettlementView from double-hitting the relayer.
 * Continues unsettled days in the background across Commit transitions.
 */

import {
  fetchTestnetResolveStatus,
  isRelayerNotConfiguredResponse,
  requestTestnetResolve,
  type TestnetResolveResponse,
} from "@/lib/game/testnetGaslessResolve";
import {
  emptyTimings,
  stageFromResolveFlags,
  summarizeTimingSamples,
  type TestnetResolveStage,
  type TestnetResolveTimingSample,
  type TestnetResolveTimings,
} from "@/lib/game/testnetResolveStages";

export type DayResolveSnapshot = {
  day: number;
  stage: TestnetResolveStage;
  running: boolean;
  lastError: string | null;
  lastMessage: string | null;
  timings: TestnetResolveTimings | null;
  settled: boolean;
  updatedAt: number;
};

type Listener = () => void;

const FAST_POLL_MS = 1_500;
const SLOW_POLL_MS = 6_000;
const BACKOFF_MIN_MS = 1_500;
const BACKOFF_MAX_MS = 30_000;
const MAX_SAMPLES = 40;

const snapshots = new Map<number, DayResolveSnapshot>();
const settledDays = new Set<number>();
const listeners = new Set<Listener>();
const samples: TestnetResolveTimingSample[] = [];

let inFlightDay: number | null = null;
let loopTimer: ReturnType<typeof setTimeout> | null = null;
let loopTargets: number[] = [];
let loopActive = false;
let failureBackoffMs = BACKOFF_MIN_MS;

/** null = not probed yet; true/false after GET /testnet-resolve */
let relayerConfigured: boolean | null = null;
let statusProbe: Promise<boolean> | null = null;
/** One compact notice for the whole session (not per panel). */
let serviceNotice: string | null = null;
let serviceUnavailable = false;

function notify(): void {
  for (const l of listeners) l();
}

function getOrCreate(day: number): DayResolveSnapshot {
  let snap = snapshots.get(day);
  if (!snap) {
    snap = {
      day,
      stage: settledDays.has(day) ? "completed" : "idle",
      running: false,
      lastError: null,
      lastMessage: null,
      timings: null,
      settled: settledDays.has(day),
      updatedAt: Date.now(),
    };
    snapshots.set(day, snap);
  }
  return snap;
}

function patch(day: number, partial: Partial<DayResolveSnapshot>): DayResolveSnapshot {
  const prev = getOrCreate(day);
  const next = { ...prev, ...partial, day, updatedAt: Date.now() };
  snapshots.set(day, next);
  notify();
  return next;
}

function recordSample(sample: TestnetResolveTimingSample): void {
  samples.push(sample);
  if (samples.length > MAX_SAMPLES) samples.shift();
}

function markServiceUnavailable(message: string): void {
  serviceUnavailable = true;
  relayerConfigured = false;
  if (!serviceNotice) {
    serviceNotice = message;
  }
  stopTestnetResolveLoop();
  for (const day of loopTargets) {
    patch(day, {
      stage: "error",
      running: false,
      lastError: null,
      lastMessage: null,
    });
  }
  notify();
}

async function ensureRelayerConfigured(): Promise<boolean> {
  if (serviceUnavailable) return false;
  if (relayerConfigured === true) return true;
  if (relayerConfigured === false) return false;
  if (statusProbe) return statusProbe;

  statusProbe = (async () => {
    const status = await fetchTestnetResolveStatus();
    if (!status.relayerConfigured || !status.canResolve) {
      markServiceUnavailable(
        status.error ??
          (process.env.NODE_ENV === "production"
            ? "Battle settlement service is temporarily unavailable."
            : "Testnet relayer is not configured on this server."),
      );
      return false;
    }
    relayerConfigured = true;
    return true;
  })().finally(() => {
    statusProbe = null;
  });

  return statusProbe;
}

function applyResponse(
  day: number,
  result: TestnetResolveResponse,
  timings: TestnetResolveTimings,
): void {
  if (isRelayerNotConfiguredResponse(result)) {
    markServiceUnavailable(
      result.error ?? "Testnet relayer is not configured on this server.",
    );
    return;
  }

  const creditsDone = Boolean(result.alreadySettled);
  const stage =
    result.ok === false && result.error
      ? "error"
      : creditsDone
        ? "completed"
        : timings.stage === "completed"
          ? "completed"
          : result.finalized
            ? "finalizing"
            : timings.stage;

  if (creditsDone || stage === "completed") {
    settledDays.add(day);
    failureBackoffMs = BACKOFF_MIN_MS;
  }

  let lastMessage: string | null = null;
  if (creditsDone) {
    lastMessage = "Battle already settled — showing results.";
  } else if (result.finalized) {
    lastMessage = "Battle finalized — crediting rewards…";
  } else if (result.settleTxHash) {
    lastMessage = `Settlement progress (revealed ${result.revealed ?? 0}).`;
  } else if ((result.revealed ?? 0) > 0) {
    lastMessage = `Relayer revealed ${result.revealed} NFT(s)…`;
  } else if (stage === "waiting_seed") {
    lastMessage = "Waiting for settlement randomness…";
  } else if (stage === "settling" || stage === "finalizing") {
    lastMessage = "Finalizing settlement…";
  }

  const failed = result.ok === false && Boolean(result.error);
  if (failed) {
    failureBackoffMs = Math.min(BACKOFF_MAX_MS, Math.max(BACKOFF_MIN_MS, failureBackoffMs * 2));
  } else if (result.ok) {
    failureBackoffMs = BACKOFF_MIN_MS;
  }

  patch(day, {
    stage,
    settled: settledDays.has(day),
    lastError: failed ? (result.error ?? "Gasless resolve failed.") : null,
    lastMessage,
    timings,
    running: false,
  });

  recordSample({
    ...timings,
    day,
    at: Date.now(),
    alreadySettled: Boolean(result.alreadySettled),
    ok: Boolean(result.ok),
  });
}

async function runOne(day: number): Promise<void> {
  if (serviceUnavailable) return;
  if (settledDays.has(day)) {
    patch(day, { stage: "completed", settled: true, running: false });
    return;
  }
  if (inFlightDay != null) return;

  const ready = await ensureRelayerConfigured();
  if (!ready) return;

  inFlightDay = day;
  patch(day, { stage: "checking", running: true, lastError: null });

  const t0 = performance.now();
  try {
    const result = await requestTestnetResolve({
      day,
      reveals: [],
      fulfillSeed: true,
      settle: true,
    });
    const serverTimings = result.timings;
    const timings: TestnetResolveTimings = serverTimings
      ? {
          ...serverTimings,
          totalMs: serverTimings.totalMs || Math.round(performance.now() - t0),
        }
      : {
          ...emptyTimings(
            stageFromResolveFlags({
              alreadySettled: result.alreadySettled,
              finalized: result.finalized,
              settleTxHash: result.settleTxHash,
              seedTxHash: result.seedTxHash,
              seedSkipped: result.seedSkipped,
              revealed: result.revealed,
              revealTxHash: result.revealTxHash,
              error: result.ok ? null : result.error,
            }),
          ),
          totalMs: Math.round(performance.now() - t0),
        };

    // Soft-ok for idempotent races.
    if (
      !result.ok &&
      result.error &&
      (/AlreadySettled/i.test(result.error) ||
        /SeedAlreadySet/i.test(result.error) ||
        /0xbf136bb2/i.test(result.error))
    ) {
      applyResponse(
        day,
        {
          ...result,
          ok: true,
          alreadySettled: /AlreadySettled/i.test(result.error),
          seedSkipped: true,
        },
        {
          ...timings,
          stage: /AlreadySettled/i.test(result.error) ? "completed" : timings.stage,
        },
      );
      return;
    }

    applyResponse(day, result, timings);
  } catch (e) {
    failureBackoffMs = Math.min(BACKOFF_MAX_MS, Math.max(BACKOFF_MIN_MS, failureBackoffMs * 2));
    patch(day, {
      stage: "error",
      running: false,
      lastError: e instanceof Error ? e.message : "Gasless resolve failed.",
    });
  } finally {
    inFlightDay = null;
  }
}

function pickNextTarget(targets: number[]): number | null {
  const unique = [...new Set(targets)].filter((d) => d >= 0).sort((a, b) => b - a);
  for (const day of unique) {
    if (settledDays.has(day)) continue;
    if (inFlightDay === day) continue;
    return day;
  }
  return null;
}

async function loopTick(): Promise<void> {
  if (!loopActive || serviceUnavailable) return;

  const ready = await ensureRelayerConfigured();
  if (!ready) return;

  const next = pickNextTarget(loopTargets);
  if (next != null && inFlightDay == null) {
    await runOne(next);
  }
  if (!loopActive || serviceUnavailable) return;

  const pending = loopTargets.some((d) => !settledDays.has(d));
  const lastSnap = next != null ? snapshots.get(next) : null;
  const hadError = Boolean(lastSnap?.lastError) && !lastSnap?.settled;
  let delay = SLOW_POLL_MS;
  if (pending || inFlightDay != null) {
    delay = hadError ? failureBackoffMs : FAST_POLL_MS;
  }
  loopTimer = setTimeout(() => {
    void loopTick();
  }, delay);
}

/**
 * Keep resolving these days (current reveal day + previous day during Commit).
 * Safe to call repeatedly — replaces target set and ensures the loop is running.
 */
export function setTestnetResolveTargets(days: number[]): void {
  loopTargets = [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 0);
  for (const d of loopTargets) getOrCreate(d);

  if (serviceUnavailable) {
    notify();
    return;
  }

  if (!loopActive) {
    loopActive = true;
    void loopTick();
    return;
  }

  // Kick immediately when new unsettled targets appear (don't wait for poll).
  const next = pickNextTarget(loopTargets);
  if (next != null && inFlightDay == null) {
    void runOne(next);
  }
}

export function stopTestnetResolveLoop(): void {
  loopActive = false;
  if (loopTimer != null) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }
}

export function subscribeTestnetResolve(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDayResolveSnapshot(day: number): DayResolveSnapshot {
  return getOrCreate(day);
}

export function getTestnetResolveTimingSummary() {
  return summarizeTimingSamples(samples);
}

export function getTestnetResolveSamples(): readonly TestnetResolveTimingSample[] {
  return samples;
}

/** Compact single notice when relayer cannot run (dev or prod safe copy). */
export function getTestnetResolveServiceNotice(): string | null {
  return serviceNotice;
}

export function isTestnetResolveServiceUnavailable(): boolean {
  return serviceUnavailable;
}

/** Test helpers */
export function __resetTestnetResolveCoordinatorForTests(): void {
  stopTestnetResolveLoop();
  snapshots.clear();
  settledDays.clear();
  samples.length = 0;
  inFlightDay = null;
  loopTargets = [];
  failureBackoffMs = BACKOFF_MIN_MS;
  relayerConfigured = null;
  statusProbe = null;
  serviceNotice = null;
  serviceUnavailable = false;
}

export function __markSettledForTests(day: number): void {
  settledDays.add(day);
  patch(day, { settled: true, stage: "completed", running: false });
}

export function __markRelayerUnavailableForTests(message: string): void {
  markServiceUnavailable(message);
}
