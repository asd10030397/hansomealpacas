/**
 * Phase 13D.1 — Persistent LP Snapshot.
 *
 * Persists discovery identifiers + evidence *references* across isolates.
 * After Force Refresh, snapshots may be reused ONLY with revalidation —
 * never bypass ownership / lock verification.
 *
 * Key: `{scope}:scan:lp:snap:{chainId}:{token}`
 */

import { getAddress } from "viem";
import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import { scopedKvKey } from "@/lib/hansome-score/deployment-scope";
import type { LpIntelligence } from "@/lib/hansome-score/types";

export type LpSnapshotEvidenceRef = {
  positionId: string;
  poolId: string | null;
  /** Last observed owner address — hint only; must revalidate via ownerOf. */
  ownerHint: string | null;
  /** Last observed lock state — hint only; never treated as ground truth. */
  lockStateHint: string | null;
  verifiedAt: number | null;
};

export type LpPersistentSnapshot = {
  version: 1;
  chainId: number;
  address: string;
  positionIds: string[];
  poolIds: string[];
  lockerCandidates: string[];
  ownershipEvidenceRefs: LpSnapshotEvidenceRef[];
  discoveryGeneration: string | null;
  publishGeneration: string | null;
  verificationTimestamp: number | null;
  updatedAt: number;
  /**
   * When true, consumer MUST revalidate before serving as LP truth
   * (always required after Force Refresh).
   */
  requiresRevalidation: true;
};

export const LP_SNAPSHOT_KV_TTL_SEC = 7 * 24 * 60 * 60;
const MEM_TTL_MS = 6 * 60 * 60 * 1000;

const mem = new Map<string, LpPersistentSnapshot>();
let testKv: Map<string, LpPersistentSnapshot> | null = null;

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

