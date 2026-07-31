/**
 * Honest Deep Analysis workflow progress — pure helpers (Client-safe).
 *
 * Progress = how far the scan workflow has advanced (work completed).
 * Coverage = confidence.percent (reliable data obtained). Never merge them.
 *
 * Does not change scoring, LP/burn/lock semantics, fencing, or orchestration.
 */

import {
  asymptoticInternalProgress,
  resolveDeepPipelineFocus,
  type DeepProgressMeta,
} from "@/lib/hansome-score/deep-progress";
import {
  isDeepCollecting,
  isDeepRetryable,
} from "@/lib/hansome-score/scan-progress";
import type {
  AnalysisStageId,
  AnalysisStageState,
  ScanResponse,
} from "@/lib/hansome-score/types";

/** Modules that exist in the current result / stage model (excludes market/score). */
export type AnalysisModuleKey =
  | "structural"
  | "holders"
  | "liquidity"
  | "burn"
  | "creator"
  | "relationships";

export type AnalysisModuleStatus =
  | "idle"
  | "queued"
  | "analyzing"
  | "retrying"
  | "done"
  | "unavailable";

export type AnalysisProgressMessageKey =
  | "progressWaiting"
  | "progressCollecting"
  | "progressAnalyzingContract"
  | "progressCollectingLiquidity"
  | "progressAnalyzingLpLocks"
  | "progressScanningHolders"
  | "progressScanningBurn"
  | "progressScanningCreator"
  | "progressTracingWallets"
  | "progressRetrying"
  | "progressComplete"
  | "progressUnavailable";

export type AnalysisModuleProgress = {
  key: AnalysisModuleKey;
  status: AnalysisModuleStatus;
  /** Honest 0–100 workflow progress for this module (not coverage). */
  progress: number;
  completedUnits?: number;
  totalUnits?: number;
  messageKey: AnalysisProgressMessageKey;
  /** Workflow finished for this module (done or terminal unavailable). */
  resolved: boolean;
  /** True only when the module finished with usable complete data. */
  dataComplete: boolean;
  /** Age of last durable deepProgress publish (ms), when known. */
  lastUpdateAgeMs?: number | null;
  stalled?: boolean;
};

export type AnalysisWorkflowStatus =
  | "collecting"
  | "retrying"
  | "complete"
  | "unavailable";

export type AnalysisWorkflowProgress = {
  modules: AnalysisModuleProgress[];
  /** Weighted workflow progress 0–100. Separate from analysis coverage. */
  overallProgress: number;
  completedModules: number;
  totalModules: number;
  activeModuleKey: AnalysisModuleKey | null;
  workflowStatus: AnalysisWorkflowStatus;
  deepAttemptId?: string;
  /** Pass-through of confidence.percent — never used as progress. */
  analysisCoveragePercent: number | null;
};

/** Suggested weights (sum = 100). */
export const MODULE_WEIGHTS: Record<AnalysisModuleKey, number> = {
  structural: 15,
  holders: 15,
  liquidity: 25,
  burn: 15,
  creator: 20,
  relationships: 10,
};

export const ANALYSIS_MODULE_KEYS: AnalysisModuleKey[] = [
  "structural",
  "holders",
  "liquidity",
  "burn",
  "creator",
  "relationships",
];

/** Matches enrichScanDeep / scanToken default transfer page cap. */
export const DEFAULT_TRANSFER_PAGE_TARGET = 40;

const MODULE_TO_STAGE: Record<AnalysisModuleKey, AnalysisStageId> = {
  structural: "contract",
  holders: "holders",
  liquidity: "liquidity",
  burn: "burn",
  creator: "creator",
  relationships: "relationships",
};

/** Active-stage preference follows Deep orchestration order. */
const ACTIVE_PRIORITY: AnalysisModuleKey[] = [
  "relationships",
  "liquidity",
  "burn",
  "creator",
  "holders",
  "structural",
];

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function stageOf(
  snapshot: Pick<ScanResponse, "analysisStages">,
  key: AnalysisModuleKey,
): AnalysisStageState | undefined {
  return snapshot.analysisStages?.[MODULE_TO_STAGE[key]];
}

