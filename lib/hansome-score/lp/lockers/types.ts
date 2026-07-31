import type { Address, PublicClient } from "viem";
import { LP_LOCK_STATE_DISPLAY } from "@/lib/hansome-score/constants";
import type { VersionPoolHit } from "@/lib/hansome-score/lp/adapters/types";
import type { LockerAdapterId } from "@/lib/hansome-score/lp/registry";
import type { EvidenceLevel, V4PositionInfo } from "@/lib/hansome-score/types";

/**
 * Token-scoped locker discovery context.
 * Adapters must not invent lock from pool inventory alone.
 */
export type LockerDiscoveryContext = {
  tokenAddress: Address;
  client: PublicClient;
  /** Optional factory-discovered pools (hints for stub matching). */
  pools?: VersionPoolHit[];
};

/**
 * On-chain verified locked Position NFT from a registered locker adapter.
 * Only emit after ownership revalidation (e.g. NPM ownerOf == locker).
 */
export type VerifiedLockerPosition = {
  adapterId: LockerAdapterId;
  lockerName: string;
  lockerAddress: Address;
  /** Decimal Position NFT id (never a synthetic v3-pool: stub). */
  positionNftId: string;
  owner: Address;
  positionManager: Address;
  poolOrPair: string | null;
  fee: number | null;
  liquidity: string | null;
  tickLower: number | null;
  tickUpper: number | null;
  currency0: string | null;
  currency1: string | null;
  /** Null for permanent_null expiry policy — do not invent an unlock time. */
  unlockTimestamp: number | null;
  evidenceLevel: EvidenceLevel;
  dataSource: string;
};

export type LockerAdapter = {
  id: LockerAdapterId;
  /**
   * Discover verified locked positions for `tokenAddress`.
   * Return [] when the token is not registered with this locker, ownership
   * fails revalidation, or RPC fails — never soft-claim lock.
   */
  discoverPositionsForToken(
    ctx: LockerDiscoveryContext,
  ): Promise<VerifiedLockerPosition[]>;
};

/** Map a verified locker hit into the shared position slot shape. */
export function verifiedLockerToPositionInfo(
  v: VerifiedLockerPosition,
): V4PositionInfo {
  return {
    positionNftId: v.positionNftId,
    owner: v.owner,
    ownerLabel: v.lockerName,
    lockerName: v.lockerName,
    lockerAddress: v.lockerAddress,
    lockState: "LOCKED_VERIFIED_ONCHAIN",
    lockStateDisplay: LP_LOCK_STATE_DISPLAY.LOCKED_VERIFIED_ONCHAIN,
    unlockTimestamp: v.unlockTimestamp,
    unlockDateUtc:
      v.unlockTimestamp != null
        ? new Date(v.unlockTimestamp * 1000).toISOString()
        : null,
    lockCreatedAt: null,
    lockTxHash: null,
    liquidity: v.liquidity,
    amount0Raw: null,
    amount1Raw: null,
    valueUsd: null,
    poolId: v.poolOrPair,
    currency0: v.currency0,
    currency1: v.currency1,
    fee: v.fee,
    tickSpacing: null,
    tickLower: v.tickLower,
    tickUpper: v.tickUpper,
    currentTick: null,
    inRange: null,
    removableByEoa: false,
    evidenceLevel: v.evidenceLevel,
    dataSource: v.dataSource,
  };
}
