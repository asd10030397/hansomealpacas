/**
 * Cold Perf V2 Phase 7 — Warm Incremental scan path.
 *
 * Performance / caching / checkpointing / orchestration only.
 * Does NOT change score, burn, LP lock, creator, or risk semantics.
 *
 * Warm = reusable snapshot + valid checkpoints → bounded head delta only.
 * Ineligible → safe cold / recent-first fallback (never fabricate).
 */

import { getAddress } from "viem";
import { SCAN_CHAIN_ID, SCORE_SPEC_VERSION } from "@/lib/hansome-score/constants";
import { CONTRACT_CACHE_SCHEMA_VERSION } from "@/lib/hansome-score/contract-cache";
import type { TransferIndexMeta } from "@/lib/hansome-score/transfer-index/types";
import {
  TRANSFER_INDEX_HEAD_FRESH_MS,
  type TransferIndexValidation,
} from "@/lib/hansome-score/transfer-index/validate";
import type {
  AnalysisStageId,
  AnalysisStages,
  AnalysisStageState,
  ScanResponse,
} from "@/lib/hansome-score/types";

/** Scan snapshot schema (ScanResponse shape / cache envelope). */
export const SCAN_SNAPSHOT_SCHEMA_VERSION = 1;

/**
 * Analysis semantic compatibility — bump only when cached derived meaning
 * must not be reused (never for presentation-only changes).
 * Tied to SCORE_SPEC_VERSION so formula/spec bumps invalidate warm reuse.
 */
export const ANALYSIS_SEMANTIC_VERSION = SCORE_SPEC_VERSION;

/** Transfer-index meta.version expected for warm reuse. */
export const TRANSFER_INDEX_SCHEMA_VERSION = 1;

/** LP discovery checkpoint.version expected for warm reuse. */
export const LP_CHECKPOINT_SCHEMA_VERSION = 1;

/** Contract-cache schema expected (mirrors CONTRACT_CACHE_SCHEMA_VERSION). */
export const CONTRACT_CACHE_COMPAT_SCHEMA_VERSION = CONTRACT_CACHE_SCHEMA_VERSION;

/**
 * Reorg overlap: re-fetch last N blocks on head refresh and replace that window.
 * Robinhood / L2 short reorgs are typically ≪64 blocks; 64 covers tip instability
 * without replaying genesis. Deduped merge prevents double-counting burns/balances.
 */
export const WARM_REORG_OVERLAP_BLOCKS = 64;

/**
 * Time-based overlap floor when block numbers are missing (~3 minutes).
 * Complements block overlap for APIs that only expose timestamps.
 */
export const WARM_REORG_OVERLAP_MS = 3 * 60 * 1000;

/** Max Blockscout pages for warm head / overlap refresh (aligned with transfer-index). */
export const WARM_HEAD_REFRESH_MAX_PAGES = 5;

/**
 * Per-data-type freshness (not one global TTL).
 * Documented invalidation triggers beside each entry.
 */
export const WARM_FRESHNESS_POLICY = {
  /** Token metadata (name/symbol/decimals) — rarely changes; bust on address mismatch. */
  tokenMetadataMs: 24 * 60 * 60 * 1000,
  /** Contract ABI/bytecode — long; bust on bytecodeHash / proxy evidence change. */
  contractMetadataMs: 7 * 24 * 60 * 60 * 1000,
  /** Transfer head — align with full Score TTL; stale → bounded head refresh. */
  transferHeadMs: TRANSFER_INDEX_HEAD_FRESH_MS,
  /** Holder sample — medium; Fast overlay / re-fetch on structural refresh. */
  holdersMs: 15 * 60 * 1000,
  /** Relationships graph — medium; refresh when transfer head moves. */
  relationshipsMs: 15 * 60 * 1000,
  /** LP ownership / NFT balances — shorter; revalidate on warm liquidity. */
  liquidityOwnershipMs: 10 * 60 * 1000,
  /** Lock status — shorter; always revalidate known positions on LP stage run. */
  lockStatusMs: 10 * 60 * 1000,
  /** Price / TVL / activity — short overlay TTL. */
  priceTvlMs: 45 * 1000,
  /**
   * Completed historical transfer index — durable until schema/semantic mismatch,
   * corruption, or force rebuild. Head freshness is separate (transferHeadMs).
   */
  historicalIndexDurable: true,
} as const;

