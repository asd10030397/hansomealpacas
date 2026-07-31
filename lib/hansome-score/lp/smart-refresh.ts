/**
 * Cold Perf V2 Phase 7.1 — Smart LP Refresh.
 *
 * Performance / freshness / invalidation / orchestration only.
 * Does NOT change liquidity math, lock classification, ownership semantics,
 * Score, risk findings, or API meaning.
 *
 * Manual refresh evaluates freshness and refreshes only stale/invalidated
 * LP components instead of always forcing full ownership/lock revalidation.
 */

import { getAddress } from "viem";
import { SCORE_SPEC_VERSION } from "@/lib/hansome-score/constants";
import { scopedKvKey } from "@/lib/hansome-score/deployment-scope";
import { ANALYSIS_SEMANTIC_VERSION } from "@/lib/hansome-score/warm-incremental";
import type { LpDiscoveryCache } from "@/lib/hansome-score/lp/position-cache";
import type { LpDiscoveryCheckpoint } from "@/lib/hansome-score/lp/discovery-checkpoint";
import type { LpIntelligence, V4PositionInfo } from "@/lib/hansome-score/types";

/** LP discovery-cache schema expected for smart reuse. */
export const SMART_LP_CACHE_SCHEMA_VERSION = 1;

/**
 * Per-component freshness (not one global LP TTL).
 * Each TTL is safe because consumers still fail-closed on invalidation signals.
 */
export const SMART_LP_FRESHNESS = {
  /** Pool / pair existence — durable; bust on pair discovery or migration signal. */
  poolExistenceMs: 24 * 60 * 60 * 1000,
  /** Proven Position NFT IDs — medium; bust on burn / new discovery / PM delta. */
  positionIdsMs: 6 * 60 * 60 * 1000,
  /** Position NFT owner (ownerOf) — short; revalidate on transfer / TTL / failure. */
  positionOwnerMs: 10 * 60 * 1000,
  /** Locker contract as owner — short; same band as position owner. */
  lockerOwnerMs: 10 * 60 * 1000,
  /**
   * Lock classification reuse window when expiry is far and no locker signal.
   * Near-expiry uses lockExpiryWarningMs instead (more aggressive).
   */
  lockClassificationMs: 10 * 60 * 1000,
  /**
   * If unlock is within this window, refresh lock status even when otherwise fresh.
   * Safety: never infer locked/unlocked across an imminent expiry boundary.
   */
  lockExpiryWarningMs: 24 * 60 * 60 * 1000,
  /** Pool token balances — short overlay; independent of ownership. */
  poolBalancesMs: 45 * 1000,
  /** Position liquidity amounts — medium; refresh with owner when revalidating. */
  liquidityAmountMs: 10 * 60 * 1000,
  /** TVL / market overlay — short; may refresh without ownership work. */
  tvlMs: 45 * 1000,
  /** Token price overlay — short; may refresh without ownership work. */
  priceMs: 45 * 1000,
  /** discoveryComplete / exhaustive flags — durable until evidence proves otherwise. */
  discoveryCompletenessDurable: true,
  exhaustiveDiscoveryDurable: true,
} as const;

/** Progress actions for Smart LP Refresh (honest, monotonic). */
export const SMART_LP_PROGRESS_ACTIONS = [
  "lp_refresh_plan",
  "lp_cache_validate",
  "lp_event_delta_check",
  "lp_price_refresh",
  "lp_pool_state_refresh",
  "lp_owner_reuse",
  "lp_owner_refresh",
  "lp_lock_reuse",
  "lp_lock_refresh",
  "lp_checkpoint_update",
  "lp_background_exhaustive",
  "lp_final_validation",
] as const;

export type SmartLpProgressAction = (typeof SMART_LP_PROGRESS_ACTIONS)[number];

export type SmartLpOutcome =
  | "reuse_all"
  | "refresh_price_only"
  | "refresh_pool_state"
  | "refresh_position_owner"
  | "refresh_lock_status"
  | "refresh_new_events"
  | "full_quick_lp"
  | "full_revalidation"
  | "cold_fallback";

export type SmartLpReasonCode =
  | "eligible_reuse"
  | "price_tvl_stale"
  | "pool_balance_stale"
  | "owner_ttl_expired"
  | "lock_ttl_expired"
  | "lock_expiry_near"
  | "lock_expiry_passed"
  | "lock_expiry_unknown"
  | "unsupported_locker"
  | "position_nft_transfer"
  | "liquidity_event"
  | "position_burn"
  | "owner_change"
  | "new_locker_owner"
  | "failed_owner_retry"
  | "failed_adapter_retry"
  | "incomplete_discovery"
  | "force_full_lp"
  | "schema_mismatch"
  | "semantic_version_mismatch"
  | "reorg_conflict"
  | "corrupt_prior"
  | "missing_prior_positions"
  | "missing_verified_ids"
  | "chain_mismatch"
  | "address_mismatch"
  | "partial_failure_retry"
  | "proxy_impl_change"
  | "pair_discovery"
  | "pool_migration"
  | "manual_freshness_eval";

export type SmartLpInvalidationSignal =
  | "pool_initialize"
  | "liquidity_add"
  | "liquidity_remove"
  | "position_nft_transfer"
  | "locker_deposit"
  | "locker_withdrawal"
  | "locker_extension"
  | "locker_unlock"
  | "ownership_transfer"
  | "position_burn"
  | "pool_migration"
  | "token_pair_discovery"
  | "proxy_implementation_change"
  | "reorg_overlap_conflict";

