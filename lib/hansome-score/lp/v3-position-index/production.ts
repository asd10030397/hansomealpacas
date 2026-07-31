/**
 * Phase 10C-1 — Production interactive resolve + bounded background backfill.
 *
 * Discovery only. Lock classification is Phase 10C-2 (classify-v3 after attach).
 */

import type { PublicClient } from "viem";
import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import { UNISWAP_RH_DEPLOYMENTS } from "@/lib/hansome-score/lp/deployments";
import {
  attachIndexedV3Positions,
  mergeRealV3PositionsOverStubs,
} from "@/lib/hansome-score/lp/v3-position-index/attach";
import {
  createV3PosChainPort,
  readPoolCanonicalKey,
  readPoolSlot0,
} from "@/lib/hansome-score/lp/v3-position-index/chain-port";
import {
  assertPoolKeyMatchesRecord,
  loadV3PosIndexProduction,
  saveV3PosIndexProduction,
  v3PosIndexKey,
} from "@/lib/hansome-score/lp/v3-position-index/production-kv";
import { V3PosStoreError } from "@/lib/hansome-score/lp/v3-position-index/store";
import {
  backfillV3PosIndex,
  incrementalSyncV3PosIndex,
  type V3PosChainPort,
  type SyncOptions,
} from "@/lib/hansome-score/lp/v3-position-index/sync";
import {
  V3_POS_INDEX_SCHEMA_VERSION,
  V3_POS_INDEX_SEMANTIC_VERSION,
  type V3PosIndexRecord,
} from "@/lib/hansome-score/lp/v3-position-index/types";
import type { V4PositionInfo } from "@/lib/hansome-score/types";

function evaluateDiscoveryComplete(record: {
  poolCreationBlock: number | null;
  exhaustiveFromBlock: number | null;
  exhaustiveToBlock: number | null;
  lastSyncedBlockHash: string | null;
  completenessErrors: string[];
  paginationGaps?: boolean;
}): boolean {
  if (record.paginationGaps) return false;
  if (record.completenessErrors.length > 0) return false;
  if (record.poolCreationBlock == null) return false;
  if (record.exhaustiveFromBlock == null) return false;
  if (record.exhaustiveToBlock == null) return false;
  if (!record.lastSyncedBlockHash) return false;
  if (record.exhaustiveFromBlock > record.poolCreationBlock) return false;
  return true;
}

export const V3_POS_PROGRESS_ACTIONS = [
  "v3_position_index_load",
  "v3_position_index_validate",
  "v3_position_index_incremental_sync",
  "v3_position_index_backfill_schedule",
  "v3_position_receipt_resolve",
  "v3_position_owner_revalidate",
  "v3_position_data_revalidate",
  "v3_position_index_merge",
  "v3_position_index_partial",
  "v3_position_index_complete",
  "v3_position_index_fallback_stub",
] as const;

export type V3PosProgressAction = (typeof V3_POS_PROGRESS_ACTIONS)[number];

export type V3PoolPositionResolveResult = {
  positions: V4PositionInfo[];
  positionDiscoveryComplete: boolean;
  positionDiscoverySource: string;
  positionDiscoveryFromBlock: number | null;
  positionDiscoveryToBlock: number | null;
  positionDiscoveryCheckpoint: string | null;
  usedFallbackStub: boolean;
  indexPresent: boolean;
  backgroundScheduled: boolean;
  progressActions: V3PosProgressAction[];
  record: V3PosIndexRecord | null;
  error: string | null;
};

const backgroundInflight = new Set<string>();

/** Default interactive budget for incremental/revalidate path (not full backfill). */
const DEFAULT_INTERACTIVE_BUDGET_MS = 2_500;

function pushAction(
  actions: V3PosProgressAction[],
  action: V3PosProgressAction,
): void {
  if (actions[actions.length - 1] === action) return;
  actions.push(action);
}

