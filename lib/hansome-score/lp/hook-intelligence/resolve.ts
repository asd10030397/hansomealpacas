/**
 * Phase 11F/G/H orchestrator — keeps modules separate; shares index + protocol reads.
 * Non-blocking; failures must not break Scan / Titan / Score.
 */

import { createPublicClient, http, type PublicClient } from "viem";
import { DEFAULT_RPC_URL, robinhoodChain } from "@/lib/chain";
import {
  separateForeignLp,
  toPublicForeignLpSeparation,
  type HookForeignLpSeparation,
  type HookForeignLpSeparationPublic,
} from "@/lib/hansome-score/lp/hook-foreign-lp";
import {
  classifyHookPrincipalLock,
  readHookProtocolSnapshot,
  toPublicHookLockClassification,
  type HookLockClassification,
  type HookLockClassificationPublic,
  type HookProtocolSnapshot,
} from "@/lib/hansome-score/lp/hook-lock-classifier";
import {
  findHookPoolFixtureByToken,
  isHansomeClassAToken,
  resolveHookPositionIndex,
  type HookPositionIndexState,
} from "@/lib/hansome-score/lp/hook-position-index";
import {
  createHookValuationPort,
  toPublicHookValuationSummary,
  valueHookPositions,
  type HookPositionValuationPublic,
  type HookValuationResult,
} from "@/lib/hansome-score/lp/hook-position-valuer";
import type { TokenPriceBook } from "@/lib/hansome-score/lp/position-value";

export type HookIntelligenceResolveResult = {
  skipped: boolean;
  skipReason?: string;
  indexState: HookPositionIndexState | null;
  valuation: HookValuationResult | null;
  foreignSeparation: HookForeignLpSeparation | null;
  lockClassification: HookLockClassification | null;
  protocol: HookProtocolSnapshot | null;
  public: {
    hookPositionValuation: HookPositionValuationPublic | null;
    hookForeignLpSeparation: HookForeignLpSeparationPublic | null;
    hookLockClassification: HookLockClassificationPublic | null;
  };
  error: string | null;
};

function defaultClient(): PublicClient {
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(DEFAULT_RPC_URL),
  });
}

/**
 * Resolve Hook Native intelligence layers for Class B only.
 * Class A / HANSOME → skipped (no override of Titan path).
 */
export async function resolveHookIntelligence(params: {
  tokenAddress: string;
  ownershipClass: "posm_nft" | "hook_native" | "unknown" | null | undefined;
  poolId?: string | null;
  tokenDecimals?: number | null;
  priceBook?: TokenPriceBook | null;
  client?: PublicClient;
  interactiveBudgetMs?: number;
  disableBackground?: boolean;
  /** Preloaded index state (avoids duplicate 11E work). */
  indexState?: HookPositionIndexState | null;
}): Promise<HookIntelligenceResolveResult> {
  const empty = (
    skipReason: string,
  ): HookIntelligenceResolveResult => ({
    skipped: true,
    skipReason,
    indexState: null,
    valuation: null,
    foreignSeparation: null,
    lockClassification: null,
    protocol: null,
    public: {
      hookPositionValuation: null,
      hookForeignLpSeparation: null,
      hookLockClassification: null,
    },
    error: null,
  });

  if (
    params.ownershipClass === "posm_nft" ||
    isHansomeClassAToken(params.tokenAddress)
  ) {
    return empty("class_a_posm_nft");
  }
  if (params.ownershipClass !== "hook_native") {
    return empty("not_hook_native");
  }

  const fixture = findHookPoolFixtureByToken(params.tokenAddress);
  if (!fixture && !params.poolId && !params.indexState) {
    return empty("pool_not_allowlisted");
  }

  const client = params.client ?? defaultClient();

  try {
    let indexState = params.indexState ?? null;
    if (!indexState) {
      const idx = await resolveHookPositionIndex({
        tokenAddress: params.tokenAddress,
        ownershipClass: params.ownershipClass,
        poolId: params.poolId ?? fixture?.poolId,
        client,
        interactiveBudgetMs: params.interactiveBudgetMs ?? 3_500,
        disableBackground: params.disableBackground,
      });
      indexState = idx.state;
      if (!indexState) {
        return {
          ...empty(idx.skipReason ?? "index_unavailable"),
          skipped: idx.skipped,
          error: idx.error,
        };
      }
    }

    const poolId = indexState.poolId;
    const valuePort = createHookValuationPort(client);

    // 11F — valuation (separate module)
    const valuation = await valueHookPositions({
      index: indexState,
      port: valuePort,
      tokenAddress: params.tokenAddress,
      tokenDecimals: params.tokenDecimals ?? 18,
      priceBook: params.priceBook,
      currency0: fixture
        ? undefined
        : undefined,
    });

    // 11G — foreign separation (separate module)
    const foreignSeparation = separateForeignLp({
      index: indexState,
      valuations: valuation.positions,
      valuationSummary: valuation.summary,
      hookAddress: indexState.hookAddress ?? fixture?.hookAddress,
      positionManager: indexState.positionManager ?? fixture?.positionManager,
    });

    // 11H — protocol reads + classifier (separate module)
    const protocol = await readHookProtocolSnapshot({
      client,
      tokenAddress: params.tokenAddress,
      poolId,
      hookAddress: (indexState.hookAddress ??
        fixture?.hookAddress) as `0x${string}` | undefined,
    });

    const materialHookPrincipal =
      valuation.summary.activeHookOwnedPositionCount > 0 &&
      valuation.positions.some((p) => {
        if (p.classification !== "hook_owned" || !p.active) return false;
        try {
          return BigInt(p.liquidity) > 0n;
        } catch {
          return false;
        }
      });

    const lockClassification = classifyHookPrincipalLock({
      ownershipClass: params.ownershipClass,
      protocol,
      valuationSummary: valuation.summary,
      foreignSeparation,
      materialHookPrincipal,
    });

    return {
      skipped: false,
      indexState,
      valuation,
      foreignSeparation,
      lockClassification,
      protocol,
      public: {
        hookPositionValuation: toPublicHookValuationSummary(valuation.summary),
        hookForeignLpSeparation: toPublicForeignLpSeparation(foreignSeparation),
        hookLockClassification: toPublicHookLockClassification(lockClassification),
      },
      error: null,
    };
  } catch (err) {
    console.warn("[hook-intelligence] resolve failed:", err);
    return {
      skipped: false,
      skipReason: "resolve_failed",
      indexState: null,
      valuation: null,
      foreignSeparation: null,
      lockClassification: null,
      protocol: null,
      public: {
        hookPositionValuation: null,
        hookForeignLpSeparation: null,
        hookLockClassification: null,
      },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
