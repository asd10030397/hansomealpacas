/**
 * Phase 10C-2 — Verified V3 locker classification (post-discovery).
 *
 * Discovery (index / stubs) must already have attached positions.
 * This module NEVER invents Locked from owner-is-contract / name heuristics.
 * LOCKED_VERIFIED_ONCHAIN is emitted only when an approved adapter PASSes.
 */

import { getAddress, type Address, type PublicClient } from "viem";
import { LP_LOCK_STATE_DISPLAY } from "@/lib/hansome-score/constants";
import {
  findLockerByAddress,
  isKnownLockerAddress,
  type LockerAdapterId,
} from "@/lib/hansome-score/lp/registry";
import {
  verifiedLockerToPositionInfo,
  type VerifiedLockerPosition,
} from "@/lib/hansome-score/lp/lockers/types";
import type { LpLockState, V4PositionInfo } from "@/lib/hansome-score/types";

/** User-facing classification bucket (maps onto LpLockState). */
export type V3LockClass =
  | "LOCKED_VERIFIED"
  | "LOCKED_UNVERIFIED"
  | "UNLOCKED"
  | "UNABLE_TO_DETERMINE";

export type V3OwnerType =
  | "eoa"
  | "known_locker"
  | "unknown_contract"
  | "burned"
  | "unknown";

export function isSyntheticV3StubId(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith("v3-pool:"));
}

export function isMaterialLiquidity(liquidity: string | null | undefined): boolean {
  if (liquidity == null) return true;
  try {
    return BigInt(liquidity) > 0n;
  } catch {
    return true;
  }
}

/** Owner Type Resolver — address book + contract flag only; never lock truth. */
export function resolveV3OwnerType(params: {
  owner: string | null | undefined;
  isContract: boolean | null;
  burned?: boolean;
}): V3OwnerType {
  if (params.burned) return "burned";
  if (!params.owner) return "unknown";
  if (isKnownLockerAddress(params.owner)) return "known_locker";
  if (params.isContract === true) return "unknown_contract";
  if (params.isContract === false) return "eoa";
  return "unknown";
}

/**
 * Map matrix outcome → Production LpLockState.
 * LOCKED_UNVERIFIED is reserved; this phase maps known-locker adapter FAIL → UNABLE.
 */
export function v3LockClassToLpLockState(c: V3LockClass): LpLockState {
  switch (c) {
    case "LOCKED_VERIFIED":
      return "LOCKED_VERIFIED_ONCHAIN";
    case "UNLOCKED":
      return "UNLOCKED_EOA_CONTROLLED";
    case "LOCKED_UNVERIFIED":
      return "LOCK_DETECTED_EXPIRY_UNKNOWN";
    case "UNABLE_TO_DETERMINE":
    default:
      return "UNABLE_TO_DETERMINE";
  }
}

/**
 * Matrix (adapter verification required for Locked):
 * - adapter PASS → LOCKED_VERIFIED
 * - known locker + adapter FAIL → UNABLE_TO_DETERMINE
 * - unknown contract → UNABLE_TO_DETERMINE
 * - EOA → UNLOCKED (existing unlocked semantics)
 * - burned → UNABLE (historical; never unlocked)
 */
export function classifyV3PositionLock(params: {
  ownerType: V3OwnerType;
  adapterPass: boolean;
  /** Zero-liquidity rows are non-material; keep Unknown (not unlocked). */
  zeroLiquidity?: boolean;
}): V3LockClass {
  if (params.ownerType === "burned") return "UNABLE_TO_DETERMINE";
  if (params.zeroLiquidity) return "UNABLE_TO_DETERMINE";
  if (params.adapterPass) return "LOCKED_VERIFIED";
  if (params.ownerType === "known_locker") return "UNABLE_TO_DETERMINE";
  if (params.ownerType === "unknown_contract") return "UNABLE_TO_DETERMINE";
  if (params.ownerType === "eoa") return "UNLOCKED";
  return "UNABLE_TO_DETERMINE";
}

