import {
  TRANSFER_INDEX_CHUNK_MAX_BYTES,
  TRANSFER_INDEX_CHUNK_MAX_ROWS,
  TRANSFER_INDEX_CREATOR_DIGEST_MAX_BYTES,
  TRANSFER_INDEX_CREATOR_EVIDENCE_MAX,
  TRANSFER_INDEX_MAX_RECENT_CHUNKS,
  TRANSFER_INDEX_META_MAX_BYTES,
  estimateJsonBytes,
  normalizeTokenAddress,
} from "@/lib/hansome-score/transfer-index/keys";
import type {
  TransferIndexChunk,
  TransferIndexChunkRow,
  TransferIndexCreatorDigest,
  TransferIndexCreatorEvidence,
  TransferIndexMeta,
  TransferIndexNextPageParams,
  TransferIndexState,
} from "@/lib/hansome-score/transfer-index/types";

const INDEX_STATES = new Set<TransferIndexState>([
  "idle",
  "indexing",
  "complete",
  "failed",
]);

function finiteNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function finiteIntOrNull(v: unknown): number | null {
  const n = finiteNumber(v);
  if (n == null) return null;
  return Math.trunc(n);
}

function nonNegInt(v: unknown, fallback = 0): number {
  const n = finiteNumber(v);
  if (n == null || n < 0) return fallback;
  return Math.trunc(n);
}

function sanitizeNextPageParams(raw: unknown): TransferIndexNextPageParams {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") {
      // Bound opaque cursor string length to avoid KV blowup.
      out[k] = v.length > 256 ? v.slice(0, 256) : v;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function sanitizeIndexState(raw: unknown): TransferIndexState {
  if (typeof raw === "string" && INDEX_STATES.has(raw as TransferIndexState)) {
    return raw as TransferIndexState;
  }
  return "idle";
}

/**
 * Parse + normalize TransferIndexMeta. Returns null on corrupt / wrong version.
 */
export function sanitizeTransferIndexMeta(
  raw: unknown,
  fallbackChainId: number,
  fallbackAddress: string,
): TransferIndexMeta | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  // Unknown future / past major — refuse rather than half-parse.
  if (o.version !== undefined && o.version !== 1) return null;

  const chainId =
    typeof o.chainId === "number" && Number.isFinite(o.chainId)
      ? Math.trunc(o.chainId)
      : fallbackChainId;
  if (chainId !== fallbackChainId) {
    // Chain separation: refuse cross-chain hydrate into this key space.
    return null;
  }

  const address = normalizeTokenAddress(
    typeof o.address === "string" ? o.address : fallbackAddress,
  );
  const expected = normalizeTokenAddress(fallbackAddress);
  if (address !== expected) {
    return null;
  }

  if (estimateJsonBytes(raw) > TRANSFER_INDEX_META_MAX_BYTES) {
    return null;
  }

  const pagesFetchedTotal = nonNegInt(o.pagesFetchedTotal);
  const transfersIndexed = nonNegInt(o.transfersIndexed);
  let recentChunkCount = nonNegInt(o.recentChunkCount);
  if (recentChunkCount > TRANSFER_INDEX_MAX_RECENT_CHUNKS) {
    recentChunkCount = TRANSFER_INDEX_MAX_RECENT_CHUNKS;
  }

  const generation = nonNegInt(o.generation, 0);
  const updatedAt = finiteNumber(o.updatedAt) ?? Date.now();

  const paginationComplete = o.paginationComplete === true;
  let indexState = sanitizeIndexState(o.indexState);
  if (paginationComplete && indexState === "indexing") {
    indexState = "complete";
  }

  return {
    version: 1,
    chainId,
    address,
    headTimestampMs: finiteIntOrNull(o.headTimestampMs),
    headBlock: finiteIntOrNull(o.headBlock),
    tailTimestampMs: finiteIntOrNull(o.tailTimestampMs),
    tailBlock: finiteIntOrNull(o.tailBlock),
    nextPageParams: sanitizeNextPageParams(o.nextPageParams),
    paginationComplete,
    pagesFetchedTotal,
    transfersIndexed,
    recentChunkCount,
    indexState,
    generation,
    updatedAt,
    lastError:
      typeof o.lastError === "string"
        ? o.lastError.slice(0, 500)
        : o.lastError === null
          ? null
          : null,
  };
}

function sanitizeChunkRow(raw: unknown): TransferIndexChunkRow | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.from !== "string" || typeof o.to !== "string") return null;
  if (typeof o.valueRaw !== "string") return null;
  return {
    from: normalizeTokenAddress(o.from),
    to: normalizeTokenAddress(o.to),
    valueRaw: o.valueRaw.length > 78 ? o.valueRaw.slice(0, 78) : o.valueRaw,
    blockNumber: finiteIntOrNull(o.blockNumber),
    timestampMs: finiteIntOrNull(o.timestampMs),
    txHash: typeof o.txHash === "string" ? o.txHash.slice(0, 80) : null,
    toIsContract:
      o.toIsContract === true ? true : o.toIsContract === false ? false : null,
    method: typeof o.method === "string" ? o.method.slice(0, 64) : null,
  };
}

