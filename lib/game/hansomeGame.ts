import type { Address } from "viem";
import { robinhoodTestnetChain } from "@/lib/chain";
import {
  resolveHansomeGameAddress,
  resolveOptionalConfiguredAddress,
  GAME_ADDRESS_ENV_KEYS,
} from "@/lib/game/contractAddresses";

/** Same chain target as Genesis until mainnet game deploy. */
export const GAME_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_GAME_CHAIN_ID ?? robinhoodTestnetChain.id,
);

/**
 * Deployed HansomeGame — env only (NEXT_PUBLIC_HANSOME_GAME_ADDRESS).
 * No superseded Testnet defaults. Null when unset/invalid (UI shows unconfigured).
 */
export const HANSOME_GAME_ADDRESS: Address | null =
  resolveOptionalConfiguredAddress(GAME_ADDRESS_ENV_KEYS, "HansomeGame");

export function isHansomeGameConfigured(): boolean {
  return HANSOME_GAME_ADDRESS != null;
}

/** Resolve with explicit error (API / scripts). */
export function requireHansomeGameAddress(): Address {
  const r = resolveHansomeGameAddress();
  if (!r.ok) throw new Error(r.error);
  return r.address;
}