async function readIsContract(
  client: PublicClient | undefined,
  owner: string | null | undefined,
): Promise<boolean | null> {
  if (!client || !owner) return null;
  try {
    const code = await client.getBytecode({
      address: getAddress(owner) as Address,
    });
    if (code == null) return null;
    return code !== "0x" && code.length > 2;
  } catch {
    return null;
  }
}

function applyClassToPosition(
  base: V4PositionInfo,
  lockClass: V3LockClass,
  opts?: {
    verified?: VerifiedLockerPosition;
    lockerName?: string | null;
    lockerAddress?: string | null;
  },
): V4PositionInfo {
  // Adapter PASS: overlay verified lock fields onto discovery slot.
  // Preserve index-attached amounts/ticks/liquidity — do not replace the row.
  if (opts?.verified) {
    const v = verifiedLockerToPositionInfo(opts.verified);
    return {
      ...base,
      owner: v.owner ?? base.owner,
      ownerLabel: v.ownerLabel,
      lockerName: v.lockerName,
      lockerAddress: v.lockerAddress,
      lockState: v.lockState,
      lockStateDisplay: v.lockStateDisplay,
      unlockTimestamp: v.unlockTimestamp,
      unlockDateUtc: v.unlockDateUtc,
      removableByEoa: false,
      evidenceLevel: v.evidenceLevel,
      dataSource: `${base.dataSource} + ${v.dataSource}`,
      // Prefer adapter-confirmed identity fields when discovery left them null.
      poolId: base.poolId ?? v.poolId,
      fee: base.fee ?? v.fee,
      tickLower: base.tickLower ?? v.tickLower,
      tickUpper: base.tickUpper ?? v.tickUpper,
      liquidity: base.liquidity ?? v.liquidity,
      currency0: base.currency0 ?? v.currency0,
      currency1: base.currency1 ?? v.currency1,
    };
  }
  const lockState = v3LockClassToLpLockState(lockClass);
  const removableByEoa =
    lockClass === "UNLOCKED"
      ? true
      : lockClass === "LOCKED_VERIFIED" || lockClass === "LOCKED_UNVERIFIED"
        ? false
        : null;
  const locker = opts?.lockerAddress
    ? findLockerByAddress(opts.lockerAddress)
    : base.owner
      ? findLockerByAddress(base.owner)
      : null;
  return {
    ...base,
    lockState,
    lockStateDisplay: LP_LOCK_STATE_DISPLAY[lockState],
    removableByEoa,
    lockerName: opts?.lockerName ?? locker?.name ?? base.lockerName,
    lockerAddress:
      (opts?.lockerAddress as Address | null | undefined) ??
      locker?.managerAddress ??
      base.lockerAddress,
    ownerLabel:
      lockClass === "UNLOCKED"
        ? "EOA"
        : locker?.name ?? base.ownerLabel,
    evidenceLevel:
      lockClass === "LOCKED_VERIFIED"
        ? "on_chain_verified"
        : lockClass === "UNLOCKED"
          ? "on_chain_verified"
          : base.evidenceLevel,
    dataSource:
      lockClass === "UNLOCKED"
        ? `${base.dataSource} + v3_lock_classify:eoa`
        : lockClass === "UNABLE_TO_DETERMINE" && locker
          ? `${base.dataSource} + v3_lock_classify:known_locker_unverified`
          : `${base.dataSource} + v3_lock_classify:${lockClass.toLowerCase()}`,
  };
}

/**
 * Classify discovered V3 positions after index/stub attachment.
 * Per-position; never promotes Locked without adapter PASS.
 */