function pageProgress(pages: number, target: number): {
  progress: number;
  completedUnits: number;
  totalUnits: number;
} {
  const totalUnits = Math.max(1, target);
  const completedUnits = Math.max(0, pages);
  const ratio = Math.min(1, completedUnits / totalUnits);
  // First page evidence lands at 25; approaches 90 while incomplete.
  const progress = completedUnits <= 0 ? 10 : clampPct(25 + ratio * 65);
  return { progress, completedUnits, totalUnits };
}

function hasRelationshipEvidence(
  snapshot: Pick<ScanResponse, "overview">,
): boolean {
  const r = snapshot.overview?.relationship;
  if (!r) return false;
  return (
    r.equalBalanceClusterSize > 0 ||
    r.sharedFundingCount > 0 ||
    r.deployerFundedCount > 0 ||
    r.sameBlockEarlyBuyCount > 0
  );
}

function hasLiquidityEvidence(
  snapshot: Pick<ScanResponse, "overview">,
): boolean {
  const lp = snapshot.overview?.lpIntelligence;
  if (!lp) return false;
  return (
    lp.poolDetected ||
    lp.poolsDetectedCount > 0 ||
    (lp.positions?.length ?? 0) > 0 ||
    Boolean(lp.knownPositionsVerified) ||
    Boolean(lp.lockDistribution?.available)
  );
}

function hasBurnEvidence(snapshot: Pick<ScanResponse, "overview">): boolean {
  const sb = snapshot.overview?.supplyBurn;
  if (!sb) return false;
  const pages = sb.burnActivity?.pagesFetched ?? 0;
  const transfers = sb.burnActivity?.transfersIndexed ?? 0;
  // P0/P1 (mechanism flags) always exist after Fast — count only transfer-index work.
  return pages > 0 || transfers > 0 || Boolean(sb.burnActivity?.headIndexed);
}

function hasCreatorEvidence(snapshot: Pick<ScanResponse, "overview">): boolean {
  const cb = snapshot.overview?.creatorBehaviour;
  if (!cb) return false;
  return (
    (cb.pagesFetched ?? 0) > 0 ||
    (cb.transfersIndexed ?? 0) > 0 ||
    cb.status === "indexed" ||
    cb.available
  );
}

function hasHolderEvidence(snapshot: Pick<ScanResponse, "overview">): boolean {
  const ov = snapshot.overview;
  if (!ov) return false;
  return (
    (ov.topHolders?.length ?? 0) > 0 ||
    ov.holdersCount != null ||
    ov.concentration != null
  );
}

function hasStructuralEvidence(
  snapshot: Pick<ScanResponse, "overview">,
): boolean {
  const ov = snapshot.overview;
  if (!ov) return false;
  return ov.contractRisk != null || ov.contractVerified != null;
}

/**
 * Coarse stage → progress when finer work units are unavailable.
 * Caps below 100 until truly done.
 */
export function coarseStageProgress(
  stage: AnalysisStageState | undefined,
  opts: {
    hasEvidence: boolean;
    meaningfulPartial?: boolean;
    collecting: boolean;
  },
): number {
  const { hasEvidence, meaningfulPartial = false, collecting } = opts;
  if (stage === "done") return 100;
  if (stage === "pending" || stage == null) return collecting ? 5 : 0;
  if (stage === "analyzing") {
    if (meaningfulPartial) return 55;
    if (hasEvidence) return 25;
    return 10;
  }
  if (stage === "partial" || stage === "failed" || stage === "unknown") {
    if (meaningfulPartial) return 60;
    if (hasEvidence) return 40;
    // Exhausted with no evidence — keep low; UI shows unavailable (not 100%).
    return collecting ? 25 : 15;
  }
  return 0;
}

