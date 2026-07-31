/**
 * Cold Perf V2 Phase 8.1 — Known-First LP Early Exit.
 *
 * Narrow orchestration: exit Liquidity early when previously verified known LP
 * evidence is still fresh and sufficient. Does NOT enable Phase 7.1 Smart LP.
 * Does NOT change liquidity math, lock semantics, ownership semantics, scoring,
 * findings, or completeness rules.
 */

import { getAddress } from "viem";
import { SCORE_SPEC_VERSION } from "@/lib/hansome-score/constants";
import { ANALYSIS_SEMANTIC_VERSION } from "@/lib/hansome-score/warm-incremental";
import {
  computeTokenAggregate,
  materialPositions,
} from "@/lib/hansome-score/lp/aggregate";
import type { LpDiscoveryCheckpoint } from "@/lib/hansome-score/lp/discovery-checkpoint";
import type { LpDiscoveryCache } from "@/lib/hansome-score/lp/position-cache";
import {
  SMART_LP_CACHE_SCHEMA_VERSION,
  SMART_LP_FRESHNESS,
  type SmartLpInvalidationSignal,
} from "@/lib/hansome-score/lp/smart-refresh";
import type { LpIntelligence, V4PositionInfo } from "@/lib/hansome-score/types";

/** Reuse Smart LP component TTLs — no single global LP TTL. */
export const KNOWN_FIRST_FRESHNESS = {
  ...SMART_LP_FRESHNESS,
} as const;

export const KNOWN_FIRST_PROGRESS_ACTIONS = [
  "lp_known_first_plan",
  "lp_known_evidence_load",
  "lp_known_evidence_validate",
  "lp_owner_reuse",
  "lp_owner_revalidate",
  "lp_lock_reuse",
  "lp_lock_revalidate",
  "lp_market_refresh",
  "lp_known_first_early_exit",
  "lp_full_quick_fallback",
  "lp_background_exhaustive",
  "lp_final_validation",
] as const;

export type KnownFirstProgressAction =
  (typeof KNOWN_FIRST_PROGRESS_ACTIONS)[number];

export type KnownFirstOutcome =
  | "known_first_reuse"
  | "known_first_price_only"
  | "known_first_owner_revalidate"
  | "known_first_lock_revalidate"
  | "known_first_insufficient"
  | "full_quick_fallback"
  | "cold_fallback";

export type KnownFirstReasonCode =
  | "eligible_reuse"
  | "price_tvl_stale"
  | "pool_balance_stale"
  | "owner_ttl_expired"
  | "lock_ttl_expired"
  | "lock_expiry_near"
  | "lock_expiry_passed"
  | "mixed_sufficient"
  | "mixed_insufficient"
  | "all_locked_incomplete_forbidden"
  | "no_liquidity_forbidden"
  | "unknown_honest"
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
  | "position_nft_transfer"
  | "liquidity_event"
  | "position_burn"
  | "owner_change"
  | "locker_event"
  | "proxy_impl_change"
  | "pair_discovery"
  | "pool_migration"
  | "failed_owner_retry"
  | "unsupported_locker"
  | "manual_freshness_eval";

export type KnownFirstEvidence = {
  chainId: number;
  expectedChainId: number;
  tokenAddress: string;
  analysisSemanticVersion: string | null;
  lpCacheSchemaVersion: number | null;
  lpCache: LpDiscoveryCache | null;
  lpCheckpoint: LpDiscoveryCheckpoint | null;
  priorLp: LpIntelligence | null;
  ownershipValidatedAgeMs: number | null;
  lockValidatedAgeMs: number | null;
  poolStateAgeMs: number | null;
  priceAgeMs: number | null;
  tvlAgeMs: number | null;
  snapshotAgeMs: number | null;
  priorPartialFailure: boolean;
  forceLpFullRefresh: boolean;
  reorgConflict: boolean;
  manualRefresh: boolean;
  invalidationSignals: SmartLpInvalidationSignal[];
  failedOwnerIds: string[];
  nowMs: number;
};