export type SmartLpEvidence = {
  chainId: number;
  tokenAddress: string;
  /** Expected chain for this scan. */
  expectedChainId: number;
  /** Analysis / score semantic version on snapshot. */
  analysisSemanticVersion: string | null;
  /** LP discovery cache schema version (1). */
  lpCacheSchemaVersion: number | null;
  lpCache: LpDiscoveryCache | null;
  lpCheckpoint: LpDiscoveryCheckpoint | null;
  priorLp: LpIntelligence | null;
  /** Age of last ownership/lock validation (ms). */
  ownershipValidatedAgeMs: number | null;
  lockValidatedAgeMs: number | null;
  poolStateAgeMs: number | null;
  priceAgeMs: number | null;
  tvlAgeMs: number | null;
  /** Snapshot / stage age when validation timestamps missing. */
  snapshotAgeMs: number | null;
  /** Liquidity stage previously failed / partial. */
  priorPartialFailure: boolean;
  /** Explicit internal full revalidation. */
  forceLpFullRefresh: boolean;
  /** Warm / transfer reorg conflict. */
  reorgConflict: boolean;
  /** Manual user refresh — evaluate freshness; do not force-all. */
  manualRefresh: boolean;
  /** Event-driven invalidation signals (from bounded checks / callers). */
  invalidationSignals: SmartLpInvalidationSignal[];
  /** Previously failed ownerOf IDs that must retry. */
  failedOwnerIds: string[];
  /** Now (ms) — injectable for tests. */
  nowMs: number;
};

export type SmartLpRefreshPlan = {
  outcome: SmartLpOutcome;
  reasons: SmartLpReasonCode[];
  evidence: {
    ownershipFresh: boolean;
    lockFresh: boolean;
    priceStale: boolean;
    tvlStale: boolean;
    poolStateStale: boolean;
    lockExpiryNear: boolean;
    lockExpiryPassed: boolean;
    lockExpiryUnknown: boolean;
    hasUnsupportedLocker: boolean;
    incompleteDiscovery: boolean;
    knownPositionsVerified: boolean;
    positionCount: number;
    invalidationSignals: SmartLpInvalidationSignal[];
    reuseOwners: boolean;
    reuseLocks: boolean;
    refreshOwners: boolean;
    refreshLocks: boolean;
    runQuickLp: boolean;
    runFullRevalidation: boolean;
    backgroundExhaustive: boolean;
  };
  /** Position IDs that must be revalidated (empty = none / or all when full). */
  positionIdsToRevalidate: string[];
  /** Progress actions expected for this plan (orchestration hint). */
  progressActions: SmartLpProgressAction[];
};

function normalizeAddress(address: string): string {
  try {
    return getAddress(address).toLowerCase();
  } catch {
    return address.toLowerCase();
  }
}

function ageExceeds(ageMs: number | null | undefined, ttlMs: number): boolean {
  if (ageMs == null || !Number.isFinite(ageMs)) return true;
  return ageMs > ttlMs;
}

function lockExpiryFlags(
  positions: V4PositionInfo[],
  nowMs: number,
): {
  near: boolean;
  passed: boolean;
  unknown: boolean;
  unsupported: boolean;
} {
  const nowSec = Math.floor(nowMs / 1000);
  const warnSec = Math.floor(SMART_LP_FRESHNESS.lockExpiryWarningMs / 1000);
  let near = false;
  let passed = false;
  let unknown = false;
  let unsupported = false;
  for (const p of positions) {
    if (p.lockState === "UNSUPPORTED_LOCKER") unsupported = true;
    if (
      p.lockState === "LOCK_DETECTED_EXPIRY_UNKNOWN" ||
      (p.lockState === "LOCKED_VERIFIED_ONCHAIN" && p.unlockTimestamp == null)
    ) {
      // Permanent / unknown expiry — do not force refresh from time alone.
      if (p.lockState === "LOCK_DETECTED_EXPIRY_UNKNOWN") unknown = true;
      continue;
    }
    if (p.unlockTimestamp == null) continue;
    if (p.unlockTimestamp <= nowSec) {
      passed = true;
    } else if (p.unlockTimestamp - nowSec <= warnSec) {
      near = true;
    }
  }
  return { near, passed, unknown, unsupported };
}

/**
 * Build evidence bag from snapshot / caches (pure; no RPC).
 */
export function buildSmartLpEvidence(params: {
  chainId: number;
  expectedChainId: number;
  tokenAddress: string;
  analysisSemanticVersion?: string | null;
  lpCache?: LpDiscoveryCache | null;
  lpCheckpoint?: LpDiscoveryCheckpoint | null;
  priorLp?: LpIntelligence | null;
  snapshotAgeMs?: number | null;
  priorPartialFailure?: boolean;
  forceLpFullRefresh?: boolean;
  reorgConflict?: boolean;
  manualRefresh?: boolean;
  invalidationSignals?: SmartLpInvalidationSignal[];
  failedOwnerIds?: string[];
  nowMs?: number;
}): SmartLpEvidence {
  const nowMs = params.nowMs ?? Date.now();
  const cache = params.lpCache ?? null;
  const ownershipValidatedAgeMs =
    cache?.knownVerifiedAt != null
      ? Math.max(0, nowMs - cache.knownVerifiedAt)
      : params.snapshotAgeMs ?? null;
  return {
    chainId: params.chainId,
    tokenAddress: normalizeAddress(params.tokenAddress),
    expectedChainId: params.expectedChainId,
    analysisSemanticVersion: params.analysisSemanticVersion ?? null,
    lpCacheSchemaVersion: cache?.version ?? null,
    lpCache: cache,
    lpCheckpoint: params.lpCheckpoint ?? null,
    priorLp: params.priorLp ?? null,
    ownershipValidatedAgeMs,
    lockValidatedAgeMs: ownershipValidatedAgeMs,
    poolStateAgeMs: params.snapshotAgeMs ?? null,
    priceAgeMs: params.snapshotAgeMs ?? null,
    tvlAgeMs: params.snapshotAgeMs ?? null,
    snapshotAgeMs: params.snapshotAgeMs ?? null,
    priorPartialFailure: params.priorPartialFailure === true,
    forceLpFullRefresh: params.forceLpFullRefresh === true,
    reorgConflict: params.reorgConflict === true,
    manualRefresh: params.manualRefresh === true,
    invalidationSignals: [...(params.invalidationSignals ?? [])],
    failedOwnerIds: [...(params.failedOwnerIds ?? [])],
    nowMs,
  };
}

