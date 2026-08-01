/**
 * Phase 13D — Known-First Bootstrap cache.
 *
 * Discovery-orchestration inputs only. Never stores lock classification as truth.
 * Key: `{scope}:scan:lp:bootstrap:{chainId}:{token}`
 */

import { getAddress } from "viem";
import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import { scopedKvKey } from "@/lib/hansome-score/deployment-scope";
import type { LpUniswapVersion } from "@/lib/hansome-score/lp/position-cache";

export type KnownBootstrapStage =
  | "known_titan"
  | "known_pons"
  | "known_hook"
  | "historical_position_index"
  | "generic_discovery"
  | "exhaustive_scan";

export type KnownBootstrapCompleteness = {
  knownTitan: boolean;
  knownPons: boolean;
  knownHook: boolean;
  historicalIndex: boolean;
  genericReady: boolean;
  exhaustiveReady: boolean;
};

export type LpBootstrapCache = {
  version: 1;
  chainId: number;
  address: string;
  positionIds: string[];
  poolIds: string[];
  versions: LpUniswapVersion[];
  lockerCandidates: string[];
  stagesHit: KnownBootstrapStage[];
  completeness: KnownBootstrapCompleteness;
  /** Advisory until on-chain ownership verification. */
  advisory: true;
  updatedAt: number;
};

export const LP_BOOTSTRAP_KV_TTL_SEC = 24 * 60 * 60;
const MEM_TTL_MS = 6 * 60 * 60 * 1000;

const mem = new Map<string, LpBootstrapCache>();
let testKv: Map<string, LpBootstrapCache> | null = null;

function normalizeAddress(tokenAddress: string): string {
  try {
    return getAddress(tokenAddress).toLowerCase();
  } catch {
    return tokenAddress.toLowerCase();
  }
}

function cacheKey(chainId: number, tokenAddress: string): string {
  return `${chainId}:${normalizeAddress(tokenAddress)}`;
}

export function lpBootstrapKvKey(chainId: number, tokenAddress: string): string {
  return scopedKvKey("scan", "lp", "bootstrap", cacheKey(chainId, tokenAddress));
}

