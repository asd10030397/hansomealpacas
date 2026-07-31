/**
 * Phase 11E — interactive resolve + background incremental for Hook Position Index.
 * Does not block full Scan; Class A (posm_nft) skips primary path.
 * Phase 12A.1 — interactive reorg parity + honor generation fence failures.
 */

import {
  createPublicClient,
  http,
  type PublicClient,
} from "viem";
import { DEFAULT_RPC_URL, robinhoodChain } from "@/lib/chain";
import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import {
  DEFAULT_INTERACTIVE_BUDGET_MS,
} from "@/lib/hansome-score/lp/hook-position-index/abis";
import { createHookPosChainPort } from "@/lib/hansome-score/lp/hook-position-index/chain-port";
import {
  findHookPoolFixtureByPoolId,
  findHookPoolFixtureByToken,
  isHansomeClassAToken,
} from "@/lib/hansome-score/lp/hook-position-index/fixtures";
import {
  hookPosIndexKey,
  loadHookPosIndexProduction,
  saveHookPosIndexProduction,
  withHookPoolLock,
} from "@/lib/hansome-score/lp/hook-position-index/production-kv";
import { detectHookCheckpointHashMismatch, reorgRescanHookPositionIndex } from "@/lib/hansome-score/lp/hook-position-index/reorg";
import { buildHookPositionIndexSummary } from "@/lib/hansome-score/lp/hook-position-index/summary";
import {
  bootstrapHookPositionIndex,
  incrementalSyncHookPositionIndex,
  type HookPosChainPort,
  type HookSyncOptions,
} from "@/lib/hansome-score/lp/hook-position-index/sync";
import type {
  HookPositionIndexState,
  HookPositionIndexSummary,
} from "@/lib/hansome-score/lp/hook-position-index/types";

const backgroundInflight = new Set<string>();

export function clearHookPosBackgroundInflightForTests(): void {
  backgroundInflight.clear();
}

function defaultClient(): PublicClient {
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(DEFAULT_RPC_URL),
  });
}

function syncOptsFromFixture(params: {
  tokenAddress?: string;
  poolId?: string;
  interactiveBudgetMs?: number;
}): { opts: HookSyncOptions; key: string } | null {
  const fixture =
    (params.tokenAddress
      ? findHookPoolFixtureByToken(params.tokenAddress)
      : null) ??
    (params.poolId ? findHookPoolFixtureByPoolId(params.poolId) : null);
  if (!fixture) return null;

  const opts: HookSyncOptions = {
    chainId: SCAN_CHAIN_ID,
    poolId: fixture.poolId,
    hookAddress: fixture.hookAddress,
    positionManager: fixture.positionManager,
    poolManager: fixture.poolManager,
    createTx: fixture.createTx,
    createBlock: fixture.createBlock,
    indexForeign: false,
    interactiveBudgetMs:
      params.interactiveBudgetMs ?? DEFAULT_INTERACTIVE_BUDGET_MS,
    fixture,
  };
  const key = hookPosIndexKey({
    chainId: SCAN_CHAIN_ID,
    poolId: fixture.poolId,
  });
  return { opts, key };
}

export function scheduleHookPosIndexBackground(params: {
  key: string;
  port: HookPosChainPort;
  opts: HookSyncOptions;
  expectedGeneration?: string;
}): void {
  const { key } = params;
  if (backgroundInflight.has(key)) return;
  backgroundInflight.add(key);
  void (async () => {
    try {
      await withHookPoolLock(key, async () => {
        let existing: HookPositionIndexState | null = null;
        try {
          existing = await loadHookPosIndexProduction(key);
        } catch {
          existing = null;
        }
        const bgOpts: HookSyncOptions = {
          ...params.opts,
          interactiveBudgetMs: 25_000,
        };
        let next: HookPositionIndexState;
        if (existing && existing.positions.length > 0) {
          const mismatch = await detectHookCheckpointHashMismatch({
            port: params.port,
            state: existing,
          });
          if (mismatch) {
            next = (
              await reorgRescanHookPositionIndex({
                port: params.port,
                opts: bgOpts,
                existing,
              })
            ).state;
          } else {
            next = await incrementalSyncHookPositionIndex({
              port: params.port,
              opts: bgOpts,
              existing,
            });
          }
        } else {
          next = await bootstrapHookPositionIndex({
            port: params.port,
            opts: bgOpts,
            existing,
          });
        }
        const saved = await saveHookPosIndexProduction(key, next, {
          expectedGeneration:
            params.expectedGeneration ?? existing?.generation,
        });
        // Phase 12A.1 — never silently overwrite newer generations.
        if (!saved.ok) {
          console.warn(
            "[v4hook] background publish rejected (fence/retry):",
            saved.reason,
          );
        }
      });
    } catch (err) {
      console.warn("[v4hook] background sync failed:", err);
    } finally {
      backgroundInflight.delete(key);
    }
  })();
}

