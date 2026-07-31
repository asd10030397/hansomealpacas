import type {
  HookPositionIndexState,
  HookPositionIndexSummary,
} from "@/lib/hansome-score/lp/hook-position-index/types";

/** Build public Scan summary — omit full position keys. */
export function buildHookPositionIndexSummary(
  state: HookPositionIndexState,
): HookPositionIndexSummary {
  const hookOwned = state.positions.filter(
    (p) => p.classification === "hook_owned",
  );
  const foreignPosm = state.positions.filter(
    (p) => p.classification === "foreign_posm",
  );
  const foreignOther = state.positions.filter(
    (p) => p.classification === "foreign_other",
  );
  const activeHookOwned = hookOwned.filter(
    (p) => p.active === true || (p.liveLiquidity != null && BigInt(p.liveLiquidity) > 0n),
  );

  return {
    poolId: state.poolId,
    hookAddress: state.hookAddress,
    indexedPositionCount: state.positions.length,
    hookOwnedCount: hookOwned.length,
    foreignPosmCount: foreignPosm.length,
    foreignOtherCount: foreignOther.length,
    activeHookOwnedCount: activeHookOwned.length,
    hookDiscoveryComplete: state.hookDiscoveryComplete,
    foreignDiscoveryComplete: state.foreignDiscoveryComplete,
    discoveryMethod: state.discoveryMethod,
    lastSyncedBlock: state.lastSyncedBlock ?? undefined,
    safeHeadBlock: state.safeHeadBlock ?? undefined,
    incompleteReasons:
      state.incompleteReasons.length > 0
        ? [...state.incompleteReasons]
        : undefined,
    terminalState: state.terminalState,
  };
}
