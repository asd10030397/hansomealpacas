/**
 * NX coordination lock for a single transfer-index writer per token+chain.
 */

import {
  TRANSFER_INDEX_LOCK_TTL_SEC,
  transferIndexLockKey,
} from "@/lib/hansome-score/transfer-index/keys";

type LockKv = {
  set: (
    key: string,
    value: string,
    opts: { nx: true; ex: number },
  ) => Promise<unknown>;
  del: (key: string) => Promise<unknown>;
};

let testLockKv: Map<string, { value: string; until: number }> | null = null;
const memoryLocks = new Map<string, number>();

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

async function getKv(): Promise<LockKv | null> {
  if (!isScanKvConfigured()) return null;
  const { kv } = await import("@vercel/kv");
  return kv as LockKv;
}

/** Install Map-backed lock store for unit tests. Pass null to disable. */
export function useTransferIndexLockTestKv(
  map: Map<string, { value: string; until: number }> | null,
): void {
  testLockKv = map;
}

export function clearTransferIndexLockTestKv(): void {
  testLockKv = null;
  memoryLocks.clear();
}

export type AcquireTransferIndexLockResult = {
  acquired: boolean;
  /** Opaque lock token written under the lock key (for debugging / future owner checks). */
  lockToken: string | null;
  ttlSec: number;
};

/**
 * Acquire exclusive write coordination for `scan:xfer:*` on this token.
 * Uses Redis SET NX EX when configured; falls back to process memory.
 */
export async function acquireTransferIndexLock(
  chainId: number,
  tokenAddress: string,
  opts?: { ttlSec?: number; lockToken?: string },
): Promise<AcquireTransferIndexLockResult> {
  const ttlSec = opts?.ttlSec ?? TRANSFER_INDEX_LOCK_TTL_SEC;
  const lockToken = opts?.lockToken ?? `1:${Date.now()}`;
  const key = transferIndexLockKey(chainId, tokenAddress);

  if (testLockKv) {
    const now = Date.now();
    const hit = testLockKv.get(key);
    if (hit && hit.until > now) {
      return { acquired: false, lockToken: null, ttlSec };
    }
    testLockKv.set(key, { value: lockToken, until: now + ttlSec * 1000 });
    return { acquired: true, lockToken, ttlSec };
  }

  const kv = await getKv();
  if (kv) {
    try {
      const ok = await kv.set(key, lockToken, { nx: true, ex: ttlSec });
      // Upstash/Vercel KV: "OK" on success, null when NX fails
      if (ok != null) {
        return { acquired: true, lockToken, ttlSec };
      }
      return { acquired: false, lockToken: null, ttlSec };
    } catch (err) {
      console.warn("[transfer-index] KV lock failed, using memory lock:", err);
    }
  }

  const now = Date.now();
  const until = memoryLocks.get(key) ?? 0;
  if (until > now) {
    return { acquired: false, lockToken: null, ttlSec };
  }
  memoryLocks.set(key, now + ttlSec * 1000);
  return { acquired: true, lockToken, ttlSec };
}

export async function releaseTransferIndexLock(
  chainId: number,
  tokenAddress: string,
): Promise<void> {
  const key = transferIndexLockKey(chainId, tokenAddress);
  memoryLocks.delete(key);

  if (testLockKv) {
    testLockKv.delete(key);
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

/** Test helper: peek whether lock key is held (test KV or memory). */
export function isTransferIndexLockHeldForTests(
  chainId: number,
  tokenAddress: string,
): boolean {
  const key = transferIndexLockKey(chainId, tokenAddress);
  const now = Date.now();
  if (testLockKv) {
    const hit = testLockKv.get(key);
    return !!(hit && hit.until > now);
  }
  const until = memoryLocks.get(key) ?? 0;
  return until > now;
}
