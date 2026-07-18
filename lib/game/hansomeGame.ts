import { getAddress, type Address, isAddress } from "viem";
import { robinhoodTestnetChain } from "@/lib/chain";

/** Same chain target as Genesis until mainnet game deploy. */
export const GAME_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_GAME_CHAIN_ID ?? robinhoodTestnetChain.id,
);

const rawGame =
  process.env.NEXT_PUBLIC_HANSOME_GAME_ADDRESS?.trim() ||
  process.env.NEXT_PUBLIC_GAME_ADDRESS?.trim() ||
  "";

/** Deployed HansomeGame — empty until env is set after testnet deploy. */
export const HANSOME_GAME_ADDRESS: Address | null =
  rawGame && isAddress(rawGame) ? getAddress(rawGame) : null;

export function isHansomeGameConfigured(): boolean {
  return HANSOME_GAME_ADDRESS != null;
}
