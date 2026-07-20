import type { Address } from "viem";
import {
  resolveHansomeGameAddress,
  resolveOptionalConfiguredAddress,
  GAME_ADDRESS_ENV_KEYS,
} from "@/lib/game/contractAddresses";
import { resolveGameChainId } from "@/lib/game/gameNetwork";

/** Game chain from NEXT_PUBLIC_GAME_CHAIN_ID (defaults Testnet until Mainnet cutover). */
export const GAME_CHAIN_ID = resolveGameChainId();

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