function sortIds(ids: Iterable<string>): string[] {
  return [...new Set(ids)].filter((id) => /^\d+$/.test(id)).sort((a, b) => {
    try {
      return BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0;
    } catch {
      return a.localeCompare(b);
    }
  });
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

function sortVersions(versions: Iterable<LpUniswapVersion>): LpUniswapVersion[] {
  const order: LpUniswapVersion[] = ["v2", "v3", "v4"];
  const set = new Set(versions);
  return order.filter((v) => set.has(v));
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

export function emptyBootstrapCompleteness(): KnownBootstrapCompleteness {
  return {
    knownTitan: false,
    knownPons: false,
    knownHook: false,
    historicalIndex: false,
    genericReady: true,
    exhaustiveReady: false,
  };
}

export function sanitizeLpBootstrapCache(
  raw: unknown,
  fallbackChainId: number,
  fallbackAddress: string,
): LpBootstrapCache | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (
    "lockState" in o ||
    "lockedPct" in o ||
    "lockDistribution" in o ||
    "positions" in o
  ) {
    return null;
  }
  const completenessRaw =
    o.completeness && typeof o.completeness === "object"
      ? (o.completeness as Record<string, unknown>)
      : {};
  const stagesHit = Array.isArray(o.stagesHit)
    ? (o.stagesHit.filter(
        (s): s is KnownBootstrapStage =>
          s === "known_titan" ||
          s === "known_pons" ||
          s === "known_hook" ||
          s === "historical_position_index" ||
          s === "generic_discovery" ||
          s === "exhaustive_scan",
      ) as KnownBootstrapStage[])
    : [];
  return {
    version: 1,
    chainId:
      typeof o.chainId === "number" && Number.isFinite(o.chainId)
        ? o.chainId
        : fallbackChainId,
    address: normalizeAddress(
      typeof o.address === "string" ? o.address : fallbackAddress,
    ),
    positionIds: Array.isArray(o.positionIds)
      ? sortIds(o.positionIds.map(String))
      : [],
    poolIds: Array.isArray(o.poolIds) ? sortPoolIds(o.poolIds.map(String)) : [],
    versions: Array.isArray(o.versions)
      ? sortVersions(
          o.versions.filter(
            (v): v is LpUniswapVersion =>
              v === "v2" || v === "v3" || v === "v4",
          ),
        )
      : [],
    lockerCandidates: Array.isArray(o.lockerCandidates)
      ? sortAddrs(o.lockerCandidates.map(String))
      : [],
    stagesHit,
    completeness: {
      knownTitan: completenessRaw.knownTitan === true,
      knownPons: completenessRaw.knownPons === true,
      knownHook: completenessRaw.knownHook === true,
      historicalIndex: completenessRaw.historicalIndex === true,
      genericReady: completenessRaw.genericReady !== false,
      exhaustiveReady: completenessRaw.exhaustiveReady === true,
    },
    advisory: true,
    updatedAt:
      typeof o.updatedAt === "number" && Number.isFinite(o.updatedAt)
        ? o.updatedAt
        : Date.now(),
  };
}

export async function loadLpBootstrapCache(
  chainId: number,
  tokenAddress: string,
): Promise<LpBootstrapCache | null> {
  const key = cacheKey(chainId, tokenAddress);
  const memHit = mem.get(key);
  if (memHit && Date.now() - memHit.updatedAt <= MEM_TTL_MS) return memHit;

  const kvKey = lpBootstrapKvKey(chainId, tokenAddress);
  let raw: unknown = null;
  if (testKv) {
    raw = testKv.get(kvKey) ?? null;
  } else {
    const kv = await getKv();
    if (kv) {
      try {
        raw = await kv.get(kvKey);
      } catch (err) {
        console.warn("[lp-bootstrap-cache] KV get failed:", err);
      }
    }
  }
  const sanitized = sanitizeLpBootstrapCache(raw, chainId, tokenAddress);
  if (!sanitized) return null;
  if (Date.now() - sanitized.updatedAt > LP_BOOTSTRAP_KV_TTL_SEC * 1000 * 2) {
    return null;
  }
  mem.set(key, sanitized);
  return sanitized;
}

export async function persistLpBootstrapCache(
  chainId: number,
  tokenAddress: string,
  entry: Omit<LpBootstrapCache, "version" | "advisory" | "updatedAt"> & {
    updatedAt?: number;
  },
): Promise<LpBootstrapCache> {
  const next: LpBootstrapCache = {
    version: 1,
    chainId,
    address: normalizeAddress(tokenAddress),
    positionIds: sortIds(entry.positionIds),
    poolIds: sortPoolIds(entry.poolIds),
    versions: sortVersions(entry.versions),
    lockerCandidates: sortAddrs(entry.lockerCandidates),
    stagesHit: [...new Set(entry.stagesHit)],
    completeness: { ...entry.completeness },
    advisory: true,
    updatedAt: entry.updatedAt ?? Date.now(),
  };
  mem.set(cacheKey(chainId, tokenAddress), next);
  const kvKey = lpBootstrapKvKey(chainId, tokenAddress);
  if (testKv) {
    testKv.set(kvKey, next);
  } else {
    const kv = await getKv();
    if (kv) {
      try {
        await kv.set(kvKey, next, { ex: LP_BOOTSTRAP_KV_TTL_SEC });
      } catch (err) {
        console.warn("[lp-bootstrap-cache] KV set failed:", err);
      }
    }
  }
  return next;
}

export async function loadLpBootstrapCacheForToken(
  tokenAddress: string,
): Promise<LpBootstrapCache | null> {
  return loadLpBootstrapCache(SCAN_CHAIN_ID, tokenAddress);
}

export function clearLpBootstrapCacheForTests(): void {
  mem.clear();
}

export function useLpBootstrapCacheTestKv(
  map: Map<string, LpBootstrapCache> | null,
): void {
  testKv = map;
}

export function clearLpBootstrapCacheTestKv(): void {
  testKv = null;
}
