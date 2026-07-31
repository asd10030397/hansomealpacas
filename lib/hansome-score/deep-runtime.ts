/**
 * Phase 13A — Deep LP runtime state machine, lease metadata, orphan recovery.
 * Orchestration / reliability only. Does not change Score, Titan, Hook, or LP math.
 */

import { resolveDeploymentScope } from "@/lib/hansome-score/deployment-scope";
import {
  isLpForceRefreshActive,
  isLpHardTerminal,
  mayLpForceRecover,
  settleLpFailedTerminal,
  applyLpHardTerminal,
} from "@/lib/hansome-score/lp/lp-terminal-contract";
import {
  MAX_DEEP_AUTO_RETRIES,
  isDeepRetryable,
  newDeepAttemptId,
} from "@/lib/hansome-score/scan-progress";
import type {
  AnalysisStageId,
  AnalysisStageState,
  AnalysisStages,
  DeepRuntimeDiagnostics,
  DeepRuntimeLease,
  DeepLeaseState,
  ScanResponse,
} from "@/lib/hansome-score/types";

/** Lease TTL — must outlive a single progress heartbeat interval; under stage budgets. */
export const DEEP_LEASE_TTL_MS = 120_000;

/** Heartbeat refresh window while worker is alive. */
export const DEEP_LEASE_HEARTBEAT_MS = 30_000;

/** Explicit bound for individual Hook/LP RPC awaits on the Deep path. */
export const DEEP_LP_RPC_TIMEOUT_MS = 45_000;

const ANALYZING_STAGE_IDS: AnalysisStageId[] = [
  "relationships",
  "liquidity",
  "creator",
  "burn",
  "score",
];

