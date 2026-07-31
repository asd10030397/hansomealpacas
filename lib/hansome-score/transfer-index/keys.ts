import { getAddress } from "viem";
import { scopedKvKey } from "@/lib/hansome-score/deployment-scope";

/** Soft KV retention for meta / chunks / derived digests. */
export const TRANSFER_INDEX_KV_TTL_SEC = 7 * 24 * 60 * 60;
/** NX coordination lock while a writer advances the index. */
export const TRANSFER_INDEX_LOCK_TTL_SEC = 120;

/**
 * Cold Perf V2 Phase 4 — recent-first tier.
 * Newest-first min(6 Blockscout pages, 7-day cursor) before historical continuation.
 */
export const TRANSFER_INDEX_RECENT_TIER_MAX_PAGES = 6;
export const TRANSFER_INDEX_RECENT_TIER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Reject meta JSON larger than this (derived-first; meta must stay small). */
export const TRANSFER_INDEX_META_MAX_BYTES = 16 * 1024;
/** Reject derived creator digest JSON larger than this. */
export const TRANSFER_INDEX_CREATOR_DIGEST_MAX_BYTES = 48 * 1024;
/** Max rows per recent chunk (~1 Blockscout page). */
export const TRANSFER_INDEX_CHUNK_MAX_ROWS = 50;
/**
 * Max newest-first chunks stored for Deep creatorBurn checkpoint/resume.
 * 40 × 50 = 2_000 rows ≪ FOX-scale ~113k full history (still hard-capped).
 */
export const TRANSFER_INDEX_MAX_RECENT_CHUNKS = 40;
/** Hard reject a single chunk payload above this serialized size. */
export const TRANSFER_INDEX_CHUNK_MAX_BYTES = 96 * 1024;
/** Cap creator digest evidence entries (matches creator analyzer slice). */
export const TRANSFER_INDEX_CREATOR_EVIDENCE_MAX = 40;

/**
 * Absolute hard cap: never accept a write that would imply storing this many
 * raw rows across chunks for one token (FOX-scale safety).
 */
export const TRANSFER_INDEX_RAW_ROWS_HARD_CAP =
  TRANSFER_INDEX_CHUNK_MAX_ROWS * TRANSFER_INDEX_MAX_RECENT_CHUNKS;

export function normalizeTokenAddress(tokenAddress: string): string {
  try {
    return getAddress(tokenAddress).toLowerCase();
  } catch {
    return tokenAddress.trim().toLowerCase();
  }
}

function cacheKey(chainId: number, tokenAddress: string): string {
  return `${chainId}:${normalizeTokenAddress(tokenAddress)}`;
}

/** `{scope}:scan:xfer:{chainId}:{token}` */
export function transferIndexMetaKey(
  chainId: number,
  tokenAddress: string,
): string {
  return scopedKvKey("scan", "xfer", cacheKey(chainId, tokenAddress));
}

/** `{scope}:scan:xfer:lock:{chainId}:{token}` */
export function transferIndexLockKey(
  chainId: number,
  tokenAddress: string,
): string {
  return scopedKvKey("scan", "xfer", "lock", cacheKey(chainId, tokenAddress));
}

/** `{scope}:scan:xfer:chunk:{chainId}:{token}:{i}` */
export function transferIndexChunkKey(
  chainId: number,
  tokenAddress: string,
  chunkIndex: number,
): string {
  return scopedKvKey(
    "scan",
    "xfer",
    "chunk",
    cacheKey(chainId, tokenAddress),
    chunkIndex,
  );
}

/** `{scope}:scan:xfer:derived:creator:{chainId}:{token}` */
export function transferIndexCreatorDigestKey(
  chainId: number,
  tokenAddress: string,
): string {
  return scopedKvKey(
    "scan",
    "xfer",
    "derived",
    "creator",
    cacheKey(chainId, tokenAddress),
  );
}

export function estimateJsonBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
