import type { TokenContextMetadata } from "@/lib/hansome-taxonomy/types";
import type { SupplyBurnIntelligence } from "@/lib/hansome-score/supply-burn/types";

export type ActivityLevel = "Low" | "Medium" | "High";

export type { TokenContextMetadata };

export type {
  SupplyBurnIntelligence,
  BurnMechanism,
  BurnAddressBalance,
  TriState as SupplyBurnTriState,
  EffectiveRemainingMethod,
} from "@/lib/hansome-score/supply-burn/types";

export type RiskFlagSeverity = "info" | "warning" | "risk";

export type DeductionCategory =
  | "contract_risk"
  | "liquidity_ownership"
  | "holder_concentration"
  | "wallet_relationship"
  | "launch_fairness"
  | "creator_behaviour";

/** Position-level lock states — never map unknown → unlocked. */
export type LpLockState =
  | "LOCKED_VERIFIED_ONCHAIN"
  | "UNLOCKED_EOA_CONTROLLED"
  | "LOCK_DETECTED_EXPIRY_UNKNOWN"
  | "UNSUPPORTED_LOCKER"
  | "UNABLE_TO_DETERMINE"
  | "NONE"
  | "MIXED";

export type LpLockStateDisplay =
  | "LOCKED — VERIFIED ON-CHAIN"
  | "UNLOCKED / EOA-CONTROLLED"
  | "LOCK DETECTED — EXPIRY UNKNOWN"
  | "UNSUPPORTED LOCKER"
  | "UNABLE TO DETERMINE"
  | "NO POOL / NO LP DETECTED"
  | "MIXED — LOCKED + REMOVABLE";

/**
 * Token-level aggregate (UI). One locked Position NFT ≠ locked liquidity.
 * ALL_LOCKED only when every material position is verified locked AND discovery is complete.
 */
export type LpAggregateState =
  | "ALL_LOCKED"
  | "MIXED"
  | "ALL_UNLOCKED"
  | "UNKNOWN_INCOMPLETE"
  | "NONE";

/** Uniswap protocol version on Robinhood Chain. */
export type UniswapVersion = "v2" | "v3" | "v4";

/**
 * V4 liquidity ownership class (Phase 11A).
 * Class A = PositionManager NFT; Class B = hook-native (Airlock/Doppler).
 * Presentation / completeness only — does not invent Locked for Class B.
 */
export type V4OwnershipClass = "posm_nft" | "hook_native" | "unknown";

/**
 * Primary evidence source for V4 ownership class (Phase 11A.1).
 * Presentation only — never a lock claim.
 */
export type V4OwnershipEvidenceSource =
  | "position_nft"
  | "titan_lock"
  | "airlock_owner"
  | "doppler_hook"
  | "dynamic_fee_pool"
  | "hook_posm_zero_balance"
  | "active_hook_liquidity"
  | "unknown";

/**
 * Structured, user-facing V4 ownership evidence (Phase 11A.1).
 * Only proven observations — no raw RPC dumps, no invented lock claims.
 */
export type V4OwnershipEvidence = {
  source: V4OwnershipEvidenceSource;
  positionIds?: string[];
  poolIds?: string[];
  hookAddress?: string;
  airlockAddress?: string;
  /** Machine-readable note keys for i18n (never lock claims). */
  notes?: string[];
};

/**
 * Protocol structure support — distinct from locker decode support.
 * Never imply locker coverage from protocol status alone.
 */
export type ProtocolSupportStatus =
  | "supported"
  | "partial"
  | "planned"
  | "unsupported";

export type VersionCoverageSlice = {
  version: UniswapVersion;
  protocolSupportStatus: ProtocolSupportStatus;
  searched: boolean;
  poolsFound: number;
  positionsFound: number;
  /** Pool discovery for this version finished its probe set. */
  discoveryComplete: boolean;
  /** Lock/ownership analysis reliable for all found pools/positions. */
  lockAnalysisComplete: boolean;
  /**
   * Phase 10C-1: numeric NPM position discovery exhaustive for material pools.
   * Distinct from lockAnalysisComplete (approved lock semantics).
   */
  positionDiscoveryComplete?: boolean;
  detail: string;
};

