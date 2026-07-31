import { DEFAULT_CONFIRMATION_DEPTH } from "@/lib/hansome-score/lp/hook-position-index/abis";
import { bumpGeneration } from "@/lib/hansome-score/lp/hook-position-index/state-machine";
import {
  removePositionsFirstSeenAtOrAfter,
} from "@/lib/hansome-score/lp/hook-position-index/store";
import {
  incrementalSyncHookPositionIndex,
  type HookPosChainPort,
  type HookSyncOptions,
} from "@/lib/hansome-score/lp/hook-position-index/sync";
import type { HookPositionIndexState } from "@/lib/hansome-score/lp/hook-position-index/types";

export async function detectHookCheckpointHashMismatch(params: {
  port: HookPosChainPort;
  state: HookPositionIndexState;
}): Promise<boolean> {
  const { port, state } = params;
  if (state.lastSyncedBlock == null || !state.lastSyncedBlockHash) {
    return false;
  }
  const hash = await port.getBlockHash(state.lastSyncedBlock);
  if (!hash) return false;
  return hash.toLowerCase() !== state.lastSyncedBlockHash.toLowerCase();
}

/**
 * Roll back N blocks of log-derived updates and replay forward.
 * Does not silently retain stale first-seen-in-window positions.
 */
export async function reorgRescanHookPositionIndex(params: {
  port: HookPosChainPort;
  opts: HookSyncOptions;
  existing: HookPositionIndexState;
  overlapBlocks?: number;
}): Promise<{
  state: HookPositionIndexState;
  hashMismatch: boolean;
  rolledBackFrom: number | null;
}> {
  const overlap =
    params.overlapBlocks ??
    params.opts.confirmationDepth ??
    DEFAULT_CONFIRMATION_DEPTH;
  const mismatch = await detectHookCheckpointHashMismatch({
    port: params.port,
    state: params.existing,
  });

  let state = structuredClone(params.existing);
  const last = state.lastSyncedBlock;
  const rollbackTo =
    last != null
      ? Math.max(state.createBlock ?? 0, last - overlap)
      : state.createBlock ?? null;

  if (rollbackTo != null) {
    state = removePositionsFirstSeenAtOrAfter(state, rollbackTo + 1);
    state.lastSyncedBlock = rollbackTo;
    state.lastSyncedBlockHash = null;
  }

  state.hookDiscoveryComplete = false;
  state.foreignDiscoveryComplete = false;
  state.generation = bumpGeneration(state.generation);
  if (mismatch) {
    state.incompleteReasons = [
      ...state.incompleteReasons.filter((r) => r !== "reorg_detected"),
      "reorg_detected",
    ];
  }

  state = await incrementalSyncHookPositionIndex({
    port: params.port,
    opts: params.opts,
    existing: state,
  });

  return {
    state,
    hashMismatch: mismatch,
    rolledBackFrom: rollbackTo,
  };
}

/** Pure helper for unit tests. */
export function simulateReorgRollback(params: {
  state: HookPositionIndexState;
  rollbackFromBlock: number;
}): HookPositionIndexState {
  const next = removePositionsFirstSeenAtOrAfter(
    params.state,
    params.rollbackFromBlock,
  );
  next.lastSyncedBlock = Math.max(
    params.rollbackFromBlock - 1,
    next.createBlock ?? 0,
  );
  next.lastSyncedBlockHash = null;
  next.hookDiscoveryComplete = false;
  next.generation = bumpGeneration(next.generation);
  next.incompleteReasons = [
    ...next.incompleteReasons.filter((r) => r !== "reorg_detected"),
    "reorg_detected",
  ];
  return next;
}
