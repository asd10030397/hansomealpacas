/**
 * Deep transfer-index paging with incremental checkpoint persist + reuse.
 * Burn + Creator share one index. Does not change Burn window semantics.
 *
 * Phase 2 completion:
 * - complete+fresh → reuse chunks (no Blockscout)
 * - complete+stale → head refresh ≤5 pages (never claim stale as fresh-complete)
 * - incomplete → resume cursor
 * - corrupt / version mismatch → rebuild
 *
 * Phase 4 recent-first (opt-in via `recentFirst`):
 * - cold: latest pages (≤6 ∩ 7d) → early analyze callback → historical continuation
 * - resume indexed checkpoint before re-walking history; never claim Complete early
 */

import type { BlockscoutTokenTransferRow } from "@/lib/hansome-score/blockscout";
import { fetchTokenTransfersPaged } from "@/lib/hansome-score/blockscout";
import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import {
  TRANSFER_INDEX_LOCK_TTL_SEC,
  TRANSFER_INDEX_MAX_RECENT_CHUNKS,
  TRANSFER_INDEX_RECENT_TIER_MAX_AGE_MS,
  TRANSFER_INDEX_RECENT_TIER_MAX_PAGES,
} from "@/lib/hansome-score/transfer-index/keys";
import {
  acquireTransferIndexLock,
  releaseTransferIndexLock,
} from "@/lib/hansome-score/transfer-index/lock";
import {
  beginTransferIndexGeneration,
  loadTransferIndexChunk,
  loadTransferIndexMeta,
  persistTransferIndexChunk,
  persistTransferIndexMeta,
} from "@/lib/hansome-score/transfer-index/kv";
import type {
  TransferIndexChunkRow,
  TransferIndexMeta,
  TransferIndexNextPageParams,
} from "@/lib/hansome-score/transfer-index/types";
import {
  TRANSFER_INDEX_HEAD_FRESH_MS,
  TRANSFER_INDEX_HEAD_REFRESH_MAX_PAGES,
  canReuseTransferIndexWithoutFetch,
  evaluateTransferIndexStatus,
  type TransferIndexReuseStatus,
  type TransferIndexValidation,
} from "@/lib/hansome-score/transfer-index/validate";
import {
  WARM_HEAD_REFRESH_MAX_PAGES,
  mergeTransfersWithReorgOverlap,
  warmHeadStopTimestampMs,
  type WarmMergeStats,
} from "@/lib/hansome-score/warm-incremental";

function toChunkRow(t: BlockscoutTokenTransferRow): TransferIndexChunkRow {
  let timestampMs: number | null = null;
  if (t.timestamp) {
    const ms = Date.parse(t.timestamp);
    if (Number.isFinite(ms)) timestampMs = ms;
  }
  return {
    from: t.from,
    to: t.to,
    valueRaw: t.valueRaw,
    blockNumber: t.blockNumber,
    timestampMs,
    txHash: t.txHash,
    toIsContract: t.toIsContract,
    method: t.method,
  };
}

function fromChunkRow(r: TransferIndexChunkRow): BlockscoutTokenTransferRow {
  return {
    from: r.from,
    to: r.to,
    valueRaw: r.valueRaw,
    blockNumber: r.blockNumber,
    timestamp:
      r.timestampMs != null ? new Date(r.timestampMs).toISOString() : null,
    txHash: r.txHash,
    toIsContract: r.toIsContract,
    method: r.method,
  };
}

function transferDedupeKey(t: BlockscoutTokenTransferRow): string {
  return [
    t.txHash ?? "",
    t.from.toLowerCase(),
    t.to.toLowerCase(),
    t.valueRaw,
    t.blockNumber ?? "",
  ].join("|");
}

