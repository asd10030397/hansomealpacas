/**
 * Shared transfer-index schema (Phase 2).
 *
 * One durable contract for Cold V2 recent-first AND Perf V2 incremental resume.
 * Derived-first: cursors + digests in Redis; optional bounded recent chunks.
 * NEVER store full FOX-scale (~113k) raw transfer history in KV.
 */

/** Opaque Blockscout `next_page_params` (string/number values only after sanitize). */
export type TransferIndexNextPageParams = Record<string, string | number> | null;

export type TransferIndexState =
  | "idle"
  | "indexing"
  | "complete"
  | "failed";

/**
 * Durable index cursor / completeness metadata.
 * Key: `scan:xfer:{chainId}:{token}`
 */
export type TransferIndexMeta = {
  version: 1;
  chainId: number;
  address: string;
  /** Newest indexed transfer wall time (ms). */
  headTimestampMs: number | null;
  headBlock: number | null;
  /** Oldest indexed transfer wall time (ms) — genesis progress. */
  tailTimestampMs: number | null;
  tailBlock: number | null;
  /** Blockscout resume cursor (opaque). Null when starting or genesis exhausted. */
  nextPageParams: TransferIndexNextPageParams;
  /** True only when genesis pagination exhausted. */
  paginationComplete: boolean;
  /** Lifetime pages successfully merged into this index. */
  pagesFetchedTotal: number;
  /** Lifetime transfer rows counted into derived/index progress. */
  transfersIndexed: number;
  /** How many optional recent raw chunks are currently stored (0 = derived-only). */
  recentChunkCount: number;
  indexState: TransferIndexState;
  /**
   * Monotonic writer generation. Stale writers (lower generation) must not
   * overwrite newer meta. Aligns with Deep attempt fencing philosophy.
   */
  generation: number;
  updatedAt: number;
  /** Optional last error for failed index ticks (honest; not scored). */
  lastError: string | null;
};

/**
 * Bounded recent raw window chunk (optional).
 * Key: `scan:xfer:chunk:{chainId}:{token}:{i}` where i is 0-based newest-first.
 */
export type TransferIndexChunkRow = {
  from: string;
  to: string;
  valueRaw: string;
  blockNumber: number | null;
  /** Unix ms when parseable; else null. */
  timestampMs: number | null;
  txHash: string | null;
  toIsContract: boolean | null;
  method: string | null;
};

export type TransferIndexChunk = {
  version: 1;
  chainId: number;
  address: string;
  /** Chunk index (0 = newest page window). */
  chunkIndex: number;
  generation: number;
  transfers: TransferIndexChunkRow[];
  updatedAt: number;
};

/**
 * Bounded creator-derived digest (not full history).
 * Key: `scan:xfer:derived:creator:{chainId}:{token}`
 * Burn product remains `scan:burn:*` (not forked here).
 */
export type TransferIndexCreatorEvidence = {
  kind: "sell" | "transfer" | "transfer_then_sell";
  txHash: string | null;
  to: string | null;
  valueRaw: string;
  timestampMs: number | null;
};

export type TransferIndexCreatorDigest = {
  version: 1;
  chainId: number;
  address: string;
  generation: number;
  deployer: string | null;
  dumpDetected: boolean;
  transferThenSellDetected: boolean;
  creatorSellPctOfSupply: number;
  outboundTransferCount: number;
  sellTransferCount: number;
  transferThenSellRecipientCount: number;
  /** Capped evidence list (analyzer already caps ~40). */
  evidence: TransferIndexCreatorEvidence[];
  /** Pages observed when digest was last computed. */
  pagesFetched: number;
  /** Digest must not claim full-index availability; mirrors creator honesty. */
  indexComplete: boolean;
  updatedAt: number;
};

export type PersistTransferIndexMetaResult =
  | { ok: true; meta: TransferIndexMeta }
  | { ok: false; reason: "stale_generation" | "oversized" | "invalid" | "lock_required" };

export type PersistTransferIndexChunkResult =
  | { ok: true; chunk: TransferIndexChunk }
  | { ok: false; reason: "stale_generation" | "oversized" | "invalid" | "chunk_cap" };
