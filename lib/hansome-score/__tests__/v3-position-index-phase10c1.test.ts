/**
 * Phase 10C-1 — Production V3 Position Index integration + failure injection.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import { mergeV3LockerPositions } from "@/lib/hansome-score/lp/adapters/v3";
import { syntheticUnknownPosition } from "@/lib/hansome-score/lp/adapters/types";
import { materialPositions } from "@/lib/hansome-score/lp/aggregate";
import { V3_LOCKER_ADAPTERS } from "@/lib/hansome-score/lp/lockers";
import {
  attachIndexedV3Positions,
  backfillV3PosIndex,
  clearV3PosBackgroundInflightForTests,
  clearV3PosProductionMemoryForTests,
  clearV3PosStoreMemoryForTests,
  emptyV3PosIndexRecord,
  loadV3PosIndexProduction,
  mergeRealV3PositionsOverStubs,
  resolveMaterialV3PoolPositions,
  saveV3PosIndexProduction,
  simulateReorgIndex,
  useV3PosIndexTestKv,
  v3PosIndexKey,
  V3_POS_INDEX_SCHEMA_VERSION,
  V3_POS_INDEX_SEMANTIC_VERSION,
  type DecodedPoolMint,
  type V3PosChainPort,
} from "@/lib/hansome-score/lp/v3-position-index";

const CHAIN = 4663;
const NPM = "0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3";
const FACTORY = "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA";
const POOL = "0xC71E763a0a258f266d1481295115ea4f291D95ED";
const MULTI_POOL = "0x52e65B17fB6E5BA00Ed806f37Afcd2DaA50271Ca";
const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
const BEER = "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804";
const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const FEE = 10000;
const FEE_MULTI = 100;
const PONS = "0x736D76699C26D0d966744cAe304C000d471f7F35";
const EOA = "0xC017Df7046E875727885EA58D74EDaFf1dEA11FD";
const ZERO = "0x0000000000000000000000000000000000000000";
const HELPER = "0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB";

const BEER_POS = {
  token0: WETH,
  token1: BEER,
  fee: FEE,
  tickLower: -887200,
  tickUpper: 204200,
  liquidity: "36819258015569838458222",
};

function beerOpts() {
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
  creationBlock?: number | null;
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
    async getPoolCreationBlock() {
      return cfg.creationBlock === undefined ? 100 : cfg.creationBlock;
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
      return (
        cfg.codeSizes?.[address.toLowerCase()] ??
        cfg.codeSizes?.[address] ??
        0
      );
    },
    async readSlot0Tick() {
      return cfg.tick ?? 185530;
    },
  };
}

function beerMintFixture() {
  const tx = "0xbeerMintTx";
  return {
    mints: [
      {
        blockNumber: 100,
        txHash: tx,
        tickLower: -887200,
        tickUpper: 204200,
        amountL: BEER_POS.liquidity,
        sender: HELPER,
        owner: NPM,
      },
    ] satisfies DecodedPoolMint[],
    receipts: {
      [tx]: {
        transfers: [
          {
            tokenId: "436637",
            from: ZERO,
            to: HELPER,
            logIndex: 0,
          },
          {
            tokenId: "436637",
            from: HELPER,
            to: PONS,
            logIndex: 1,
          },
        ],
        increaseLiquidity: [
          {
            tokenId: "436637",
            liquidity: BEER_POS.liquidity,
            logIndex: 2,
          },
        ],
      },
    },
    positions: { "436637": BEER_POS },
    owners: {
      "436637": { ok: true as const, owner: PONS },
    },
    codeSizes: { [PONS.toLowerCase()]: 5000 },
  };
}

function poolClient(canon: {
  token0: string;
  token1: string;
  fee: number;
  sqrtPriceX96?: bigint;
  tick?: number;
}) {
  return {
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "token0") return getAddress(canon.token0);
      if (functionName === "token1") return getAddress(canon.token1);
      if (functionName === "fee") return canon.fee;
      if (functionName === "slot0") {
        return [
          canon.sqrtPriceX96 ?? 846088510225045669409392189792753n,
          canon.tick ?? 185530,
          0,
          0,
          0,
          0,
          true,
        ];
      }
      throw new Error(`unexpected ${functionName}`);
    }),
  };
}

beforeEach(() => {
  clearV3PosStoreMemoryForTests();
  clearV3PosProductionMemoryForTests();
  clearV3PosBackgroundInflightForTests();
  useV3PosIndexTestKv(new Map());
});

afterEach(() => {
  clearV3PosStoreMemoryForTests();
  clearV3PosProductionMemoryForTests();
  clearV3PosBackgroundInflightForTests();
  useV3PosIndexTestKv(null);
});

describe("Phase 10C-1 constraints", () => {
  it("keeps discovery attach Unknown (classification is separate Phase 10C-2)", () => {
    // Index resolve path must not invent Locked; adapters run only in discoverV3Liquidity.
    expect(V3_LOCKER_ADAPTERS.map((a) => a.id)).toEqual(["pons_launch"]);
  });

  it("uses production semantic version", () => {
    expect(V3_POS_INDEX_SCHEMA_VERSION).toBe(1);
    expect(V3_POS_INDEX_SEMANTIC_VERSION).toBe("1.0.0-phase10c1");
  });
});

describe("A — BEER fixture discovery", () => {
  it("warm indexed scan attaches tokenId 436637 with Unknown lock", async () => {
    const fix = beerMintFixture();
    const port = mockPort(fix);
    const record = await backfillV3PosIndex({
      port,
      opts: beerOpts(),
    });
    const key = v3PosIndexKey({
      chainId: CHAIN,
      npm: NPM,
      token0: WETH,
      token1: BEER,
      fee: FEE,
    });
    await saveV3PosIndexProduction(key, record);

    const result = await resolveMaterialV3PoolPositions({
      client: poolClient({ token0: WETH, token1: BEER, fee: FEE }) as never,
      poolAddress: POOL,
      fee: FEE,
      port,
      interactiveBudgetMs: 10_000,
    });

    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].positionNftId).toBe("436637");
    expect(result.positions[0].owner?.toLowerCase()).toBe(PONS.toLowerCase());
    expect(result.positions[0].tickLower).toBe(-887200);
    expect(result.positions[0].tickUpper).toBe(204200);
    expect(BigInt(result.positions[0].liquidity!)).toBeGreaterThan(0n);
    expect(result.positions[0].lockState).toBe("UNABLE_TO_DETERMINE");
    expect(result.positions[0].removableByEoa).toBeNull();
    expect(result.positionDiscoveryComplete).toBe(true);
    expect(result.usedFallbackStub).toBe(false);
    expect(result.progressActions).toContain("v3_position_index_complete");
  });

  it("cold missing index schedules background and falls back to stub path", async () => {
    const fix = beerMintFixture();
    const port = mockPort(fix);
    const result = await resolveMaterialV3PoolPositions({
      client: poolClient({ token0: WETH, token1: BEER, fee: FEE }) as never,
      poolAddress: POOL,
      fee: FEE,
      port,
      allowInlineBackfill: false,
      interactiveBudgetMs: 50,
    });
    expect(result.usedFallbackStub).toBe(true);
    expect(result.backgroundScheduled).toBe(true);
    expect(result.positionDiscoveryComplete).toBe(false);
    expect(result.progressActions).toContain(
      "v3_position_index_backfill_schedule",
    );
    expect(result.progressActions).toContain("v3_position_index_fallback_stub");
  });

  it("inline backfill discovers BEER and completes", async () => {
    const fix = beerMintFixture();
    const port = mockPort(fix);
    const result = await resolveMaterialV3PoolPositions({
      client: poolClient({ token0: WETH, token1: BEER, fee: FEE }) as never,
      poolAddress: POOL,
      fee: FEE,
      port,
      allowInlineBackfill: true,
      poolCreationBlock: 100,
      interactiveBudgetMs: 30_000,
    });
    expect(result.positions[0]?.positionNftId).toBe("436637");
    expect(result.positionDiscoveryComplete).toBe(true);
    expect(result.positions[0]?.lockState).toBe("UNABLE_TO_DETERMINE");
  });
});

describe("B — multi-position", () => {
  it("attaches multiple tokenIds without dupes; stable order; zero-liq excluded", () => {
    const record = emptyV3PosIndexRecord({
      chainId: CHAIN,
      factory: FACTORY,
      npm: NPM,
      poolAddress: MULTI_POOL,
      token0: WETH,
      token1: USDG,
      fee: FEE_MULTI,
    });
    record.discoveryComplete = false; // partial window
    record.tokenIds = [
      {
        tokenId: "488807",
        firstSeenBlock: 1,
        firstSeenTx: "0x1",
        lastTransferBlock: null,
        lastTransferTx: null,
        currentOwner: EOA,
        ownerValidatedAtBlock: 1,
        ownerValidationStatus: "ok",
        token0: WETH,
        token1: USDG,
        fee: FEE_MULTI,
        tickLower: 0,
        tickUpper: 100,
        liquidity: "100",
        positionValidatedAtBlock: 1,
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
        tokenId: "488806",
        firstSeenBlock: 1,
        firstSeenTx: "0x2",
        lastTransferBlock: null,
        lastTransferTx: null,
        currentOwner: EOA,
        ownerValidatedAtBlock: 1,
        ownerValidationStatus: "ok",
        token0: WETH,
        token1: USDG,
        fee: FEE_MULTI,
        tickLower: 0,
        tickUpper: 100,
        liquidity: "200",
        positionValidatedAtBlock: 1,
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
        tokenId: "482969",
        firstSeenBlock: 1,
        firstSeenTx: "0x3",
        lastTransferBlock: null,
        lastTransferTx: null,
        currentOwner: EOA,
        ownerValidatedAtBlock: 1,
        ownerValidationStatus: "ok",
        token0: WETH,
        token1: USDG,
        fee: FEE_MULTI,
        tickLower: 0,
        tickUpper: 100,
        liquidity: "0",
        positionValidatedAtBlock: 1,
        status: "zero_liquidity",
        burned: false,
        zeroLiquidity: true,
        ownerTypeAudit: "eoa",
        materialCandidate: false,
        inRange: null,
        source: "pool_mint_receipt",
        lastError: null,
      },
    ];

    const attached = attachIndexedV3Positions(record, {
      poolAddress: MULTI_POOL,
    });
    expect(attached.map((p) => p.positionNftId)).toEqual(["488806", "488807"]);
    expect(materialPositions(attached)).toHaveLength(2);
    expect(attached.every((p) => p.lockState === "UNABLE_TO_DETERMINE")).toBe(
      true,
    );
  });
});

describe("C/D — owner rules", () => {
  it("EOA owner stays Unknown / not removable without adapter", () => {
    const record = emptyV3PosIndexRecord({
      chainId: CHAIN,
      factory: FACTORY,
      npm: NPM,
      poolAddress: POOL,
      token0: WETH,
      token1: BEER,
      fee: FEE,
    });
    record.tokenIds = [
      {
        tokenId: "488806",
        firstSeenBlock: 1,
        firstSeenTx: "0x1",
        lastTransferBlock: null,
        lastTransferTx: null,
        currentOwner: EOA,
        ownerValidatedAtBlock: 1,
        ownerValidationStatus: "ok",
        token0: WETH,
        token1: BEER,
        fee: FEE,
        tickLower: -100,
        tickUpper: 100,
        liquidity: "10",
        positionValidatedAtBlock: 1,
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
    const [p] = attachIndexedV3Positions(record, { poolAddress: POOL });
    expect(p.owner?.toLowerCase()).toBe(EOA.toLowerCase());
    expect(p.lockState).toBe("UNABLE_TO_DETERMINE");
    expect(p.removableByEoa).toBeNull();
  });

  it("contract/Pons owner stays Unknown (not Locked)", () => {
    const record = emptyV3PosIndexRecord({
      chainId: CHAIN,
      factory: FACTORY,
      npm: NPM,
      poolAddress: POOL,
      token0: WETH,
      token1: BEER,
      fee: FEE,
    });
    record.tokenIds = [
      {
        tokenId: "436637",
        firstSeenBlock: 1,
        firstSeenTx: "0x1",
        lastTransferBlock: null,
        lastTransferTx: null,
        currentOwner: PONS,
        ownerValidatedAtBlock: 1,
        ownerValidationStatus: "ok",
        token0: WETH,
        token1: BEER,
        fee: FEE,
        tickLower: -887200,
        tickUpper: 204200,
        liquidity: BEER_POS.liquidity,
        positionValidatedAtBlock: 1,
        status: "active",
        burned: false,
        zeroLiquidity: false,
        ownerTypeAudit: "locker_pons",
        materialCandidate: true,
        inRange: true,
        source: "pool_mint_receipt",
        lastError: null,
      },
    ];
    const [p] = attachIndexedV3Positions(record, { poolAddress: POOL });
    expect(p.lockState).toBe("UNABLE_TO_DETERMINE");
    expect(p.lockerName).toBeNull();
    expect(p.lockerAddress).toBeNull();
  });
});

describe("E/F — zero-liq / burned", () => {
  it("burned not marked unlocked", () => {
    const record = emptyV3PosIndexRecord({
      chainId: CHAIN,
      factory: FACTORY,
      npm: NPM,
      poolAddress: POOL,
      token0: WETH,
      token1: BEER,
      fee: FEE,
    });
    record.tokenIds = [
      {
        tokenId: "999",
        firstSeenBlock: 1,
        firstSeenTx: "0x1",
        lastTransferBlock: null,
        lastTransferTx: null,
        currentOwner: null,
        ownerValidatedAtBlock: 1,
        ownerValidationStatus: "burned_or_nonexistent",
        token0: WETH,
        token1: BEER,
        fee: FEE,
        tickLower: null,
        tickUpper: null,
        liquidity: "0",
        positionValidatedAtBlock: 1,
        status: "burned",
        burned: true,
        zeroLiquidity: true,
        ownerTypeAudit: null,
        materialCandidate: false,
        inRange: null,
        source: "fixture",
        lastError: "ownerOf reverted",
      },
    ];
    const attached = attachIndexedV3Positions(record, {
      poolAddress: POOL,
      includeBurned: true,
    });
    expect(attached).toHaveLength(1);
    expect(attached[0].lockState).toBe("UNABLE_TO_DETERMINE");
    expect(attached[0].removableByEoa).toBeNull();
  });
});

describe("synthetic merge", () => {
  it("removes stub when real positions exist for pool", () => {
    const stub = syntheticUnknownPosition({
      id: `v3-pool:${POOL}:${FEE}`,
      version: "v3",
      poolOrPair: POOL,
      currency0: BEER,
      currency1: WETH,
      fee: FEE,
      dataSource: "stub",
    });
    const real = attachIndexedV3Positions(
      {
        ...emptyV3PosIndexRecord({
          chainId: CHAIN,
          factory: FACTORY,
          npm: NPM,
          poolAddress: POOL,
          token0: WETH,
          token1: BEER,
          fee: FEE,
        }),
        tokenIds: [
          {
            tokenId: "436637",
            firstSeenBlock: 1,
            firstSeenTx: "0x1",
            lastTransferBlock: null,
            lastTransferTx: null,
            currentOwner: PONS,
            ownerValidatedAtBlock: 1,
            ownerValidationStatus: "ok",
            token0: WETH,
            token1: BEER,
            fee: FEE,
            tickLower: -887200,
            tickUpper: 204200,
            liquidity: BEER_POS.liquidity,
            positionValidatedAtBlock: 1,
            status: "active",
            burned: false,
            zeroLiquidity: false,
            ownerTypeAudit: "locker_pons",
            materialCandidate: true,
            inRange: true,
            source: "pool_mint_receipt",
            lastError: null,
          },
        ],
      },
      { poolAddress: POOL },
    );
    const merged = mergeRealV3PositionsOverStubs({ stubs: [stub], real });
    expect(merged).toHaveLength(1);
    expect(merged[0].positionNftId).toBe("436637");
    expect(merged[0].liquidity).not.toBe("1");
  });

  it("mergeV3LockerPositions still replaces stubs", () => {
    const stub = syntheticUnknownPosition({
      id: `v3-pool:${POOL}:${FEE}`,
      version: "v3",
      poolOrPair: POOL,
      dataSource: "stub",
    });
    const verified = [
      {
        ...stub,
        positionNftId: "436637",
        owner: PONS,
        liquidity: BEER_POS.liquidity,
        poolId: POOL,
      },
    ];
    const merged = mergeV3LockerPositions({ stubs: [stub], verified });
    expect(merged).toHaveLength(1);
    expect(merged[0].positionNftId).toBe("436637");
  });
});

describe("failure injection", () => {
  it("1 index missing → fallback Unknown", async () => {
    const r = await resolveMaterialV3PoolPositions({
      client: poolClient({ token0: WETH, token1: BEER, fee: FEE }) as never,
      poolAddress: POOL,
      fee: FEE,
      port: mockPort(beerMintFixture()),
      allowInlineBackfill: false,
    });
    expect(r.usedFallbackStub).toBe(true);
    expect(r.positionDiscoveryComplete).toBe(false);
  });

  it("2/3 corrupt + schema mismatch → fallback, schedule rebuild", async () => {
    const key = v3PosIndexKey({
      chainId: CHAIN,
      npm: NPM,
      token0: WETH,
      token1: BEER,
      fee: FEE,
    });
    const kv = new Map<string, unknown>();
    kv.set(key, { schemaVersion: 999, tokenIds: [] });
    useV3PosIndexTestKv(kv);
    const r = await resolveMaterialV3PoolPositions({
      client: poolClient({ token0: WETH, token1: BEER, fee: FEE }) as never,
      poolAddress: POOL,
      fee: FEE,
      port: mockPort(beerMintFixture()),
      allowInlineBackfill: false,
    });
    expect(r.usedFallbackStub).toBe(true);
    expect(r.backgroundScheduled).toBe(true);
    expect(r.error).toMatch(/SCHEMA_MISMATCH|schemaVersion/i);
  });

  it("5 fee mismatch → fallback", async () => {
    const r = await resolveMaterialV3PoolPositions({
      client: poolClient({ token0: WETH, token1: BEER, fee: 3000 }) as never,
      poolAddress: POOL,
      fee: FEE,
      port: mockPort(beerMintFixture()),
    });
    expect(r.usedFallbackStub).toBe(true);
    expect(r.error).toMatch(/fee_mismatch/);
  });

  it("7 missing receipt → incomplete discovery", async () => {
    const port = mockPort({
      mints: [
        {
          blockNumber: 100,
          txHash: "0xmissing",
          tickLower: 0,
          tickUpper: 1,
          amountL: "1",
          sender: HELPER,
          owner: NPM,
        },
      ],
      receipts: {},
      positions: {},
      owners: {},
    });
    const record = await backfillV3PosIndex({ port, opts: beerOpts() });
    expect(record.discoveryComplete).toBe(false);
    expect(record.completenessErrors.some((e) => /missing receipt/i.test(e))).toBe(
      true,
    );
  });

  it("9/10 positions/ownerOf fail → incomplete, no false lock", async () => {
    const fix = beerMintFixture();
    const port = mockPort({
      ...fix,
      positions: { "436637": "error" },
      owners: {
        "436637": { ok: false, revert: false, error: "rpc timeout" },
      },
    });
    const record = await backfillV3PosIndex({ port, opts: beerOpts() });
    expect(record.discoveryComplete).toBe(false);
    const attached = attachIndexedV3Positions(record, { poolAddress: POOL });
    expect(attached.every((p) => p.lockState === "UNABLE_TO_DETERMINE")).toBe(
      true,
    );
  });

  it("11 ownerOf burned → not unlocked", async () => {
    const fix = beerMintFixture();
    const port = mockPort({
      ...fix,
      owners: {
        "436637": { ok: false, revert: true, error: "ERC721: nonexistent" },
      },
    });
    const record = await backfillV3PosIndex({ port, opts: beerOpts() });
    const burned = record.tokenIds.find((t) => t.tokenId === "436637");
    expect(burned?.burned).toBe(true);
    expect(burned?.status).toBe("burned");
  });

  it("12 pool creation unknown → incomplete", async () => {
    const port = mockPort({
      ...beerMintFixture(),
      creationBlock: null,
    });
    const record = await backfillV3PosIndex({
      port,
      opts: { ...beerOpts(), poolCreationBlock: null },
    });
    expect(record.discoveryComplete).toBe(false);
    expect(record.completenessErrors.join(" ")).toMatch(/creation/i);
  });

  it("14/15 reorg sim fences generation", () => {
    const base = emptyV3PosIndexRecord({
      chainId: CHAIN,
      factory: FACTORY,
      npm: NPM,
      poolAddress: POOL,
      token0: WETH,
      token1: BEER,
      fee: FEE,
    });
    base.generation = 3;
    base.discoveryComplete = true;
    base.tokenIds = [
      {
        tokenId: "436637",
        firstSeenBlock: 900,
        firstSeenTx: "0xold",
        lastTransferBlock: null,
        lastTransferTx: null,
        currentOwner: PONS,
        ownerValidatedAtBlock: 900,
        ownerValidationStatus: "ok",
        token0: WETH,
        token1: BEER,
        fee: FEE,
        tickLower: -887200,
        tickUpper: 204200,
        liquidity: BEER_POS.liquidity,
        positionValidatedAtBlock: 900,
        status: "active",
        burned: false,
        zeroLiquidity: false,
        ownerTypeAudit: "locker_pons",
        materialCandidate: true,
        inRange: true,
        source: "pool_mint_receipt",
        lastError: null,
      },
    ];
    const sim = simulateReorgIndex({
      record: base,
      survivingOverlapTokenIds: ["999001"],
      overlapFromBlock: 800,
    });
    expect(sim.record.generation).toBeGreaterThan(base.generation);
    expect(sim.record.discoveryComplete).toBe(false);
    expect(sim.removedTokenIds).toContain("436637");
    expect(sim.addedTokenIds).toContain("999001");
  });

  it("16/17 duplicate mint + multi tokenIds in one tx", async () => {
    const tx = "0xmulti";
    const port = mockPort({
      mints: [
        {
          blockNumber: 100,
          txHash: tx,
          tickLower: 0,
          tickUpper: 10,
          amountL: "1",
          sender: HELPER,
          owner: NPM,
        },
        {
          blockNumber: 100,
          txHash: tx,
          tickLower: 0,
          tickUpper: 10,
          amountL: "1",
          sender: HELPER,
          owner: NPM,
        },
      ],
      receipts: {
        [tx]: {
          transfers: [
            { tokenId: "1", from: ZERO, to: EOA, logIndex: 0 },
            { tokenId: "2", from: ZERO, to: EOA, logIndex: 1 },
          ],
          increaseLiquidity: [
            { tokenId: "1", liquidity: "10", logIndex: 2 },
            { tokenId: "2", liquidity: "20", logIndex: 3 },
          ],
        },
      },
      positions: {
        "1": { ...BEER_POS, liquidity: "10" },
        "2": { ...BEER_POS, liquidity: "20" },
      },
      owners: {
        "1": { ok: true, owner: EOA },
        "2": { ok: true, owner: EOA },
      },
    });
    const record = await backfillV3PosIndex({ port, opts: beerOpts() });
    expect(record.tokenIds.map((t) => t.tokenId).sort()).toEqual(["1", "2"]);
  });

  it("23 stale generation write rejected", async () => {
    const key = v3PosIndexKey({
      chainId: CHAIN,
      npm: NPM,
      token0: WETH,
      token1: BEER,
      fee: FEE,
    });
    const a = emptyV3PosIndexRecord({
      chainId: CHAIN,
      factory: FACTORY,
      npm: NPM,
      poolAddress: POOL,
      token0: WETH,
      token1: BEER,
      fee: FEE,
    });
    a.generation = 5;
    await saveV3PosIndexProduction(key, a);
    const stale = { ...a, generation: 4, updatedAt: Date.now() };
    const saved = await saveV3PosIndexProduction(key, stale);
    expect(saved.ok).toBe(false);
    expect(saved.reason).toMatch(/stale_generation/);
    const loaded = await loadV3PosIndexProduction(key);
    expect(loaded?.generation).toBe(5);
  });
});

describe("G — progress monotonic", () => {
  it("progress actions are attempt-scoped and include fallback honestly", async () => {
    const r = await resolveMaterialV3PoolPositions({
      client: poolClient({ token0: WETH, token1: BEER, fee: FEE }) as never,
      poolAddress: POOL,
      fee: FEE,
      port: mockPort(beerMintFixture()),
      allowInlineBackfill: false,
    });
    expect(r.progressActions[0]).toBe("v3_position_index_load");
    // no fake complete
    expect(r.progressActions).not.toContain("v3_position_index_complete");
  });
});