/** Warm-specific deepProgress.action ids (honest cache/checkpoint reuse). */
export const WARM_PROGRESS_ACTIONS = [
  "warm_snapshot_load",
  "checkpoint_validate",
  "head_overlap_refresh",
  "new_transfers_merge",
  "zero_delta_reuse",
  "creator_burn_recompute",
  "relationship_refresh",
  "lp_delta_refresh",
  /** Phase 7.1 Smart LP (also listed in SMART_LP_PROGRESS_ACTIONS). */
  "lp_refresh_plan",
  "lp_cache_validate",
  "lp_event_delta_check",
  "lp_price_refresh",
  "lp_pool_state_refresh",
  "lp_owner_reuse",
  "lp_owner_refresh",
  "lp_lock_reuse",
  "lp_lock_refresh",
  "lp_checkpoint_update",
  "lp_background_exhaustive",
  "lp_final_validation",
  "background_history_resume",
  "stage_reuse",
  "final_validation",
] as const;

export type WarmProgressAction = (typeof WARM_PROGRESS_ACTIONS)[number];

export type WarmEligibilityReason =
  | "eligible"
  | "missing_snapshot"
  | "chain_mismatch"
  | "address_mismatch"
  | "snapshot_schema_mismatch"
  | "semantic_version_mismatch"
  | "transfer_index_missing"
  | "transfer_index_corrupt"
  | "transfer_index_version_mismatch"
  | "transfer_index_rebuild"
  | "checkpoint_cursor_missing"
  | "reorg_conflict"
  | "force_cold";

export type WarmEligibility = {
  eligible: boolean;
  reason: WarmEligibilityReason;
  /** When eligible: transfer head needs bounded refresh. */
  needsHeadRefresh: boolean;
  /** When eligible: historical genesis still open — resume in background. */
  needsHistoricalResume: boolean;
  /** Complete+fresh index → zero Blockscout pages. */
  zeroDelta: boolean;
  transferValidation: TransferIndexValidation | null;
  snapshotSchemaVersion: number | null;
  analysisSemanticVersion: string | null;
};

export type WarmStageAction = "reuse" | "refresh" | "rerun" | "skip_cold";

export type WarmStagePlan = {
  relationships: WarmStageAction;
  liquidity: WarmStageAction;
  creatorBurn: WarmStageAction;
  /** Stages reused without network work this attempt. */
  reused: Array<"relationships" | "liquidity" | "creatorBurn">;
  /** Stages that will run (refresh or rerun). */
  rerun: Array<"relationships" | "liquidity" | "creatorBurn">;
  path: "warm" | "cold";
  eligibility: WarmEligibility;
};

export type WarmMergeStats = {
  newTransfersMerged: number;
  duplicatesSuppressed: number;
  overlapReplaced: number;
  priorCount: number;
  incomingCount: number;
  resultCount: number;
};

function normalizeAddress(address: string): string {
  try {
    return getAddress(address).toLowerCase();
  } catch {
    return address.toLowerCase();
  }
}

function stageTerminalDone(st: AnalysisStageState | undefined): boolean {
  return st === "done" || st === "unknown";
}

function stageNeedsRerun(st: AnalysisStageState | undefined): boolean {
  return (
    st === "partial" ||
    st === "failed" ||
    st === "analyzing" ||
    st === "pending" ||
    st == null
  );
}

/**
 * Stable transfer identity for warm merge / reorg dedupe.
 * Blockscout rows lack logIndex today — compose chainId+token+tx+endpoints+value+block.
 */
export function transferIdentityKey(params: {
  chainId: number;
  tokenAddress: string;
  txHash: string | null | undefined;
  from: string;
  to: string;
  valueRaw: string;
  blockNumber: number | null | undefined;
}): string {
  return [
    params.chainId,
    normalizeAddress(params.tokenAddress),
    (params.txHash ?? "").toLowerCase(),
    params.from.toLowerCase(),
    params.to.toLowerCase(),
    params.valueRaw,
    params.blockNumber ?? "",
  ].join("|");
}

