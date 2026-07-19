import { getAddress, type Address, isAddress } from "viem";
import { robinhoodTestnetChain } from "@/lib/chain";
import { GAME_CHAIN_ID } from "@/lib/game/hansomeGame";

/** Robinhood testnet RewardDistributor. Override via env. */
const DEFAULT_TESTNET_DISTRIBUTOR =
  "0xa67f13E39647b680FDa816c011a313f979F89212" as const;

const raw =
  process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS?.trim() ||
  process.env.NEXT_PUBLIC_DISTRIBUTOR_ADDRESS?.trim() ||
  (GAME_CHAIN_ID === robinhoodTestnetChain.id ? DEFAULT_TESTNET_DISTRIBUTOR : "");

export const REWARD_DISTRIBUTOR_ADDRESS: Address | null =
  raw && isAddress(raw) ? getAddress(raw) : null;

export function isRewardDistributorConfigured(): boolean {
  return REWARD_DISTRIBUTOR_ADDRESS != null;
}