function liquidityWorkProgress(
  snapshot: Pick<ScanResponse, "overview" | "deepProgress">,
  stage: AnalysisStageState | undefined,
  collecting: boolean,
  opts?: { queued?: boolean },
): { progress: number; completedUnits?: number; totalUnits?: number } {
  if (opts?.queued) {
    return { progress: collecting ? 3 : 0 };
  }

  const lp = snapshot.overview?.lpIntelligence;
  const dp = snapshot.deepProgress;
  if (!lp) {
    // Probe units from durable deepProgress when LP body not yet published.
    if (
      dp?.stage === "liquidity" &&
      dp.completedUnits != null &&
      dp.totalUnits != null &&
      dp.totalUnits > 0
    ) {
      const ratio = Math.min(1, dp.completedUnits / dp.totalUnits);
      return {
        progress: clampPct(8 + ratio * 50),
        completedUnits: dp.completedUnits,
        totalUnits: dp.totalUnits,
      };
    }
    return {
      progress: coarseStageProgress(stage, {
        hasEvidence: false,
        collecting,
      }),
    };
  }

  if (stage === "done") return { progress: 100 };

  const detected = Math.max(
    lp.positionCounts?.detected ?? 0,
    lp.positions?.length ?? 0,
    lp.poolsDetectedCount ?? 0,
  );
  const material = lp.positionCounts?.material ?? 0;
  const known = Boolean(lp.knownPositionsVerified);
  const lockReady = Boolean(
    lp.lockDistribution?.available && lp.lockDistribution.lockedUsd != null,
  );
  const discoveryDone = Boolean(lp.discoveryComplete);
  const exhaustive = Boolean(lp.exhaustiveDiscoveryComplete);

  let progress = coarseStageProgress(stage, {
    hasEvidence: hasLiquidityEvidence(snapshot),
    meaningfulPartial: known || lockReady || material > 0,
    collecting,
  });

  // Probe / Quick LP milestones from deepProgress (gradual — not full weight on start).
  if (dp?.stage === "liquidity" && (dp.completedUnits ?? 0) > 0) {
    const probes = dp.totalUnits && dp.totalUnits > 0 ? dp.totalUnits : 6;
    const ratio = Math.min(1, (dp.completedUnits ?? 0) / probes);
    const quickish =
      typeof dp.action === "string" &&
      (dp.action.startsWith("quick_") || dp.action === "known_positions");
    // Quick LP advances toward ~55; never a static stage weight jump to 100.
    progress = Math.max(
      progress,
      clampPct(quickish ? 10 + ratio * 45 : 12 + ratio * 28),
    );
  }

  if (detected > 0) progress = Math.max(progress, 25);
  if (known) progress = Math.max(progress, 45);
  if (lockReady) progress = Math.max(progress, 55);
  if (material > 0 && detected > 0) {
    const ratio = Math.min(1, material / Math.max(detected, material));
    progress = Math.max(progress, clampPct(40 + ratio * 30));
  }
  if (discoveryDone) progress = Math.max(progress, 80);
  if (exhaustive) progress = Math.max(progress, 90);

  // Cap 95% until final LP validation (stage === done returns 100 above).
  progress = Math.min(progress, 95);

  return {
    progress,
    completedUnits:
      dp?.completedUnits ??
      (material > 0 ? material : detected > 0 ? detected : undefined),
    totalUnits:
      dp?.totalUnits ??
      (detected > 0 ? detected : material > 0 ? material : undefined),
  };
}

function burnWorkProgress(
  snapshot: Pick<ScanResponse, "overview" | "deepProgress">,
  stage: AnalysisStageState | undefined,
  collecting: boolean,
  opts?: { queued?: boolean },
): { progress: number; completedUnits?: number; totalUnits?: number } {
  if (opts?.queued) {
    // Fast P0/P1 may leave burn=partial — do not show static 25% while queued.
    return { progress: collecting ? 5 : 0 };
  }

  const burn = snapshot.overview?.supplyBurn?.burnActivity;
  const pages = Math.max(
    burn?.pagesFetched ?? 0,
    snapshot.deepProgress?.pagesFetched ?? 0,
  );
  const complete = Boolean(burn?.paginationComplete);

  if (stage === "done") {
    return {
      progress: 100,
      completedUnits: pages,
      totalUnits: DEFAULT_TRANSFER_PAGE_TARGET,
    };
  }
  if (complete) {
    return {
      progress: 95,
      completedUnits: pages,
      totalUnits: DEFAULT_TRANSFER_PAGE_TARGET,
    };
  }

  // Fast leaves burn=partial after P0/P1 — modest band until pages arrive.
  if (stage === "partial" && pages <= 0) {
    return {
      progress: collecting ? 12 : coarseStageProgress(stage, {
        hasEvidence: hasBurnEvidence(snapshot),
        collecting,
      }),
    };
  }

  if (pages > 0) {
    const p = pageProgress(pages, DEFAULT_TRANSFER_PAGE_TARGET);
    return {
      progress: Math.min(p.progress, 95),
      completedUnits: p.completedUnits,
      totalUnits: p.totalUnits,
    };
  }

  return {
    progress: coarseStageProgress(stage, {
      hasEvidence: hasBurnEvidence(snapshot),
      collecting,
    }),
  };
}