export type HookPosResolveResult = {
  summary: HookPositionIndexSummary | null;
  state: HookPositionIndexState | null;
  skipped: boolean;
  skipReason?: string;
  backgroundScheduled: boolean;
  error: string | null;
  /** Phase 12A.1 — generation fence rejected publish; caller may retry. */
  retryRequired?: boolean;
  publishOk?: boolean;
  fenceReason?: string;
};

/**
 * Resolve Hook Position Index for Class B pools only.
 * HANSOME / posm_nft → skip (no override).
 */
export async function resolveHookPositionIndex(params: {
  tokenAddress: string;
  ownershipClass: "posm_nft" | "hook_native" | "unknown" | null | undefined;
  poolId?: string | null;
  client?: PublicClient;
  interactiveBudgetMs?: number;
  /** When true, do not schedule background work. */
  disableBackground?: boolean;
}): Promise<HookPosResolveResult> {
  if (
    params.ownershipClass === "posm_nft" ||
    isHansomeClassAToken(params.tokenAddress)
  ) {
    return {
      summary: null,
      state: null,
      skipped: true,
      skipReason: "class_a_posm_nft",
      backgroundScheduled: false,
      error: null,
      publishOk: true,
    };
  }
  if (params.ownershipClass !== "hook_native") {
    return {
      summary: null,
      state: null,
      skipped: true,
      skipReason: "not_hook_native",
      backgroundScheduled: false,
      error: null,
      publishOk: true,
    };
  }

  const resolved = syncOptsFromFixture({
    tokenAddress: params.tokenAddress,
    poolId: params.poolId ?? undefined,
    interactiveBudgetMs: params.interactiveBudgetMs,
  });
  if (!resolved) {
    return {
      summary: null,
      state: null,
      skipped: true,
      skipReason: "pool_not_allowlisted",
      backgroundScheduled: false,
      error: null,
      publishOk: true,
    };
  }

  const { opts, key } = resolved;
  const port = createHookPosChainPort(params.client ?? defaultClient());

  try {
    return await withHookPoolLock(key, async () => {
      let existing: HookPositionIndexState | null = null;
      try {
        existing = await loadHookPosIndexProduction(key);
      } catch {
        existing = null;
      }

      const priorGeneration = existing?.generation;
      let state: HookPositionIndexState;
      if (existing && existing.positions.length > 0) {
        // Phase 12A.1 — interactive reorg parity with background path.
        const mismatch = await detectHookCheckpointHashMismatch({
          port,
          state: existing,
        });
        if (mismatch) {
          state = (
            await reorgRescanHookPositionIndex({
              port,
              opts,
              existing,
            })
          ).state;
        } else {
          state = await incrementalSyncHookPositionIndex({
            port,
            opts,
            existing,
          });
        }
      } else {
        state = await bootstrapHookPositionIndex({
          port,
          opts,
          existing,
        });
      }

      const saved = await saveHookPosIndexProduction(key, state, {
        expectedGeneration: priorGeneration,
      });

      if (!saved.ok) {
        // Never publish/overwrite newer gens — return durable prior + retry.
        let durable: HookPositionIndexState | null = existing;
        try {
          durable = (await loadHookPosIndexProduction(key)) ?? existing;
        } catch {
          durable = existing;
        }
        console.warn(
          "[v4hook] interactive publish rejected (fence/retry):",
          saved.reason,
        );
        return {
          summary: durable ? buildHookPositionIndexSummary(durable) : null,
          state: durable,
          skipped: false,
          backgroundScheduled: false,
          error: saved.reason ?? "generation_fence",
          retryRequired: true,
          publishOk: false,
          fenceReason: saved.reason,
        };
      }

      let backgroundScheduled = false;
      if (
        !params.disableBackground &&
        (!state.hookDiscoveryComplete ||
          state.terminalState === "SUCCESS_PARTIAL")
      ) {
        scheduleHookPosIndexBackground({
          key,
          port,
          opts,
          expectedGeneration: state.generation,
        });
        backgroundScheduled = true;
      }

      return {
        summary: buildHookPositionIndexSummary(state),
        state,
        skipped: false,
        backgroundScheduled,
        error: null,
        retryRequired: false,
        publishOk: true,
      };
    });
  } catch (err) {
    console.warn("[v4hook] resolve failed (non-blocking):", err);
    return {
      summary: null,
      state: null,
      skipped: false,
      backgroundScheduled: false,
      error: String((err as Error)?.message ?? err),
      publishOk: false,
      retryRequired: true,
    };
  }
}