/**
 * Merge head delta into prior index with reorg-window replacement.
 * Older finalized history is preserved; overlap window prefers incoming rows.
 */
export function mergeTransfersWithReorgOverlap<
  T extends {
    from: string;
    to: string;
    valueRaw: string;
    blockNumber: number | null;
    txHash?: string | null;
    timestamp?: string | null;
    timestampMs?: number | null;
  },
>(params: {
  prior: T[];
  incoming: T[];
  chainId: number;
  tokenAddress: string;
  headBlock: number | null;
  headTimestampMs: number | null;
  overlapBlocks?: number;
  overlapMs?: number;
}): { merged: T[]; stats: WarmMergeStats } {
  const overlapBlocks = params.overlapBlocks ?? WARM_REORG_OVERLAP_BLOCKS;
  const overlapMs = params.overlapMs ?? WARM_REORG_OVERLAP_MS;
  const headBlock = params.headBlock;
  const headTs = params.headTimestampMs;

  const cutoffBlock =
    headBlock != null && Number.isFinite(headBlock)
      ? headBlock - overlapBlocks
      : null;
  const cutoffTs =
    headTs != null && Number.isFinite(headTs) ? headTs - overlapMs : null;

  const inOverlap = (t: T): boolean => {
    if (cutoffBlock != null && t.blockNumber != null) {
      return t.blockNumber >= cutoffBlock;
    }
    const ms =
      typeof t.timestampMs === "number"
        ? t.timestampMs
        : t.timestamp
          ? Date.parse(t.timestamp)
          : NaN;
    if (cutoffTs != null && Number.isFinite(ms)) {
      return ms >= cutoffTs;
    }
    // No boundary → treat as overlap (safe replace via incoming+dedupe).
    return true;
  };

  const finalized: T[] = [];
  let overlapReplaced = 0;
  for (const t of params.prior) {
    if (inOverlap(t)) {
      overlapReplaced++;
      continue;
    }
    finalized.push(t);
  }

  const seen = new Set<string>();
  const merged: T[] = [];
  let duplicatesSuppressed = 0;

  const push = (t: T) => {
    const k = transferIdentityKey({
      chainId: params.chainId,
      tokenAddress: params.tokenAddress,
      txHash: t.txHash,
      from: t.from,
      to: t.to,
      valueRaw: t.valueRaw,
      blockNumber: t.blockNumber,
    });
    if (seen.has(k)) {
      duplicatesSuppressed++;
      return;
    }
    seen.add(k);
    merged.push(t);
  };

  // Incoming first (newest head), then finalized older history.
  for (const t of params.incoming) push(t);
  for (const t of finalized) push(t);

  const incomingKeys = new Set(
    params.incoming.map((t) =>
      transferIdentityKey({
        chainId: params.chainId,
        tokenAddress: params.tokenAddress,
        txHash: t.txHash,
        from: t.from,
        to: t.to,
        valueRaw: t.valueRaw,
        blockNumber: t.blockNumber,
      }),
    ),
  );
  let newTransfersMerged = 0;
  for (const t of params.incoming) {
    const k = transferIdentityKey({
      chainId: params.chainId,
      tokenAddress: params.tokenAddress,
      txHash: t.txHash,
      from: t.from,
      to: t.to,
      valueRaw: t.valueRaw,
      blockNumber: t.blockNumber,
    });
    const wasInPrior = params.prior.some(
      (p) =>
        transferIdentityKey({
          chainId: params.chainId,
          tokenAddress: params.tokenAddress,
          txHash: p.txHash,
          from: p.from,
          to: p.to,
          valueRaw: p.valueRaw,
          blockNumber: p.blockNumber,
        }) === k,
    );
    if (!wasInPrior && incomingKeys.has(k)) newTransfersMerged++;
  }

  return {
    merged,
    stats: {
      newTransfersMerged,
      duplicatesSuppressed,
      overlapReplaced,
      priorCount: params.prior.length,
      incomingCount: params.incoming.length,
      resultCount: merged.length,
    },
  };
}

/**
 * Evaluate whether this token may take the warm incremental path.
 * Fail-closed: any mismatch → not eligible (cold fallback).
 */
