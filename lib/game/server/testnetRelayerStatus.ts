/**
 * Server-only Testnet relayer configuration helpers.
 * Never import from client components — keeps private keys off the browser bundle.
 */

import { isHex, type Hex } from "viem";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/chain";
import { GAME_CHAIN_ID, HANSOME_GAME_ADDRESS } from "@/lib/game/hansomeGame";

export const RELAYER_NOT_CONFIGURED_CODE = "RELAYER_NOT_CONFIGURED" as const;

/**
 * Read the dedicated Testnet gasless relayer key only.
 * Never falls back to DEPLOYER / TREASURY / PRIVATE_KEY / owner wallets.
 * Never log or return the raw value to API clients.
 */
export function readRelayerPrivateKey(): Hex | null {
  const raw = process.env.GAME_TESTNET_RELAYER_PRIVATE_KEY?.trim() || "";
  if (!raw) return null;
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  return isHex(key) && key.length === 66 ? key : null;
}

export function isRelayerConfigured(): boolean {
  return readRelayerPrivateKey() != null;
}

export function isTestnetGaslessFeatureEnabled(): boolean {
  if (GAME_CHAIN_ID !== ROBINHOOD_TESTNET_CHAIN_ID) return false;
  const flag = process.env.NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE?.trim();
  if (flag === "0" || flag === "false") return false;
  return Boolean(HANSOME_GAME_ADDRESS);
}

/** Public, safe copy — never includes env var names or key material. */
export function relayerUnavailableMessage(): string {
  if (process.env.NODE_ENV === "production") {
    return "Battle settlement service is temporarily unavailable.";
  }
  return "Testnet relayer is not configured on this server.";
}

export type TestnetResolveStatusPayload = {
  ok: true;
  enabled: boolean;
  relayerConfigured: boolean;
  canResolve: boolean;
  chainId: number;
  game: string | null;
  error?: string;
};

export function buildTestnetResolveStatus(): TestnetResolveStatusPayload {
  const enabled = isTestnetGaslessFeatureEnabled();
  const relayerConfigured = isRelayerConfigured();
  const canResolve = enabled && relayerConfigured;
  return {
    ok: true,
    enabled,
    relayerConfigured,
    canResolve,
    chainId: GAME_CHAIN_ID,
    game: HANSOME_GAME_ADDRESS,
    ...(relayerConfigured
      ? {}
      : enabled
        ? { error: relayerUnavailableMessage() }
        : {}),
  };
}
