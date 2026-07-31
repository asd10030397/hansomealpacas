import { LP_AGGREGATE_STATE_DISPLAY } from "@/lib/hansome-score/constants";
import type {
  LpAggregateState,
  LpLockState,
  LockDistributionReport,
  PositionLockCounts,
  V4PositionInfo,
} from "@/lib/hansome-score/types";

/** Material = positive liquidity (closed/zero-L positions don't drive aggregate). */
export function materialPositions(positions: V4PositionInfo[]): V4PositionInfo[] {
  const active = positions.filter((p) => {
    if (p.liquidity == null) return true;
    try {
      return BigInt(p.liquidity) > 0n;
    } catch {
      return true;
    }
  });
  return active.length > 0 ? active : positions;
}

export function isPositionLocked(p: V4PositionInfo): boolean {
  return (
    p.lockState === "LOCKED_VERIFIED_ONCHAIN" ||
    p.lockState === "LOCK_DETECTED_EXPIRY_UNKNOWN"
  );
}

export function isPositionRemovable(p: V4PositionInfo): boolean {
  return (
    p.removableByEoa === true ||
    p.lockState === "UNLOCKED_EOA_CONTROLLED" ||
    p.lockState === "UNSUPPORTED_LOCKER"
  );
}

export function isPositionUnknown(p: V4PositionInfo): boolean {
  return (
    p.lockState === "UNABLE_TO_DETERMINE" ||
    (p.removableByEoa == null &&
      p.lockState !== "LOCKED_VERIFIED_ONCHAIN" &&
      p.lockState !== "UNLOCKED_EOA_CONTROLLED")
  );
}

export function countPositionLocks(positions: V4PositionInfo[]): PositionLockCounts {
  const material = materialPositions(positions);
  let locked = 0;
  let unlocked = 0;
  let unknown = 0;
  for (const p of material) {
    if (isPositionLocked(p) && !isPositionRemovable(p)) locked++;
    else if (isPositionRemovable(p)) unlocked++;
    else unknown++;
  }
  return {
    detected: positions.length,
    material: material.length,
    locked,
    unlocked,
    unknown,
  };
}

/**
 * Token-level aggregate.
 * CRITICAL: one verified locked position must NEVER yield ALL_LOCKED unless
 * discoveryCompleteness is true AND every material position is locked.
 */
export function computeTokenAggregate(params: {
  positions: V4PositionInfo[];
  poolDetected: boolean;
  discoveryComplete: boolean;
}): {
  aggregate: LpAggregateState;
  display: string;
  scoreLockState: LpLockState;
} {
  const { positions, poolDetected, discoveryComplete } = params;
  if (!poolDetected) {
    return {
      aggregate: "NONE",
      display: LP_AGGREGATE_STATE_DISPLAY.NONE,
      scoreLockState: "NONE",
    };
  }
  if (positions.length === 0) {
    return {
      aggregate: "UNKNOWN_INCOMPLETE",
      display: LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE,
      scoreLockState: "UNABLE_TO_DETERMINE",
    };
  }

  const material = materialPositions(positions);
  const hasLocked = material.some((p) => isPositionLocked(p) && !isPositionRemovable(p));
  const hasRemovable = material.some((p) => isPositionRemovable(p));
  const hasUnknown = material.some(
    (p) => isPositionUnknown(p) && !isPositionRemovable(p) && !isPositionLocked(p),
  );

  if (hasLocked && hasRemovable) {
    return {
      aggregate: "MIXED",
      display: LP_AGGREGATE_STATE_DISPLAY.MIXED,
      scoreLockState: "MIXED",
    };
  }

  if (hasRemovable && !hasLocked) {
    if (!discoveryComplete || hasUnknown) {
      return {
        aggregate: "UNKNOWN_INCOMPLETE",
        display: LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE,
        scoreLockState: "UNABLE_TO_DETERMINE",
      };
    }
    return {
      aggregate: "ALL_UNLOCKED",
      display: LP_AGGREGATE_STATE_DISPLAY.ALL_UNLOCKED,
      scoreLockState: "UNLOCKED_EOA_CONTROLLED",
    };
  }

  if (hasLocked && !hasRemovable) {
    const allVerifiedLocked = material.every(
      (p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN" && p.removableByEoa === false,
    );
    if (discoveryComplete && allVerifiedLocked && !hasUnknown) {
      return {
        aggregate: "ALL_LOCKED",
        display: LP_AGGREGATE_STATE_DISPLAY.ALL_LOCKED,
        scoreLockState: "LOCKED_VERIFIED_ONCHAIN",
      };
    }
    return {
      aggregate: "UNKNOWN_INCOMPLETE",
      display: LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE,
      scoreLockState: "UNABLE_TO_DETERMINE",
    };
  }

  return {
    aggregate: "UNKNOWN_INCOMPLETE",
    display: LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE,
    scoreLockState: "UNABLE_TO_DETERMINE",
  };
}

/**
 * Placeholder before USD enrichment in scan.
 * Primary UI must use computeEconomicLockDistribution (token amounts → USD).
 * Raw L is NEVER used for lock %.
 */
export function computeLockDistribution(
  _positions: V4PositionInfo[],
): LockDistributionReport {
  return {
    available: false,
    lockedPct: null,
    unlockedPct: null,
    unknownPct: null,
    lockedUsd: null,
    unlockedUsd: null,
    unknownUsd: null,
    totalPositionUsd: null,
    poolLiquidityUsd: null,
    reconciledWithPool: false,
    method: null,
    reason:
      "Lock percentage pending economic valuation (token amounts × USD). Raw concentrated-liquidity L is never used.",
  };
}
