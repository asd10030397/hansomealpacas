import { getAddress, type Address, isAddress } from "viem";
import {
  PONS_LAUNCH_LOCKER,
  POSITION_MANAGER_ADDRESS,
  TITAN_LOCKER_MANAGER,
} from "@/lib/hansome-score/constants";
import type { LpLockState } from "@/lib/hansome-score/types";

/** Titan (v4) + PonsLaunchLocker (v3 NPM, Phase 10C-2 verified classification). */
export type LockerAdapterId = "titan_v2" | "pons_launch";

/**
 * How missing / absent unlock time is classified when the Position NFT owner
 * is this known locker.
 *
 * - timed: unlock timestamp expected from locker data (Titan). Null expiry →
 *   LOCK_DETECTED_EXPIRY_UNKNOWN (do not invent permanence).
 * - permanent_null: ABI has no unlock/withdraw LP path (Pons). Registry membership
 *   alone → UNABLE_TO_DETERMINE. Adapter PASS required for LOCKED_VERIFIED.
 */
export type LockerExpiryPolicy = "timed" | "permanent_null";

export type KnownLocker = {
  id: LockerAdapterId;
  name: string;
  managerAddress: Address;
  /** Child / escrow contracts known to hold Position NFTs for this locker family. */
  knownChildAddresses: Address[];
  expiryPolicy: LockerExpiryPolicy;
};

/**
 * Generic RH locker allowlist. Add adapters here without rewriting the scanner.
 * Phase 10C-2: Titan (v4 timed) + PonsLaunchLocker (v3 permanent_null).
 * V3 Locked requires adapter PASS — registry membership alone must not invent lock.
 */
export const LOCKER_REGISTRY: KnownLocker[] = [
  {
    id: "titan_v2",
    name: "TitanLockerManagerV2",
    managerAddress: TITAN_LOCKER_MANAGER,
    knownChildAddresses: [
      // Historical Titan child that held HANSOME #47299 — still validated via ownerOf + getTokenLockData
      getAddress("0x4a50761042e321F214b6B6c2920F9eA1C5533828") as Address,
    ],
    expiryPolicy: "timed",
  },
  {
    id: "pons_launch",
    name: "PonsLaunchLocker",
    managerAddress: PONS_LAUNCH_LOCKER,
    knownChildAddresses: [],
    expiryPolicy: "permanent_null",
  },
];

export function findLockerByAddress(address: string | null | undefined): KnownLocker | null {
  if (!address || !isAddress(address)) return null;
  const lc = getAddress(address).toLowerCase();
  for (const locker of LOCKER_REGISTRY) {
    if (locker.managerAddress.toLowerCase() === lc) return locker;
    if (locker.knownChildAddresses.some((c) => c.toLowerCase() === lc)) return locker;
  }
  return null;
}

export function isKnownLockerAddress(address: string | null | undefined): boolean {
  return findLockerByAddress(address) != null;
}

export function classifyOwnerLockState(params: {
  owner: string | null;
  unlockTimestamp: number | null;
  isContract: boolean | null;
}): LpLockState {
  const { owner, unlockTimestamp, isContract } = params;
  if (!owner) return "UNABLE_TO_DETERMINE";

  const locker = findLockerByAddress(owner);
  if (locker) {
    // permanent_null (Pons): registry membership alone must NOT invent Locked.
    // Phase 10C-2 requires approved adapter PASS → LOCKED_VERIFIED via classify-v3.
    if (locker.expiryPolicy === "permanent_null") {
      return "UNABLE_TO_DETERMINE";
    }
    if (unlockTimestamp != null && unlockTimestamp > 0) {
      const now = Math.floor(Date.now() / 1000);
      if (now < unlockTimestamp) return "LOCKED_VERIFIED_ONCHAIN";
      // Unlock time passed — treat as able to withdraw via locker path / unknown control
      return "LOCK_DETECTED_EXPIRY_UNKNOWN";
    }
    return "LOCK_DETECTED_EXPIRY_UNKNOWN";
  }

  // Contract owner not in registry
  if (isContract === true) {
    return "UNSUPPORTED_LOCKER";
  }

  // EOA or unknown (assume EOA-controlled when not a contract)
  if (isContract === false || isContract == null) {
    // If bytecode check failed, still prefer UNABLE over falsely labeling unlocked when address looks like contract — handled by caller
    return "UNLOCKED_EOA_CONTROLLED";
  }

  return "UNABLE_TO_DETERMINE";
}

export { POSITION_MANAGER_ADDRESS, TITAN_LOCKER_MANAGER };
