/**
 * Phase 10C-1 — Production durable store for pool-scoped V3 Position Index.
 * Namespace: scan:v3pos:* — never touches scan:xfer:*.
 */

import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import {
  assertNotTransferIndexNamespace,
  buildV3PosIndexKey,
} from "@/lib/hansome-score/lp/v3-position-index/key";
import {
  V3PosStoreError,
  validateV3PosIndexRecord,
} from "@/lib/hansome-score/lp/v3-position-index/store";
import type {
  V3PosIndexRecord,
  V3PosPoolKey,
} from "@/lib/hansome-score/lp/v3-position-index/types";

const V3_POS_KV_TTL_SEC = 60 * 60 * 24 * 14; // 14 days

type TestKvStore = Map<string, unknown>;

let testKv: TestKvStore | null = null;
const memory = new Map<string, V3PosIndexRecord>();

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

/** Install Map-backed KV for unit tests. Pass null to disable. */
export function useV3PosIndexTestKv(map: TestKvStore | null): void {
  testKv = map;
}

export function clearV3PosProductionMemoryForTests(): void {
  memory.clear();
}

export function v3PosIndexKey(key: V3PosPoolKey): string {
  return buildV3PosIndexKey(key);
}

export async function loadV3PosIndexProduction(
  key: string,
): Promise<V3PosIndexRecord | null> {
  assertNotTransferIndexNamespace(key);

  if (testKv) {
    if (!testKv.has(key)) return null;
    try {
      return validateV3PosIndexRecord(testKv.get(key));
    } catch (e) {
      if (e instanceof V3PosStoreError) throw e;
      throw new V3PosStoreError("corrupted test kv record", "CORRUPTED");
    }
  }

  const mem = memory.get(key);
  if (mem) {
    try {
      return validateV3PosIndexRecord(structuredClone(mem));
    } catch {
      memory.delete(key);
    }
  }

  const kv = await getKv();
  if (!kv) return mem ? structuredClone(mem) : null;
  try {
    const raw = (await kv.get<unknown>(key)) ?? null;
    if (raw == null) return null;
    const validated = validateV3PosIndexRecord(raw);
    memory.set(key, structuredClone(validated));
    return validated;
  } catch (err) {
    if (err instanceof V3PosStoreError) throw err;
    console.warn("[v3pos] KV get failed:", err);
    return null;
  }
}

export async function saveV3PosIndexProduction(
  key: string,
  record: V3PosIndexRecord,
  opts?: { expectedGeneration?: number },
): Promise<{ ok: boolean; reason?: string }> {
  assertNotTransferIndexNamespace(key);
  validateV3PosIndexRecord(record);

  if (record.chainId !== SCAN_CHAIN_ID && process.env.NODE_ENV !== "test") {
    // Allow tests to use fixture chainIds; reject accidental cross-chain in prod.
    if (process.env.VITEST !== "true" && !testKv) {
      return { ok: false, reason: "wrong_chain" };
    }
  }

  const existing =
    (testKv?.has(key) ? testKv.get(key) : memory.get(key)) ?? null;
  if (existing && typeof existing === "object") {
    const gen = (existing as V3PosIndexRecord).generation;
    if (
      opts?.expectedGeneration != null &&
      typeof gen === "number" &&
      gen !== opts.expectedGeneration
    ) {
      return {
        ok: false,
        reason: `generation_fence:expected=${opts.expectedGeneration}:have=${gen}`,
      };
    }
    // Never allow older generation to overwrite newer.
    if (
      typeof gen === "number" &&
      record.generation < gen &&
      opts?.expectedGeneration == null
    ) {
      return {
        ok: false,
        reason: `stale_generation:incoming=${record.generation}:have=${gen}`,
      };
    }
  }

  const clone = structuredClone(record);
  memory.set(key, clone);

  if (testKv) {
    testKv.set(key, clone);
    return { ok: true };
  }

  const kv = await getKv();
  if (!kv) return { ok: true }; // memory-only OK when KV unset
  try {
    await kv.set(key, clone, { ex: V3_POS_KV_TTL_SEC });
    return { ok: true };
  } catch (err) {
    console.warn("[v3pos] KV set failed:", err);
    return { ok: false, reason: "kv_unavailable" };
  }
}

export function assertPoolKeyMatchesRecord(
  key: V3PosPoolKey & { npm: string; poolAddress?: string },
  record: V3PosIndexRecord,
): void {
  if (record.chainId !== key.chainId) {
    throw new V3PosStoreError("wrong chainId on record", "CORRUPTED");
  }
  if (record.npm.toLowerCase() !== key.npm.toLowerCase()) {
    throw new V3PosStoreError("wrong NPM on record", "CORRUPTED");
  }
  if (record.token0.toLowerCase() !== key.token0.toLowerCase()) {
    throw new V3PosStoreError("wrong token0 on record", "CORRUPTED");
  }
  if (record.token1.toLowerCase() !== key.token1.toLowerCase()) {
    throw new V3PosStoreError("wrong token1 on record", "CORRUPTED");
  }
  if (record.fee !== key.fee) {
    throw new V3PosStoreError("wrong fee on record", "CORRUPTED");
  }
  if (
    key.poolAddress &&
    record.poolAddress.toLowerCase() !== key.poolAddress.toLowerCase()
  ) {
    throw new V3PosStoreError("wrong poolAddress on record", "CORRUPTED");
  }
}
