/**
 * Phase 10B — Pool-scoped V3 Position Index prototype unit tests.
 * Does not touch Production scan path.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertNotTransferIndexNamespace,
  backfillV3PosIndex,
  buildV3PosIndexKey,
  classifyLiquidityState,
  classifyOwnerTypeAudit,
  classifyOwnerValidation,
  classifyTokenStatus,
  clearV3PosStoreMemoryForTests,
  emptyV3PosIndexRecord,
  evaluateDiscoveryComplete,
  incrementalSyncV3PosIndex,
  isBurnTransfer,
  isMintTransfer,
  loadV3PosIndexMemory,
  PONS_LAUNCH_LOCKER_AUDIT,
  reconcileMintSets,
  resolveTokenIdsFromMintReceipt,
  saveV3PosIndexMemory,
  simulateReorgIndex,
  tokenIdSet,
  validateV3PosIndexRecord,
  V3PosStoreError,
  V3_POS_INDEX_KEY_PREFIX,
  V3_POS_INDEX_SCHEMA_VERSION,
  type DecodedPoolMint,
  type V3PosChainPort,
} from "@/lib/hansome-score/lp/v3-position-index";

const CHAIN = 4663;
const NPM = "0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3";
const FACTORY = "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA";
const POOL = "0xC71E763a0a258f266d1481295115ea4f291D95ED";
const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
const BEER = "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804";
const FEE = 10000;
const PONS = PONS_LAUNCH_LOCKER_AUDIT;
const ZERO = "0x0000000000000000000000000000000000000000";
const HELPER = "0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB";
const EOA = "0xC017aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa11FD";

const BEER_POS = {
  token0: WETH,
  token1: BEER,
  fee: FEE,
  tickLower: -887200,
  tickUpper: 204200,
  liquidity: "36819258015569838458222",
};

function opts() {
  return {
    chainId: CHAIN,
    factory: FACTORY,
    npm: NPM,
    poolAddress: POOL,
    token0: WETH,
    token1: BEER,
    fee: FEE,
    reorgOverlapBlocks: 96,
    poolCreationBlock: 100,
  };
}

function mockPort(cfg: {
  head?: number;
  hashes?: Record<number, string>;
  mints?: DecodedPoolMint[];
  receipts?: Record<
    string,
    {
      transfers: {
        tokenId: string;
        from: string;
        to: string;
        logIndex: number;
      }[];
      increaseLiquidity: {
        tokenId: string;
        liquidity: string;
        logIndex: number;
      }[];
    }
  >;
  positions?: Record<string, typeof BEER_POS | null | "error">;
  owners?: Record<
    string,
    { ok: true; owner: string } | { ok: false; revert: boolean; error?: string }
  >;
  codeSizes?: Record<string, number>;
  tick?: number;
}): V3PosChainPort {
  const head = cfg.head ?? 1000;
  const hashes = cfg.hashes ?? {};
  for (let b = 0; b <= head; b++) {
    if (!hashes[b]) hashes[b] = `0xhash${b}`;
  }
  return {
    async getBlockNumber() {
      return head;
    },
    async getBlockHash(n) {
      return hashes[n] ?? null;
    },
    async getLogsMint({ fromBlock, toBlock }) {
      return (cfg.mints ?? []).filter(
        (m) => m.blockNumber >= fromBlock && m.blockNumber <= toBlock,
      );
    },
    async getReceiptNpmEvents({ txHash }) {
      const r = cfg.receipts?.[txHash.toLowerCase()] ?? cfg.receipts?.[txHash];
      if (!r) return { transfers: [], increaseLiquidity: [], missing: true };
      return { ...r, missing: false };
    },
    async readPositions({ tokenId }) {
      if (cfg.positions && tokenId in cfg.positions) {
        return cfg.positions[tokenId]!;
      }
      return null;
    },
    async readOwnerOf({ tokenId }) {
      if (cfg.owners && tokenId in cfg.owners) return cfg.owners[tokenId]!;
      return { ok: false, revert: true, error: "missing" };
    },
    async getCodeSize(address) {
      return cfg.codeSizes?.[address.toLowerCase()] ?? cfg.codeSizes?.[address] ?? 0;
    },
    async readSlot0Tick() {
      return cfg.tick ?? 185530;
    },
  };
}

beforeEach(() => {
  clearV3PosStoreMemoryForTests();
});

afterEach(() => {
  clearV3PosStoreMemoryForTests();
});

describe("Phase 10B key / namespace", () => {
  it("builds isolated scan:v3pos key", () => {
    const key = buildV3PosIndexKey({
      chainId: CHAIN,
      npm: NPM,
      token0: WETH,
      token1: BEER,
      fee: FEE,
    });
    // Phase 12C: {scope}:scan:v3pos:…
    expect(key).toContain(`:${V3_POS_INDEX_KEY_PREFIX}:`);
    expect(key).not.toContain(":xfer:");
    assertNotTransferIndexNamespace(key);
  });

  it("rejects transfer-index namespace", () => {
    expect(() =>
      assertNotTransferIndexNamespace("scan:xfer:4663:0xabc"),
    ).toThrow(/transfer-index/);
  });
});

describe("Phase 10B receipt → tokenId", () => {
  it("Mint receipt → one tokenId (BEER path)", () => {
    const r = resolveTokenIdsFromMintReceipt({
      txHash: "0xmint",
      blockNumber: 100,
      npm: NPM,
      poolToken0: WETH,
      poolToken1: BEER,
      poolFee: FEE,
      transfers: [
        { tokenId: "436637", from: ZERO, to: HELPER, logIndex: 0 },
        { tokenId: "436637", from: HELPER, to: PONS, logIndex: 2 },
      ],
      increaseLiquidity: [
        { tokenId: "436637", liquidity: BEER_POS.liquidity, logIndex: 1 },
      ],
      positionsById: { "436637": BEER_POS },
    });
    expect(r.matchingTokenIds).toEqual(["436637"]);
    expect(isMintTransfer(ZERO)).toBe(true);
  });

  it("Mint receipt → multiple tokenIds", () => {
    const pos2 = { ...BEER_POS, tickLower: -1000, tickUpper: 1000, liquidity: "1" };
    const r = resolveTokenIdsFromMintReceipt({
      txHash: "0xmulti",
      blockNumber: 200,
      npm: NPM,
      poolToken0: WETH,
      poolToken1: BEER,
      poolFee: FEE,
      transfers: [
        { tokenId: "1", from: ZERO, to: EOA, logIndex: 0 },
        { tokenId: "2", from: ZERO, to: EOA, logIndex: 1 },
      ],
      increaseLiquidity: [
        { tokenId: "1", liquidity: "1", logIndex: 2 },
        { tokenId: "2", liquidity: "1", logIndex: 3 },
      ],
      positionsById: { "1": BEER_POS, "2": pos2 },
    });
    expect(r.matchingTokenIds).toEqual(["1", "2"]);
  });

  it("unrelated NPM Transfer ignored (wrong pool via positions)", () => {
    const r = resolveTokenIdsFromMintReceipt({
      txHash: "0xunrel",
      blockNumber: 1,
      npm: NPM,
      poolToken0: WETH,
      poolToken1: BEER,
      poolFee: FEE,
      transfers: [
        { tokenId: "99", from: ZERO, to: EOA, logIndex: 0 },
        { tokenId: "436637", from: ZERO, to: PONS, logIndex: 1 },
      ],
      increaseLiquidity: [
        { tokenId: "99", liquidity: "1", logIndex: 2 },
        { tokenId: "436637", liquidity: "1", logIndex: 3 },
      ],
      positionsById: {
        "99": {
          token0: WETH,
          token1: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
          fee: 100,
          tickLower: 0,
          tickUpper: 100,
          liquidity: "1",
        },
        "436637": BEER_POS,
      },
    });
    expect(r.matchingTokenIds).toEqual(["436637"]);
    expect(r.ignoredWrongPool).toContain("99");
  });

  it("wrong pool key ignored", () => {
    const r = resolveTokenIdsFromMintReceipt({
      txHash: "0xwrong",
      blockNumber: 1,
      npm: NPM,
      poolToken0: WETH,
      poolToken1: BEER,
      poolFee: FEE,
      transfers: [{ tokenId: "5", from: ZERO, to: EOA, logIndex: 0 }],
      increaseLiquidity: [{ tokenId: "5", liquidity: "1", logIndex: 1 }],
      positionsById: {
        "5": { ...BEER_POS, fee: 3000 },
      },
    });
    expect(r.matchingTokenIds).toEqual([]);
    expect(r.ignoredWrongPool).toContain("5");
  });

  it("mint then same-tx transfer (helper → Pons)", () => {
    const r = resolveTokenIdsFromMintReceipt({
      txHash: "0xsame",
      blockNumber: 100,
      npm: NPM,
      poolToken0: WETH,
      poolToken1: BEER,
      poolFee: FEE,
      transfers: [
        { tokenId: "436637", from: ZERO, to: HELPER, logIndex: 0 },
        { tokenId: "436637", from: HELPER, to: PONS, logIndex: 2 },
      ],
      increaseLiquidity: [
        { tokenId: "436637", liquidity: BEER_POS.liquidity, logIndex: 1 },
      ],
      positionsById: { "436637": BEER_POS },
    });
    expect(r.matchingTokenIds).toEqual(["436637"]);
  });
});

describe("Phase 10B owner / zero-liq / burned", () => {
  it("owner changed after mint — ownerOf wins", async () => {
    const port = mockPort({
      head: 500,
      mints: [
        {
          blockNumber: 100,
          txHash: "0xmint1",
          tickLower: -887200,
          tickUpper: 204200,
          amountL: "1",
          sender: NPM,
          owner: NPM,
        },
      ],
      receipts: {
        "0xmint1": {
          transfers: [
            { tokenId: "10", from: ZERO, to: HELPER, logIndex: 0 },
            { tokenId: "10", from: HELPER, to: EOA, logIndex: 1 },
          ],
          increaseLiquidity: [{ tokenId: "10", liquidity: "1", logIndex: 2 }],
        },
      },
      positions: {
        "10": { ...BEER_POS, liquidity: "1" },
      },
      owners: {
        "10": { ok: true, owner: "0x1111111111111111111111111111111111111111" },
      },
      codeSizes: { "0x1111111111111111111111111111111111111111": 0 },
    });
    const rec = await backfillV3PosIndex({ port, opts: opts() });
    expect(rec.tokenIds[0]?.currentOwner?.toLowerCase()).toBe(
      "0x1111111111111111111111111111111111111111",
    );
    expect(rec.tokenIds[0]?.ownerTypeAudit).toBe("eoa");
  });

  it("zero-liquidity not material", () => {
    const liq = classifyLiquidityState("0");
    expect(liq.zeroLiquidity).toBe(true);
    expect(liq.materialCandidate).toBe(false);
    expect(
      classifyTokenStatus({
        burned: false,
        zeroLiquidity: true,
        inRange: true,
        liquidity: "0",
      }),
    ).toBe("zero_liquidity");
  });

  it("burned tokenId — ownerOf revert ≠ unlocked", () => {
    const o = classifyOwnerValidation({
      ok: false,
      revert: true,
      error: "ERC721: invalid token ID",
    });
    expect(o.burned).toBe(true);
    expect(o.ownerValidationStatus).toBe("burned_or_nonexistent");
    expect(o.currentOwner).toBeNull();
    expect(isBurnTransfer(ZERO)).toBe(true);
    expect(classifyTokenStatus({ burned: true, zeroLiquidity: true, inRange: null, liquidity: "0" })).toBe(
      "burned",
    );
  });

  it("ownerOf transient failure", () => {
    const o = classifyOwnerValidation({
      ok: false,
      revert: false,
      error: "timeout",
    });
    expect(o.burned).toBe(false);
    expect(o.ownerValidationStatus).toBe("transient_error");
  });

  it("locker_pons audit label only", () => {
    expect(
      classifyOwnerTypeAudit({ owner: PONS, codeSize: 1000 }),
    ).toBe("locker_pons");
  });
});

describe("Phase 10B sync / failures / idempotency", () => {
  it("positions transient failure recorded", async () => {
    const port = mockPort({
      head: 500,
      mints: [
        {
          blockNumber: 100,
          txHash: "0xm",
          tickLower: 0,
          tickUpper: 1,
          amountL: "1",
          sender: NPM,
          owner: NPM,
        },
      ],
      receipts: {
        "0xm": {
          transfers: [{ tokenId: "7", from: ZERO, to: EOA, logIndex: 0 }],
          increaseLiquidity: [{ tokenId: "7", liquidity: "1", logIndex: 1 }],
        },
      },
      positions: { "7": "error" },
      owners: { "7": { ok: true, owner: EOA } },
    });
    const rec = await backfillV3PosIndex({ port, opts: opts() });
    expect(rec.discoveryComplete).toBe(false);
    expect(rec.completenessErrors.some((e) => e.includes("positions error"))).toBe(
      true,
    );
  });

  it("missing receipt keeps incomplete", async () => {
    const port = mockPort({
      head: 500,
      mints: [
        {
          blockNumber: 100,
          txHash: "0xmissing",
          tickLower: 0,
          tickUpper: 1,
          amountL: "1",
          sender: NPM,
          owner: NPM,
        },
      ],
      receipts: {},
    });
    const rec = await backfillV3PosIndex({ port, opts: opts() });
    expect(rec.discoveryComplete).toBe(false);
    expect(rec.completenessErrors.some((e) => e.includes("missing receipt"))).toBe(
      true,
    );
  });

  it("duplicate Mint event (same tx) does not duplicate tokenIds", async () => {
    const mint: DecodedPoolMint = {
      blockNumber: 100,
      txHash: "0xdup",
      tickLower: -887200,
      tickUpper: 204200,
      amountL: BEER_POS.liquidity,
      sender: NPM,
      owner: NPM,
    };
    const port = mockPort({
      head: 500,
      mints: [mint, { ...mint }],
      receipts: {
        "0xdup": {
          transfers: [
            { tokenId: "436637", from: ZERO, to: HELPER, logIndex: 0 },
            { tokenId: "436637", from: HELPER, to: PONS, logIndex: 2 },
          ],
          increaseLiquidity: [
            { tokenId: "436637", liquidity: BEER_POS.liquidity, logIndex: 1 },
          ],
        },
      },
      positions: { "436637": BEER_POS },
      owners: { "436637": { ok: true, owner: PONS } },
      codeSizes: { [PONS.toLowerCase()]: 5000 },
    });
    const rec = await backfillV3PosIndex({ port, opts: opts() });
    expect(tokenIdSet(rec)).toEqual(["436637"]);
    expect(rec.tokenIds[0]?.ownerTypeAudit).toBe("locker_pons");
    expect(rec.discoveryComplete).toBe(true);
  });

  it("overlapping sync range + idempotent replay", async () => {
    const port = mockPort({
      head: 500,
      mints: [
        {
          blockNumber: 100,
          txHash: "0xbeer",
          tickLower: -887200,
          tickUpper: 204200,
          amountL: BEER_POS.liquidity,
          sender: NPM,
          owner: NPM,
        },
      ],
      receipts: {
        "0xbeer": {
          transfers: [
            { tokenId: "436637", from: ZERO, to: PONS, logIndex: 0 },
          ],
          increaseLiquidity: [
            { tokenId: "436637", liquidity: BEER_POS.liquidity, logIndex: 1 },
          ],
        },
      },
      positions: { "436637": BEER_POS },
      owners: { "436637": { ok: true, owner: PONS } },
      codeSizes: { [PONS.toLowerCase()]: 1 },
    });
    const a = await backfillV3PosIndex({ port, opts: opts() });
    const b = await incrementalSyncV3PosIndex({
      port,
      opts: opts(),
      existing: a,
    });
    const c = await incrementalSyncV3PosIndex({
      port,
      opts: opts(),
      existing: b,
    });
    expect(tokenIdSet(a)).toEqual(["436637"]);
    expect(tokenIdSet(b)).toEqual(["436637"]);
    expect(tokenIdSet(c)).toEqual(["436637"]);
    expect(b.discoveryComplete).toBe(true);
    expect(c.discoveryComplete).toBe(true);
  });

  it("multi-position pool retains all", async () => {
    const port = mockPort({
      head: 500,
      mints: [
        {
          blockNumber: 100,
          txHash: "0xa",
          tickLower: 0,
          tickUpper: 10,
          amountL: "1",
          sender: NPM,
          owner: NPM,
        },
        {
          blockNumber: 120,
          txHash: "0xb",
          tickLower: 0,
          tickUpper: 20,
          amountL: "2",
          sender: NPM,
          owner: NPM,
        },
      ],
      receipts: {
        "0xa": {
          transfers: [{ tokenId: "1", from: ZERO, to: EOA, logIndex: 0 }],
          increaseLiquidity: [{ tokenId: "1", liquidity: "1", logIndex: 1 }],
        },
        "0xb": {
          transfers: [{ tokenId: "2", from: ZERO, to: EOA, logIndex: 0 }],
          increaseLiquidity: [{ tokenId: "2", liquidity: "2", logIndex: 1 }],
        },
      },
      positions: {
        "1": { ...BEER_POS, liquidity: "1", tickLower: 0, tickUpper: 10 },
        "2": { ...BEER_POS, liquidity: "2", tickLower: 0, tickUpper: 20 },
      },
      owners: {
        "1": { ok: true, owner: EOA },
        "2": { ok: true, owner: EOA },
      },
    });
    const rec = await backfillV3PosIndex({ port, opts: opts() });
    expect(tokenIdSet(rec)).toEqual(["1", "2"]);
  });

  it("empty exhaustive pool", async () => {
    const port = mockPort({ head: 500, mints: [], receipts: {} });
    const rec = await backfillV3PosIndex({ port, opts: opts() });
    expect(rec.tokenIds).toEqual([]);
    expect(rec.discoveryComplete).toBe(true);
    expect(rec.exhaustiveFromBlock).toBe(100);
  });

  it("partial range remains incomplete", () => {
    expect(
      evaluateDiscoveryComplete({
        poolCreationBlock: 100,
        exhaustiveFromBlock: 200,
        exhaustiveToBlock: 500,
        lastSyncedBlockHash: "0xabc",
        completenessErrors: [],
      }),
    ).toBe(false);
  });
});

describe("Phase 10B reorg", () => {
  it("reorg removes Mint", () => {
    const base = emptyV3PosIndexRecord({
      chainId: CHAIN,
      factory: FACTORY,
      npm: NPM,
      poolAddress: POOL,
      token0: WETH,
      token1: BEER,
      fee: FEE,
    });
    base.tokenIds = [
      {
        tokenId: "1",
        firstSeenBlock: 50,
        firstSeenTx: "0xold",
        lastTransferBlock: null,
        lastTransferTx: null,
        currentOwner: EOA,
        ownerValidatedAtBlock: 100,
        ownerValidationStatus: "ok",
        token0: WETH,
        token1: BEER,
        fee: FEE,
        tickLower: 0,
        tickUpper: 1,
        liquidity: "1",
        positionValidatedAtBlock: 100,
        status: "active",
        burned: false,
        zeroLiquidity: false,
        ownerTypeAudit: "eoa",
        materialCandidate: true,
        inRange: true,
        source: "pool_mint_receipt",
        lastError: null,
      },
      {
        tokenId: "2",
        firstSeenBlock: 900,
        firstSeenTx: "0xnew",
        lastTransferBlock: null,
        lastTransferTx: null,
        currentOwner: EOA,
        ownerValidatedAtBlock: 1000,
        ownerValidationStatus: "ok",
        token0: WETH,
        token1: BEER,
        fee: FEE,
        tickLower: 0,
        tickUpper: 1,
        liquidity: "1",
        positionValidatedAtBlock: 1000,
        status: "active",
        burned: false,
        zeroLiquidity: false,
        ownerTypeAudit: "eoa",
        materialCandidate: true,
        inRange: true,
        source: "pool_mint_receipt",
        lastError: null,
      },
    ];
    const sim = simulateReorgIndex({
      record: base,
      survivingOverlapTokenIds: [],
      overlapFromBlock: 800,
    });
    expect(sim.removedTokenIds).toContain("2");
    expect(sim.record.tokenIds.map((t) => t.tokenId)).toEqual(["1"]);
  });

  it("reorg adds replacement Mint", () => {
    const base = emptyV3PosIndexRecord({
      chainId: CHAIN,
      factory: FACTORY,
      npm: NPM,
      poolAddress: POOL,
      token0: WETH,
      token1: BEER,
      fee: FEE,
    });
    base.tokenIds = [
      {
        tokenId: "2",
        firstSeenBlock: 900,
        firstSeenTx: "0xold",
        lastTransferBlock: null,
        lastTransferTx: null,
        currentOwner: EOA,
        ownerValidatedAtBlock: 1000,
        ownerValidationStatus: "ok",
        token0: WETH,
        token1: BEER,
        fee: FEE,
        tickLower: 0,
        tickUpper: 1,
        liquidity: "1",
        positionValidatedAtBlock: 1000,
        status: "active",
        burned: false,
        zeroLiquidity: false,
        ownerTypeAudit: "eoa",
        materialCandidate: true,
        inRange: true,
        source: "pool_mint_receipt",
        lastError: null,
      },
    ];
    const sim = simulateReorgIndex({
      record: base,
      survivingOverlapTokenIds: ["3"],
      overlapFromBlock: 800,
    });
    expect(sim.removedTokenIds).toContain("2");
    expect(sim.addedTokenIds).toContain("3");
  });

  it("reconcileMintSets", () => {
    expect(
      reconcileMintSets({
        previousTokenIds: ["1", "2"],
        nextTokenIds: ["1", "3"],
      }),
    ).toEqual({ added: ["3"], removed: ["2"] });
  });
});

describe("Phase 10B store", () => {
  it("save/reload memory + schema rejection + corrupted rejection", () => {
    const key = buildV3PosIndexKey({
      chainId: CHAIN,
      npm: NPM,
      token0: WETH,
      token1: BEER,
      fee: FEE,
    });
    const rec = emptyV3PosIndexRecord({
      chainId: CHAIN,
      factory: FACTORY,
      npm: NPM,
      poolAddress: POOL,
      token0: WETH,
      token1: BEER,
      fee: FEE,
    });
    saveV3PosIndexMemory(key, rec);
    expect(loadV3PosIndexMemory(key)?.schemaVersion).toBe(
      V3_POS_INDEX_SCHEMA_VERSION,
    );

    expect(() =>
      validateV3PosIndexRecord({ ...rec, schemaVersion: 999 }),
    ).toThrow(V3PosStoreError);

    expect(() =>
      validateV3PosIndexRecord({
        ...rec,
        tokenIds: [{ tokenId: "", liquidity: "1" }],
      }),
    ).toThrow(/corrupted/);
  });

  it("generation fence", () => {
    const key = buildV3PosIndexKey({
      chainId: CHAIN,
      npm: NPM,
      token0: WETH,
      token1: BEER,
      fee: FEE,
    });
    const rec = emptyV3PosIndexRecord({
      chainId: CHAIN,
      factory: FACTORY,
      npm: NPM,
      poolAddress: POOL,
      token0: WETH,
      token1: BEER,
      fee: FEE,
    });
    rec.generation = 2;
    saveV3PosIndexMemory(key, rec);
    const next = { ...rec, generation: 3 };
    expect(() =>
      saveV3PosIndexMemory(key, next, { expectedGeneration: 1 }),
    ).toThrow(/generation fence/);
  });
});

describe("Phase 10B Production isolation smoke", () => {
  it("prototype module path is v3-position-index (not adapters)", async () => {
    const mod = await import("@/lib/hansome-score/lp/v3-position-index");
    expect(mod.V3_POS_INDEX_KEY_PREFIX).toBe("scan:v3pos");
    // Ensure Production locker list symbol is not re-exported from prototype
    expect("V3_LOCKER_ADAPTERS" in mod).toBe(false);
  });
});