export function sanitizeTransferIndexChunk(
  raw: unknown,
  fallbackChainId: number,
  fallbackAddress: string,
): TransferIndexChunk | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (estimateJsonBytes(raw) > TRANSFER_INDEX_CHUNK_MAX_BYTES) return null;

  const o = raw as Record<string, unknown>;
  if (o.version !== undefined && o.version !== 1) return null;

  const chainId =
    typeof o.chainId === "number" && Number.isFinite(o.chainId)
      ? Math.trunc(o.chainId)
      : fallbackChainId;
  if (chainId !== fallbackChainId) return null;

  const address = normalizeTokenAddress(
    typeof o.address === "string" ? o.address : fallbackAddress,
  );
  if (address !== normalizeTokenAddress(fallbackAddress)) return null;

  const chunkIndex = nonNegInt(o.chunkIndex);
  if (chunkIndex >= TRANSFER_INDEX_MAX_RECENT_CHUNKS) return null;

  if (!Array.isArray(o.transfers)) return null;
  if (o.transfers.length > TRANSFER_INDEX_CHUNK_MAX_ROWS) return null;

  const transfers: TransferIndexChunkRow[] = [];
  for (const row of o.transfers) {
    const s = sanitizeChunkRow(row);
    if (s) transfers.push(s);
  }

  return {
    version: 1,
    chainId,
    address,
    chunkIndex,
    generation: nonNegInt(o.generation, 0),
    transfers,
    updatedAt: finiteNumber(o.updatedAt) ?? Date.now(),
  };
}

function sanitizeCreatorEvidence(
  raw: unknown,
): TransferIndexCreatorEvidence | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  if (kind !== "sell" && kind !== "transfer" && kind !== "transfer_then_sell") {
    return null;
  }
  if (typeof o.valueRaw !== "string") return null;
  return {
    kind,
    txHash: typeof o.txHash === "string" ? o.txHash.slice(0, 80) : null,
    to: typeof o.to === "string" ? normalizeTokenAddress(o.to) : null,
    valueRaw: o.valueRaw.length > 78 ? o.valueRaw.slice(0, 78) : o.valueRaw,
    timestampMs: finiteIntOrNull(o.timestampMs),
  };
}

export function sanitizeTransferIndexCreatorDigest(
  raw: unknown,
  fallbackChainId: number,
  fallbackAddress: string,
): TransferIndexCreatorDigest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (estimateJsonBytes(raw) > TRANSFER_INDEX_CREATOR_DIGEST_MAX_BYTES) {
    return null;
  }

  const o = raw as Record<string, unknown>;
  if (o.version !== undefined && o.version !== 1) return null;

  const chainId =
    typeof o.chainId === "number" && Number.isFinite(o.chainId)
      ? Math.trunc(o.chainId)
      : fallbackChainId;
  if (chainId !== fallbackChainId) return null;

  const address = normalizeTokenAddress(
    typeof o.address === "string" ? o.address : fallbackAddress,
  );
  if (address !== normalizeTokenAddress(fallbackAddress)) return null;

  const evidenceRaw = Array.isArray(o.evidence) ? o.evidence : [];
  const evidence: TransferIndexCreatorEvidence[] = [];
  for (const row of evidenceRaw.slice(0, TRANSFER_INDEX_CREATOR_EVIDENCE_MAX)) {
    const s = sanitizeCreatorEvidence(row);
    if (s) evidence.push(s);
  }

  return {
    version: 1,
    chainId,
    address,
    generation: nonNegInt(o.generation, 0),
    deployer:
      typeof o.deployer === "string"
        ? normalizeTokenAddress(o.deployer)
        : null,
    dumpDetected: o.dumpDetected === true,
    transferThenSellDetected: o.transferThenSellDetected === true,
    creatorSellPctOfSupply: (() => {
      const n = finiteNumber(o.creatorSellPctOfSupply);
      return n == null || n < 0 ? 0 : n;
    })(),
    outboundTransferCount: nonNegInt(o.outboundTransferCount),
    sellTransferCount: nonNegInt(o.sellTransferCount),
    transferThenSellRecipientCount: nonNegInt(
      o.transferThenSellRecipientCount,
    ),
    evidence,
    pagesFetched: nonNegInt(o.pagesFetched),
    indexComplete: o.indexComplete === true,
    updatedAt: finiteNumber(o.updatedAt) ?? Date.now(),
  };
}

/**
 * Generation fence: accept only if candidate.generation >= stored.generation
 * (equal allowed for same-writer continuation; lower = stale).
 */
export function shouldAcceptTransferIndexWrite(
  stored: { generation: number } | null,
  candidateGeneration: number,
): boolean {
  if (!Number.isFinite(candidateGeneration) || candidateGeneration < 0) {
    return false;
  }
  if (!stored) return true;
  return candidateGeneration >= stored.generation;
}

export function emptyTransferIndexMeta(
  chainId: number,
  tokenAddress: string,
  generation = 1,
): TransferIndexMeta {
  return {
    version: 1,
    chainId,
    address: normalizeTokenAddress(tokenAddress),
    headTimestampMs: null,
    headBlock: null,
    tailTimestampMs: null,
    tailBlock: null,
    nextPageParams: null,
    paginationComplete: false,
    pagesFetchedTotal: 0,
    transfersIndexed: 0,
    recentChunkCount: 0,
    indexState: "idle",
    generation,
    updatedAt: Date.now(),
    lastError: null,
  };
}
