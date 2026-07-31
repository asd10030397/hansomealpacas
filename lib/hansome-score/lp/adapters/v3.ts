import {
  createPublicClient,
  getAddress,
  http,
  type Address,
  type PublicClient,
} from "viem";
import { DEFAULT_RPC_URL, robinhoodChain } from "@/lib/chain";
import {
  RH_QUOTE_TOKEN_LIST,
  UNISWAP_RH_DEPLOYMENTS,
  V3_FEE_TIERS,
} from "@/lib/hansome-score/lp/deployments";
import {
  syntheticUnknownPosition,
  type VersionDiscoveryResult,
  type VersionPoolHit,
} from "@/lib/hansome-score/lp/adapters/types";
import {
  classifyPoolInventoryMateriality,
  isPresentationMaterial,
  type PoolInventoryMateriality,
} from "@/lib/hansome-score/lp/pool-materiality";
import {
  classifyDiscoveredV3Positions,
  discoverV3LockerPositions,
  isSyntheticV3StubId,
} from "@/lib/hansome-score/lp/lockers";
import { resolveV3PositionsFromIndex } from "@/lib/hansome-score/lp/v3-position-index/production";
import type { V4PositionInfo } from "@/lib/hansome-score/types";

const getPoolAbi = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    outputs: [{ type: "address" }],
  },
] as const;

const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

function client(): PublicClient {
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL?.trim() || DEFAULT_RPC_URL, {
      timeout: 20_000,
    }),
  });
}

const ZERO = "0x0000000000000000000000000000000000000000";

async function readBalance(
  c: PublicClient,
  token: Address,
  account: Address,
): Promise<bigint | null> {
  try {
    return (await c.readContract({
      address: token,
      abi: erc20BalanceAbi,
      functionName: "balanceOf",
      args: [account],
    })) as bigint;
  } catch {
    return null;
  }
}

function countByMateriality(
  pools: VersionPoolHit[],
): Record<PoolInventoryMateriality, number> {
  const out: Record<PoolInventoryMateriality, number> = {
    material: 0,
    dust: 0,
    inventory_unknown: 0,
  };
  for (const p of pools) {
    const m = p.materiality ?? "inventory_unknown";
    out[m] += 1;
  }
  return out;
}

function syntheticStubId(pool: string, fee: number): string {
  return `v3-pool:${getAddress(pool)}:${fee}`;
}

/**
 * Merge verified locker positions over synthetic stubs.
 * - Real NFT replaces stub for the same pool (and matching fee when known).
 * - Unmatched stubs remain Unknown (honest incomplete).
 * - Never invent lock from pool inventory alone.
 */
export function mergeV3LockerPositions(params: {
  stubs: V4PositionInfo[];
  verified: V4PositionInfo[];
}): V4PositionInfo[] {
  const { stubs, verified } = params;
  if (verified.length === 0) return stubs;

  const resolvedPools = new Set<string>();
  for (const v of verified) {
    if (v.poolId) resolvedPools.add(v.poolId.toLowerCase());
  }

  const remainingStubs = stubs.filter((s) => {
    if (!s.poolId) return true;
    return !resolvedPools.has(s.poolId.toLowerCase());
  });

  return [...verified, ...remainingStubs];
}

/** Soft wall for factory+index so a slow RPC path cannot starve Pons classify. */
export const V3_FACTORY_INDEX_SOFT_MS = 45_000;

/**
 * Uniswap v3 adapter — pool discovery via factory.getPool (fee × quote),
 * then pool-scoped V3 Position Index (Phase 10C-1) for numeric NPM tokenIds,
 * then Phase 10C-2 verified locker classification (Pons only).
 * Discovery and lock classification are intentionally separate.
 *
 * Phase 10C-3: Pons adapter runs in parallel with factory/index and is awaited
 * even when factory/index hits a soft wall (remote BEER regression).
 */
