/**
 * LP discovery checkpoint — checked candidates / PM pages for resume.
 * Discovery inputs only (never lock classification).
 *
 * Key: `scan:lp:ckpt:{chainId}:{token}`
 */

import { getAddress } from "viem";
import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import { scopedKvKey } from "@/lib/hansome-score/deployment-scope";

export type LpDiscoveryCheckpoint = {
  version: 1;
  chainId: number;
  address: string;
  /** Position NFT IDs already evaluated (proven or definitive stale). */
  checkedPositionIds: string[];
  /** Last Quick / exhaustive PM pages fetched in this discovery generation. */
  pmPagesFetched: number;
  quickComplete: boolean;
  exhaustiveComplete: boolean;
  updatedAt: number;
};

const MEM_TTL_MS = 6 * 60 * 60 * 1000;
export const LP_CHECKPOINT_KV_TTL_SEC = 24 * 60 * 60;

const mem = new Map<string, LpDiscoveryCheckpoint>();
let testKv: Map<string, LpDiscoveryCheckpoint> | null = null;

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

/** `{scope}:scan:lp:ckpt:{chainId}:{token}` */
export function lpDiscoveryCheckpointKvKey(
  chainId: number,
  tokenAddress: string,
): string {
  return scopedKvKey("scan", "lp", "ckpt", cacheKey(chainId, tokenAddress));
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

export function sanitizeLpDiscoveryCheckpoint(
  raw: unknown,
  fallbackChainId: number,
  fallbackAddress: string,
): LpDiscoveryCheckpoint | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  // Reject lock-truth blobs
  if (
    "lockState" in o ||
    "lockedPct" in o ||
    "lockDistribution" in o ||
    "positions" in o
  ) {
    return null;
  }
  const checkedPositionIds = Array.isArray(o.checkedPositionIds)
    ? sortIds(o.checkedPositionIds.map(String))
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
    checkedPositionIds,
    pmPagesFetched:
      typeof o.pmPagesFetched === "number" && Number.isFinite(o.pmPagesFetched)
        ? Math.max(0, Math.floor(o.pmPagesFetched))
        : 0,
    quickComplete: o.quickComplete === true,
    exhaustiveComplete: o.exhaustiveComplete === true,
    updatedAt:
      typeof o.updatedAt === "number" && Number.isFinite(o.updatedAt)
        ? o.updatedAt
        : Date.now(),
  };
}

export async function loadLpDiscoveryCheckpoint(
  chainId: number,
  tokenAddress: string,
): Promise<LpDiscoveryCheckpoint | null> {
  const key = cacheKey(chainId, tokenAddress);
  const memHit = mem.get(key);
  if (memHit && Date.now() - memHit.updatedAt <= MEM_TTL_MS) return memHit;

  const kvKey = lpDiscoveryCheckpointKvKey(chainId, tokenAddress);
  let raw: unknown = null;
  if (testKv) {
    raw = testKv.get(kvKey) ?? null;
  } else {
    const kv = await getKv();
    if (kv) {
      try {
        raw = await kv.get(kvKey);
      } catch (err) {
        console.warn("[lp-discovery-ckpt] KV get failed:", err);
      }
    }
  }
  const sanitized = sanitizeLpDiscoveryCheckpoint(raw, chainId, tokenAddress);
  if (!sanitized) return null;
  if (Date.now() - sanitized.updatedAt > LP_CHECKPOINT_KV_TTL_SEC * 1000 * 2) {
    return null;
  }
  mem.set(key, sanitized);
  return sanitized;
}

export async function persistLpDiscoveryCheckpoint(
  chainId: number,
  tokenAddress: string,
  patch: {
    checkedPositionIds?: Iterable<string | bigint>;
    pmPagesFetched?: number;
    quickComplete?: boolean;
    exhaustiveComplete?: boolean;
    /** When true, replace checked IDs; default union. */
    replaceChecked?: boolean;
  },
): Promise<LpDiscoveryCheckpoint> {
  const prior = await loadLpDiscoveryCheckpoint(chainId, tokenAddress);
  const addr = normalizeAddress(tokenAddress);
  const nextChecked = patch.checkedPositionIds
    ? sortIds([...patch.checkedPositionIds].map(String))
    : [];
  const checkedPositionIds =
    patch.replaceChecked === true || !prior
      ? nextChecked
      : patch.checkedPositionIds !== undefined
        ? sortIds([...prior.checkedPositionIds, ...nextChecked])
        : prior.checkedPositionIds;

  const entry: LpDiscoveryCheckpoint = {
    version: 1,
    chainId,
    address: addr,
    checkedPositionIds,
    pmPagesFetched:
      patch.pmPagesFetched !== undefined
        ? Math.max(0, Math.floor(patch.pmPagesFetched))
        : (prior?.pmPagesFetched ?? 0),
    quickComplete:
      patch.quickComplete !== undefined
        ? patch.quickComplete === true
        : (prior?.quickComplete ?? false),
    exhaustiveComplete:
      patch.exhaustiveComplete !== undefined
        ? patch.exhaustiveComplete === true
        : (prior?.exhaustiveComplete ?? false),
    updatedAt: Date.now(),
  };

  mem.set(cacheKey(chainId, tokenAddress), entry);
  const kvKey = lpDiscoveryCheckpointKvKey(chainId, tokenAddress);
  if (testKv) {
    testKv.set(kvKey, entry);
  } else {
    const kv = await getKv();
    if (kv) {
      try {
        await kv.set(kvKey, entry, { ex: LP_CHECKPOINT_KV_TTL_SEC });
      } catch (err) {
        console.warn("[lp-discovery-ckpt] KV set failed:", err);
      }
    }
  }
  return entry;
}

export function scheduleLpExhaustiveBackground(params: {
  tokenAddress: string;
  chainId?: number;
  run: () => Promise<void>;
}): void {
  const chainId = params.chainId ?? SCAN_CHAIN_ID;
  const key = `${chainId}:${normalizeAddress(params.tokenAddress)}`;
  if (backgroundInflight.has(key)) return;
  backgroundInflight.add(key);
  void (async () => {
    try {
      await params.run();
    } catch (err) {
      console.warn("[lp-discovery] background exhaustive failed:", err);
    } finally {
      backgroundInflight.delete(key);
    }
  })();
}

const backgroundInflight = new Set<string>();

export function clearLpDiscoveryCheckpointForTests(): void {
  mem.clear();
  backgroundInflight.clear();
}

export function useLpDiscoveryCheckpointTestKv(
  map: Map<string, LpDiscoveryCheckpoint> | null,
): void {
  testKv = map;
}

export function clearLpDiscoveryCheckpointTestKv(): void {
  testKv = null;
}

export function isLpExhaustiveBackgroundInflight(
  chainId: number,
  tokenAddress: string,
): boolean {
  return backgroundInflight.has(
    `${chainId}:${normalizeAddress(tokenAddress)}`,
  );
}