export type UniswapVersionCoverage = {
  versionsDetected: UniswapVersion[];
  /** False when any active version was not searched, or pools lack lock analysis. */
  coverageComplete: boolean;
  incompleteReason: string | null;
  byVersion: Record<UniswapVersion, VersionCoverageSlice>;
  protocolSupportNote: string;
  lockerSupportNote: string;
};

export type LpAggregateStateDisplay =
  | "ALL LOCKED — VERIFIED ON-CHAIN"
  | "⚠️ MIXED — LOCKED + REMOVABLE"
  | "ALL UNLOCKED / EOA-CONTROLLED"
  | "UNKNOWN / INCOMPLETE"
  | "NO POOL / NO LP DETECTED";

export type PositionLockCounts = {
  detected: number;
  material: number;
  locked: number;
  unlocked: number;
  unknown: number;
};

export type LockDistributionReport = {
  available: boolean;
  lockedPct: number | null;
  unlockedPct: number | null;
  unknownPct: number | null;
  /** Economic USD of locked / unlocked / unknown discovered positions. */
  lockedUsd: number | null;
  unlockedUsd: number | null;
  unknownUsd: number | null;
  totalPositionUsd: number | null;
  poolLiquidityUsd: number | null;
  reconciledWithPool: boolean;
  /** Primary UI only accepts token_amounts. Raw L is never used for %. */
  method: "token_amounts" | null;
  reason: string | null;
};

export type EvidenceLevel =
  | "on_chain_verified"
  | "on_chain_partial"
  | "registry_inferred"
  | "unavailable";

export type ScoreDeduction = {
  category: DeductionCategory;
  points: number;
  code: string;
  reason: string;
  /** Wallet addresses supporting this signal (when applicable). */
  wallets?: string[];
  /** Signal codes absorbed into this deduction (same-cluster merge). */
  mergedFrom?: string[];
};

export type RiskFlag = {
  severity: RiskFlagSeverity;
  code: string;
  message: string;
};

export type DataSourceEntry = {
  id: string;
  label: string;
  usedFor: string;
  affectsScore: boolean;
};

export type LabeledHolder = {
  address: string;
  balanceRaw: string;
  balanceFormatted: string;
  percentOfSupply: number;
  label?: string;
  excludedFromConcentration?: boolean;
};

export type ContractRiskFinding = {
  code: string;
  severity: RiskFlagSeverity;
  message: string;
  source: "abi_source" | "rpc" | "goplus_labeled" | "provisional";
};

export type ContractRiskResult = {
  status: "analyzed" | "incomplete";
  mintable: boolean | null;
  honeypot: boolean | null;
  buyTaxBps: number | null;
  sellTaxBps: number | null;
  transferTaxBps: number | null;
  modifiableTax: boolean | null;
  pausable: boolean | null;
  blacklistOrWhitelist: boolean | null;
  isProxy: boolean | null;
  hasOwnerAdmin: boolean | null;
  /**
   * Privileged/admin burn of arbitrary holders (from Supply & Burn P1).
   * null = Unknown / incomplete; voluntary holder burn is NOT this flag.
   */
  privilegedBurn: boolean | null;
  findings: ContractRiskFinding[];
  goplusSupplement: Record<string, string | number | boolean | null> | null;
  detail: string;
};

export type V4PositionInfo = {
  positionNftId: string;
  owner: string | null;
  ownerLabel: string | null;
  lockerName: string | null;
  lockerAddress: string | null;
  lockState: LpLockState;
  lockStateDisplay: LpLockStateDisplay;
  unlockTimestamp: number | null;
  unlockDateUtc: string | null;
  lockCreatedAt: number | null;
  lockTxHash: string | null;
  liquidity: string | null;
  /** Token amounts when calculable from L + ticks + current sqrt price. */
  amount0Raw: string | null;
  amount1Raw: string | null;
  /** USD economic value when amounts + prices are reliable; never from raw L alone. */
  valueUsd?: number | null;
  poolId: string | null;
  currency0: string | null;
  currency1: string | null;
  fee: number | null;
  tickSpacing: number | null;
  tickLower: number | null;
  tickUpper: number | null;
  currentTick: number | null;
  inRange: boolean | null;
  removableByEoa: boolean | null;
  evidenceLevel: EvidenceLevel;
  dataSource: string;
};

