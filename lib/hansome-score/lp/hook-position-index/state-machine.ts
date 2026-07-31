import type {
  HookIndexTerminalState,
  HookIncompleteReason,
  HookPositionIndexState,
} from "@/lib/hansome-score/lp/hook-position-index/types";

const ORDER: Record<HookIndexTerminalState, number> = {
  NEW: 0,
  BOOTSTRAPPING: 1,
  REPLAYING: 2,
  PUBLISHING: 3,
  SUCCESS_PARTIAL: 4,
  SUCCESS_COMPLETE: 5,
  FAILED_TERMINAL: 6,
};

export function canTransition(
  from: HookIndexTerminalState,
  to: HookIndexTerminalState,
): boolean {
  if (from === to) return true;
  if (from === "FAILED_TERMINAL") return false;
  if (to === "FAILED_TERMINAL") return true;
  if (from === "SUCCESS_COMPLETE" || from === "SUCCESS_PARTIAL") {
    // Allow re-entry into REPLAYING / PUBLISHING for incremental refresh.
    return (
      to === "REPLAYING" ||
      to === "PUBLISHING" ||
      to === "SUCCESS_COMPLETE" ||
      to === "SUCCESS_PARTIAL"
    );
  }
  if (to === "BOOTSTRAPPING") return true;
  return ORDER[to] >= ORDER[from];
}

export function transitionTerminalState(
  state: HookPositionIndexState,
  to: HookIndexTerminalState,
  opts?: { failedReason?: string; lastSuccessfulBlock?: number | null },
): HookPositionIndexState {
  if (!canTransition(state.terminalState, to)) {
    return state;
  }
  const next = structuredClone(state);
  next.terminalState = to;
  next.updatedAt = new Date().toISOString();
  if (to === "FAILED_TERMINAL") {
    next.failedReason = opts?.failedReason ?? "failed_terminal";
    next.lastSuccessfulBlock =
      opts?.lastSuccessfulBlock ?? state.lastSyncedBlock ?? null;
    if (!next.incompleteReasons.includes("failed_terminal")) {
      next.incompleteReasons = [
        ...next.incompleteReasons,
        "failed_terminal",
      ];
    }
  }
  return next;
}

/**
 * Derive publish terminal from completeness flags.
 * SUCCESS_COMPLETE only when hookDiscoveryComplete.
 * Never publish partial as complete.
 */
export function resolvePublishTerminal(
  state: HookPositionIndexState,
): HookIndexTerminalState {
  if (state.hookDiscoveryComplete) return "SUCCESS_COMPLETE";
  if (state.positions.length > 0 || state.incompleteReasons.length > 0) {
    return "SUCCESS_PARTIAL";
  }
  return "FAILED_TERMINAL";
}

export function bumpGeneration(gen: string): string {
  const n = Number.parseInt(gen, 10);
  if (!Number.isFinite(n) || n < 0) return "1";
  return String(n + 1);
}

export function compareGeneration(a: string, b: string): number {
  const na = Number.parseInt(a, 10);
  const nb = Number.parseInt(b, 10);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.localeCompare(b);
}

export function uniqueReasons(
  reasons: HookIncompleteReason[],
): HookIncompleteReason[] {
  return [...new Set(reasons)];
}