export function evaluateWarmEligibility(params: {
  chainId?: number;
  tokenAddress: string;
  snapshot?: Pick<ScanResponse, "version" | "overview"> | null;
  snapshotSchemaVersion?: number | null;
  analysisSemanticVersion?: string | null;
  transferValidation: TransferIndexValidation | null;
  /** Detected reorg conflict (caller-set); forces cold. */
  reorgConflict?: boolean;
  forceCold?: boolean;
}): WarmEligibility {
  const chainId = params.chainId ?? SCAN_CHAIN_ID;
  const addr = normalizeAddress(params.tokenAddress);
  const snapSchema =
    params.snapshotSchemaVersion ?? SCAN_SNAPSHOT_SCHEMA_VERSION;
  const semVer =
    params.analysisSemanticVersion ??
    params.snapshot?.version ??
    ANALYSIS_SEMANTIC_VERSION;

  if (params.forceCold) {
    return {
      eligible: false,
      reason: "force_cold",
      needsHeadRefresh: false,
      needsHistoricalResume: false,
      zeroDelta: false,
      transferValidation: params.transferValidation,
      snapshotSchemaVersion: snapSchema,
      analysisSemanticVersion: semVer,
    };
  }

  if (!params.snapshot) {
    return {
      eligible: false,
      reason: "missing_snapshot",
      needsHeadRefresh: false,
      needsHistoricalResume: false,
      zeroDelta: false,
      transferValidation: params.transferValidation,
      snapshotSchemaVersion: snapSchema,
      analysisSemanticVersion: semVer,
    };
  }

  if (snapSchema !== SCAN_SNAPSHOT_SCHEMA_VERSION) {
    return {
      eligible: false,
      reason: "snapshot_schema_mismatch",
      needsHeadRefresh: false,
      needsHistoricalResume: false,
      zeroDelta: false,
      transferValidation: params.transferValidation,
      snapshotSchemaVersion: snapSchema,
      analysisSemanticVersion: semVer,
    };
  }

  if (semVer !== ANALYSIS_SEMANTIC_VERSION) {
    return {
      eligible: false,
      reason: "semantic_version_mismatch",
      needsHeadRefresh: false,
      needsHistoricalResume: false,
      zeroDelta: false,
      transferValidation: params.transferValidation,
      snapshotSchemaVersion: snapSchema,
      analysisSemanticVersion: semVer,
    };
  }

  const snapAddr = params.snapshot.overview?.address
    ? normalizeAddress(params.snapshot.overview.address)
    : "";
  if (snapAddr && snapAddr !== addr) {
    return {
      eligible: false,
      reason: "address_mismatch",
      needsHeadRefresh: false,
      needsHistoricalResume: false,
      zeroDelta: false,
      transferValidation: params.transferValidation,
      snapshotSchemaVersion: snapSchema,
      analysisSemanticVersion: semVer,
    };
  }

  if (params.reorgConflict) {
    return {
      eligible: false,
      reason: "reorg_conflict",
      needsHeadRefresh: false,
      needsHistoricalResume: false,
      zeroDelta: false,
      transferValidation: params.transferValidation,
      snapshotSchemaVersion: snapSchema,
      analysisSemanticVersion: semVer,
    };
  }

  const tv = params.transferValidation;
  if (!tv || !tv.meta) {
    return {
      eligible: false,
      reason: "transfer_index_missing",
      needsHeadRefresh: false,
      needsHistoricalResume: false,
      zeroDelta: false,
      transferValidation: tv,
      snapshotSchemaVersion: snapSchema,
      analysisSemanticVersion: semVer,
    };
  }

  if (tv.meta.chainId !== chainId) {
    return {
      eligible: false,
      reason: "chain_mismatch",
      needsHeadRefresh: false,
      needsHistoricalResume: false,
      zeroDelta: false,
      transferValidation: tv,
      snapshotSchemaVersion: snapSchema,
      analysisSemanticVersion: semVer,
    };
  }

  if (normalizeAddress(tv.meta.address) !== addr) {
    return {
      eligible: false,
      reason: "address_mismatch",
      needsHeadRefresh: false,
      needsHistoricalResume: false,
      zeroDelta: false,
      transferValidation: tv,
      snapshotSchemaVersion: snapSchema,
      analysisSemanticVersion: semVer,
    };
  }

  if (tv.meta.version !== TRANSFER_INDEX_SCHEMA_VERSION) {
    return {
      eligible: false,
      reason: "transfer_index_version_mismatch",
      needsHeadRefresh: false,
      needsHistoricalResume: false,
      zeroDelta: false,
      transferValidation: tv,
      snapshotSchemaVersion: snapSchema,
      analysisSemanticVersion: semVer,
    };
  }

  if (tv.needsRebuild || tv.status === "rebuilding") {
    return {
      eligible: false,
      reason:
        tv.reason === "corrupt"
          ? "transfer_index_corrupt"
          : "transfer_index_rebuild",
      needsHeadRefresh: false,
      needsHistoricalResume: false,
      zeroDelta: false,
      transferValidation: tv,
      snapshotSchemaVersion: snapSchema,
      analysisSemanticVersion: semVer,
    };
  }

  if (!tv.reusable) {
    return {
      eligible: false,
      reason: "transfer_index_corrupt",
      needsHeadRefresh: false,
      needsHistoricalResume: false,
      zeroDelta: false,
      transferValidation: tv,
      snapshotSchemaVersion: snapSchema,
      analysisSemanticVersion: semVer,
    };
  }

  // Incomplete without cursor and without any pages → not a warm checkpoint.
  if (
    tv.status === "incomplete" &&
    tv.meta.pagesFetchedTotal <= 0 &&
    tv.meta.nextPageParams == null
  ) {
    return {
      eligible: false,
      reason: "checkpoint_cursor_missing",
      needsHeadRefresh: false,
      needsHistoricalResume: false,
      zeroDelta: false,
      transferValidation: tv,
      snapshotSchemaVersion: snapSchema,
      analysisSemanticVersion: semVer,
    };
  }

  const needsHeadRefresh =
    tv.needsHeadRefresh ||
    tv.status === "stale" ||
    (tv.status === "incomplete" && (tv.meta.pagesFetchedTotal > 0 || tv.meta.recentChunkCount > 0));
  const needsHistoricalResume =
    !tv.meta.paginationComplete &&
    (tv.needsResume || tv.meta.nextPageParams != null || tv.status === "incomplete");
  const zeroDelta =
    tv.status === "complete" && tv.reusable && !tv.needsHeadRefresh;

  return {
    eligible: true,
    reason: "eligible",
    needsHeadRefresh,
    needsHistoricalResume,
    zeroDelta,
    transferValidation: tv,
    snapshotSchemaVersion: snapSchema,
    analysisSemanticVersion: semVer,
  };
}