function mergeUniqueTransfers(
  prior: BlockscoutTokenTransferRow[],
  next: BlockscoutTokenTransferRow[],
): BlockscoutTokenTransferRow[] {
  const seen = new Set<string>();
  const out: BlockscoutTokenTransferRow[] = [];
  for (const t of [...prior, ...next]) {
    const k = transferDedupeKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function mergeHeadWithOverlap(params: {
  prior: BlockscoutTokenTransferRow[];
  incoming: BlockscoutTokenTransferRow[];
  chainId: number;
  tokenAddress: string;
  headBlock: number | null;
  headTimestampMs: number | null;
}): { merged: BlockscoutTokenTransferRow[]; stats: WarmMergeStats } {
  return mergeTransfersWithReorgOverlap({
    prior: params.prior,
    incoming: params.incoming,
    chainId: params.chainId,
    tokenAddress: params.tokenAddress,
    headBlock: params.headBlock,
    headTimestampMs: params.headTimestampMs,
  });
}

function headTailFromTransfers(transfers: BlockscoutTokenTransferRow[]): {
  headTimestampMs: number | null;
  headBlock: number | null;
  tailTimestampMs: number | null;
  tailBlock: number | null;
} {
  let headTimestampMs: number | null = null;
  let headBlock: number | null = null;
  let tailTimestampMs: number | null = null;
  let tailBlock: number | null = null;
  for (const t of transfers) {
    const ms = t.timestamp ? Date.parse(t.timestamp) : NaN;
    if (Number.isFinite(ms)) {
      if (headTimestampMs == null || ms > headTimestampMs) {
        headTimestampMs = ms;
        headBlock = t.blockNumber;
      }
      if (tailTimestampMs == null || ms < tailTimestampMs) {
        tailTimestampMs = ms;
        tailBlock = t.blockNumber;
      }
    } else if (t.blockNumber != null) {
      if (headBlock == null || t.blockNumber > headBlock) {
        headBlock = t.blockNumber;
      }
      if (tailBlock == null || t.blockNumber < tailBlock) {
        tailBlock = t.blockNumber;
      }
    }
  }
  return { headTimestampMs, headBlock, tailTimestampMs, tailBlock };
}

async function loadPriorChunkTransfers(
  chainId: number,
  tokenAddress: string,
  recentChunkCount: number,
): Promise<BlockscoutTokenTransferRow[]> {
  const count = Math.min(
    TRANSFER_INDEX_MAX_RECENT_CHUNKS,
    Math.max(0, recentChunkCount),
  );
  const rows: BlockscoutTokenTransferRow[] = [];
  for (let i = 0; i < count; i++) {
    const chunk = await loadTransferIndexChunk(chainId, tokenAddress, i);
    if (!chunk) continue;
    for (const r of chunk.transfers) {
      rows.push(fromChunkRow(r));
    }
  }
  return rows;
}

export type TransferIndexFetchMode =
  | "reuse_hit"
  | "head_refresh"
  | "resume"
  | "rebuild"
  | "concurrent_reuse"
  | "recent_first";

/** Internal pipeline progress — not public UI copy. */
export type TransferIndexPipelinePhase =
  | "indexing"
  | "analyzing"
  | "rebuilding"
  | "resuming"
  | "complete";

export type TransferIndexFetchStats = {
  rpcPagesThisCall: number;
  /** Prior lifetime pages when this call resumed a checkpoint. */
  resumedPages: number;
  /** Lifetime pages avoided via reuse/cache (not re-fetched this call). */
  skippedPages: number;
  cacheReuse: boolean;
  checkpointReuse: boolean;
  recentTierPages: number;
  historicalPagesThisCall: number;
  /** Phase 7: new head rows merged this call. */
  newTransfersMerged?: number;
  /** Phase 7: duplicate identity keys suppressed this call. */
  duplicatesSuppressed?: number;
  /** Phase 7: prior rows dropped in reorg overlap window. */
  overlapReplaced?: number;
};

export type FetchTokenTransfersWithCheckpointResult = {
  transfers: BlockscoutTokenTransferRow[];
  pagesFetched: number;
  paginationComplete: boolean;
  fetchFailed: boolean;
  stoppedAtCursor: boolean;
  meta: TransferIndexMeta | null;
  resumedFromCheckpoint: boolean;
  generation: number | null;
  /** Explicit reuse status — never claim stale as complete. */
  reuseStatus: TransferIndexReuseStatus;
  fetchMode: TransferIndexFetchMode;
  /** Blockscout pages fetched in THIS call (0 on pure reuse). */
  rpcPagesThisCall: number;
  cacheHit: boolean;
  /** Internal progress phase for instrumentation. */
  pipelinePhase: TransferIndexPipelinePhase;
  /** True when recent tier finished (or skipped because resume/reuse). */
  recentTierComplete: boolean;
  /** True when genesis not exhausted and more historical pages remain. */
  historicalContinuationPending: boolean;
  stats: TransferIndexFetchStats;
};

function emptyStats(
  partial?: Partial<TransferIndexFetchStats>,
): TransferIndexFetchStats {
  return {
    rpcPagesThisCall: partial?.rpcPagesThisCall ?? 0,
    resumedPages: partial?.resumedPages ?? 0,
    skippedPages: partial?.skippedPages ?? 0,
    cacheReuse: partial?.cacheReuse ?? false,
    checkpointReuse: partial?.checkpointReuse ?? false,
    recentTierPages: partial?.recentTierPages ?? 0,
    historicalPagesThisCall: partial?.historicalPagesThisCall ?? 0,
  };
}

function resultFromCached(params: {
  transfers: BlockscoutTokenTransferRow[];
  meta: TransferIndexMeta | null;
  validation: TransferIndexValidation;
  fetchMode: TransferIndexFetchMode;
  generation?: number | null;
  resumedFromCheckpoint?: boolean;
  rpcPagesThisCall?: number;
  stoppedAtCursor?: boolean;
  fetchFailed?: boolean;
  pipelinePhase?: TransferIndexPipelinePhase;
  recentTierComplete?: boolean;
  historicalContinuationPending?: boolean;
  stats?: Partial<TransferIndexFetchStats>;
}): FetchTokenTransfersWithCheckpointResult {
  const meta = params.meta;
  const paginationComplete = meta?.paginationComplete === true;
  const cacheReuse =
    params.fetchMode === "reuse_hit" ||
    params.fetchMode === "concurrent_reuse";
  const skipped = params.stats?.skippedPages ?? (cacheReuse ? (meta?.pagesFetchedTotal ?? 0) : 0);
  // Genesis completeness stays on meta (analyzer honesty). Freshness is reuseStatus —
  // never rewrite paginationComplete=false solely because the head is stale.
  return {
    transfers: params.transfers,
    pagesFetched: meta?.pagesFetchedTotal ?? 0,
    paginationComplete,
    fetchFailed: params.fetchFailed === true,
    stoppedAtCursor: params.stoppedAtCursor === true,
    meta,
    resumedFromCheckpoint: params.resumedFromCheckpoint === true,
    generation: params.generation ?? meta?.generation ?? null,
    reuseStatus: params.validation.status,
    fetchMode: params.fetchMode,
    rpcPagesThisCall: params.rpcPagesThisCall ?? 0,
    cacheHit: cacheReuse,
    pipelinePhase:
      params.pipelinePhase ??
      (paginationComplete
        ? "complete"
        : params.fetchMode === "rebuild" ||
            params.validation.status === "rebuilding"
          ? "rebuilding"
          : params.resumedFromCheckpoint
            ? "resuming"
            : "indexing"),
    recentTierComplete: params.recentTierComplete ?? true,
    historicalContinuationPending:
      params.historicalContinuationPending ?? !paginationComplete,
    stats: emptyStats({
      rpcPagesThisCall: params.rpcPagesThisCall ?? 0,
      skippedPages: skipped,
      cacheReuse,
      checkpointReuse: params.resumedFromCheckpoint === true,
      ...params.stats,
    }),
  };
}

/**
 * Shared Burn+Creator transfer fetch with incremental meta/chunk checkpoints.
 * Resumes / reuses / head-refreshes based on validated index status.
 *
 * When `recentFirst` is true (Deep cold path): fetch recent tier first, invoke
 * `onRecentTier` for early analyze/publish, then continue historical pages.
 * Never sets paginationComplete from recent tier alone.
 */
export async function fetchTokenTransfersWithCheckpoint(params: {
  tokenAddress: string;
  chainId?: number;
  maxPages?: number;
  /** When false, stop paging early (budget fence) without claiming complete. */
  shouldContinue?: () => boolean;
  /** Lock TTL for the exclusive writer (Deep path should cover stage budget). */
  lockTtlSec?: number;
  /** Force full rebuild (ignore prior cursors). */
  forceRebuild?: boolean;
  /** Skip head refresh even when stale (tests / Fast background tick only). */
  allowStaleReuse?: boolean;
  /**
   * Phase 4: newest-first recent tier before historical continuation.
   * Default false (Phase 2 compatibility); Deep enables true.
   */
  recentFirst?: boolean;
  /** Fired after recent tier is persisted (honest Incomplete) and before historical. */
  onRecentTier?: (
    partial: FetchTokenTransfersWithCheckpointResult,
  ) => void | Promise<void>;
  /**
   * Fired after each successful Blockscout page (recent + historical).
   * Used for ScanResponse progress publishes — does not change index semantics.
   */
  onPageProgress?: (event: {
    pagesFetchedTotal: number;
    /** Pages fetched in this call (monotonic within a fetch). */
    pagesFetchedThisCall?: number;
    transfersIndexed: number;
    pageInFetch: number;
    paginationComplete: boolean;
    pipelinePhase: TransferIndexPipelinePhase;
  }) => void | Promise<void>;
  /** Stage cancellation — abort Blockscout paging when set. */
  signal?: AbortSignal;
  /** Override recent tier page cap (default 6). */
  recentTierMaxPages?: number;
  /** Override recent tier age bound ms (default 7d). */
  recentTierMaxAgeMs?: number;
  /** Wall clock for 7d bound (tests). */
  nowMs?: number;
}): Promise<FetchTokenTransfersWithCheckpointResult> {
  const chainId = params.chainId ?? SCAN_CHAIN_ID;
  const tokenAddress = params.tokenAddress;
  const maxPages = params.maxPages ?? 40;
  const recentFirst = params.recentFirst === true;
  const recentTierMaxPages = Math.max(
    1,
    Math.min(
      maxPages,
      params.recentTierMaxPages ?? TRANSFER_INDEX_RECENT_TIER_MAX_PAGES,
    ),
  );
  const recentTierMaxAgeMs =
    params.recentTierMaxAgeMs ?? TRANSFER_INDEX_RECENT_TIER_MAX_AGE_MS;
  const nowMs = params.nowMs ?? Date.now();
  const lockTtlSec =
    params.lockTtlSec ?? Math.max(TRANSFER_INDEX_LOCK_TTL_SEC, 300);

  const priorMeta = await loadTransferIndexMeta(chainId, tokenAddress);
  let validation = evaluateTransferIndexStatus(priorMeta, {
    chainId,
    tokenAddress,
  });
  if (params.forceRebuild) {
    validation = {
      status: "rebuilding",
      meta: null,
      reusable: false,
      needsBackgroundRefresh: true,
      needsHeadRefresh: false,
      needsResume: false,
      needsRebuild: true,
      reason: "force_rebuild",
      ageMs: null,
    };
  }

  const lock = await acquireTransferIndexLock(chainId, tokenAddress, {
    ttlSec: lockTtlSec,
  });

  if (!lock.acquired) {
    const transfers = priorMeta
      ? await loadPriorChunkTransfers(
          chainId,
          tokenAddress,
          priorMeta.recentChunkCount,
        )
      : [];
    // Concurrent: never claim complete if validation says stale/incomplete.
    const concurrentValidation =
      validation.status === "complete" && validation.reusable
        ? validation
        : evaluateTransferIndexStatus(priorMeta, { chainId, tokenAddress });
    return resultFromCached({
      transfers,
      meta: priorMeta,
      validation: concurrentValidation,
      fetchMode: "concurrent_reuse",
      resumedFromCheckpoint: (priorMeta?.pagesFetchedTotal ?? 0) > 0,
      // Preserve genesis flag for analyzers; reuseStatus still honest.
      rpcPagesThisCall: 0,
    });
  }

  try {
    // Pure cache hit: complete + fresh — no Blockscout.
    if (
      !params.forceRebuild &&
      canReuseTransferIndexWithoutFetch(validation) &&
      priorMeta
    ) {
      const transfers = await loadPriorChunkTransfers(
        chainId,
        tokenAddress,
        priorMeta.recentChunkCount,
      );
      // Touch updatedAt lightly? No — keep head age honest; avoid fake freshness.
      return resultFromCached({
        transfers,
        meta: priorMeta,
        validation,
        fetchMode: "reuse_hit",
        resumedFromCheckpoint: true,
        rpcPagesThisCall: 0,
      });
    }

    // Stale complete: head refresh only (≤5 pages) unless allowStaleReuse.
    if (
      !params.forceRebuild &&
      validation.status === "stale" &&
      validation.needsHeadRefresh &&
      priorMeta &&
      !params.allowStaleReuse
    ) {
      return await runHeadRefresh({
        chainId,
        tokenAddress,
        priorMeta,
        validation,
        shouldContinue: params.shouldContinue,
        maxPages: Math.min(
          TRANSFER_INDEX_HEAD_REFRESH_MAX_PAGES,
          WARM_HEAD_REFRESH_MAX_PAGES,
        ),
        onPageProgress: params.onPageProgress,
        signal: params.signal,
      });
    }

    // Phase 7 warm incomplete + stale head: bounded head overlap refresh for
    // interactive result, then leave historical resume to background.
    // Fresh incomplete heads fall through to cursor resume (Phase 4 behavior).
    if (
      !params.forceRebuild &&
      recentFirst &&
      validation.status === "incomplete" &&
      validation.reusable &&
      priorMeta &&
      priorMeta.pagesFetchedTotal > 0 &&
      (validation.ageMs == null ||
        validation.ageMs > TRANSFER_INDEX_HEAD_FRESH_MS)
    ) {
      const head = await runHeadRefresh({
        chainId,
        tokenAddress,
        priorMeta,
        validation,
        shouldContinue: params.shouldContinue,
        maxPages: Math.min(
          TRANSFER_INDEX_HEAD_REFRESH_MAX_PAGES,
          WARM_HEAD_REFRESH_MAX_PAGES,
        ),
        // Preserve incomplete honesty — never claim genesis complete from head.
        preservePaginationComplete: false,
        onPageProgress: params.onPageProgress,
        signal: params.signal,
      });
      return {
        ...head,
        paginationComplete: false,
        reuseStatus: "incomplete",
        historicalContinuationPending: true,
        pipelinePhase: "indexing",
        fetchMode: "head_refresh",
      };
    }

    // New attempt generation fences stale writers; preserves cursors/counts
    // unless rebuild is required.
    const generation = await beginTransferIndexGeneration(chainId, tokenAddress);
    const metaAfterGen = await loadTransferIndexMeta(chainId, tokenAddress);

    const rebuild = validation.needsRebuild || params.forceRebuild === true;
    const resumeCursor =
      !rebuild &&
      metaAfterGen &&
      !metaAfterGen.paginationComplete &&
      metaAfterGen.pagesFetchedTotal > 0 &&
      metaAfterGen.nextPageParams != null
        ? metaAfterGen.nextPageParams
        : null;

    const resumedFromCheckpoint = resumeCursor != null;
    const priorTransfers =
      !rebuild && metaAfterGen && metaAfterGen.pagesFetchedTotal > 0
        ? await loadPriorChunkTransfers(
            chainId,
            tokenAddress,
            metaAfterGen.recentChunkCount,
          )
        : [];

    const basePages = rebuild ? 0 : (metaAfterGen?.pagesFetchedTotal ?? 0);
    const pagesBudget = resumedFromCheckpoint
      ? Math.max(0, maxPages - basePages)
      : maxPages;

    if (pagesBudget <= 0 && metaAfterGen && !rebuild) {
      const v = evaluateTransferIndexStatus(metaAfterGen, {
        chainId,
        tokenAddress,
      });
      return resultFromCached({
        transfers: priorTransfers,
        meta: metaAfterGen,
        validation: v,
        fetchMode: resumedFromCheckpoint ? "resume" : "reuse_hit",
        generation,
        resumedFromCheckpoint,
        rpcPagesThisCall: 0,
        pipelinePhase: resumedFromCheckpoint ? "resuming" : "complete",
        stats: {
          resumedPages: basePages,
          skippedPages: basePages,
          checkpointReuse: resumedFromCheckpoint,
        },
      });
    }

    // —— Phase 4 recent-first: cold start only (no checkpoint resume) ——
    // Priority: latest pages → indexed checkpoint → remaining historical.
    // Resume skips recent re-walk (avoid duplicate traversal).
    const useRecentFirst =
      recentFirst && !resumedFromCheckpoint && (rebuild || basePages === 0);

    if (useRecentFirst) {
      return await runRecentFirstSession({
        chainId,
        tokenAddress,
        generation,
        maxPages,
        recentTierMaxPages,
        recentTierMaxAgeMs,
        nowMs,
        shouldContinue: params.shouldContinue,
        onRecentTier: params.onRecentTier,
        onPageProgress: params.onPageProgress,
        priorTransfers,
        rebuild,
        signal: params.signal,
      });
    }

    const fetchMode: TransferIndexFetchMode = rebuild
      ? "rebuild"
      : resumedFromCheckpoint
        ? "resume"
        : "rebuild";
    const pipelinePhase: TransferIndexPipelinePhase = rebuild
      ? "rebuilding"
      : resumedFromCheckpoint
        ? "resuming"
        : "indexing";

    const session = await runIndexedPageSession({
      chainId,
      tokenAddress,
      generation,
      priorTransfers,
      basePages,
      pagesBudget: pagesBudget > 0 ? pagesBudget : maxPages,
      startNextPageParams: resumeCursor,
      shouldContinue: params.shouldContinue,
      // No time stop on resume/rebuild historical legs.
      stopAtOrBeforeTimestampMs: undefined,
      recentChunkCountSeed: rebuild
        ? 0
        : (metaAfterGen?.recentChunkCount ?? 0),
      onPageProgress: params.onPageProgress,
      pipelinePhaseForProgress: pipelinePhase,
      signal: params.signal,
    });

    const finalValidation = evaluateTransferIndexStatus(session.meta, {
      chainId,
      tokenAddress,
    });
    const paginationComplete = session.paginationComplete;

    return {
      transfers: session.transfers,
      pagesFetched: session.pagesFetchedTotal,
      paginationComplete,
      fetchFailed: session.fetchFailed && session.pagesFetchedTotal === 0,
      stoppedAtCursor: session.stoppedAtCursor,
      meta: session.meta,
      resumedFromCheckpoint,
      generation,
      reuseStatus: finalValidation.status,
      fetchMode,
      rpcPagesThisCall: session.rpcPages,
      cacheHit: false,
      pipelinePhase: paginationComplete ? "complete" : pipelinePhase,
      recentTierComplete: true,
      historicalContinuationPending: !paginationComplete,
      stats: emptyStats({
        rpcPagesThisCall: session.rpcPages,
        resumedPages: resumedFromCheckpoint ? basePages : 0,
        skippedPages: resumedFromCheckpoint ? basePages : 0,
        checkpointReuse: resumedFromCheckpoint,
        historicalPagesThisCall: session.rpcPages,
      }),
    };
  } finally {
    await releaseTransferIndexLock(chainId, tokenAddress);
  }
}

type IndexedPageSessionResult = {
  transfers: BlockscoutTokenTransferRow[];
  pagesFetchedTotal: number;
  paginationComplete: boolean;
  fetchFailed: boolean;
  stoppedAtCursor: boolean;
  meta: TransferIndexMeta | null;
  rpcPages: number;
  nextPageParams: TransferIndexNextPageParams;
  /** When time-stop hit: resume historical from this page start. */
  resumePageParams: TransferIndexNextPageParams;
  recentChunkCount: number;
};

async function runIndexedPageSession(params: {
  chainId: number;
  tokenAddress: string;
  generation: number;
  priorTransfers: BlockscoutTokenTransferRow[];
  basePages: number;
  pagesBudget: number;
  startNextPageParams: TransferIndexNextPageParams;
  shouldContinue?: () => boolean;
  stopAtOrBeforeTimestampMs?: number;
  recentChunkCountSeed: number;
  /**
   * When true and time-stop fires, persist resume cursor as pageStartParams
   * (re-fetch boundary page without stop) instead of next page.
   */
  persistTimeStopAsPageStart?: boolean;
  onPageProgress?: (event: {
    pagesFetchedTotal: number;
    pagesFetchedThisCall?: number;
    transfersIndexed: number;
    pageInFetch: number;
    paginationComplete: boolean;
    pipelinePhase: TransferIndexPipelinePhase;
  }) => void | Promise<void>;
  pipelinePhaseForProgress?: TransferIndexPipelinePhase;
  signal?: AbortSignal;
}): Promise<IndexedPageSessionResult> {
  let pagesFetchedTotal = params.basePages;
  let recentChunkCount = params.recentChunkCountSeed;
  let nextPageParams: TransferIndexNextPageParams = params.startNextPageParams;
  let resumePageParams: TransferIndexNextPageParams = params.startNextPageParams;
  let runningNewTransfers = 0;
  const sessionPages: BlockscoutTokenTransferRow[] = [];

  const page = await fetchTokenTransfersPaged(params.tokenAddress, {
    maxPages: params.pagesBudget,
    startNextPageParams: params.startNextPageParams,
    stopAtOrBeforeTimestampMs: params.stopAtOrBeforeTimestampMs,
    shouldContinue: params.shouldContinue,
    signal: params.signal,
    onPage: async (event) => {
      pagesFetchedTotal = params.basePages + event.pageInFetch;
      runningNewTransfers += event.pageTransfers.length;
      sessionPages.push(...event.pageTransfers);

      const chunkIndex = pagesFetchedTotal - 1;
      if (chunkIndex >= 0 && chunkIndex < TRANSFER_INDEX_MAX_RECENT_CHUNKS) {
        const chunkRes = await persistTransferIndexChunk(
          params.chainId,
          params.tokenAddress,
          chunkIndex,
          event.pageTransfers.map(toChunkRow),
          params.generation,
        );
        if (chunkRes.ok) {
          recentChunkCount = Math.max(recentChunkCount, chunkIndex + 1);
        }
      }

      const bounds = headTailFromTransfers(
        mergeUniqueTransfers(params.priorTransfers, sessionPages),
      );
      // Time-stop mid-page: store pageStart so historical can re-fetch remainder.
      if (
        event.stoppedAtCursor &&
        params.persistTimeStopAsPageStart &&
        event.pageStartParams !== undefined
      ) {
        nextPageParams = (event.pageStartParams ??
          null) as TransferIndexNextPageParams;
      } else {
        nextPageParams = (event.nextPageParams ??
          null) as TransferIndexNextPageParams;
      }
      resumePageParams = (event.pageStartParams ??
        event.nextPageParams ??
        null) as TransferIndexNextPageParams;

      const paginationComplete = event.paginationComplete === true;
      const transfersIndexedApprox =
        params.priorTransfers.length + runningNewTransfers;

      await persistTransferIndexMeta(
        params.chainId,
        params.tokenAddress,
        {
          generation: params.generation,
          headTimestampMs: bounds.headTimestampMs,
          headBlock: bounds.headBlock,
          tailTimestampMs: bounds.tailTimestampMs,
          tailBlock: bounds.tailBlock,
          nextPageParams: paginationComplete ? null : nextPageParams,
          // Never claim complete on time-stop / budget stop.
          paginationComplete,
          pagesFetchedTotal,
          transfersIndexed: transfersIndexedApprox,
          recentChunkCount,
          indexState: paginationComplete ? "complete" : "indexing",
          lastError: null,
        },
      );

      if (params.onPageProgress) {
        await params.onPageProgress({
          pagesFetchedTotal,
          pagesFetchedThisCall: event.pageInFetch,
          transfersIndexed: transfersIndexedApprox,
          pageInFetch: event.pageInFetch,
          paginationComplete,
          pipelinePhase: params.pipelinePhaseForProgress ?? "indexing",
        });
      }
    },
  });

  // Defensive: mocked / aborted fetchers must not crash the pipeline.
  const pageTransfers = page?.transfers ?? [];
  const pagePagesFetched = page?.pagesFetched ?? 0;
  const pageComplete = page?.paginationComplete === true;
  const pageFailed = page?.fetchFailed === true;
  const pageStopped = page?.stoppedAtCursor === true;
  const pageNext = (page?.nextPageParams ?? null) as TransferIndexNextPageParams;
  const pageResume = (page?.resumePageParams ??
    pageNext) as TransferIndexNextPageParams;

  const merged = mergeUniqueTransfers(params.priorTransfers, pageTransfers);
  pagesFetchedTotal = params.basePages + pagePagesFetched;
  const paginationComplete = pageComplete;
  if (pageStopped && params.persistTimeStopAsPageStart) {
    nextPageParams = pageResume;
  } else {
    nextPageParams = pageNext ?? nextPageParams;
  }
  resumePageParams = pageResume;
  const bounds = headTailFromTransfers(merged);

  const finalPersist = await persistTransferIndexMeta(
    params.chainId,
    params.tokenAddress,
    {
      generation: params.generation,
      headTimestampMs: bounds.headTimestampMs,
      headBlock: bounds.headBlock,
      tailTimestampMs: bounds.tailTimestampMs,
      tailBlock: bounds.tailBlock,
      nextPageParams: paginationComplete ? null : nextPageParams,
      paginationComplete,
      pagesFetchedTotal,
      transfersIndexed: merged.length,
      recentChunkCount,
      indexState: paginationComplete
        ? "complete"
        : pageFailed
          ? "failed"
          : "indexing",
      lastError: pageFailed ? "blockscout_fetch_failed" : null,
    },
  );

  const meta = finalPersist.ok
    ? finalPersist.meta
    : await loadTransferIndexMeta(params.chainId, params.tokenAddress);

  return {
    transfers: merged,
    pagesFetchedTotal,
    paginationComplete,
    fetchFailed: pageFailed,
    stoppedAtCursor: pageStopped,
    meta,
    rpcPages: pagePagesFetched,
    nextPageParams,
    resumePageParams,
    recentChunkCount,
  };
}

async function runRecentFirstSession(params: {
  chainId: number;
  tokenAddress: string;
  generation: number;
  maxPages: number;
  recentTierMaxPages: number;
  recentTierMaxAgeMs: number;
  nowMs: number;
  shouldContinue?: () => boolean;
  onRecentTier?: (
    partial: FetchTokenTransfersWithCheckpointResult,
  ) => void | Promise<void>;
  onPageProgress?: (event: {
    pagesFetchedTotal: number;
    pagesFetchedThisCall?: number;
    transfersIndexed: number;
    pageInFetch: number;
    paginationComplete: boolean;
    pipelinePhase: TransferIndexPipelinePhase;
  }) => void | Promise<void>;
  priorTransfers: BlockscoutTokenTransferRow[];
  rebuild: boolean;
  signal?: AbortSignal;
}): Promise<FetchTokenTransfersWithCheckpointResult> {
  const stopAt = params.nowMs - params.recentTierMaxAgeMs;
  const recentBudget = Math.min(params.recentTierMaxPages, params.maxPages);

  // 1) Latest pages (recent tier) — never claim Complete here unless genesis ends.
  const recent = await runIndexedPageSession({
    chainId: params.chainId,
    tokenAddress: params.tokenAddress,
    generation: params.generation,
    priorTransfers: params.priorTransfers,
    basePages: 0,
    pagesBudget: recentBudget,
    startNextPageParams: null,
    shouldContinue: params.shouldContinue,
    stopAtOrBeforeTimestampMs: stopAt,
    recentChunkCountSeed: 0,
    persistTimeStopAsPageStart: true,
    onPageProgress: params.onPageProgress,
    pipelinePhaseForProgress: "analyzing",
    signal: params.signal,
  });

  const recentValidation = evaluateTransferIndexStatus(recent.meta, {
    chainId: params.chainId,
    tokenAddress: params.tokenAddress,
  });

  const recentPartial: FetchTokenTransfersWithCheckpointResult = {
    transfers: recent.transfers,
    pagesFetched: recent.pagesFetchedTotal,
    // Honesty: time-stop / page-cap must not claim genesis complete.
    paginationComplete: recent.paginationComplete,
    fetchFailed: recent.fetchFailed && recent.pagesFetchedTotal === 0,
    stoppedAtCursor: recent.stoppedAtCursor,
    meta: recent.meta,
    resumedFromCheckpoint: false,
    generation: params.generation,
    reuseStatus: recentValidation.status,
    fetchMode: "recent_first",
    rpcPagesThisCall: recent.rpcPages,
    cacheHit: false,
    pipelinePhase: recent.paginationComplete ? "complete" : "analyzing",
    recentTierComplete: true,
    historicalContinuationPending: !recent.paginationComplete,
    stats: emptyStats({
      rpcPagesThisCall: recent.rpcPages,
      recentTierPages: recent.rpcPages,
    }),
  };

  if (params.onRecentTier) {
    await params.onRecentTier(recentPartial);
  }

  if (recent.paginationComplete) {
    return {
      ...recentPartial,
      pipelinePhase: "complete",
      historicalContinuationPending: false,
    };
  }

  // Failed empty recent tier — do not start historical (cache/RPC fallback path).
  if (recent.fetchFailed && recent.pagesFetchedTotal === 0) {
    return {
      ...recentPartial,
      pipelinePhase: "indexing",
      historicalContinuationPending: true,
    };
  }

  const canContinue =
    (!params.shouldContinue || params.shouldContinue() !== false) &&
    !params.signal?.aborted;
  const historicalBudget = Math.max(
    0,
    params.maxPages - recent.pagesFetchedTotal,
  );

  if (!canContinue || historicalBudget <= 0) {
    // Leave checkpoint for background / next Deep resume.
    return {
      ...recentPartial,
      pipelinePhase: "analyzing",
      historicalContinuationPending: true,
    };
  }

  // 2) Remaining historical pages from checkpoint cursor (no time stop).
  const histStart =
    recent.stoppedAtCursor && recent.resumePageParams != null
      ? recent.resumePageParams
      : recent.nextPageParams;

  // Time-stop re-fetches boundary page: do not double-count that page in totals.
  const histBasePages =
    recent.stoppedAtCursor && histStart != null
      ? Math.max(0, recent.pagesFetchedTotal - 1)
      : recent.pagesFetchedTotal;

  const historical = await runIndexedPageSession({
    chainId: params.chainId,
    tokenAddress: params.tokenAddress,
    generation: params.generation,
    priorTransfers: recent.transfers,
    basePages: histBasePages,
    pagesBudget: historicalBudget,
    startNextPageParams: histStart,
    shouldContinue: params.shouldContinue,
    stopAtOrBeforeTimestampMs: undefined,
    recentChunkCountSeed: recent.recentChunkCount,
    persistTimeStopAsPageStart: false,
    onPageProgress: params.onPageProgress,
    pipelinePhaseForProgress: "indexing",
    signal: params.signal,
  });

  const finalValidation = evaluateTransferIndexStatus(historical.meta, {
    chainId: params.chainId,
    tokenAddress: params.tokenAddress,
  });
  const paginationComplete = historical.paginationComplete;
  const rpcTotal = recent.rpcPages + historical.rpcPages;

  return {
    transfers: historical.transfers,
    pagesFetched: historical.pagesFetchedTotal,
    paginationComplete,
    fetchFailed:
      recent.fetchFailed &&
      historical.fetchFailed &&
      historical.pagesFetchedTotal === 0,
    stoppedAtCursor: historical.stoppedAtCursor,
    meta: historical.meta,
    resumedFromCheckpoint: false,
    generation: params.generation,
    reuseStatus: finalValidation.status,
    fetchMode: "recent_first",
    rpcPagesThisCall: rpcTotal,
    cacheHit: false,
    pipelinePhase: paginationComplete ? "complete" : "indexing",
    recentTierComplete: true,
    historicalContinuationPending: !paginationComplete,
    stats: emptyStats({
      rpcPagesThisCall: rpcTotal,
      recentTierPages: recent.rpcPages,
      historicalPagesThisCall: historical.rpcPages,
    }),
  };
}

async function runHeadRefresh(params: {
  chainId: number;
  tokenAddress: string;
  priorMeta: TransferIndexMeta;
  validation: TransferIndexValidation;
  shouldContinue?: () => boolean;
  maxPages: number;
  /**
   * When false, keep paginationComplete=false (warm incomplete head path).
   * Default true: genesis-complete head refresh must not clear completeness.
   */
  preservePaginationComplete?: boolean;
  onPageProgress?: (event: {
    pagesFetchedTotal: number;
    pagesFetchedThisCall?: number;
    transfersIndexed: number;
    pageInFetch: number;
    paginationComplete: boolean;
    pipelinePhase: TransferIndexPipelinePhase;
  }) => void | Promise<void>;
  signal?: AbortSignal;
}): Promise<FetchTokenTransfersWithCheckpointResult> {
  const { chainId, tokenAddress, priorMeta } = params;
  const generation = await beginTransferIndexGeneration(chainId, tokenAddress);
  const priorTransfers = await loadPriorChunkTransfers(
    chainId,
    tokenAddress,
    priorMeta.recentChunkCount,
  );

  // Reorg safety: stop slightly before stored head so overlap window is re-fetched.
  const stopAt = warmHeadStopTimestampMs(priorMeta.headTimestampMs);

  const page = await fetchTokenTransfersPaged(tokenAddress, {
    maxPages: params.maxPages,
    stopAtOrBeforeTimestampMs: stopAt,
    shouldContinue: params.shouldContinue,
    signal: params.signal,
    onPage: async (event) => {
      // Newest page → chunk 0; shift is not required for semantic correctness
      // (analyzers dedupe). Persist newest window at index 0.
      if (event.pageInFetch === 1) {
        await persistTransferIndexChunk(
          chainId,
          tokenAddress,
          0,
          event.pageTransfers.map(toChunkRow),
          generation,
        );
      }
      if (params.onPageProgress) {
        // Phase 7.3: monotonic head-refresh progress — pageInFetch advances
        // even when lifetime pagesFetchedTotal is unchanged (complete index).
        await params.onPageProgress({
          pagesFetchedTotal: priorMeta.pagesFetchedTotal + event.pageInFetch,
          pagesFetchedThisCall: event.pageInFetch,
          transfersIndexed: Math.max(
            priorMeta.transfersIndexed,
            priorTransfers.length + event.pageTransfers.length,
          ),
          pageInFetch: event.pageInFetch,
          paginationComplete: priorMeta.paginationComplete === true,
          pipelinePhase: "indexing",
        });
      }
    },
  });

  const { merged, stats: mergeStats } = mergeHeadWithOverlap({
    prior: priorTransfers,
    incoming: page.transfers,
    chainId,
    tokenAddress,
    headBlock: priorMeta.headBlock,
    headTimestampMs: priorMeta.headTimestampMs,
  });
  const bounds = headTailFromTransfers(merged);
  // Genesis remains complete unless caller forces incomplete honesty.
  const paginationComplete =
    params.preservePaginationComplete === false
      ? false
      : priorMeta.paginationComplete === true;
  const recentChunkCount = Math.max(
    priorMeta.recentChunkCount,
    page.pagesFetched > 0 ? 1 : 0,
  );

  const finalPersist = await persistTransferIndexMeta(chainId, tokenAddress, {
    generation,
    headTimestampMs: bounds.headTimestampMs ?? priorMeta.headTimestampMs,
    headBlock: bounds.headBlock ?? priorMeta.headBlock,
    tailTimestampMs: priorMeta.tailTimestampMs,
    tailBlock: priorMeta.tailBlock,
    // Preserve historical resume cursor when genesis incomplete.
    nextPageParams:
      paginationComplete || priorMeta.paginationComplete === true
        ? null
        : priorMeta.nextPageParams,
    paginationComplete,
    pagesFetchedTotal: priorMeta.pagesFetchedTotal,
    transfersIndexed: Math.max(priorMeta.transfersIndexed, merged.length),
    recentChunkCount,
    indexState: paginationComplete ? "complete" : "indexing",
    lastError: page.fetchFailed ? "head_refresh_partial" : null,
  });

  const meta = finalPersist.ok
    ? finalPersist.meta
    : await loadTransferIndexMeta(chainId, tokenAddress);
  // After successful head refresh on complete index, status should be complete (fresh).
  const finalValidation = evaluateTransferIndexStatus(meta, {
    chainId,
    tokenAddress,
  });

  return {
    transfers: merged,
    pagesFetched: priorMeta.pagesFetchedTotal,
    paginationComplete,
    fetchFailed: false,
    stoppedAtCursor: page.stoppedAtCursor,
    meta,
    resumedFromCheckpoint: true,
    generation,
    reuseStatus: finalValidation.status,
    fetchMode: "head_refresh",
    rpcPagesThisCall: page.pagesFetched,
    cacheHit: false,
    pipelinePhase: paginationComplete ? "complete" : "indexing",
    recentTierComplete: true,
    historicalContinuationPending: !paginationComplete,
    stats: emptyStats({
      rpcPagesThisCall: page.pagesFetched,
      skippedPages: priorMeta.pagesFetchedTotal,
      checkpointReuse: true,
      newTransfersMerged: mergeStats.newTransfersMerged,
      duplicatesSuppressed: mergeStats.duplicatesSuppressed,
      overlapReplaced: mergeStats.overlapReplaced,
    }),
  };
}

/**
 * Early-buy page for Relationships: prefer transfer-index chunk 0 when present.
 * Falls back to null so caller can use Blockscout (no semantic change).
 */
export async function loadEarlyTransfersFromIndex(
  tokenAddress: string,
  chainId: number = SCAN_CHAIN_ID,
): Promise<Array<{ to: string; blockNumber: number }> | null> {
  const meta = await loadTransferIndexMeta(chainId, tokenAddress);
  const v = evaluateTransferIndexStatus(meta, { chainId, tokenAddress });
  if (!v.reusable || !meta || meta.recentChunkCount <= 0) return null;
  const chunk = await loadTransferIndexChunk(chainId, tokenAddress, 0);
  if (!chunk || chunk.transfers.length === 0) return null;
  const out: Array<{ to: string; blockNumber: number }> = [];
  for (const t of chunk.transfers) {
    if (t.blockNumber == null) continue;
    out.push({ to: t.to, blockNumber: t.blockNumber });
  }
  return out.length > 0 ? out : null;
}

/**
 * Read checkpoint progress without acquiring the write lock (soft-fail / UI).
 */
export async function loadTransferIndexProgress(tokenAddress: string): Promise<{
  pagesFetched: number;
  transfersIndexed: number;
  paginationComplete: boolean;
  nextPageParams: TransferIndexNextPageParams;
  generation: number | null;
  indexState: TransferIndexMeta["indexState"] | null;
  reuseStatus: TransferIndexReuseStatus | null;
  meta: TransferIndexMeta | null;
}> {
  const meta = await loadTransferIndexMeta(SCAN_CHAIN_ID, tokenAddress);
  if (!meta) {
    return {
      pagesFetched: 0,
      transfersIndexed: 0,
      paginationComplete: false,
      nextPageParams: null,
      generation: null,
      indexState: null,
      reuseStatus: null,
      meta: null,
    };
  }
  const v = evaluateTransferIndexStatus(meta, {
    chainId: SCAN_CHAIN_ID,
    tokenAddress,
  });
  return {
    pagesFetched: meta.pagesFetchedTotal,
    transfersIndexed: meta.transfersIndexed,
    paginationComplete: meta.paginationComplete === true,
    nextPageParams: meta.nextPageParams,
    generation: meta.generation,
    indexState: meta.indexState,
    reuseStatus: v.status,
    meta,
  };
}

const backgroundRefreshInflight = new Set<string>();

/**
 * Fast-path / warm-path: non-blocking transfer-index refresh when needed.
 * Also used after recent-first Deep to continue historical pages in background.
 * Does not mutate ScanResponse. Safe if KV/lock unavailable.
 */
export function scheduleTransferIndexBackgroundRefresh(params: {
  tokenAddress: string;
  chainId?: number;
  maxPages?: number;
  /** When true, resume incomplete indexes even if not "stale". */
  forceResume?: boolean;
}): void {
  const chainId = params.chainId ?? SCAN_CHAIN_ID;
  const key = `${chainId}:${params.tokenAddress.toLowerCase()}`;
  if (backgroundRefreshInflight.has(key)) return;
  backgroundRefreshInflight.add(key);
  void (async () => {
    try {
      const v = await evaluateTransferIndexStatus(
        await loadTransferIndexMeta(chainId, params.tokenAddress),
        { chainId, tokenAddress: params.tokenAddress },
      );
      if (
        !params.forceResume &&
        !v.needsBackgroundRefresh &&
        v.status === "complete"
      ) {
        return;
      }
      if (
        params.forceResume &&
        v.status === "complete" &&
        !v.needsHeadRefresh
      ) {
        return;
      }
      await fetchTokenTransfersWithCheckpoint({
        tokenAddress: params.tokenAddress,
        chainId,
        maxPages:
          params.maxPages ??
          (v.needsHeadRefresh
            ? TRANSFER_INDEX_HEAD_REFRESH_MAX_PAGES
            : 10),
        lockTtlSec: 180,
        // Background historical continuation — no nested recent-first.
        recentFirst: false,
      });
    } catch (err) {
      console.warn("[transfer-index] background refresh failed:", err);
    } finally {
      backgroundRefreshInflight.delete(key);
    }
  })();
}
