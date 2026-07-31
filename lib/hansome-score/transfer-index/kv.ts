/**
 * Transfer-index KV load / persist helpers.
 *
 * Schema + helpers only — Deep path wiring is Phase 4 / 7.
 * One coordinated writer model: NX lock + generation fence.
 */

import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import {
  TRANSFER_INDEX_CHUNK_MAX_BYTES,
  TRANSFER_INDEX_CHUNK_MAX_ROWS,
  TRANSFER_INDEX_CREATOR_DIGEST_MAX_BYTES,
  TRANSFER_INDEX_CREATOR_EVIDENCE_MAX,
  TRANSFER_INDEX_KV_TTL_SEC,
  TRANSFER_INDEX_MAX_RECENT_CHUNKS,
  TRANSFER_INDEX_META_MAX_BYTES,
  TRANSFER_INDEX_RAW_ROWS_HARD_CAP,
  estimateJsonBytes,
  normalizeTokenAddress,
  transferIndexChunkKey,
  transferIndexCreatorDigestKey,
  transferIndexMetaKey,
} from "@/lib/hansome-score/transfer-index/keys";
import {
  emptyTransferIndexMeta,
  sanitizeTransferIndexChunk,
  sanitizeTransferIndexCreatorDigest,
  sanitizeTransferIndexMeta,
  shouldAcceptTransferIndexWrite,
} from "@/lib/hansome-score/transfer-index/sanitize";
import type {
  PersistTransferIndexChunkResult,
  PersistTransferIndexMetaResult,
  TransferIndexChunk,
  TransferIndexChunkRow,
  TransferIndexCreatorDigest,
  TransferIndexMeta,
  TransferIndexNextPageParams,
  TransferIndexState,
} from "@/lib/hansome-score/transfer-index/types";

type TestKvStore = Map<string, unknown>;

let testKv: TestKvStore | null = null;
const memMeta = new Map<string, TransferIndexMeta>();
const memChunks = new Map<string, TransferIndexChunk>();
const memCreator = new Map<string, TransferIndexCreatorDigest>();

function memKey(chainId: number, tokenAddress: string): string {
  return `${chainId}:${normalizeTokenAddress(tokenAddress)}`;
}

function isScanKvConfigured(): boolean {
  const url =
    process.env.KV_REST_API_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    "";
  const token =
    process.env.KV_REST_API_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    "";
  return Boolean(url && token);
}

async function getKv() {
  if (!isScanKvConfigured()) return null;
  const { kv } = await import("@vercel/kv");
  return kv;
}

async function kvGetRaw(key: string): Promise<unknown | null> {
  if (testKv) {
    return testKv.has(key) ? testKv.get(key)! : null;
  }
  const kv = await getKv();
  if (!kv) return null;
  try {
    return (await kv.get<unknown>(key)) ?? null;
  } catch (err) {
    console.warn("[transfer-index] KV get failed:", err);
    return null;
  }
}

async function kvSetRaw(
  key: string,
  value: unknown,
  ttlSec = TRANSFER_INDEX_KV_TTL_SEC,
): Promise<boolean> {
  if (testKv) {
    testKv.set(key, value);
    return true;
  }
  const kv = await getKv();
  if (!kv) return false;
  try {
    await kv.set(key, value, { ex: ttlSec });
    return true;
  } catch (err) {
    console.warn("[transfer-index] KV set failed:", err);
    return false;
  }
}

async function kvDelRaw(key: string): Promise<void> {
  if (testKv) {
    testKv.delete(key);
    return;
  }
  const kv = await getKv();
  if (!kv) return;
  try {
    await kv.del(key);
  } catch {
    /* ignore */
  }
}

/** Install Map-backed KV for unit tests. Pass null to disable. */
export function useTransferIndexTestKv(map: TestKvStore | null): void {
  testKv = map;
}

export function clearTransferIndexTestKv(): void {
  testKv = null;
}

export function clearTransferIndexMemoryForTests(): void {
  memMeta.clear();
  memChunks.clear();
  memCreator.clear();
}

export function isTransferIndexKvConfigured(): boolean {
  return testKv != null || isScanKvConfigured();
}

export async function loadTransferIndexMeta(
  chainId: number,
  tokenAddress: string,
): Promise<TransferIndexMeta | null> {
  const mk = memKey(chainId, tokenAddress);
  const memHit = memMeta.get(mk);
  if (memHit) return memHit;

  const raw = await kvGetRaw(transferIndexMetaKey(chainId, tokenAddress));
  const sanitized = sanitizeTransferIndexMeta(raw, chainId, tokenAddress);
  if (!sanitized) return null;

  // Soft age: drop absurdly old entries beyond 2× TTL.
  if (Date.now() - sanitized.updatedAt > TRANSFER_INDEX_KV_TTL_SEC * 1000 * 2) {
    return null;
  }

  memMeta.set(mk, sanitized);
  return sanitized;
}