export type KnownFirstEarlyExitPlan = {
  outcome: KnownFirstOutcome;
  reasons: KnownFirstReasonCode[];
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
    sufficient: boolean;
    reconstructedState: string | null;
    skipBroadQuick: boolean;
    skipBroadTitan: boolean;
    backgroundExhaustive: boolean;
    invalidationSignals: SmartLpInvalidationSignal[];
  };
  positionIdsToRevalidate: string[];
  progressActions: KnownFirstProgressAction[];
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
  const warnSec = Math.floor(KNOWN_FIRST_FRESHNESS.lockExpiryWarningMs / 1000);
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
      if (p.lockState === "LOCK_DETECTED_EXPIRY_UNKNOWN") unknown = true;
      continue;
    }
    if (p.unlockTimestamp == null) continue;
    if (p.unlockTimestamp <= nowSec) passed = true;
    else if (p.unlockTimestamp - nowSec <= warnSec) near = true;
  }
  return { near, passed, unknown, unsupported };
}

/**
 * Explicit sufficiency for known-first early exit.
 * Never upgrades Incomplete→ALL_LOCKED; never invents No Liquidity.
 */
export function knownFirstEvidenceSufficient(prior: LpIntelligence): {
  sufficient: boolean;
  reason: KnownFirstReasonCode;
  reconstructedState: string;
} {
  const positions = prior.positions ?? [];
  const discoveryComplete = prior.discoveryComplete === true;

  if (!prior.poolDetected) {
    if (prior.aggregateState === "NONE" || prior.aggregateLockState === "NONE") {
      return {
        sufficient: true,
        reason: "eligible_reuse",
        reconstructedState: "NONE",
      };
    }
    return {
      sufficient: false,
      reason: "no_liquidity_forbidden",
      reconstructedState: "UNKNOWN_INCOMPLETE",
    };
  }

  if (positions.length === 0) {
    return {
      sufficient: false,
      reason: "missing_verified_ids",
      reconstructedState: "UNKNOWN_INCOMPLETE",
    };
  }

  const { aggregate } = computeTokenAggregate({
    positions,
    poolDetected: true,
    // Force incomplete lens for known-first — never allow ALL_LOCKED shortcut.
    discoveryComplete: false,
  });

  // Reconstruct with honest completeness for ALL_* only when prior was complete.
  const { aggregate: completeLens } = computeTokenAggregate({
    positions,
    poolDetected: true,
    discoveryComplete,
  });

  const mat = materialPositions(positions);
  const hasLocked = mat.some(
    (p) =>
      p.lockState === "LOCKED_VERIFIED_ONCHAIN" ||
      p.lockState === "LOCK_DETECTED_EXPIRY_UNKNOWN",
  );
  const hasRemovable = mat.some(
    (p) =>
      p.removableByEoa === true || p.lockState === "UNLOCKED_EOA_CONTROLLED",
  );

  if (prior.aggregateState === "MIXED" || prior.aggregateLockState === "MIXED") {
    if (hasLocked && hasRemovable && aggregate === "MIXED") {
      return {
        sufficient: true,
        reason: "mixed_sufficient",
        reconstructedState: "MIXED",
      };
    }
    return {
      sufficient: false,
      reason: "mixed_insufficient",
      reconstructedState: aggregate,
    };
  }

  if (
    prior.aggregateState === "ALL_LOCKED" ||
    prior.aggregateLockState === "LOCKED_VERIFIED_ONCHAIN"
  ) {
    if (!discoveryComplete || completeLens !== "ALL_LOCKED") {
      return {
        sufficient: false,
        reason: "all_locked_incomplete_forbidden",
        reconstructedState: aggregate,
      };
    }
    return {
      sufficient: true,
      reason: "eligible_reuse",
      reconstructedState: "ALL_LOCKED",
    };
  }

  if (
    prior.aggregateState === "ALL_UNLOCKED" ||
    prior.aggregateLockState === "UNLOCKED_EOA_CONTROLLED"
  ) {
    if (discoveryComplete && completeLens === "ALL_UNLOCKED") {
      return {
        sufficient: true,
        reason: "eligible_reuse",
        reconstructedState: "ALL_UNLOCKED",
      };
    }
    // Incomplete unlocked-looking set stays Unknown — reusable as Unknown only.
    if (
      aggregate === "UNKNOWN_INCOMPLETE" &&
      (prior.aggregateState === "UNKNOWN_INCOMPLETE" ||
        prior.aggregateLockState === "UNABLE_TO_DETERMINE")
    ) {
      return {
        sufficient: true,
        reason: "unknown_honest",
        reconstructedState: "UNKNOWN_INCOMPLETE",
      };
    }
    return {
      sufficient: false,
      reason: "mixed_insufficient",
      reconstructedState: aggregate,
    };
  }

  if (
    prior.aggregateState === "UNKNOWN_INCOMPLETE" ||
    prior.aggregateLockState === "UNABLE_TO_DETERMINE"
  ) {
    if (positions.length > 0) {
      return {
        sufficient: true,
        reason: "unknown_honest",
        reconstructedState: "UNKNOWN_INCOMPLETE",
      };
    }
  }

  if (prior.aggregateState === "NONE") {
    return {
      sufficient: !prior.poolDetected,
      reason: prior.poolDetected
        ? "no_liquidity_forbidden"
        : "eligible_reuse",
      reconstructedState: prior.poolDetected ? "UNKNOWN_INCOMPLETE" : "NONE",
    };
  }

  return {
    sufficient: false,
    reason: "mixed_insufficient",
    reconstructedState: aggregate,
  };
}