function creatorWorkProgress(
  snapshot: Pick<ScanResponse, "overview" | "deepProgress">,
  stage: AnalysisStageState | undefined,
  collecting: boolean,
  opts?: { queued?: boolean },
): { progress: number; completedUnits?: number; totalUnits?: number } {
  if (opts?.queued) {
    return { progress: collecting ? 3 : 0 };
  }

  const cb = snapshot.overview?.creatorBehaviour;
  const pages = Math.max(
    cb?.pagesFetched ?? 0,
    snapshot.deepProgress?.pagesFetched ?? 0,
  );
  const complete = Boolean(cb?.paginationComplete) || cb?.status === "indexed";

  if (stage === "done") {
    return {
      progress: 100,
      completedUnits: pages,
      totalUnits: DEFAULT_TRANSFER_PAGE_TARGET,
    };
  }

  if (complete) {
    return {
      progress: 95,
      completedUnits: pages,
      totalUnits: DEFAULT_TRANSFER_PAGE_TARGET,
    };
  }

  if (pages > 0) {
    const p = pageProgress(pages, DEFAULT_TRANSFER_PAGE_TARGET);
    return {
      progress: Math.min(p.progress, 95),
      completedUnits: p.completedUnits,
      totalUnits: p.totalUnits,
    };
  }

  // Active creatorBurn with 0 pages yet — asymptotic start, not stuck 10 forever.
  if (
    collecting &&
    stage === "analyzing" &&
    snapshot.deepProgress?.stage === "creatorBurn"
  ) {
    return {
      progress: asymptoticInternalProgress(
        snapshot.deepProgress.completedUnits ?? 0,
        { startPct: 3, halfLifeUnits: 3 },
      ),
      completedUnits: snapshot.deepProgress.completedUnits,
      totalUnits: snapshot.deepProgress.totalUnits,
    };
  }

  return {
    progress: coarseStageProgress(stage, {
      hasEvidence: hasCreatorEvidence(snapshot),
      collecting,
    }),
  };
}

function relationshipsWorkProgress(
  snapshot: Pick<ScanResponse, "overview" | "deepProgress">,
  stage: AnalysisStageState | undefined,
  collecting: boolean,
  opts?: { queued?: boolean },
): { progress: number; completedUnits?: number; totalUnits?: number } {
  if (opts?.queued) {
    return { progress: collecting ? 3 : 0 };
  }
  if (stage === "done") return { progress: 100 };

  const dp = snapshot.deepProgress;
  if (
    dp?.stage === "relationships" &&
    dp.completedUnits != null &&
    dp.totalUnits != null &&
    dp.totalUnits > 0
  ) {
    const ratio = Math.min(1, dp.completedUnits / dp.totalUnits);
    return {
      progress: Math.min(95, clampPct(10 + ratio * 80)),
      completedUnits: dp.completedUnits,
      totalUnits: dp.totalUnits,
    };
  }

  return {
    progress: coarseStageProgress(stage, {
      hasEvidence: hasRelationshipEvidence(snapshot),
      meaningfulPartial: hasRelationshipEvidence(snapshot),
      collecting,
    }),
  };
}

