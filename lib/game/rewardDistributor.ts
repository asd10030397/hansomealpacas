import type { Address } from "viem";
import {
  DISTRIBUTOR_ADDRESS_ENV_KEYS,
  resolveOptionalConfiguredAddress,
  resolveRewardDistributorAddress,
} from "@/lib/game/contractAddresses";

/**
 * RewardDistributor — env only (NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS).
 * No superseded Testnet defaults. May be null; UI can fall back to game.distributor().
 */
export const REWARD_DISTRIBUTOR_ADDRESS: Address | null =
  resolveOptionalConfiguredAddress(
    DISTRIBUTOR_ADDRESS_ENV_KEYS,
    "RewardDistributor",
  );

export function isRewardDistributorConfigured(): boolean {
  return REWARD_DISTRIBUTOR_ADDRESS != null;
}

export function requireRewardDistributorAddress(): Address {
  const r = resolveRewardDistributorAddress();
  if (!r.ok) throw new Error(r.error);
  return r.address;
}