export type LpIntelligence = {
  poolDetected: boolean;
  /** Distinct poolIds among detected positions (pool ≠ position). */
  poolsDetectedCount: number;
  poolId: string | null;
  poolManagerBalanceRaw: string | null;
  poolManagerBalanceFormatted: string | null;
  /** @deprecated prefer aggregateState — kept for Score mapping compatibility */
  aggregateLockState: LpLockState;
  aggregateLockStateDisplay: string;
  /** Token-level aggregate: ALL_LOCKED | MIXED | ALL_UNLOCKED | UNKNOWN_INCOMPLETE | NONE */
  aggregateState: LpAggregateState;
  aggregateStateDisplay: LpAggregateStateDisplay;
  positionCounts: PositionLockCounts;
  lockDistribution: LockDistributionReport;
  discoveryComplete: boolean;
  /**
   * Known/seeded/cached Position NFTs were revalidated on-chain (owner + lock + amounts).
   * Distinct from discoveryComplete — exhaustive history scan may still be pending.
   */
  knownPositionsVerified?: boolean;
  /** PositionManager transfer / wide inventory pass finished for this scan. */
  exhaustiveDiscoveryComplete?: boolean;
  completenessWarning: string | null;
  ownershipRiskNote: string;
  sizeWarning: boolean;
  positions: V4PositionInfo[];
  evidenceLevel: EvidenceLevel;
  detail: string;
  /** How Position NFT candidates were discovered (Week 2A). */
  discoverySources?: string[];
  /**
   * Cross-version Uniswap coverage (v2/v3/v4).
   * Protocol support ≠ locker support. Incomplete multi-version discovery → INCOMPLETE COVERAGE.
   */
  uniswapVersions: UniswapVersionCoverage;
  /**
   * V4 ownership class when PoolManager inventory / v4 path was evaluated.
   * null/undefined = not applicable (no v4 probe result).
   */
  ownershipClass?: V4OwnershipClass | null;
  /** Evidence tags from ownership-class detection (Airlock, Doppler hooks, etc.). */
  ownershipClassEvidence?: string[] | null;
  /**
   * Structured V4 ownership evidence for Scan UI (Phase 11A.1).
   * Presentation only — does not alter lock/score.
   */
  v4OwnershipEvidence?: V4OwnershipEvidence | null;
  /**
   * Phase 11E — Hook Position Index summary (Class B only).
   * Discovery/completeness only — no USD / lock% / LOCKED_VERIFIED.
   */
  hookPositionIndex?: HookPositionIndexSummary | null;
  /**
   * Phase 11F — Hook Position Valuer public summary (Class B only).
   * Separate from Titan economics / Score.
   */
  hookPositionValuation?: HookPositionValuationPublic | null;
  /**
   * Phase 11G — Foreign LP Separator public summary (Class B only).
   */
  hookForeignLpSeparation?: HookForeignLpSeparationPublic | null;
  /**
   * Phase 11H — Hook Lock Classifier (distinct from Titan LOCKED_VERIFIED).
   */
  hookLockClassification?: HookLockClassificationPublic | null;
};

/** Public Scan summary for Hook Position Index (Phase 11E). */
export type HookPositionIndexSummary = {
  poolId: string;
  hookAddress?: string;
  indexedPositionCount: number;
  hookOwnedCount: number;
  foreignPosmCount: number;
  foreignOtherCount: number;
  activeHookOwnedCount?: number;
  hookDiscoveryComplete: boolean;
  foreignDiscoveryComplete: boolean;
  discoveryMethod: string;
  lastSyncedBlock?: number;
  safeHeadBlock?: number;
  incompleteReasons?: string[];
  terminalState?: string;
};

/** Phase 11F — public Hook Position Valuer summary. */
export type HookPositionValuationPublic = {
  hookOwnedPositionCount: number;
  activeHookOwnedPositionCount: number;
  hookOwnedAmount0?: string;
  hookOwnedAmount1?: string;
  hookOwnedValueUsd?: number;
  hookValuationComplete: boolean;
  valuedAtBlock?: number;
  incompleteReasons?: string[];
};

