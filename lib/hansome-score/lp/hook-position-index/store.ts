import { getAddress } from "viem";
import { DEFAULT_CONFIRMATION_DEPTH } from "@/lib/hansome-score/lp/hook-position-index/abis";
import {
  assertHookPosNamespace,
  buildHookPosIndexKey,
} from "@/lib/hansome-score/lp/hook-position-index/key";
import { positionKeyId } from "@/lib/hansome-score/lp/hook-position-index/decode";
import {
  HOOK_POS_INDEX_SCHEMA_VERSION,
  HOOK_POS_INDEX_SEMANTIC_VERSION,
  type HookPositionIndexState,
  type HookPositionRecord,
} from "@/lib/hansome-score/lp/hook-position-index/types";

export class HookPosStoreError extends Error {
  constructor(
    message: string,
    readonly code:
      | "SCHEMA_MISMATCH"
      | "CORRUPTED"
      | "GENERATION_FENCE"
      | "NAMESPACE",
  ) {
    super(message);
    this.name = "HookPosStoreError";
  }
}

const memory = new Map<string, HookPositionIndexState>();

export function clearHookPosStoreMemoryForTests(): void {
  memory.clear();
}

export function emptyHookPositionIndexState(params: {
  chainId: number;
  poolId: string;
  hookAddress?: string;
  positionManager?: string;
  poolManager?: string;
  createTx?: string | null;
  createBlock?: number | null;
  confirmationDepth?: number;
}): HookPositionIndexState {
  return {
    schemaVersion: HOOK_POS_INDEX_SCHEMA_VERSION,
    semanticVersion: HOOK_POS_INDEX_SEMANTIC_VERSION,
    chainId: params.chainId,
    poolId: params.poolId.toLowerCase(),
    hookAddress: params.hookAddress
      ? getAddress(params.hookAddress).toLowerCase()
      : undefined,
    positionManager: params.positionManager
      ? getAddress(params.positionManager).toLowerCase()
      : undefined,
    poolManager: params.poolManager
      ? getAddress(params.poolManager).toLowerCase()
      : undefined,
    createTx: params.createTx ?? null,
    createBlock: params.createBlock ?? null,
    lastSyncedBlock: null,
    lastSyncedBlockHash: null,
    safeHeadBlock: null,
    confirmationDepth: params.confirmationDepth ?? DEFAULT_CONFIRMATION_DEPTH,
    positions: [],
    hookDiscoveryComplete: false,
    foreignDiscoveryComplete: false,
    discoveryMethod: "unknown",
    incompleteReasons: [],
    generation: "0",
    terminalState: "NEW",
    failedReason: null,
    lastSuccessfulBlock: null,
    updatedAt: new Date().toISOString(),
  };
}

export function validateHookPositionIndexState(
  raw: unknown,
): HookPositionIndexState {
  if (raw == null || typeof raw !== "object") {
    throw new HookPosStoreError("record is not an object", "CORRUPTED");
  }
  const r = raw as Record<string, unknown>;
  if (r.schemaVersion !== HOOK_POS_INDEX_SCHEMA_VERSION) {
    throw new HookPosStoreError(
      `schemaVersion mismatch: ${String(r.schemaVersion)}`,
      "SCHEMA_MISMATCH",
    );
  }
  if (typeof r.semanticVersion !== "string") {
    throw new HookPosStoreError("semanticVersion missing", "CORRUPTED");
  }
  if (typeof r.chainId !== "number" || typeof r.poolId !== "string") {
    throw new HookPosStoreError("chainId/poolId invalid", "CORRUPTED");
  }
  if (typeof r.generation !== "string") {
    throw new HookPosStoreError("generation must be string", "CORRUPTED");
  }
  if (!Array.isArray(r.positions)) {
    throw new HookPosStoreError("positions must be array", "CORRUPTED");
  }
  if (typeof r.hookDiscoveryComplete !== "boolean") {
    throw new HookPosStoreError("hookDiscoveryComplete missing", "CORRUPTED");
  }
  if (typeof r.foreignDiscoveryComplete !== "boolean") {
    throw new HookPosStoreError("foreignDiscoveryComplete missing", "CORRUPTED");
  }
  // Never allow complete flags without positions when marked complete via receipt.
  if (r.hookDiscoveryComplete === true && r.positions.length === 0) {
    throw new HookPosStoreError(
      "hookDiscoveryComplete true with empty positions",
      "CORRUPTED",
    );
  }
  return raw as HookPositionIndexState;
}

export function loadHookPosIndexMemory(
  key: string,
): HookPositionIndexState | null {
  assertHookPosNamespace(key);
  const v = memory.get(key);
  return v ? structuredClone(v) : null;
}

export function saveHookPosIndexMemory(
  key: string,
  record: HookPositionIndexState,
  opts?: { expectedGeneration?: string },
): void {
  assertHookPosNamespace(key);
  validateHookPositionIndexState(record);
  const existing = memory.get(key);
  if (
    opts?.expectedGeneration != null &&
    existing &&
    existing.generation !== opts.expectedGeneration
  ) {
    throw new HookPosStoreError(
      `generation fence: expected ${opts.expectedGeneration}, have ${existing.generation}`,
      "GENERATION_FENCE",
    );
  }
  memory.set(key, structuredClone(record));
}

export function upsertHookPosition(
  state: HookPositionIndexState,
  position: HookPositionRecord,
): HookPositionIndexState {
  const next = structuredClone(state);
  const id = positionKeyId(position);
  const idx = next.positions.findIndex((p) => positionKeyId(p) === id);
  if (idx >= 0) next.positions[idx] = position;
  else next.positions.push(position);
  next.positions.sort((a, b) => {
    if (a.classification !== b.classification) {
      return a.classification.localeCompare(b.classification);
    }
    if (a.tickLower !== b.tickLower) return a.tickLower - b.tickLower;
    if (a.tickUpper !== b.tickUpper) return a.tickUpper - b.tickUpper;
    return a.salt.localeCompare(b.salt);
  });
  next.updatedAt = new Date().toISOString();
  return next;
}

export function removePositionsFirstSeenAtOrAfter(
  state: HookPositionIndexState,
  block: number,
): HookPositionIndexState {
  const next = structuredClone(state);
  next.positions = next.positions.filter((p) => p.firstSeenBlock < block);
  // Also roll back lastSeen for survivors that were only updated in the window
  for (const p of next.positions) {
    if (p.lastSeenBlock >= block) {
      p.lastSeenBlock = Math.max(p.firstSeenBlock, block - 1);
    }
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

export function indexKeyForState(state: HookPositionIndexState): string {
  return buildHookPosIndexKey({
    chainId: state.chainId,
    poolId: state.poolId,
  });
}