function moduleMessageKey(
  key: AnalysisModuleKey,
  status: AnalysisModuleStatus,
  snapshot: Pick<ScanResponse, "overview">,
): AnalysisProgressMessageKey {
  if (status === "done") return "progressComplete";
  if (status === "unavailable") return "progressUnavailable";
  if (status === "idle") return "progressWaiting";
  if (status === "queued") return "progressWaiting";
  if (status === "retrying") return "progressRetrying";

  switch (key) {
    case "structural":
      return "progressAnalyzingContract";
    case "holders":
      return "progressScanningHolders";
    case "liquidity": {
      const lp = snapshot.overview?.lpIntelligence;
      if (lp?.knownPositionsVerified || lp?.lockDistribution?.available) {
        return "progressAnalyzingLpLocks";
      }
      return "progressCollectingLiquidity";
    }
    case "burn":
      return "progressScanningBurn";
    case "creator":
      return "progressScanningCreator";
    case "relationships":
      return "progressTracingWallets";
  }
}

/**
 * Derive one module's honest workflow progress from a scan snapshot.
 */
/**
 * Phase 6 parallel Deep: Relationships / Liquidity / CreatorBurn run concurrently.
 * Only Score waits on the wave — modules are never force-queued behind each other.
 * (`focus` retained for call-site compatibility.)
 */
function moduleQueuedBehindPipeline(
  _key: AnalysisModuleKey,
  _focus: ReturnType<typeof resolveDeepPipelineFocus>,
  stage: AnalysisStageState | undefined,
): boolean {
  if (stage === "done") return false;
  return false;
}

export function deriveModuleProgress(
  snapshot: Pick<
    ScanResponse,
    | "analysisStages"
    | "analysisStatus"
    | "analysisPhase"
    | "deepRetryCount"
    | "scoreProvisional"
    | "overview"
    | "deepAttemptId"
    | "deepProgress"
    | "deepStartedAt"
  >,
  key: AnalysisModuleKey,
  previous?: AnalysisModuleProgress | null,
): AnalysisModuleProgress {
  const stage = stageOf(snapshot, key);
  const collecting = isDeepCollecting(snapshot);
  const retryable = isDeepRetryable(snapshot);
  const retryingSession =
    collecting && (retryable || (snapshot.deepRetryCount ?? 0) > 0);
  const focus = resolveDeepPipelineFocus(
    snapshot.analysisStages,
    snapshot.deepProgress as DeepProgressMeta | undefined,
  );
  const queued =
    collecting && moduleQueuedBehindPipeline(key, focus, stage);

  let work: { progress: number; completedUnits?: number; totalUnits?: number };
  switch (key) {
    case "liquidity":
      work = liquidityWorkProgress(snapshot, stage, collecting, { queued });
      break;
    case "burn":
      work = burnWorkProgress(snapshot, stage, collecting, { queued });
      break;
    case "creator":
      work = creatorWorkProgress(snapshot, stage, collecting, { queued });
      break;
    case "relationships":
      work = relationshipsWorkProgress(snapshot, stage, collecting, {
        queued: false,
      });
      break;
    case "holders":
      work = {
        progress: coarseStageProgress(stage, {
          hasEvidence: hasHolderEvidence(snapshot),
          meaningfulPartial: (snapshot.overview?.topHolders?.length ?? 0) > 0,
          collecting,
        }),
      };
      break;
    case "structural":
      work = {
        progress: coarseStageProgress(stage, {
          hasEvidence: hasStructuralEvidence(snapshot),
          meaningfulPartial: snapshot.overview?.contractRisk != null,
          collecting,
        }),
      };
      break;
  }

  let status: AnalysisModuleStatus;
  let resolved = false;
  let dataComplete = false;

  if (stage === "done") {
    status = "done";
    resolved = true;
    dataComplete = true;
    work = { ...work, progress: 100 };
  } else if (queued) {
    status = "queued";
  } else if (stage === "analyzing") {
    status = retryingSession && (snapshot.deepRetryCount ?? 0) > 0
      ? "retrying"
      : "analyzing";
  } else if (stage === "pending" || stage == null) {
    status = collecting ? "queued" : "idle";
    if (!collecting && stage == null) {
      // Legacy complete snapshots without stages → treat Fast-done modules as done.
      if (key === "structural" || key === "holders") {
        status = "done";
        resolved = true;
        dataComplete = true;
        work = { ...work, progress: 100 };
      }
    }
  } else if (stage === "partial" || stage === "failed" || stage === "unknown") {
    if (collecting) {
      // Retryable / still collecting — never show Unknown/Unavailable.
      status =
        retryingSession && (snapshot.deepRetryCount ?? 0) > 0
          ? "retrying"
          : queued
            ? "queued"
            : "analyzing";
    } else {
      status = "unavailable";
      resolved = true;
      dataComplete = false;
      // Preserve last honest %; never inflate to 100 with no complete data.
      if (work.progress >= 100) work = { ...work, progress: 95 };
      const evidenceForKey =
        key === "burn"
          ? hasBurnEvidence(snapshot)
          : key === "creator"
            ? hasCreatorEvidence(snapshot)
            : key === "liquidity"
              ? hasLiquidityEvidence(snapshot)
              : key === "relationships"
                ? hasRelationshipEvidence(snapshot)
                : key === "holders"
                  ? hasHolderEvidence(snapshot)
                  : hasStructuralEvidence(snapshot);
      if (!evidenceForKey) {
        // No usable evidence — show unavailable, not 100%.
        work = { ...work, progress: Math.min(work.progress, 15) };
      }
    }
  } else {
    status = "idle";
  }

  // Monotonic within same deepAttemptId: never visibly decrease.
  let progress = clampPct(work.progress);
  if (
    previous &&
    previous.progress > progress &&
    (previous.key === key)
  ) {
    // Caller may pass previous for same attempt; applyMonotonicProgress also clamps.
    progress = previous.progress;
  }

  const updatedAt =
    snapshot.deepProgress?.updatedAt ?? snapshot.deepStartedAt ?? null;
  const lastUpdateAgeMs =
    updatedAt && Number.isFinite(Date.parse(updatedAt))
      ? Math.max(0, Date.now() - Date.parse(updatedAt))
      : null;

  return {
    key,
    status,
    progress,
    completedUnits: work.completedUnits,
    totalUnits: work.totalUnits,
    messageKey: queued
      ? "progressWaiting"
      : moduleMessageKey(key, status, snapshot),
    resolved,
    dataComplete,
    lastUpdateAgeMs,
    stalled: Boolean(snapshot.deepProgress?.stalled),
  };
}