/** Phase 11G — public Foreign LP Separator summary. */
export type HookForeignLpSeparationPublic = {
  hookOwnedValueUsd?: number;
  foreignPosmValueUsd?: number;
  foreignOtherValueUsd?: number;
  reconstructedPoolValueUsd?: number;
  hookShareOfReconstructedPool?: number;
  poolReconstructionComplete: boolean;
  incompleteReasons?: string[];
};

/**
 * Phase 11H — Hook principal lock enum (not Titan LOCKED_VERIFIED).
 */
export type HookPrincipalLockState =
  | "HOOK_PRINCIPAL_LOCKED_ONCHAIN"
  | "HOOK_TIMED_LOCK"
  | "HOOK_PERMANENT_LOCK"
  | "HOOK_UNLOCKABLE"
  | "HOOK_MIGRATION_PENDING"
  | "HOOK_EXITED"
  | "HOOK_GRADUATED_INCOMPLETE"
  | "UNKNOWN_INCOMPLETE";

/** Phase 11H — public Hook Lock Classification summary. */
export type HookLockClassificationPublic = {
  state: HookPrincipalLockState;
  principalValueUsd?: number;
  unlockTime?: number;
  lockAmountComplete: boolean;
  poolShareAvailable: boolean;
  evidence: string[];
  incompleteReasons?: string[];
};

export type CreatorTransferEvidence = {
  kind: "sell" | "transfer" | "transfer_then_sell";
  from: string;
  to: string;
  valueRaw: string;
  pctOfSupply: number;
  txHash: string | null;
  blockNumber: number | null;
  timestamp: string | null;
};

/** Creator sell/transfer index — clears provisional −8 when status=indexed. */
export type CreatorBehaviourResult = {
  status: "indexed" | "incomplete" | "unavailable";
  /** True only when fully indexed with usable supply — Score uses real rules. */
  available: boolean;
  dumpDetected: boolean;
  transferThenSellDetected: boolean;
  creatorSellPctOfSupply: number;
  outboundTransferCount: number;
  sellTransferCount: number;
  transferThenSellRecipientCount: number;
  pagesFetched: number;
  transfersIndexed: number;
  paginationComplete: boolean;
  detail: string;
  evidence: CreatorTransferEvidence[];
};

export type ConcentrationReport = {
  top1AdjustedPct: number;
  top10AdjustedPct: number;
  top10RawPct: number;
  exclusions: string[];
};

export type WalletRelationshipSignals = {
  equalBalanceClusterSize: number;
  equalBalanceClusterAddresses: string[];
  deployerInEqualBalanceCluster: boolean;
  sharedFundingCount: number;
  sharedFundingAddresses: string[];
  sharedFundingFunder: string | null;
  deployerFundedCount: number;
  deployerFundedAddresses: string[];
  sameBlockEarlyBuyCount: number;
  sameBlockEarlyBuyAddresses: string[];
};

export type TokenOverview = {
  address: string;
  chainId: number;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupplyRaw: string | null;
  totalSupplyFormatted: string | null;
  holdersCount: number | null;
  transfersCount: number | null;
  deployer: string | null;
  creationTxHash: string | null;
  contractVerified: boolean | null;
  poolManagerBalanceRaw: string | null;
  poolManagerBalanceFormatted: string | null;
  poolId: string | null;
  /** @deprecated use lpIntelligence.aggregateLockState — kept for compatibility */
  lpLockStatus: "locked" | "unlocked" | "unknown" | "none" | "mixed";
  lpLockDetail: string | null;
  lpIntelligence: LpIntelligence;
  contractRisk: ContractRiskResult;
  /** P0+P1 Supply & Burn Intelligence (dead inventory + mechanism flags). */
  supplyBurn: SupplyBurnIntelligence;
  creatorBehaviour: CreatorBehaviourResult;
  concentration: ConcentrationReport;
  /** Probabilistic wallet-relationship signals with supporting address sets. */
  relationship: WalletRelationshipSignals;
  tokenAgeDays: number | null;
  topHolders: LabeledHolder[];
};

export type ActivityResult = {
  level: ActivityLevel;
  source: string;
  volume24hUsd: number | null;
  transactions24h: number | null;
  transfersCount: number | null;
  note: string;
};

/**
 * Branded presentation of Activity — meme UI only.
 * Must not affect Structural Score, Overall Score, Confidence, or deductions.
 */
