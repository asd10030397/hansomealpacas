/**
 * Phase 10C-5 — Forced-refresh LP terminal contract.
 * Orchestration only: every force LP attempt ends SUCCESS_TERMINAL or FAILED_TERMINAL.
 * Does not change lock classification, scoring, or adapter semantics.
 */

import type {
  AnalysisStageId,
  LpTerminalContract,
  LpTerminalReason,
  LpTerminalState,
  ScanResponse,
} from "@/lib/hansome-score/types";

export type {
  LpTerminalContract,
  LpTerminalReason,
  LpTerminalState,
} from "@/lib/hansome-score/types";

/** Bounded recoveries after watchdog/timeout before FAILED_TERMINAL. */
export const MAX_LP_FORCE_RECOVERY_ATTEMPTS = 3;

/** Stall grace while force LP is RUNNING (watchdog may cancel, not partial-terminal). */
export const LP_FORCE_PROGRESS_STALL_MS = 90_000;

const TERMINAL_STATES = new Set<LpTerminalState>([
  "SUCCESS_TERMINAL",
  "FAILED_TERMINAL",
]);

export function isLpHardTerminal(
  contract: LpTerminalContract | null | undefined,
): boolean {
  return !!contract && TERMINAL_STATES.has(contract.terminalState);
}

export function isLpForceRefreshActive(
  response: Pick<ScanResponse, "lpTerminal"> | null | undefined,
): boolean {
  const c = response?.lpTerminal;
  if (!c?.forceRefresh) return false;
  return !isLpHardTerminal(c);
}

/** Coerce persisted/scan lpTerminal into the typed contract. */
export function asLpTerminalContract(
  value: ScanResponse["lpTerminal"] | LpTerminalContract | null | undefined,
): LpTerminalContract | null {
  if (!value) return null;
  return value as LpTerminalContract;
}

