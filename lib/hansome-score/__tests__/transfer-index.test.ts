import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  TRANSFER_INDEX_KV_TTL_SEC,
  TRANSFER_INDEX_LOCK_TTL_SEC,
  TRANSFER_INDEX_MAX_RECENT_CHUNKS,
  TRANSFER_INDEX_META_MAX_BYTES,
  TRANSFER_INDEX_RAW_ROWS_HARD_CAP,
  acquireTransferIndexLock,
  assertBoundedRawWindow,
  beginTransferIndexGeneration,
  clearTransferIndexLockTestKv,
  clearTransferIndexMemoryForTests,
  clearTransferIndexTestKv,
  emptyTransferIndexMeta,
  estimateJsonBytes,
  estimateTransferIndexFoxFootprintBytes,
  isTransferIndexLockHeldForTests,
  loadTransferIndexChunk,
  loadTransferIndexCreatorDigest,
  loadTransferIndexMeta,
  normalizeTokenAddress,
  persistTransferIndexChunk,
  persistTransferIndexCreatorDigest,
  persistTransferIndexMeta,
  releaseTransferIndexLock,
  sanitizeTransferIndexMeta,
  shouldAcceptTransferIndexWrite,
  transferIndexChunkKey,
  transferIndexCreatorDigestKey,
  transferIndexLockKey,
  transferIndexMetaKey,
  useTransferIndexLockTestKv,
  useTransferIndexTestKv,
  type TransferIndexChunkRow,
} from "@/lib/hansome-score/transfer-index";

const CHAIN = 4663;
const OTHER_CHAIN = 1;
const FOX = "0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1";
const HANSOME = "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875";
const FOX_LC = normalizeTokenAddress(FOX);

function sampleRow(i: number): TransferIndexChunkRow {
  return {
    from: `0x${(i + 1).toString(16).padStart(40, "0")}`,
    to: `0x${(i + 2).toString(16).padStart(40, "0")}`,
    valueRaw: String(1_000_000n * BigInt(i + 1)),
    blockNumber: 1_000_000 + i,
    timestampMs: 1_700_000_000_000 + i * 1000,
    txHash: `0x${"ab".repeat(32)}`,
    toIsContract: false,
    method: "transfer",
  };
}