export type HansomeLevelId =
  | "not_hansome"
  | "kinda_hansome"
  | "hansome"
  | "very_hansome"
  | "too_hansome";

export type HansomeLevelResult = {
  id: HansomeLevelId;
  /** Always English (e.g. KINDA HANSOME). */
  label: string;
  emoji: string;
  rawLevel: string;
};

export type ScoreResult = {
  score: number;
  base: number;
  deductions: ScoreDeduction[];
  categoryTotals: Record<DeductionCategory, number>;
  flags: RiskFlag[];
  scoreCeilingApplied: number | null;
  incompleteCategories: DeductionCategory[];
};

/** Data Confidence / Analysis Coverage band (v1.2). */
export type ConfidenceBand = "High" | "Medium" | "Low";

export type ConfidenceDimensionId =
  | "contract"
  | "liquidity"
  | "holders"
  | "wallet"
  | "creator";

export type ConfidenceDimension = {
  id: ConfidenceDimensionId;
  label: string;
  /** 0–100 coverage for this dimension. */
  score: number;
  band: ConfidenceBand;
  /** Documented aggregate weight (sums to 1 across dimensions). */
  weight: number;
  evidence: string[];
  notes: string[];
  incomplete: boolean;
};

/**
 * Data Confidence — completeness/verifiability of underlying analysis data.
 * Does NOT indicate token quality, safety, or probability that Score is correct.
 */
export type ConfidenceResult = {
  percent: number;
  band: ConfidenceBand;
  dimensions: ConfidenceDimension[];
  weights: Record<ConfidenceDimensionId, number>;
  /** Derived gaps for compatibility / debugging (not the primary model). */
  penalties: {
    code: string;
    points: number;
    reason: string;
    dimension?: ConfidenceDimensionId;
  }[];
};

/** Overall Token Score — broader 0–100 composite for ordinary users. */
export type OverallScoreResult = {
  score: number;
  version: string;
  components: {
    structural: number;
    liquidityDepth: number;
    holderAdoption: number;
    activity: number;
    maturity: number;
    dataConfidence: number;
  };
  weights: {
    structural: number;
    liquidityDepth: number;
    holderAdoption: number;
    activity: number;
    maturity: number;
    dataConfidence: number;
  };
  capsApplied: string[];
  note: string;
};

/** Cache metadata returned by /api/scan (additive; optional on older clients). */
export type ScanCacheMeta = {
  hit: boolean;
  stale: boolean;
  source: "memory" | "kv" | "fresh" | "inflight" | "fast";
  ageMs: number | null;
  fullScoreTtlSec: number;
  activityTtlSec: number;
  refreshing: boolean;
  refreshAvailableInSec: number;
  /** True when manual refresh was denied by rate limit; cached body still returned. */
  refreshDenied?: boolean;
  kvConfigured: boolean;
  /** Phase 10C-4 — cache namespace for this response (never cross-read). */
  deploymentScope?: string;
};

/** Per-stage progress for Fast Scan → Deep Analysis UX. */
export type AnalysisStageState =
  | "pending"
  | "analyzing"
  | "done"
  | "partial"
  | "unknown"
  | "failed";

export type AnalysisStageId =
  | "contract"
  | "holders"
  | "market"
  | "burn"
  | "liquidity"
  | "creator"
  | "relationships"
  | "score";

export type AnalysisStages = Record<AnalysisStageId, AnalysisStageState>;

export type AnalysisStatus =
  | "fast_ready"
  | "deep_running"
  | "partial"
  | "complete"
  | "failed";

export type AnalysisPhase = "fast" | "complete";

/** Phase 10C-5 LP attempt states — no PARTIAL_TERMINAL. */
export type LpTerminalState =
  | "NEW"
  | "RUNNING"
  | "PUBLISHING"
  | "SUCCESS_TERMINAL"
  | "FAILED_TERMINAL";

export type LpTerminalReason =
  | "force_refresh_started"
  | "running"
  | "publishing"
  | "verified_lock_published"
  | "verified_result_after_recovery"
  | "watchdog_timeout"
  | "parallel_hard_bound"
  | "stage_timeout"
  | "stage_error"
  | "all_versions_failed"
  | "publish_failed"
  | "recovery_exhausted"
  | "interactive_stale"
  | "stale_forced_refresh"
  | "force_txn_expired"
  | "unknown";

