/**
 * Persistent LP discovery cache — discovery inputs only.
 *
 * Key: `scan:lp:{chainId}:{token}`
 *
 * Stores proven Position NFT IDs, pool IDs, Uniswap versions seen, and locker
 * candidate addresses so future scans (across Vercel isolates) can known-first
 * revalidate instead of repeating expensive PM history discovery.
 *
 * NEVER stores Locked/Unlocked classification, lock %, or USD as ground truth.
 * Every consumer must revalidate ownership / liquidity / lock state on-chain.
 */

import { getAddress } from "viem";
import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import { scopedKvKey } from "@/lib/hansome-score/deployment-scope";

export type LpUniswapVersion = "v2" | "v3" | "v4";

/** Discovery-input cache (v1). No lock-state / classification fields. */
export type LpDiscoveryCache = {
  version: 1;
  chainId: number;
  address: string;
  poolIds: string[];
  versions: LpUniswapVersion[];
  positionIds: string[];
  /** Locker / Titan candidate addresses observed — not lock classification. */
  lockerCandidates: string[];
  /** True only when an exhaustive discovery pass last completed for this token. */
  exhaustiveComplete: boolean;
  /** Last successful known-first / revalidation wall time (ms). */
  knownVerifiedAt: number | null;
  updatedAt: number;
};

/** @deprecated Prefer LpDiscoveryCache — kept for callers that only need IDs. */
export type CachedPositionSet = {
  positionIds: string[];
  updatedAt: number;
  exhaustiveComplete: boolean;
};

/** Soft memory freshness — KV soft retention is longer; always revalidate on use. */
const MEM_TTL_MS = 6 * 60 * 60 * 1000;
/** Soft KV retention (revalidate on every use regardless). */
export const LP_DISCOVERY_KV_TTL_SEC = 24 * 60 * 60;

const mem = new Map<string, LpDiscoveryCache>();

/** Optional in-process stand-in for KV (unit tests / local cross-isolate sim). */
let testKv: Map<string, LpDiscoveryCache> | null = null;

function cacheKey(chainId: number, tokenAddress: string): string {
  return `${chainId}:${normalizeAddress(tokenAddress)}`;
}

function normalizeAddress(tokenAddress: string): string {
  try {
    return getAddress(tokenAddress).toLowerCase();
  } catch {
    return tokenAddress.toLowerCase();
  }
}

function normalizeId(id: string | bigint): string | null {
  const s = String(id);
  return /^\d+$/.test(s) ? s : null;
}

function sortIds(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort((a, b) => {
    try {
      const aa = BigInt(a);
      const bb = BigInt(b);
      return aa < bb ? -1 : aa > bb ? 1 : 0;
    } catch {
      return a.localeCompare(b);
    }
  });
}

function sortAddrs(addrs: Iterable<string>): string[] {
  return [
    ...new Set(
      [...addrs]
        .map((a) => {
          try {
            return getAddress(a).toLowerCase();
          } catch {
            return null;
          }
        })
        .filter((a): a is string => !!a),
    ),
  ].sort();
}

function sortPoolIds(ids: Iterable<string>): string[] {
  return [
    ...new Set(
      [...ids]
        .map((id) => id.trim().toLowerCase())
        .filter((id) => id.length > 0),
    ),
  ].sort();
}

function sortVersions(versions: Iterable<LpUniswapVersion>): LpUniswapVersion[] {
  const order: LpUniswapVersion[] = ["v2", "v3", "v4"];
  const set = new Set(versions);
  return order.filter((v) => set.has(v));
}

/** `{scope}:scan:lp:{chainId}:{token}` */
export function lpDiscoveryKvKey(chainId: number, tokenAddress: string): string {
  return scopedKvKey("scan", "lp", cacheKey(chainId, tokenAddress));
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

/**
 * Assert a parsed blob is discovery-inputs-only (no lock classification).
 * Drops unknown / forbidden fields when hydrating.
 */
export function sanitizeLpDiscoveryCache(
  raw: unknown,
  fallbackChainId: number,
  fallbackAddress: string,
): LpDiscoveryCache | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  // Hard reject if someone persisted lock classification as truth.
  const forbidden = [
    "lockState",
    "aggregateLockState",
    "aggregateState",
    "lockedPct",
    "unlockedPct",
    "lockDistribution",
    "positions",
  ];
  for (const key of forbidden) {
    if (key in o) {
      // Strip classification — keep only discovery inputs if present.
      break;
    }
  }

  const positionIds = Array.isArray(o.positionIds)
    ? sortIds(
        o.positionIds
          .map((id) => normalizeId(id as string | bigint))
          .filter((id): id is string => !!id),
      )
    : [];
  const poolIds = Array.isArray(o.poolIds)
    ? sortPoolIds(o.poolIds.map(String))
    : [];
  const versions = Array.isArray(o.versions)
    ? sortVersions(
        o.versions.filter(
          (v): v is LpUniswapVersion => v === "v2" || v === "v3" || v === "v4",
        ),
      )
    : [];
  const lockerCandidates = Array.isArray(o.lockerCandidates)
    ? sortAddrs(o.lockerCandidates.map(String))
    : [];

  const updatedAt =
    typeof o.updatedAt === "number" && Number.isFinite(o.updatedAt)
      ? o.updatedAt
      : Date.now();
  const knownVerifiedAt =
    typeof o.knownVerifiedAt === "number" && Number.isFinite(o.knownVerifiedAt)
      ? o.knownVerifiedAt
      : null;

  return {
    version: 1,
    chainId:
      typeof o.chainId === "number" && Number.isFinite(o.chainId)
        ? o.chainId
        : fallbackChainId,
    address: normalizeAddress(
      typeof o.address === "string" ? o.address : fallbackAddress,
    ),
    poolIds,
    versions,
    positionIds,
    lockerCandidates,
    exhaustiveComplete: o.exhaustiveComplete === true,
    knownVerifiedAt,
    updatedAt,
  };
}