/**
 * Explicit Smart LP Refresh decision.
 * Fail-closed: any hard mismatch → cold_fallback / full_revalidation.
 */
export function planSmartLpRefresh(evidence: SmartLpEvidence): SmartLpRefreshPlan {
  const reasons: SmartLpReasonCode[] = [];
  const signals = [...evidence.invalidationSignals];
  const prior = evidence.priorLp;
  const positions = prior?.positions ?? [];
  const positionCount = positions.length;
  const knownIds = positions.map((p) => p.positionNftId).filter(Boolean);

  const progressBase: SmartLpProgressAction[] = [
    "lp_refresh_plan",
    "lp_cache_validate",
  ];

  const fail = (
    outcome: SmartLpOutcome,
    extra: SmartLpReasonCode[],
    actions: SmartLpProgressAction[] = ["lp_final_validation"],
  ): SmartLpRefreshPlan => ({
    outcome,
    reasons: [...reasons, ...extra],
    evidence: {
      ownershipFresh: false,
      lockFresh: false,
      priceStale: true,
      tvlStale: true,
      poolStateStale: true,
      lockExpiryNear: false,
      lockExpiryPassed: false,
      lockExpiryUnknown: false,
      hasUnsupportedLocker: false,
      incompleteDiscovery: prior?.discoveryComplete !== true,
      knownPositionsVerified: prior?.knownPositionsVerified === true,
      positionCount,
      invalidationSignals: signals,
      reuseOwners: false,
      reuseLocks: false,
      refreshOwners: true,
      refreshLocks: true,
      runQuickLp: outcome === "full_quick_lp" || outcome === "full_revalidation",
      runFullRevalidation: outcome === "full_revalidation" || outcome === "cold_fallback",
      backgroundExhaustive: prior?.exhaustiveDiscoveryComplete !== true,
    },
    positionIdsToRevalidate: knownIds,
    progressActions: [...progressBase, ...actions],
  });

  if (evidence.chainId !== evidence.expectedChainId) {
    return fail("cold_fallback", ["chain_mismatch"]);
  }
  if (
    evidence.lpCache &&
    normalizeAddress(evidence.lpCache.address) !== evidence.tokenAddress
  ) {
    return fail("cold_fallback", ["address_mismatch"]);
  }
  if (
    evidence.lpCacheSchemaVersion != null &&
    evidence.lpCacheSchemaVersion !== SMART_LP_CACHE_SCHEMA_VERSION
  ) {
    return fail("cold_fallback", ["schema_mismatch"]);
  }
  if (
    evidence.analysisSemanticVersion != null &&
    evidence.analysisSemanticVersion !== ANALYSIS_SEMANTIC_VERSION &&
    evidence.analysisSemanticVersion !== SCORE_SPEC_VERSION
  ) {
    return fail("cold_fallback", ["semantic_version_mismatch"]);
  }
  if (evidence.reorgConflict || signals.includes("reorg_overlap_conflict")) {
    return fail("full_revalidation", ["reorg_conflict"], [
      "lp_event_delta_check",
      "lp_owner_refresh",
      "lp_lock_refresh",
      "lp_final_validation",
    ]);
  }
  if (evidence.forceLpFullRefresh) {
    return fail("full_revalidation", ["force_full_lp"], [
      "lp_owner_refresh",
      "lp_lock_refresh",
      "lp_checkpoint_update",
      "lp_final_validation",
    ]);
  }
  if (evidence.priorPartialFailure) {
    return fail("full_quick_lp", ["partial_failure_retry"], [
      "lp_owner_refresh",
      "lp_lock_refresh",
      "lp_final_validation",
    ]);
  }
  if (!prior || (positionCount === 0 && prior.poolDetected !== true && prior.aggregateState !== "NONE")) {
    // No prior LP payload to reuse — need discovery.
    if (!prior) {
      return fail("cold_fallback", ["corrupt_prior", "missing_prior_positions"]);
    }
  }
  if (!prior) {
    return fail("cold_fallback", ["missing_prior_positions"]);
  }

  // Corrupt / empty verified set when we previously claimed known verification.
  if (
    prior.knownPositionsVerified === true &&
    positionCount === 0 &&
    prior.poolDetected === true
  ) {
    return fail("full_quick_lp", ["corrupt_prior", "missing_verified_ids"]);
  }

  if (signals.includes("proxy_implementation_change")) {
    reasons.push("proxy_impl_change");
    return fail("full_revalidation", ["proxy_impl_change"]);
  }
  if (signals.includes("pool_migration") || signals.includes("token_pair_discovery")) {
    reasons.push(
      signals.includes("pool_migration") ? "pool_migration" : "pair_discovery",
    );
    return fail("full_quick_lp", reasons.slice(-1) as SmartLpReasonCode[]);
  }

  const expiry = lockExpiryFlags(positions, evidence.nowMs);
  const ownershipFresh = !ageExceeds(
    evidence.ownershipValidatedAgeMs,
    SMART_LP_FRESHNESS.positionOwnerMs,
  );
  const lockFresh =
    ownershipFresh &&
    !ageExceeds(
      evidence.lockValidatedAgeMs,
      SMART_LP_FRESHNESS.lockClassificationMs,
    ) &&
    !expiry.near &&
    !expiry.passed;
  const priceStale = ageExceeds(
    evidence.priceAgeMs,
    SMART_LP_FRESHNESS.priceMs,
  );
  const tvlStale = ageExceeds(evidence.tvlAgeMs, SMART_LP_FRESHNESS.tvlMs);
  const poolStateStale = ageExceeds(
    evidence.poolStateAgeMs,
    SMART_LP_FRESHNESS.poolBalancesMs,
  );
  const incompleteDiscovery = prior.discoveryComplete !== true;
  const knownVerified = prior.knownPositionsVerified === true;
  const cacheIds = evidence.lpCache?.positionIds ?? [];
  const hasKnownIds = knownIds.length > 0 || cacheIds.length > 0;

  if (evidence.manualRefresh) {
    reasons.push("manual_freshness_eval");
  }

  // Hard event invalidations → targeted or quick refresh.
  const hasNftTransfer =
    signals.includes("position_nft_transfer") ||
    signals.includes("ownership_transfer");
  const hasLiquidityEvent =
    signals.includes("liquidity_add") ||
    signals.includes("liquidity_remove") ||
    signals.includes("pool_initialize");
  const hasLockerEvent =
    signals.includes("locker_deposit") ||
    signals.includes("locker_withdrawal") ||
    signals.includes("locker_extension") ||
    signals.includes("locker_unlock");
  const hasBurn = signals.includes("position_burn");

  if (hasBurn) {
    reasons.push("position_burn");
    return {
      outcome: "refresh_new_events",
      reasons,
      evidence: {
        ownershipFresh: false,
        lockFresh: false,
        priceStale,
        tvlStale,
        poolStateStale,
        lockExpiryNear: expiry.near,
        lockExpiryPassed: expiry.passed,
        lockExpiryUnknown: expiry.unknown,
        hasUnsupportedLocker: expiry.unsupported,
        incompleteDiscovery,
        knownPositionsVerified: knownVerified,
        positionCount,
        invalidationSignals: signals,
        reuseOwners: false,
        reuseLocks: false,
        refreshOwners: true,
        refreshLocks: true,
        runQuickLp: true,
        runFullRevalidation: false,
        backgroundExhaustive: prior.exhaustiveDiscoveryComplete !== true,
      },
      positionIdsToRevalidate: knownIds.length ? knownIds : cacheIds,
      progressActions: [
        ...progressBase,
        "lp_event_delta_check",
        "lp_owner_refresh",
        "lp_lock_refresh",
        "lp_checkpoint_update",
        "lp_background_exhaustive",
        "lp_final_validation",
      ],
    };
  }

  if (hasNftTransfer || hasLockerEvent) {
    if (hasNftTransfer) reasons.push("position_nft_transfer");
    if (hasLockerEvent) reasons.push("owner_change");
    return {
      outcome: hasNftTransfer ? "refresh_position_owner" : "refresh_lock_status",
      reasons,
      evidence: {
        ownershipFresh: false,
        lockFresh: false,
        priceStale,
        tvlStale,
        poolStateStale,
        lockExpiryNear: expiry.near,
        lockExpiryPassed: expiry.passed,
        lockExpiryUnknown: expiry.unknown,
        hasUnsupportedLocker: expiry.unsupported,
        incompleteDiscovery,
        knownPositionsVerified: knownVerified,
        positionCount,
        invalidationSignals: signals,
        reuseOwners: false,
        reuseLocks: false,
        refreshOwners: true,
        refreshLocks: true,
        runQuickLp: false,
        runFullRevalidation: false,
        backgroundExhaustive: prior.exhaustiveDiscoveryComplete !== true,
      },
      positionIdsToRevalidate: knownIds.length ? knownIds : cacheIds,
      progressActions: [
        ...progressBase,
        "lp_event_delta_check",
        "lp_owner_refresh",
        "lp_lock_refresh",
        "lp_price_refresh",
        "lp_checkpoint_update",
        "lp_final_validation",
      ],
    };
  }

  if (hasLiquidityEvent) {
    reasons.push("liquidity_event");
    return {
      outcome: "refresh_new_events",
      reasons,
      evidence: {
        ownershipFresh,
        lockFresh,
        priceStale: true,
        tvlStale: true,
        poolStateStale: true,
        lockExpiryNear: expiry.near,
        lockExpiryPassed: expiry.passed,
        lockExpiryUnknown: expiry.unknown,
        hasUnsupportedLocker: expiry.unsupported,
        incompleteDiscovery,
        knownPositionsVerified: knownVerified,
        positionCount,
        invalidationSignals: signals,
        reuseOwners: ownershipFresh && knownVerified,
        reuseLocks: lockFresh && knownVerified,
        refreshOwners: !(ownershipFresh && knownVerified),
        refreshLocks: !(lockFresh && knownVerified),
        runQuickLp: !knownVerified,
        runFullRevalidation: false,
        backgroundExhaustive: prior.exhaustiveDiscoveryComplete !== true,
      },
      positionIdsToRevalidate:
        ownershipFresh && knownVerified ? [] : knownIds.length ? knownIds : cacheIds,
      progressActions: [
        ...progressBase,
        "lp_event_delta_check",
        "lp_pool_state_refresh",
        ownershipFresh && knownVerified ? "lp_owner_reuse" : "lp_owner_refresh",
        lockFresh && knownVerified ? "lp_lock_reuse" : "lp_lock_refresh",
        "lp_price_refresh",
        "lp_final_validation",
      ],
    };
  }

  if (expiry.passed) {
    reasons.push("lock_expiry_passed");
    return {
      outcome: "refresh_lock_status",
      reasons,
      evidence: {
        ownershipFresh,
        lockFresh: false,
        priceStale,
        tvlStale,
        poolStateStale,
        lockExpiryNear: false,
        lockExpiryPassed: true,
        lockExpiryUnknown: expiry.unknown,
        hasUnsupportedLocker: expiry.unsupported,
        incompleteDiscovery,
        knownPositionsVerified: knownVerified,
        positionCount,
        invalidationSignals: signals,
        reuseOwners: ownershipFresh,
        reuseLocks: false,
        refreshOwners: !ownershipFresh,
        refreshLocks: true,
        runQuickLp: false,
        runFullRevalidation: false,
        backgroundExhaustive: prior.exhaustiveDiscoveryComplete !== true,
      },
      positionIdsToRevalidate: knownIds,
      progressActions: [
        ...progressBase,
        "lp_lock_refresh",
        ownershipFresh ? "lp_owner_reuse" : "lp_owner_refresh",
        "lp_price_refresh",
        "lp_final_validation",
      ],
    };
  }

  if (expiry.near) {
    reasons.push("lock_expiry_near");
    return {
      outcome: "refresh_lock_status",
      reasons,
      evidence: {
        ownershipFresh,
        lockFresh: false,
        priceStale,
        tvlStale,
        poolStateStale,
        lockExpiryNear: true,
        lockExpiryPassed: false,
        lockExpiryUnknown: expiry.unknown,
        hasUnsupportedLocker: expiry.unsupported,
        incompleteDiscovery,
        knownPositionsVerified: knownVerified,
        positionCount,
        invalidationSignals: signals,
        reuseOwners: ownershipFresh,
        reuseLocks: false,
        refreshOwners: !ownershipFresh,
        refreshLocks: true,
        runQuickLp: false,
        runFullRevalidation: false,
        backgroundExhaustive: prior.exhaustiveDiscoveryComplete !== true,
      },
      positionIdsToRevalidate: knownIds,
      progressActions: [
        ...progressBase,
        "lp_lock_refresh",
        ownershipFresh ? "lp_owner_reuse" : "lp_owner_refresh",
        "lp_price_refresh",
        "lp_final_validation",
      ],
    };
  }

  if (evidence.failedOwnerIds.length > 0) {
    reasons.push("failed_owner_retry");
    return {
      outcome: "refresh_position_owner",
      reasons,
      evidence: {
        ownershipFresh: false,
        lockFresh: false,
        priceStale,
        tvlStale,
        poolStateStale,
        lockExpiryNear: expiry.near,
        lockExpiryPassed: expiry.passed,
        lockExpiryUnknown: expiry.unknown,
        hasUnsupportedLocker: expiry.unsupported,
        incompleteDiscovery,
        knownPositionsVerified: knownVerified,
        positionCount,
        invalidationSignals: signals,
        reuseOwners: false,
        reuseLocks: false,
        refreshOwners: true,
        refreshLocks: true,
        runQuickLp: false,
        runFullRevalidation: false,
        backgroundExhaustive: prior.exhaustiveDiscoveryComplete !== true,
      },
      positionIdsToRevalidate: evidence.failedOwnerIds,
      progressActions: [
        ...progressBase,
        "lp_owner_refresh",
        "lp_lock_refresh",
        "lp_final_validation",
      ],
    };
  }

  // Unsupported locker: reuse classification (do not invent locked/unlocked).
  if (expiry.unsupported && ownershipFresh && lockFresh) {
    reasons.push("unsupported_locker");
  }

  if (!ownershipFresh && hasKnownIds) {
    reasons.push("owner_ttl_expired");
    return {
      outcome: "refresh_position_owner",
      reasons,
      evidence: {
        ownershipFresh: false,
        lockFresh: false,
        priceStale,
        tvlStale,
        poolStateStale,
        lockExpiryNear: expiry.near,
        lockExpiryPassed: expiry.passed,
        lockExpiryUnknown: expiry.unknown,
        hasUnsupportedLocker: expiry.unsupported,
        incompleteDiscovery,
        knownPositionsVerified: knownVerified,
        positionCount,
        invalidationSignals: signals,
        reuseOwners: false,
        reuseLocks: false,
        refreshOwners: true,
        refreshLocks: true,
        runQuickLp: false,
        runFullRevalidation: false,
        backgroundExhaustive: prior.exhaustiveDiscoveryComplete !== true,
      },
      positionIdsToRevalidate: knownIds.length ? knownIds : cacheIds,
      progressActions: [
        ...progressBase,
        "lp_event_delta_check",
        "lp_owner_refresh",
        "lp_lock_refresh",
        "lp_price_refresh",
        "lp_checkpoint_update",
        "lp_final_validation",
      ],
    };
  }

  if (!lockFresh && hasKnownIds) {
    reasons.push("lock_ttl_expired");
    return {
      outcome: "refresh_lock_status",
      reasons,
      evidence: {
        ownershipFresh,
        lockFresh: false,
        priceStale,
        tvlStale,
        poolStateStale,
        lockExpiryNear: expiry.near,
        lockExpiryPassed: expiry.passed,
        lockExpiryUnknown: expiry.unknown,
        hasUnsupportedLocker: expiry.unsupported,
        incompleteDiscovery,
        knownPositionsVerified: knownVerified,
        positionCount,
        invalidationSignals: signals,
        reuseOwners: ownershipFresh,
        reuseLocks: false,
        refreshOwners: !ownershipFresh,
        refreshLocks: true,
        runQuickLp: false,
        runFullRevalidation: false,
        backgroundExhaustive: prior.exhaustiveDiscoveryComplete !== true,
      },
      positionIdsToRevalidate: knownIds,
      progressActions: [
        ...progressBase,
        "lp_lock_refresh",
        ownershipFresh ? "lp_owner_reuse" : "lp_owner_refresh",
        "lp_price_refresh",
        "lp_final_validation",
      ],
    };
  }

  // No prior positions and incomplete — allow Quick LP once; don't force every refresh.
  if (positionCount === 0 && prior.poolDetected === true && !knownVerified) {
    const quickDone = evidence.lpCheckpoint?.quickComplete === true;
    if (!quickDone) {
      reasons.push("incomplete_discovery");
      return {
        outcome: "full_quick_lp",
        reasons,
        evidence: {
          ownershipFresh: false,
          lockFresh: false,
          priceStale,
          tvlStale,
          poolStateStale,
          lockExpiryNear: false,
          lockExpiryPassed: false,
          lockExpiryUnknown: false,
          hasUnsupportedLocker: false,
          incompleteDiscovery: true,
          knownPositionsVerified: false,
          positionCount: 0,
          invalidationSignals: signals,
          reuseOwners: false,
          reuseLocks: false,
          refreshOwners: true,
          refreshLocks: true,
          runQuickLp: true,
          runFullRevalidation: false,
          backgroundExhaustive: true,
        },
        positionIdsToRevalidate: cacheIds,
        progressActions: [
          ...progressBase,
          "lp_event_delta_check",
          "lp_owner_refresh",
          "lp_lock_refresh",
          "lp_background_exhaustive",
          "lp_final_validation",
        ],
      };
    }
    // Quick already done, still incomplete — reuse empty/partial + price; background exhaustive.
    reasons.push("incomplete_discovery");
  }

  // Structural ownership/lock still fresh.
  if (ownershipFresh && lockFresh && (knownVerified || positionCount > 0 || prior.aggregateState === "NONE")) {
    reasons.push("eligible_reuse");
    if (priceStale || tvlStale) reasons.push("price_tvl_stale");
    if (poolStateStale) reasons.push("pool_balance_stale");

    const needPool = poolStateStale && evidence.manualRefresh;
    const needPrice =
      evidence.manualRefresh || priceStale || tvlStale || needPool;

    if (!needPrice && !needPool) {
      return {
        outcome: "reuse_all",
        reasons,
        evidence: {
          ownershipFresh: true,
          lockFresh: true,
          priceStale,
          tvlStale,
          poolStateStale,
          lockExpiryNear: false,
          lockExpiryPassed: false,
          lockExpiryUnknown: expiry.unknown,
          hasUnsupportedLocker: expiry.unsupported,
          incompleteDiscovery,
          knownPositionsVerified: knownVerified,
          positionCount,
          invalidationSignals: signals,
          reuseOwners: true,
          reuseLocks: true,
          refreshOwners: false,
          refreshLocks: false,
          runQuickLp: false,
          runFullRevalidation: false,
          backgroundExhaustive:
            incompleteDiscovery && prior.exhaustiveDiscoveryComplete !== true,
        },
        positionIdsToRevalidate: [],
        progressActions: [
          ...progressBase,
          "lp_owner_reuse",
          "lp_lock_reuse",
          incompleteDiscovery ? "lp_background_exhaustive" : "lp_final_validation",
          "lp_final_validation",
        ],
      };
    }

    if (needPool && !priceStale && !tvlStale) {
      return {
        outcome: "refresh_pool_state",
        reasons,
        evidence: {
          ownershipFresh: true,
          lockFresh: true,
          priceStale,
          tvlStale,
          poolStateStale: true,
          lockExpiryNear: false,
          lockExpiryPassed: false,
          lockExpiryUnknown: expiry.unknown,
          hasUnsupportedLocker: expiry.unsupported,
          incompleteDiscovery,
          knownPositionsVerified: knownVerified,
          positionCount,
          invalidationSignals: signals,
          reuseOwners: true,
          reuseLocks: true,
          refreshOwners: false,
          refreshLocks: false,
          runQuickLp: false,
          runFullRevalidation: false,
          backgroundExhaustive:
            incompleteDiscovery && prior.exhaustiveDiscoveryComplete !== true,
        },
        positionIdsToRevalidate: [],
        progressActions: [
          ...progressBase,
          "lp_owner_reuse",
          "lp_lock_reuse",
          "lp_pool_state_refresh",
          "lp_final_validation",
        ],
      };
    }

    return {
      outcome: "refresh_price_only",
      reasons,
      evidence: {
        ownershipFresh: true,
        lockFresh: true,
        priceStale: true,
        tvlStale: true,
        poolStateStale: needPool,
        lockExpiryNear: false,
        lockExpiryPassed: false,
        lockExpiryUnknown: expiry.unknown,
        hasUnsupportedLocker: expiry.unsupported,
        incompleteDiscovery,
        knownPositionsVerified: knownVerified,
        positionCount,
        invalidationSignals: signals,
        reuseOwners: true,
        reuseLocks: true,
        refreshOwners: false,
        refreshLocks: false,
        runQuickLp: false,
        runFullRevalidation: false,
        backgroundExhaustive:
          incompleteDiscovery && prior.exhaustiveDiscoveryComplete !== true,
      },
      positionIdsToRevalidate: [],
      progressActions: [
        ...progressBase,
        "lp_event_delta_check",
        "lp_owner_reuse",
        "lp_lock_reuse",
        "lp_price_refresh",
        ...(needPool ? (["lp_pool_state_refresh"] as const) : []),
        incompleteDiscovery ? "lp_background_exhaustive" : "lp_final_validation",
        "lp_final_validation",
      ],
    };
  }

  // Fallback: not enough confidence to reuse — bounded Quick LP (not cold genesis).
  reasons.push(hasKnownIds ? "owner_ttl_expired" : "missing_verified_ids");
  return {
    outcome: hasKnownIds ? "full_quick_lp" : "cold_fallback",
    reasons,
    evidence: {
      ownershipFresh: false,
      lockFresh: false,
      priceStale,
      tvlStale,
      poolStateStale,
      lockExpiryNear: expiry.near,
      lockExpiryPassed: expiry.passed,
      lockExpiryUnknown: expiry.unknown,
      hasUnsupportedLocker: expiry.unsupported,
      incompleteDiscovery,
      knownPositionsVerified: knownVerified,
      positionCount,
      invalidationSignals: signals,
      reuseOwners: false,
      reuseLocks: false,
      refreshOwners: true,
      refreshLocks: true,
      runQuickLp: true,
      runFullRevalidation: !hasKnownIds,
      backgroundExhaustive: true,
    },
    positionIdsToRevalidate: knownIds.length ? knownIds : cacheIds,
    progressActions: [
      ...progressBase,
      "lp_owner_refresh",
      "lp_lock_refresh",
      "lp_background_exhaustive",
      "lp_final_validation",
    ],
  };
}