export async function discoverV3Liquidity(params: {
  tokenAddress: string;
  client?: PublicClient;
  /** Test / offline warm: allow inline historical backfill. */
  allowInlineV3PosBackfill?: boolean;
  interactiveV3PosBudgetMs?: number;
  /** Override factory+index soft wall (tests). */
  factoryIndexSoftMs?: number;
}): Promise<VersionDiscoveryResult> {
  const dep = UNISWAP_RH_DEPLOYMENTS.v3;
  const c = params.client ?? client();
  const token = getAddress(params.tokenAddress) as Address;
  const softMs = params.factoryIndexSoftMs ?? V3_FACTORY_INDEX_SOFT_MS;
  const t0 = Date.now();

  // Phase 10C-3: start Pons (token-scoped) immediately — does not need pool list.
  const lockerHitsPromise = discoverV3LockerPositions({
    tokenAddress: token,
    client: c,
    pools: [],
  });

  const factoryAndIndexPromise = (async () => {
    const pools: VersionDiscoveryResult["pools"] = [];
    const stubs: V4PositionInfo[] = [];
    const seen = new Set<string>();
    let factoryError: string | null = null;

    try {
      for (const quote of RH_QUOTE_TOKEN_LIST) {
        if (Date.now() - t0 >= softMs) break;
        if (quote.toLowerCase() === token.toLowerCase()) continue;
        for (const fee of V3_FEE_TIERS) {
          if (Date.now() - t0 >= softMs) break;
          let pool: Address;
          try {
            pool = (await c.readContract({
              address: dep.factory,
              abi: getPoolAbi,
              functionName: "getPool",
              args: [token, quote, fee],
            })) as Address;
          } catch {
            continue;
          }
          if (!pool || pool.toLowerCase() === ZERO) continue;
          const key = getAddress(pool).toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);

          const tokenBal = await readBalance(c, token, pool);
          const quoteBal = await readBalance(c, quote, pool);
          const materiality = classifyPoolInventoryMateriality({
            tokenBalance: tokenBal,
            quoteBalance: quoteBal,
          });

          pools.push({
            version: "v3",
            poolOrPair: getAddress(pool),
            quoteToken: quote,
            fee,
            tokenBalanceRaw: tokenBal?.toString() ?? null,
            quoteBalanceRaw: quoteBal?.toString() ?? null,
            materiality,
          });

          if (!isPresentationMaterial(materiality)) continue;

          stubs.push(
            syntheticUnknownPosition({
              id: syntheticStubId(pool, fee),
              version: "v3",
              poolOrPair: getAddress(pool),
              currency0: token,
              currency1: quote,
              fee,
              dataSource:
                "uniswap_v3_factory.getPool — NPM position/locker enumeration incomplete",
            }),
          );
        }
      }
    } catch (e) {
      factoryError = e instanceof Error ? e.message : "unknown";
    }

    const materialPools = pools.filter((p) =>
      isPresentationMaterial(p.materiality ?? "inventory_unknown"),
    );
    let indexResolved = {
      positions: stubs as V4PositionInfo[],
      positionDiscoveryComplete: materialPools.length === 0,
      positionDiscoverySource: null as string | null,
      positionDiscoveryFromBlock: null as number | null,
      positionDiscoveryToBlock: null as number | null,
      positionDiscoveryCheckpoint: null as string | null,
      progressActions: [] as string[],
      anyBackgroundScheduled: false,
    };

    const indexBudget = Math.max(
      500,
      Math.min(
        params.interactiveV3PosBudgetMs ?? 2_500,
        softMs - (Date.now() - t0),
      ),
    );
    if (Date.now() - t0 < softMs && materialPools.length > 0) {
      try {
        const resolved = await resolveV3PositionsFromIndex({
          client: c,
          materialPools,
          stubs,
          allowInlineBackfill: params.allowInlineV3PosBackfill,
          interactiveBudgetMs: indexBudget,
        });
        indexResolved = {
          positions: resolved.positions,
          positionDiscoveryComplete: resolved.positionDiscoveryComplete,
          positionDiscoverySource: resolved.positionDiscoverySource,
          positionDiscoveryFromBlock: resolved.positionDiscoveryFromBlock,
          positionDiscoveryToBlock: resolved.positionDiscoveryToBlock,
          positionDiscoveryCheckpoint: resolved.positionDiscoveryCheckpoint,
          progressActions: resolved.progressActions,
          anyBackgroundScheduled: resolved.anyBackgroundScheduled,
        };
      } catch {
        indexResolved = {
          positions: stubs,
          positionDiscoveryComplete: false,
          positionDiscoverySource: "v3_position_index:error",
          positionDiscoveryFromBlock: null,
          positionDiscoveryToBlock: null,
          positionDiscoveryCheckpoint: null,
          progressActions: ["v3_position_index_fallback_stub"],
          anyBackgroundScheduled: false,
        };
      }
    }

    return { pools, stubs, indexResolved, factoryError, softCapped: Date.now() - t0 >= softMs };
  })();

  // Never let factory/index exceed soft wall before we classify Pons hits.
  let softTimer: ReturnType<typeof setTimeout> | undefined;
  const factoryPack = await Promise.race([
    factoryAndIndexPromise.finally(() => {
      if (softTimer) clearTimeout(softTimer);
    }),
    new Promise<Awaited<typeof factoryAndIndexPromise>>((resolve) => {
      softTimer = setTimeout(() => {
        resolve({
          pools: [],
          stubs: [],
          indexResolved: {
            positions: [],
            positionDiscoveryComplete: false,
            positionDiscoverySource: "v3_factory_index_soft_wall",
            positionDiscoveryFromBlock: null,
            positionDiscoveryToBlock: null,
            positionDiscoveryCheckpoint: null,
            progressActions: ["v3_position_index_fallback_stub"],
            anyBackgroundScheduled: false,
          },
          factoryError: null,
          softCapped: true,
        });
      }, softMs);
    }),
  ]);
  if (softTimer) clearTimeout(softTimer);

  const { pools, indexResolved, factoryError, softCapped } = factoryPack;

  let lockerHits: Awaited<typeof lockerHitsPromise> = [];
  try {
    lockerHits = await lockerHitsPromise;
  } catch {
    lockerHits = [];
  }

  const classified = await classifyDiscoveredV3Positions({
    discovered: indexResolved.positions,
    verifiedHits: lockerHits,
    client: c,
  });
  const positions = classified.positions;

  const counts = countByMateriality(pools);
  const discovered = pools.length;
  const material = counts.material;

  const realNumeric = positions.filter(
    (p) => p.positionNftId && !isSyntheticV3StubId(p.positionNftId),
  );
  const hasInventoryUnknown = counts.inventory_unknown > 0;
  const lockAnalysisComplete =
    classified.lockAnalysisComplete && !hasInventoryUnknown;

  const indexNote =
    realNumeric.length > 0
      ? ` index-resolved=${realNumeric.length} numeric NPM id(s)`
      : indexResolved.anyBackgroundScheduled
        ? " index backfill scheduled (background)"
        : softCapped
          ? " factory/index soft-wall (Pons parallel preserved)"
          : "";
  const lockerNote =
    classified.verifiedLocked > 0
      ? ` locker-verified=${classified.verifiedLocked} (adapter PASS)`
      : "";

  if (factoryError && positions.length === 0) {
    return {
      version: "v3",
      protocolSupportStatus: dep.protocolSupportStatus,
      searched: true,
      discoveryComplete: false,
      lockAnalysisComplete: false,
      positionDiscoveryComplete: false,
      pools: [],
      positions: [],
      detail: `v3 probe error: ${factoryError}`,
      evidenceLevel: "unavailable",
    };
  }

  // Adapter-verified Locked rows are a complete discovery path for those NFTs.
  // Soft-wall / incomplete factory must not leave positionDiscoveryComplete=false
  // when Pons (or another adapter) already supplied the real numeric position.
  const adapterDiscoveryComplete =
    classified.verifiedLocked > 0 &&
    realNumeric.length > 0 &&
    !hasInventoryUnknown;

  return {
    version: "v3",
    protocolSupportStatus: dep.protocolSupportStatus,
    searched: true,
    discoveryComplete: !softCapped && factoryError == null,
    lockAnalysisComplete,
    positionDiscoveryComplete:
      indexResolved.positionDiscoveryComplete || adapterDiscoveryComplete,
    positionDiscoverySource: indexResolved.positionDiscoverySource,
    positionDiscoveryFromBlock: indexResolved.positionDiscoveryFromBlock,
    positionDiscoveryToBlock: indexResolved.positionDiscoveryToBlock,
    positionDiscoveryCheckpoint: indexResolved.positionDiscoveryCheckpoint,
    v3PositionIndexProgressActions: indexResolved.progressActions,
    pools,
    positions,
    detail:
      discovered === 0 && classified.verifiedLocked === 0
        ? softCapped
          ? `v3: factory/index soft-wall (${softMs}ms) before pools; no adapter hits.`
          : "v3: no pools for quote×fee probe set."
        : `v3: ${discovered} discovered pool(s) via factory.getPool (material=${material}, dust=${counts.dust}, inventory_unknown=${counts.inventory_unknown})${indexNote}${lockerNote}${
            indexResolved.positionDiscoveryComplete || adapterDiscoveryComplete
              ? " — position discovery complete for material pools."
              : " — position discovery incomplete for material pools."
          }${
            lockAnalysisComplete
              ? " — lock analysis complete for material/unknown inventory."
              : " — position NFT/locker analysis incomplete for material/unknown."
          }`,
    evidenceLevel:
      realNumeric.length > 0 || classified.verifiedLocked > 0
        ? "on_chain_verified"
        : discovered > 0
          ? "on_chain_partial"
          : "on_chain_verified",
  };
}