/** True when object contains lock classification fields (must never be treated as truth). */
export function lpDiscoveryCacheContainsLockTruth(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return (
    "lockState" in o ||
    "aggregateLockState" in o ||
    "aggregateState" in o ||
    "lockedPct" in o ||
    "unlockedPct" in o ||
    "lockDistribution" in o ||
    "positions" in o
  );
}

function toCachedPositionSet(entry: LpDiscoveryCache): CachedPositionSet {
  return {
    positionIds: entry.positionIds,
    updatedAt: entry.updatedAt,
    exhaustiveComplete: entry.exhaustiveComplete,
  };
}

/**
 * Sync memory read (after hydrate / within same isolate).
 * Does not hit KV — call `loadLpDiscoveryCache` first across isolates.
 */
export function getCachedPositionIds(
  chainId: number,
  tokenAddress: string,
): CachedPositionSet | null {
  const hit = mem.get(cacheKey(chainId, tokenAddress));
  if (!hit) return null;
  if (Date.now() - hit.updatedAt > MEM_TTL_MS) {
    mem.delete(cacheKey(chainId, tokenAddress));
    return null;
  }
  return toCachedPositionSet(hit);
}

export function getLpDiscoveryCacheMemory(
  chainId: number,
  tokenAddress: string,
): LpDiscoveryCache | null {
  const hit = mem.get(cacheKey(chainId, tokenAddress));
  if (!hit) return null;
  if (Date.now() - hit.updatedAt > MEM_TTL_MS) {
    mem.delete(cacheKey(chainId, tokenAddress));
    return null;
  }
  return hit;
}

export type PersistLpDiscoveryPatch = {
  positionIds?: Iterable<string | bigint>;
  poolIds?: Iterable<string>;
  versions?: Iterable<LpUniswapVersion>;
  lockerCandidates?: Iterable<string>;
  exhaustiveComplete?: boolean;
  knownVerifiedAt?: number | null;
  /**
   * When true (default for positionIds), replace positionIds with the provided
   * set (revalidation drop of stale IDs). When false, union with existing.
   */
  replacePositionIds?: boolean;
};

function applyPatch(
  prior: LpDiscoveryCache | null,
  chainId: number,
  tokenAddress: string,
  patch: PersistLpDiscoveryPatch,
): LpDiscoveryCache {
  const addr = normalizeAddress(tokenAddress);
  const replaceIds = patch.replacePositionIds !== false;

  let positionIds: string[];
  if (patch.positionIds !== undefined) {
    const next = sortIds(
      [...patch.positionIds]
        .map((id) => normalizeId(id))
        .filter((id): id is string => !!id),
    );
    positionIds =
      replaceIds || !prior
        ? next
        : sortIds([...prior.positionIds, ...next]);
  } else {
    positionIds = prior?.positionIds ?? [];
  }

  const poolIds = sortPoolIds([
    ...(prior?.poolIds ?? []),
    ...(patch.poolIds ? [...patch.poolIds] : []),
  ]);
  const versions = sortVersions([
    ...(prior?.versions ?? []),
    ...(patch.versions ? [...patch.versions] : []),
  ]);
  const lockerCandidates = sortAddrs([
    ...(prior?.lockerCandidates ?? []),
    ...(patch.lockerCandidates ? [...patch.lockerCandidates] : []),
  ]);

  return {
    version: 1,
    chainId,
    address: addr,
    poolIds,
    versions,
    positionIds,
    lockerCandidates,
    exhaustiveComplete:
      patch.exhaustiveComplete !== undefined
        ? patch.exhaustiveComplete === true
        : (prior?.exhaustiveComplete ?? false),
    knownVerifiedAt:
      patch.knownVerifiedAt !== undefined
        ? patch.knownVerifiedAt
        : (prior?.knownVerifiedAt ?? null),
    updatedAt: Date.now(),
  };
}

/**
 * Sync memory write (tests / hot path). Prefer `persistLpDiscoveryCache` in
 * production so KV is updated for other isolates.
 */