/** True when plan may skip detectMultiVersion / ownerOf entirely. */
export function isSmartLpStructuralReuse(outcome: SmartLpOutcome): boolean {
  return (
    outcome === "reuse_all" ||
    outcome === "refresh_price_only" ||
    outcome === "refresh_pool_state"
  );
}

/** True when only known position IDs should be revalidated (no Quick PM). */
export function isSmartLpSelectiveOwnerRefresh(outcome: SmartLpOutcome): boolean {
  return (
    outcome === "refresh_position_owner" ||
    outcome === "refresh_lock_status"
  );
}

/** Progress unit mapping — never jumps to 100% while incomplete. */
export function smartLpProgressUnits(
  plan: SmartLpRefreshPlan,
  stepIndex: number,
): { completedUnits: number; totalUnits: number } {
  const totalUnits = Math.max(plan.progressActions.length, 4);
  const completedUnits = Math.min(stepIndex + 1, totalUnits - (plan.evidence.incompleteDiscovery ? 1 : 0));
  return {
    completedUnits: Math.max(0, Math.min(completedUnits, totalUnits)),
    totalUnits,
  };
}

/** Semantic equality for smart vs full LP results (same chain state). */
export function smartLpSemanticEqual(
  a: LpIntelligence | null | undefined,
  b: LpIntelligence | null | undefined,
): boolean {
  if (!a || !b) return a === b;
  if (a.aggregateState !== b.aggregateState) return false;
  if (a.aggregateLockState !== b.aggregateLockState) return false;
  if (Boolean(a.discoveryComplete) !== Boolean(b.discoveryComplete)) return false;
  if (a.positions.length !== b.positions.length) return false;
  const byId = new Map(b.positions.map((p) => [p.positionNftId, p]));
  for (const p of a.positions) {
    const q = byId.get(p.positionNftId);
    if (!q) return false;
    if ((p.owner ?? "").toLowerCase() !== (q.owner ?? "").toLowerCase()) return false;
    if (p.lockState !== q.lockState) return false;
    if (p.unlockTimestamp !== q.unlockTimestamp) return false;
  }
  return true;
}

