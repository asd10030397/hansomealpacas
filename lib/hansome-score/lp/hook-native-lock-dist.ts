/**
 * Phase 12A.1 — Class B (hook_native) lockDistribution honesty invariant.
 * Presentation / publish guard only — does not change Titan or Score formulas.
 */

import type { LockDistributionReport } from "@/lib/hansome-score/types";

/** Explicit Class B reason (equivalent: HOOK_NATIVE_NOT_APPLICABLE). */
export const HOOK_NATIVE_LOCK_DISTRIBUTION_REASON =
  "Lock percentage unavailable for hook-native (Class B) V4 liquidity — Doppler lock adapter not implemented.";

/** Alias for tests / callers that prefer the short code. */
export const HOOK_NATIVE_NOT_APPLICABLE = "HOOK_NATIVE_NOT_APPLICABLE";

type LockDistLike = Partial<LockDistributionReport> & {
  available?: boolean;
  reason?: string | null;
};

/**
 * Force lock% unavailable for Class B. Never invent Titan economic lock%.
 */
export function retainHookNativeLockDistribution(
  current: LockDistLike | null | undefined,
): LockDistributionReport {
  const reason =
    current?.reason &&
    (current.reason.includes("hook-native") ||
      current.reason.includes(HOOK_NATIVE_NOT_APPLICABLE))
      ? current.reason
      : HOOK_NATIVE_LOCK_DISTRIBUTION_REASON;
  return {
    available: false,
    lockedPct: null,
    unlockedPct: null,
    unknownPct: null,
    lockedUsd: null,
    unlockedUsd: null,
    unknownUsd: null,
    totalPositionUsd: null,
    poolLiquidityUsd: current?.poolLiquidityUsd ?? null,
    reconciledWithPool: false,
    method: null,
    reason,
  };
}

export function isHookNativeOwnership(
  ownershipClass: string | null | undefined,
): boolean {
  return ownershipClass === "hook_native";
}