export function newDeepWorkerId(): string {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function hasAnalyzingDeepStage(
  response: Pick<ScanResponse, "analysisStages"> | null | undefined,
): boolean {
  const stages = response?.analysisStages;
  if (!stages) return false;
  for (const id of ANALYZING_STAGE_IDS) {
    if (stages[id] === "analyzing" || stages[id] === "pending") return true;
  }
  return false;
}

export function isLeaseValid(
  lease: DeepRuntimeLease | null | undefined,
  now = Date.now(),
): boolean {
  if (!lease?.expiresAt) return false;
  const exp = Date.parse(lease.expiresAt);
  if (!Number.isFinite(exp)) return false;
  return exp > now;
}

export function leaseState(
  lease: DeepRuntimeLease | null | undefined,
  now = Date.now(),
): DeepLeaseState {
  if (!lease) return "none";
  return isLeaseValid(lease, now) ? "valid" : "expired";
}

/**
 * Required invariant:
 * analyzing ⇒ deepInflight OR retryScheduled OR valid lease
 */
export function isOrphanAnalyzing(params: {
  response: Pick<
    ScanResponse,
    "analysisStages" | "analysisStatus" | "deepRuntime" | "deepRetryCount"
  >;
  deepInflight: boolean;
  now?: number;
}): boolean {
  if (!hasAnalyzingDeepStage(params.response)) return false;
  if (params.deepInflight) return false;
  const rt = params.response.deepRuntime;
  if (rt?.retryScheduled) return false;
  if (isLeaseValid(rt?.lease, params.now)) return false;
  return true;
}

export function beginDeepLease(params: {
  generation: string;
  workerId?: string;
  attempt: number;
  deploymentScope?: string;
  now?: number;
}): DeepRuntimeLease {
  const now = params.now ?? Date.now();
  const iso = new Date(now).toISOString();
  return {
    generation: params.generation,
    workerId: params.workerId ?? newDeepWorkerId(),
    startedAt: iso,
    heartbeatAt: iso,
    expiresAt: new Date(now + DEEP_LEASE_TTL_MS).toISOString(),
    attempt: params.attempt,
    deploymentScope: params.deploymentScope ?? resolveDeploymentScope(),
  };
}

export function heartbeatDeepLease(
  lease: DeepRuntimeLease,
  now = Date.now(),
): DeepRuntimeLease {
  return {
    ...lease,
    heartbeatAt: new Date(now).toISOString(),
    expiresAt: new Date(now + DEEP_LEASE_TTL_MS).toISOString(),
  };
}

export function stampDeepRuntime(
  response: ScanResponse,
  patch: Partial<NonNullable<ScanResponse["deepRuntime"]>> & {
    lastTransition: string;
    lastErrorCode?: string | null;
  },
): ScanResponse {
  const prev = response.deepRuntime ?? {};
  const next = {
    ...prev,
    ...patch,
    lastErrorCode:
      patch.lastErrorCode === null
        ? undefined
        : (patch.lastErrorCode ?? prev.lastErrorCode),
  };
  return { ...response, deepRuntime: next };
}

export function withRegisteredDeepJob(
  response: ScanResponse,
  opts?: { workerId?: string; now?: number },
): ScanResponse {
  const generation = response.deepAttemptId ?? newDeepAttemptId();
  const attempt = response.deepRetryCount ?? 0;
  const lease = beginDeepLease({
    generation,
    workerId: opts?.workerId,
    attempt,
    now: opts?.now,
  });
  return stampDeepRuntime(
    {
      ...response,
      deepAttemptId: generation,
      analysisStatus:
        response.analysisStatus === "partial" ||
        response.analysisStatus === "failed"
          ? "deep_running"
          : (response.analysisStatus ?? "deep_running"),
    },
    {
      lease,
      retryRequired: false,
      retryScheduled: false,
      fenceResult: "none",
      lastTransition: "job_registered",
      lastErrorCode: null,
    },
  );
}

export function clearDeepLease(
  response: ScanResponse,
  transition: string,
  errorCode?: string,
): ScanResponse {
  return stampDeepRuntime(response, {
    lease: undefined,
    retryScheduled: false,
    lastTransition: transition,
    lastErrorCode: errorCode ?? null,
  });
}

export function toDeepRuntimeDiagnostics(
  response: Pick<ScanResponse, "deepAttemptId" | "deepRetryCount" | "deepRuntime" | "deepStartedAt">,
  now = Date.now(),
): DeepRuntimeDiagnostics {
  const lease = response.deepRuntime?.lease;
  return {
    deepGeneration: response.deepAttemptId,
    deepWorkerId: lease?.workerId,
    deepAttempt: response.deepRetryCount,
    deepLeaseState: leaseState(lease, now),
    deepStartedAt: lease?.startedAt ?? response.deepStartedAt,
    deepHeartbeatAt: lease?.heartbeatAt,
    deepExpiresAt: lease?.expiresAt,
    deepRetryRequired: response.deepRuntime?.retryRequired === true,
    deepRetryScheduled: response.deepRuntime?.retryScheduled === true,
    deepLastErrorCode: response.deepRuntime?.lastErrorCode,
    deepLastTransition: response.deepRuntime?.lastTransition,
    deepDeploymentScope: lease?.deploymentScope ?? response.deepRuntime?.deploymentScope,
    deepFenceResult: response.deepRuntime?.fenceResult,
  };
}

function terminalStageForOrphan(
  id: AnalysisStageId,
  response: ScanResponse,
): AnalysisStageState {
  if (id === "liquidity") {
    // Force-LP exhausted → honest unknown (Phase 10C-5 FAILED_TERMINAL shape).
    if (
      response.lpTerminal?.forceRefresh &&
      !mayLpForceRecover(response.lpTerminal)
    ) {
      return "unknown";
    }
    return "partial";
  }
  return "partial";
}

/**
 * Flip sticky analyzing/pending stages to honest terminals.
 * Preserves done / unknown / already-terminal stages.
 */
export function terminalizeOrphanAnalyzingStages(
  response: ScanResponse,
): ScanResponse {
  const prior = response.analysisStages;
  if (!prior) return response;
  const next: AnalysisStages = { ...prior };
  for (const id of ANALYZING_STAGE_IDS) {
    const st = next[id];
    if (st === "analyzing" || st === "pending") {
      next[id] = terminalStageForOrphan(id, response);
    }
  }

  let out: ScanResponse = {
    ...response,
    analysisStatus:
      response.analysisStatus === "deep_running" ||
      response.analysisStatus === "fast_ready"
        ? "partial"
        : (response.analysisStatus ?? "partial"),
    analysisPhase: "fast",
    scoreProvisional: true,
    analysisStages: next,
  };

  if (
    out.lpTerminal?.forceRefresh &&
    !isLpHardTerminal(out.lpTerminal) &&
    !mayLpForceRecover(out.lpTerminal) &&
    next.liquidity === "unknown"
  ) {
    const failed = settleLpFailedTerminal(out.lpTerminal, {
      reason: "recovery_exhausted",
      failedStages: ["liquidity"],
    });
    out = applyLpHardTerminal(
      { ...out, analysisStatus: "failed" },
      failed,
    );
  }

  return clearDeepLease(out, "orphan_terminalized", "orphan_analyzing");
}

/**
 * Recover an orphan analyzing snapshot.
 * - Retry budget remaining → retry_required + deep_running re-arm flags
 * - Exhausted → terminalize stages (never leave analyzing)
 */
export function recoverOrphanAnalyzing(
  response: ScanResponse,
  opts?: { deepInflight?: boolean; now?: number },
): {
  orphan: boolean;
  shouldRetry: boolean;
  response: ScanResponse;
  diagnostics: DeepRuntimeDiagnostics;
} {
  const deepInflight = opts?.deepInflight === true;
  const now = opts?.now ?? Date.now();
  if (
    !isOrphanAnalyzing({
      response,
      deepInflight,
      now,
    })
  ) {
    return {
      orphan: false,
      shouldRetry: false,
      response,
      diagnostics: toDeepRuntimeDiagnostics(response, now),
    };
  }

  const retryBudgetOpen =
    (response.deepRetryCount ?? 0) < MAX_DEEP_AUTO_RETRIES ||
    (isLpForceRefreshActive(response) && mayLpForceRecover(response.lpTerminal));

  // Prefer deep-retry semantics when analysisStatus already terminal-shaped.
  if (retryBudgetOpen && isDeepRetryable({
    ...response,
    analysisStatus:
      response.analysisStatus === "deep_running"
        ? "partial"
        : (response.analysisStatus ?? "partial"),
  })) {
    const flagged = stampDeepRuntime(
      {
        ...response,
        analysisStatus: "partial",
        analysisPhase: "fast",
        scoreProvisional: true,
      },
      {
        lease: undefined,
        retryRequired: true,
        retryScheduled: true,
        lastTransition: "orphan_retry_required",
        lastErrorCode: "orphan_analyzing",
      },
    );
    return {
      orphan: true,
      shouldRetry: true,
      response: flagged,
      diagnostics: toDeepRuntimeDiagnostics(flagged, now),
    };
  }

  // Force-LP still has recovery budget but deepRetry exhausted — still allow recover path.
  if (
    retryBudgetOpen &&
    isLpForceRefreshActive(response) &&
    mayLpForceRecover(response.lpTerminal)
  ) {
    const flagged = stampDeepRuntime(
      {
        ...response,
        analysisStatus: "partial",
        analysisPhase: "fast",
        scoreProvisional: true,
      },
      {
        lease: undefined,
        retryRequired: true,
        retryScheduled: true,
        lastTransition: "orphan_force_lp_retry",
        lastErrorCode: "orphan_analyzing",
      },
    );
    return {
      orphan: true,
      shouldRetry: true,
      response: flagged,
      diagnostics: toDeepRuntimeDiagnostics(flagged, now),
    };
  }

  const terminal = terminalizeOrphanAnalyzingStages(response);
  return {
    orphan: true,
    shouldRetry: false,
    response: terminal,
    diagnostics: toDeepRuntimeDiagnostics(terminal, now),
  };
}

/**
 * After a fence rejection: never leave current gen analyzing with no worker.
 * Auth snapshot wins; mark diagnostics on the rejected writer payload for logs.
 */
export function annotateFenceRejection(
  authoritative: ScanResponse,
  incomingGeneration: string | undefined,
): ScanResponse {
  return stampDeepRuntime(authoritative, {
    fenceResult: "rejected",
    lastTransition: "fence_rejected",
    lastErrorCode: "stale_publish_rejected",
    lastFenceIncomingGeneration: incomingGeneration,
  });
}

export function annotateFenceAccepted(response: ScanResponse): ScanResponse {
  return stampDeepRuntime(response, {
    fenceResult: "accepted",
    lastTransition: response.deepRuntime?.lastTransition ?? "fence_accepted",
  });
}

/**
 * Promise bound for Deep LP/Hook RPC. Detaches on timeout with structured error.
 */
export async function withDeepLpRpcTimeout<T>(
  work: Promise<T>,
  opts?: { timeoutMs?: number; label?: string },
): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? DEEP_LP_RPC_TIMEOUT_MS;
  const label = opts?.label ?? "deep_lp_rpc";
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error(
            `Deep LP RPC timeout after ${timeoutMs}ms (${label})`,
          );
          (err as Error & { code?: string }).code = "deep_lp_rpc_timeout";
          reject(err);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
