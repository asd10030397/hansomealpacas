/**
 * Pure Deep progress / retry helpers — safe for Client Components.
 * Separates collecting/retryable from terminal unavailable.
 * Generation fencing keeps deepRetryCount monotonic and blocks stale writers.
 */
import type {
  AnalysisStageId,
  AnalysisStages,
  AnalysisStageState,
  ScanResponse,
} from "@/lib/hansome-score/types";

/**
 * Auto Deep attempts after the first partial. Each attempt gets a full
 * DEEP_SCAN_MAX_EXECUTION_MS budget. Exhausted → honest terminal unavailable.
 */
export const MAX_DEEP_AUTO_RETRIES = 2;

/** Stages that may still collect useful Deep data when unfinished. */
export const DEEP_RETRYABLE_STAGE_IDS: AnalysisStageId[] = [
  "relationships",
  "liquidity",
  "creator",
  "burn",
  "score",
];

function stageNeedsMoreDeep(st: AnalysisStageState | undefined): boolean {
  return (
    st === "partial" ||
    st === "failed" ||
    st === "analyzing" ||
    st === "pending"
  );
}

/** True when at least one Deep-enrichable stage is still unresolved. */
export function hasRetryableUnresolvedStages(
  response: Pick<ScanResponse, "analysisStages">,
): boolean {
  const stages = response.analysisStages;
  if (!stages) return false;
  for (const id of DEEP_RETRYABLE_STAGE_IDS) {
    if (stageNeedsMoreDeep(stages[id])) return true;
  }
  return false;
}

/**
 * Terminal `partial`/`failed` that may still auto-collect.
 * Budget is `deepRetryCount` (incremented each time a deep attempt settles partial).
 */
export function isDeepRetryable(
  response: Pick<
    ScanResponse,
    "analysisStatus" | "analysisStages" | "deepRetryCount"
  >,
): boolean {
  if (
    response.analysisStatus !== "partial" &&
    response.analysisStatus !== "failed"
  ) {
    return false;
  }
  if (!hasRetryableUnresolvedStages(response)) return false;
  const attempts = response.deepRetryCount ?? 0;
  return attempts < MAX_DEEP_AUTO_RETRIES;
}

/** Deep is actively running, or a retryable partial is waiting to be re-armed. */
export function needsDeepWork(
  response: Pick<
    ScanResponse,
    | "analysisStatus"
    | "analysisPhase"
    | "analysisStages"
    | "deepRetryCount"
    | "scoreProvisional"
  >,
): boolean {
  if (response.analysisStatus === "complete" || response.analysisPhase === "complete") {
    return false;
  }
  if (isDeepRetryable(response)) return true;
  if (
    response.analysisStatus === "partial" ||
    response.analysisStatus === "failed"
  ) {
    return false;
  }
  return (
    response.analysisPhase === "fast" ||
    response.analysisStatus === "fast_ready" ||
    response.analysisStatus === "deep_running" ||
    Boolean(response.scoreProvisional && response.analysisStatus === "fast_ready")
  );
}

/** UI: still collecting (not honest terminal gap). */
export function isDeepCollecting(
  response: Pick<
    ScanResponse,
    | "analysisStatus"
    | "analysisPhase"
    | "analysisStages"
    | "deepRetryCount"
    | "scoreProvisional"
  >,
): boolean {
  if (response.analysisStatus === "complete" || response.analysisPhase === "complete") {
    return false;
  }
  if (isDeepRetryable(response)) return true;
  return (
    response.analysisStatus === "deep_running" ||
    response.analysisStatus === "fast_ready" ||
    (response.analysisPhase === "fast" &&
      response.analysisStatus !== "partial" &&
      response.analysisStatus !== "failed")
  );
}

function nextStageAfterRearm(
  st: AnalysisStageState | undefined,
): AnalysisStageState {
  if (st === "done") return "done";
  if (st === "unknown") return "unknown";
  return "analyzing";
}