// —— Per-token LP refresh lock + Promise coalescing ——

const LP_REFRESH_LOCK_TTL_SEC = 120;
const memoryLpLocks = new Map<string, number>();
const inflightLpRefresh = new Map<string, Promise<unknown>>();
let testLpLockKv: Map<string, { value: string; until: number }> | null = null;

function lpRefreshLockKey(chainId: number, tokenAddress: string): string {
  return scopedKvKey(
    "scan",
    "lp",
    "refresh-lock",
    chainId,
    normalizeAddress(tokenAddress),
  );
}

export function useSmartLpRefreshLockTestKv(
  map: Map<string, { value: string; until: number }> | null,
): void {
  testLpLockKv = map;
}

export function clearSmartLpRefreshLocksForTests(): void {
  testLpLockKv = null;
  memoryLpLocks.clear();
  inflightLpRefresh.clear();
}

export async function acquireSmartLpRefreshLock(
  chainId: number,
  tokenAddress: string,
  opts?: { ttlSec?: number; lockToken?: string },
): Promise<{ acquired: boolean; lockToken: string | null; ttlSec: number }> {
  const ttlSec = opts?.ttlSec ?? LP_REFRESH_LOCK_TTL_SEC;
  const lockToken = opts?.lockToken ?? `lp:${Date.now()}`;
  const key = lpRefreshLockKey(chainId, tokenAddress);
  const now = Date.now();

  if (testLpLockKv) {
    const hit = testLpLockKv.get(key);
    if (hit && hit.until > now) {
      return { acquired: false, lockToken: null, ttlSec };
    }
    testLpLockKv.set(key, { value: lockToken, until: now + ttlSec * 1000 });
    return { acquired: true, lockToken, ttlSec };
  }

  const memUntil = memoryLpLocks.get(key);
  if (memUntil != null && memUntil > now) {
    return { acquired: false, lockToken: null, ttlSec };
  }
  memoryLpLocks.set(key, now + ttlSec * 1000);

  try {
    const url =
      process.env.KV_REST_API_URL?.trim() ||
      process.env.UPSTASH_REDIS_REST_URL?.trim() ||
      "";
    const token =
      process.env.KV_REST_API_TOKEN?.trim() ||
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
      "";
    if (url && token) {
      const { kv } = await import("@vercel/kv");
      const ok = await kv.set(key, lockToken, { nx: true, ex: ttlSec });
      if (ok == null) {
        memoryLpLocks.delete(key);
        return { acquired: false, lockToken: null, ttlSec };
      }
    }
  } catch {
    // Memory lock already held — proceed with process-local exclusivity.
  }
  return { acquired: true, lockToken, ttlSec };
}