export function buildKnownFirstEvidence(params: {
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
}): KnownFirstEvidence {
  const nowMs = params.nowMs ?? Date.now();
  const cache = params.lpCache ?? null;
  const ownershipValidatedAgeMs =
    cache?.knownVerifiedAt != null
      ? Math.max(0, nowMs - cache.knownVerifiedAt)
      : params.snapshotAgeMs ?? null;
  return {
    chainId: params.chainId,
    expectedChainId: params.expectedChainId,
    tokenAddress: normalizeAddress(params.tokenAddress),
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
 * Plan known-first early exit. Fail-closed to full Quick / cold.
 * Independent of HANSOME_SMART_LP_REFRESH.
 */
export function planKnownFirstLpEarlyExit(
  evidence: KnownFirstEvidence,
): KnownFirstEarlyExitPlan {
  const reasons: KnownFirstReasonCode[] = [];
  const signals = [...evidence.invalidationSignals];
  const prior = evidence.priorLp;
  const positions = prior?.positions ?? [];
  const positionCount = positions.length;
  const knownIds = positions.map((p) => p.positionNftId).filter(Boolean);
  const cacheIds = evidence.lpCache?.positionIds ?? [];

  const progressBase: KnownFirstProgressAction[] = [
    "lp_known_first_plan",
    "lp_known_evidence_load",
    "lp_known_evidence_validate",
  ];

  const fail = (
    outcome: KnownFirstOutcome,
    extra: KnownFirstReasonCode[],
    actions: KnownFirstProgressAction[] = [
      "lp_full_quick_fallback",
      "lp_final_validation",
    ],
  ): KnownFirstEarlyExitPlan => ({
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
      sufficient: false,
      reconstructedState: null,
      skipBroadQuick: false,
      skipBroadTitan: false,
      backgroundExhaustive: prior?.exhaustiveDiscoveryComplete !== true,
      invalidationSignals: signals,
    },
    positionIdsToRevalidate: knownIds.length ? knownIds : cacheIds,
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
    return fail("full_quick_fallback", ["reorg_conflict"]);
  }
  if (evidence.forceLpFullRefresh) {
    return fail("full_quick_fallback", ["force_full_lp"]);
  }
  if (evidence.priorPartialFailure) {
    return fail("full_quick_fallback", ["partial_failure_retry"]);
  }
  if (!prior) {
    return fail("cold_fallback", ["missing_prior_positions", "corrupt_prior"]);
  }
  if (
    prior.knownPositionsVerified === true &&
    positionCount === 0 &&
    prior.poolDetected === true
  ) {
    return fail("full_quick_fallback", ["corrupt_prior", "missing_verified_ids"]);
  }
  if (signals.includes("proxy_implementation_change")) {
    return fail("full_quick_fallback", ["proxy_impl_change"]);
  }
  if (
    signals.includes("pool_migration") ||
    signals.includes("token_pair_discovery")
  ) {
    return fail("full_quick_fallback", [
      signals.includes("pool_migration") ? "pool_migration" : "pair_discovery",
    ]);
  }

  const sufficiency = knownFirstEvidenceSufficient(prior);
  if (!sufficiency.sufficient) {
    reasons.push(sufficiency.reason);
    if (positionCount === 0 && !cacheIds.length) {
      return fail("cold_fallback", [sufficiency.reason]);
    }
    return fail("known_first_insufficient", [sufficiency.reason], [
      "lp_full_quick_fallback",
      "lp_background_exhaustive",
      "lp_final_validation",
    ]);
  }
  reasons.push(sufficiency.reason);

  const expiry = lockExpiryFlags(positions, evidence.nowMs);
  const ownershipFresh = !ageExceeds(
    evidence.ownershipValidatedAgeMs,
    KNOWN_FIRST_FRESHNESS.positionOwnerMs,
  );
  const lockFresh =
    ownershipFresh &&
    !ageExceeds(
      evidence.lockValidatedAgeMs,
      KNOWN_FIRST_FRESHNESS.lockClassificationMs,
    ) &&
    !expiry.near &&
    !expiry.passed;
  const priceStale = ageExceeds(
    evidence.priceAgeMs,
    KNOWN_FIRST_FRESHNESS.priceMs,
  );
  const tvlStale = ageExceeds(evidence.tvlAgeMs, KNOWN_FIRST_FRESHNESS.tvlMs);
  const poolStateStale = ageExceeds(
    evidence.poolStateAgeMs,
    KNOWN_FIRST_FRESHNESS.poolBalancesMs,
  );
  const incompleteDiscovery = prior.discoveryComplete !== true;
  const knownVerified =
    prior.knownPositionsVerified === true ||
    sufficiency.sufficient ||
    knownIds.length > 0;
  const hasKnownIds = knownIds.length > 0 || cacheIds.length > 0;

  if (evidence.manualRefresh) reasons.push("manual_freshness_eval");

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
    return fail("full_quick_fallback", ["position_burn"]);
  }
  if (hasNftTransfer) {
    reasons.push("position_nft_transfer");
    return {
      outcome: "known_first_owner_revalidate",
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
        sufficient: true,
        reconstructedState: sufficiency.reconstructedState,
        skipBroadQuick: true,
        skipBroadTitan: true,
        backgroundExhaustive: prior.exhaustiveDiscoveryComplete !== true,
        invalidationSignals: signals,
      },
      positionIdsToRevalidate: knownIds.length ? knownIds : cacheIds,
      progressActions: [
        ...progressBase,
        "lp_owner_revalidate",
        "lp_lock_revalidate",
        "lp_market_refresh",
        "lp_known_first_early_exit",
        "lp_final_validation",
      ],
    };
  }
  if (hasLockerEvent) {
    reasons.push("locker_event", "owner_change");
    return {
      outcome: "known_first_lock_revalidate",
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
        sufficient: true,
        reconstructedState: sufficiency.reconstructedState,
        skipBroadQuick: true,
        skipBroadTitan: true,
        backgroundExhaustive: prior.exhaustiveDiscoveryComplete !== true,
        invalidationSignals: signals,
      },
      positionIdsToRevalidate: knownIds.length ? knownIds : cacheIds,
      progressActions: [
        ...progressBase,
        ownershipFresh ? "lp_owner_reuse" : "lp_owner_revalidate",
        "lp_lock_revalidate",
        "lp_market_refresh",
        "lp_known_first_early_exit",
        "lp_final_validation",
      ],
    };
  }
  if (hasLiquidityEvent) {
    // Bounded liquidity event without NFT transfer — prefer full Quick to
    // rediscover new positions rather than falsely reuse MIXED IDs alone.
    return fail("full_quick_fallback", ["liquidity_event"]);
  }

  if (!hasKnownIds) {
    return fail("cold_fallback", ["missing_verified_ids"]);
  }

  if (evidence.failedOwnerIds.length > 0) {
    reasons.push("failed_owner_retry");
    return {
      outcome: "known_first_owner_revalidate",
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
        sufficient: true,
        reconstructedState: sufficiency.reconstructedState,
        skipBroadQuick: true,
        skipBroadTitan: true,
        backgroundExhaustive: prior.exhaustiveDiscoveryComplete !== true,
        invalidationSignals: signals,
      },
      positionIdsToRevalidate: evidence.failedOwnerIds,
      progressActions: [
        ...progressBase,
        "lp_owner_revalidate",
        "lp_lock_revalidate",
        "lp_market_refresh",
        "lp_known_first_early_exit",
        "lp_final_validation",
      ],
    };
  }

  if (expiry.passed || expiry.near) {
    reasons.push(expiry.passed ? "lock_expiry_passed" : "lock_expiry_near");
    return {
      outcome: "known_first_lock_revalidate",
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
        sufficient: true,
        reconstructedState: sufficiency.reconstructedState,
        skipBroadQuick: true,
        skipBroadTitan: true,
        backgroundExhaustive: prior.exhaustiveDiscoveryComplete !== true,
        invalidationSignals: signals,
      },
      positionIdsToRevalidate: knownIds,
      progressActions: [
        ...progressBase,
        ownershipFresh ? "lp_owner_reuse" : "lp_owner_revalidate",
        "lp_lock_revalidate",
        "lp_market_refresh",
        "lp_known_first_early_exit",
        "lp_final_validation",
      ],
    };
  }

  if (expiry.unsupported && ownershipFresh && lockFresh) {
    reasons.push("unsupported_locker");
  }

  if (!ownershipFresh) {
    reasons.push("owner_ttl_expired");
    return {
      outcome: "known_first_owner_revalidate",
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
        sufficient: true,
        reconstructedState: sufficiency.reconstructedState,
        skipBroadQuick: true,
        skipBroadTitan: true,
        backgroundExhaustive: prior.exhaustiveDiscoveryComplete !== true,
        invalidationSignals: signals,
      },
      positionIdsToRevalidate: knownIds.length ? knownIds : cacheIds,
      progressActions: [
        ...progressBase,
        "lp_owner_revalidate",
        "lp_lock_revalidate",
        "lp_market_refresh",
        "lp_known_first_early_exit",
        "lp_final_validation",
      ],
    };
  }

  if (!lockFresh) {
    reasons.push("lock_ttl_expired");
    return {
      outcome: "known_first_lock_revalidate",
      reasons,
      evidence: {
        ownershipFresh: true,
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
        sufficient: true,
        reconstructedState: sufficiency.reconstructedState,
        skipBroadQuick: true,
        skipBroadTitan: true,
        backgroundExhaustive: prior.exhaustiveDiscoveryComplete !== true,
        invalidationSignals: signals,
      },
      positionIdsToRevalidate: knownIds,
      progressActions: [
        ...progressBase,
        "lp_owner_reuse",
        "lp_lock_revalidate",
        "lp_market_refresh",
        "lp_known_first_early_exit",
        "lp_final_validation",
      ],
    };
  }

  // Structural reuse path.
  reasons.push("eligible_reuse");
  if (incompleteDiscovery) reasons.push("incomplete_discovery");
  if (priceStale || tvlStale) reasons.push("price_tvl_stale");
  if (poolStateStale) reasons.push("pool_balance_stale");

  const needMarket =
    evidence.manualRefresh || priceStale || tvlStale || poolStateStale;
  const bg =
    incompleteDiscovery && prior.exhaustiveDiscoveryComplete !== true;

  const baseEvidence = {
    ownershipFresh: true as const,
    lockFresh: true as const,
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
    sufficient: true,
    reconstructedState: sufficiency.reconstructedState,
    skipBroadQuick: true,
    skipBroadTitan: true,
    backgroundExhaustive: bg,
    invalidationSignals: signals,
  };

  if (!needMarket) {
    return {
      outcome: "known_first_reuse",
      reasons,
      evidence: baseEvidence,
      positionIdsToRevalidate: [],
      progressActions: [
        ...progressBase,
        "lp_owner_reuse",
        "lp_lock_reuse",
        "lp_known_first_early_exit",
        ...(bg ? (["lp_background_exhaustive"] as const) : []),
        "lp_final_validation",
      ],
    };
  }

  return {
    outcome: "known_first_price_only",
    reasons,
    evidence: { ...baseEvidence, priceStale: true, tvlStale: true },
    positionIdsToRevalidate: [],
    progressActions: [
      ...progressBase,
      "lp_owner_reuse",
      "lp_lock_reuse",
      "lp_market_refresh",
      "lp_known_first_early_exit",
      ...(bg ? (["lp_background_exhaustive"] as const) : []),
      "lp_final_validation",
    ],
  };
}