export function hasVerifiedLockedResult(
  response: Pick<ScanResponse, "overview"> | null | undefined,
): boolean {
  const positions = response?.overview?.lpIntelligence?.positions ?? [];
  return positions.some((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN");
}

export function beginLpTerminal(params: {
  attemptId: string;
  generation: string;
  forceRefresh?: boolean;
  startedAt?: string;
}): LpTerminalContract {
  return {
    attemptId: params.attemptId,
    generation: params.generation,
    terminalReason: params.forceRefresh ? "force_refresh_started" : "running",
    terminalState: "NEW",
    completedStages: [],
    failedStages: [],
    wallTime: 0,
    forceRefresh: params.forceRefresh === true,
    startedAt: params.startedAt ?? new Date().toISOString(),
    watchdogTimeoutAt: null,
    recoveryAttempts: 0,
  };
}

export function markLpTerminalRunning(
  contract: LpTerminalContract,
): LpTerminalContract {
  if (isLpHardTerminal(contract)) return contract;
  return {
    ...contract,
    terminalState: "RUNNING",
    terminalReason: "running",
  };
}

export function markLpTerminalPublishing(
  contract: LpTerminalContract,
): LpTerminalContract {
  if (isLpHardTerminal(contract)) return contract;
  return {
    ...contract,
    terminalState: "PUBLISHING",
    terminalReason: "publishing",
  };
}

export function recordLpWatchdogTimeout(
  contract: LpTerminalContract,
  at = new Date().toISOString(),
): LpTerminalContract {
  if (isLpHardTerminal(contract)) return contract;
  return {
    ...contract,
    terminalState: "RUNNING",
    terminalReason: "watchdog_timeout",
    watchdogTimeoutAt: at,
  };
}

export function bumpLpRecoveryAttempt(
  contract: LpTerminalContract,
): LpTerminalContract {
  if (isLpHardTerminal(contract)) return contract;
  return {
    ...contract,
    recoveryAttempts: (contract.recoveryAttempts ?? 0) + 1,
    terminalState: "RUNNING",
    terminalReason: "running",
  };
}

export function mayLpForceRecover(
  contract: LpTerminalContract | null | undefined,
): boolean {
  if (!contract?.forceRefresh) return false;
  if (isLpHardTerminal(contract)) return false;
  return (contract.recoveryAttempts ?? 0) < MAX_LP_FORCE_RECOVERY_ATTEMPTS;
}

function wallMs(contract: LpTerminalContract, now = Date.now()): number {
  const start = Date.parse(contract.startedAt);
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, now - start);
}

function assertTerminalFields(c: LpTerminalContract): LpTerminalContract {
  // Contract: no missing fields on SUCCESS/FAILED.
  return {
    attemptId: c.attemptId || "unknown",
    generation: c.generation || c.attemptId || "unknown",
    terminalReason: c.terminalReason || "unknown",
    terminalState: c.terminalState,
    completedStages: Array.isArray(c.completedStages) ? c.completedStages : [],
    failedStages: Array.isArray(c.failedStages) ? c.failedStages : [],
    wallTime: typeof c.wallTime === "number" ? c.wallTime : 0,
    forceRefresh: c.forceRefresh === true,
    startedAt: c.startedAt || new Date().toISOString(),
    watchdogTimeoutAt: c.watchdogTimeoutAt ?? null,
    recoveryAttempts: c.recoveryAttempts ?? 0,
  };
}

export function settleLpSuccessTerminal(
  contract: LpTerminalContract,
  opts: {
    reason?: LpTerminalReason;
    completedStages?: string[];
    failedStages?: string[];
    now?: number;
  } = {},
): LpTerminalContract {
  return assertTerminalFields({
    ...contract,
    terminalState: "SUCCESS_TERMINAL",
    terminalReason:
      opts.reason ??
      (contract.watchdogTimeoutAt
        ? "verified_result_after_recovery"
        : "verified_lock_published"),
    completedStages: opts.completedStages ?? ["liquidity", "publish"],
    failedStages: opts.failedStages ?? [],
    wallTime: wallMs(contract, opts.now ?? Date.now()),
  });
}

export function settleLpFailedTerminal(
  contract: LpTerminalContract,
  opts: {
    reason?: LpTerminalReason;
    completedStages?: string[];
    failedStages?: string[];
    now?: number;
  } = {},
): LpTerminalContract {
  return assertTerminalFields({
    ...contract,
    terminalState: "FAILED_TERMINAL",
    terminalReason: opts.reason ?? "recovery_exhausted",
    completedStages: opts.completedStages ?? [],
    failedStages: opts.failedStages ?? ["liquidity"],
    wallTime: wallMs(contract, opts.now ?? Date.now()),
  });
}

/** Stages still open for non-LP soft-fail (LP never partial-terminals under force). */
export function nonLpAnalyzingStages(
  stages: ScanResponse["analysisStages"],
): AnalysisStageId[] {
  const out: AnalysisStageId[] = [];
  for (const id of ["relationships", "creator", "burn"] as const) {
    const st = stages?.[id];
    if (st === "analyzing" || st === "pending") out.push(id);
  }
  return out;
}

/**
 * Apply SUCCESS/FAILED LP terminal onto a scan response.
 * Liquidity becomes done (success) or unknown (failed) — never sticky analyzing/partial.
 */
export function applyLpHardTerminal(
  response: ScanResponse,
  contract: LpTerminalContract,
): ScanResponse {
  const terminal = assertTerminalFields(contract);
  if (!isLpHardTerminal(terminal)) {
    return { ...response, lpTerminal: terminal };
  }
  const liq: "done" | "unknown" =
    terminal.terminalState === "SUCCESS_TERMINAL" ? "done" : "unknown";
  return {
    ...response,
    lpTerminal: terminal,
    analysisStages: {
      ...(response.analysisStages ?? ({} as ScanResponse["analysisStages"])),
      liquidity: liq,
    } as ScanResponse["analysisStages"],
  };
}

/**
 * Decide next LP action after interrupt / soft-fail.
 * Never returns PARTIAL_TERMINAL.
 */
export function resolveLpInterruptOutcome(params: {
  response: ScanResponse;
  contract: LpTerminalContract;
  interruptReason: LpTerminalReason;
}):
  | { kind: "success"; contract: LpTerminalContract; response: ScanResponse }
  | { kind: "recover"; contract: LpTerminalContract; response: ScanResponse }
  | { kind: "failed"; contract: LpTerminalContract; response: ScanResponse } {
  const { response, interruptReason } = params;
  let contract = {
    ...params.contract,
    terminalReason: interruptReason,
  };
  if (interruptReason === "watchdog_timeout") {
    contract = recordLpWatchdogTimeout(contract);
  }

  if (hasVerifiedLockedResult(response)) {
    const settled = settleLpSuccessTerminal(contract, {
      reason:
        interruptReason === "watchdog_timeout" ||
        interruptReason === "recovery_exhausted"
          ? "verified_result_after_recovery"
          : "verified_lock_published",
    });
    return {
      kind: "success",
      contract: settled,
      response: applyLpHardTerminal(response, settled),
    };
  }

  // Force path: bounded recoveries. Non-force: still avoid LP partial-terminal
  // while recoveryAttempts remain under the same bound.
  if ((contract.recoveryAttempts ?? 0) < MAX_LP_FORCE_RECOVERY_ATTEMPTS) {
    const next = bumpLpRecoveryAttempt(contract);
    return {
      kind: "recover",
      contract: next,
      response: {
        ...response,
        lpTerminal: next,
        analysisStages: {
          ...response.analysisStages!,
          liquidity: "analyzing",
        },
        analysisStatus: "deep_running",
      },
    };
  }

  const failed = settleLpFailedTerminal(contract, {
    reason:
      interruptReason === "watchdog_timeout"
        ? "watchdog_timeout"
        : interruptReason === "all_versions_failed"
          ? "all_versions_failed"
          : "recovery_exhausted",
    failedStages: ["liquidity"],
  });
  return {
    kind: "failed",
    contract: failed,
    response: applyLpHardTerminal(response, failed),
  };
}

/** Forbidden transition guard. */
export function assertAllowedLpTransition(
  from: LpTerminalState,
  to: LpTerminalState,
): boolean {
  if (from === to) return true;
  if (TERMINAL_STATES.has(from)) return false;
  if (from === "NEW") return to === "RUNNING" || TERMINAL_STATES.has(to);
  if (from === "RUNNING") {
    return to === "PUBLISHING" || TERMINAL_STATES.has(to);
  }
  if (from === "PUBLISHING") return TERMINAL_STATES.has(to);
  return false;
}