export type PersistTransferIndexMetaInput = {
  /** Required for fencing — must be >= stored generation. */
  generation: number;
  headTimestampMs?: number | null;
  headBlock?: number | null;
  tailTimestampMs?: number | null;
  tailBlock?: number | null;
  nextPageParams?: TransferIndexNextPageParams;
  paginationComplete?: boolean;
  pagesFetchedTotal?: number;
  transfersIndexed?: number;
  recentChunkCount?: number;
  indexState?: TransferIndexState;
  lastError?: string | null;
  /**
   * When true, replace fields from a full meta object (still generation-fenced).
   * Prefer patch fields for incremental updates.
   */
  replace?: Partial<
    Omit<TransferIndexMeta, "version" | "chainId" | "address" | "generation">
  >;
};

/**
 * Persist meta with generation fencing + oversized rejection.
 * Does not acquire the NX lock (caller coordinates via lock helpers).
 */
export async function persistTransferIndexMeta(
  chainId: number,
  tokenAddress: string,
  input: PersistTransferIndexMetaInput,
): Promise<PersistTransferIndexMetaResult> {
  const addr = normalizeTokenAddress(tokenAddress);
  const prior =
    memMeta.get(memKey(chainId, addr)) ??
    (await loadTransferIndexMeta(chainId, addr));

  if (!shouldAcceptTransferIndexWrite(prior, input.generation)) {
    return { ok: false, reason: "stale_generation" };
  }

  const base = prior ?? emptyTransferIndexMeta(chainId, addr, input.generation);
  const r = input.replace ?? {};

  const next: TransferIndexMeta = {
    version: 1,
    chainId,
    address: addr,
    headTimestampMs:
      input.headTimestampMs !== undefined
        ? input.headTimestampMs
        : (r.headTimestampMs !== undefined
            ? r.headTimestampMs
            : base.headTimestampMs),
    headBlock:
      input.headBlock !== undefined
        ? input.headBlock
        : (r.headBlock !== undefined ? r.headBlock : base.headBlock),
    tailTimestampMs:
      input.tailTimestampMs !== undefined
        ? input.tailTimestampMs
        : (r.tailTimestampMs !== undefined
            ? r.tailTimestampMs
            : base.tailTimestampMs),
    tailBlock:
      input.tailBlock !== undefined
        ? input.tailBlock
        : (r.tailBlock !== undefined ? r.tailBlock : base.tailBlock),
    nextPageParams:
      input.nextPageParams !== undefined
        ? input.nextPageParams
        : (r.nextPageParams !== undefined
            ? r.nextPageParams
            : base.nextPageParams),
    paginationComplete:
      input.paginationComplete !== undefined
        ? input.paginationComplete === true
        : (r.paginationComplete !== undefined
            ? r.paginationComplete === true
            : base.paginationComplete),
    pagesFetchedTotal:
      input.pagesFetchedTotal !== undefined
        ? Math.max(0, Math.trunc(input.pagesFetchedTotal))
        : (r.pagesFetchedTotal !== undefined
            ? Math.max(0, Math.trunc(r.pagesFetchedTotal))
            : base.pagesFetchedTotal),
    transfersIndexed:
      input.transfersIndexed !== undefined
        ? Math.max(0, Math.trunc(input.transfersIndexed))
        : (r.transfersIndexed !== undefined
            ? Math.max(0, Math.trunc(r.transfersIndexed))
            : base.transfersIndexed),
    recentChunkCount: Math.min(
      TRANSFER_INDEX_MAX_RECENT_CHUNKS,
      input.recentChunkCount !== undefined
        ? Math.max(0, Math.trunc(input.recentChunkCount))
        : (r.recentChunkCount !== undefined
            ? Math.max(0, Math.trunc(r.recentChunkCount))
            : base.recentChunkCount),
    ),
    indexState:
      input.indexState ??
      r.indexState ??
      (input.paginationComplete === true || r.paginationComplete === true
        ? "complete"
        : base.indexState),
    generation: Math.trunc(input.generation),
    updatedAt: Date.now(),
    lastError:
      input.lastError !== undefined
        ? input.lastError
        : (r.lastError !== undefined ? r.lastError : base.lastError),
  };

  const sanitized = sanitizeTransferIndexMeta(next, chainId, addr);
  if (!sanitized) {
    return { ok: false, reason: "invalid" };
  }

  if (estimateJsonBytes(sanitized) > TRANSFER_INDEX_META_MAX_BYTES) {
    return { ok: false, reason: "oversized" };
  }

  memMeta.set(memKey(chainId, addr), sanitized);
  await kvSetRaw(transferIndexMetaKey(chainId, addr), sanitized);
  return { ok: true, meta: sanitized };
}