export function isKnownFirstStructuralReuse(outcome: KnownFirstOutcome): boolean {
  return (
    outcome === "known_first_reuse" || outcome === "known_first_price_only"
  );
}

export function isKnownFirstSelectiveRevalidate(
  outcome: KnownFirstOutcome,
): boolean {
  return (
    outcome === "known_first_owner_revalidate" ||
    outcome === "known_first_lock_revalidate"
  );
}

export function knownFirstProgressUnits(
  plan: KnownFirstEarlyExitPlan,
  stepIndex: number,
): { completedUnits: number; totalUnits: number } {
  const totalUnits = Math.max(plan.progressActions.length, 4);
  const completedUnits = Math.min(
    stepIndex + 1,
    totalUnits - (plan.evidence.incompleteDiscovery ? 1 : 0),
  );
  return {
    completedUnits: Math.max(0, Math.min(completedUnits, totalUnits)),
    totalUnits,
  };
}

/** Semantic equality for known-first vs full Quick (hard fields). */
export function knownFirstSemanticEqual(
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
    if ((p.owner ?? "").toLowerCase() !== (q.owner ?? "").toLowerCase()) {
      return false;
    }
    if (p.lockState !== q.lockState) return false;
    if (p.unlockTimestamp !== q.unlockTimestamp) return false;
  }
  return true;
}

