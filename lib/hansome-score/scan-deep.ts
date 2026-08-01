/**
 * Progressive Deep Analysis — enrich a Fast Scan snapshot stage-by-stage.
 * Persists progress so UI can show Contract/Holders/Market ✓ while LP/creator run.
 * Hard deadline prevents indefinite deep_running after Vercel after() termination.
 */
import { getAddress } from "viem";
import { computeActivity } from "@/lib/hansome-score/activity";
import {
  fetchEarlyTokenTransfers,
  fetchNativeFunder,
} from "@/lib/hansome-score/blockscout";
import {
  fetchTokenTransfersWithCheckpoint,
  loadEarlyTransfersFromIndex,
  loadTransferIndexProgress,
  peekTransferIndexValidation,
  scheduleTransferIndexBackgroundRefresh,
} from "@/lib/hansome-score/transfer-index";
import { computeConfidence } from "@/lib/hansome-score/confidence";
import {
  HANSOME_POOL_ID,
  HANSOME_TOKEN,
  SCAN_CHAIN_ID,
} from "@/lib/hansome-score/constants";
import {
  loadLpDiscoveryCheckpoint,
  scheduleLpExhaustiveBackground,
} from "@/lib/hansome-score/lp/discovery-checkpoint";
import { loadLpDiscoveryCache } from "@/lib/hansome-score/lp/position-cache";
import {
  buildKnownFirstEvidence,
  createAttemptLpRequestMemo,
  isKnownFirstSelectiveRevalidate,
  isKnownFirstStructuralReuse,
  knownFirstEvidenceSufficient,
  knownFirstProgressUnits,
  planKnownFirstLpEarlyExit,
  type KnownFirstEarlyExitPlan,
} from "@/lib/hansome-score/lp/known-first-early-exit";
import {
  bootstrapPackToDiscoverySources,
  KNOWN_HOOK_EARLY_BUDGET_MS,
  KNOWN_PONS_EARLY_BUDGET_MS,
  KNOWN_TITAN_EARLY_BUDGET_MS,
  preferVerifiedLpAgainstIncomplete,
  resolveKnownBootstrap,
  staticKnownBootstrapSeeds,
  tryVerifyKnownHookBootstrap,
  tryVerifyKnownPonsBootstrap,
  tryVerifyKnownTitanBootstrap,
  type KnownBootstrapPack,
} from "@/lib/hansome-score/lp/known-bootstrap-resolver";
import {
  ADAPTIVE_LIQUIDITY_BUDGET,
  computeAdaptiveHardBoundMs,
} from "@/lib/hansome-score/lp/adaptive-discovery-budget";
import { persistSnapshotFromLpPublish } from "@/lib/hansome-score/lp/lp-persistent-snapshot";
import { loadPriorLpForForceDeep } from "@/lib/hansome-score/lp/force-lp-recovery";
import {
  buildSmartLpEvidence,
  coalesceSmartLpRefresh,
  consumeForceLpFullRefresh,
  consumeForceLpFullRefreshDurable,
  consumeManualSmartLpRefresh,
  peekManualSmartLpRefresh,
  isSmartLpSelectiveOwnerRefresh,
  isSmartLpStructuralReuse,
  planSmartLpRefresh,
  smartLpProgressUnits,
  type SmartLpRefreshPlan,
} from "@/lib/hansome-score/lp/smart-refresh";
import {
  ANALYSIS_SEMANTIC_VERSION,
  SCAN_SNAPSHOT_SCHEMA_VERSION,
  evaluateWarmEligibility,
  planWarmDeepStages,
  shouldSkipWarmStage,
  type WarmStagePlan,
} from "@/lib/hansome-score/warm-incremental";
import { analyzeCreatorBehaviour } from "@/lib/hansome-score/creator";
import { hansomeLevelFromActivity } from "@/lib/hansome-score/hansome-level";
import {
  knownPositionSeeds,
  transparencyHintAddresses,
  transparencyLockHint,
} from "@/lib/hansome-score/labels";
import { detectV4LpIntelligence } from "@/lib/hansome-score/lp/detect";
import { detectMultiVersionLpIntelligence } from "@/lib/hansome-score/lp/multi";
import {
  applyLpHardTerminal,
  asLpTerminalContract,
  beginLpTerminal,
  hasVerifiedLockedResult,
  isLpForceRefreshActive,
  markLpTerminalPublishing,
  markLpTerminalRunning,
  mayLpForceRecover,
  resolveLpInterruptOutcome,
  settleLpSuccessTerminal,
} from "@/lib/hansome-score/lp/lp-terminal-contract";
import { withDeepLpRpcTimeout } from "@/lib/hansome-score/deep-runtime";
import { MAX_DEEP_AUTO_RETRIES } from "@/lib/hansome-score/scan-progress";
import {
  isHookNativeOwnership,
  retainHookNativeLockDistribution,
} from "@/lib/hansome-score/lp/hook-native-lock-dist";
import {
  attachPositionUsdValues,
  computeEconomicLockDistribution,
} from "@/lib/hansome-score/lp/position-value";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chain";
import { fetchEthUsd } from "@/lib/market/eth-usd";
import { computeOverallTokenScore } from "@/lib/hansome-score/overall";
import { buildRelationshipSignals } from "@/lib/hansome-score/relationship";
import { fetchOptionalGeckoActivity } from "@/lib/hansome-score/scan";
import {
  createDeepStagePublishHub,
  mergeParallelStageWrite,
  runParallelDeepJobs,
} from "@/lib/hansome-score/deep-parallel";
import type { DeepProgressStage } from "@/lib/hansome-score/deep-progress";
import {
  anyAbortSignal,
  createDeepAttemptHandle,
  registerDeepAttempt,
  unregisterDeepAttempt,
  type DeepAttemptHandle,
} from "@/lib/hansome-score/deep-settlement";
import {
  beginDeepStallSpan,
  endDeepStallSpan,
} from "@/lib/hansome-score/deep-stall-trace";
import {
  beginProfileSpan,
  buildDeepProfileSummary,
  endProfileSpan,
  isDeepProfileEnabled,
  resetDeepProfile,
  withProfileSpan,
} from "@/lib/hansome-score/deep-profile";
import {
  beginCriticalPathSession,
  buildCriticalPathCompact,
  buildCriticalPathReport,
  isCriticalPathProfileEnabled,
  noteCriticalPathMeta,
  recordWait,
} from "@/lib/hansome-score/critical-path-profiler";
import {
  DEEP_SCAN_STAGES_COMPLETE,
  FAST_SCAN_STAGES_READY,
  markScanComplete,
} from "@/lib/hansome-score/scan-fast";
import { computeStructuralScore } from "@/lib/hansome-score/score";
import { enrichSupplyBurnWithHistory } from "@/lib/hansome-score/supply-burn";
import type {
  AnalysisStageId,
  AnalysisStages,
  AnalysisStageState,
  LpIntelligence,
  ScanResponse,
} from "@/lib/hansome-score/types";

function legacyLpStatus(
  aggregate: LpIntelligence["aggregateState"],
): "locked" | "unlocked" | "unknown" | "none" | "mixed" {
  switch (aggregate) {
    case "ALL_LOCKED":
      return "locked";
    case "ALL_UNLOCKED":
      return "unlocked";
    case "MIXED":
      return "mixed";
    case "NONE":
      return "none";
    default:
      return "unknown";
  }
}

/** Wall-clock budget for one deep attempt (under Vercel maxDuration=300). */
export const DEEP_SCAN_MAX_EXECUTION_MS = 270_000;
/**
 * If a snapshot stays deep_running longer than this with no completion,
 * treat as stale and recover (release lock / mark stages unavailable).
 */
export const DEEP_STALE_THRESHOLD_MS = 360_000;
/** Per-stage soft budgets (sum can exceed max; deadline wins). */
export const DEEP_STAGE_BUDGET_MS = {
  relationships: 45_000,
  creatorBurn: 120_000,
  liquidity: 180_000,
} as const;

const DEEP_STAGE_IDS: AnalysisStageId[] = [
  "liquidity",
  "creator",
  "relationships",
  "burn",
  "score",
];

export class DeepScanTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeepScanTimeoutError";
  }
}

function remainingMs(deadline: number): number {
  return Math.max(0, deadline - Date.now());
}

/**
 * Phase 7.3 cancellation-aware stage budget.
 * Aborts the stage AbortController on timeout so fetch/RPC work can stop;
 * still detaches via Promise.race if a non-abortable lib hangs.
 */
async function withStageBudget<T>(
  label: string,
  budgetMs: number,
  deadline: number,
  work: (signal: AbortSignal) => Promise<T>,
  opts?: { attempt?: DeepAttemptHandle | null },
): Promise<T> {
  const ms = Math.min(budgetMs, remainingMs(deadline));
  if (ms < 2_000) {
    throw new DeepScanTimeoutError(`Deep deadline reached before ${label}`);
  }
  const span = beginDeepStallSpan(`withBudget.${label}`, {
    stage: label,
    operation: "withStageBudget",
  });
  const stageAc = new AbortController();
  const signal = anyAbortSignal(stageAc.signal, opts?.attempt?.signal);
  const onAttemptAbort = () => {
    try {
      stageAc.abort();
    } catch {
      /* ignore */
    }
  };
  opts?.attempt?.signal.addEventListener("abort", onAttemptAbort, {
    once: true,
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const abortReject = (reject: (e: Error) => void) => {
    reject(new DeepScanTimeoutError(`Deep stage aborted: ${label}`));
  };
  try {
    if (signal.aborted) {
      throw new DeepScanTimeoutError(`Deep stage aborted before ${label}`);
    }
    const result = await Promise.race([
      work(signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          try {
            stageAc.abort();
          } catch {
            /* ignore */
          }
          // Stage-local abort only — do not cancel sibling parallel stages.
          reject(new DeepScanTimeoutError(`Deep stage timeout: ${label}`));
        }, ms);
      }),
      // Watchdog / hard-bound cancel must detach the barrier promptly.
      new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () => abortReject(reject), {
          once: true,
        });
      }),
    ]);
    endDeepStallSpan(span, "completed");
    return result;
  } catch (err) {
    endDeepStallSpan(
      span,
      err instanceof DeepScanTimeoutError ? "timed_out" : "aborted",
      {
        timeoutReason:
          err instanceof Error ? err.message : `withStageBudget_${label}_error`,
      },
    );
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
    opts?.attempt?.signal.removeEventListener("abort", onAttemptAbort);
  }
}

/**
 * Phase 7.3: Smart LP selective/structural reuse stays OFF unless explicitly enabled.
 * Prefer shipping bounded settlement without activating Phase 7.1 Smart LP paths.
 */
export function isSmartLpRefreshEnabled(): boolean {
  return process.env.HANSOME_SMART_LP_REFRESH === "1";
}

function cloneStages(base?: AnalysisStages): AnalysisStages {
  return { ...(base ?? FAST_SCAN_STAGES_READY) };
}

/** Terminal stage states that must not be rewritten to analyzing/pending on resume. */
function stageAlreadyComplete(st: AnalysisStageState | undefined): boolean {
  return st === "done" || st === "unknown";
}

/**
 * Update a stage state. Never regress `done`/`unknown` → `analyzing`/`pending`
 * (resume / re-arm continuation must preserve completed independent stages).
 */
function setStage(
  stages: AnalysisStages,
  id: AnalysisStageId,
  state: AnalysisStageState,
): AnalysisStages {
  if (
    stageAlreadyComplete(stages[id]) &&
    (state === "analyzing" || state === "pending")
  ) {
    return stages;
  }
  return { ...stages, [id]: state };
}

function temporarilyUnavailableDetail(stage: string): string {
  return `Temporarily unavailable — ${stage} did not finish in time. Showing available Fast Scan data. Retry later.`;
}

