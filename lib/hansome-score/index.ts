export { scanToken, assertValidTokenAddress } from "@/lib/hansome-score/scan";
export {
  scanTokenFast,
  markScanComplete,
  isScanComplete,
  isDeepInProgress,
} from "@/lib/hansome-score/scan-fast";
export {
  MAX_DEEP_AUTO_RETRIES,
  assignDeepAttempt,
  isDeepRetryable,
  isDeepCollecting,
  needsDeepWork,
  hasRetryableUnresolvedStages,
  mergeMonotonicDeepRetryCount,
  mergeMonotonicAnalysisStages,
  preferStageState,
  preferAuthoritativeDeepResponse,
  rearmPartialForDeepRetry,
  retireDeepAttempt,
  bumpDeepRetryCount,
  shouldAcceptDeepProgress,
  shouldAcceptDeepSettle,
  shouldRejectUnfencedDeepWrite,
} from "@/lib/hansome-score/scan-progress";
export {
  getCachedScan,
  getScanAnalysisStatus,
  scheduleDeepAnalysis,
  ensureDeepAnalysis,
  peekScanSnapshot,
  recoverStaleDeepIfNeeded,
  SCAN_FULL_TTL_MS,
  SCAN_STALE_TTL_MS,
  DEEP_SCAN_MAX_EXECUTION_MS,
  DEEP_STALE_THRESHOLD_MS,
  markScanPartial,
  isDeepStale,
} from "@/lib/hansome-score/scan-cache";
export type { CachedScanResponse } from "@/lib/hansome-score/scan-cache";
export {
  computeStructuralScore,
  largestEqualBalanceCluster,
  computeConcentration,
} from "@/lib/hansome-score/score";
export { computeActivity } from "@/lib/hansome-score/activity";
export {
  toHansomeLevel,
  hansomeLevelFromActivity,
  HANSOME_LEVEL_CATALOG,
} from "@/lib/hansome-score/hansome-level";
export {
  computeOverallTokenScore,
  scoreLiquidityDepth,
  scoreHolderAdoption,
  scoreActivityHealth,
  scoreMaturity,
  applyStructuralSafetyGate,
  OVERALL_WEIGHTS,
  OVERALL_SCORE_VERSION,
} from "@/lib/hansome-score/overall";
export {
  getOverallScoreBand,
  OVERALL_SCORE_BANDS,
  OVERALL_SCORE_BAND_LEGEND,
  OVERALL_SCORE_BAND_LEGEND_LINES,
} from "@/lib/hansome-score/overall-band";
export type {
  OverallScoreBand,
  OverallScoreBandId,
} from "@/lib/hansome-score/overall-band";
export {
  computeConfidence,
  confidenceBand,
  scoreContractCoverage,
  scoreLiquidityCoverage,
  scoreHolderCoverage,
  scoreWalletCoverage,
  scoreCreatorCoverage,
  isCoreEconomicLpEvidenceComplete,
  hasTrueMultiVersionCoverageGap,
} from "@/lib/hansome-score/confidence";
export { analyzeContractRisk } from "@/lib/hansome-score/contract-risk";
export {
  analyzeSupplyBurnIntelligence,
  analyzeSupplyBurnFromParts,
  enrichSupplyBurnWithHistory,
  detectBurnMechanisms,
  aggregateKnownBurned,
  computeBurnActivityHistory,
  computeSupplyReductionHistory,
  peekBurnHistoryBundle,
  BURN_HISTORY_TTL_MS,
} from "@/lib/hansome-score/supply-burn";
export {
  detectV4LpIntelligence,
  aggregateLockStates,
  computeTokenAggregate,
  computeLockDistribution,
  countPositionLocks,
} from "@/lib/hansome-score/lp/detect";
export {
  detectMultiVersionLpIntelligence,
  buildUniswapVersionCoverage,
  computeMultiVersionAggregate,
} from "@/lib/hansome-score/lp/multi";
export {
  emptyUniswapVersionCoverage,
  testCompleteVersionCoverage,
} from "@/lib/hansome-score/lp/coverage";
export { analyzeCreatorBehaviour } from "@/lib/hansome-score/creator";
export {
  SCORE_SPEC_VERSION,
  SCORE_SPEC_VERSION_WEEK1_FROZEN,
  HANSOME_TOKEN,
  SCAN_CHAIN_ID,
} from "@/lib/hansome-score/constants";
export type {
  ScanResponse,
  ScanCacheMeta,
  ScoreResult,
  OverallScoreResult,
  ActivityResult,
  HansomeLevelResult,
  HansomeLevelId,
  ConfidenceResult,
  ConfidenceDimension,
  ConfidenceBand,
  TokenOverview,
  LpLockState,
  LpAggregateState,
  LpIntelligence,
  CreatorBehaviourResult,
  SupplyBurnIntelligence,
} from "@/lib/hansome-score/types";