/**
 * Attempt-scoped request memoization (Deep attempt only).
 * Broader reuse still goes through existing LP discovery / market caches.
 */
export type AttemptLpRequestMemo = {
  ownerOf: Map<string, Promise<string | null>>;
  readPosition: Map<string, Promise<unknown>>;
  lockerClass: Map<string, Promise<unknown>>;
  poolState: Map<string, Promise<unknown>>;
  pairMeta: Map<string, Promise<unknown>>;
  priceEthUsd: Map<string, Promise<unknown>>;
  stats: {
    ownerOfHits: number;
    ownerOfMisses: number;
    readPositionHits: number;
    readPositionMisses: number;
  };
};

export function createAttemptLpRequestMemo(): AttemptLpRequestMemo {
  return {
    ownerOf: new Map(),
    readPosition: new Map(),
    lockerClass: new Map(),
    poolState: new Map(),
    pairMeta: new Map(),
    priceEthUsd: new Map(),
    stats: {
      ownerOfHits: 0,
      ownerOfMisses: 0,
      readPositionHits: 0,
      readPositionMisses: 0,
    },
  };
}

export async function memoizeAttemptRequest<T>(
  map: Map<string, Promise<T>>,
  key: string,
  run: () => Promise<T>,
  onHit?: () => void,
  onMiss?: () => void,
): Promise<T> {
  const existing = map.get(key);
  if (existing) {
    onHit?.();
    return existing;
  }
  onMiss?.();
  const p = run();
  map.set(key, p);
  try {
    return await p;
  } catch (err) {
    map.delete(key);
    throw err;
  }
}