/** Phase 13C — durable forceLp refresh transaction metadata. */
export type LpForceRecoveryMeta = {
  state: "open" | "committed" | "rolled_back";
  priorGeneration: string | null;
  pendingGeneration: string;
  reason:
    | "force_refresh_started"
    | "stale_forced_refresh"
    | "force_txn_expired"
    | "committed";
  savedAt: string;
  durablePrior: boolean;
};

export type LpTerminalContract = {
  attemptId: string;
  generation: string;
  terminalReason: LpTerminalReason;
  terminalState: LpTerminalState;
  completedStages: string[];
  failedStages: string[];
  wallTime: number;
  forceRefresh: boolean;
  startedAt: string;
  watchdogTimeoutAt?: string | null;
  recoveryAttempts: number;
};

/**
 * Durable Deep progress publish record (KV-backed via scan snapshot).
 * Progress orchestration only — never feeds scores/classifications.
 */
export type DeepProgressMeta = {
  sequence: number;
  updatedAt: string;
  stage:
    | "relationships"
    | "liquidity"
    | "creatorBurn"
    | "score"
    | "partial"
    | "complete";
  action: string;
  completedUnits?: number;
  totalUnits?: number;
  pagesFetched?: number;
  transfersIndexed?: number;
  stalled?: boolean;
  stallReason?: string;
};

/** Phase 13A — durable Deep worker lease (KV via scan snapshot). */
export type DeepLeaseState = "none" | "valid" | "expired";

export type DeepRuntimeLease = {
  generation: string;
  workerId: string;
  startedAt: string;
  heartbeatAt: string;
  expiresAt: string;
  attempt: number;
  deploymentScope: string;
};

/**
 * Phase 13A — Deep runtime reliability metadata (no secrets).
 * Invariant (13C.1): analyzing ⇒ retryScheduled OR valid durable lease.
 * Process-local inflight alone is not ownership.
 */
export type DeepRuntimeMeta = {
  lease?: DeepRuntimeLease;
  retryRequired?: boolean;
  retryScheduled?: boolean;
  lastErrorCode?: string;
  lastTransition?: string;
  fenceResult?: "accepted" | "rejected" | "none";
  lastFenceIncomingGeneration?: string;
  deploymentScope?: string;
};

export type DeepRuntimeDiagnostics = {
  deepGeneration?: string;
  deepWorkerId?: string;
  deepAttempt?: number;
  deepLeaseState?: DeepLeaseState;
  /** True only when durable lease is valid (not process-local inflight). */
  deepLeaseOwned?: boolean;
  /** Process-local coalesce Map/Set — may be zombie; not durable ownership. */
  deepInflightLocal?: boolean;
  deepStartedAt?: string;
  deepHeartbeatAt?: string;
  deepExpiresAt?: string;
  deepRetryRequired?: boolean;
  deepRetryScheduled?: boolean;
  deepLastErrorCode?: string;
  deepLastTransition?: string;
  deepDeploymentScope?: string;
  deepFenceResult?: "accepted" | "rejected" | "none";
};

