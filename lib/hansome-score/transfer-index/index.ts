/**
 * Shared transfer-index schema + helpers (Cold Perf V2 Phase 2).
 * Deep paging checkpoint/resume/reuse: see `paging.ts` + `validate.ts`.
 */

export {
  TRANSFER_INDEX_CHUNK_MAX_BYTES,
  TRANSFER_INDEX_CHUNK_MAX_ROWS,
  TRANSFER_INDEX_CREATOR_DIGEST_MAX_BYTES,
  TRANSFER_INDEX_CREATOR_EVIDENCE_MAX,
  TRANSFER_INDEX_KV_TTL_SEC,
  TRANSFER_INDEX_LOCK_TTL_SEC,
  TRANSFER_INDEX_MAX_RECENT_CHUNKS,
  TRANSFER_INDEX_META_MAX_BYTES,
  TRANSFER_INDEX_RAW_ROWS_HARD_CAP,
  TRANSFER_INDEX_RECENT_TIER_MAX_AGE_MS,
  TRANSFER_INDEX_RECENT_TIER_MAX_PAGES,
  estimateJsonBytes,
  normalizeTokenAddress,
  transferIndexChunkKey,
  transferIndexCreatorDigestKey,
  transferIndexLockKey,
  transferIndexMetaKey,
} from "@/lib/hansome-score/transfer-index/keys";

export type {
  PersistTransferIndexChunkResult,
  PersistTransferIndexMetaResult,
  TransferIndexChunk,
  TransferIndexChunkRow,
  TransferIndexCreatorDigest,
  TransferIndexCreatorEvidence,
  TransferIndexMeta,
  TransferIndexNextPageParams,
  TransferIndexState,
} from "@/lib/hansome-score/transfer-index/types";

export {
  emptyTransferIndexMeta,
  sanitizeTransferIndexChunk,
  sanitizeTransferIndexCreatorDigest,
  sanitizeTransferIndexMeta,
  shouldAcceptTransferIndexWrite,
} from "@/lib/hansome-score/transfer-index/sanitize";

export {
  acquireTransferIndexLock,
  clearTransferIndexLockTestKv,
  isTransferIndexLockHeldForTests,
  releaseTransferIndexLock,
  useTransferIndexLockTestKv,
  type AcquireTransferIndexLockResult,
} from "@/lib/hansome-score/transfer-index/lock";

export {
  assertBoundedRawWindow,
  beginTransferIndexGeneration,
  clearTransferIndexMemoryForTests,
  clearTransferIndexTestKv,
  estimateTransferIndexFoxFootprintBytes,
  isTransferIndexKvConfigured,
  loadTransferIndexChunk,
  loadTransferIndexCreatorDigest,
  loadTransferIndexMeta,
  loadTransferIndexMetaForToken,
  persistTransferIndexChunk,
  persistTransferIndexCreatorDigest,
  persistTransferIndexMeta,
  trimTransferIndexChunks,
  useTransferIndexTestKv,
  type PersistTransferIndexMetaInput,
} from "@/lib/hansome-score/transfer-index/kv";

export {
  TRANSFER_INDEX_HEAD_FRESH_MS,
  TRANSFER_INDEX_HEAD_REFRESH_MAX_PAGES,
  TRANSFER_INDEX_INCOMPLETE_STALE_MS,
  canReuseTransferIndexWithoutFetch,
  evaluateTransferIndexStatus,
  peekTransferIndexValidation,
  type EvaluateTransferIndexOptions,
  type TransferIndexReuseStatus,
  type TransferIndexValidation,
} from "@/lib/hansome-score/transfer-index/validate";

export {
  fetchTokenTransfersWithCheckpoint,
  loadEarlyTransfersFromIndex,
  loadTransferIndexProgress,
  scheduleTransferIndexBackgroundRefresh,
  type FetchTokenTransfersWithCheckpointResult,
  type TransferIndexFetchMode,
  type TransferIndexFetchStats,
  type TransferIndexPipelinePhase,
} from "@/lib/hansome-score/transfer-index/paging";
