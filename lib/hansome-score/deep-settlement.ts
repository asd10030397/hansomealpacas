/**
 * Cold Perf V2 Phase 7.3 — Bounded Deep Settlement.
 * Orchestration / cancellation / terminal-state reliability only.
 * Does not change score, LP math, burn, creator, or lock semantics.
 */

/** Persist cap so hung onProgress cannot block the publish chain forever. */
export const DEEP_PUBLISH_PERSIST_CAP_MS = 2_500;

/** Extra wait for a terminal publish waiting behind a hung mid-progress chain. */
export const DEEP_TERMINAL_PUBLISH_ESCAPE_MS = 3_000;

/**
 * Phase 13E.1 — Known-First Locked / Hook Native must survive Candidate KV latency.
 * Live tip4 evidence: `terminal publish persist capped after 2500ms` while
 * `[known-pons] hit` already verified #436637 — local settle without KV left status empty.
 */
export const DEEP_KNOWN_FIRST_PUBLISH_PERSIST_CAP_MS = 25_000;

/** Escape budget for Known-First terminal publishes waiting on the publish chain. */
export const DEEP_KNOWN_FIRST_TERMINAL_ESCAPE_MS = 28_000;

/** Progress actions that carry durable Known-First LP evidence. */
export function isKnownFirstDurablePublishAction(
  action: string | undefined | null,
): boolean {
  if (!action) return false;
  return (
    action === "lp_known_first_early_exit" ||
    action.includes("known-pons") ||
    action.includes("known-titan") ||
    action.includes("known-hook") ||
    action.includes("known_first")
  );
}

/**
 * Hard upper bound for the parallel wave barrier.
 * Aligns with DEEP_STAGE_BUDGET_MS.liquidity (180s) + publish escape headroom.
 * Instrumentation / safety net only — does not raise per-stage budgets.
 */
export const DEEP_PARALLEL_HARD_BOUND_MS =
  180_000 + DEEP_TERMINAL_PUBLISH_ESCAPE_MS + 5_000;

/**
 * Interactive stale recovery (status poll / lock takeover) — far below
 * DEEP_STALE_THRESHOLD_MS (360s). Fenced; does not lengthen stage budgets.
 */
export const DEEP_INTERACTIVE_STALE_MS = 90_000;

/** Actions that must settle the stage even if KV persist hangs. */
export const DEEP_TERMINAL_PROGRESS_ACTIONS = new Set([
  "timeout",
  "error",
  "done",
  "settled",
  "watchdog_timeout",
  "watchdog_stall",
  "lp_final_validation",
  "creator_burn_recompute",
  "zero_delta_reuse",
]);

export function isTerminalProgressAction(action: string | undefined): boolean {
  if (!action) return false;
  if (DEEP_TERMINAL_PROGRESS_ACTIONS.has(action)) return true;
  return (
    action.endsWith(":timeout") ||
    action.endsWith(":error") ||
    action.endsWith(":done") ||
    action === "partial" ||
    action === "complete"
  );
}

export type DeepAttemptCancelReason =
  | "stage_timeout"
  | "watchdog_timeout"
  | "hard_bound"
  | "interactive_stale"
  | "external"
  | "finalized"
  /** Phase 13C.1 — local coalesce without durable lease. */
  | "orphan_zombie_coalesce"
  | "zombie_coalesce";

export type DeepAttemptHandle = {
  deepAttemptId: string;
  tokenKey: string;
  generation: number;
  startedAt: number;
  signal: AbortSignal;
  isCancelled: () => boolean;
  isFinalized: () => boolean;
  cancelReason: () => DeepAttemptCancelReason | null;
  /** Abort in-flight stage work; fire-once safe. */
  cancel: (reason: DeepAttemptCancelReason) => void;
  /** Fence late publishes after terminal settle. */
  markFinalized: () => void;
  /** Watchdog fire-once per attempt. */
  markWatchdogFired: () => boolean;
  watchdogFired: () => boolean;
  stageAttemptId: (stage: string) => string;
};

let generationSeq = 0;

