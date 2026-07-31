/**
 * Phase 11G — separate Hook-owned principal from foreign LP in the same PoolKey.
 * Classification is by position owner only — never token balance / inventory / fees.
 */

import { getAddress } from "viem";
import { classifyHookPositionOwner } from "@/lib/hansome-score/lp/hook-position-index/classify";
import type { HookPositionIndexState } from "@/lib/hansome-score/lp/hook-position-index/types";
import type { HookPositionValuation, HookPositionValuationSummary } from "@/lib/hansome-score/lp/hook-position-valuer/types";
import type {
  HookForeignLpSeparation,
  HookForeignLpSeparationPublic,
  HookForeignLpTerminalState,
} from "@/lib/hansome-score/lp/hook-foreign-lp/types";

export function classifyForeignOwner(params: {
  owner: string;
  hookAddress: string;
  positionManager: string;
}): "hook_owned" | "foreign_posm" | "foreign_other" | "unknown" {
  return classifyHookPositionOwner({
    sender: params.owner,
    hookAddress: params.hookAddress,
    positionManager: params.positionManager,
  });
}

function isActive(p: HookPositionValuation): boolean {
  try {
    return BigInt(p.liquidity) > 0n;
  } catch {
    return false;
  }
}

export function separateForeignLp(params: {
  index: HookPositionIndexState;
  valuations: HookPositionValuation[];
  valuationSummary: HookPositionValuationSummary;
  hookAddress?: string | null;
  positionManager?: string | null;
}): HookForeignLpSeparation {
  const poolId = params.index.poolId.toLowerCase();
  const incomplete: string[] = [
    ...(params.index.incompleteReasons ?? []),
    ...(params.valuationSummary.incompleteReasons ?? []),
  ];

  const hookAddr =
    params.hookAddress ??
    params.index.hookAddress ??
    null;
  const posm =
    params.positionManager ??
    params.index.positionManager ??
    null;

  // Re-assert owner classification (never trust foreign labels from balance)
  const positions = params.valuations.map((p) => {
    if (!hookAddr || !posm) return p;
    const c = classifyForeignOwner({
      owner: p.owner,
      hookAddress: hookAddr,
      positionManager: posm,
    });
    return c === p.classification ? p : { ...p, classification: c };
  });

  const hookOwned = positions.filter((p) => p.classification === "hook_owned");
  const foreignPosm = positions.filter((p) => p.classification === "foreign_posm");
  const foreignOther = positions.filter((p) => p.classification === "foreign_other");

  const activeHook = hookOwned.filter(isActive);
  const activePosm = foreignPosm.filter(isActive);
  const activeOther = foreignOther.filter(isActive);

  const sumUsd = (list: HookPositionValuation[]): number | undefined => {
    if (list.length === 0) return 0;
    if (!list.every((p) => p.totalValueUsd != null && Number.isFinite(p.totalValueUsd))) {
      return undefined;
    }
    return list.reduce((s, p) => s + (p.totalValueUsd as number), 0);
  };

  const hookOwnedValueUsd = sumUsd(activeHook);
  const foreignPosmValueUsd = sumUsd(activePosm);
  const foreignOtherValueUsd = sumUsd(activeOther);

  let foreignTotalValueUsd: number | undefined;
  if (foreignPosmValueUsd != null && foreignOtherValueUsd != null) {
    foreignTotalValueUsd = foreignPosmValueUsd + foreignOtherValueUsd;
  }

  let reconstructedPoolValueUsd: number | undefined;
  if (hookOwnedValueUsd != null && foreignTotalValueUsd != null) {
    reconstructedPoolValueUsd = hookOwnedValueUsd + foreignTotalValueUsd;
  }

  const hookDiscoveryComplete = params.index.hookDiscoveryComplete;
  const foreignDiscoveryComplete = params.index.foreignDiscoveryComplete;
  const hookValuationComplete = params.valuationSummary.hookValuationComplete;
  const foreignValuationComplete = params.valuationSummary.foreignValuationComplete;

  const hookOwnedAmountsComplete =
    hookDiscoveryComplete && hookValuationComplete;

  const poolReconstructionComplete =
    hookDiscoveryComplete &&
    foreignDiscoveryComplete &&
    hookValuationComplete &&
    foreignValuationComplete;

  let hookShareOfReconstructedPool: number | undefined;
  if (
    poolReconstructionComplete &&
    reconstructedPoolValueUsd != null &&
    reconstructedPoolValueUsd > 0 &&
    hookOwnedValueUsd != null
  ) {
    hookShareOfReconstructedPool =
      hookOwnedValueUsd / reconstructedPoolValueUsd;
  } else if (!foreignDiscoveryComplete) {
    incomplete.push("foreign_discovery_incomplete");
  }

  let terminalState: HookForeignLpTerminalState = "AGGREGATING";
  if (poolReconstructionComplete) {
    terminalState = "SUCCESS_COMPLETE";
  } else if (hookOwnedAmountsComplete || activeHook.length > 0) {
    terminalState = "SUCCESS_PARTIAL";
  } else if (!hookDiscoveryComplete && activeHook.length === 0) {
    terminalState = "SUCCESS_PARTIAL";
  } else {
    terminalState = "SUCCESS_PARTIAL";
  }

  return {
    poolId,
    hookOwned: {
      positionCount: hookOwned.length,
      activeCount: activeHook.length,
      valueUsd: hookOwnedValueUsd,
      amount0: params.valuationSummary.hookOwnedAmount0,
      amount1: params.valuationSummary.hookOwnedAmount1,
    },
    foreignPosm: {
      positionCount: foreignPosm.length,
      activeCount: activePosm.length,
      valueUsd: foreignPosmValueUsd,
    },
    foreignOther: {
      positionCount: foreignOther.length,
      activeCount: activeOther.length,
      valueUsd: foreignOtherValueUsd,
    },
    foreignTotalValueUsd,
    reconstructedPoolValueUsd,
    hookShareOfReconstructedPool,
    hookDiscoveryComplete,
    foreignDiscoveryComplete,
    hookValuationComplete,
    foreignValuationComplete,
    poolReconstructionComplete,
    hookOwnedAmountsComplete,
    incompleteReasons: [...new Set(incomplete)],
    terminalState,
  };
}

export function toPublicForeignLpSeparation(
  sep: HookForeignLpSeparation,
): HookForeignLpSeparationPublic {
  return {
    hookOwnedValueUsd: sep.hookOwned.valueUsd,
    foreignPosmValueUsd: sep.foreignPosm.valueUsd,
    foreignOtherValueUsd: sep.foreignOther.valueUsd,
    reconstructedPoolValueUsd: sep.reconstructedPoolValueUsd,
    hookShareOfReconstructedPool: sep.hookShareOfReconstructedPool,
    poolReconstructionComplete: sep.poolReconstructionComplete,
    incompleteReasons: sep.incompleteReasons,
  };
}

/** Identity key — same ticks/salt under different owner are distinct. */
export function positionOwnerKey(params: {
  poolId: string;
  owner: string;
  tickLower: number;
  tickUpper: number;
  salt: string;
}): string {
  return [
    params.poolId.toLowerCase(),
    getAddress(params.owner).toLowerCase(),
    params.tickLower,
    params.tickUpper,
    params.salt.toLowerCase(),
  ].join(":");
}