function syncOptsFrom(params: {
  poolAddress: string;
  token0: string;
  token1: string;
  fee: number;
  poolCreationBlock?: number | null;
}): SyncOptions {
  const dep = UNISWAP_RH_DEPLOYMENTS.v3;
  return {
    chainId: SCAN_CHAIN_ID,
    factory: dep.factory,
    npm: dep.positionManager,
    poolAddress: params.poolAddress,
    token0: params.token0,
    token1: params.token1,
    fee: params.fee,
    reorgOverlapBlocks: 96,
    poolCreationBlock: params.poolCreationBlock ?? null,
    markCompleteIfClean: true,
  };
}

function validateSemantic(record: V3PosIndexRecord): void {
  if (record.schemaVersion !== V3_POS_INDEX_SCHEMA_VERSION) {
    throw new V3PosStoreError(
      `schemaVersion mismatch: ${record.schemaVersion}`,
      "SCHEMA_MISMATCH",
    );
  }
  if (typeof record.semanticVersion !== "string" || !record.semanticVersion) {
    throw new V3PosStoreError("semanticVersion missing", "CORRUPTED");
  }
  // Accept prototype records already written (Phase 10B) and production.
  if (
    !record.semanticVersion.startsWith("0.1.0-phase10b") &&
    !record.semanticVersion.startsWith("1.0.0-phase10c")
  ) {
    throw new V3PosStoreError(
      `semanticVersion unsupported: ${record.semanticVersion}`,
      "SCHEMA_MISMATCH",
    );
  }
}

/**
 * Schedule bounded background backfill. Fire-and-forget; generation-fenced save.
 * Does not block the interactive barrier.
 */
export function scheduleV3PosIndexBackgroundBackfill(params: {
  key: string;
  port: V3PosChainPort;
  opts: SyncOptions;
  expectedGeneration?: number;
}): void {
  const { key } = params;
  if (backgroundInflight.has(key)) return;
  backgroundInflight.add(key);
  void (async () => {
    try {
      let existing: V3PosIndexRecord | null = null;
      try {
        existing = await loadV3PosIndexProduction(key);
      } catch {
        // Corrupt / schema mismatch — rebuild from empty.
        existing = null;
      }
      if (existing?.discoveryComplete && existing.tokenIds.length > 0) {
        // Head refresh via incremental instead.
        const next = await incrementalSyncV3PosIndex({
          port: params.port,
          opts: params.opts,
          existing,
        });
        next.semanticVersion = V3_POS_INDEX_SEMANTIC_VERSION;
        await saveV3PosIndexProduction(key, next, {
          expectedGeneration: existing.generation,
        });
        return;
      }
      const record = await backfillV3PosIndex({
        port: params.port,
        opts: params.opts,
        existing,
      });
      record.semanticVersion = V3_POS_INDEX_SEMANTIC_VERSION;
      await saveV3PosIndexProduction(key, record, {
        expectedGeneration:
          params.expectedGeneration ?? existing?.generation,
      });
    } catch (err) {
      console.warn("[v3pos] background backfill failed:", err);
    } finally {
      backgroundInflight.delete(key);
    }
  })();
}

export function clearV3PosBackgroundInflightForTests(): void {
  backgroundInflight.clear();
}

/**
 * Interactive resolve for one material V3 pool.
 * Loads index → small incremental → revalidate → attach.
 * Missing/heavy history → schedule background; return honest incomplete.
 */
