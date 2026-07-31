import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BlockscoutTokenTransferRow } from "@/lib/hansome-score/blockscout";
import {
  beginTransferIndexGeneration,
  clearTransferIndexLockTestKv,
  clearTransferIndexMemoryForTests,
  clearTransferIndexTestKv,
  fetchTokenTransfersWithCheckpoint,
  loadTransferIndexMeta,
  loadTransferIndexProgress,
  persistTransferIndexMeta,
  shouldAcceptTransferIndexWrite,
  useTransferIndexLockTestKv,
  useTransferIndexTestKv,
} from "@/lib/hansome-score/transfer-index";

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

describe("transfer-index Deep checkpointing", () => {
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

  it("checkpoints each page — timeout-like stop leaves N pages, not 0", async () => {
    fetchPaged.mockImplementation(async (_addr, opts) => {
      const transfers: BlockscoutTokenTransferRow[] = [];
      for (let p = 1; p <= 4; p++) {
        const pageTransfers = [row(p), row(p + 100)];
        transfers.push(...pageTransfers);
        if (opts?.onPage) {
          await opts.onPage({
            pageInFetch: p,
            pageTransfers,
            nextPageParams: { block_number: 1000 - p },
            paginationComplete: false,
            stoppedAtCursor: false,
          });
        }
      }
      return {
        transfers,
        pagesFetched: 4,
        paginationComplete: false,
        fetchFailed: false,
        stoppedAtCursor: false,
        nextPageParams: { block_number: 996 },
      };
    });

    const full = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: FOX,
      chainId: CHAIN,
      maxPages: 40,
    });
    expect(full.pagesFetched).toBe(4);
    expect(full.paginationComplete).toBe(false);

    const progress = await loadTransferIndexProgress(FOX);
    expect(progress.pagesFetched).toBe(4);
    expect(progress.pagesFetched).not.toBe(0);
    expect(progress.transfersIndexed).toBeGreaterThan(0);
    expect(progress.paginationComplete).toBe(false);
    expect(progress.nextPageParams).toEqual({ block_number: 996 });
  });

  it("resumes from checkpoint cursor (not page 1) and does not double-count", async () => {
    // Seed checkpoint as if prior attempt timed out after 2 pages.
    const gen0 = await beginTransferIndexGeneration(CHAIN, FOX);
    await persistTransferIndexMeta(CHAIN, FOX, {
      generation: gen0,
      pagesFetchedTotal: 2,
      transfersIndexed: 4,
      nextPageParams: { block_number: 8800, index: 3 },
      paginationComplete: false,
      indexState: "indexing",
      headTimestampMs: 1_700_000_000_000,
      tailTimestampMs: 1_699_999_000_000,
      recentChunkCount: 2,
    });
    // Persist 2 prior chunks
    const { persistTransferIndexChunk } = await import(
      "@/lib/hansome-score/transfer-index"
    );
    await persistTransferIndexChunk(
      CHAIN,
      FOX,
      0,
      [
        {
          from: row(0).from,
          to: row(0).to,
          valueRaw: row(0).valueRaw,
          blockNumber: row(0).blockNumber,
          timestampMs: Date.parse(row(0).timestamp!),
          txHash: row(0).txHash,
          toIsContract: false,
          method: "transfer",
        },
        {
          from: row(1).from,
          to: row(1).to,
          valueRaw: row(1).valueRaw,
          blockNumber: row(1).blockNumber,
          timestampMs: Date.parse(row(1).timestamp!),
          txHash: row(1).txHash,
          toIsContract: false,
          method: "transfer",
        },
      ],
      gen0,
    );
    await persistTransferIndexChunk(
      CHAIN,
      FOX,
      1,
      [
        {
          from: row(2).from,
          to: row(2).to,
          valueRaw: row(2).valueRaw,
          blockNumber: row(2).blockNumber,
          timestampMs: Date.parse(row(2).timestamp!),
          txHash: row(2).txHash,
          toIsContract: false,
          method: "transfer",
        },
        {
          from: row(3).from,
          to: row(3).to,
          valueRaw: row(3).valueRaw,
          blockNumber: row(3).blockNumber,
          timestampMs: Date.parse(row(3).timestamp!),
          txHash: row(3).txHash,
          toIsContract: false,
          method: "transfer",
        },
      ],
      gen0,
    );

    fetchPaged.mockImplementation(async (_addr, opts) => {
      expect(opts?.startNextPageParams).toEqual({
        block_number: 8800,
        index: 3,
      });
      const pageTransfers = [row(10), row(11)];
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

    const resumed = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: FOX,
      chainId: CHAIN,
      maxPages: 40,
    });

    expect(resumed.resumedFromCheckpoint).toBe(true);
    expect(resumed.pagesFetched).toBe(3); // 2 prior + 1 new
    expect(resumed.paginationComplete).toBe(false);
    // 4 prior + 2 new, no duplicates
    expect(resumed.transfers).toHaveLength(6);
    const hashes = resumed.transfers.map((t) => t.txHash);
    expect(new Set(hashes).size).toBe(hashes.length);

    const meta = await loadTransferIndexMeta(CHAIN, FOX);
    expect(meta?.pagesFetchedTotal).toBe(3);
    expect(meta?.paginationComplete).toBe(false);
  });

  it("rejects stale generation writers", async () => {
    const gen = await beginTransferIndexGeneration(CHAIN, FOX);
    await persistTransferIndexMeta(CHAIN, FOX, {
      generation: gen,
      pagesFetchedTotal: 5,
      transfersIndexed: 100,
    });
    const stale = await persistTransferIndexMeta(CHAIN, FOX, {
      generation: gen - 1,
      pagesFetchedTotal: 99,
    });
    expect(stale).toEqual({ ok: false, reason: "stale_generation" });
    const meta = await loadTransferIndexMeta(CHAIN, FOX);
    expect(meta?.pagesFetchedTotal).toBe(5);
    expect(shouldAcceptTransferIndexWrite(meta, gen - 1)).toBe(false);
  });

  it("does not mark pagination complete unless genesis exhausted", async () => {
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
      tokenAddress: HANSOME,
      chainId: CHAIN,
      maxPages: 40,
    });
    expect(r.paginationComplete).toBe(false);
    const progress = await loadTransferIndexProgress(HANSOME);
    expect(progress.paginationComplete).toBe(false);
    expect(progress.indexState).not.toBe("complete");
  });

  it("marks complete only when Blockscout next_page_params is null", async () => {
    fetchPaged.mockImplementation(async (_addr, opts) => {
      const pageTransfers = [row(0), row(1)];
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
    });
    expect(r.paginationComplete).toBe(true);
    expect(r.meta?.indexState).toBe("complete");
  });

  it("FOX-scale: incomplete stays incomplete; Creator must stay provisional", async () => {
    fetchPaged.mockImplementation(async (_addr, opts) => {
      // Simulate 6 pages of a 40-page cold budget — nowhere near 114k genesis.
      const transfers: BlockscoutTokenTransferRow[] = [];
      for (let p = 1; p <= 6; p++) {
        const pageTransfers = Array.from({ length: 50 }, (_, j) =>
          row(p * 50 + j),
        );
        transfers.push(...pageTransfers);
        if (opts?.onPage) {
          await opts.onPage({
            pageInFetch: p,
            pageTransfers,
            nextPageParams: { block_number: 10_000 - p },
            paginationComplete: false,
            stoppedAtCursor: false,
          });
        }
      }
      return {
        transfers,
        pagesFetched: 6,
        paginationComplete: false,
        fetchFailed: false,
        stoppedAtCursor: false,
        nextPageParams: { block_number: 9_994 },
      };
    });

    const r = await fetchTokenTransfersWithCheckpoint({
      tokenAddress: FOX,
      chainId: CHAIN,
      maxPages: 40,
    });
    expect(r.pagesFetched).toBe(6);
    expect(r.transfers.length).toBe(300);
    expect(r.paginationComplete).toBe(false);
    // Partial history must never be treated as clean/complete creator index.
    expect(r.meta?.paginationComplete).toBe(false);
    expect(r.meta?.indexState).toBe("indexing");
  });
});
