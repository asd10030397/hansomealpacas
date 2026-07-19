/**
 * Testnet-only gasless resolve (reveal + seed + settle) via server relayer.
 * Mainnet never enables this path — players keep signing `reveal()` themselves.
 */

import { GAME_CHAIN_ID } from "@/lib/game/hansomeGame";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/chain";
import type { Hex } from "viem";

export type TestnetRevealItem = {
  tokenId: number;
  locationId: number;
  salt: Hex;
};

export type TestnetResolveRequest = {
  day: number;
  reveals?: TestnetRevealItem[];
  fulfillSeed?: boolean;
  settle?: boolean;
};

export type TestnetResolveResponse = {
  ok: boolean;
  enabled: boolean;
  day: number;
  revealed?: number;
  revealTxHash?: Hex | null;
  seedTxHash?: Hex | null;
  settleTxHash?: Hex | null;
  error?: string;
  detail?: string;
};

/** Client: Testnet + not explicitly disabled. */
export function isTestnetGaslessResolveEnabled(): boolean {
  if (GAME_CHAIN_ID !== ROBINHOOD_TESTNET_CHAIN_ID) return false;
  const flag = process.env.NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE?.trim();
  if (flag === "0" || flag === "false") return false;
  return true;
}

export async function requestTestnetResolve(
  body: TestnetResolveRequest,
): Promise<TestnetResolveResponse> {
  const res = await fetch("/api/game/testnet-resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as TestnetResolveResponse;
  if (!res.ok) {
    return {
      ok: false,
      enabled: data.enabled ?? false,
      day: body.day,
      error: data.error ?? `HTTP ${res.status}`,
      detail: data.detail,
    };
  }
  return data;
}