/** Preserve finished LP evidence when other deep stages go partial. */
function shouldPreserveCompletedLpEvidence(response: ScanResponse): boolean {
  const stages = response.analysisStages;
  if (stages?.liquidity === "done") return true;
  const lp = response.overview?.lpIntelligence;
  if (!lp) return false;
  // Phase 13E: never let soft-partial wipe LOCKED_VERIFIED positions.
  if (lp.positions?.some((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN")) {
    return true;
  }
  // Phase 13E.1: Known-Hook Class B evidence is product-complete enough to preserve.
  if (
    lp.ownershipClass === "hook_native" &&
    (lp.hookPositionIndex != null ||
      (lp.ownershipClassEvidence?.length ?? 0) > 0)
  ) {
    return true;
  }
  return (
    lp.knownPositionsVerified === true &&
    lp.lockDistribution?.available === true
  );
}

/** Mark unfinished deep stages as partial; keep Fast Scan body. */
export function markScanPartial(
  response: ScanResponse,
  opts?: { reason?: string },
): ScanResponse {
  const stages = cloneStages(response.analysisStages);
  // Phase 13A: only protect liquidity while force-LP recovery can still continue.
  // Exhausted force/auto budgets must not leave liquidity=analyzing on a partial settle.
  const forceOwnsLiquidity =
    (isLpForceRefreshActive(response) && mayLpForceRecover(response.lpTerminal)) ||
    response.lpTerminal?.terminalState === "SUCCESS_TERMINAL" ||
    response.lpTerminal?.terminalState === "FAILED_TERMINAL";
  const retriesExhausted =
    (response.deepRetryCount ?? 0) >= MAX_DEEP_AUTO_RETRIES;
  const protectLp = forceOwnsLiquidity && !retriesExhausted;
  for (const id of DEEP_STAGE_IDS) {
    if (id === "liquidity" && protectLp) {
      // Force LP contract owns liquidity terminalization while recovery remains.
      continue;
    }
    if (stages[id] === "analyzing" || stages[id] === "pending") {
      stages[id] =
        id === "liquidity" &&
        response.lpTerminal?.forceRefresh &&
        !mayLpForceRecover(response.lpTerminal)
          ? "unknown"
          : "partial";
    }
  }
  if (stages.burn === "analyzing" || stages.burn === "pending") {
    stages.burn = "partial";
  }

  const lp = response.overview?.lpIntelligence;
  const preserveLp = shouldPreserveCompletedLpEvidence(response);
  // Avoid treating the substring "pending" inside lock-valuation prose as stage failure.
  const detailLooksLikeStagePending =
    typeof lp?.detail === "string" &&
    (/\bpending\b/i.test(lp.detail) || /\bin progress\b/i.test(lp.detail)) &&
    !/\block percentage pending economic valuation/i.test(lp.detail);
  const nextLp = lp
    ? preserveLp
      ? {
          // Keep discoveryComplete / completenessWarning / lockDistribution as published.
          ...lp,
        }
      : {
          ...lp,
          discoveryComplete: false,
          completenessWarning: temporarilyUnavailableDetail("liquidity"),
          detail: detailLooksLikeStagePending
            ? temporarilyUnavailableDetail("liquidity")
            : lp.detail,
          lockDistribution: {
            ...lp.lockDistribution,
            available: lp.lockDistribution?.available ?? false,
            reason:
              lp.lockDistribution?.available === true
                ? lp.lockDistribution.reason
                : temporarilyUnavailableDetail("liquidity"),
          },
        }
    : lp;

  const creator = response.overview?.creatorBehaviour;
  const nextCreator =
    creator && !creator.available
      ? {
          ...creator,
          status: "incomplete" as const,
          detail: temporarilyUnavailableDetail("creator history"),
        }
      : creator;

  const supplyBurn = response.overview?.supplyBurn;
  const burnNote = temporarilyUnavailableDetail("burn history");
  const nextSupplyBurn = supplyBurn
    ? {
        ...supplyBurn,
        burnActivity: {
          ...supplyBurn.burnActivity,
          windows: (supplyBurn.burnActivity?.windows ?? []).map((w) =>
            w.note?.includes("pending") || w.note?.includes("progress")
              ? { ...w, note: burnNote }
              : w,
          ),
        },
        supplyReduction: {
          ...supplyBurn.supplyReduction,
          note:
            supplyBurn.supplyReduction?.note?.includes("pending") ||
            supplyBurn.supplyReduction?.note?.includes("progress")
              ? temporarilyUnavailableDetail("supply reduction history")
              : supplyBurn.supplyReduction?.note,
        },
      }
    : supplyBurn;

  return {
    ...response,
    analysisPhase: "fast",
    analysisStatus: "partial",
    scoreProvisional: true,
    // Caller / cache layer bumps deepRetryCount when this settlement is persisted.
    analysisStages: stages,
    overview: response.overview
      ? {
          ...response.overview,
          lpIntelligence: nextLp ?? response.overview.lpIntelligence,
          creatorBehaviour: nextCreator ?? response.overview.creatorBehaviour,
          supplyBurn: nextSupplyBurn ?? response.overview.supplyBurn,
          lpLockDetail:
            nextLp?.detail ?? response.overview.lpLockDetail,
        }
      : response.overview,
    disclaimers: [
      ...(response.disclaimers ?? []),
      opts?.reason ??
        "Deep analysis timed out or stopped — Fast Scan data preserved. Some sections temporarily unavailable.",
    ].filter((d, i, arr) => arr.indexOf(d) === i),
    uiWording: {
      ...response.uiWording,
      overallSubtitle:
        "Provisional — some deep checks temporarily unavailable. Not a safety guarantee.",
      scoreSubtitle:
        "Provisional structural view — showing available data.",
      structuralSubtitle:
        "Provisional structural view — showing available data.",
    },
  };
}

export function isDeepStale(
  response: ScanResponse,
  now = Date.now(),
): boolean {
  if (response.analysisStatus !== "deep_running") return false;
  if (response.analysisPhase === "complete") return false;
  const started =
    response.deepStartedAt != null
      ? Date.parse(response.deepStartedAt)
      : response.scoreComputedAt != null
        ? Date.parse(response.scoreComputedAt)
        : response.scannedAt
          ? Date.parse(response.scannedAt)
          : NaN;
  if (!Number.isFinite(started)) return false;
  return now - started >= DEEP_STALE_THRESHOLD_MS;
}

/**
 * Interactive stale: deep_running past grace with no progress (watchdog) or
 * wall time past interactive budget. Used for fenced lock recovery without
 * waiting 360s. Never fires during the first progress-stall window of a new
 * attempt (avoids recovering a just-rearmed job that inherited a stalled stamp).
 */
export function isDeepInteractivelyStale(
  response: ScanResponse,
  now = Date.now(),
  interactiveMs = 90_000,
): boolean {
  if (response.analysisStatus !== "deep_running") return false;
  if (response.analysisPhase === "complete") return false;
  const started =
    response.deepStartedAt != null
      ? Date.parse(response.deepStartedAt)
      : NaN;
  if (!Number.isFinite(started)) return false;
  const age = now - started;
  // Grace: allow Deep to publish real work before interactive takeover.
  if (age < 50_000) return false;
  const updatedAt =
    response.deepProgress?.updatedAt ?? response.deepStartedAt;
  const progressAgeMs = updatedAt
    ? now - Date.parse(updatedAt)
    : Number.POSITIVE_INFINITY;
  const progressStale =
    Number.isFinite(progressAgeMs) && progressAgeMs >= 45_000;
  // Never take over while durable progress is still fresh.
  if (!progressStale && response.deepProgress?.stalled !== true) {
    return false;
  }
  if (response.deepProgress?.stalled === true && progressStale) return true;
  // Parallel wave done but score stuck analyzing → recover without 360s wait.
  const stages = response.analysisStages;
  const parallelDone =
    stages != null &&
    (stages.relationships === "done" || stages.relationships === "partial") &&
    (stages.liquidity === "done" || stages.liquidity === "partial") &&
    (stages.creator === "done" || stages.creator === "partial") &&
    (stages.burn === "done" || stages.burn === "partial");
  if (
    parallelDone &&
    stages.score === "analyzing" &&
    progressStale &&
    age >= 60_000
  ) {
    return true;
  }
  if (progressStale) return true;
  return age >= interactiveMs && progressStale;
}

function recomputeScores(response: ScanResponse): ScanResponse {
  const overview = response.overview;
  const totalSupply =
    overview.totalSupplyRaw != null ? BigInt(overview.totalSupplyRaw) : null;
  const poolManagerBalance =
    overview.poolManagerBalanceRaw != null
      ? BigInt(overview.poolManagerBalanceRaw)
      : null;
  const deployerBalance = null; // not stored on overview; structural uses null-safe path
  const lp = overview.lpIntelligence;
  const creator = overview.creatorBehaviour;
  const relationship = overview.relationship;
  const contractRisk = overview.contractRisk;

  const score = computeStructuralScore({
    totalSupply,
    topHolders: overview.topHolders,
    deployer: overview.deployer,
    deployerBalance,
    contractVerified: overview.contractVerified,
    lpLockState: lp.aggregateLockState,
    poolManagerBalance,
    contractRisk,
    relationship,
    creatorBehaviourAvailable: creator.available,
    creatorDumpDetected: creator.dumpDetected,
    creatorTransferThenSellDetected: creator.transferThenSellDetected,
  });

  const poolInventoryPctOfSupply =
    totalSupply && totalSupply > 0n && poolManagerBalance != null
      ? (Number(poolManagerBalance) / Number(totalSupply)) * 100
      : null;

  const confidence = computeConfidence({
    overview: { ...overview, lpIntelligence: lp },
    hasActivityVolume: response.activity.volume24hUsd != null,
    walletGraph: {
      sampled: true,
      sampleSize: overview.topHolders.filter((h) => !h.excludedFromConcentration)
        .length,
      fundersResolved: relationship.sharedFundingCount + relationship.deployerFundedCount,
      earlyBuysCount: relationship.sameBlockEarlyBuyCount,
    },
    honeypotSwapSimulated: false,
  });

  const overall = computeOverallTokenScore({
    structuralScore: score.score,
    liquidityUsd: response.liquidityUsd,
    poolInventoryPctOfSupply,
    sizeWarning: lp.sizeWarning,
    holdersCount: overview.holdersCount,
    top10AdjustedPct: overview.concentration.top10AdjustedPct,
    volume24hUsd: response.activity.volume24hUsd,
    transactions24h: response.activity.transactions24h,
    tokenAgeDays: overview.tokenAgeDays,
    dataConfidencePercent: confidence.percent,
  });

  return {
    ...response,
    overall,
    score,
    structural: score,
    confidence,
    hansomeLevel: hansomeLevelFromActivity(response.activity.level),
  };
}

export type DeepProgressCallback = (partial: ScanResponse) => Promise<void>;

export type EnrichScanDeepOptions = {
  /** Absolute Date.now() deadline. */
  deadline: number;
  onProgress?: DeepProgressCallback;
  maxTransferPages?: number;
  relationshipSampleSize?: number;
};

function stampDeepRunning(base: ScanResponse): ScanResponse {
  const deepStartedAt = base.deepStartedAt ?? new Date().toISOString();
  // Clear inherited stall stamps so a new attempt is not instantly "interactive stale".
  const deepProgress = base.deepProgress
    ? {
        ...base.deepProgress,
        stalled: undefined,
        stallReason: undefined,
        updatedAt: deepStartedAt,
      }
    : base.deepProgress;
  return {
    ...base,
    deepStartedAt,
    deepProgress,
    analysisPhase: "fast",
    analysisStatus: "deep_running",
    scoreProvisional: true,
    analysisStages: cloneStages(base.analysisStages),
  };
}

function stageFailedIndependently(err: unknown): boolean {
  return err instanceof DeepScanTimeoutError || err instanceof Error;
}

function hasUnresolvedDeepStages(stages: AnalysisStages): boolean {
  for (const id of DEEP_STAGE_IDS) {
    const st = stages[id];
    if (st === "partial" || st === "failed" || st === "analyzing" || st === "pending") {
      return true;
    }
  }
  if (
    stages.burn === "partial" ||
    stages.burn === "failed" ||
    stages.burn === "analyzing" ||
    stages.burn === "pending"
  ) {
    return true;
  }
  return false;
}

function applyCreatorBurnSoftFail(response: ScanResponse): ScanResponse {
  const creator = response.overview?.creatorBehaviour;
  const supplyBurn = response.overview?.supplyBurn;
  const nextCreator =
    creator && !creator.available
      ? {
          ...creator,
          status: "incomplete" as const,
          detail: temporarilyUnavailableDetail("creator history"),
        }
      : creator;
  const burnNote = temporarilyUnavailableDetail("burn history");
  const nextSupplyBurn = supplyBurn
    ? {
        ...supplyBurn,
        burnActivity: {
          ...supplyBurn.burnActivity,
          windows: (supplyBurn.burnActivity?.windows ?? []).map((w) =>
            w.note?.includes("pending") || w.note?.includes("progress")
              ? { ...w, note: burnNote }
              : w,
          ),
        },
        supplyReduction: {
          ...supplyBurn.supplyReduction,
          note:
            supplyBurn.supplyReduction?.note?.includes("pending") ||
            supplyBurn.supplyReduction?.note?.includes("progress")
              ? temporarilyUnavailableDetail("supply reduction history")
              : supplyBurn.supplyReduction?.note,
        },
      }
    : supplyBurn;
  return {
    ...response,
    overview: response.overview
      ? {
          ...response.overview,
          creatorBehaviour: nextCreator ?? response.overview.creatorBehaviour,
          supplyBurn: nextSupplyBurn ?? response.overview.supplyBurn,
        }
      : response.overview,
    disclaimers: [
      ...(response.disclaimers ?? []),
      temporarilyUnavailableDetail("creator / burn history"),
    ].filter((d, i, arr) => arr.indexOf(d) === i),
  };
}

/**
 * Enrich Fast Scan → Deep progressively.
 * Phase 6: Relationships, Liquidity, and CreatorBurn (shared transfer-index) run
 * concurrently after Fast base. Score waits for the parallel wave.
 * Soft-fails mark only the affected stages; Fast body is preserved throughout.
 */
export async function enrichScanDeep(
  base: ScanResponse,
  options: EnrichScanDeepOptions,
): Promise<ScanResponse> {
  const deadline = options.deadline;
  const maxTransferPages = options.maxTransferPages ?? 40;
  const relationshipSampleSize = options.relationshipSampleSize ?? 12;
  const address = getAddress(base.overview.address);
  const isHansome = address.toLowerCase() === HANSOME_TOKEN.toLowerCase();

  if (isDeepProfileEnabled() || isCriticalPathProfileEnabled()) {
    // Isolate-local span buffer for this attempt.
    resetDeepProfile();
  }
  let current = stampDeepRunning(base);
  const startedAt = Date.now();
  /** Phase 8: liquidity already applied Gecko this attempt — score skips duplicate fetch. */
  let liqMarketAppliedThisDeep = false;
  const attempt = createDeepAttemptHandle({
    deepAttemptId: current.deepAttemptId ?? `deep_${startedAt}`,
    tokenKey: address,
  });
  if (isCriticalPathProfileEnabled() || isDeepProfileEnabled()) {
    beginCriticalPathSession({
      scanId: current.deepAttemptId ?? attempt.deepAttemptId,
      attemptId: attempt.deepAttemptId,
      token: address.toLowerCase(),
      chain: SCAN_CHAIN_ID,
    });
  }
  const rootSpan = beginProfileSpan("scan.manual_refresh", {
    category: "other",
    stage: "deep",
    operation: "enrichScanDeep",
    meta: { token: address.slice(0, 10) },
  });
  registerDeepAttempt(attempt);
  console.info(
    `[scan-deep] start ${address} budgetMs=${remainingMs(deadline)} deepStartedAt=${current.deepStartedAt} parallel=1 attempt=${attempt.deepAttemptId}`,
  );

  const hub = createDeepStagePublishHub({
    get: () => current,
    set: (next) => {
      current = next;
    },
    onProgress: options.onProgress,
    attempt,
  });

  const publish = async (
    next: ScanResponse,
    stage: string,
    ms: number,
    progress?: {
      stage: DeepProgressStage;
      action: string;
      completedUnits?: number;
      totalUnits?: number;
      pagesFetched?: number;
      transfersIndexed?: number;
      stalled?: boolean;
      stallReason?: string | null;
    },
    publishOpts?: { terminal?: boolean },
  ) => {
    const focus = progress?.stage ?? stage;
    const pubStart = Date.now();
    await hub.publish(
      (prev) => mergeParallelStageWrite(prev, next, focus),
      stage,
      ms,
      progress,
      publishOpts,
    );
    if (isCriticalPathProfileEnabled()) {
      recordWait({
        kind: "publish",
        name: `publish:${stage}`,
        start: pubStart,
        finish: Date.now(),
      });
    }
  };

  // Phase 7: warm eligibility + stage reuse plan (fail-closed → cold).
  const transferValidation = await peekTransferIndexValidation(address);
  const lpCkpt = await loadLpDiscoveryCheckpoint(ROBINHOOD_CHAIN_ID, address);
  const scoreAt = current.scoreComputedAt ?? current.scannedAt;
  const snapshotAgeMs = scoreAt
    ? Math.max(0, Date.now() - Date.parse(scoreAt))
    : null;
  const warmEligibility = evaluateWarmEligibility({
    chainId: ROBINHOOD_CHAIN_ID,
    tokenAddress: address,
    snapshot: current,
    snapshotSchemaVersion: SCAN_SNAPSHOT_SCHEMA_VERSION,
    analysisSemanticVersion: current.version ?? ANALYSIS_SEMANTIC_VERSION,
    transferValidation,
  });
  const manualSmartLpPeek = await peekManualSmartLpRefresh(
    ROBINHOOD_CHAIN_ID,
    address,
  );
  const warmPlan: WarmStagePlan = planWarmDeepStages({
    eligibility: warmEligibility,
    stages: current.analysisStages,
    lpQuickComplete: lpCkpt?.quickComplete === true,
    snapshotAgeMs,
    // Manual refresh always arms liquidity for Smart LP eval (price-only possible).
    forceLiquidityRefresh:
      manualSmartLpPeek ||
      !stageAlreadyComplete(current.analysisStages?.liquidity),
  });
  console.info(
    `[scan-deep] warm path=${warmPlan.path} reason=${warmEligibility.reason}` +
      ` zeroDelta=${warmEligibility.zeroDelta}` +
      ` headRefresh=${warmEligibility.needsHeadRefresh}` +
      ` histResume=${warmEligibility.needsHistoricalResume}` +
      ` manualSmartLp=${manualSmartLpPeek}` +
      ` reuse=${warmPlan.reused.join(",") || "-"}` +
      ` rerun=${warmPlan.rerun.join(",") || "-"}`,
  );

  await publish(current, "warm:snapshot", Date.now() - startedAt, {
    stage: "relationships",
    action: "warm_snapshot_load",
    completedUnits: 0,
    totalUnits: 3,
  });
  await publish(current, "warm:validate", Date.now() - startedAt, {
    stage: "relationships",
    action: "checkpoint_validate",
    completedUnits: 0,
    totalUnits: 3,
  });

  // Resume / same-generation: never flip completed stages back; arm incomplete ones together.
  // Warm plan may refresh a "done" stage when head/ownership is stale.
  let stages = cloneStages(current.analysisStages);
  const creatorDone = stageAlreadyComplete(stages.creator);
  const burnDone = stageAlreadyComplete(stages.burn);
  const skipRelationships =
    warmPlan.path === "warm"
      ? shouldSkipWarmStage(warmPlan.relationships)
      : stageAlreadyComplete(stages.relationships);
  let skipLiquidity =
    warmPlan.path === "warm"
      ? shouldSkipWarmStage(warmPlan.liquidity)
      : stageAlreadyComplete(stages.liquidity);
  const skipCreatorBurn =
    warmPlan.path === "warm"
      ? shouldSkipWarmStage(warmPlan.creatorBurn)
      : creatorDone && burnDone;

  // Phase 13E / 13E.1 — Known-First BEFORE parallel wave (exclusive RPC).
  // Order: Titan → Pons → Hook (matches bootstrap priority; one hit early-exits LP).
  if (!skipLiquidity && !isSmartLpRefreshEnabled()) {
    const seeds = staticKnownBootstrapSeeds(address);
    const priorLp = current.overview.lpIntelligence ?? null;
    const poolBal =
      current.overview.poolManagerBalanceRaw != null
        ? BigInt(current.overview.poolManagerBalanceRaw)
        : null;
    const decimals = current.overview.decimals;

    const publishKnownEarly = async (
      intelIn: LpIntelligence,
      label: string,
      extraSources: string[],
    ) => {
      let intel = preferVerifiedLpAgainstIncomplete(priorLp, intelIn);
      for (const s of extraSources) {
        if (!intel.discoverySources?.includes(s)) {
          intel = {
            ...intel,
            discoverySources: [...(intel.discoverySources ?? []), s],
          };
        }
      }
      stages = setStage(cloneStages(stages), "liquidity", "done");
      current = {
        ...current,
        analysisStatus: "deep_running",
        analysisStages: stages,
        overview: {
          ...current.overview,
          poolId: intel.poolId,
          lpLockStatus: legacyLpStatus(intel.aggregateState),
          lpLockDetail: intel.detail,
          lpIntelligence: intel,
        },
      };
      if (hasVerifiedLockedResult(current)) {
        const contract = markLpTerminalPublishing(
          markLpTerminalRunning(
            current.lpTerminal ??
              beginLpTerminal({
                attemptId: attempt.deepAttemptId,
                generation: attempt.deepAttemptId,
                forceRefresh: false,
              }),
          ),
        );
        current = applyLpHardTerminal(
          current,
          settleLpSuccessTerminal(contract),
        );
      } else if (
        intel.ownershipClass === "hook_native" &&
        current.lpTerminal == null
      ) {
        // Honest Class B terminal: UNKNOWN_INCOMPLETE with durable ownership evidence.
        const contract = markLpTerminalPublishing(
          markLpTerminalRunning(
            beginLpTerminal({
              attemptId: attempt.deepAttemptId,
              generation: attempt.deepAttemptId,
              forceRefresh: false,
            }),
          ),
        );
        current = applyLpHardTerminal(
          current,
          settleLpSuccessTerminal(contract),
        );
      }
      void persistSnapshotFromLpPublish({
        chainId: ROBINHOOD_CHAIN_ID,
        tokenAddress: address,
        intelligence: intel,
        discoveryGeneration: attempt.deepAttemptId,
        publishGeneration: current.lpPublish?.lpGeneration ?? null,
      }).catch(() => {});
      await publish(
        current,
        `liquidity:${label}`,
        Date.now() - startedAt,
        {
          stage: "liquidity",
          action: "lp_known_first_early_exit",
          completedUnits: 5,
          totalUnits: 6,
        },
        { terminal: true },
      );
      skipLiquidity = true;
      return intel;
    };

    if (seeds.completeness.knownTitan === true) {
      const preStart = Date.now();
      console.info(
        `[scan-deep] known-titan pre-parallel begin budgetMs=${KNOWN_TITAN_EARLY_BUDGET_MS}` +
          ` remainMs=${remainingMs(deadline)}`,
      );
      try {
        const titanHit = await tryVerifyKnownTitanBootstrap({
          tokenAddress: address,
          poolManagerBalance: poolBal,
          decimals,
          budgetMs: KNOWN_TITAN_EARLY_BUDGET_MS,
        });
        if (titanHit) {
          const intel = await publishKnownEarly(
            titanHit.intelligence,
            "known-titan-pre-parallel",
            [
              "known_bootstrap",
              "bootstrap:registry_titan",
              "bootstrap_stage:known_titan",
              "titan_pre_parallel",
            ],
          );
          console.info(
            `[scan-deep] known-titan pre-parallel early-exit ms=${Date.now() - preStart}` +
              ` tid=${intel.positions.find((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN")?.positionNftId ?? "-"}` +
              ` pos=${intel.positions.length}`,
          );
        } else {
          console.info(
            `[scan-deep] known-titan pre-parallel miss ms=${Date.now() - preStart} — liquidity job will retry`,
          );
        }
      } catch (err) {
        console.warn(
          `[scan-deep] known-titan pre-parallel error — liquidity job will retry:`,
          err,
        );
      }
    }

    if (!skipLiquidity && seeds.completeness.knownPons === true) {
      const preStart = Date.now();
      console.info(
        `[scan-deep] known-pons pre-parallel begin budgetMs=${KNOWN_PONS_EARLY_BUDGET_MS}` +
          ` remainMs=${remainingMs(deadline)}`,
      );
      try {
        const ponsHit = await tryVerifyKnownPonsBootstrap({
          tokenAddress: address,
          poolManagerBalance: poolBal,
          decimals,
          budgetMs: KNOWN_PONS_EARLY_BUDGET_MS,
        });
        if (ponsHit) {
          const intel = await publishKnownEarly(
            ponsHit.intelligence,
            "known-pons-pre-parallel",
            [
              "known_bootstrap",
              "bootstrap:registry_pons",
              "bootstrap_stage:known_pons",
              "pons_pre_parallel",
            ],
          );
          console.info(
            `[scan-deep] known-pons pre-parallel early-exit ms=${Date.now() - preStart}` +
              ` tid=${intel.positions.find((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN")?.positionNftId ?? "-"}`,
          );
        } else {
          console.info(
            `[scan-deep] known-pons pre-parallel miss ms=${Date.now() - preStart} — liquidity job will retry`,
          );
        }
      } catch (err) {
        console.warn(
          `[scan-deep] known-pons pre-parallel error — liquidity job will retry:`,
          err,
        );
      }
    }

    if (!skipLiquidity && seeds.completeness.knownHook === true) {
      const preStart = Date.now();
      console.info(
        `[scan-deep] known-hook pre-parallel begin budgetMs=${KNOWN_HOOK_EARLY_BUDGET_MS}` +
          ` remainMs=${remainingMs(deadline)}`,
      );
      try {
        const hookHit = await tryVerifyKnownHookBootstrap({
          tokenAddress: address,
          poolManagerBalance: poolBal,
          decimals,
          budgetMs: KNOWN_HOOK_EARLY_BUDGET_MS,
        });
        if (hookHit) {
          const intel = await publishKnownEarly(
            hookHit.intelligence,
            "known-hook-pre-parallel",
            [
              "known_bootstrap",
              "bootstrap:registry_hook",
              "bootstrap_stage:known_hook",
              "hook_pre_parallel",
            ],
          );
          console.info(
            `[scan-deep] known-hook pre-parallel early-exit ms=${Date.now() - preStart}` +
              ` class=${intel.ownershipClass}` +
              ` owned=${intel.hookPositionIndex?.hookOwnedCount ?? 0}`,
          );
        } else {
          console.info(
            `[scan-deep] known-hook pre-parallel miss ms=${Date.now() - preStart} — liquidity job will retry`,
          );
        }
      } catch (err) {
        console.warn(
          `[scan-deep] known-hook pre-parallel error — liquidity job will retry:`,
          err,
        );
      }
    }
  }

  if (!skipRelationships) {
    stages = setStage(stages, "relationships", "analyzing");
  }
  if (!skipLiquidity) {
    stages = setStage(stages, "liquidity", "analyzing");
  }
  if (!skipCreatorBurn) {
    stages = setStage(setStage(stages, "creator", "analyzing"), "burn", "analyzing");
  }
  current = { ...current, analysisStages: stages, analysisStatus: "deep_running" };
  await publish(current, "parallel:start", Date.now() - startedAt, {
    stage: skipRelationships
      ? skipLiquidity
        ? "creatorBurn"
        : "liquidity"
      : "relationships",
    action:
      warmPlan.path === "warm" && warmPlan.reused.length > 0
        ? "stage_reuse"
        : "parallel_wave_start",
    completedUnits: warmPlan.reused.length,
    totalUnits: 3,
  });
  if (warmEligibility.zeroDelta && skipCreatorBurn) {
    await publish(current, "warm:zero_delta", Date.now() - startedAt, {
      stage: "creatorBurn",
      action: "zero_delta_reuse",
      completedUnits: 3,
      totalUnits: 3,
      pagesFetched: transferValidation.meta?.pagesFetchedTotal ?? 0,
      transfersIndexed: transferValidation.meta?.transfersIndexed ?? 0,
    });
  }

  const runRelationshipsJob = async () => {
    if (skipRelationships) {
      console.info(
        `[scan-deep] skip relationships (warm=${warmPlan.path} action=${warmPlan.relationships} stage=${current.analysisStages?.relationships})`,
      );
      return;
    }
    await publish(current, "relationships:start", Date.now() - startedAt, {
      stage: "relationships",
      action:
        warmPlan.path === "warm" && warmPlan.relationships === "refresh"
          ? "relationship_refresh"
          : "start",
      completedUnits: 0,
      totalUnits: relationshipSampleSize,
    });

    try {
      const relMs = Date.now();
      const topHolders = current.overview.topHolders;
      const deployer = current.overview.deployer;
      const sampleHolders = topHolders
        .filter((h) => !h.excludedFromConcentration)
        .slice(0, relationshipSampleSize);

      const relationship = await withStageBudget(
        "relationships",
        DEEP_STAGE_BUDGET_MS.relationships,
        deadline,
        async (signal) => {
          let fundersDone = 0;
          let lastFunderPublish = 0;
          const totalUnits = Math.max(1, sampleHolders.length + 1);
          const [funders, earlyFromIndex] = await Promise.all([
            Promise.all(
              sampleHolders.map(async (h) => {
                if (signal.aborted) return null;
                const f = await fetchNativeFunder(h.address, { signal });
                fundersDone += 1;
                // Throttle mid-publishes (every 2 funders + last) to avoid KV storms.
                if (
                  fundersDone === sampleHolders.length ||
                  fundersDone - lastFunderPublish >= 2
                ) {
                  lastFunderPublish = fundersDone;
                  await publish(
                    current,
                    "relationships:funder",
                    Date.now() - relMs,
                    {
                      stage: "relationships",
                      action: "funder",
                      completedUnits: fundersDone,
                      totalUnits,
                    },
                  );
                }
                if (!f) return null;
                return { from: f.from, to: h.address, blockNumber: f.blockNumber };
              }),
            ),
            // Reuse transfer-index head when present — avoid duplicate page-1 GET.
            loadEarlyTransfersFromIndex(address),
          ]);
          if (signal.aborted) {
            throw new DeepScanTimeoutError("Deep stage aborted: relationships");
          }
          const earlyTransfers =
            earlyFromIndex ??
            (await fetchEarlyTokenTransfers(address, { signal }));
          await publish(current, "relationships:early", Date.now() - relMs, {
            stage: "relationships",
            action: "early_transfers",
            completedUnits: totalUnits,
            totalUnits,
          });
          const fundingEdges = funders.filter(
            (x): x is { from: string; to: string; blockNumber: number | null } =>
              x != null,
          );
          return buildRelationshipSignals({
            holders: topHolders,
            deployer,
            fundingEdges,
            earlyBuys: earlyTransfers.map((t) => ({
              buyer: t.to,
              blockNumber: t.blockNumber,
            })),
          });
        },
        { attempt },
      );

      await publish(
        {
          ...current,
          analysisStages: setStage(
            cloneStages(current.analysisStages),
            "relationships",
            "done",
          ),
          overview: { ...current.overview, relationship },
        },
        "relationships:done",
        Date.now() - relMs,
        {
          stage: "relationships",
          action: "done",
          completedUnits: relationshipSampleSize + 1,
          totalUnits: relationshipSampleSize + 1,
        },
        { terminal: true },
      );
    } catch (err) {
      if (!stageFailedIndependently(err)) throw err;
      await publish(
        {
          ...current,
          analysisStatus: "deep_running",
          analysisStages: setStage(
            cloneStages(current.analysisStages),
            "relationships",
            "partial",
          ),
          disclaimers: [
            ...(current.disclaimers ?? []),
            temporarilyUnavailableDetail("relationships"),
          ].filter((d, i, arr) => arr.indexOf(d) === i),
        },
        err instanceof DeepScanTimeoutError
          ? "relationships:timeout"
          : "relationships:error",
        Date.now() - startedAt,
        {
          stage: "relationships",
          action:
            err instanceof DeepScanTimeoutError ? "timeout" : "error",
          stalled: err instanceof DeepScanTimeoutError,
          stallReason:
            err instanceof DeepScanTimeoutError
              ? "relationships_stage_timeout"
              : "relationships_stage_error",
        },
        { terminal: true },
      );
    }
  };

  const runLiquidityJob = async () => {
    if (skipLiquidity) {
      console.info(
        `[scan-deep] skip liquidity (warm=${warmPlan.path} action=${warmPlan.liquidity} stage=${current.analysisStages?.liquidity})`,
      );
      return;
    }
    try {
    const lpMs = Date.now();
    const decimals = current.overview.decimals;
    const poolManagerBalance =
      current.overview.poolManagerBalanceRaw != null
        ? BigInt(current.overview.poolManagerBalanceRaw)
        : null;
    const topHolders = current.overview.topHolders;
    const deployer = current.overview.deployer;

    // Phase 13D.2 — adaptive liquidity ceiling (base 180s, expand while progress).
    const liqBudgetMs = Math.min(
      ADAPTIVE_LIQUIDITY_BUDGET.maxBudgetMs,
      Math.max(DEEP_STAGE_BUDGET_MS.liquidity, ADAPTIVE_LIQUIDITY_BUDGET.baseBudgetMs),
      remainingMs(deadline),
    );
    // Exhaustive PM history only when soft budget leaves headroom above known-first (~20s).
    // Adaptive max (255s) can unlock exhaustive; default path still prefers known-first.
    const allowExhaustive = liqBudgetMs >= 200_000;

    // Phase 7.1 Smart LP — disabled unless HANSOME_SMART_LP_REFRESH=1 (Phase 7.3).
    // Phase 8.1 Known-First early exit — active when Smart LP is off (default).
    const lpCacheSnap = await loadLpDiscoveryCache(ROBINHOOD_CHAIN_ID, address);
    const smartLpEnabled = isSmartLpRefreshEnabled();
    const explicitForceFullLp =
      (await consumeForceLpFullRefreshDurable(ROBINHOOD_CHAIN_ID, address)) ||
      consumeForceLpFullRefresh(address) ||
      process.env.HANSOME_FORCE_LP_FULL_REFRESH === "1";
    // When Smart LP is off, do NOT treat "disabled" as force-full (that would
    // defeat known-first). Only explicit force / env forces full Quick.
    const forceFullLp = smartLpEnabled
      ? explicitForceFullLp
      : explicitForceFullLp;
    const manualWarmLpRefresh =
      warmPlan.path === "warm" && warmPlan.liquidity === "refresh";
    const manualSmartLp = smartLpEnabled
      ? await consumeManualSmartLpRefresh(ROBINHOOD_CHAIN_ID, address)
      : false;

    // Phase 13C: prefer recovery-slot / preserved active body when aggregate was cleared for force.
    const priorLpForRefresh = await loadPriorLpForForceDeep({
      response: current,
    });

    // Phase 13D — Known-First Bootstrap (advisory until ownership verification).
    const knownBootstrap: KnownBootstrapPack = await resolveKnownBootstrap({
      chainId: ROBINHOOD_CHAIN_ID,
      tokenAddress: address,
      lpCache: lpCacheSnap,
      lpCheckpoint: lpCkpt,
      priorLp: priorLpForRefresh,
    });
    console.info(
      `[scan-deep] known-bootstrap stages=${knownBootstrap.stagesHit.join(",") || "-"}` +
        ` ids=${knownBootstrap.positionIds.length}` +
        ` pools=${knownBootstrap.poolIds.length}` +
        ` next=${knownBootstrap.nextStage}` +
        ` advisory=true`,
    );

    const knownFirstEvidence = buildKnownFirstEvidence({
      chainId: ROBINHOOD_CHAIN_ID,
      expectedChainId: ROBINHOOD_CHAIN_ID,
      tokenAddress: address,
      analysisSemanticVersion: current.version ?? ANALYSIS_SEMANTIC_VERSION,
      lpCache: lpCacheSnap,
      lpCheckpoint: lpCkpt,
      priorLp: priorLpForRefresh,
      snapshotAgeMs,
      priorPartialFailure: current.analysisStages?.liquidity === "partial",
      forceLpFullRefresh: explicitForceFullLp,
      reorgConflict: warmEligibility.reason === "reorg_conflict",
      manualRefresh: manualWarmLpRefresh || manualSmartLp,
    });
    const knownFirstPlan: KnownFirstEarlyExitPlan =
      planKnownFirstLpEarlyExit(knownFirstEvidence);

    const smartEvidence = buildSmartLpEvidence({
      chainId: ROBINHOOD_CHAIN_ID,
      expectedChainId: ROBINHOOD_CHAIN_ID,
      tokenAddress: address,
      analysisSemanticVersion: current.version ?? ANALYSIS_SEMANTIC_VERSION,
      lpCache: lpCacheSnap,
      lpCheckpoint: lpCkpt,
      priorLp: priorLpForRefresh,
      snapshotAgeMs,
      priorPartialFailure: current.analysisStages?.liquidity === "partial",
      // Smart LP off → force plan to full (unused when known-first drives paths).
      forceLpFullRefresh: smartLpEnabled ? forceFullLp : true,
      reorgConflict: warmEligibility.reason === "reorg_conflict",
      manualRefresh:
        smartLpEnabled &&
        (manualSmartLp || manualWarmLpRefresh),
    });
    const smartPlan: SmartLpRefreshPlan = planSmartLpRefresh(smartEvidence);
    console.info(
      `[scan-deep] known-first outcome=${knownFirstPlan.outcome}` +
        ` reasons=${knownFirstPlan.reasons.join(",") || "-"}` +
        ` skipQuick=${knownFirstPlan.evidence.skipBroadQuick}` +
        ` smartLp=${smartLpEnabled ? smartPlan.outcome : "off"}`,
    );

    // Phase 13E — Known-Pons PREFLIGHT outside withStageBudget + coalesce.
    // Live Candidate evidence: known-bootstrap logs then liquidity:timeout with NO
    // "known-pons begin" — Ownership Verification never started because coalesce /
    // stage budget was already exhausted by parallel siblings / zombie inflight.
    // Preflight uses its own 12s budget and progressive-publishes Locked immediately.
    if (!smartLpEnabled && knownBootstrap.completeness.knownPons === true) {
      const preflightStarted = Date.now();
      console.info(
        `[scan-deep] known-pons preflight begin remainMs=${remainingMs(deadline)}`,
      );
      try {
        const ponsHit = await tryVerifyKnownPonsBootstrap({
          tokenAddress: address,
          poolManagerBalance,
          decimals,
          budgetMs: KNOWN_PONS_EARLY_BUDGET_MS,
        });
        if (ponsHit) {
          let intel = ponsHit.intelligence;
          intel = preferVerifiedLpAgainstIncomplete(priorLpForRefresh, intel);
          const bootSources = bootstrapPackToDiscoverySources(knownBootstrap);
          for (const s of bootSources) {
            if (!intel.discoverySources?.includes(s)) {
              intel = {
                ...intel,
                discoverySources: [...(intel.discoverySources ?? []), s],
              };
            }
          }
          // Light enrich (pool % warning) without waiting on market APIs.
          if (
            (poolManagerBalance ?? 0n) > 0n &&
            current.overview.totalSupplyRaw != null
          ) {
            try {
              const totalSupply = BigInt(current.overview.totalSupplyRaw);
              if (totalSupply > 0n) {
                const poolPct =
                  (Number(poolManagerBalance) / Number(totalSupply)) * 100;
                if (poolPct < 1) intel = { ...intel, sizeWarning: true };
              }
            } catch {
              /* ignore */
            }
          }
          stages = setStage(
            cloneStages(current.analysisStages),
            "liquidity",
            "done",
          );
          current = {
            ...current,
            analysisStatus: "deep_running",
            analysisStages: stages,
            overview: {
              ...current.overview,
              poolId: intel.poolId,
              lpLockStatus: legacyLpStatus(intel.aggregateState),
              lpLockDetail: intel.detail,
              lpIntelligence: intel,
            },
          };
          if (hasVerifiedLockedResult(current)) {
            const contract = markLpTerminalPublishing(
              markLpTerminalRunning(
                current.lpTerminal ??
                  beginLpTerminal({
                    attemptId: attempt.deepAttemptId,
                    generation: attempt.deepAttemptId,
                    forceRefresh: false,
                  }),
              ),
            );
            current = applyLpHardTerminal(
              current,
              settleLpSuccessTerminal(contract),
            );
          }
          void persistSnapshotFromLpPublish({
            chainId: ROBINHOOD_CHAIN_ID,
            tokenAddress: address,
            intelligence: intel,
            discoveryGeneration: attempt.deepAttemptId,
            publishGeneration: current.lpPublish?.lpGeneration ?? null,
          }).catch((err) => {
            console.warn("[scan-deep] preflight LP snapshot failed:", err);
          });
          await publish(
            current,
            "liquidity:known-pons-preflight",
            Date.now() - lpMs,
            {
              stage: "liquidity",
              action: "lp_known_first_early_exit",
              completedUnits: 5,
              totalUnits: 6,
            },
            { terminal: true },
          );
          console.info(
            `[scan-deep] known-pons preflight early-exit ms=${Date.now() - preflightStarted}` +
              ` positions=${intel.positions.length}` +
              ` tid=${intel.positions.find((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN")?.positionNftId ?? "-"}`,
          );
          return;
        }
        console.info(
          `[scan-deep] known-pons preflight miss ms=${Date.now() - preflightStarted} — continuing stage path`,
        );
      } catch (preflightErr) {
        console.warn(
          `[scan-deep] known-pons preflight error ms=${Date.now() - preflightStarted} — continuing:`,
          preflightErr,
        );
      }
    }

    const publishLpStep = async (
      action: string,
      stepIndex: number,
      patch?: Partial<ScanResponse>,
    ) => {
      const units = smartLpEnabled
        ? smartLpProgressUnits(smartPlan, stepIndex)
        : knownFirstProgressUnits(knownFirstPlan, stepIndex);
      await publish(
        {
          ...current,
          ...patch,
          analysisStages: setStage(
            cloneStages((patch?.analysisStages as AnalysisStages) ?? current.analysisStages),
            "liquidity",
            "analyzing",
          ),
          analysisStatus: "deep_running",
        },
        `liquidity:${action}`,
        Date.now() - startedAt,
        {
          stage: "liquidity",
          action,
          completedUnits: units.completedUnits,
          totalUnits: units.totalUnits,
        },
      );
    };

    if (smartLpEnabled) {
      await publishLpStep("lp_refresh_plan", 0);
      await publishLpStep("lp_cache_validate", 1);
    } else {
      // Validate publishes only when Known-Pons / known-first actually runs (below).
      await publishLpStep("lp_known_first_plan", 0);
      await publishLpStep("lp_known_evidence_load", 1);
    }

    const lpIntelligence = await withStageBudget(
      "liquidity",
      liqBudgetMs,
      deadline,
      async (signal) => {
        const { result } = await coalesceSmartLpRefresh(
          ROBINHOOD_CHAIN_ID,
          address,
          async () => {
        // Phase 8.1: attempt-scoped memo (market / duplicate RPC within attempt).
        const attemptMemo = createAttemptLpRequestMemo();
        // Phase 8: market APIs overlap with LP discovery on the full path.
        // Structural reuse still awaits market first (price overlay is the job).
        type GeckoSnap = Awaited<ReturnType<typeof fetchOptionalGeckoActivity>>;
        const market = {
          gecko: {
            volume24hUsd: null,
            transactions24h: null,
            liquidityUsd: null,
            tokenPriceUsd: null,
            quotePriceUsd: null,
            source: null,
          } as GeckoSnap,
          ethUsd: null as number | null,
          ready: null as Promise<void> | null,
        };
        const ensureMarket = (): Promise<void> => {
          if (!market.ready) {
            const memoKey = `market:${address.toLowerCase()}`;
            market.ready = (async () => {
              const existing = attemptMemo.priceEthUsd.get(memoKey) as
                | Promise<[GeckoSnap, number | null]>
                | undefined;
              const fetchPair =
                existing ??
                Promise.all([
                  fetchOptionalGeckoActivity(address, { signal }),
                  withDeepLpRpcTimeout(fetchEthUsd({ signal }), {
                    label: "eth_usd",
                  }).catch(() => null as number | null),
                ]);
              if (!existing) attemptMemo.priceEthUsd.set(memoKey, fetchPair);
              const [g, e] = await fetchPair;
              market.gecko = g;
              market.ethUsd = e;
            })();
          }
          return market.ready;
        };
        const applyMarketToActivity = () => {
          const gecko = market.gecko;
          if (gecko.source == null) return;
          const activity = computeActivity({
            volume24hUsd: gecko.volume24hUsd,
            transactions24h: gecko.transactions24h,
            transfersCount: current.overview.transfersCount,
            volumeSource: gecko.source,
          });
          current = {
            ...current,
            activity,
            liquidityUsd:
              gecko.liquidityUsd != null
                ? gecko.liquidityUsd
                : current.liquidityUsd,
            hansomeLevel: hansomeLevelFromActivity(activity.level),
          };
          liqMarketAppliedThisDeep = true;
        };

        if (signal.aborted) {
          throw new DeepScanTimeoutError("Deep stage aborted: liquidity");
        }
        const hintAddresses = [
          ...transparencyHintAddresses(address),
          ...(deployer ? [deployer] : []),
          ...topHolders
            .filter((h) => !h.excludedFromConcentration)
            .slice(0, 8)
            .map((h) => h.address),
        ];
        const hint = transparencyLockHint();
        const candidatePositionIds = new Set<bigint>(knownPositionSeeds(address));
        if (isHansome && hint.positionNftId && /^\d+$/.test(hint.positionNftId)) {
          candidatePositionIds.add(BigInt(hint.positionNftId));
        }
        // Phase 13D: union Known Bootstrap seeds (Titan → Pons → Hook → historical).
        for (const id of knownBootstrap.candidatePositionIds) {
          candidatePositionIds.add(id);
        }

        const tokenDecimals = decimals ?? 18;

        const enrichLp = (intel: LpIntelligence): LpIntelligence => {
          const gecko = market.gecko;
          const ethUsd = market.ethUsd;
          const quoteAsEth =
            gecko.quotePriceUsd != null &&
            ethUsd != null &&
            Math.abs(gecko.quotePriceUsd - ethUsd) / ethUsd < 0.15;
          const pricedPositions = attachPositionUsdValues(intel.positions, {
            tokenAddress: address,
            tokenDecimals,
            tokenPriceUsd: gecko.tokenPriceUsd,
            ethUsd: quoteAsEth ? gecko.quotePriceUsd : ethUsd,
            usdgUsd: 1,
          });
          intel.positions = pricedPositions;
          // Phase 12A.1 — Class B: never rehydrate Titan lock% after multi clears it.
          if (isHookNativeOwnership(intel.ownershipClass)) {
            intel.lockDistribution = retainHookNativeLockDistribution(
              intel.lockDistribution,
            );
          } else {
            intel.lockDistribution = computeEconomicLockDistribution({
              positions: pricedPositions,
              poolLiquidityUsd: gecko.liquidityUsd ?? current.liquidityUsd,
            });
          }
          const totalSupply =
            current.overview.totalSupplyRaw != null
              ? BigInt(current.overview.totalSupplyRaw)
              : null;
          if (
            (poolManagerBalance ?? 0n) > 0n &&
            totalSupply &&
            totalSupply > 0n
          ) {
            const poolPct =
              (Number(poolManagerBalance) / Number(totalSupply)) * 100;
            if (poolPct < 1) intel.sizeWarning = true;
          }
          return intel;
        };

        // Phase 13E.1 — Known-Titan progressive (HANSOME) before structural reuse / multi.
        // Mirrors Known-Pons: stamp durable Locked before market wait / sibling soft-fail.
        if (!smartLpEnabled && knownBootstrap.completeness.knownTitan === true) {
          const titanStarted = Date.now();
          try {
            await publishLpStep("lp_known_evidence_validate", 2);
            const remain = Math.max(0, deadline - Date.now());
            const titanBudget = Math.min(
              KNOWN_TITAN_EARLY_BUDGET_MS,
              Math.max(
                8_000,
                remain > 90_000
                  ? KNOWN_TITAN_EARLY_BUDGET_MS
                  : Math.floor(remain * 0.5),
              ),
            );
            console.info(
              `[scan-deep] known-titan bootstrap begin budgetMs=${titanBudget} remainMs=${remain}`,
            );
            const titanEarly = await tryVerifyKnownTitanBootstrap({
              tokenAddress: address,
              poolManagerBalance,
              decimals,
              budgetMs: titanBudget,
              signal,
            });
            if (titanEarly) {
              let intel = enrichLp(titanEarly.intelligence);
              intel = preferVerifiedLpAgainstIncomplete(priorLpForRefresh, intel);
              const bootSources = bootstrapPackToDiscoverySources(knownBootstrap);
              for (const s of bootSources) {
                if (!intel.discoverySources?.includes(s)) {
                  intel = {
                    ...intel,
                    discoverySources: [...(intel.discoverySources ?? []), s],
                  };
                }
              }
              current = {
                ...current,
                overview: {
                  ...current.overview,
                  poolId: intel.poolId,
                  lpLockStatus: legacyLpStatus(intel.aggregateState),
                  lpLockDetail: intel.detail,
                  lpIntelligence: intel,
                },
              };
              await publish(
                current,
                "liquidity:known-titan-progressive",
                Date.now() - startedAt,
                {
                  stage: "liquidity",
                  action: "lp_known_first_early_exit",
                  completedUnits: 5,
                  totalUnits: 6,
                },
              );
              await Promise.race([
                ensureMarket(),
                new Promise<void>((r) => setTimeout(r, 4_000)),
              ]);
              if (signal.aborted) {
                throw new DeepScanTimeoutError("Deep stage aborted: liquidity");
              }
              applyMarketToActivity();
              await publishLpStep("lp_known_first_early_exit", 6);
              await publishLpStep("lp_final_validation", 7);
              console.info(
                `[scan-deep] known-titan bootstrap early-exit ms=${Date.now() - titanStarted}` +
                  ` positions=${intel.positions.length}` +
                  ` locked=${intel.positions.filter((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN").length}`,
              );
              return {
                intelligence: intel,
                legacyStatus: legacyLpStatus(intel.aggregateState),
                geckoLiquidity: market.gecko.liquidityUsd,
                smartOutcome: "known_first_reuse",
                knownFirstOutcome: "known_first_reuse",
                skippedBroadQuick: true,
              };
            }
            console.info(
              `[scan-deep] known-titan bootstrap miss — continuing known-first/multi` +
                ` ms=${Date.now() - titanStarted}`,
            );
          } catch (titanErr) {
            if (
              titanErr instanceof DeepScanTimeoutError &&
              signal.aborted
            ) {
              throw titanErr;
            }
            console.warn(
              `[scan-deep] known-titan bootstrap error — continuing ms=${Date.now() - titanStarted}:`,
              titanErr,
            );
          }
        }

        // Phase 13D/E — Known-Pons early path (before structural reuse / multi wall).
        // Adapter still revalidates ownerOf; never invents lock from registry alone.
        // Budget-capped: miss/timeout continues to multi — never starve the stage.
        // Do NOT modify Pons classification — reliability/publish path only.
        if (!smartLpEnabled && knownBootstrap.completeness.knownPons === true) {
          const ponsStarted = Date.now();
          try {
            await publishLpStep("lp_known_evidence_validate", 2);
            const remain = Math.max(0, deadline - Date.now());
            const ponsBudget = Math.min(
              KNOWN_PONS_EARLY_BUDGET_MS,
              Math.max(8_000, remain > 90_000 ? KNOWN_PONS_EARLY_BUDGET_MS : Math.floor(remain * 0.5)),
            );
            console.info(
              `[scan-deep] known-pons bootstrap begin budgetMs=${ponsBudget} remainMs=${remain}`,
            );
            const ponsEarly = await tryVerifyKnownPonsBootstrap({
              tokenAddress: address,
              poolManagerBalance,
              decimals,
              budgetMs: ponsBudget,
              signal,
            });
            if (ponsEarly) {
              let intel = enrichLp(ponsEarly.intelligence);
              intel = preferVerifiedLpAgainstIncomplete(priorLpForRefresh, intel);
              const bootSources = bootstrapPackToDiscoverySources(knownBootstrap);
              for (const s of bootSources) {
                if (!intel.discoverySources?.includes(s)) {
                  intel = {
                    ...intel,
                    discoverySources: [...(intel.discoverySources ?? []), s],
                  };
                }
              }
              // Phase 13E — stamp Locked onto durable `current` BEFORE market wait so
              // stage-timeout soft-fail cannot drop a proven Pons publish.
              current = {
                ...current,
                overview: {
                  ...current.overview,
                  poolId: intel.poolId,
                  lpLockStatus: legacyLpStatus(intel.aggregateState),
                  lpLockDetail: intel.detail,
                  lpIntelligence: intel,
                },
              };
              await publish(
                current,
                "liquidity:known-pons-progressive",
                Date.now() - startedAt,
                {
                  stage: "liquidity",
                  action: "lp_known_first_early_exit",
                  completedUnits: 5,
                  totalUnits: 6,
                },
              );
              await Promise.race([
                ensureMarket(),
                new Promise<void>((r) => setTimeout(r, 4_000)),
              ]);
              if (signal.aborted) {
                // Locked already stamped — prefer success interrupt over empty soft-fail.
                throw new DeepScanTimeoutError("Deep stage aborted: liquidity");
              }
              applyMarketToActivity();
              await publishLpStep("lp_known_first_early_exit", 6);
              await publishLpStep("lp_final_validation", 7);
              console.info(
                `[scan-deep] known-pons bootstrap early-exit ms=${Date.now() - ponsStarted}` +
                  ` positions=${intel.positions.length}` +
                  ` locked=${intel.positions.filter((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN").length}`,
              );
              return {
                intelligence: intel,
                legacyStatus: legacyLpStatus(intel.aggregateState),
                geckoLiquidity: market.gecko.liquidityUsd,
                smartOutcome: "known_first_reuse",
                knownFirstOutcome: "known_first_reuse",
                skippedBroadQuick: true,
              };
            }
            console.info(
              `[scan-deep] known-pons bootstrap miss — continuing known-first/multi` +
                ` ms=${Date.now() - ponsStarted}`,
            );
          } catch (ponsErr) {
            // Only abort liquidity when the stage signal is already done; otherwise
            // fall through so multi-version can still publish Locked.
            if (
              ponsErr instanceof DeepScanTimeoutError &&
              signal.aborted
            ) {
              throw ponsErr;
            }
            console.warn(
              `[scan-deep] known-pons bootstrap error — continuing ms=${Date.now() - ponsStarted}:`,
              ponsErr,
            );
          }
        }

        // Phase 13E.1 — Known-Hook progressive (GME/OKC). Publish Class B evidence
        // without awaiting foreign exhaustive discovery.
        if (!smartLpEnabled && knownBootstrap.completeness.knownHook === true) {
          const hookStarted = Date.now();
          try {
            await publishLpStep("lp_known_evidence_validate", 2);
            const remain = Math.max(0, deadline - Date.now());
            const hookBudget = Math.min(
              KNOWN_HOOK_EARLY_BUDGET_MS,
              Math.max(
                4_000,
                remain > 60_000
                  ? KNOWN_HOOK_EARLY_BUDGET_MS
                  : Math.floor(remain * 0.35),
              ),
            );
            console.info(
              `[scan-deep] known-hook bootstrap begin budgetMs=${hookBudget} remainMs=${remain}`,
            );
            const hookEarly = await tryVerifyKnownHookBootstrap({
              tokenAddress: address,
              poolManagerBalance,
              decimals,
              budgetMs: hookBudget,
              signal,
            });
            if (hookEarly) {
              let intel = enrichLp(hookEarly.intelligence);
              intel = preferVerifiedLpAgainstIncomplete(priorLpForRefresh, intel);
              const bootSources = bootstrapPackToDiscoverySources(knownBootstrap);
              for (const s of bootSources) {
                if (!intel.discoverySources?.includes(s)) {
                  intel = {
                    ...intel,
                    discoverySources: [...(intel.discoverySources ?? []), s],
                  };
                }
              }
              current = {
                ...current,
                overview: {
                  ...current.overview,
                  poolId: intel.poolId,
                  lpLockStatus: legacyLpStatus(intel.aggregateState),
                  lpLockDetail: intel.detail,
                  lpIntelligence: intel,
                },
              };
              await publish(
                current,
                "liquidity:known-hook-progressive",
                Date.now() - startedAt,
                {
                  stage: "liquidity",
                  action: "lp_known_first_early_exit",
                  completedUnits: 5,
                  totalUnits: 6,
                },
              );
              await Promise.race([
                ensureMarket(),
                new Promise<void>((r) => setTimeout(r, 3_000)),
              ]);
              applyMarketToActivity();
              await publishLpStep("lp_known_first_early_exit", 6);
              await publishLpStep("lp_final_validation", 7);
              console.info(
                `[scan-deep] known-hook bootstrap early-exit ms=${Date.now() - hookStarted}` +
                  ` class=${intel.ownershipClass}` +
                  ` owned=${intel.hookPositionIndex?.hookOwnedCount ?? 0}`,
              );
              return {
                intelligence: intel,
                legacyStatus: legacyLpStatus(intel.aggregateState),
                geckoLiquidity: market.gecko.liquidityUsd,
                smartOutcome: "known_first_reuse",
                knownFirstOutcome: "known_first_reuse",
                skippedBroadQuick: true,
              };
            }
            console.info(
              `[scan-deep] known-hook bootstrap miss — continuing known-first/multi` +
                ` ms=${Date.now() - hookStarted}`,
            );
          } catch (hookErr) {
            if (
              hookErr instanceof DeepScanTimeoutError &&
              signal.aborted
            ) {
              throw hookErr;
            }
            console.warn(
              `[scan-deep] known-hook bootstrap error — continuing ms=${Date.now() - hookStarted}:`,
              hookErr,
            );
          }
        }

        // —— Phase 8.1 Known-First early exit (Smart LP off) ——
        if (
          !smartLpEnabled &&
          isKnownFirstStructuralReuse(knownFirstPlan.outcome) &&
          current.overview.lpIntelligence
        ) {
          return await withProfileSpan(
            "scan.deep.liquidity.known_first",
            {
              category: "rpc",
              stage: "liquidity",
              operation: knownFirstPlan.outcome,
            },
            async () => {
              await withProfileSpan(
                "scan.deep.liquidity.lp_owner_reuse",
                { category: "rpc", stage: "liquidity", operation: "owner_reuse" },
                async () => {
                  await publishLpStep("lp_owner_reuse", 3);
                },
              );
              await withProfileSpan(
                "scan.deep.liquidity.lp_lock_reuse",
                { category: "rpc", stage: "liquidity", operation: "lock_reuse" },
                async () => {
                  await publishLpStep("lp_lock_reuse", 4);
                },
              );
              const wantMarket =
                knownFirstPlan.outcome === "known_first_price_only" ||
                knownFirstPlan.evidence.priceStale ||
                knownFirstPlan.evidence.tvlStale ||
                knownFirstPlan.evidence.poolStateStale;
              let reused: LpIntelligence = {
                ...current.overview.lpIntelligence!,
                positions: current.overview.lpIntelligence!.positions.map(
                  (p) => ({
                    ...p,
                  }),
                ),
              };
              if (wantMarket) {
                await withProfileSpan(
                  "scan.deep.liquidity.lp_market_refresh",
                  {
                    category: "api",
                    stage: "liquidity",
                    operation: "market_refresh",
                  },
                  async () => {
                    await ensureMarket();
                    if (signal.aborted) {
                      throw new DeepScanTimeoutError(
                        "Deep stage aborted: liquidity",
                      );
                    }
                    applyMarketToActivity();
                    await publishLpStep("lp_market_refresh", 5);
                    reused = enrichLp(reused);
                  },
                );
              }
              // Preserve honest Incomplete — never upgrade discoveryComplete here.
              reused.discoveryComplete =
                current.overview.lpIntelligence!.discoveryComplete;
              reused.exhaustiveDiscoveryComplete =
                current.overview.lpIntelligence!.exhaustiveDiscoveryComplete;
              if (
                !reused.discoverySources?.includes("known_first_early_exit")
              ) {
                reused.discoverySources = [
                  ...(reused.discoverySources ?? []),
                  "known_first_early_exit",
                ];
              }
              await withProfileSpan(
                "scan.deep.liquidity.lp_known_first_early_exit",
                {
                  category: "rpc",
                  stage: "liquidity",
                  operation: "known_first_early_exit",
                },
                async () => {
                  await publishLpStep("lp_known_first_early_exit", 6);
                },
              );
              await withProfileSpan(
                "scan.deep.liquidity.lp_final_validation",
                {
                  category: "cpu",
                  stage: "liquidity",
                  operation: "final_validation",
                },
                async () => {
                  await publishLpStep("lp_final_validation", 7);
                },
              );
              return {
                intelligence: reused,
                legacyStatus: legacyLpStatus(reused.aggregateState),
                geckoLiquidity: market.gecko.liquidityUsd,
                smartOutcome: knownFirstPlan.outcome,
                knownFirstOutcome: knownFirstPlan.outcome,
                skippedBroadQuick: true,
              };
            },
          );
        }

        if (
          !smartLpEnabled &&
          isKnownFirstSelectiveRevalidate(knownFirstPlan.outcome)
        ) {
          void ensureMarket();
          await publishLpStep(
            knownFirstPlan.outcome === "known_first_owner_revalidate"
              ? "lp_owner_revalidate"
              : "lp_owner_reuse",
            3,
          );
          const ids = knownFirstPlan.positionIdsToRevalidate
            .filter((id) => /^\d+$/.test(id))
            .map((id) => BigInt(id));
          for (const id of candidatePositionIds) ids.push(id);
          const uniqueIds = [...new Set(ids.map((x) => x.toString()))].map(
            (s) => BigInt(s),
          );
          const lp = await detectV4LpIntelligence({
            tokenAddress: address,
            poolManagerBalance,
            decimals,
            hintAddresses,
            candidatePositionIds: uniqueIds,
            knownPoolId: isHansome ? HANSOME_POOL_ID : null,
            exhaustiveDiscovery: false,
            quickDiscovery: false,
            skipQuickDiscoveryExpansion: true,
            skipBroadTitanSweep: true,
            revalidatePositionIds: uniqueIds,
          });
          await ensureMarket();
          if (signal.aborted) {
            throw new DeepScanTimeoutError("Deep stage aborted: liquidity");
          }
          applyMarketToActivity();
          const priorPositions =
            current.overview.lpIntelligence?.positions ?? [];
          const refreshedById = new Map(
            lp.intelligence.positions.map((p) => [p.positionNftId, p]),
          );
          const mergedPositions =
            priorPositions.length > 0
              ? priorPositions.map(
                  (p) => refreshedById.get(p.positionNftId) ?? p,
                )
              : lp.intelligence.positions;
          for (const [id, p] of refreshedById) {
            if (!mergedPositions.some((x) => x.positionNftId === id)) {
              mergedPositions.push(p);
            }
          }
          const merged: LpIntelligence = {
            ...lp.intelligence,
            positions: mergedPositions,
            discoveryComplete:
              current.overview.lpIntelligence?.discoveryComplete === true
                ? lp.intelligence.discoveryComplete
                : false,
            exhaustiveDiscoveryComplete:
              current.overview.lpIntelligence?.exhaustiveDiscoveryComplete ===
              true
                ? lp.intelligence.exhaustiveDiscoveryComplete
                : false,
          };
          if (
            !merged.discoverySources?.includes("known_first_selective")
          ) {
            merged.discoverySources = [
              ...(merged.discoverySources ?? []),
              "known_first_selective",
            ];
          }
          if (isHansome && hint.lockTxUrl && hint.positionNftId) {
            for (const p of merged.positions) {
              if (p.positionNftId === hint.positionNftId && !p.lockTxHash) {
                p.lockTxHash = hint.lockTxUrl.split("/tx/")[1] ?? null;
              }
            }
          }
          enrichLp(merged);
          // If selective revalidation destroyed sufficiency → full Quick.
          const post = knownFirstEvidenceSufficient(merged);
          if (!post.sufficient) {
            console.info(
              `[scan-deep] known-first selective insufficient (${post.reason}) → full Quick`,
            );
            // Fall through to multi-version path below.
          } else {
            await publishLpStep("lp_lock_revalidate", 4);
            await publishLpStep("lp_market_refresh", 5);
            await publishLpStep("lp_known_first_early_exit", 6);
            await publishLpStep("lp_final_validation", 7);
            return {
              intelligence: merged,
              legacyStatus: legacyLpStatus(merged.aggregateState),
              geckoLiquidity: market.gecko.liquidityUsd,
              smartOutcome: knownFirstPlan.outcome,
              knownFirstOutcome: knownFirstPlan.outcome,
              skippedBroadQuick: true,
            };
          }
        }

        // Phase 7.1 Smart LP structural reuse (only when explicitly enabled).
        if (
          smartLpEnabled &&
          isSmartLpStructuralReuse(smartPlan.outcome) &&
          current.overview.lpIntelligence
        ) {
          await ensureMarket();
          if (signal.aborted) {
            throw new DeepScanTimeoutError("Deep stage aborted: liquidity");
          }
          applyMarketToActivity();
          await publishLpStep("lp_event_delta_check", 2);
          await publishLpStep("lp_owner_reuse", 3);
          await publishLpStep("lp_lock_reuse", 4);
          if (
            smartPlan.outcome === "refresh_price_only" ||
            smartPlan.outcome === "refresh_pool_state" ||
            smartPlan.outcome === "reuse_all"
          ) {
            await publishLpStep(
              smartPlan.outcome === "refresh_pool_state"
                ? "lp_pool_state_refresh"
                : "lp_price_refresh",
              5,
            );
          }
          const reused = enrichLp({
            ...current.overview.lpIntelligence,
            positions: current.overview.lpIntelligence.positions.map((p) => ({
              ...p,
            })),
          });
          // Preserve honest Incomplete — never upgrade discoveryComplete here.
          reused.discoveryComplete = current.overview.lpIntelligence.discoveryComplete;
          reused.exhaustiveDiscoveryComplete =
            current.overview.lpIntelligence.exhaustiveDiscoveryComplete;
          if (
            !reused.discoverySources?.includes("smart_lp_structural_reuse")
          ) {
            reused.discoverySources = [
              ...(reused.discoverySources ?? []),
              "smart_lp_structural_reuse",
            ];
          }
          await publishLpStep("lp_final_validation", 6);
          return {
            intelligence: reused,
            legacyStatus: legacyLpStatus(reused.aggregateState),
            geckoLiquidity: market.gecko.liquidityUsd,
            smartOutcome: smartPlan.outcome,
          };
        }

        // Selective owner/lock: v4 known IDs only — skip Quick PM + broad Titan + v2/v3 probes.
        if (smartLpEnabled && isSmartLpSelectiveOwnerRefresh(smartPlan.outcome)) {
          // Overlap market APIs with selective owner revalidation.
          void ensureMarket();
          await publishLpStep("lp_event_delta_check", 2);
          await publishLpStep("lp_owner_refresh", 3);
          const ids = smartPlan.positionIdsToRevalidate
            .filter((id) => /^\d+$/.test(id))
            .map((id) => BigInt(id));
          for (const id of candidatePositionIds) ids.push(id);
          const uniqueIds = [...new Set(ids.map((x) => x.toString()))].map(
            (s) => BigInt(s),
          );
          const lp = await detectV4LpIntelligence({
            tokenAddress: address,
            poolManagerBalance,
            decimals,
            hintAddresses,
            candidatePositionIds: uniqueIds,
            knownPoolId: isHansome ? HANSOME_POOL_ID : null,
            exhaustiveDiscovery: false,
            quickDiscovery: false,
            skipQuickDiscoveryExpansion: true,
            skipBroadTitanSweep: true,
            revalidatePositionIds: uniqueIds,
          });
          await ensureMarket();
          if (signal.aborted) {
            throw new DeepScanTimeoutError("Deep stage aborted: liquidity");
          }
          applyMarketToActivity();
          // Merge refreshed positions into prior slots (preserve unrevalidated siblings).
          const priorPositions = current.overview.lpIntelligence?.positions ?? [];
          const refreshedById = new Map(
            lp.intelligence.positions.map((p) => [p.positionNftId, p]),
          );
          const mergedPositions =
            priorPositions.length > 0
              ? priorPositions.map(
                  (p) => refreshedById.get(p.positionNftId) ?? p,
                )
              : lp.intelligence.positions;
          for (const [id, p] of refreshedById) {
            if (!mergedPositions.some((x) => x.positionNftId === id)) {
              mergedPositions.push(p);
            }
          }
          const merged: LpIntelligence = {
            ...lp.intelligence,
            positions: mergedPositions,
            discoveryComplete:
              current.overview.lpIntelligence?.discoveryComplete === true
                ? lp.intelligence.discoveryComplete
                : false,
            exhaustiveDiscoveryComplete:
              current.overview.lpIntelligence?.exhaustiveDiscoveryComplete ===
              true
                ? lp.intelligence.exhaustiveDiscoveryComplete
                : false,
          };
          if (isHansome && hint.lockTxUrl && hint.positionNftId) {
            for (const p of merged.positions) {
              if (p.positionNftId === hint.positionNftId && !p.lockTxHash) {
                p.lockTxHash = hint.lockTxUrl.split("/tx/")[1] ?? null;
              }
            }
          }
          enrichLp(merged);
          await publishLpStep("lp_lock_refresh", 4);
          await publishLpStep("lp_price_refresh", 5);
          await publishLpStep("lp_checkpoint_update", 6);
          await publishLpStep("lp_final_validation", 7);
          return {
            intelligence: merged,
            legacyStatus: legacyLpStatus(merged.aggregateState),
            geckoLiquidity: market.gecko.liquidityUsd,
            smartOutcome: smartPlan.outcome,
          };
        }

        // Full Quick / full revalidation / cold / known-first insufficient — multi-version.
        // Phase 8: start Gecko/ETH-USD in parallel with multi-version discovery.
        void ensureMarket();
        if (!smartLpEnabled) {
          await publishLpStep("lp_full_quick_fallback", 3);
        } else {
          await publishLpStep("lp_event_delta_check", 2);
        }
        const lp = await detectMultiVersionLpIntelligence({
          tokenAddress: address,
          poolManagerBalance,
          decimals,
          hintAddresses,
          candidatePositionIds: [...candidatePositionIds],
          knownPoolId: isHansome ? HANSOME_POOL_ID : null,
          discoveryComplete: undefined,
          // Blocking path: Quick LP (bounded). Exhaustive only if budget ≥200s
          // or via background continuation after stage publish.
          exhaustiveDiscovery: allowExhaustive,
          quickDiscovery: smartPlan.outcome !== "cold_fallback",
          skipQuickDiscoveryExpansion: false,
          onVersionProbeProgress: async (event) => {
            await publish(
              current,
              `liquidity:probe:${event.version}`,
              Date.now() - lpMs,
              {
                stage: "liquidity",
                action: `probe_${event.version}`,
                completedUnits: event.completedProbes,
                totalUnits: Math.max(event.totalProbes, 6),
              },
            );
          },
          onQuickDiscoveryProgress: async (event) => {
            await publish(
              current,
              `liquidity:quick:${event.phase}`,
              Date.now() - lpMs,
              {
                stage: "liquidity",
                action: `quick_${event.phase}`,
                completedUnits: event.completedUnits,
                totalUnits: event.totalUnits,
              },
            );
          },
          onKnownPositions: async (partial) => {
            if (isHansome && hint.lockTxUrl && hint.positionNftId) {
              for (const p of partial.intelligence.positions) {
                if (p.positionNftId === hint.positionNftId && !p.lockTxHash) {
                  p.lockTxHash = hint.lockTxUrl.split("/tx/")[1] ?? null;
                }
              }
            }
            // Progressive publish: price if market already resolved; never block
            // discovery on Gecko (final enrich awaits market below).
            const intel = enrichLp(partial.intelligence);
            if (!intel) return;
            current = {
              ...current,
              analysisStatus: "deep_running",
              analysisStages: setStage(
                cloneStages(current.analysisStages),
                "liquidity",
                "analyzing",
              ),
              liquidityUsd:
                market.gecko.liquidityUsd != null
                  ? market.gecko.liquidityUsd
                  : current.liquidityUsd,
              overview: {
                ...current.overview,
                poolId: intel.poolId,
                lpLockStatus: partial.legacyStatus,
                lpLockDetail: intel.detail,
                lpIntelligence: intel,
              },
            };
            await publish(
              current,
              "liquidity:known-positions",
              Date.now() - lpMs,
              {
                stage: "liquidity",
                action: "known_positions",
                // Gradual — never jump to stage-complete units while still analyzing.
                completedUnits: Math.max(
                  4,
                  intel.positionCounts?.detected ?? intel.positions.length ?? 0,
                ),
                totalUnits: 6,
              },
            );
          },
        });
        if (isHansome && hint.lockTxUrl && hint.positionNftId) {
          for (const p of lp.intelligence.positions) {
            if (p.positionNftId === hint.positionNftId && !p.lockTxHash) {
              p.lockTxHash = hint.lockTxUrl.split("/tx/")[1] ?? null;
            }
          }
        }
        enrichLp(lp.intelligence);
        // Phase 13D: never downgrade verified LP after incomplete rediscovery.
        let finalIntel = preferVerifiedLpAgainstIncomplete(
          priorLpForRefresh,
          lp.intelligence,
        );
        const bootSources = bootstrapPackToDiscoverySources(knownBootstrap);
        for (const s of bootSources) {
          if (!finalIntel.discoverySources?.includes(s)) {
            finalIntel = {
              ...finalIntel,
              discoverySources: [...(finalIntel.discoverySources ?? []), s],
            };
          }
        }
        // Phase 13E — progressive stamp when multi already verified Locked (BEER Pons)
        // so liquidity stage timeout cannot wipe positions via empty soft-fail.
        if (
          finalIntel.positions.some(
            (p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN",
          )
        ) {
          current = {
            ...current,
            overview: {
              ...current.overview,
              poolId: finalIntel.poolId,
              lpLockStatus: legacyLpStatus(finalIntel.aggregateState),
              lpLockDetail: finalIntel.detail,
              lpIntelligence: finalIntel,
            },
          };
          await publish(
            current,
            "liquidity:verified-progressive",
            Date.now() - startedAt,
            {
              stage: "liquidity",
              action: "lp_final_validation",
              completedUnits: 5,
              totalUnits: 6,
            },
          );
        }
        await ensureMarket();
        if (signal.aborted) {
          throw new DeepScanTimeoutError("Deep stage aborted: liquidity");
        }
        applyMarketToActivity();
        await publishLpStep("lp_final_validation", 6);
        return {
          intelligence: finalIntel,
          legacyStatus: legacyLpStatus(finalIntel.aggregateState),
          geckoLiquidity: market.gecko.liquidityUsd,
          smartOutcome: smartLpEnabled
            ? smartPlan.outcome
            : knownFirstPlan.outcome,
          knownFirstOutcome: smartLpEnabled
            ? undefined
            : knownFirstPlan.outcome,
          skippedBroadQuick: false,
        };
          },
        );
        return result;
      },
      { attempt },
    );

    stages = setStage(
      cloneStages(current.analysisStages),
      "liquidity",
      "done",
    );
    current = {
      ...current,
      analysisStatus: "deep_running",
      analysisStages: stages,
      liquidityUsd:
        lpIntelligence.geckoLiquidity != null
          ? lpIntelligence.geckoLiquidity
          : current.liquidityUsd,
      overview: {
        ...current.overview,
        poolId: lpIntelligence.intelligence.poolId,
        lpLockStatus: lpIntelligence.legacyStatus,
        lpLockDetail: lpIntelligence.intelligence.detail,
        lpIntelligence: lpIntelligence.intelligence,
      },
    };
    // Phase 13D.1 — persist LP snapshot (IDs + evidence refs; always revalidate on reuse).
    void persistSnapshotFromLpPublish({
      chainId: ROBINHOOD_CHAIN_ID,
      tokenAddress: address,
      intelligence: lpIntelligence.intelligence,
      discoveryGeneration: attempt.deepAttemptId,
      publishGeneration: current.lpPublish?.lpGeneration ?? null,
    }).catch((err) => {
      console.warn("[scan-deep] persist LP snapshot failed:", err);
    });
    // Phase 10C-5: publish path → SUCCESS_TERMINAL when verified lock present.
    if (current.lpTerminal || hasVerifiedLockedResult(current)) {
      const contract = markLpTerminalPublishing(
        markLpTerminalRunning(
          current.lpTerminal ??
            beginLpTerminal({
              attemptId: attempt.deepAttemptId,
              generation: attempt.deepAttemptId,
              forceRefresh: false,
            }),
        ),
      );
      if (hasVerifiedLockedResult(current)) {
        current = applyLpHardTerminal(
          current,
          settleLpSuccessTerminal(contract),
        );
      } else if (contract.forceRefresh) {
        // Force done without verified lock: still a hard terminal (failed).
        const outcome = resolveLpInterruptOutcome({
          response: current,
          contract,
          interruptReason: "all_versions_failed",
        });
        current =
          outcome.kind === "recover"
            ? {
                ...outcome.response,
                analysisStages: {
                  ...outcome.response.analysisStages!,
                  // liquidity already "done" from discovery soft-complete — keep
                  // analyzing only when recovering for another attempt.
                  liquidity: "analyzing",
                },
              }
            : outcome.response;
      } else {
        current = { ...current, lpTerminal: contract };
      }
    }
    const liqDoneIncomplete =
      lpIntelligence.intelligence.discoveryComplete !== true;
    await publish(
      current,
      "liquidity:done",
      Date.now() - lpMs,
      {
        stage: "liquidity",
        action: "lp_final_validation",
        // Cap below 100% units while discovery incomplete (no fake jump).
        completedUnits: liqDoneIncomplete ? 5 : 6,
        totalUnits: 6,
      },
      { terminal: true },
    );

    // Background exhaustive continuation — persist proven IDs for warm repeats.
    // Does not block first useful Lock Dist; never restarts from scratch.
    const lpIntel = lpIntelligence.intelligence;
    if (
      !allowExhaustive &&
      lpIntel.poolDetected &&
      lpIntel.exhaustiveDiscoveryComplete !== true
    ) {
      await publish(current, "liquidity:bg-exhaustive", Date.now() - lpMs, {
        stage: "liquidity",
        action: "lp_background_exhaustive",
        completedUnits: liqDoneIncomplete ? 5 : 6,
        totalUnits: 6,
      });
      const bgAddress = address;
      const bgDecimals = decimals;
      const bgPoolBal = poolManagerBalance;
      const bgHints = [
        ...transparencyHintAddresses(bgAddress),
        ...(deployer ? [deployer] : []),
        ...topHolders
          .filter((h) => !h.excludedFromConcentration)
          .slice(0, 8)
          .map((h) => h.address),
      ];
      const bgHint = transparencyLockHint();
      const bgCandidates = [
        ...new Set<bigint>([
          ...knownPositionSeeds(bgAddress),
          ...(isHansome &&
          bgHint.positionNftId &&
          /^\d+$/.test(bgHint.positionNftId)
            ? [BigInt(bgHint.positionNftId)]
            : []),
        ]),
      ];
      scheduleLpExhaustiveBackground({
        tokenAddress: bgAddress,
        chainId: ROBINHOOD_CHAIN_ID,
        run: async () => {
          const { detectV4LpIntelligence } = await import(
            "@/lib/hansome-score/lp/detect"
          );
          await detectV4LpIntelligence({
            tokenAddress: bgAddress,
            poolManagerBalance: bgPoolBal,
            decimals: bgDecimals,
            hintAddresses: bgHints,
            candidatePositionIds: bgCandidates,
            knownPoolId: isHansome ? HANSOME_POOL_ID : null,
            quickDiscovery: false,
            exhaustiveDiscovery: true,
          });
        },
      });
    }
  } catch (err) {
    if (!stageFailedIndependently(err)) throw err;
    // Phase 10C-5: LP soft-fail never publishes PARTIAL_TERMINAL under force contract.
    // Continue remaining versions already handled inside multi; here settle contract.
    const interruptReason =
      err instanceof DeepScanTimeoutError ? "stage_timeout" : "stage_error";
    if (current.lpTerminal?.forceRefresh || hasVerifiedLockedResult(current)) {
      const contract =
        current.lpTerminal ??
        beginLpTerminal({
          attemptId: attempt.deepAttemptId,
          generation: attempt.deepAttemptId,
          forceRefresh: true,
        });
      const outcome = resolveLpInterruptOutcome({
        response: current,
        contract,
        interruptReason,
      });
      current = outcome.response;
      await publish(
        current,
        err instanceof DeepScanTimeoutError
          ? "liquidity:timeout"
          : "liquidity:error",
        Date.now() - startedAt,
        {
          stage: "liquidity",
          action:
            outcome.kind === "success"
              ? "done"
              : outcome.kind === "failed"
                ? "error"
                : "timeout",
          stalled: err instanceof DeepScanTimeoutError,
          stallReason:
            err instanceof DeepScanTimeoutError
              ? "liquidity_stage_timeout"
              : "liquidity_stage_error",
        },
        { terminal: outcome.kind !== "recover" },
      );
    } else {
      // Phase 13E.1: if Known-First already stamped Locked/Hook/useful PosM, do not wipe.
      if (
        hasVerifiedLockedResult(current) ||
        current.overview.lpIntelligence?.ownershipClass === "hook_native" ||
        ((current.overview.lpIntelligence?.positions?.length ?? 0) > 0 &&
          (current.overview.lpIntelligence?.ownershipClass === "posm_nft" ||
            (current.overview.lpIntelligence?.discoverySources ?? []).some((s) =>
              /titan|known_titan|registry_titan/i.test(s),
            )))
      ) {
        const kept = current.overview.lpIntelligence!;
        stages = setStage(cloneStages(current.analysisStages), "liquidity", "done");
        current = {
          ...current,
          analysisStages: stages,
          overview: {
            ...current.overview,
            poolId: kept.poolId,
            lpLockStatus: legacyLpStatus(kept.aggregateState),
            lpLockDetail: kept.detail,
            lpIntelligence: kept,
          },
        };
        await publish(
          current,
          "liquidity:known-first-preserved",
          Date.now() - startedAt,
          {
            stage: "liquidity",
            action: "lp_known_first_early_exit",
            completedUnits: 5,
            totalUnits: 6,
          },
          { terminal: true },
        );
      } else {
      stages = setStage(
        cloneStages(current.analysisStages),
        "liquidity",
        "partial",
      );
      // Soft-fail liquidity only — do not terminate creator/burn or other stages.
      const soft = markScanPartial(
        { ...current, analysisStages: stages },
        { reason: temporarilyUnavailableDetail("liquidity") },
      );
      // Prefer any prior verified / Hook evidence over empty timeout stub.
      // (priorLpForRefresh is try-scoped — re-load durable prior here for catch safety.)
      const priorIntel =
        current.overview.lpIntelligence ??
        (await loadPriorLpForForceDeep({ response: current })) ??
        null;
      const softIntel = soft.overview.lpIntelligence;
      const mergedIntel = softIntel
        ? preferVerifiedLpAgainstIncomplete(priorIntel, softIntel)
        : priorIntel;
      current = {
        ...soft,
        analysisStatus: "deep_running",
        analysisStages: {
          ...soft.analysisStages!,
          relationships:
            current.analysisStages?.relationships ??
            soft.analysisStages!.relationships,
          creator: current.analysisStages?.creator ?? soft.analysisStages!.creator,
          burn: current.analysisStages?.burn ?? soft.analysisStages!.burn,
          liquidity:
            mergedIntel &&
            (mergedIntel.positions.some(
              (p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN",
            ) ||
              mergedIntel.ownershipClass === "hook_native" ||
              ((mergedIntel.positions?.length ?? 0) > 0 &&
                (mergedIntel.ownershipClass === "posm_nft" ||
                  (mergedIntel.discoverySources ?? []).some((s) =>
                    /titan|known_titan|registry_titan/i.test(s),
                  ))))
              ? "done"
              : "partial",
          score:
            current.analysisStages?.score === "done"
              ? "done"
              : soft.analysisStages!.score,
        },
        overview: {
          ...soft.overview,
          ...(mergedIntel
            ? {
                poolId: mergedIntel.poolId,
                lpLockStatus: legacyLpStatus(mergedIntel.aggregateState),
                lpLockDetail: mergedIntel.detail,
                lpIntelligence: mergedIntel,
              }
            : {}),
        },
      };
      await publish(
        current,
        err instanceof DeepScanTimeoutError
          ? "liquidity:timeout"
          : "liquidity:error",
        Date.now() - startedAt,
        {
          stage: "liquidity",
          action: err instanceof DeepScanTimeoutError ? "timeout" : "error",
          stalled: err instanceof DeepScanTimeoutError,
          stallReason:
            err instanceof DeepScanTimeoutError
              ? "liquidity_stage_timeout"
              : "liquidity_stage_error",
        },
        { terminal: true },
      );
      }
    }
  }
  };

  // Creator + Burn share one transfer-index job (never double-fetch pages).
  const runCreatorBurnJob = async () => {
    if (skipCreatorBurn) {
      console.info(
        `[scan-deep] skip creatorBurn (warm=${warmPlan.path} action=${warmPlan.creatorBurn})`,
      );
      return;
    }
    await publish(
      {
        ...current,
        analysisStages: setStage(
          setStage(cloneStages(current.analysisStages), "creator", "analyzing"),
          "burn",
          "analyzing",
        ),
        analysisStatus: "deep_running",
      },
      "creatorBurn:start",
      Date.now() - startedAt,
      {
        stage: "creatorBurn",
        action:
          warmPlan.path === "warm"
            ? warmEligibility.needsHeadRefresh
              ? "head_overlap_refresh"
              : "creator_burn_recompute"
            : "start",
        completedUnits: 0,
        totalUnits: maxTransferPages,
        pagesFetched: 0,
        transfersIndexed: 0,
      },
    );

    try {
      const cbMs = Date.now();
      const totalSupply =
        current.overview.totalSupplyRaw != null
          ? BigInt(current.overview.totalSupplyRaw)
          : null;
      const decimals = current.overview.decimals;

      const { creatorBehaviour, supplyBurn } = await withStageBudget(
        "creatorBurn",
        DEEP_STAGE_BUDGET_MS.creatorBurn,
        deadline,
        async (signal) => {
          // Phase 4 recent-first: publish honest Incomplete after recent tier,
          // then continue historical within budget. Never claim Complete early.
          const publishCreatorBurnPages = async (partial: {
            pagesFetched: number;
            transfersIndexed: number;
            transfers: Awaited<
              ReturnType<typeof fetchTokenTransfersWithCheckpoint>
            >["transfers"];
            paginationComplete: boolean;
            fetchFailed: boolean;
            label: string;
          }) => {
            const earlyCreator = analyzeCreatorBehaviour({
              deployer: current.overview.deployer,
              totalSupply,
              transfers: partial.transfers,
              paginationComplete: partial.paginationComplete,
              fetchFailed: partial.fetchFailed,
              pagesFetched: partial.pagesFetched,
            });
            const earlyBurn = await enrichSupplyBurnWithHistory({
              supplyBurn: current.overview.supplyBurn,
              tokenAddress: address,
              transfers: partial.transfers,
              pagesFetched: partial.pagesFetched,
              paginationComplete: partial.paginationComplete,
              fetchFailed: partial.fetchFailed,
              decimals,
            });
            const earlyStages = setStage(
              setStage(
                cloneStages(current.analysisStages),
                "creator",
                "analyzing",
              ),
              "burn",
              "analyzing",
            );
            await publish(
              {
                ...current,
                analysisStatus: "deep_running",
                analysisStages: earlyStages,
                overview: {
                  ...current.overview,
                  creatorBehaviour: earlyCreator,
                  supplyBurn: earlyBurn,
                },
              },
              partial.label,
              Date.now() - cbMs,
              {
                stage: "creatorBurn",
                action: partial.label.includes("recent")
                  ? "recent_tier"
                  : "page",
                completedUnits: partial.pagesFetched,
                totalUnits: maxTransferPages,
                pagesFetched: partial.pagesFetched,
                transfersIndexed: partial.transfersIndexed,
              },
            );
          };

          let lastPagePublish = 0;
          let lastPageInFetch = 0;
          const transferIndex = await fetchTokenTransfersWithCheckpoint({
            tokenAddress: address,
            maxPages: maxTransferPages,
            lockTtlSec: Math.ceil(DEEP_STAGE_BUDGET_MS.creatorBurn / 1000) + 30,
            shouldContinue: () =>
              remainingMs(deadline) > 2_000 && !signal.aborted,
            signal,
            recentFirst: true,
            onPageProgress: async (event) => {
              // Per-page Scan publish — real work units for gradual bars.
              // Head refresh: prefer pageInFetch / pagesFetchedThisCall monotonicity.
              const pageKey =
                event.pagesFetchedThisCall ?? event.pageInFetch ?? 0;
              if (
                event.pagesFetchedTotal <= lastPagePublish &&
                pageKey <= lastPageInFetch
              ) {
                return;
              }
              lastPagePublish = Math.max(
                lastPagePublish,
                event.pagesFetchedTotal,
              );
              lastPageInFetch = Math.max(lastPageInFetch, pageKey);
              const creator =
                current.overview.creatorBehaviour ??
                analyzeCreatorBehaviour({
                  deployer: current.overview.deployer,
                  totalSupply,
                  transfers: [],
                  paginationComplete: false,
                  fetchFailed: false,
                  pagesFetched: 0,
                });
              const burnActivity = current.overview.supplyBurn?.burnActivity;
              await publish(
                {
                  ...current,
                  analysisStatus: "deep_running",
                  analysisStages: setStage(
                    setStage(
                      cloneStages(current.analysisStages),
                      "creator",
                      "analyzing",
                    ),
                    "burn",
                    "analyzing",
                  ),
                  overview: {
                    ...current.overview,
                    creatorBehaviour: {
                      ...creator,
                      status: "incomplete",
                      available: false,
                      pagesFetched: Math.max(
                        creator.pagesFetched ?? 0,
                        event.pagesFetchedTotal,
                      ),
                      transfersIndexed: Math.max(
                        creator.transfersIndexed ?? 0,
                        event.transfersIndexed,
                      ),
                      paginationComplete: false,
                    },
                    supplyBurn: current.overview.supplyBurn
                      ? {
                          ...current.overview.supplyBurn,
                          burnActivity: burnActivity
                            ? {
                                ...burnActivity,
                                pagesFetched: Math.max(
                                  burnActivity.pagesFetched ?? 0,
                                  event.pagesFetchedTotal,
                                ),
                                transfersIndexed: Math.max(
                                  burnActivity.transfersIndexed ?? 0,
                                  event.transfersIndexed,
                                ),
                                paginationComplete: false,
                                headIndexed: event.pagesFetchedTotal > 0,
                                source: "transfer_index" as const,
                              }
                            : burnActivity,
                        }
                      : current.overview.supplyBurn,
                  },
                },
                `creatorBurn:page:${event.pagesFetchedTotal}`,
                Date.now() - cbMs,
                {
                  stage: "creatorBurn",
                  action: `page_${event.pipelinePhase}`,
                  completedUnits: event.pagesFetchedTotal,
                  totalUnits: maxTransferPages,
                  pagesFetched: event.pagesFetchedTotal,
                  transfersIndexed: event.transfersIndexed,
                },
              );
            },
            onRecentTier: async (partial) => {
              // Early meaningful progress — stages stay analyzing until final.
              // paginationComplete is false unless genesis exhausted in-tier.
              await publishCreatorBurnPages({
                pagesFetched: partial.pagesFetched,
                transfersIndexed: partial.transfers.length,
                transfers: partial.transfers,
                paginationComplete: partial.paginationComplete,
                fetchFailed: partial.fetchFailed,
                label: "creatorBurn:recent",
              });
            },
          });
          const stats = transferIndex.stats;
          console.info(
            `[scan-deep] transferIndex mode=${transferIndex.fetchMode}` +
              ` phase=${transferIndex.pipelinePhase ?? "n/a"}` +
              ` rpcPages=${stats?.rpcPagesThisCall ?? transferIndex.rpcPagesThisCall ?? 0}` +
              ` recent=${stats?.recentTierPages ?? 0}` +
              ` hist=${stats?.historicalPagesThisCall ?? 0}` +
              ` skipped=${stats?.skippedPages ?? 0}` +
              ` complete=${transferIndex.paginationComplete}` +
              ` pendingHist=${transferIndex.historicalContinuationPending === true}`,
          );
          if (transferIndex.historicalContinuationPending === true) {
            scheduleTransferIndexBackgroundRefresh({
              tokenAddress: address,
              maxPages: 10,
              forceResume: true,
            });
            await publish(current, "creatorBurn:bg_hist", Date.now() - cbMs, {
              stage: "creatorBurn",
              action: "background_history_resume",
              completedUnits: transferIndex.pagesFetched,
              totalUnits: maxTransferPages,
              pagesFetched: transferIndex.pagesFetched,
              transfersIndexed: transferIndex.transfers.length,
            });
          }
          if (
            (transferIndex.stats?.newTransfersMerged ?? 0) > 0 ||
            transferIndex.fetchMode === "head_refresh"
          ) {
            await publish(current, "creatorBurn:merge", Date.now() - cbMs, {
              stage: "creatorBurn",
              action: "new_transfers_merge",
              completedUnits: transferIndex.pagesFetched,
              totalUnits: maxTransferPages,
              pagesFetched: transferIndex.rpcPagesThisCall,
              transfersIndexed: transferIndex.transfers.length,
            });
          }
          const creatorBehaviour = analyzeCreatorBehaviour({
            deployer: current.overview.deployer,
            totalSupply,
            transfers: transferIndex.transfers,
            paginationComplete: transferIndex.paginationComplete,
            fetchFailed: transferIndex.fetchFailed,
            pagesFetched: transferIndex.pagesFetched,
          });
          const supplyBurn = await enrichSupplyBurnWithHistory({
            supplyBurn: current.overview.supplyBurn,
            tokenAddress: address,
            transfers: transferIndex.transfers,
            pagesFetched: transferIndex.pagesFetched,
            paginationComplete: transferIndex.paginationComplete,
            fetchFailed: transferIndex.fetchFailed,
            decimals,
          });
          return { creatorBehaviour, supplyBurn };
        },
        { attempt },
      );

      stages = setStage(
        setStage(cloneStages(current.analysisStages), "creator", "done"),
        "burn",
        "done",
      );
      current = {
        ...current,
        analysisStatus: "deep_running",
        analysisStages: stages,
        overview: {
          ...current.overview,
          creatorBehaviour,
          supplyBurn,
        },
      };
      await publish(
        current,
        "creatorBurn:done",
        Date.now() - cbMs,
        {
          stage: "creatorBurn",
          action:
            warmPlan.path === "warm" ? "creator_burn_recompute" : "done",
          completedUnits: creatorBehaviour.pagesFetched,
          totalUnits: maxTransferPages,
          pagesFetched: creatorBehaviour.pagesFetched,
          transfersIndexed: creatorBehaviour.transfersIndexed,
        },
        { terminal: true },
      );
    } catch (err) {
      if (!stageFailedIndependently(err)) throw err;
      // Preserve any stage that was already complete before this attempt's work.
      stages = setStage(
        setStage(
          cloneStages(current.analysisStages),
          "creator",
          creatorDone ? "done" : "partial",
        ),
        "burn",
        burnDone ? "done" : "partial",
      );
      // Surface checkpointed progress so timeout does not leave pagesFetched=0.
      // Bound this await — never block soft-fail publish on a hung KV read.
      const progress = await Promise.race([
        loadTransferIndexProgress(address),
        new Promise<{ pagesFetched: number; transfersIndexed: number }>(
          (resolve) =>
            setTimeout(
              () => resolve({ pagesFetched: 0, transfersIndexed: 0 }),
              2_000,
            ),
        ),
      ]);
      let softBase: ScanResponse = {
        ...current,
        analysisStatus: "deep_running",
        analysisStages: stages,
      };
      if (progress.pagesFetched > 0) {
        const creator = softBase.overview.creatorBehaviour;
        const burnActivity = softBase.overview.supplyBurn?.burnActivity;
        softBase = {
          ...softBase,
          overview: {
            ...softBase.overview,
            creatorBehaviour: creator
              ? {
                  ...creator,
                  status: "incomplete",
                  available: false,
                  pagesFetched: Math.max(
                    creator.pagesFetched ?? 0,
                    progress.pagesFetched,
                  ),
                  transfersIndexed: Math.max(
                    creator.transfersIndexed ?? 0,
                    progress.transfersIndexed,
                  ),
                  paginationComplete: false,
                }
              : creator,
            supplyBurn: softBase.overview.supplyBurn
              ? {
                  ...softBase.overview.supplyBurn,
                  burnActivity: burnActivity
                    ? {
                        ...burnActivity,
                        pagesFetched: Math.max(
                          burnActivity.pagesFetched ?? 0,
                          progress.pagesFetched,
                        ),
                        transfersIndexed: Math.max(
                          burnActivity.transfersIndexed ?? 0,
                          progress.transfersIndexed,
                        ),
                        paginationComplete: false,
                        headIndexed: progress.pagesFetched > 0,
                        source: "transfer_index" as const,
                      }
                    : burnActivity,
                }
              : softBase.overview.supplyBurn,
          },
        };
      }
      current = applyCreatorBurnSoftFail(softBase);
      await publish(
        current,
        err instanceof DeepScanTimeoutError
          ? "creatorBurn:timeout"
          : "creatorBurn:error",
        Date.now() - startedAt,
        {
          stage: "creatorBurn",
          action: err instanceof DeepScanTimeoutError ? "timeout" : "error",
          pagesFetched: progress.pagesFetched,
          transfersIndexed: progress.transfersIndexed,
          completedUnits: progress.pagesFetched,
          totalUnits: maxTransferPages,
          stalled: err instanceof DeepScanTimeoutError,
          stallReason:
            err instanceof DeepScanTimeoutError
              ? "creatorBurn_stage_timeout"
              : "creatorBurn_stage_error",
        },
        { terminal: true },
      );
    }
  };

  const markAnalyzingStagesPartial = (reason: string) => {
    let nextStages = cloneStages(current.analysisStages);
    // Phase 10C-5: never transition LP RUNNING → PARTIAL_TERMINAL from watchdog/hard-bound.
    // Liquidity stays analyzing until SUCCESS_TERMINAL / FAILED_TERMINAL / recovery.
    const protectLp =
      isLpForceRefreshActive(current) ||
      current.analysisStages?.liquidity === "analyzing";
    for (const id of [
      "relationships",
      "liquidity",
      "creator",
      "burn",
    ] as const) {
      if (id === "liquidity" && protectLp) continue;
      if (nextStages[id] === "analyzing" || nextStages[id] === "pending") {
        nextStages = setStage(nextStages, id, "partial");
      }
    }
    let next: ScanResponse = {
      ...current,
      analysisStages: nextStages,
      analysisStatus: "deep_running",
      disclaimers: [
        ...(current.disclaimers ?? []),
        temporarilyUnavailableDetail(reason),
      ].filter((d, i, arr) => arr.indexOf(d) === i),
    };
    const protectContract = asLpTerminalContract(next.lpTerminal);
    if (protectLp && protectContract) {
      const outcome = resolveLpInterruptOutcome({
        response: next,
        contract: protectContract,
        interruptReason:
          reason === "watchdog_timeout" || reason === "parallel_hard_bound"
            ? (reason as "watchdog_timeout" | "parallel_hard_bound")
            : "stage_timeout",
      });
      if (outcome.kind === "success" || outcome.kind === "failed") {
        next = outcome.response;
      } else {
        next = {
          ...outcome.response,
          analysisStages: {
            ...outcome.response.analysisStages!,
            liquidity: "analyzing",
          },
          analysisStatus: "deep_running",
        };
      }
    }
    current = next;
  };

  try {
    // True parallel wave: Relationships ∥ Liquidity ∥ CreatorBurn → then Score.
    const parallelSpan = beginProfileSpan("scan.deep.parallel_wave", {
      category: "sequential",
      stage: "parallel",
      operation: "runParallelDeepJobs",
    });
    try {
      await runParallelDeepJobs(
        [
          {
            id: "relationships",
            skip: skipRelationships,
            run: () =>
              withProfileSpan(
                "scan.deep.relationships",
                { category: "blockscout", stage: "relationships" },
                () => runRelationshipsJob(),
              ),
          },
          {
            id: "liquidity",
            skip: skipLiquidity,
            run: () =>
              withProfileSpan(
                "scan.deep.liquidity",
                { category: "rpc", stage: "liquidity" },
                () => runLiquidityJob(),
              ),
          },
          {
            id: "creatorBurn",
            skip: skipCreatorBurn,
            run: () =>
              withProfileSpan(
                "scan.deep.creatorBurn",
                { category: "blockscout", stage: "creatorBurn" },
                () => runCreatorBurnJob(),
              ),
          },
        ],
        {
          attempt,
          // Phase 13D.2 — adaptive hard bound (extends while discovery can progress).
          hardBoundMs: computeAdaptiveHardBoundMs({
            remainingDeadlineMs: remainingMs(deadline),
            adaptiveLiquidityMaxMs: ADAPTIVE_LIQUIDITY_BUDGET.maxBudgetMs + 5_000,
          }),
          onHardBound: () => {
            markAnalyzingStagesPartial("parallel_hard_bound");
            void publish(
              current,
              "parallel:hard_bound",
              Date.now() - startedAt,
              {
                stage: "partial",
                action: "watchdog_timeout",
                stalled: true,
                stallReason: "parallel_hard_bound",
              },
              { terminal: true },
            );
          },
        },
      );
      endProfileSpan(parallelSpan, "completed");
    } catch (err) {
      endProfileSpan(parallelSpan, "aborted");
      throw err;
    }

    // If cancel/watchdog left stages analyzing, settle them before score.
    if (
      attempt.isCancelled() ||
      current.analysisStages?.relationships === "analyzing" ||
      current.analysisStages?.liquidity === "analyzing" ||
      current.analysisStages?.creator === "analyzing" ||
      current.analysisStages?.burn === "analyzing"
    ) {
      markAnalyzingStagesPartial(
        attempt.cancelReason() === "watchdog_timeout"
          ? "watchdog_timeout"
          : "stage_unsettled",
      );
    }

    // —— Finalize scores (depends on parallel wave) ——
    // Entire finalize is hard-bounded so score:analyzing can never stick.
    const attachProfileIfEnabled = () => {
      if (!isCriticalPathProfileEnabled()) return;
      try {
        current.criticalPathProfile = buildCriticalPathCompact();
      } catch {
        /* diagnostics only */
      }
    };
    const finalize = async (): Promise<ScanResponse> => {
      stages = setStage(
        cloneStages(current.analysisStages),
        "score",
        "analyzing",
      );
      current = {
        ...current,
        analysisStages: stages,
        analysisStatus: "deep_running",
      };
      await publish(current, "score:start", Date.now() - startedAt, {
        stage: "score",
        action: "analyzing",
      });
      try {
        // Phase 8: skip duplicate Gecko when liquidity already applied market this attempt.
        if (!liqMarketAppliedThisDeep) {
          const gecko = await withProfileSpan(
            "scan.deep.score.gecko",
            { category: "api", stage: "score", operation: "gecko_overlay" },
            async () =>
              Promise.race([
                fetchOptionalGeckoActivity(address, {
                  signal: AbortSignal.timeout(8_000),
                }),
                new Promise<null>((resolve) =>
                  setTimeout(() => resolve(null), 8_500),
                ),
              ]),
          );
          if (gecko?.source != null) {
            const activity = computeActivity({
              volume24hUsd: gecko.volume24hUsd,
              transactions24h: gecko.transactions24h,
              transfersCount: current.overview.transfersCount,
              volumeSource: gecko.source,
            });
            current = {
              ...current,
              activity,
              liquidityUsd:
                gecko.liquidityUsd != null
                  ? gecko.liquidityUsd
                  : current.liquidityUsd,
              hansomeLevel: hansomeLevelFromActivity(activity.level),
            };
          }
        } else {
          const reuseSpan = beginProfileSpan("scan.deep.score.gecko", {
            category: "dup",
            stage: "score",
            operation: "gecko_reuse_from_liquidity",
          });
          endProfileSpan(reuseSpan, "reused_cache", { cacheHit: true });
        }
      } catch {
        /* keep prior activity */
      }

      try {
        await withProfileSpan(
          "scan.deep.score.recompute",
          { category: "cpu", stage: "score", operation: "recomputeScores" },
          async () => {
            current = recomputeScores(current);
          },
        );
      } catch (err) {
        console.warn("[scan-deep] recomputeScores failed; keeping prior:", err);
      }
      stages = setStage(cloneStages(current.analysisStages), "score", "done");
      current = { ...current, analysisStages: stages };

      if (hasUnresolvedDeepStages(stages)) {
        // Phase 10C-5: force LP still analyzing → recover path (not PARTIAL_TERMINAL).
        if (
          current.lpTerminal?.forceRefresh &&
          (stages.liquidity === "analyzing" ||
            stages.liquidity === "pending" ||
            current.lpTerminal.terminalState === "RUNNING")
        ) {
          const outcome = resolveLpInterruptOutcome({
            response: { ...current, analysisStages: stages },
            contract: current.lpTerminal,
            interruptReason: hasVerifiedLockedResult(current)
              ? "verified_lock_published"
              : "stage_timeout",
          });
          current = {
            ...outcome.response,
            analysisStages: {
              ...outcome.response.analysisStages!,
              score: "done",
            },
          };
          attachProfileIfEnabled();
          await publish(
            current,
            outcome.kind === "failed"
              ? "partial"
              : outcome.kind === "success"
                ? "complete"
                : "liquidity:timeout",
            Date.now() - startedAt,
            {
              stage: outcome.kind === "recover" ? "liquidity" : "partial",
              action: "settled",
            },
            { terminal: outcome.kind !== "recover" },
          );
          return current;
        }
        current = markScanPartial(current, {
          reason:
            "Deep analysis finished with some stages unavailable — Fast Scan and completed deep sections preserved.",
        });
        // Preserve hard LP terminals from markScanPartial regression.
        if (
          current.lpTerminal?.terminalState === "SUCCESS_TERMINAL" ||
          current.lpTerminal?.terminalState === "FAILED_TERMINAL"
        ) {
          current = applyLpHardTerminal(current, current.lpTerminal);
        } else if (current.lpTerminal?.forceRefresh) {
          const outcome = resolveLpInterruptOutcome({
            response: current,
            contract: current.lpTerminal,
            interruptReason: hasVerifiedLockedResult(current)
              ? "verified_lock_published"
              : "recovery_exhausted",
          });
          current = outcome.response;
        }
        // Phase 13E.1: never let a stale `stages` snapshot overwrite Known-First
        // liquidity:done / Hook terminal with analyzing/partial.
        current = {
          ...current,
          analysisStages: {
            ...stages,
            ...current.analysisStages!,
            score: "done",
            ...(current.lpTerminal?.terminalState === "SUCCESS_TERMINAL" ||
            hasVerifiedLockedResult(current) ||
            current.overview.lpIntelligence?.ownershipClass === "hook_native"
              ? {
                  liquidity:
                    current.analysisStages?.liquidity === "done" ||
                    current.analysisStages?.liquidity === "unknown"
                      ? current.analysisStages.liquidity
                      : ("done" as const),
                }
              : current.lpTerminal?.terminalState === "FAILED_TERMINAL"
                ? { liquidity: "unknown" as const }
                : {}),
          },
        };
        console.info(
          `[scan-deep] partial ${address} totalMs=${Date.now() - startedAt}`,
        );
        attachProfileIfEnabled();
        await publish(
          current,
          "partial",
          Date.now() - startedAt,
          {
            stage: "partial",
            action: "settled",
          },
          { terminal: true },
        );
        return current;
      }

      current = markScanComplete({
        ...current,
        analysisStages: { ...DEEP_SCAN_STAGES_COMPLETE },
      });

      console.info(
        `[scan-deep] complete ${address} totalMs=${Date.now() - startedAt}`,
      );
      attachProfileIfEnabled();
      await publish(
        current,
        "complete",
        Date.now() - startedAt,
        {
          stage: "complete",
          action: warmPlan.path === "warm" ? "final_validation" : "complete",
        },
        { terminal: true },
      );
      return current;
    };

    try {
      const finalized = await Promise.race([
        finalize(),
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 20_000),
        ),
      ]);
      if (finalized) return finalized;
      console.warn(
        `[scan-deep] score finalize hard bound — settling partial ${address}`,
      );
      try {
        current = recomputeScores(current);
      } catch {
        /* keep */
      }
      current = markScanPartial(current, {
        reason:
          "Deep score finalize timed out — Fast Scan and completed deep sections preserved.",
      });
      current = {
        ...current,
        analysisStages: {
          ...current.analysisStages!,
          score: "done",
        },
      };
      await publish(
        current,
        "partial",
        Date.now() - startedAt,
        {
          stage: "partial",
          action: "settled",
        },
        { terminal: true },
      );
      return current;
    } catch (err) {
      console.warn("[scan-deep] finalize error — settling partial:", err);
      try {
        current = recomputeScores(current);
      } catch {
        /* keep */
      }
      current = markScanPartial(current, {
        reason:
          "Deep finalize failed — Fast Scan and completed deep sections preserved.",
      });
      await publish(
        current,
        "partial",
        Date.now() - startedAt,
        {
          stage: "partial",
          action: "settled",
        },
        { terminal: true },
      );
      return current;
    }
  } finally {
    attempt.markFinalized();
    unregisterDeepAttempt(attempt);
    if (isDeepProfileEnabled() || isCriticalPathProfileEnabled()) {
      noteCriticalPathMeta({
        attemptId: attempt.deepAttemptId,
        scanId: attempt.deepAttemptId,
      });
      const summary = buildDeepProfileSummary();
      console.info(
        JSON.stringify({
          type: "deep_profile_summary",
          token: address,
          deepAttemptId: attempt.deepAttemptId,
          totalMs: Date.now() - startedAt,
          criticalPath: summary.criticalPath,
          byCategoryMs: summary.byCategoryMs,
          spanCount: summary.spans.length,
        }),
      );
      if (isCriticalPathProfileEnabled()) {
        const full = buildCriticalPathReport();
        const compact = buildCriticalPathCompact();
        console.info(
          JSON.stringify({
            type: "critical_path_profile",
            token: address,
            deepAttemptId: attempt.deepAttemptId,
            totalWallMs: Date.now() - startedAt,
            criticalPath: full.criticalPath,
            stages: full.stages,
            rpcByProvider: full.rpcByProvider,
            top10LongestNodes: full.top30LongestNodes.slice(0, 10),
            top10LongestRpcs: full.top10LongestRpcs,
            parallelUtilizationPct: full.parallelUtilizationPct,
            nodeCount: full.nodes.length,
          }),
        );
        // Mutate in place so the already-returned ScanResponse reference carries it.
        current.criticalPathProfile = compact;
      }
    }
    endProfileSpan(rootSpan, "completed");
  }
}