/**
 * Plan which parallel Deep stages to reuse / refresh / rerun on a warm path.
 * Cold path: all rerun (caller uses existing cold/recent-first behavior).
 */
export function planWarmDeepStages(params: {
  eligibility: WarmEligibility;
  stages?: AnalysisStages | null;
  /** LP discovery checkpoint quickComplete (optional). */
  lpQuickComplete?: boolean | null;
  /** Age of snapshot scoreComputedAt / scannedAt ms. */
  snapshotAgeMs?: number | null;
  /** Force liquidity revalidate (manual refresh ownership). */
  forceLiquidityRefresh?: boolean;
}): WarmStagePlan {
  const el = params.eligibility;
  if (!el.eligible) {
    return {
      relationships: "skip_cold",
      liquidity: "skip_cold",
      creatorBurn: "skip_cold",
      reused: [],
      rerun: ["relationships", "liquidity", "creatorBurn"],
      path: "cold",
      eligibility: el,
    };
  }

  const stages = params.stages;
  const relDone = stageTerminalDone(stages?.relationships);
  const liqDone = stageTerminalDone(stages?.liquidity);
  const creatorDone = stageTerminalDone(stages?.creator);
  const burnDone = stageTerminalDone(stages?.burn);
  const creatorBurnDone = creatorDone && burnDone;

  const ownershipStale =
    params.snapshotAgeMs != null &&
    params.snapshotAgeMs > WARM_FRESHNESS_POLICY.liquidityOwnershipMs;

  let relationships: WarmStageAction;
  if (stageNeedsRerun(stages?.relationships)) {
    relationships = "rerun";
  } else if (relDone && !el.needsHeadRefresh && el.zeroDelta) {
    relationships = "reuse";
  } else if (relDone && el.needsHeadRefresh) {
    relationships = "refresh";
  } else if (relDone) {
    relationships = "reuse";
  } else {
    relationships = "rerun";
  }

  let liquidity: WarmStageAction;
  if (params.forceLiquidityRefresh || ownershipStale) {
    liquidity = stageNeedsRerun(stages?.liquidity) ? "rerun" : "refresh";
  } else if (stageNeedsRerun(stages?.liquidity)) {
    liquidity = "rerun";
  } else if (liqDone && params.lpQuickComplete === true && !ownershipStale) {
    liquidity = "reuse";
  } else if (liqDone) {
    liquidity = "refresh";
  } else {
    liquidity = "rerun";
  }

  let creatorBurn: WarmStageAction;
  if (stageNeedsRerun(stages?.creator) || stageNeedsRerun(stages?.burn)) {
    creatorBurn = "rerun";
  } else if (creatorBurnDone && el.zeroDelta && !el.needsHeadRefresh) {
    creatorBurn = "reuse";
  } else if (creatorBurnDone && (el.needsHeadRefresh || el.needsHistoricalResume)) {
    creatorBurn = "refresh";
  } else if (creatorBurnDone) {
    creatorBurn = "reuse";
  } else {
    creatorBurn = "rerun";
  }

  const reused: WarmStagePlan["reused"] = [];
  const rerun: WarmStagePlan["rerun"] = [];
  const push = (
    id: "relationships" | "liquidity" | "creatorBurn",
    action: WarmStageAction,
  ) => {
    if (action === "reuse") reused.push(id);
    else rerun.push(id);
  };
  push("relationships", relationships);
  push("liquidity", liquidity);
  push("creatorBurn", creatorBurn);

  return {
    relationships,
    liquidity,
    creatorBurn,
    reused,
    rerun,
    path: "warm",
    eligibility: el,
  };
}