/**
 * Bump generation for a new exclusive writer (call after acquiring NX lock).
 * Returns the new generation to use for subsequent persists.
 */
export async function beginTransferIndexGeneration(
  chainId: number,
  tokenAddress: string,
): Promise<number> {
  const prior = await loadTransferIndexMeta(chainId, tokenAddress);
  const nextGen = (prior?.generation ?? 0) + 1;
  const result = await persistTransferIndexMeta(chainId, tokenAddress, {
    generation: nextGen,
    indexState: "indexing",
    lastError: null,
  });
  if (!result.ok) {
    // If somehow stale, still return a candidate gen above prior.
    return nextGen;
  }
  return result.meta.generation;
}

export async function loadTransferIndexChunk(
  chainId: number,
  tokenAddress: string,
  chunkIndex: number,
): Promise<TransferIndexChunk | null> {
  if (
    chunkIndex < 0 ||
    chunkIndex >= TRANSFER_INDEX_MAX_RECENT_CHUNKS ||
    !Number.isInteger(chunkIndex)
  ) {
    return null;
  }
  const key = transferIndexChunkKey(chainId, tokenAddress, chunkIndex);
  const memHit = memChunks.get(key);
  if (memHit) return memHit;

  const raw = await kvGetRaw(key);
  const sanitized = sanitizeTransferIndexChunk(raw, chainId, tokenAddress);
  if (!sanitized) return null;
  memChunks.set(key, sanitized);
  return sanitized;
}

export async function persistTransferIndexChunk(
  chainId: number,
  tokenAddress: string,
  chunkIndex: number,
  transfers: TransferIndexChunkRow[],
  generation: number,
): Promise<PersistTransferIndexChunkResult> {
  if (
    chunkIndex < 0 ||
    chunkIndex >= TRANSFER_INDEX_MAX_RECENT_CHUNKS ||
    !Number.isInteger(chunkIndex)
  ) {
    return { ok: false, reason: "chunk_cap" };
  }

  if (transfers.length > TRANSFER_INDEX_RAW_ROWS_HARD_CAP) {
    return { ok: false, reason: "oversized" };
  }

  const meta = await loadTransferIndexMeta(chainId, tokenAddress);
  if (!shouldAcceptTransferIndexWrite(meta, generation)) {
    return { ok: false, reason: "stale_generation" };
  }

  const addr = normalizeTokenAddress(tokenAddress);
  const chunk: TransferIndexChunk = {
    version: 1,
    chainId,
    address: addr,
    chunkIndex,
    generation: Math.trunc(generation),
    transfers: transfers.slice(0, TRANSFER_INDEX_RAW_ROWS_HARD_CAP),
    updatedAt: Date.now(),
  };

  const sanitized = sanitizeTransferIndexChunk(chunk, chainId, addr);
  if (!sanitized) {
    return { ok: false, reason: "invalid" };
  }
  if (sanitized.transfers.length > TRANSFER_INDEX_CHUNK_MAX_ROWS) {
    return { ok: false, reason: "oversized" };
  }
  if (estimateJsonBytes(sanitized) > TRANSFER_INDEX_CHUNK_MAX_BYTES) {
    return { ok: false, reason: "oversized" };
  }

  const key = transferIndexChunkKey(chainId, addr, chunkIndex);
  memChunks.set(key, sanitized);
  await kvSetRaw(key, sanitized);
  return { ok: true, chunk: sanitized };
}

/**
 * Reject attempts to materialize FOX-scale raw history as chunks.
 * Helpers never accept more than MAX_RECENT_CHUNKS × CHUNK_MAX_ROWS rows.
 */
export function assertBoundedRawWindow(totalRawRows: number): boolean {
  return (
    Number.isFinite(totalRawRows) &&
    totalRawRows >= 0 &&
    totalRawRows <= TRANSFER_INDEX_RAW_ROWS_HARD_CAP
  );
}

export async function loadTransferIndexCreatorDigest(
  chainId: number,
  tokenAddress: string,
): Promise<TransferIndexCreatorDigest | null> {
  const key = transferIndexCreatorDigestKey(chainId, tokenAddress);
  const memHit = memCreator.get(key);
  if (memHit) return memHit;

  const raw = await kvGetRaw(key);
  const sanitized = sanitizeTransferIndexCreatorDigest(
    raw,
    chainId,
    tokenAddress,
  );
  if (!sanitized) return null;
  memCreator.set(key, sanitized);
  return sanitized;
}

