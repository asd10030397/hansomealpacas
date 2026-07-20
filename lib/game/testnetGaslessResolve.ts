/**
 * Testnet-only gasless resolve (reveal + seed + settle) via server relayer.
 * Commit salts are stored server-side — no localStorage dependency for resolve.
 */

import { GAME_CHAIN_ID } from "@/lib/game/hansomeGame";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/chain";
import { isSeedAlreadySetError } from "@/lib/game/missedReveal";
import type {
  TestnetResolveStage,
  TestnetResolveTimings,
} from "@/lib/game/testnetResolveStages";
import type { Hex } from "viem";

export const RELAYER_NOT_CONFIGURED_CODE = "RELAYER_NOT_CONFIGURED";

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

export type TestnetResolveStatus = {
  ok: boolean;
  enabled: boolean;
  relayerConfigured: boolean;
  canResolve: boolean;
  chainId?: number;
  game?: string | null;
  error?: string;
};

export type TestnetResolveResponse = {
  ok: boolean;
  enabled: boolean;
  day: number;
  /** True when distributor credits are fully written (isSettled). */
  alreadySettled?: boolean;
  /** True when finalizeDay has run (battle outcomes ready; credits may remain). */
  finalized?: boolean;
  /** Alias of finalized — battle outcomes ready for presentation. */
  battleReady?: boolean;
  /** Battle ready but creditBatch still in progress. */
  creditsPending?: boolean;
  /** Alias of alreadySettled. */
  fullySettled?: boolean;
  seedSkipped?: boolean;
  revealed?: number;
  revealTxHash?: Hex | null;
  seedTxHash?: Hex | null;
  /** Last finalizeDay or creditBatch tx in this pass. */
  settleTxHash?: Hex | null;
  vaultCount?: number;
  /** Pipeline stage after this pass (UX). */
  stage?: TestnetResolveStage;
  /** Per-step wall timings for this pass. */
  timings?: TestnetResolveTimings;
  relayerConfigured?: boolean;
  canResolve?: boolean;
  code?: string;
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

export function isRelayerNotConfiguredResponse(
  result: Pick<TestnetResolveResponse, "code" | "relayerConfigured" | "error">,
): boolean {
  if (result.relayerConfigured === false) return true;
  if (result.code === RELAYER_NOT_CONFIGURED_CODE) return true;
  const err = result.error ?? "";
  return (
    /relayer is not configured/i.test(err) ||
    /settlement service is temporarily unavailable/i.test(err)
  );
}

export async function fetchTestnetResolveStatus(): Promise<TestnetResolveStatus> {
  try {
    const res = await fetch("/api/game/testnet-resolve", {
      method: "GET",
      cache: "no-store",
    });
    const data = (await res.json()) as TestnetResolveStatus;
    return {
      ok: Boolean(data.ok),
      enabled: Boolean(data.enabled),
      relayerConfigured: Boolean(data.relayerConfigured),
      canResolve: Boolean(data.canResolve),
      chainId: data.chainId,
      game: data.game,
      error: data.error,
    };
  } catch (e) {
    return {
      ok: false,
      enabled: isTestnetGaslessResolveEnabled(),
      relayerConfigured: false,
      canResolve: false,
      error: e instanceof Error ? e.message : "status check failed",
    };
  }
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
    if (isRelayerNotConfiguredResponse(data)) {
      return {
        ok: false,
        enabled: data.enabled ?? true,
        day: body.day,
        relayerConfigured: false,
        canResolve: false,
        code: RELAYER_NOT_CONFIGURED_CODE,
        error: err,
      };
    }
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
      relayerConfigured: data.relayerConfigured,
      canResolve: data.canResolve,
      code: data.code,
      error: err,
      detail: data.detail,
    };
  }
  return data;
}