export function calculateOverallWorkflowProgress(
  modules: AnalysisModuleProgress[],
): number {
  if (modules.length === 0) return 0;
  let weighted = 0;
  let weightSum = 0;
  for (const m of modules) {
    const w = MODULE_WEIGHTS[m.key] ?? 0;
    weighted += m.progress * w;
    weightSum += w;
  }
  const raw = weightSum <= 0 ? 0 : weighted / weightSum;
  const allResolved = modules.every((m) => m.resolved);
  if (allResolved) return 100;
  // Cap below 100 until every module is workflow-resolved.
  return Math.min(99, clampPct(raw));
}

function workflowStatusOf(
  snapshot: Pick<
    ScanResponse,
    | "analysisStatus"
    | "analysisPhase"
    | "analysisStages"
    | "deepRetryCount"
    | "scoreProvisional"
  >,
  modules: AnalysisModuleProgress[],
): AnalysisWorkflowStatus {
  const allResolved = modules.every((m) => m.resolved);
  const anyUnavailable = modules.some((m) => m.status === "unavailable");
  if (allResolved) {
    return anyUnavailable ? "unavailable" : "complete";
  }
  if (
    isDeepCollecting(snapshot) &&
    ((snapshot.deepRetryCount ?? 0) > 0 || isDeepRetryable(snapshot))
  ) {
    return "retrying";
  }
  if (isDeepCollecting(snapshot)) return "collecting";
  if (anyUnavailable) return "unavailable";
  return "collecting";
}

/**
 * Derive full workflow progress snapshot. Coverage is attached but unused for %.
 */