/**
 * Phase 10C-3/10C-4: soft-fail / version-budget LP payloads must not stay sticky
 * as liquidity=done for warm reuse (shared KV across candidate tips).
 *
 * Sibling soft-incomplete (e.g. hung v4 Quick) must NOT force-clear a published
 * adapter-verified Locked position — that was the 10C-3 success path.
 */
export function lpEvidenceNeedsFullRefresh(
  response: ScanResponse | null | undefined,
): boolean {
  const lp = response?.overview?.lpIntelligence;
  if (!lp) return false;

  const hasPublishedVerifiedLock =
    !!response?.lpPublish?.lpGeneration &&
    (lp.positions ?? []).some(
      (p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN",
    );
  if (hasPublishedVerifiedLock) {
    // Only force when the published body itself is the sticky timeout shell
    // (no real Locked rows would be present — guarded above).
    return false;
  }

  const detail = `${lp.detail ?? ""} ${lp.completenessWarning ?? ""} ${
    lp.lockDistribution?.reason ?? ""
  }`;
  if (/did not finish in time/i.test(detail)) return true;
  if (/probe budget exceeded/i.test(detail)) return true;
  if (/factory\/index soft-wall/i.test(detail)) return true;
  if (/v4_probe_budget_timeout/i.test((lp.discoverySources ?? []).join(","))) {
    return true;
  }
  // Pre-10C-4 sticky terminal incomplete without publish meta.
  const liq = response?.analysisStages?.liquidity;
  if (
    !response?.lpPublish &&
    (liq === "done" || liq === "partial" || liq === "unknown") &&
    lp.aggregateState === "UNKNOWN_INCOMPLETE"
  ) {
    return true;
  }
  return false;
}

/** Fresh Deep attempt / generation id (opaque; compare by equality only). */
export function newDeepAttemptId(): string {
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Stamp a new Deep generation on a snapshot (re-arm, start, or manual refresh). */
export function assignDeepAttempt(response: ScanResponse): ScanResponse {
  const deepStartedAt = new Date().toISOString();
  const deepProgress = response.deepProgress
    ? {
        ...response.deepProgress,
        stalled: undefined,
        stallReason: undefined,
        updatedAt: deepStartedAt,
      }
    : response.deepProgress;
  return {
    ...response,
    deepAttemptId: newDeepAttemptId(),
    deepStartedAt,
    deepProgress,
  };
}

/**
 * Invalidate the current generation so orphaned workers no-op.
 * Used by stale recovery after fencing a terminal partial.
 */
export function retireDeepAttempt(response: ScanResponse): ScanResponse {
  return {
    ...response,
    deepAttemptId: newDeepAttemptId(),
  };
}

export function isDeepAttemptCurrent(
  authoritative: Pick<ScanResponse, "deepAttemptId"> | null | undefined,
  writerAttemptId: string | undefined,
): boolean {
  if (writerAttemptId == null || writerAttemptId === "") return false;
  const authId = authoritative?.deepAttemptId;
  if (authId == null || authId === "") return true; // legacy bootstrap
  return authId === writerAttemptId;
}

/** deepRetryCount must never regress within a refresh session. */
export function mergeMonotonicDeepRetryCount(
  existing: number | undefined,
  incoming: number | undefined,
): number {
  return Math.max(existing ?? 0, incoming ?? 0);
}

const STAGE_STATE_RANK: Record<AnalysisStageState, number> = {
  pending: 1,
  analyzing: 2,
  failed: 3,
  partial: 3,
  unknown: 4,
  done: 5,
};

function stageStateRank(st: AnalysisStageState | undefined): number {
  if (!st) return 0;
  return STAGE_STATE_RANK[st] ?? 0;
}

/**
 * Within one Deep generation, stage states only move forward.
 * Prevents concurrent same-attempt writers from flipping `done` → `analyzing`/`partial`.
 */
export function preferStageState(
  existing: AnalysisStageState | undefined,
  incoming: AnalysisStageState | undefined,
): AnalysisStageState | undefined {
  if (stageStateRank(incoming) >= stageStateRank(existing)) return incoming ?? existing;
  return existing ?? incoming;
}

export function mergeMonotonicAnalysisStages(
  existing: AnalysisStages | undefined,
  incoming: AnalysisStages | undefined,
): AnalysisStages | undefined {
  if (!incoming) return existing;
  if (!existing) return incoming;
  const ids = Object.keys({ ...existing, ...incoming }) as AnalysisStageId[];
  const out: AnalysisStages = { ...incoming };
  for (const id of ids) {
    const preferred = preferStageState(existing[id], incoming[id]);
    if (preferred != null) out[id] = preferred;
  }
  return out;
}

type FenceAuth = Pick<
  ScanResponse,
  "analysisStatus" | "analysisStages" | "deepAttemptId" | "deepRetryCount"
>;

type FenceIncoming = Pick<ScanResponse, "analysisStatus" | "deepAttemptId">;

/**
 * onProgress may update only the current generation, and must never revive an
 * exhausted terminal partial/failed back into deep_running / collecting.
 */
export function shouldAcceptDeepProgress(
  authoritative: FenceAuth | null | undefined,
  incoming: FenceIncoming,
): boolean {
  if (!isDeepAttemptCurrent(authoritative, incoming.deepAttemptId)) {
    return false;
  }
  if (
    authoritative &&
    (authoritative.analysisStatus === "partial" ||
      authoritative.analysisStatus === "failed") &&
    !isDeepRetryable(authoritative) &&
    (incoming.analysisStatus === "deep_running" ||
      incoming.analysisStatus === "fast_ready")
  ) {
    return false;
  }
  return true;
}

/** Settle writes require a current (or bootstrap) generation id. */
export function shouldAcceptDeepSettle(
  authoritative: Pick<ScanResponse, "deepAttemptId"> | null | undefined,
  incoming: Pick<ScanResponse, "deepAttemptId">,
): boolean {
  return isDeepAttemptCurrent(authoritative, incoming.deepAttemptId);
}

/**
 * Re-arm a settled partial so Deep can continue incomplete stages.
 * Preserves `done` stages; flips retryable gaps back to `analyzing`.
 * Assigns a new deepAttemptId generation.
 * Phase 10C-4: force-LP path clears stale LP evidence bodies (not stage flags only).
 */
export function rearmPartialForDeepRetry(response: ScanResponse): ScanResponse {
  const prior = response.analysisStages;
  const forceLp = lpEvidenceNeedsFullRefresh(response);
  const nextStages: AnalysisStages = {
    contract: prior?.contract === "done" ? "done" : (prior?.contract ?? "done"),
    holders: prior?.holders === "done" ? "done" : (prior?.holders ?? "done"),
    market: prior?.market === "done" ? "done" : (prior?.market ?? "done"),
    burn: nextStageAfterRearm(prior?.burn),
    liquidity: forceLp ? "analyzing" : nextStageAfterRearm(prior?.liquidity),
    creator: nextStageAfterRearm(prior?.creator),
    relationships: nextStageAfterRearm(prior?.relationships),
    score: forceLp ? "analyzing" : nextStageAfterRearm(prior?.score),
  };

  const base = forceLp
    ? // Lazy import avoided — clear via local helper to keep scan-progress free of KV.
      clearStaleLpEvidenceLocal(response)
    : response;

  return assignDeepAttempt({
    ...base,
    analysisPhase: "fast",
    analysisStatus: "deep_running",
    scoreProvisional: true,
    analysisStages: nextStages,
  });
}

/** Local clear (mirrors lp-result-publish.clearStaleLpEvidence; no KV). */
function clearStaleLpEvidenceLocal(response: ScanResponse): ScanResponse {
  const overview = response.overview;
  if (!overview?.lpIntelligence) {
    return { ...response, lpPublish: undefined };
  }
  return {
    ...response,
    lpPublish: undefined,
    overview: {
      ...overview,
      poolId: null,
      lpLockStatus: "unknown",
      lpLockDetail: null,
      lpIntelligence: {
        ...overview.lpIntelligence,
        poolId: null,
        positions: [],
        discoveryComplete: false,
        knownPositionsVerified: false,
        exhaustiveDiscoveryComplete: false,
        discoverySources: [],
        aggregateLockState: "UNABLE_TO_DETERMINE",
        aggregateState: "UNKNOWN_INCOMPLETE",
        positionCounts: {
          detected: 0,
          material: 0,
          locked: 0,
          unlocked: 0,
          unknown: 0,
        },
        lockDistribution: {
          ...overview.lpIntelligence.lockDistribution,
          available: false,
          reason: "LP evidence cleared for full refresh",
          method: null,
          lockedPct: null,
          unlockedPct: null,
          unknownPct: null,
          lockedUsd: null,
          unlockedUsd: null,
          unknownUsd: null,
          totalPositionUsd: null,
          poolLiquidityUsd: null,
          reconciledWithPool: false,
        },
        completenessWarning:
          "Prior LP evidence invalidated — multi-version discovery re-armed.",
        detail: "LP evidence cleared — awaiting fresh multi-version discovery.",
        evidenceLevel: "unavailable",
      },
    },
  };
}

/** Call when a deep attempt settles as partial/failed. */
export function bumpDeepRetryCount(response: ScanResponse): ScanResponse {
  return {
    ...response,
    deepRetryCount: (response.deepRetryCount ?? 0) + 1,
  };
}

/**
 * Pick the deeper Deep-session snapshot across memory vs KV (multi-instance).
 * Higher deepRetryCount wins; exhausted terminal beats collecting at equal count.
 */
export function preferAuthoritativeDeepResponse(
  a: ScanResponse | null | undefined,
  b: ScanResponse | null | undefined,
): ScanResponse | null {
  if (!a) return b ?? null;
  if (!b) return a;
  const ra = a.deepRetryCount ?? 0;
  const rb = b.deepRetryCount ?? 0;
  if (rb !== ra) return rb > ra ? b : a;

  const aExhausted =
    (a.analysisStatus === "partial" || a.analysisStatus === "failed") &&
    !isDeepRetryable(a);
  const bExhausted =
    (b.analysisStatus === "partial" || b.analysisStatus === "failed") &&
    !isDeepRetryable(b);
  if (aExhausted !== bExhausted) return aExhausted ? a : b;

  const aCollecting =
    a.analysisStatus === "deep_running" || a.analysisStatus === "fast_ready";
  const bCollecting =
    b.analysisStatus === "deep_running" || b.analysisStatus === "fast_ready";
  // Prefer non-collecting terminal/complete when retry ties.
  if (aCollecting !== bCollecting) return aCollecting ? b : a;

  const ta = Date.parse(a.deepStartedAt ?? a.scannedAt ?? "") || 0;
  const tb = Date.parse(b.deepStartedAt ?? b.scannedAt ?? "") || 0;
  if (tb !== ta) return tb > ta ? b : a;
  return a;
}

/**
 * Unfenced writers (re-arm / start) must not overwrite a stronger authoritative
 * Deep snapshot from another isolate (stale memory vs fresher KV).
 */
export function shouldRejectUnfencedDeepWrite(
  authoritative: FenceAuth | null | undefined,
  incoming: Pick<
    ScanResponse,
    "analysisStatus" | "deepAttemptId" | "deepRetryCount"
  >,
): boolean {
  if (!authoritative) return false;
  const mergedRetry = mergeMonotonicDeepRetryCount(
    authoritative.deepRetryCount,
    incoming.deepRetryCount,
  );
  const authAtMerged = { ...authoritative, deepRetryCount: mergedRetry };
  if (
    (authoritative.analysisStatus === "partial" ||
      authoritative.analysisStatus === "failed") &&
    !isDeepRetryable(authAtMerged) &&
    (incoming.analysisStatus === "deep_running" ||
      incoming.analysisStatus === "fast_ready")
  ) {
    return true;
  }
  if (
    (incoming.deepRetryCount ?? 0) < (authoritative.deepRetryCount ?? 0) &&
    (incoming.analysisStatus === "deep_running" ||
      incoming.analysisStatus === "fast_ready")
  ) {
    return true;
  }
  return false;
}

