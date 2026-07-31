/**
 * Phase 2 completion — transfer-index reuse / cache lifecycle tests.
 * Required: cache reuse, stale, partial, corruption, rebuild, retry, timeout,
 * version mismatch, concurrent scan, deep reuse.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BlockscoutTokenTransferRow } from "@/lib/hansome-score/blockscout";
import {
  acquireTransferIndexLock,
  beginTransferIndexGeneration,
  clearTransferIndexLockTestKv,
  clearTransferIndexMemoryForTests,
  clearTransferIndexTestKv,
  evaluateTransferIndexStatus,
  fetchTokenTransfersWithCheckpoint,
  loadEarlyTransfersFromIndex,
  loadTransferIndexMeta,
  persistTransferIndexChunk,
  persistTransferIndexMeta,
  releaseTransferIndexLock,
  scheduleTransferIndexBackgroundRefresh,
  useTransferIndexLockTestKv,
  useTransferIndexTestKv,
  TRANSFER_INDEX_HEAD_FRESH_MS,
  type TransferIndexChunkRow,
} from "@/lib/hansome-score/transfer-index";
import { transferIndexMetaKey } from "@/lib/hansome-score/transfer-index/keys";

const CHAIN = 4663;
const FOX = "0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1";
const HANSOME = "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875";

function row(
  i: number,
  opts?: { block?: number; ts?: number },
): BlockscoutTokenTransferRow {
  const ts = opts?.ts ?? 1_700_000_000_000 - i * 60_000;
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

describe("transfer-index Phase 2 reuse wiring", () => {
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

  async function seedCompleteFresh(pages = 2) {
    const gen = await beginTransferIndexGeneration(CHAIN, HANSOME);
    const transfers = [row(0), row(1), row(2), row(3)];
    await persistTransferIndexChunk(
      CHAIN,
      HANSOME,
      0,
      transfers.slice(0, 2).map(toChunk),
      gen,
    );
    await persistTransferIndexChunk(
      CHAIN,
      HANSOME,
      1,
      transfers.slice(2).map(toChunk),
      gen,
    );
    await persistTransferIndexMeta(CHAIN, HANSOME, {
      generation: gen,
      headTimestampMs: Date.parse(transfers[0]!.timestamp!),
      headBlock: transfers[0]!.blockNumber,
      tailTimestampMs: Date.parse(transfers[3]!.timestamp!),
      tailBlock: transfers[3]!.blockNumber,
      nextPageParams: null,
      paginationComplete: true,
      pagesFetchedTotal: pages,
      transfersIndexed: transfers.length,
      recentChunkCount: 2,
      indexState: "complete",
      lastError: null,
    });
    return transfers;
  }

  it("cache reuse: complete+fresh returns hit with zero RPC pages", async () => {
    const seeded = await seedCompleteFresh();
    const r = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: HANSOME,
      chainId: CHAIN,
      maxPages: 40,
    });
    expect(r.cacheHit).toBe(true);
    expect(r.fetchMode).toBe("reuse_hit");
    expect(r.reuseStatus).toBe("complete");
    expect(r.rpcPagesThisCall).toBe(0);
    expect(r.paginationComplete).toBe(true);
    expect(r.transfers.length).toBe(seeded.length);
    expect(fetchPaged).not.toHaveBeenCalled();
  });

  it("stale cache: head refresh — never reports reuseStatus=complete while stale", async () => {
    await seedCompleteFresh();
    const meta = await loadTransferIndexMeta(CHAIN, HANSOME);
    expect(meta).not.toBeNull();
    // Age meta beyond fresh window.
    const staleMeta = {
      ...meta!,
      updatedAt: Date.now() - TRANSFER_INDEX_HEAD_FRESH_MS - 60_000,
    };
    kv.set(transferIndexMetaKey(CHAIN, HANSOME), staleMeta);
    clearTransferIndexMemoryForTests();

    const v = evaluateTransferIndexStatus(staleMeta, {
      chainId: CHAIN,
      tokenAddress: HANSOME,
    });
    expect(v.status).toBe("stale");
    expect(v.reusable).toBe(true);
    expect(v.needsHeadRefresh).toBe(true);

    fetchPaged.mockImplementation(async (_addr, opts) => {
      // Phase 7: stopAt is head − reorg overlap (not exact head).
      expect(opts?.stopAtOrBeforeTimestampMs).toBeLessThan(
        staleMeta.headTimestampMs!,
      );
      expect((opts?.maxPages ?? 99) <= 5).toBe(true);
      const pageTransfers = [row(100, { ts: Date.now() })];
      if (opts?.onPage) {
        await opts.onPage({
          pageInFetch: 1,
          pageTransfers,
          nextPageParams: null,
          paginationComplete: false,
          stoppedAtCursor: true,
        });
      }
      return {
        transfers: pageTransfers,
        pagesFetched: 1,
        paginationComplete: false,
        fetchFailed: false,
        stoppedAtCursor: true,
        nextPageParams: null,
      };
    });

    const r = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: HANSOME,
      chainId: CHAIN,
      maxPages: 40,
    });
    expect(r.fetchMode).toBe("head_refresh");
    expect(r.rpcPagesThisCall).toBe(1);
    // Genesis stays complete for analyzers; freshness via reuseStatus after refresh.
    expect(r.paginationComplete).toBe(true);
    expect(r.reuseStatus).toBe("complete");
    expect(r.cacheHit).toBe(false);
  });

  it("partial cache: incomplete stays incomplete and resumes", async () => {
    const gen = await beginTransferIndexGeneration(CHAIN, FOX);
    await persistTransferIndexChunk(CHAIN, FOX, 0, [toChunk(row(0))], gen);
    await persistTransferIndexMeta(CHAIN, FOX, {
      generation: gen,
      pagesFetchedTotal: 2,
      transfersIndexed: 50,
      recentChunkCount: 1,
      nextPageParams: { block_number: 8800 },
      paginationComplete: false,
      indexState: "indexing",
    });

    const v = evaluateTransferIndexStatus(
      await loadTransferIndexMeta(CHAIN, FOX),
      { chainId: CHAIN, tokenAddress: FOX },
    );
    expect(v.status).toBe("incomplete");
    expect(v.needsResume).toBe(true);

    fetchPaged.mockImplementation(async (_addr, opts) => {
      expect(opts?.startNextPageParams).toEqual({ block_number: 8800 });
      const pageTransfers = [row(10)];
      if (opts?.onPage) {
        await opts.onPage({
          pageInFetch: 1,
          pageTransfers,
          nextPageParams: { block_number: 8700 },
          paginationComplete: false,
          stoppedAtCursor: false,
        });
      }
      return {
        transfers: pageTransfers,
        pagesFetched: 1,
        paginationComplete: false,
        fetchFailed: false,
        stoppedAtCursor: false,
        nextPageParams: { block_number: 8700 },
      };
    });

    const r = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: FOX,
      chainId: CHAIN,
      maxPages: 40,
    });
    expect(r.fetchMode).toBe("resume");
    expect(r.reuseStatus).toBe("incomplete");
    expect(r.paginationComplete).toBe(false);
    expect(r.resumedFromCheckpoint).toBe(true);
  });

  it("corruption recovery: garbage meta rebuilds from page 1", async () => {
    kv.set(transferIndexMetaKey(CHAIN, FOX), {
      version: 1,
      totally: "broken",
    });
    clearTransferIndexMemoryForTests();

    const v = evaluateTransferIndexStatus(
      { version: 1, totally: "broken" },
      { chainId: CHAIN, tokenAddress: FOX },
    );
    // sanitize returns null → rebuilding
    expect(v.status).toBe("rebuilding");

    fetchPaged.mockImplementation(async (_addr, opts) => {
      expect(opts?.startNextPageParams ?? null).toBeNull();
      const pageTransfers = [row(0)];
      if (opts?.onPage) {
        await opts.onPage({
          pageInFetch: 1,
          pageTransfers,
          nextPageParams: null,
          paginationComplete: true,
          stoppedAtCursor: false,
        });
      }
      return {
        transfers: pageTransfers,
        pagesFetched: 1,
        paginationComplete: true,
        fetchFailed: false,
        stoppedAtCursor: false,
        nextPageParams: null,
      };
    });

    const r = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: FOX,
      chainId: CHAIN,
      maxPages: 40,
    });
    expect(r.fetchMode).toBe("rebuild");
    expect(r.paginationComplete).toBe(true);
  });

  it("transfer-index rebuild: forceRebuild ignores prior complete", async () => {
    await seedCompleteFresh();
    fetchPaged.mockImplementation(async (_addr, opts) => {
      expect(opts?.startNextPageParams ?? null).toBeNull();
      const pageTransfers = [row(99)];
      if (opts?.onPage) {
        await opts.onPage({
          pageInFetch: 1,
          pageTransfers,
          nextPageParams: null,
          paginationComplete: true,
          stoppedAtCursor: false,
        });
      }
      return {
        transfers: pageTransfers,
        pagesFetched: 1,
        paginationComplete: true,
        fetchFailed: false,
        stoppedAtCursor: false,
        nextPageParams: null,
      };
    });

    const r = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: HANSOME,
      chainId: CHAIN,
      maxPages: 40,
      forceRebuild: true,
    });
    expect(r.fetchMode).toBe("rebuild");
    expect(r.cacheHit).toBe(false);
    expect(fetchPaged).toHaveBeenCalled();
  });

  it("retry: second call after timeout resumes (not page 1)", async () => {
    fetchPaged
      .mockImplementationOnce(async (_addr, opts) => {
        const pageTransfers = [row(1), row(2)];
        if (opts?.onPage) {
          await opts.onPage({
            pageInFetch: 1,
            pageTransfers,
            nextPageParams: { block_number: 1 },
            paginationComplete: false,
            stoppedAtCursor: false,
          });
        }
        // Simulate budget stop — incomplete.
        return {
          transfers: pageTransfers,
          pagesFetched: 1,
          paginationComplete: false,
          fetchFailed: false,
          stoppedAtCursor: false,
          nextPageParams: { block_number: 1 },
        };
      })
      .mockImplementationOnce(async (_addr, opts) => {
        expect(opts?.startNextPageParams).toEqual({ block_number: 1 });
        const pageTransfers = [row(3)];
        if (opts?.onPage) {
          await opts.onPage({
            pageInFetch: 1,
            pageTransfers,
            nextPageParams: null,
            paginationComplete: true,
            stoppedAtCursor: false,
          });
        }
        return {
          transfers: pageTransfers,
          pagesFetched: 1,
          paginationComplete: true,
          fetchFailed: false,
          stoppedAtCursor: false,
          nextPageParams: null,
        };
      });

    const first = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: FOX,
      chainId: CHAIN,
      maxPages: 40,
      shouldContinue: () => false,
    });
    // With shouldContinue false immediately, paging may stop at 0 — seed manually.
    if (first.pagesFetched === 0) {
      const gen = await beginTransferIndexGeneration(CHAIN, FOX);
      await persistTransferIndexChunk(CHAIN, FOX, 0, [toChunk(row(1))], gen);
      await persistTransferIndexMeta(CHAIN, FOX, {
        generation: gen,
        pagesFetchedTotal: 1,
        transfersIndexed: 1,
        recentChunkCount: 1,
        nextPageParams: { block_number: 1 },
        paginationComplete: false,
        indexState: "indexing",
      });
    }

    const second = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: FOX,
      chainId: CHAIN,
      maxPages: 40,
    });
    expect(second.resumedFromCheckpoint || second.fetchMode === "resume").toBe(
      true,
    );
  });

  it("timeout: shouldContinue false leaves incomplete, not complete", async () => {
    fetchPaged.mockImplementation(async (_addr, opts) => {
      const pageTransfers = [row(0)];
      if (opts?.onPage) {
        await opts.onPage({
          pageInFetch: 1,
          pageTransfers,
          nextPageParams: { block_number: 1 },
          paginationComplete: false,
          stoppedAtCursor: false,
        });
      }
      // Emulate early stop.
      if (opts?.shouldContinue && !opts.shouldContinue()) {
        return {
          transfers: pageTransfers,
          pagesFetched: 1,
          paginationComplete: false,
          fetchFailed: false,
          stoppedAtCursor: false,
          nextPageParams: { block_number: 1 },
        };
      }
      return {
        transfers: pageTransfers,
        pagesFetched: 1,
        paginationComplete: false,
        fetchFailed: false,
        stoppedAtCursor: false,
        nextPageParams: { block_number: 1 },
      };
    });

    const r = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: FOX,
      chainId: CHAIN,
      maxPages: 40,
      shouldContinue: () => false,
    });
    expect(r.paginationComplete).toBe(false);
    expect(r.reuseStatus).not.toBe("complete");
  });

  it("cache version mismatch: version≠1 → rebuilding / miss", () => {
    const v = evaluateTransferIndexStatus(
      {
        version: 2,
        chainId: CHAIN,
        address: FOX.toLowerCase(),
        generation: 1,
        paginationComplete: true,
        indexState: "complete",
        updatedAt: Date.now(),
      },
      { chainId: CHAIN, tokenAddress: FOX },
    );
    expect(v.status).toBe("rebuilding");
    expect(v.reason).toBe("version_mismatch");
    expect(v.reusable).toBe(false);
  });

  it("concurrent scan: second caller reuses without double paging", async () => {
    await seedCompleteFresh();
    const lock = await acquireTransferIndexLock(CHAIN, HANSOME, { ttlSec: 60 });
    expect(lock.acquired).toBe(true);

    const r = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: HANSOME,
      chainId: CHAIN,
      maxPages: 40,
    });
    expect(r.fetchMode).toBe("concurrent_reuse");
    expect(r.rpcPagesThisCall).toBe(0);
    expect(fetchPaged).not.toHaveBeenCalled();

    await releaseTransferIndexLock(CHAIN, HANSOME);
  });

  it("deep reuse: loadEarlyTransfersFromIndex serves chunk 0", async () => {
    await seedCompleteFresh();
    const early = await loadEarlyTransfersFromIndex(HANSOME, CHAIN);
    expect(early).not.toBeNull();
    expect(early!.length).toBeGreaterThan(0);
    expect(early![0]).toHaveProperty("to");
    expect(early![0]).toHaveProperty("blockNumber");
  });

  it("background refresh schedules without throwing", async () => {
    await seedCompleteFresh();
    const meta = await loadTransferIndexMeta(CHAIN, HANSOME);
    kv.set(transferIndexMetaKey(CHAIN, HANSOME), {
      ...meta!,
      updatedAt: Date.now() - TRANSFER_INDEX_HEAD_FRESH_MS - 1,
    });
    clearTransferIndexMemoryForTests();

    fetchPaged.mockResolvedValue({
      transfers: [row(0)],
      pagesFetched: 1,
      paginationComplete: false,
      fetchFailed: false,
      stoppedAtCursor: true,
      nextPageParams: null,
    });

    expect(() =>
      scheduleTransferIndexBackgroundRefresh({
        tokenAddress: HANSOME,
        chainId: CHAIN,
      }),
    ).not.toThrow();

    await new Promise((r) => setTimeout(r, 50));
  });

  it("deep reuse semantic: reuse_hit vs rebuild yield same transfer set for analyzers", async () => {
    const seeded = await seedCompleteFresh();
    const hit = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: HANSOME,
      chainId: CHAIN,
    });
    expect(hit.fetchMode).toBe("reuse_hit");

    fetchPaged.mockImplementation(async (_addr, opts) => {
      const pageTransfers = seeded;
      if (opts?.onPage) {
        await opts.onPage({
          pageInFetch: 1,
          pageTransfers,
          nextPageParams: null,
          paginationComplete: true,
          stoppedAtCursor: false,
        });
      }
      return {
        transfers: pageTransfers,
        pagesFetched: 1,
        paginationComplete: true,
        fetchFailed: false,
        stoppedAtCursor: false,
        nextPageParams: null,
      };
    });

    const rebuilt = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: HANSOME,
      chainId: CHAIN,
      forceRebuild: true,
    });
    const keys = (rows: BlockscoutTokenTransferRow[]) =>
      rows
        .map(
          (t) =>
            `${t.txHash}|${t.from}|${t.to}|${t.valueRaw}|${t.blockNumber}`,
        )
        .sort();
    expect(keys(hit.transfers)).toEqual(keys(rebuilt.transfers));
    expect(hit.paginationComplete).toBe(rebuilt.paginationComplete);
  });

  it("never returns stale data as reuseStatus=complete", () => {
    const stale = evaluateTransferIndexStatus(
      {
        version: 1 as const,
        chainId: CHAIN,
        address: HANSOME.toLowerCase(),
        headTimestampMs: 1,
        headBlock: 1,
        tailTimestampMs: 1,
        tailBlock: 1,
        nextPageParams: null,
        paginationComplete: true,
        pagesFetchedTotal: 10,
        transfersIndexed: 100,
        recentChunkCount: 2,
        indexState: "complete" as const,
        generation: 3,
        updatedAt: Date.now() - TRANSFER_INDEX_HEAD_FRESH_MS - 1,
        lastError: null,
      },
      { chainId: CHAIN, tokenAddress: HANSOME },
    );
    expect(stale.status).toBe("stale");
    expect(stale.status).not.toBe("complete");
  });
});