/**
 * Rearm a complete snapshot for warm Deep refresh: only arm stages that need work.
 * Preserves successful sibling stage outputs (done stays done when reused).
 */
export function applyWarmRearmStages(
  response: ScanResponse,
  plan: WarmStagePlan,
): AnalysisStages {
  const base: AnalysisStages = {
    ...(response.analysisStages as AnalysisStages),
  };
  const arm = (id: AnalysisStageId, action: WarmStageAction) => {
    if (action === "reuse") return;
    base[id] = "analyzing";
  };

  if (plan.path === "cold") {
    return {
      ...base,
      relationships: "analyzing",
      liquidity: "analyzing",
      creator: "analyzing",
      burn: "analyzing",
      score: "analyzing",
    };
  }

  arm("relationships", plan.relationships);
  arm("liquidity", plan.liquidity);
  if (plan.creatorBurn !== "reuse") {
    base.creator = "analyzing";
    base.burn = "analyzing";
  }
  base.score = "analyzing";
  return base;
}

/** True when Deep may skip a parallel job entirely (reuse sibling output). */
export function shouldSkipWarmStage(action: WarmStageAction): boolean {
  return action === "reuse";
}

/** Checkpoint present enough for warm resume decisions. */
export function hasWarmTransferCheckpoint(meta: TransferIndexMeta | null): boolean {
  if (!meta) return false;
  if (meta.version !== TRANSFER_INDEX_SCHEMA_VERSION) return false;
  return (
    meta.pagesFetchedTotal > 0 ||
    meta.recentChunkCount > 0 ||
    meta.nextPageParams != null ||
    meta.paginationComplete === true
  );
}

/** Compute stop timestamp for head refresh with reorg overlap. */
export function warmHeadStopTimestampMs(
  headTimestampMs: number | null,
): number | undefined {
  if (headTimestampMs == null || !Number.isFinite(headTimestampMs)) {
    return undefined;
  }
  return Math.max(0, headTimestampMs - WARM_REORG_OVERLAP_MS);
}