export function setCachedPositionIds(
  chainId: number,
  tokenAddress: string,
  positionIds: Iterable<string | bigint>,
  opts?: {
    exhaustiveComplete?: boolean;
    poolIds?: Iterable<string>;
    versions?: Iterable<LpUniswapVersion>;
    lockerCandidates?: Iterable<string>;
    knownVerifiedAt?: number | null;
    replacePositionIds?: boolean;
  },
): CachedPositionSet {
  const prior = mem.get(cacheKey(chainId, tokenAddress)) ?? null;
  const entry = applyPatch(prior, chainId, tokenAddress, {
    positionIds,
    poolIds: opts?.poolIds,
    versions: opts?.versions,
    lockerCandidates: opts?.lockerCandidates,
    exhaustiveComplete: opts?.exhaustiveComplete,
    knownVerifiedAt: opts?.knownVerifiedAt,
    replacePositionIds: opts?.replacePositionIds,
  });
  mem.set(cacheKey(chainId, tokenAddress), entry);
  return toCachedPositionSet(entry);
}

async function kvGet(key: string): Promise<LpDiscoveryCache | null> {
  if (testKv) {
    return testKv.get(key) ?? null;
  }
  const kv = await getKv();
  if (!kv) return null;
  try {
    const raw = await kv.get<unknown>(key);
    return raw as LpDiscoveryCache | null;
  } catch (err) {
    console.warn("[lp-discovery-cache] KV get failed:", err);
    return null;
  }
}

async function kvSet(key: string, value: LpDiscoveryCache): Promise<void> {
  if (testKv) {
    testKv.set(key, value);
    return;
  }
  const kv = await getKv();
  if (!kv) return;
  try {
    await kv.set(key, value, { ex: LP_DISCOVERY_KV_TTL_SEC });
  } catch (err) {
    console.warn("[lp-discovery-cache] KV set failed:", err);
  }
}

/**
 * Load discovery cache: memory → KV → memory hydrate.
 * Always revalidate IDs on-chain after load — never trust lock state from cache.
 */
export async function loadLpDiscoveryCache(
  chainId: number,
  tokenAddress: string,
): Promise<LpDiscoveryCache | null> {
  const memHit = getLpDiscoveryCacheMemory(chainId, tokenAddress);
  if (memHit) return memHit;

  const key = lpDiscoveryKvKey(chainId, tokenAddress);
  const raw = await kvGet(key);
  const sanitized = sanitizeLpDiscoveryCache(raw, chainId, tokenAddress);
  if (!sanitized) return null;

  // Soft age check — still return for revalidation; drop only absurdly old
  // entries beyond 2× KV TTL wall (safety).
  if (Date.now() - sanitized.updatedAt > LP_DISCOVERY_KV_TTL_SEC * 1000 * 2) {
    return null;
  }

  mem.set(cacheKey(chainId, tokenAddress), sanitized);
  return sanitized;
}

/**
 * Persist proven discovery inputs to memory + KV.
 * Position IDs default to replace (stale IDs dropped after revalidation).
 */
export async function persistLpDiscoveryCache(
  chainId: number,
  tokenAddress: string,
  patch: PersistLpDiscoveryPatch,
): Promise<LpDiscoveryCache> {
  const prior =
    getLpDiscoveryCacheMemory(chainId, tokenAddress) ??
    (await loadLpDiscoveryCache(chainId, tokenAddress));
  const entry = applyPatch(prior, chainId, tokenAddress, patch);
  mem.set(cacheKey(chainId, tokenAddress), entry);
  await kvSet(lpDiscoveryKvKey(chainId, tokenAddress), entry);
  return entry;
}

/** Convenience: default chain for scan engine. */
export async function loadLpDiscoveryCacheForToken(
  tokenAddress: string,
): Promise<LpDiscoveryCache | null> {
  return loadLpDiscoveryCache(SCAN_CHAIN_ID, tokenAddress);
}

export async function persistLpDiscoveryCacheForToken(
  tokenAddress: string,
  patch: PersistLpDiscoveryPatch,
): Promise<LpDiscoveryCache> {
  return persistLpDiscoveryCache(SCAN_CHAIN_ID, tokenAddress, patch);
}

export function clearPositionCacheForTests(): void {
  mem.clear();
}

/**
 * Delete LP discovery inputs for one token (KV + this isolate memory).
 * Does not touch transfer-index or scan snapshots.
 */
export async function invalidateLpDiscoveryCacheForToken(
  chainId: number,
  tokenAddress: string,
): Promise<{ key: string; result: unknown; memoryCleared: boolean }> {
  const key = lpDiscoveryKvKey(chainId, tokenAddress);
  const memoryCleared = mem.delete(cacheKey(chainId, tokenAddress));
  const kv = await getKv();
  if (!kv) return { key, result: "kv_not_configured", memoryCleared };
  const result = await kv.del(key);
  return { key, result, memoryCleared };
}

/** Install Map-backed KV for cross-isolate unit tests. Pass null to disable. */
export function useLpDiscoveryCacheTestKv(
  map: Map<string, LpDiscoveryCache> | null,
): void {
  testKv = map;
}

export function clearLpDiscoveryCacheTestKv(): void {
  testKv = null;
}

export function isLpDiscoveryKvConfigured(): boolean {
  return testKv != null || isScanKvConfigured();
}