export async function resolveMaterialV3PoolPositions(params: {
  client: PublicClient;
  poolAddress: string;
  fee: number;
  /** Optional injectable port (tests). */
  port?: V3PosChainPort;
  /** Optional known creation block (skips factory scan). */
  poolCreationBlock?: number | null;
  interactiveBudgetMs?: number;
  /** When true, run full backfill inline (tests / offline warm). */
  allowInlineBackfill?: boolean;
  onProgress?: (action: V3PosProgressAction) => void;
}): Promise<V3PoolPositionResolveResult> {
  const actions: V3PosProgressAction[] = [];
  const note = (a: V3PosProgressAction) => {
    pushAction(actions, a);
    params.onProgress?.(a);
  };

  const budget =
    params.interactiveBudgetMs ??
    (Number(process.env.HANSOME_V3_POS_INTERACTIVE_BUDGET_MS ?? "") ||
      DEFAULT_INTERACTIVE_BUDGET_MS);
  const t0 = Date.now();
  const withinBudget = () => Date.now() - t0 < budget;

  const dep = UNISWAP_RH_DEPLOYMENTS.v3;
  const npm = dep.positionManager;
  const port =
    params.port ??
    createV3PosChainPort(params.client, { factory: dep.factory });

  const empty = (
    partial: Partial<V3PoolPositionResolveResult>,
  ): V3PoolPositionResolveResult => ({
    positions: [],
    positionDiscoveryComplete: false,
    positionDiscoverySource: "v3_position_index",
    positionDiscoveryFromBlock: null,
    positionDiscoveryToBlock: null,
    positionDiscoveryCheckpoint: null,
    usedFallbackStub: true,
    indexPresent: false,
    backgroundScheduled: false,
    progressActions: actions,
    record: null,
    error: null,
    ...partial,
  });

  note("v3_position_index_load");

  let canon: Awaited<ReturnType<typeof readPoolCanonicalKey>>;
  try {
    canon = await readPoolCanonicalKey(params.client, params.poolAddress);
  } catch {
    note("v3_position_index_fallback_stub");
    return empty({ error: "pool_key_read_failed" });
  }
  if (!canon) {
    note("v3_position_index_fallback_stub");
    return empty({ error: "pool_key_unresolved" });
  }
  // Prefer on-chain fee; warn path if caller fee mismatches.
  if (canon.fee !== params.fee) {
    note("v3_position_index_fallback_stub");
    return empty({ error: `fee_mismatch:expected=${params.fee}:got=${canon.fee}` });
  }

  const poolKey = {
    chainId: SCAN_CHAIN_ID,
    npm,
    token0: canon.token0,
    token1: canon.token1,
    fee: canon.fee,
  };
  const key = v3PosIndexKey(poolKey);
  const opts = syncOptsFrom({
    poolAddress: params.poolAddress,
    token0: canon.token0,
    token1: canon.token1,
    fee: canon.fee,
    poolCreationBlock: params.poolCreationBlock,
  });

  let record: V3PosIndexRecord | null = null;
  try {
    record = await loadV3PosIndexProduction(key);
    if (record) {
      note("v3_position_index_validate");
      validateSemantic(record);
      assertPoolKeyMatchesRecord(
        { ...poolKey, poolAddress: params.poolAddress },
        record,
      );
    }
  } catch (e) {
    const msg =
      e instanceof V3PosStoreError
        ? `${e.code}:${e.message}`
        : e instanceof Error
          ? e.message
          : "index_load_error";
    note("v3_position_index_fallback_stub");
    // Corrupt / schema mismatch — schedule rebuild, do not use stale.
    scheduleV3PosIndexBackgroundBackfill({ key, port, opts });
    return empty({
      error: msg,
      backgroundScheduled: true,
      usedFallbackStub: true,
    });
  }

  if (!record) {
    note("v3_position_index_backfill_schedule");
    const inline =
      params.allowInlineBackfill === true ||
      process.env.HANSOME_V3_POS_INLINE_BACKFILL === "1";
    if (inline && withinBudget()) {
      try {
        note("v3_position_receipt_resolve");
        record = await backfillV3PosIndex({ port, opts, existing: null });
        record.semanticVersion = V3_POS_INDEX_SEMANTIC_VERSION;
        await saveV3PosIndexProduction(key, record);
      } catch (e) {
        scheduleV3PosIndexBackgroundBackfill({ key, port, opts });
        note("v3_position_index_fallback_stub");
        return empty({
          error: e instanceof Error ? e.message : "inline_backfill_failed",
          backgroundScheduled: true,
        });
      }
    } else {
      scheduleV3PosIndexBackgroundBackfill({ key, port, opts });
      note("v3_position_index_fallback_stub");
      return empty({
        backgroundScheduled: true,
        usedFallbackStub: true,
        error: "index_missing_backfill_scheduled",
      });
    }
  }

  // Present: bounded incremental + revalidate when budget allows.
  // Fresh complete indexes: ownerOf/positions revalidate only (skip Mint getLogs).
  const FRESH_TIP_BLOCKS = 256;
  if (record && withinBudget()) {
    try {
      const priorGen = record.generation;
      const head = await port.getBlockNumber();
      const tipLag =
        record.lastSyncedBlock != null
          ? head - record.lastSyncedBlock
          : Number.POSITIVE_INFINITY;
      const freshComplete =
        record.discoveryComplete &&
        record.tokenIds.length > 0 &&
        tipLag >= 0 &&
        tipLag <= FRESH_TIP_BLOCKS &&
        Boolean(record.lastSyncedBlockHash);

      let next = record;
      if (freshComplete) {
        note("v3_position_owner_revalidate");
        note("v3_position_data_revalidate");
        // Lightweight revalidate via incremental with empty mint window:
        // force tip == lastSynced so getLogs range is empty / skipped early.
        next = await incrementalSyncV3PosIndex({
          port,
          opts: {
            ...opts,
            poolCreationBlock:
              opts.poolCreationBlock ?? record.poolCreationBlock,
            // Shrink overlap so from≈safeHead when already at tip.
            reorgOverlapBlocks: Math.min(16, tipLag + 1),
          },
          existing: record,
          forceRevalidateIds: record.tokenIds.map((t) => t.tokenId),
        });
      } else {
        note("v3_position_index_incremental_sync");
        next = await incrementalSyncV3PosIndex({
          port,
          opts: {
            ...opts,
            poolCreationBlock:
              opts.poolCreationBlock ?? record.poolCreationBlock,
          },
          existing: record,
        });
        note("v3_position_owner_revalidate");
        note("v3_position_data_revalidate");
      }
      next.semanticVersion = V3_POS_INDEX_SEMANTIC_VERSION;
      const saved = await saveV3PosIndexProduction(key, next, {
        expectedGeneration: priorGen,
      });
      if (saved.ok) {
        record = next;
      }
      // If fenced, keep prior record for attach (honest).
    } catch {
      // Keep prior record; do not fail closed to wrong lock.
      note("v3_position_index_partial");
    }
  }

  if (!record) {
    note("v3_position_index_fallback_stub");
    return empty({ usedFallbackStub: true, error: "record_unavailable" });
  }

  const slot0 = await readPoolSlot0(params.client, params.poolAddress);
  const attached = attachIndexedV3Positions(record, {
    poolAddress: params.poolAddress,
    includeZeroLiquidity: false,
    includeBurned: false,
    sqrtPriceX96: slot0?.sqrtPriceX96 ?? null,
    currentTick: slot0?.tick ?? null,
  });

  note("v3_position_index_merge");

  const complete = evaluateDiscoveryComplete({
    poolCreationBlock: record.poolCreationBlock,
    exhaustiveFromBlock: record.exhaustiveFromBlock,
    exhaustiveToBlock: record.exhaustiveToBlock,
    lastSyncedBlockHash: record.lastSyncedBlockHash,
    completenessErrors: record.completenessErrors,
  });

  if (complete && attached.length > 0) {
    note("v3_position_index_complete");
  } else {
    note("v3_position_index_partial");
    if (attached.length === 0) {
      note("v3_position_index_fallback_stub");
    }
  }

  return {
    positions: attached,
    positionDiscoveryComplete: complete && attached.length > 0,
    positionDiscoverySource: "v3_position_index:pool_mint_receipt",
    positionDiscoveryFromBlock: record.exhaustiveFromBlock,
    positionDiscoveryToBlock: record.exhaustiveToBlock,
    positionDiscoveryCheckpoint: record.lastSyncedBlockHash,
    usedFallbackStub: attached.length === 0,
    indexPresent: true,
    backgroundScheduled: false,
    progressActions: actions,
    record,
    error:
      attached.length === 0
        ? record.completenessErrors[0] ?? "no_material_tokenIds"
        : null,
  };
}