export function deriveAnalysisProgress(
  snapshot: Pick<
    ScanResponse,
    | "analysisStages"
    | "analysisStatus"
    | "analysisPhase"
    | "deepRetryCount"
    | "scoreProvisional"
    | "overview"
    | "deepAttemptId"
    | "deepProgress"
    | "deepStartedAt"
    | "confidence"
  >,
  previous?: AnalysisWorkflowProgress | null,
): AnalysisWorkflowProgress {
  const prevByKey = new Map(
    (previous?.modules ?? []).map((m) => [m.key, m] as const),
  );
  const sameAttempt =
    previous != null &&
    previous.deepAttemptId != null &&
    snapshot.deepAttemptId != null &&
    previous.deepAttemptId === snapshot.deepAttemptId;

  const modules = ANALYSIS_MODULE_KEYS.map((key) =>
    deriveModuleProgress(
      snapshot,
      key,
      sameAttempt ? prevByKey.get(key) : null,
    ),
  );

  const monotonicModules = sameAttempt
    ? modules.map((m) => {
        const prev = prevByKey.get(m.key);
        if (!prev) return m;
        if (prev.progress > m.progress) {
          return { ...m, progress: prev.progress };
        }
        return m;
      })
    : modules;

  let overallProgress = calculateOverallWorkflowProgress(monotonicModules);
  if (sameAttempt && previous && previous.overallProgress > overallProgress) {
    overallProgress = previous.overallProgress;
  }

  const completedModules = monotonicModules.filter((m) => m.resolved).length;
  const activeModuleKey =
    ACTIVE_PRIORITY.find((k) => {
      const m = monotonicModules.find((x) => x.key === k);
      return m?.status === "analyzing" || m?.status === "retrying";
    }) ?? null;

  return {
    modules: monotonicModules,
    overallProgress,
    completedModules,
    totalModules: ANALYSIS_MODULE_KEYS.length,
    activeModuleKey,
    workflowStatus: workflowStatusOf(snapshot, monotonicModules),
    deepAttemptId: snapshot.deepAttemptId,
    analysisCoveragePercent:
      snapshot.confidence?.percent != null
        ? snapshot.confidence.percent
        : null,
  };
}

/**
 * Apply monotonic clamp across a new derivation vs prior UI state.
 * Resets only when deepAttemptId changes (new generation / manual refresh).
 */
export function applyMonotonicProgress(
  previous: AnalysisWorkflowProgress | null | undefined,
  next: AnalysisWorkflowProgress,
): AnalysisWorkflowProgress {
  if (!previous) return next;
  if (
    previous.deepAttemptId != null &&
    next.deepAttemptId != null &&
    previous.deepAttemptId !== next.deepAttemptId
  ) {
    return next;
  }

  const prevByKey = new Map(previous.modules.map((m) => [m.key, m]));
  const modules = next.modules.map((m) => {
    const p = prevByKey.get(m.key);
    if (p && p.progress > m.progress) return { ...m, progress: p.progress };
    return m;
  });
  let overall = calculateOverallWorkflowProgress(modules);
  if (previous.overallProgress > overall) overall = previous.overallProgress;
  return { ...next, modules, overallProgress: overall };
}

/**
 * Stale-generation guard for UI: ignore incoming progress from a different attempt
 * when the current attempt is already farther along.
 */
export function shouldAcceptProgressUpdate(
  current: AnalysisWorkflowProgress | null | undefined,
  incoming: AnalysisWorkflowProgress,
): boolean {
  if (!current) return true;
  if (
    current.deepAttemptId != null &&
    incoming.deepAttemptId != null &&
    current.deepAttemptId !== incoming.deepAttemptId
  ) {
    // Newer generation (manual refresh) always wins; older generation never regresses.
    // Without timestamps, accept only if current is fully resolved and incoming is a fresh start,
    // or if incoming has no overlap — prefer keeping current when it is actively collecting
    // and incoming overall is lower with a different id (stale).
    if (
      current.workflowStatus === "collecting" ||
      current.workflowStatus === "retrying"
    ) {
      if (incoming.overallProgress < current.overallProgress) return false;
    }
  }
  return true;
}
