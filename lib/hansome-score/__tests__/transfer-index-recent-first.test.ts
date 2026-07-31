/**
 * Cold Perf V2 Phase 4 — recent-first pipeline tests.
 * Required: resume, interrupt, ordering, historical completion, duplicate-page
 * avoidance, concurrent, stale/rebuild checkpoint, partial cache, timeout,
 * cache fallback, semantic equivalence (Incomplete honesty).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BlockscoutTokenTransferRow } from "@/lib/hansome-score/blockscout";
import {
  beginTransferIndexGeneration,
  clearTransferIndexLockTestKv,
  clearTransferIndexMemoryForTests,
  clearTransferIndexTestKv,
  fetchTokenTransfersWithCheckpoint,
  persistTransferIndexChunk,
  persistTransferIndexMeta,
  TRANSFER_INDEX_RECENT_TIER_MAX_PAGES,
  useTransferIndexLockTestKv,
  useTransferIndexTestKv,
  type TransferIndexChunkRow,
} from "@/lib/hansome-score/transfer-index";
import { transferIndexMetaKey } from "@/lib/hansome-score/transfer-index/keys";
import { analyzeCreatorBehaviour } from "@/lib/hansome-score/creator";

const CHAIN = 4663;
const FOX = "0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1";
const HANSOME = "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875";

const NOW = 1_720_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function row(
  i: number,
  opts?: { block?: number; ts?: number },
): BlockscoutTokenTransferRow {
  const ts = opts?.ts ?? NOW - i * 60_000;
  return {
    from: `0x${(i + 1).toString(16).padStart(40, "0")}`,
    to: `0x${(i + 2).toString(16).padStart(40, "0")}`,
    valueRaw: String(1_000n * BigInt(i + 1)),
    blockNumber: opts?.block ?? 9_000_000 - i,
    timestamp: new Date(ts).toISOString(),
    txHash: `0x${i.toString(16).padStart(64, "0")}`,
    toIsContract: false,
    method: "transfer",
  };
}

function toChunk(t: BlockscoutTokenTransferRow): TransferIndexChunkRow {
  return {
    from: t.from,
    to: t.to,
    valueRaw: t.valueRaw,
    blockNumber: t.blockNumber,
    timestampMs: t.timestamp ? Date.parse(t.timestamp) : null,
    txHash: t.txHash,
    toIsContract: t.toIsContract,
    method: t.method,
  };
}

vi.mock("@/lib/hansome-score/blockscout", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/hansome-score/blockscout")
  >("@/lib/hansome-score/blockscout");
  return {
    ...actual,
    fetchTokenTransfersPaged: vi.fn(),
  };
});

import { fetchTokenTransfersPaged } from "@/lib/hansome-score/blockscout";

const fetchPaged = vi.mocked(fetchTokenTransfersPaged);

describe("transfer-index Phase 4 recent-first", () => {
  let kv: Map<string, unknown>;
  let lockKv: Map<string, { value: string; until: number }>;

  beforeEach(() => {
    clearTransferIndexMemoryForTests();
    clearTransferIndexTestKv();
    clearTransferIndexLockTestKv();
    kv = new Map();
    lockKv = new Map();
    useTransferIndexTestKv(kv);
    useTransferIndexLockTestKv(lockKv);
    fetchPaged.mockReset();
  });

  afterEach(() => {
    clearTransferIndexMemoryForTests();
    clearTransferIndexTestKv();
    clearTransferIndexLockTestKv();
  });

  it("recent-first ordering: latest pages before historical continuation", async () => {
    const calls: Array<Record<string, unknown> | undefined> = [];
    const recentEvents: number[] = [];
    fetchPaged.mockImplementation(async (_addr, opts) => {
      calls.push(opts as Record<string, unknown>);
      if (calls.length === 1) {
        // Recent tier: 6 pages, incomplete
        expect(opts?.maxPages).toBe(TRANSFER_INDEX_RECENT_TIER_MAX_PAGES);
        expect(opts?.stopAtOrBeforeTimestampMs).toBe(NOW - 7 * DAY);
        expect(opts?.startNextPageParams ?? null).toBeNull();
        return {
          transfers: [row(0), row(1), row(2), row(3), row(4), row(5)],
          pagesFetched: 6,
          paginationComplete: false,
          fetchFailed: false,
          stoppedAtCursor: false,
          nextPageParams: { block_number: 8_999_900, index: 6 },
          resumePageParams: { block_number: 8_999_900, index: 6 },
        };
      }
      // Historical: resumes cursor, no time stop
      expect(opts?.stopAtOrBeforeTimestampMs).toBeUndefined();
      expect(opts?.startNextPageParams).toEqual({
        block_number: 8_999_900,
        index: 6,
      });
      return {
        transfers: [row(6), row(7)],
        pagesFetched: 2,
        paginationComplete: true,
        fetchFailed: false,
        stoppedAtCursor: false,
        nextPageParams: null,
        resumePageParams: null,
      };
    });

    const r = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: FOX,
      maxPages: 40,
      recentFirst: true,
      nowMs: NOW,
      onRecentTier: async (partial) => {
        recentEvents.push(partial.pagesFetched);
        expect(partial.paginationComplete).toBe(false);
        expect(partial.fetchMode).toBe("recent_first");
        expect(partial.pipelinePhase).toBe("analyzing");
        expect(partial.historicalContinuationPending).toBe(true);
      },
    });

    expect(calls).toHaveLength(2);
    expect(recentEvents).toEqual([6]);
    expect(r.fetchMode).toBe("recent_first");
    expect(r.paginationComplete).toBe(true);
    expect(r.pipelinePhase).toBe("complete");
    expect(r.stats.recentTierPages).toBe(6);
    expect(r.stats.historicalPagesThisCall).toBe(2);
    expect(r.transfers.length).toBeGreaterThanOrEqual(8);
  });

  it("never claims Complete from recent tier alone", async () => {
    fetchPaged.mockResolvedValueOnce({
      transfers: [row(0), row(1)],
      pagesFetched: 2,
      paginationComplete: false,
      fetchFailed: false,
      stoppedAtCursor: true,
      nextPageParams: { block_number: 1, index: 2 },
      resumePageParams: null,
    });
    // maxPages equals recent pages fetched → no historical budget after recent
    const r = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: FOX,
      maxPages: 2,
      recentFirst: true,
      recentTierMaxPages: 2,
      nowMs: NOW,
      onRecentTier: async (partial) => {
        expect(partial.paginationComplete).toBe(false);
        expect(partial.pipelinePhase).toBe("analyzing");
      },
    });
    expect(r.paginationComplete).toBe(false);
    expect(r.historicalContinuationPending).toBe(true);
    expect(r.recentTierComplete).toBe(true);
    expect(fetchPaged).toHaveBeenCalledTimes(1);
  });

  it("resume from checkpoint skips recent re-walk (duplicate-page avoidance)", async () => {
    const gen = await beginTransferIndexGeneration(CHAIN, FOX);
    await persistTransferIndexChunk(CHAIN, FOX, 0, [toChunk(row(0))], gen);
    await persistTransferIndexMeta(CHAIN, FOX, {
      generation: gen,
      headTimestampMs: NOW,
      headBlock: 9_000_000,
      tailTimestampMs: NOW - 60_000,
      tailBlock: 8_999_999,
      nextPageParams: { block_number: 8_999_000, index: 6 },
      paginationComplete: false,
      pagesFetchedTotal: 6,
      transfersIndexed: 12,
      recentChunkCount: 1,
      indexState: "indexing",
      lastError: null,
    });

    fetchPaged.mockResolvedValueOnce({
      transfers: [row(10), row(11)],
      pagesFetched: 2,
      paginationComplete: true,
      fetchFailed: false,
      stoppedAtCursor: false,
      nextPageParams: null,
      resumePageParams: null,
    });

    const recentCb = vi.fn();
    const r = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: FOX,
      maxPages: 40,
      recentFirst: true,
      nowMs: NOW,
      onRecentTier: recentCb,
    });

    expect(recentCb).not.toHaveBeenCalled();
    expect(r.fetchMode).toBe("resume");
    expect(r.pipelinePhase).toBe("complete");
    expect(r.stats.checkpointReuse).toBe(true);
    expect(r.stats.skippedPages).toBe(6);
    expect(fetchPaged).toHaveBeenCalledTimes(1);
    const opts = fetchPaged.mock.calls[0]?.[1];
    expect(opts?.startNextPageParams).toEqual({
      block_number: 8_999_000,
      index: 6,
    });
    // Must not apply recent-tier time stop on resume
    expect(opts?.stopAtOrBeforeTimestampMs).toBeUndefined();
  });

  it("interrupted scan resumes historical without re-fetching recent pages", async () => {
    // First call: recent only (no historical budget)
    fetchPaged.mockResolvedValueOnce({
      transfers: [row(0), row(1), row(2)],
      pagesFetched: 3,
      paginationComplete: false,
      fetchFailed: false,
      stoppedAtCursor: false,
      nextPageParams: { block_number: 100, index: 3 },
      resumePageParams: { block_number: 100, index: 3 },
    });
    const first = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: HANSOME,
      maxPages: 3,
      recentFirst: true,
      recentTierMaxPages: 3,
      nowMs: NOW,
    });
    expect(first.paginationComplete).toBe(false);
    expect(first.historicalContinuationPending).toBe(true);
    expect(fetchPaged).toHaveBeenCalledTimes(1);

    fetchPaged.mockResolvedValueOnce({
      transfers: [row(3), row(4)],
      pagesFetched: 2,
      paginationComplete: true,
      fetchFailed: false,
      stoppedAtCursor: false,
      nextPageParams: null,
      resumePageParams: null,
    });
    const second = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: HANSOME,
      maxPages: 40,
      recentFirst: true,
      nowMs: NOW,
    });
    expect(second.fetchMode).toBe("resume");
    expect(second.paginationComplete).toBe(true);
    expect(second.stats.resumedPages).toBeGreaterThanOrEqual(3);
  });

  it("historical completion sets paginationComplete only after genesis", async () => {
    fetchPaged
      .mockResolvedValueOnce({
        transfers: [row(0)],
        pagesFetched: 1,
        paginationComplete: true,
        fetchFailed: false,
        stoppedAtCursor: false,
        nextPageParams: null,
        resumePageParams: null,
      });
    const r = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: HANSOME,
      maxPages: 40,
      recentFirst: true,
      nowMs: NOW,
    });
    expect(r.paginationComplete).toBe(true);
    expect(r.pipelinePhase).toBe("complete");
    expect(r.historicalContinuationPending).toBe(false);
    // Single recent call when genesis ends inside recent tier
    expect(fetchPaged).toHaveBeenCalledTimes(1);
  });

  it("concurrent scans: lock miss returns concurrent_reuse without duplicate writer", async () => {
    const { acquireTransferIndexLock, releaseTransferIndexLock } = await import(
      "@/lib/hansome-score/transfer-index"
    );
    const lock = await acquireTransferIndexLock(CHAIN, FOX, { ttlSec: 60 });
    expect(lock.acquired).toBe(true);
    fetchPaged.mockResolvedValue({
      transfers: [row(0)],
      pagesFetched: 1,
      paginationComplete: false,
      fetchFailed: false,
      stoppedAtCursor: false,
      nextPageParams: { x: 1 },
      resumePageParams: { x: 1 },
    });
    const r = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: FOX,
      maxPages: 40,
      recentFirst: true,
      nowMs: NOW,
    });
    expect(r.fetchMode).toBe("concurrent_reuse");
    expect(r.rpcPagesThisCall).toBe(0);
    expect(fetchPaged).not.toHaveBeenCalled();
    await releaseTransferIndexLock(CHAIN, FOX);
  });

  it("stale complete uses head refresh (latest pages) not full recent rebuild", async () => {
    const gen = await beginTransferIndexGeneration(CHAIN, HANSOME);
    await persistTransferIndexChunk(CHAIN, HANSOME, 0, [toChunk(row(0))], gen);
    const staleUpdatedAt = Date.now() - 60 * 60 * 1000;
    const meta = {
      version: 1 as const,
      chainId: CHAIN,
      address: HANSOME.toLowerCase(),
      headTimestampMs: NOW - DAY,
      headBlock: 9_000_000,
      tailTimestampMs: NOW - 30 * DAY,
      tailBlock: 1,
      nextPageParams: null,
      paginationComplete: true,
      pagesFetchedTotal: 20,
      transfersIndexed: 100,
      recentChunkCount: 1,
      indexState: "complete" as const,
      generation: gen,
      updatedAt: staleUpdatedAt,
      lastError: null,
    };
    // Drop L1 memory so status is evaluated from stale KV meta.
    clearTransferIndexMemoryForTests();
    kv.set(transferIndexMetaKey(CHAIN, HANSOME), meta);

    fetchPaged.mockResolvedValueOnce({
      transfers: [row(0, { ts: NOW })],
      pagesFetched: 1,
      paginationComplete: false,
      fetchFailed: false,
      stoppedAtCursor: true,
      nextPageParams: null,
      resumePageParams: null,
    });

    const r = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: HANSOME,
      maxPages: 40,
      recentFirst: true,
      nowMs: NOW,
    });
    expect(r.fetchMode).toBe("head_refresh");
    expect(r.paginationComplete).toBe(true);
    expect(optsMaxPages(fetchPaged.mock.calls[0]?.[1])).toBeLessThanOrEqual(5);
  });

  it("rebuilding checkpoint: forceRebuild starts recent-first from page 1", async () => {
    const gen = await beginTransferIndexGeneration(CHAIN, FOX);
    await persistTransferIndexMeta(CHAIN, FOX, {
      generation: gen,
      headTimestampMs: NOW,
      headBlock: 1,
      tailTimestampMs: NOW,
      tailBlock: 1,
      nextPageParams: { corrupt: 1 },
      paginationComplete: false,
      pagesFetchedTotal: 3,
      transfersIndexed: 3,
      recentChunkCount: 0,
      indexState: "failed",
      lastError: "x",
    });

    fetchPaged.mockResolvedValueOnce({
      transfers: [row(0)],
      pagesFetched: 1,
      paginationComplete: true,
      fetchFailed: false,
      stoppedAtCursor: false,
      nextPageParams: null,
      resumePageParams: null,
    });

    const r = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: FOX,
      maxPages: 40,
      recentFirst: true,
      forceRebuild: true,
      nowMs: NOW,
    });
    expect(r.fetchMode).toBe("recent_first");
    expect(fetchPaged.mock.calls[0]?.[1]?.startNextPageParams ?? null).toBeNull();
  });

  it("partial cache / timeout recovery: empty fail does not claim complete", async () => {
    fetchPaged.mockResolvedValueOnce({
      transfers: [],
      pagesFetched: 0,
      paginationComplete: false,
      fetchFailed: true,
      stoppedAtCursor: false,
      nextPageParams: null,
      resumePageParams: null,
    });
    const r = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: FOX,
      maxPages: 40,
      recentFirst: true,
      nowMs: NOW,
    });
    expect(r.paginationComplete).toBe(false);
    expect(r.fetchFailed).toBe(true);
    expect(r.pipelinePhase).not.toBe("complete");
  });

  it("cache fallback: complete fresh reuse_hit skips RPC", async () => {
    const gen = await beginTransferIndexGeneration(CHAIN, HANSOME);
    await persistTransferIndexChunk(
      CHAIN,
      HANSOME,
      0,
      [toChunk(row(0)), toChunk(row(1))],
      gen,
    );
    await persistTransferIndexMeta(CHAIN, HANSOME, {
      generation: gen,
      headTimestampMs: NOW,
      headBlock: 9_000_000,
      tailTimestampMs: NOW - DAY,
      tailBlock: 1,
      nextPageParams: null,
      paginationComplete: true,
      pagesFetchedTotal: 4,
      transfersIndexed: 8,
      recentChunkCount: 1,
      indexState: "complete",
      lastError: null,
    });
    const r = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: HANSOME,
      maxPages: 40,
      recentFirst: true,
      nowMs: NOW,
    });
    expect(r.fetchMode).toBe("reuse_hit");
    expect(r.cacheHit).toBe(true);
    expect(r.rpcPagesThisCall).toBe(0);
    expect(r.stats.skippedPages).toBe(4);
    expect(fetchPaged).not.toHaveBeenCalled();
  });

  it("semantic equivalence: recent-tier keeps creator available=false", async () => {
    const deployer = "0x1111111111111111111111111111111111111111";
    fetchPaged.mockResolvedValueOnce({
      transfers: [
        row(0),
        {
          ...row(1),
          from: deployer,
          to: "0x000000000000000000000000000000000000dEaD",
          valueRaw: "1000000000000000000",
        },
      ],
      pagesFetched: 2,
      paginationComplete: false,
      fetchFailed: false,
      stoppedAtCursor: false,
      nextPageParams: { i: 2 },
      resumePageParams: { i: 2 },
    });
    let early: Awaited<
      ReturnType<typeof fetchTokenTransfersWithCheckpoint>
    > | null = null;
    const r = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: FOX,
      maxPages: 2,
      recentFirst: true,
      recentTierMaxPages: 2,
      nowMs: NOW,
      onRecentTier: async (p) => {
        early = p;
      },
    });
    expect(early).not.toBeNull();
    const creator = analyzeCreatorBehaviour({
      deployer,
      totalSupply: 1_000_000n * 10n ** 18n,
      transfers: early!.transfers,
      paginationComplete: early!.paginationComplete,
      fetchFailed: early!.fetchFailed,
      pagesFetched: early!.pagesFetched,
    });
    expect(creator.available).toBe(false);
    expect(creator.paginationComplete).toBe(false);
    expect(creator.status).toBe("incomplete");
    expect(r.paginationComplete).toBe(false);

    // Uncached reference (no recentFirst, same partial window) — same honesty.
    clearTransferIndexMemoryForTests();
    clearTransferIndexTestKv();
    useTransferIndexTestKv(new Map());
    useTransferIndexLockTestKv(new Map());
    fetchPaged.mockResolvedValueOnce({
      transfers: early!.transfers,
      pagesFetched: early!.pagesFetched,
      paginationComplete: false,
      fetchFailed: false,
      stoppedAtCursor: false,
      nextPageParams: { i: 2 },
      resumePageParams: { i: 2 },
    });
    const uncached = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: FOX,
      maxPages: 2,
      recentFirst: false,
      nowMs: NOW,
    });
    const creator2 = analyzeCreatorBehaviour({
      deployer,
      totalSupply: 1_000_000n * 10n ** 18n,
      transfers: uncached.transfers,
      paginationComplete: uncached.paginationComplete,
      fetchFailed: uncached.fetchFailed,
      pagesFetched: uncached.pagesFetched,
    });
    expect(creator2.available).toBe(creator.available);
    expect(creator2.paginationComplete).toBe(creator.paginationComplete);
    expect(creator2.status).toBe(creator.status);
  });

  it("time-stop resume uses pageStartParams to avoid skipping boundary rows", async () => {
    const pageStart = { block_number: 50, index: 2 };
    fetchPaged
      .mockResolvedValueOnce({
        transfers: [row(0, { ts: NOW - DAY }), row(1, { ts: NOW - 2 * DAY })],
        pagesFetched: 2,
        paginationComplete: false,
        fetchFailed: false,
        stoppedAtCursor: true,
        nextPageParams: { block_number: 40, index: 3 },
        resumePageParams: pageStart,
      })
      .mockResolvedValueOnce({
        transfers: [
          row(1, { ts: NOW - 2 * DAY }),
          row(2, { ts: NOW - 10 * DAY }),
        ],
        pagesFetched: 1,
        paginationComplete: true,
        fetchFailed: false,
        stoppedAtCursor: false,
        nextPageParams: null,
        resumePageParams: null,
      });

    await fetchTokenTransfersWithCheckpoint({
      tokenAddress: FOX,
      maxPages: 40,
      recentFirst: true,
      nowMs: NOW,
    });
    expect(fetchPaged).toHaveBeenCalledTimes(2);
    expect(fetchPaged.mock.calls[1]?.[1]?.startNextPageParams).toEqual(
      pageStart,
    );
  });
});

function optsMaxPages(opts: unknown): number {
  if (opts && typeof opts === "object" && "maxPages" in opts) {
    return Number((opts as { maxPages?: number }).maxPages ?? 99);
  }
  return 99;
}
