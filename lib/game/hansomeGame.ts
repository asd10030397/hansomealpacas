import { getAddress, type Address, isAddress } from "viem";
import { robinhoodTestnetChain } from "@/lib/chain";

/** Same chain target as Genesis until mainnet game deploy. */
export const GAME_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_GAME_CHAIN_ID ?? robinhoodTestnetChain.id,
);

/** Robinhood testnet HansomeGame (tHANSOME-backed suite). Override via env. */
const DEFAULT_TESTNET_GAME =
  "0x7b2ce5ECD270Ce55Ac94aCe3BF12d83ef113D0a0" as const;

const rawGame =
  process.env.NEXT_PUBLIC_HANSOME_GAME_ADDRESS?.trim() ||
  process.env.NEXT_PUBLIC_GAME_ADDRESS?.trim() ||
  (GAME_CHAIN_ID === robinhoodTestnetChain.id ? DEFAULT_TESTNET_GAME : "");

/** Deployed HansomeGame — testnet default when chain is Robinhood Testnet. */
export const HANSOME_GAME_ADDRESS: Address | null =
  rawGame && isAddress(rawGame) ? getAddress(rawGame) : null;

export function isHansomeGameConfigured(): boolean {
  return HANSOME_GAME_ADDRESS != null;
}