export async function releaseSmartLpRefreshLock(
  chainId: number,
  tokenAddress: string,
): Promise<void> {
  const key = lpRefreshLockKey(chainId, tokenAddress);
  memoryLpLocks.delete(key);
  if (testLpLockKv) {
    testLpLockKv.delete(key);
    return;
  }
  try {
    const url =
      process.env.KV_REST_API_URL?.trim() ||
      process.env.UPSTASH_REDIS_REST_URL?.trim() ||
      "";
    const token =
      process.env.KV_REST_API_TOKEN?.trim() ||
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
      "";
    if (url && token) {
      const { kv } = await import("@vercel/kv");
      await kv.del(key);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Coalesce concurrent LP refresh work for the same token.
 * Second caller awaits the first promise (duplicate ownerOf suppressed).
 */
export async function coalesceSmartLpRefresh<T>(
  chainId: number,
  tokenAddress: string,
  run: () => Promise<T>,
): Promise<{ result: T; coalesced: boolean }> {
  const key = lpRefreshLockKey(chainId, tokenAddress);
  const existing = inflightLpRefresh.get(key) as Promise<T> | undefined;
  if (existing) {
    return { result: await existing, coalesced: true };
  }
  const promise = (async () => {
    const lock = await acquireSmartLpRefreshLock(chainId, tokenAddress);
    try {
      return await run();
    } finally {
      if (lock.acquired) {
        await releaseSmartLpRefreshLock(chainId, tokenAddress);
      }
      inflightLpRefresh.delete(key);
    }
  })();
  inflightLpRefresh.set(key, promise);
  return { result: await promise, coalesced: false };
}

/** Recover stale in-memory lock (tests / crashed workers). */
export function recoverStaleSmartLpRefreshLock(
  chainId: number,
  tokenAddress: string,
  nowMs: number = Date.now(),
): boolean {
  const key = lpRefreshLockKey(chainId, tokenAddress);
  const until = memoryLpLocks.get(key);
  if (until != null && until <= nowMs) {
    memoryLpLocks.delete(key);
    inflightLpRefresh.delete(key);
    return true;
  }
  if (testLpLockKv) {
    const hit = testLpLockKv.get(key);
    if (hit && hit.until <= nowMs) {
      testLpLockKv.delete(key);
      return true;
    }
  }
  return false;
}

/** Per-token one-shot full LP refresh flags (internal; consumed by Deep). */
const forceLpFullRefreshOnce = new Set<string>();
/**
 * Manual user refresh — Deep must evaluate Smart LP (never skip liquidity).
 * Memory for same-isolate tests; KV for cross-isolate API → after() Deep.
 */
const manualSmartLpRefreshOnce = new Map<string, number>();
const MANUAL_SMART_LP_TTL_MS = 3 * 60 * 1000;
let testManualKv: Map<string, number> | null = null;

function manualSmartLpKvKey(chainId: number, tokenAddress: string): string {
  return scopedKvKey(
    "scan",
    "lp",
    "manual-smart",
    chainId,
    normalizeAddress(tokenAddress),
  );
}

function isScanKvConfigured(): boolean {
  const url =
    process.env.KV_REST_API_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    "";
  const token =
    process.env.KV_REST_API_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    "";
  return Boolean(url && token);
}

export function markForceLpFullRefresh(address: string): void {
  forceLpFullRefreshOnce.add(normalizeAddress(address));
}

export function consumeForceLpFullRefresh(address: string): boolean {
  const key = normalizeAddress(address);
  if (forceLpFullRefreshOnce.has(key)) {
    forceLpFullRefreshOnce.delete(key);
    return true;
  }
  if (process.env.HANSOME_FORCE_LP_FULL_REFRESH === "1") {
    return true;
  }
  return false;
}

export function useManualSmartLpTestKv(map: Map<string, number> | null): void {
  testManualKv = map;
}

export async function markManualSmartLpRefresh(
  chainId: number,
  tokenAddress: string,
): Promise<void> {
  const until = Date.now() + MANUAL_SMART_LP_TTL_MS;
  const addr = normalizeAddress(tokenAddress);
  const memKey = `${chainId}:${addr}`;
  manualSmartLpRefreshOnce.set(memKey, until);
  const kvKey = manualSmartLpKvKey(chainId, tokenAddress);
  if (testManualKv) {
    testManualKv.set(kvKey, until);
    return;
  }
  if (!isScanKvConfigured()) return;
  try {
    const { kv } = await import("@vercel/kv");
    await kv.set(kvKey, String(until), {
      ex: Math.ceil(MANUAL_SMART_LP_TTL_MS / 1000),
    });
  } catch (err) {
    console.warn("[smart-lp] mark manual refresh KV failed:", err);
  }
}

export async function peekManualSmartLpRefresh(
  chainId: number,
  tokenAddress: string,
): Promise<boolean> {
  const now = Date.now();
  const addr = normalizeAddress(tokenAddress);
  const memKey = `${chainId}:${addr}`;
  const memUntil = manualSmartLpRefreshOnce.get(memKey);
  if (memUntil != null && memUntil > now) return true;
  const kvKey = manualSmartLpKvKey(chainId, tokenAddress);
  if (testManualKv) {
    const u = testManualKv.get(kvKey);
    return u != null && u > now;
  }
  if (!isScanKvConfigured()) return false;
  try {
    const { kv } = await import("@vercel/kv");
    const raw = await kv.get<string | number>(kvKey);
    const until = typeof raw === "string" ? Number(raw) : Number(raw);
    return Number.isFinite(until) && until > now;
  } catch {
    return false;
  }
}

export async function consumeManualSmartLpRefresh(
  chainId: number,
  tokenAddress: string,
): Promise<boolean> {
  const peeked = await peekManualSmartLpRefresh(chainId, tokenAddress);
  if (!peeked) return false;
  const addr = normalizeAddress(tokenAddress);
  manualSmartLpRefreshOnce.delete(`${chainId}:${addr}`);
  const kvKey = manualSmartLpKvKey(chainId, tokenAddress);
  if (testManualKv) {
    testManualKv.delete(kvKey);
    return true;
  }
  if (isScanKvConfigured()) {
    try {
      const { kv } = await import("@vercel/kv");
      await kv.del(kvKey);
    } catch {
      /* ignore */
    }
  }
  return true;
}

export function clearForceLpFullRefreshForTests(): void {
  forceLpFullRefreshOnce.clear();
  manualSmartLpRefreshOnce.clear();
  testManualKv = null;
}