export function lpPersistentSnapshotKvKey(
  chainId: number,
  tokenAddress: string,
): string {
  return scopedKvKey("scan", "lp", "snap", cacheKey(chainId, tokenAddress));
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

function sortPools(ids: Iterable<string>): string[] {
  return [
    ...new Set(
      [...ids].map((id) => id.trim().toLowerCase()).filter((id) => id.length > 0),
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

export function sanitizeLpPersistentSnapshot(
  raw: unknown,
  fallbackChainId: number,
  fallbackAddress: string,
): LpPersistentSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  // Reject blobs that embed full position classification as truth.
  if ("positions" in o && Array.isArray(o.positions)) return null;
  if ("lockDistribution" in o) return null;

  const refsRaw = Array.isArray(o.ownershipEvidenceRefs)
    ? o.ownershipEvidenceRefs
    : [];
  const ownershipEvidenceRefs: LpSnapshotEvidenceRef[] = [];
  for (const r of refsRaw) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const positionId = String(row.positionId ?? "");
    if (!/^\d+$/.test(positionId)) continue;
    ownershipEvidenceRefs.push({
      positionId,
      poolId:
        typeof row.poolId === "string" && row.poolId.trim()
          ? row.poolId.toLowerCase()
          : null,
      ownerHint:
        typeof row.ownerHint === "string" && row.ownerHint.trim()
          ? row.ownerHint.toLowerCase()
          : null,
      lockStateHint:
        typeof row.lockStateHint === "string" ? row.lockStateHint : null,
      verifiedAt:
        typeof row.verifiedAt === "number" && Number.isFinite(row.verifiedAt)
          ? row.verifiedAt
          : null,
    });
  }

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
      : ownershipEvidenceRefs.map((r) => r.positionId),
    poolIds: Array.isArray(o.poolIds) ? sortPools(o.poolIds.map(String)) : [],
    lockerCandidates: Array.isArray(o.lockerCandidates)
      ? sortAddrs(o.lockerCandidates.map(String))
      : [],
    ownershipEvidenceRefs,
    discoveryGeneration:
      typeof o.discoveryGeneration === "string" ? o.discoveryGeneration : null,
    publishGeneration:
      typeof o.publishGeneration === "string" ? o.publishGeneration : null,
    verificationTimestamp:
      typeof o.verificationTimestamp === "number" &&
      Number.isFinite(o.verificationTimestamp)
        ? o.verificationTimestamp
        : null,
    updatedAt:
      typeof o.updatedAt === "number" && Number.isFinite(o.updatedAt)
        ? o.updatedAt
        : Date.now(),
    requiresRevalidation: true,
  };
}

/**
 * Build snapshot from published LP intelligence — stores refs only.
 */
export function buildLpPersistentSnapshot(params: {
  chainId: number;
  tokenAddress: string;
  intelligence: LpIntelligence;
  discoveryGeneration?: string | null;
  publishGeneration?: string | null;
  nowMs?: number;
}): LpPersistentSnapshot {
  const nowMs = params.nowMs ?? Date.now();
  const positions = params.intelligence.positions ?? [];
  const positionIds = sortIds(positions.map((p) => p.positionNftId));
  const poolIds = sortPools(
    positions.map((p) => p.poolId).filter((p): p is string => !!p),
  );
  const lockerCandidates = sortAddrs(
    positions.map((p) => p.owner).filter((o): o is string => !!o),
  );
  const ownershipEvidenceRefs: LpSnapshotEvidenceRef[] = positions.map((p) => ({
    positionId: p.positionNftId,
    poolId: p.poolId ? p.poolId.toLowerCase() : null,
    ownerHint: p.owner ? p.owner.toLowerCase() : null,
    lockStateHint: p.lockState ?? null,
    verifiedAt:
      p.lockState === "LOCKED_VERIFIED_ONCHAIN" ? nowMs : null,
  }));
  const anyVerified = ownershipEvidenceRefs.some((r) => r.verifiedAt != null);

  return {
    version: 1,
    chainId: params.chainId,
    address: normalizeAddress(params.tokenAddress),
    positionIds,
    poolIds,
    lockerCandidates,
    ownershipEvidenceRefs,
    discoveryGeneration: params.discoveryGeneration ?? null,
    publishGeneration: params.publishGeneration ?? null,
    verificationTimestamp: anyVerified ? nowMs : null,
    updatedAt: nowMs,
    requiresRevalidation: true,
  };
}

export async function loadLpPersistentSnapshot(
  chainId: number,
  tokenAddress: string,
): Promise<LpPersistentSnapshot | null> {
  const key = cacheKey(chainId, tokenAddress);
  const memHit = mem.get(key);
  if (memHit && Date.now() - memHit.updatedAt <= MEM_TTL_MS) {
    return { ...memHit, requiresRevalidation: true };
  }

  const kvKey = lpPersistentSnapshotKvKey(chainId, tokenAddress);
  let raw: unknown = null;
  if (testKv) {
    raw = testKv.get(kvKey) ?? null;
  } else {
    const kv = await getKv();
    if (kv) {
      try {
        raw = await kv.get(kvKey);
      } catch (err) {
        console.warn("[lp-persistent-snapshot] KV get failed:", err);
      }
    }
  }
  const sanitized = sanitizeLpPersistentSnapshot(raw, chainId, tokenAddress);
  if (!sanitized) return null;
  if (Date.now() - sanitized.updatedAt > LP_SNAPSHOT_KV_TTL_SEC * 1000 * 2) {
    return null;
  }
  mem.set(key, sanitized);
  return { ...sanitized, requiresRevalidation: true };
}

export async function persistLpPersistentSnapshot(
  snapshot: LpPersistentSnapshot,
): Promise<LpPersistentSnapshot> {
  const next: LpPersistentSnapshot = {
    ...snapshot,
    version: 1,
    address: normalizeAddress(snapshot.address),
    positionIds: sortIds(snapshot.positionIds),
    poolIds: sortPools(snapshot.poolIds),
    lockerCandidates: sortAddrs(snapshot.lockerCandidates),
    requiresRevalidation: true,
    updatedAt: Date.now(),
  };
  mem.set(cacheKey(next.chainId, next.address), next);
  const kvKey = lpPersistentSnapshotKvKey(next.chainId, next.address);
  if (testKv) {
    testKv.set(kvKey, next);
  } else {
    const kv = await getKv();
    if (kv) {
      try {
        await kv.set(kvKey, next, { ex: LP_SNAPSHOT_KV_TTL_SEC });
      } catch (err) {
        console.warn("[lp-persistent-snapshot] KV set failed:", err);
      }
    }
  }
  return next;
}

/**
 * Force Refresh path: load snapshot for seeding ONLY.
 * Always returns requiresRevalidation=true — caller must not skip ownerOf.
 */
export async function loadSnapshotForForceRefresh(
  chainId: number,
  tokenAddress: string,
): Promise<LpPersistentSnapshot | null> {
  const snap = await loadLpPersistentSnapshot(chainId, tokenAddress);
  if (!snap) return null;
  return { ...snap, requiresRevalidation: true };
}

export async function persistSnapshotFromLpPublish(params: {
  chainId?: number;
  tokenAddress: string;
  intelligence: LpIntelligence;
  discoveryGeneration?: string | null;
  publishGeneration?: string | null;
}): Promise<LpPersistentSnapshot | null> {
  const positions = params.intelligence.positions ?? [];
  if (positions.length === 0) return null;
  const chainId = params.chainId ?? SCAN_CHAIN_ID;
  const snap = buildLpPersistentSnapshot({
    chainId,
    tokenAddress: params.tokenAddress,
    intelligence: params.intelligence,
    discoveryGeneration: params.discoveryGeneration,
    publishGeneration: params.publishGeneration,
  });
  return persistLpPersistentSnapshot(snap);
}

export function clearLpPersistentSnapshotForTests(): void {
  mem.clear();
}

export function useLpPersistentSnapshotTestKv(
  map: Map<string, LpPersistentSnapshot> | null,
): void {
  testKv = map;
}

export function clearLpPersistentSnapshotTestKv(): void {
  testKv = null;
}

export async function loadLpPersistentSnapshotForToken(
  tokenAddress: string,
): Promise<LpPersistentSnapshot | null> {
  return loadLpPersistentSnapshot(SCAN_CHAIN_ID, tokenAddress);
}
