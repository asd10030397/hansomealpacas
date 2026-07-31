/**
 * Phase 11E — durable store for Hook Position Index.
 * Namespace: scan:v4hook:* — deployment-scoped when possible.
 */

import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import { resolveDeploymentScope } from "@/lib/hansome-score/deployment-scope";
import {
  assertHookPosNamespace,
  buildHookPosIndexKey,
  buildScopedHookPosIndexKey,
} from "@/lib/hansome-score/lp/hook-position-index/key";
import { compareGeneration } from "@/lib/hansome-score/lp/hook-position-index/state-machine";
import {
  HookPosStoreError,
  validateHookPositionIndexState,
} from "@/lib/hansome-score/lp/hook-position-index/store";
import type { HookPositionIndexState } from "@/lib/hansome-score/lp/hook-position-index/types";

const HOOK_POS_KV_TTL_SEC = 60 * 60 * 24 * 14;

type TestKvStore = Map<string, unknown>;
let testKv: TestKvStore | null = null;
const memory = new Map<string, HookPositionIndexState>();
const poolLocks = new Map<string, Promise<void>>();

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

export function useHookPosIndexTestKv(map: TestKvStore | null): void {
  testKv = map;
}

export function clearHookPosProductionMemoryForTests(): void {
  memory.clear();
}

export function hookPosIndexKey(params: {
  chainId: number;
  poolId: string;
  scoped?: boolean;
}): string {
  if (params.scoped === false) {
    return buildHookPosIndexKey(params);
  }
  const scope = resolveDeploymentScope();
  return buildScopedHookPosIndexKey({
    scope,
    chainId: params.chainId,
    poolId: params.poolId,
  });
}

/** Per-pool concurrency lock (in-process). */
export async function withHookPoolLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = poolLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const done = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Chain: wait for previous, then hold until we finish.
  poolLocks.set(
    key,
    prev.catch(() => undefined).then(() => done),
  );
  await prev.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
  }
}

export async function loadHookPosIndexProduction(
  key: string,
): Promise<HookPositionIndexState | null> {
  assertHookPosNamespace(key);

  if (testKv) {
    if (!testKv.has(key)) return null;
    try {
      return validateHookPositionIndexState(testKv.get(key));
    } catch (e) {
      if (e instanceof HookPosStoreError) throw e;
      throw new HookPosStoreError("corrupted test kv record", "CORRUPTED");
    }
  }

  const mem = memory.get(key);
  if (mem) {
    try {
      return validateHookPositionIndexState(structuredClone(mem));
    } catch {
      memory.delete(key);
    }
  }

  const kv = await getKv();
  if (!kv) return mem ? structuredClone(mem) : null;
  try {
    const raw = (await kv.get<unknown>(key)) ?? null;
    if (raw == null) return null;
    const validated = validateHookPositionIndexState(raw);
    memory.set(key, structuredClone(validated));
    return validated;
  } catch (err) {
    if (err instanceof HookPosStoreError) throw err;
    console.warn("[v4hook] KV get failed:", err);
    return null;
  }
}

export async function saveHookPosIndexProduction(
  key: string,
  record: HookPositionIndexState,
  opts?: { expectedGeneration?: string },
): Promise<{ ok: boolean; reason?: string }> {
  assertHookPosNamespace(key);
  validateHookPositionIndexState(record);

  if (record.chainId !== SCAN_CHAIN_ID && process.env.NODE_ENV !== "test") {
    if (process.env.VITEST !== "true" && !testKv) {
      return { ok: false, reason: "wrong_chain" };
    }
  }

  // Never publish SUCCESS_COMPLETE without hookDiscoveryComplete
  if (
    record.terminalState === "SUCCESS_COMPLETE" &&
    !record.hookDiscoveryComplete
  ) {
    return { ok: false, reason: "incomplete_marked_complete" };
  }

  const existingRaw =
    (testKv?.has(key) ? testKv.get(key) : memory.get(key)) ?? null;
  if (existingRaw && typeof existingRaw === "object") {
    const gen = (existingRaw as HookPositionIndexState).generation;
    if (
      opts?.expectedGeneration != null &&
      typeof gen === "string" &&
      gen !== opts.expectedGeneration
    ) {
      return {
        ok: false,
        reason: `generation_fence:expected=${opts.expectedGeneration}:have=${gen}`,
      };
    }
    if (
      typeof gen === "string" &&
      compareGeneration(record.generation, gen) < 0 &&
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
  if (!kv) return { ok: true };
  try {
    await kv.set(key, clone, { ex: HOOK_POS_KV_TTL_SEC });
    return { ok: true };
  } catch (err) {
    console.warn("[v4hook] KV set failed:", err);
    return { ok: false, reason: "kv_unavailable" };
  }
}