export async function classifyDiscoveredV3Positions(params: {
  discovered: V4PositionInfo[];
  verifiedHits: VerifiedLockerPosition[];
  client?: PublicClient;
  /** Approved adapter ids (for future multi-locker compat). */
  approvedAdapterIds?: ReadonlySet<LockerAdapterId>;
}): Promise<{
  positions: V4PositionInfo[];
  lockAnalysisComplete: boolean;
  classifiedMaterial: number;
  verifiedLocked: number;
}> {
  const verifiedById = new Map<string, VerifiedLockerPosition>();
  const verifiedByPool = new Map<string, VerifiedLockerPosition[]>();
  for (const hit of params.verifiedHits) {
    verifiedById.set(hit.positionNftId, hit);
    if (hit.poolOrPair) {
      const k = hit.poolOrPair.toLowerCase();
      const list = verifiedByPool.get(k) ?? [];
      list.push(hit);
      verifiedByPool.set(k, list);
    }
  }

  const owners = new Set<string>();
  for (const p of params.discovered) {
    if (p.owner && !isSyntheticV3StubId(p.positionNftId)) {
      owners.add(getAddress(p.owner));
    }
  }
  const contractFlags = new Map<string, boolean | null>();
  await Promise.all(
    [...owners].map(async (owner) => {
      contractFlags.set(owner.toLowerCase(), await readIsContract(params.client, owner));
    }),
  );

  const out: V4PositionInfo[] = [];
  const seenIds = new Set<string>();
  const poolsWithStub = new Set<string>();
  const poolsReplacedByVerified = new Set<string>();
  let classifiedMaterial = 0;
  let verifiedLocked = 0;

  for (const pos of params.discovered) {
    const id = pos.positionNftId;
    if (isSyntheticV3StubId(id)) {
      const poolKey = pos.poolId?.toLowerCase() ?? "";
      const hits = poolKey ? verifiedByPool.get(poolKey) : undefined;
      if (hits && hits.length > 0) {
        // Cold path: discovery still on stub; approved adapter supplies verified NFT(s).
        poolsReplacedByVerified.add(poolKey);
        for (const hit of hits) {
          if (seenIds.has(hit.positionNftId)) continue;
          seenIds.add(hit.positionNftId);
          out.push(verifiedLockerToPositionInfo(hit));
          classifiedMaterial++;
          verifiedLocked++;
        }
        continue;
      }
      if (poolKey) poolsWithStub.add(poolKey);
      if (!seenIds.has(id)) {
        seenIds.add(id);
        out.push(pos);
      }
      continue;
    }

    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const hit = verifiedById.get(id);
    const burned =
      !pos.owner &&
      (pos.dataSource?.includes("burned") || pos.lockState === "UNABLE_TO_DETERMINE") &&
      pos.liquidity === "0";
    // Prefer explicit: missing owner + non-synthetic after attach often means burned skipped;
    // treat null owner on real id as unable (never unlocked).
    const ownerMissing = !pos.owner;
    const zeroLiq = !isMaterialLiquidity(pos.liquidity);
    const ownerLc = pos.owner ? getAddress(pos.owner).toLowerCase() : "";
    const isContract = ownerLc ? (contractFlags.get(ownerLc) ?? null) : null;
    const ownerType = resolveV3OwnerType({
      owner: pos.owner,
      isContract,
      burned: ownerMissing || burned,
    });

    const adapterPass = Boolean(hit);
    const lockClass = classifyV3PositionLock({
      ownerType: ownerMissing ? "burned" : ownerType,
      adapterPass,
      zeroLiquidity: zeroLiq,
    });

    if (isMaterialLiquidity(pos.liquidity)) classifiedMaterial++;
    if (lockClass === "LOCKED_VERIFIED") verifiedLocked++;

    out.push(
      applyClassToPosition(pos, lockClass, {
        verified: hit,
        lockerName: hit?.lockerName,
        lockerAddress: hit?.lockerAddress ?? pos.owner,
      }),
    );
  }

  // Adapter-only hits not already present (e.g. stub-less edge) — still require PASS evidence.
  for (const hit of params.verifiedHits) {
    if (seenIds.has(hit.positionNftId)) continue;
    seenIds.add(hit.positionNftId);
    out.push(verifiedLockerToPositionInfo(hit));
    classifiedMaterial++;
    verifiedLocked++;
    if (hit.poolOrPair) {
      poolsReplacedByVerified.add(hit.poolOrPair.toLowerCase());
      poolsWithStub.delete(hit.poolOrPair.toLowerCase());
    }
  }

  // Analysis complete when no material synthetic stubs remain unresolved.
  const unresolvedStubs = [...poolsWithStub].filter(
    (p) => !poolsReplacedByVerified.has(p),
  );
  const lockAnalysisComplete = unresolvedStubs.length === 0;

  return {
    positions: out,
    lockAnalysisComplete,
    classifiedMaterial,
    verifiedLocked,
  };
}