/**
 * Resolve all material pools for a token; merge over stubs.
 */
export async function resolveV3PositionsFromIndex(params: {
  client: PublicClient;
  materialPools: Array<{
    poolOrPair: string;
    fee: number | null;
  }>;
  stubs: V4PositionInfo[];
  port?: V3PosChainPort;
  allowInlineBackfill?: boolean;
  interactiveBudgetMs?: number;
  onProgress?: (action: V3PosProgressAction) => void;
}): Promise<{
  positions: V4PositionInfo[];
  positionDiscoveryComplete: boolean;
  positionDiscoverySource: string | null;
  positionDiscoveryFromBlock: number | null;
  positionDiscoveryToBlock: number | null;
  positionDiscoveryCheckpoint: string | null;
  progressActions: V3PosProgressAction[];
  anyBackgroundScheduled: boolean;
  poolResults: V3PoolPositionResolveResult[];
}> {
  const progressActions: V3PosProgressAction[] = [];
  const poolResults: V3PoolPositionResolveResult[] = [];
  const real: V4PositionInfo[] = [];
  let anyBackgroundScheduled = false;
  let allComplete = params.materialPools.length > 0;
  let fromBlock: number | null = null;
  let toBlock: number | null = null;
  let checkpoint: string | null = null;
  let source: string | null = null;

  for (const pool of params.materialPools) {
    if (pool.fee == null) {
      allComplete = false;
      continue;
    }
    const r = await resolveMaterialV3PoolPositions({
      client: params.client,
      poolAddress: pool.poolOrPair,
      fee: pool.fee,
      port: params.port,
      allowInlineBackfill: params.allowInlineBackfill,
      interactiveBudgetMs: params.interactiveBudgetMs,
      onProgress: (a) => {
        pushAction(progressActions, a);
        params.onProgress?.(a);
      },
    });
    poolResults.push(r);
    real.push(...r.positions);
    if (r.backgroundScheduled) anyBackgroundScheduled = true;
    if (!r.positionDiscoveryComplete) allComplete = false;
    if (r.positionDiscoveryFromBlock != null) {
      fromBlock =
        fromBlock == null
          ? r.positionDiscoveryFromBlock
          : Math.min(fromBlock, r.positionDiscoveryFromBlock);
    }
    if (r.positionDiscoveryToBlock != null) {
      toBlock =
        toBlock == null
          ? r.positionDiscoveryToBlock
          : Math.max(toBlock, r.positionDiscoveryToBlock);
    }
    if (r.positionDiscoveryCheckpoint) {
      checkpoint = r.positionDiscoveryCheckpoint;
    }
    if (r.positionDiscoverySource) source = r.positionDiscoverySource;
  }

  if (params.materialPools.length === 0) {
    allComplete = true;
  }

  const positions = mergeRealV3PositionsOverStubs({
    stubs: params.stubs,
    real,
  });

  return {
    positions,
    positionDiscoveryComplete: allComplete,
    positionDiscoverySource: source,
    positionDiscoveryFromBlock: fromBlock,
    positionDiscoveryToBlock: toBlock,
    positionDiscoveryCheckpoint: checkpoint,
    progressActions,
    anyBackgroundScheduled,
    poolResults,
  };
}

export { mergeRealV3PositionsOverStubs };