export type ScanResponse = {
  version: string;
  /**
   * Primary “Last updated” for UI — typically max(scoreComputedAt, activityUpdatedAt)
   * or scoreComputedAt when only structural timestamps exist.
   */
  scannedAt: string;
  /** ISO time of last full structural / Overall / Supply&Burn scan. */
  scoreComputedAt?: string;
  /** ISO time of last Activity/price overlay refresh (may be newer than score). */
  activityUpdatedAt?: string;
  /** Present when served via getCachedScan /api/scan. */
  cache?: ScanCacheMeta;
  /**
   * Fast Scan vs finalized Deep Analysis.
   * Absent on legacy cached snapshots → treat as complete.
   */
  analysisPhase?: AnalysisPhase;
  analysisStatus?: AnalysisStatus;
  /** ISO time when the current deep attempt started (stale recovery). */
  deepStartedAt?: string;
  /**
   * Generation id for the current Deep attempt. Stale workers whose id does not
   * match must not overwrite progress or terminal state.
   */
  deepAttemptId?: string;
  /**
   * How many Deep attempts have settled as partial/failed for this snapshot.
   * Used with MAX_DEEP_AUTO_RETRIES to re-arm collecting vs honest terminal gap.
   * Monotonic within a refresh session (never decreases except manual refresh).
   */
  deepRetryCount?: number;
  /**
   * Phase 10C-4 — published LP body reference (generation + deploymentScope).
   * Final readers must verify matching LP result body before trusting lock JSON.
   */
  lpPublish?: {
    schemaVersion: number;
    deploymentScope: string;
    lpGeneration: string;
    publishedAt: string;
    tokenAddress: string;
    chainId: number;
  };
  /**
   * Phase 10C-5 — LP attempt terminal contract (force refresh).
   * Hard terminals are SUCCESS_TERMINAL | FAILED_TERMINAL only (never PARTIAL).
   */
  lpTerminal?: LpTerminalContract;
  /**
   * Phase 13C — forceLp recovery transaction (prior durable evidence slot).
   * Open while force rediscovery runs; committed on new publish; rolled_back on restore.
   */
  lpForceRecovery?: LpForceRecoveryMeta;
  /**
   * Monotonic Deep progress publishes for UI polling.
   * Survives serverless isolate changes via the scan snapshot KV record.
   */
  deepProgress?: DeepProgressMeta;
  /**
   * Phase 13A — lease / retry / fence diagnostics for Deep runtime recovery.
   * Survives isolate changes via the scan snapshot KV record.
   */
  deepRuntime?: DeepRuntimeMeta;
  /** True when Overall/Structural computed without deep LP/creator/P2 inputs. */
  scoreProvisional?: boolean;
  analysisStages?: AnalysisStages;
  overview: TokenOverview;
  /** Prominent composite for ordinary users (Overall Token Score). */
  overall: OverallScoreResult;
  /**
   * Structural Score (v1.1 engine) — contract/LP ownership/concentration/
   * relationships/launch/creator. Kept as `score` for API compatibility.
   */
  score: ScoreResult;
  /** Alias of `score` — Structural Score. */
  structural: ScoreResult;
  activity: ActivityResult;
  /** Presentation of `activity` — branded HANSOME Level (does not affect scores). */
  hansomeLevel: HansomeLevelResult;
  confidence: ConfidenceResult;
  /**
   * Labeled market liquidity in USD when available (e.g. GeckoTerminal reserve_in_usd).
   * Presentation only — never fabricate; UI shows Unavailable when null.
   */
  liquidityUsd: number | null;
  /**
   * Category + Meme Story (Context). Week 2B metadata — never feeds Score /
   * Activity / Trending / Confidence. UI Story block is Week 3–4+.
   */
  context: TokenContextMetadata;
  sources: DataSourceEntry[];
  disclaimers: string[];
  uiWording: {
    overallSubtitle: string;
    scoreSubtitle: string;
    structuralSubtitle: string;
    confidenceNote: string;
  };
  /**
   * Phase 9 critical-path profiler compact summary.
   * Present only when HANSOME_CRITICAL_PATH_PROFILE=1 (or deep-profile).
   * Diagnostics only — never feeds scores / UI copy.
   */
  criticalPathProfile?: {
    version: "phase9";
    totalWallMs: number | null;
    criticalPath: string[];
    criticalPathTotalMs: number | null;
    stages: Record<string, number | null>;
    rpcByProvider: Record<
      string,
      {
        count: number;
        medianMs: number | null;
        p95Ms: number | null;
        p99Ms: number | null;
        slowestMs: number | null;
        slowestName: string | null;
        timeoutCount: number;
        retryCount: number;
        totalMs: number;
      }
    >;
    parallelUtilizationPct: number | null;
    idlePct: number | null;
    blockedPct: number | null;
    top10LongestNodes: Array<{
      name: string;
      wallMs: number;
      onCriticalPath: boolean;
    }>;
    top10LongestRpcs: Array<{
      provider: string;
      name: string;
      durationMs: number;
    }>;
    optimizationOpportunities: Array<{
      rank: number;
      opportunity: string;
      expectedSavedMs: number;
      complexity: "low" | "medium" | "high";
      risk: "low" | "medium" | "high";
    }>;
    nodeCount: number;
    rpcCount: number;
  };
};