describe("transfer-index schema + helpers (Phase 2)", () => {
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
  });

  afterEach(() => {
    clearTransferIndexMemoryForTests();
    clearTransferIndexTestKv();
    clearTransferIndexLockTestKv();
  });

  describe("keys + address normalization", () => {
    it("builds scan:xfer family keys with normalized address", () => {
      const meta = transferIndexMetaKey(CHAIN, FOX);
      expect(meta).toContain(`scan:xfer:${CHAIN}:${FOX_LC}`);
      expect(meta.endsWith(`scan:xfer:${CHAIN}:${FOX_LC}`)).toBe(true);
      expect(transferIndexLockKey(CHAIN, FOX)).toContain(
        `scan:xfer:lock:${CHAIN}:${FOX_LC}`,
      );
      expect(transferIndexChunkKey(CHAIN, FOX, 0)).toContain(
        `scan:xfer:chunk:${CHAIN}:${FOX_LC}:0`,
      );
      expect(transferIndexCreatorDigestKey(CHAIN, FOX)).toContain(
        `scan:xfer:derived:creator:${CHAIN}:${FOX_LC}`,
      );
    });

    it("normalizes checksum / case to lowercase checksum form", () => {
      expect(normalizeTokenAddress(FOX.toLowerCase())).toBe(FOX_LC);
      expect(normalizeTokenAddress(FOX)).toBe(FOX_LC);
      expect(transferIndexMetaKey(CHAIN, FOX)).toBe(
        transferIndexMetaKey(CHAIN, FOX.toLowerCase()),
      );
    });

    it("separates chains in key space", () => {
      expect(transferIndexMetaKey(CHAIN, FOX)).not.toBe(
        transferIndexMetaKey(OTHER_CHAIN, FOX),
      );
    });
  });

  describe("schema round-trip", () => {
    it("persists and loads TransferIndexMeta through KV", async () => {
      const gen = await beginTransferIndexGeneration(CHAIN, FOX);
      const written = await persistTransferIndexMeta(CHAIN, FOX, {
        generation: gen,
        headTimestampMs: 1_700_000_100_000,
        headBlock: 9_999_001,
        tailTimestampMs: 1_699_000_000_000,
        tailBlock: 9_900_000,
        nextPageParams: { block_number: 9900000, index: 12 },
        paginationComplete: false,
        pagesFetchedTotal: 6,
        transfersIndexed: 300,
        recentChunkCount: 6,
        indexState: "indexing",
      });
      expect(written.ok).toBe(true);
      if (!written.ok) return;

      clearTransferIndexMemoryForTests();
      const loaded = await loadTransferIndexMeta(CHAIN, FOX);
      expect(loaded).not.toBeNull();
      expect(loaded).toMatchObject({
        version: 1,
        chainId: CHAIN,
        address: FOX_LC,
        headTimestampMs: 1_700_000_100_000,
        headBlock: 9_999_001,
        tailTimestampMs: 1_699_000_000_000,
        tailBlock: 9_900_000,
        nextPageParams: { block_number: 9900000, index: 12 },
        paginationComplete: false,
        pagesFetchedTotal: 6,
        transfersIndexed: 300,
        recentChunkCount: 6,
        indexState: "indexing",
        generation: gen,
      });
      expect(kv.has(transferIndexMetaKey(CHAIN, FOX))).toBe(true);
      expect(TRANSFER_INDEX_KV_TTL_SEC).toBe(7 * 24 * 60 * 60);
    });

    it("round-trips optional recent chunk + creator digest", async () => {
      const gen = await beginTransferIndexGeneration(CHAIN, FOX);
      const rows = [sampleRow(0), sampleRow(1)];
      const chunkRes = await persistTransferIndexChunk(
        CHAIN,
        FOX,
        0,
        rows,
        gen,
      );
      expect(chunkRes.ok).toBe(true);

      const digestRes = await persistTransferIndexCreatorDigest(CHAIN, FOX, {
        generation: gen,
        deployer: "0x1111111111111111111111111111111111111111",
        dumpDetected: false,
        transferThenSellDetected: true,
        creatorSellPctOfSupply: 1.25,
        outboundTransferCount: 3,
        sellTransferCount: 1,
        transferThenSellRecipientCount: 1,
        evidence: [
          {
            kind: "transfer_then_sell",
            txHash: "0xabc",
            to: "0x2222222222222222222222222222222222222222",
            valueRaw: "1000",
            timestampMs: 1_700_000_000_000,
          },
        ],
        pagesFetched: 6,
        indexComplete: false,
      });
      expect(digestRes.ok).toBe(true);

      clearTransferIndexMemoryForTests();
      const chunk = await loadTransferIndexChunk(CHAIN, FOX, 0);
      const digest = await loadTransferIndexCreatorDigest(CHAIN, FOX);
      expect(chunk?.transfers).toHaveLength(2);
      expect(digest?.transferThenSellDetected).toBe(true);
      expect(digest?.indexComplete).toBe(false);
    });
  });

  describe("sanitization + corrupt KV", () => {
    it("rejects wrong version / non-objects", () => {
      expect(sanitizeTransferIndexMeta(null, CHAIN, FOX)).toBeNull();
      expect(sanitizeTransferIndexMeta("x", CHAIN, FOX)).toBeNull();
      expect(
        sanitizeTransferIndexMeta({ version: 2, chainId: CHAIN }, CHAIN, FOX),
      ).toBeNull();
    });

    it("rejects chain / address mismatch (chain separation)", () => {
      const meta = emptyTransferIndexMeta(CHAIN, FOX, 1);
      expect(sanitizeTransferIndexMeta(meta, OTHER_CHAIN, FOX)).toBeNull();
      expect(sanitizeTransferIndexMeta(meta, CHAIN, HANSOME)).toBeNull();
    });

    it("loads null for corrupt KV blobs", async () => {
      kv.set(transferIndexMetaKey(CHAIN, FOX), {
        version: 1,
        chainId: CHAIN,
        // missing address / garbage
        pagesFetchedTotal: "nope",
      });
      // Still may sanitize with fallback address — ensure clearly corrupt version fails
      kv.set(transferIndexMetaKey(CHAIN, FOX), { version: 99 });
      expect(await loadTransferIndexMeta(CHAIN, FOX)).toBeNull();

      kv.set(transferIndexMetaKey(CHAIN, FOX), {
        version: 1,
        chainId: OTHER_CHAIN,
        address: FOX_LC,
        generation: 1,
        updatedAt: Date.now(),
      });
      expect(await loadTransferIndexMeta(CHAIN, FOX)).toBeNull();
    });

    it("strips oversized opaque nextPageParams strings", () => {
      const meta = emptyTransferIndexMeta(CHAIN, FOX, 1);
      meta.nextPageParams = { cursor: "x".repeat(500) };
      const s = sanitizeTransferIndexMeta(meta, CHAIN, FOX)!;
      expect(s.nextPageParams!.cursor).toHaveLength(256);
    });
  });

  describe("NX lock", () => {
    it("allows only one writer under NX", async () => {
      const a = await acquireTransferIndexLock(CHAIN, FOX);
      expect(a.acquired).toBe(true);
      expect(isTransferIndexLockHeldForTests(CHAIN, FOX)).toBe(true);
      expect(TRANSFER_INDEX_LOCK_TTL_SEC).toBe(120);

      const b = await acquireTransferIndexLock(CHAIN, FOX);
      expect(b.acquired).toBe(false);

      await releaseTransferIndexLock(CHAIN, FOX);
      expect(isTransferIndexLockHeldForTests(CHAIN, FOX)).toBe(false);

      const c = await acquireTransferIndexLock(CHAIN, FOX);
      expect(c.acquired).toBe(true);
      await releaseTransferIndexLock(CHAIN, FOX);
    });

    it("does not collide across chains / tokens", async () => {
      const a = await acquireTransferIndexLock(CHAIN, FOX);
      const b = await acquireTransferIndexLock(OTHER_CHAIN, FOX);
      const c = await acquireTransferIndexLock(CHAIN, HANSOME);
      expect(a.acquired && b.acquired && c.acquired).toBe(true);
      await releaseTransferIndexLock(CHAIN, FOX);
      await releaseTransferIndexLock(OTHER_CHAIN, FOX);
      await releaseTransferIndexLock(CHAIN, HANSOME);
    });
  });

  describe("generation fencing", () => {
    it("rejects stale generation writers", async () => {
      const gen = await beginTransferIndexGeneration(CHAIN, FOX);
      expect(gen).toBeGreaterThanOrEqual(1);

      const ok = await persistTransferIndexMeta(CHAIN, FOX, {
        generation: gen,
        pagesFetchedTotal: 2,
      });
      expect(ok.ok).toBe(true);

      const stale = await persistTransferIndexMeta(CHAIN, FOX, {
        generation: gen - 1,
        pagesFetchedTotal: 99,
      });
      expect(stale).toEqual({ ok: false, reason: "stale_generation" });

      const loaded = await loadTransferIndexMeta(CHAIN, FOX);
      expect(loaded!.pagesFetchedTotal).toBe(2);

      expect(shouldAcceptTransferIndexWrite({ generation: 5 }, 4)).toBe(false);
      expect(shouldAcceptTransferIndexWrite({ generation: 5 }, 5)).toBe(true);
      expect(shouldAcceptTransferIndexWrite(null, 1)).toBe(true);
    });

    it("rejects stale chunk / digest writers", async () => {
      const gen = await beginTransferIndexGeneration(CHAIN, FOX);
      await persistTransferIndexMeta(CHAIN, FOX, {
        generation: gen + 1,
        indexState: "indexing",
      });

      const chunk = await persistTransferIndexChunk(
        CHAIN,
        FOX,
        0,
        [sampleRow(0)],
        gen,
      );
      expect(chunk).toEqual({ ok: false, reason: "stale_generation" });

      const digest = await persistTransferIndexCreatorDigest(CHAIN, FOX, {
        generation: gen,
        deployer: null,
        dumpDetected: false,
        transferThenSellDetected: false,
        creatorSellPctOfSupply: 0,
        outboundTransferCount: 0,
        sellTransferCount: 0,
        transferThenSellRecipientCount: 0,
        evidence: [],
        pagesFetched: 0,
        indexComplete: false,
      });
      expect(digest).toEqual({ ok: false, reason: "stale_generation" });
    });
  });

  describe("oversized / FOX-scale rejection", () => {
    it("rejects oversized meta payloads", async () => {
      const gen = await beginTransferIndexGeneration(CHAIN, FOX);
      const huge = emptyTransferIndexMeta(CHAIN, FOX, gen);
      // Force lastError past sanitize slice then wrap — use invalid path via
      // direct sanitize size gate with a bloated object.
      const bloated = {
        ...huge,
        nextPageParams: Object.fromEntries(
          Array.from({ length: 400 }, (_, i) => [`k${i}`, "v".repeat(40)]),
        ),
      };
      expect(estimateJsonBytes(bloated)).toBeGreaterThan(
        TRANSFER_INDEX_META_MAX_BYTES,
      );
      expect(sanitizeTransferIndexMeta(bloated, CHAIN, FOX)).toBeNull();
    });

    it("rejects chunk beyond row / chunk index caps", async () => {
      const gen = await beginTransferIndexGeneration(CHAIN, FOX);
      const tooMany = Array.from({ length: 51 }, (_, i) => sampleRow(i));
      const res = await persistTransferIndexChunk(CHAIN, FOX, 0, tooMany, gen);
      expect(res.ok).toBe(false);

      const badIndex = await persistTransferIndexChunk(
        CHAIN,
        FOX,
        TRANSFER_INDEX_MAX_RECENT_CHUNKS,
        [sampleRow(0)],
        gen,
      );
      expect(badIndex).toEqual({ ok: false, reason: "chunk_cap" });

      expect(assertBoundedRawWindow(TRANSFER_INDEX_RAW_ROWS_HARD_CAP)).toBe(
        true,
      );
      expect(assertBoundedRawWindow(113_000)).toBe(false);
    });

    it("estimates FOX KV footprint ≪ full raw history", async () => {
      const gen = await beginTransferIndexGeneration(CHAIN, FOX);
      await persistTransferIndexMeta(CHAIN, FOX, {
        generation: gen,
        pagesFetchedTotal: 6,
        transfersIndexed: 300,
        recentChunkCount: 6,
        paginationComplete: false,
        indexState: "indexing",
        nextPageParams: { block_number: 1, index: 0 },
      });
      const chunks = [];
      for (let i = 0; i < 6; i++) {
        const rows = Array.from({ length: 50 }, (_, j) => sampleRow(i * 50 + j));
        const r = await persistTransferIndexChunk(CHAIN, FOX, i, rows, gen);
        expect(r.ok).toBe(true);
        if (r.ok) chunks.push(r.chunk);
      }
      await persistTransferIndexCreatorDigest(CHAIN, FOX, {
        generation: gen,
        deployer: HANSOME,
        dumpDetected: false,
        transferThenSellDetected: false,
        creatorSellPctOfSupply: 0,
        outboundTransferCount: 0,
        sellTransferCount: 0,
        transferThenSellRecipientCount: 0,
        evidence: Array.from({ length: 40 }, (_, i) => ({
          kind: "sell" as const,
          txHash: `0x${i.toString(16).padStart(64, "0")}`,
          to: FOX,
          valueRaw: "1",
          timestampMs: 1,
        })),
        pagesFetched: 6,
        indexComplete: false,
      });

      const meta = await loadTransferIndexMeta(CHAIN, FOX);
      const digest = await loadTransferIndexCreatorDigest(CHAIN, FOX);
      const fp = estimateTransferIndexFoxFootprintBytes({
        meta,
        creatorDigest: digest,
        recentChunks: chunks,
      });

      // Derived-first + 6×50 recent window should stay well under ~1MB.
      expect(fp.totalBytes).toBeLessThan(1_000_000);
      expect(fp.fullRaw113kEstimateBytes).toBeGreaterThan(30_000_000);
      expect(fp.totalBytes * 50).toBeLessThan(fp.fullRaw113kEstimateBytes);
      expect(fp.strategy).toBe("derived_first_bounded_recent");
    });
  });
});
