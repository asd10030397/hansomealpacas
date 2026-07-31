/**
 * Phase 10C-1 — Pool-scoped V3 Position Index public API.
 *
 * Production discovery wiring lives in production.ts / adapters/v3.ts.
 * Sync/classify algorithms remain shared with Phase 10B validation suite.
 */

export {
  V3_POS_INDEX_SCHEMA_VERSION,
  V3_POS_INDEX_SEMANTIC_VERSION,
  V3_POS_INDEX_KEY_PREFIX,
  type V3PosIndexRecord,
  type V3PosTokenIdRecord,
  type V3PosPoolKey,
  type V3PosSyncMetrics,
  type ResolveReceiptInput,
  type ResolveReceiptResult,
  type DecodedPoolMint,
  type DecodedNpmTransfer,
  type DecodedIncreaseLiquidity,
} from "@/lib/hansome-score/lp/v3-position-index/types";

export {
  V3_POS_NPM_ABI,
  V3_POS_POOL_ABI,
  V3_POS_FACTORY_ABI,
  V3_POS_EVENT_FRAGMENTS,
  ZERO_ADDRESS,
  PONS_LAUNCH_LOCKER_AUDIT,
} from "@/lib/hansome-score/lp/v3-position-index/abis";

export {
  buildV3PosIndexKey,
  assertNotTransferIndexNamespace,
} from "@/lib/hansome-score/lp/v3-position-index/key";

export {
  resolveTokenIdsFromMintReceipt,
  lastTransferTip,
  isBurnTransfer,
  isMintTransfer,
} from "@/lib/hansome-score/lp/v3-position-index/receipt-resolve";

export {
  classifyLiquidityState,
  classifyInRange,
  classifyTokenStatus,
  classifyOwnerValidation,
  classifyOwnerTypeAudit,
} from "@/lib/hansome-score/lp/v3-position-index/classify";

export {
  V3PosStoreError,
  clearV3PosStoreMemoryForTests,
  emptyV3PosIndexRecord,
  validateV3PosIndexRecord,
  loadV3PosIndexMemory,
  saveV3PosIndexMemory,
  upsertTokenId,
  removeTokenIdsNotIn,
  indexKeyForRecord,
} from "@/lib/hansome-score/lp/v3-position-index/store";

export {
  loadV3PosIndexJson,
  saveV3PosIndexJson,
} from "@/lib/hansome-score/lp/v3-position-index/store-json";

export {
  backfillV3PosIndex,
  incrementalSyncV3PosIndex,
  tokenIdSet,
  type V3PosChainPort,
  type SyncOptions,
} from "@/lib/hansome-score/lp/v3-position-index/sync";

export {
  reconcileMintSets,
  detectCheckpointHashMismatch,
  reorgRescanV3PosIndex,
  simulateReorgIndex,
} from "@/lib/hansome-score/lp/v3-position-index/reorg";

export {
  useV3PosIndexTestKv,
  clearV3PosProductionMemoryForTests,
  loadV3PosIndexProduction,
  saveV3PosIndexProduction,
  v3PosIndexKey,
  assertPoolKeyMatchesRecord,
} from "@/lib/hansome-score/lp/v3-position-index/production-kv";

export {
  createV3PosChainPort,
  readPoolCanonicalKey,
  readPoolSlot0,
} from "@/lib/hansome-score/lp/v3-position-index/chain-port";

export {
  indexedTokenToPositionInfo,
  attachIndexedV3Positions,
  mergeRealV3PositionsOverStubs,
} from "@/lib/hansome-score/lp/v3-position-index/attach";

export {
  V3_POS_PROGRESS_ACTIONS,
  resolveMaterialV3PoolPositions,
  resolveV3PositionsFromIndex,
  scheduleV3PosIndexBackgroundBackfill,
  clearV3PosBackgroundInflightForTests,
  type V3PosProgressAction,
  type V3PoolPositionResolveResult,
} from "@/lib/hansome-score/lp/v3-position-index/production";

/** Completeness gate (shared with sync). */
export function evaluateDiscoveryComplete(record: {
  poolCreationBlock: number | null;
  exhaustiveFromBlock: number | null;
  exhaustiveToBlock: number | null;
  lastSyncedBlockHash: string | null;
  completenessErrors: string[];
  paginationGaps?: boolean;
}): boolean {
  if (record.paginationGaps) return false;
  if (record.completenessErrors.length > 0) return false;
  if (record.poolCreationBlock == null) return false;
  if (record.exhaustiveFromBlock == null) return false;
  if (record.exhaustiveToBlock == null) return false;
  if (!record.lastSyncedBlockHash) return false;
  if (record.exhaustiveFromBlock > record.poolCreationBlock) return false;
  return true;
}