export async function persistTransferIndexCreatorDigest(
  chainId: number,
  tokenAddress: string,
  digest: Omit<TransferIndexCreatorDigest, "version" | "chainId" | "address" | "updatedAt"> & {
    updatedAt?: number;
  },
): Promise<
  | { ok: true; digest: TransferIndexCreatorDigest }
  | { ok: false; reason: "stale_generation" | "oversized" | "invalid" }
> {
  const meta = await loadTransferIndexMeta(chainId, tokenAddress);
  if (!shouldAcceptTransferIndexWrite(meta, digest.generation)) {
    return { ok: false, reason: "stale_generation" };
  }

  const addr = normalizeTokenAddress(tokenAddress);
  const next: TransferIndexCreatorDigest = {
    version: 1,
    chainId,
    address: addr,
    generation: Math.trunc(digest.generation),
    deployer: digest.deployer,
    dumpDetected: digest.dumpDetected === true,
    transferThenSellDetected: digest.transferThenSellDetected === true,
    creatorSellPctOfSupply: digest.creatorSellPctOfSupply,
    outboundTransferCount: digest.outboundTransferCount,
    sellTransferCount: digest.sellTransferCount,
    transferThenSellRecipientCount: digest.transferThenSellRecipientCount,
    evidence: digest.evidence.slice(0, TRANSFER_INDEX_CREATOR_EVIDENCE_MAX),
    pagesFetched: digest.pagesFetched,
    indexComplete: digest.indexComplete === true,
    updatedAt: digest.updatedAt ?? Date.now(),
  };

  const sanitized = sanitizeTransferIndexCreatorDigest(next, chainId, addr);
  if (!sanitized) return { ok: false, reason: "invalid" };
  if (estimateJsonBytes(sanitized) > TRANSFER_INDEX_CREATOR_DIGEST_MAX_BYTES) {
    return { ok: false, reason: "oversized" };
  }

  const key = transferIndexCreatorDigestKey(chainId, addr);
  memCreator.set(key, sanitized);
  await kvSetRaw(key, sanitized);
  return { ok: true, digest: sanitized };
}

/** Delete optional recent chunks beyond `keepCount` (newest indices 0..keepCount-1). */
export async function trimTransferIndexChunks(
  chainId: number,
  tokenAddress: string,
  keepCount: number,
): Promise<void> {
  const keep = Math.max(
    0,
    Math.min(TRANSFER_INDEX_MAX_RECENT_CHUNKS, Math.trunc(keepCount)),
  );
  for (let i = keep; i < TRANSFER_INDEX_MAX_RECENT_CHUNKS; i++) {
    const key = transferIndexChunkKey(chainId, tokenAddress, i);
    memChunks.delete(key);
    await kvDelRaw(key);
  }
}

export async function loadTransferIndexMetaForToken(
  tokenAddress: string,
): Promise<TransferIndexMeta | null> {
  return loadTransferIndexMeta(SCAN_CHAIN_ID, tokenAddress);
}

/** FOX-scale footprint helper for reports / tests (derived-first path). */
export function estimateTransferIndexFoxFootprintBytes(opts?: {
  meta?: TransferIndexMeta | null;
  creatorDigest?: TransferIndexCreatorDigest | null;
  recentChunks?: TransferIndexChunk[];
}): {
  metaBytes: number;
  creatorDigestBytes: number;
  recentChunksBytes: number;
  totalBytes: number;
  fullRaw113kEstimateBytes: number;
  strategy: "derived_first_bounded_recent";
} {
  const metaBytes = opts?.meta ? estimateJsonBytes(opts.meta) : 800;
  const creatorDigestBytes = opts?.creatorDigest
    ? estimateJsonBytes(opts.creatorDigest)
    : 4_000;
  const recentChunksBytes = (opts?.recentChunks ?? []).reduce(
    (sum, c) => sum + estimateJsonBytes(c),
    0,
  );
  // ~350 bytes/row × 113k ≈ 39.5 MB if someone stored full raw history.
  const fullRaw113kEstimateBytes = 113_000 * 350;
  return {
    metaBytes,
    creatorDigestBytes,
    recentChunksBytes:
      recentChunksBytes ||
      TRANSFER_INDEX_MAX_RECENT_CHUNKS * 50 * 280 /* ~page estimate */,
    totalBytes:
      metaBytes +
      creatorDigestBytes +
      (recentChunksBytes ||
        TRANSFER_INDEX_MAX_RECENT_CHUNKS * 50 * 280),
    fullRaw113kEstimateBytes,
    strategy: "derived_first_bounded_recent",
  };
}
