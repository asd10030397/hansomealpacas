import { getAddress, type Address, isAddress } from "viem";

const raw =
  process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS?.trim() ||
  process.env.NEXT_PUBLIC_DISTRIBUTOR_ADDRESS?.trim() ||
  "";

export const REWARD_DISTRIBUTOR_ADDRESS: Address | null =
  raw && isAddress(raw) ? getAddress(raw) : null;

export function isRewardDistributorConfigured(): boolean {
  return REWARD_DISTRIBUTOR_ADDRESS != null;
}