export function createDeepAttemptHandle(params: {
  deepAttemptId: string;
  tokenKey: string;
}): DeepAttemptHandle {
  const ac = new AbortController();
  let cancelled = false;
  let finalized = false;
  let cancelReason: DeepAttemptCancelReason | null = null;
  let watchdogFired = false;
  const generation = ++generationSeq;
  const stageSeq = new Map<string, number>();

  return {
    deepAttemptId: params.deepAttemptId,
    tokenKey: params.tokenKey,
    generation,
    startedAt: Date.now(),
    signal: ac.signal,
    isCancelled: () => cancelled || ac.signal.aborted,
    isFinalized: () => finalized,
    cancelReason: () => cancelReason,
    cancel: (reason) => {
      if (cancelled || finalized) return;
      cancelled = true;
      cancelReason = reason;
      try {
        ac.abort();
      } catch {
        /* ignore */
      }
    },
    markFinalized: () => {
      finalized = true;
      if (!cancelled) {
        cancelled = true;
        cancelReason = cancelReason ?? "finalized";
      }
      try {
        if (!ac.signal.aborted) ac.abort();
      } catch {
        /* ignore */
      }
    },
    markWatchdogFired: () => {
      if (watchdogFired) return false;
      watchdogFired = true;
      return true;
    },
    watchdogFired: () => watchdogFired,
    stageAttemptId: (stage: string) => {
      const n = (stageSeq.get(stage) ?? 0) + 1;
      stageSeq.set(stage, n);
      return `${params.deepAttemptId}:${stage}:${n}`;
    },
  };
}

/** In-process registry so status-poll watchdog can cancel the same-isolate worker. */
const activeAttempts = new Map<string, DeepAttemptHandle>();

export function registerDeepAttempt(handle: DeepAttemptHandle): void {
  activeAttempts.set(handle.tokenKey.toLowerCase(), handle);
}

export function unregisterDeepAttempt(handle: DeepAttemptHandle): void {
  const key = handle.tokenKey.toLowerCase();
  const cur = activeAttempts.get(key);
  if (cur === handle) activeAttempts.delete(key);
}

export function getActiveDeepAttempt(
  tokenKey: string,
): DeepAttemptHandle | undefined {
  return activeAttempts.get(tokenKey.toLowerCase());
}

/**
 * Cancel same-isolate Deep attempt. Returns true if a live handle was cancelled.
 * Cross-isolate: no-op (KV partial + lock recovery handle that path).
 */
export function cancelActiveDeepAttempt(
  tokenKey: string,
  reason: DeepAttemptCancelReason,
): boolean {
  const h = getActiveDeepAttempt(tokenKey);
  if (!h) return false;
  if (h.watchdogFired() && reason === "watchdog_timeout") {
    // Still cancel work if not yet cancelled.
  }
  if (reason === "watchdog_timeout" && !h.markWatchdogFired()) {
    // Already fired once — still ensure cancel, but caller should not re-stamp.
    h.cancel(reason);
    return true;
  }
  h.cancel(reason);
  return true;
}

export function raceWithCap<T>(
  work: Promise<T>,
  capMs: number,
): Promise<{ ok: true; value: T } | { ok: false; timedOut: true }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: { ok: true; value: T } | { ok: false; timedOut: true }) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };
    timer = setTimeout(() => finish({ ok: false, timedOut: true }), capMs);
    work.then(
      (value) => finish({ ok: true, value }),
      () => finish({ ok: false, timedOut: true }),
    );
  });
}

/** Combine AbortSignals; aborts when any input aborts. */
export function anyAbortSignal(
  ...signals: Array<AbortSignal | undefined | null>
): AbortSignal {
  const list = signals.filter((s): s is AbortSignal => s != null);
  if (list.length === 0) return new AbortController().signal;
  if (list.length === 1) return list[0]!;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any(list);
  }
  const ac = new AbortController();
  for (const s of list) {
    if (s.aborted) {
      ac.abort();
      return ac.signal;
    }
    s.addEventListener("abort", () => ac.abort(), { once: true });
  }
  return ac.signal;
}

/**
 * Promise.race that detaches the loser so non-abortable libs cannot keep the
 * caller pending. Does not cancel the underlying promise (caller should abort
 * via signal when possible).
 */
export async function raceDetach<T>(
  work: Promise<T>,
  boundMs: number,
  onTimeout: () => Error,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(onTimeout()), boundMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function clearDeepAttemptRegistryForTests(): void {
  activeAttempts.clear();
  generationSeq = 0;
}
