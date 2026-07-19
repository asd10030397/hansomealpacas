/**
 * Testnet-only gasless resolve (reveal + seed + settle) via server relayer.
 * Commit salts are stored server-side — no localStorage dependency for resolve.
 */

import { GAME_CHAIN_ID } from "@/lib/game/hansomeGame";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/chain";
import { isSeedAlreadySetError } from "@/lib/game/missedReveal";
import type { Hex } from "viem";

export type TestnetRevealItem = {
  tokenId: number;
  locationId: number;
  salt: Hex;
};

export type TestnetResolveRequest = {
  day: number;
  /** Optional; server vault is the source of truth when gasless is on. */
  reveals?: TestnetRevealItem[];
  fulfillSeed?: boolean;
  settle?: boolean;
};

export type TestnetResolveResponse = {
  ok: boolean;
  enabled: boolean;
  day: number;
  alreadySettled?: boolean;
  seedSkipped?: boolean;
  revealed?: number;
  revealTxHash?: Hex | null;
  seedTxHash?: Hex | null;
  settleTxHash?: Hex | null;
  vaultCount?: number;
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

export async function uploadTestnetCommitSecret(input: {
  tokenId: number;
  day: number;
  locationId: number;
  salt: Hex;
  commitHash: Hex;
  wallet: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/game/testnet-commit-secret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "upload commit secret failed",
    };
  }
}

export async function requestTestnetResolve(
  body: TestnetResolveRequest,
): Promise<TestnetResolveResponse> {
  const res = await fetch("/api/game/testnet-resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: TestnetResolveResponse;
  try {
    data = (await res.json()) as TestnetResolveResponse;
  } catch {
    return {
      ok: false,
      enabled: false,
      day: body.day,
      error: `HTTP ${res.status} (non-JSON — rebuild/restart Next if route 404)`,
    };
  }
  if (!res.ok) {
    const err = data.error ?? `HTTP ${res.status}`;
    // Stale builds / races: SeedAlreadySet is success — continue to settle/result.
    if (isSeedAlreadySetError(err) || /AlreadySettled/i.test(err)) {
      return {
        ok: true,
        enabled: data.enabled ?? true,
        day: body.day,
        alreadySettled: /AlreadySettled/i.test(err),
        seedSkipped: isSeedAlreadySetError(err),
        revealed: data.revealed ?? 0,
        revealTxHash: data.revealTxHash ?? null,
        seedTxHash: data.seedTxHash ?? null,
        settleTxHash: data.settleTxHash ?? null,
        vaultCount: data.vaultCount,
      };
    }
    return {
      ok: false,
      enabled: data.enabled ?? false,
      day: body.day,
      error: err,
      detail: data.detail,
    };
  }
  return data;
}
