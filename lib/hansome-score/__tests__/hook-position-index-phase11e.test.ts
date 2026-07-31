import { describe, expect, it, beforeEach } from "vitest";
import {
  MODIFY_LIQUIDITY_TOPIC0,
  DOPPLER_HOOK_INITIALIZER,
  HOOK_POS_POSITION_MANAGER,
  HOOK_POS_POOL_MANAGER,
  HOOK_POS_INDEX_KEY_PREFIX,
  decodeModifyLiquidityLog,
  decodeSignedInt24,
  decodeSignedInt256,
  dedupeModifyLiquidityLogs,
  filterAndDecodeModifyLiquidityLogs,
  ModifyLiquidityDecodeError,
  normalizeBytes32,
  classifyHookPositionOwner,
  isZeroLiquidityDelta,
  addNetDelta,
  buildHookPosIndexKey,
  assertHookPosNamespace,
  GME_TOKEN,
  HANSOME_TOKEN,
  GME_FIXTURE_POSITIONS,
  HOOK_POOL_FIXTURES,
  findHookPoolFixtureByToken,
  isHansomeClassAToken,
  bumpGeneration,
  compareGeneration,
  resolvePublishTerminal,
  emptyHookPositionIndexState,
  upsertHookPosition,
  saveHookPosIndexMemory,
  loadHookPosIndexMemory,
  clearHookPosStoreMemoryForTests,
  HookPosStoreError,
  bootstrapHookPositionIndex,
  incrementalSyncHookPositionIndex,
  applyFixtureBootstrap,
  simulateReorgRollback,
  buildHookPositionIndexSummary,
  useHookPosIndexTestKv,
  clearHookPosProductionMemoryForTests,
  hookPosIndexKey,
  saveHookPosIndexProduction,
  resolveHookPositionIndex,
  type HookPosChainPort,
  type RawLogLike,
} from "@/lib/hansome-score/lp/hook-position-index";

const GME_POOL =
  "0x3623694d2613d7a543903b93226ed020d2fddbe00ed93ebd21aec098b10211c2";
const GME_CREATE =
  "0xf3dfb544e8ab2ff8041b087c879095eb9c36790fb9c7207ba095a72d240b8c82";

function padAddr(addr: string): string {
  return `0x${addr.slice(2).toLowerCase().padStart(64, "0")}`;
}

function encodeInt24Word(n: number): string {
  const u = n < 0 ? (0x1000000 + n) & 0xffffff : n & 0xffffff;
  return u.toString(16).padStart(64, "0");
}

function encodeInt256Word(n: bigint): string {
  const two = 1n << 256n;
  const u = n < 0n ? two + n : n;
  return u.toString(16).padStart(64, "0");
}

function makeMlLog(params: {
  poolId?: string;
  sender?: string;
  tickLower: number;
  tickUpper: number;
  delta: bigint;
  salt: string;
  blockNumber?: number;
  txHash?: string;
  logIndex?: number;
  topic0?: string;
}): RawLogLike {
  const poolId = normalizeBytes32(params.poolId ?? GME_POOL);
  const sender = params.sender ?? DOPPLER_HOOK_INITIALIZER;
  const salt = normalizeBytes32(params.salt);
  const data =
    "0x" +
    encodeInt24Word(params.tickLower) +
    encodeInt24Word(params.tickUpper) +
    encodeInt256Word(params.delta) +
    salt.slice(2);
  return {
    address: HOOK_POS_POOL_MANAGER,
    topics: [
      params.topic0 ?? MODIFY_LIQUIDITY_TOPIC0,
      poolId,
      padAddr(sender),
    ],
    data,
    blockNumber: params.blockNumber ?? 16_864_619,
    transactionHash: params.txHash ?? GME_CREATE,
    logIndex: params.logIndex ?? 0,
  };
}

function gmeCreateLogs(): RawLogLike[] {
  return GME_FIXTURE_POSITIONS.map((p, i) =>
    makeMlLog({
      tickLower: p.tickLower,
      tickUpper: p.tickUpper,
      delta: BigInt(p.netLiquidityDelta!),
      salt: p.salt,
      logIndex: i,
      blockNumber: 16_864_619,
    }),
  );
}

function mockPort(opts?: {
  head?: number;
  receiptLogs?: RawLogLike[];
  rangeLogs?: RawLogLike[];
  liveL?: Record<string, string>;
  throwRange?: boolean;
}): HookPosChainPort {
  const head = opts?.head ?? 16_864_700;
  return {
    async getBlockNumber() {
      return head;
    },
    async getBlockHash(n) {
      return `0x${n.toString(16).padStart(64, "a")}`;
    },
    async getTransactionReceipt(tx) {
      if (tx.toLowerCase() !== GME_CREATE.toLowerCase()) return null;
      return {
        blockNumber: 16_864_619,
        logs: opts?.receiptLogs ?? gmeCreateLogs(),
      };
    },
    async getLogsModifyLiquidity() {
      if (opts?.throwRange) throw new Error("rpc range limited");
      return opts?.rangeLogs ?? [];
    },
    async getPositionInfo({ owner, tickLower, tickUpper, salt }) {
      const key = `${owner.toLowerCase()}|${tickLower}|${tickUpper}|${salt.toLowerCase()}`;
      const fixture = GME_FIXTURE_POSITIONS.find(
        (p) =>
          p.tickLower === tickLower &&
          p.tickUpper === tickUpper &&
          p.salt.toLowerCase() === salt.toLowerCase(),
      );
      if (opts?.liveL?.[key]) return { liquidity: opts.liveL[key] };
      if (
        owner.toLowerCase() === DOPPLER_HOOK_INITIALIZER.toLowerCase() &&
        fixture
      ) {
        return { liquidity: fixture.netLiquidityDelta! };
      }
      // PosM collision probe
      if (owner.toLowerCase() === HOOK_POS_POSITION_MANAGER.toLowerCase()) {
        return { liquidity: "0" };
      }
      return { liquidity: "0" };
    },
  };
}

beforeEach(() => {
  clearHookPosStoreMemoryForTests();
  clearHookPosProductionMemoryForTests();
  useHookPosIndexTestKv(null);
});

describe("Phase 11E — ModifyLiquidity decoder", () => {
  it("verifies topic0 exactly", () => {
    expect(() =>
      decodeModifyLiquidityLog(
        makeMlLog({
          tickLower: 0,
          tickUpper: 1,
          delta: 1n,
          salt: "0x0",
          topic0:
            "0x0000000000000000000000000000000000000000000000000000000000000001",
        }),
      ),
    ).toThrow(ModifyLiquidityDecodeError);
  });

  it("rejects false-positive pool topic", () => {
    const log = makeMlLog({
      tickLower: 1,
      tickUpper: 2,
      delta: 1n,
      salt: "0x1",
    });
    expect(() =>
      decodeModifyLiquidityLog(log, {
        expectedPoolId:
          "0xd3073ec423c33dd50ccfdf04687d58cd9043210bcef7aca31f3c48331d8635cf",
      }),
    ).toThrow(/poolId topic mismatch/);
  });

  it("decodes signed int24 ticks", () => {
    expect(decodeSignedInt24(encodeInt24Word(-887200))).toBe(-887200);
    expect(decodeSignedInt24(encodeInt24Word(189400))).toBe(189400);
  });

  it("decodes signed int256 liquidityDelta", () => {
    expect(decodeSignedInt256(encodeInt256Word(-100n))).toBe(-100n);
    expect(decodeSignedInt256(encodeInt256Word(123456789n))).toBe(123456789n);
  });

  it("rejects malformed data", () => {
    expect(() =>
      decodeModifyLiquidityLog({
        topics: [
          MODIFY_LIQUIDITY_TOPIC0,
          normalizeBytes32(GME_POOL),
          padAddr(DOPPLER_HOOK_INITIALIZER),
        ],
        data: "0x1234",
        blockNumber: 1,
        transactionHash: "0xabc",
        logIndex: 0,
      }),
    ).toThrow(/data must encode/);
  });

  it("deduplicates by txHash + logIndex", () => {
    const a = decodeModifyLiquidityLog(
      makeMlLog({ tickLower: 1, tickUpper: 2, delta: 1n, salt: "0x1", logIndex: 3 }),
    );
    const b = decodeModifyLiquidityLog(
      makeMlLog({ tickLower: 1, tickUpper: 2, delta: 1n, salt: "0x1", logIndex: 3 }),
    );
    expect(dedupeModifyLiquidityLogs([a, b])).toHaveLength(1);
  });

  it("filters RPC false positives client-side", () => {
    const good = makeMlLog({
      tickLower: 1,
      tickUpper: 2,
      delta: 5n,
      salt: "0x1",
    });
    const bad = makeMlLog({
      tickLower: 1,
      tickUpper: 2,
      delta: 5n,
      salt: "0x1",
      topic0:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
    });
    const { accepted, rejected } = filterAndDecodeModifyLiquidityLogs(
      [good, bad],
      { expectedPoolId: GME_POOL },
    );
    expect(accepted).toHaveLength(1);
    expect(rejected.length).toBeGreaterThan(0);
  });
});

describe("Phase 11E — classification + net delta", () => {
  it("classifies hook vs PosM vs other", () => {
    expect(
      classifyHookPositionOwner({
        sender: DOPPLER_HOOK_INITIALIZER,
        hookAddress: DOPPLER_HOOK_INITIALIZER,
        positionManager: HOOK_POS_POSITION_MANAGER,
      }),
    ).toBe("hook_owned");
    expect(
      classifyHookPositionOwner({
        sender: HOOK_POS_POSITION_MANAGER,
        hookAddress: DOPPLER_HOOK_INITIALIZER,
        positionManager: HOOK_POS_POSITION_MANAGER,
      }),
    ).toBe("foreign_posm");
    expect(
      classifyHookPositionOwner({
        sender: "0x0000000000000000000000000000000000000001",
        hookAddress: DOPPLER_HOOK_INITIALIZER,
        positionManager: HOOK_POS_POSITION_MANAGER,
      }),
    ).toBe("foreign_other");
  });

  it("handles zero-delta fee pokes", () => {
    expect(isZeroLiquidityDelta("0")).toBe(true);
    expect(isZeroLiquidityDelta("1")).toBe(false);
    expect(addNetDelta("10", "5")).toBe("15");
    expect(addNetDelta("10", "-3")).toBe("7");
  });
});

describe("Phase 11E — cache key + generation", () => {
  it("uses scan:v4hook namespace", () => {
    const key = buildHookPosIndexKey({ chainId: 4663, poolId: GME_POOL });
    expect(key.startsWith(`${HOOK_POS_INDEX_KEY_PREFIX}:`)).toBe(true);
    expect(key).toContain("4663");
    expect(() => assertHookPosNamespace("scan:v3pos:x")).toThrow();
    expect(() => assertHookPosNamespace("scan:xfer:x")).toThrow();
  });

  it("fences generations", async () => {
    const map = new Map<string, unknown>();
    useHookPosIndexTestKv(map);
    const key = hookPosIndexKey({ chainId: 4663, poolId: GME_POOL });
    const state = emptyHookPositionIndexState({
      chainId: 4663,
      poolId: GME_POOL,
      hookAddress: DOPPLER_HOOK_INITIALIZER,
    });
    state.generation = "2";
    state.positions = [
      {
        chainId: 4663,
        poolId: GME_POOL,
        owner: DOPPLER_HOOK_INITIALIZER.toLowerCase(),
        tickLower: 0,
        tickUpper: 1,
        salt: normalizeBytes32("0x0"),
        classification: "hook_owned",
        firstSeenBlock: 1,
        lastSeenBlock: 1,
        source: "fixture",
      },
    ];
    state.hookDiscoveryComplete = true;
    state.terminalState = "SUCCESS_COMPLETE";
    await saveHookPosIndexProduction(key, state);
    const stale = structuredClone(state);
    stale.generation = "1";
    const denied = await saveHookPosIndexProduction(key, stale);
    expect(denied.ok).toBe(false);
    expect(denied.reason).toMatch(/stale_generation/);
    expect(compareGeneration("3", "2")).toBeGreaterThan(0);
    expect(bumpGeneration("2")).toBe("3");
  });
});

describe("Phase 11E — GME fixture integration", () => {
  it("bootstraps 8 hook-owned positions salts 0..7 from create receipt", async () => {
    const port = mockPort({ head: 16_864_700 });
    const fixture = findHookPoolFixtureByToken(GME_TOKEN)!;
    const state = await bootstrapHookPositionIndex({
      port,
      opts: {
        chainId: 4663,
        poolId: GME_POOL,
        hookAddress: DOPPLER_HOOK_INITIALIZER,
        positionManager: HOOK_POS_POSITION_MANAGER,
        poolManager: HOOK_POS_POOL_MANAGER,
        createTx: GME_CREATE,
        createBlock: 16_864_619,
        confirmationDepth: 12,
        interactiveBudgetMs: 5_000,
        fixture,
      },
    });

    const hooks = state.positions.filter((p) => p.classification === "hook_owned");
    expect(hooks).toHaveLength(8);
    const salts = hooks.map((p) => BigInt(p.salt)).sort((a, b) => Number(a - b));
    expect(salts).toEqual([0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n]);
    expect(state.discoveryMethod).toBe("create_receipt");
    expect(hooks.every((p) => p.stateViewValidated === true)).toBe(true);
    expect(hooks.every((p) => p.liveLiquidity && BigInt(p.liveLiquidity) > 0n)).toBe(
      true,
    );
    expect(state.hookDiscoveryComplete).toBe(true);
    expect(state.terminalState).toBe("SUCCESS_COMPLETE");
    expect(state.foreignDiscoveryComplete).toBe(false);

    // PosM collision: same ticks/salt under PosM → L=0 (via port)
    for (const h of hooks) {
      const info = await port.getPositionInfo!({
        poolId: GME_POOL,
        owner: HOOK_POS_POSITION_MANAGER,
        tickLower: h.tickLower,
        tickUpper: h.tickUpper,
        salt: h.salt,
      });
      expect(info?.liquidity).toBe("0");
    }

    const summary = buildHookPositionIndexSummary(state);
    expect(summary.hookOwnedCount).toBe(8);
    expect(summary.hookDiscoveryComplete).toBe(true);
  });

  it("zero-delta poke does not invent a new position", async () => {
    const poke = makeMlLog({
      tickLower: 999,
      tickUpper: 1000,
      delta: 0n,
      salt: "0x99",
      blockNumber: 16_864_650,
      logIndex: 99,
    });
    const port = mockPort({
      head: 16_864_700,
      rangeLogs: [poke],
    });
    const state = await bootstrapHookPositionIndex({
      port,
      opts: {
        chainId: 4663,
        poolId: GME_POOL,
        hookAddress: DOPPLER_HOOK_INITIALIZER,
        positionManager: HOOK_POS_POSITION_MANAGER,
        poolManager: HOOK_POS_POOL_MANAGER,
        createTx: GME_CREATE,
        createBlock: 16_864_619,
        confirmationDepth: 12,
        interactiveBudgetMs: 5_000,
      },
    });
    expect(
      state.positions.find((p) => p.tickLower === 999),
    ).toBeUndefined();
    expect(state.positions.filter((p) => p.classification === "hook_owned")).toHaveLength(
      8,
    );
  });
});

describe("Phase 11E — OKC partial + HANSOME regression", () => {
  it("OKC does not fabricate completeness without create tx", async () => {
    const okc = HOOK_POOL_FIXTURES.find((f) => f.label === "OKC")!;
    const port: HookPosChainPort = {
      async getBlockNumber() {
        return 20_000_000;
      },
      async getBlockHash(n) {
        return `0x${n.toString(16).padStart(64, "b")}`;
      },
      async getTransactionReceipt() {
        return null;
      },
      async getLogsModifyLiquidity() {
        throw new Error("Missing or invalid parameters");
      },
      async getPositionInfo() {
        return null;
      },
    };
    const state = await bootstrapHookPositionIndex({
      port,
      opts: {
        chainId: 4663,
        poolId: okc.poolId,
        hookAddress: okc.hookAddress,
        positionManager: okc.positionManager,
        poolManager: okc.poolManager,
        createTx: null,
        createBlock: null,
        confirmationDepth: 64,
        interactiveBudgetMs: 2_000,
        fixture: okc,
      },
    });
    expect(state.hookDiscoveryComplete).toBe(false);
    expect(state.terminalState).toBe("SUCCESS_PARTIAL");
    expect(state.incompleteReasons).toContain("create_tx_unknown");
    expect(state.incompleteReasons).toContain("create_block_unknown");
  });

  it("HANSOME Class A skips hook index primary path", async () => {
    expect(isHansomeClassAToken(HANSOME_TOKEN)).toBe(true);
    const result = await resolveHookPositionIndex({
      tokenAddress: HANSOME_TOKEN,
      ownershipClass: "posm_nft",
      disableBackground: true,
    });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe("class_a_posm_nft");
    expect(result.summary).toBeNull();
  });
});

describe("Phase 11E — reorg + state machine", () => {
  it("rolls back positions first-seen in reorg window", () => {
    let state = applyFixtureBootstrap(
      {
        chainId: 4663,
        poolId: GME_POOL,
        hookAddress: DOPPLER_HOOK_INITIALIZER,
        positionManager: HOOK_POS_POSITION_MANAGER,
        poolManager: HOOK_POS_POOL_MANAGER,
      },
      findHookPoolFixtureByToken(GME_TOKEN)!,
    );
    // Inject a late position
    state = upsertHookPosition(state, {
      chainId: 4663,
      poolId: GME_POOL,
      owner: DOPPLER_HOOK_INITIALIZER.toLowerCase(),
      tickLower: 1,
      tickUpper: 2,
      salt: normalizeBytes32("0xff"),
      classification: "hook_owned",
      firstSeenBlock: 16_864_680,
      lastSeenBlock: 16_864_680,
      source: "modify_liquidity_log",
      netLiquidityDelta: "1",
    });
    expect(state.positions).toHaveLength(9);
    const rolled = simulateReorgRollback({
      state,
      rollbackFromBlock: 16_864_670,
    });
    expect(rolled.positions).toHaveLength(8);
    expect(rolled.hookDiscoveryComplete).toBe(false);
    expect(rolled.incompleteReasons).toContain("reorg_detected");
  });

  it("SUCCESS_COMPLETE only when hookDiscoveryComplete", () => {
    const state = emptyHookPositionIndexState({
      chainId: 4663,
      poolId: GME_POOL,
    });
    state.hookDiscoveryComplete = false;
    state.positions = [
      {
        chainId: 4663,
        poolId: GME_POOL,
        owner: DOPPLER_HOOK_INITIALIZER.toLowerCase(),
        tickLower: 0,
        tickUpper: 1,
        salt: normalizeBytes32("0x0"),
        classification: "hook_owned",
        firstSeenBlock: 1,
        lastSeenBlock: 1,
        source: "fixture",
      },
    ];
    expect(resolvePublishTerminal(state)).toBe("SUCCESS_PARTIAL");
    state.hookDiscoveryComplete = true;
    expect(resolvePublishTerminal(state)).toBe("SUCCESS_COMPLETE");
  });

  it("incremental net-delta aggregation", async () => {
    const port = mockPort({ head: 16_864_650 });
    const fixture = findHookPoolFixtureByToken(GME_TOKEN)!;
    let state = await bootstrapHookPositionIndex({
      port,
      opts: {
        chainId: 4663,
        poolId: GME_POOL,
        hookAddress: DOPPLER_HOOK_INITIALIZER,
        positionManager: HOOK_POS_POSITION_MANAGER,
        poolManager: HOOK_POS_POOL_MANAGER,
        createTx: GME_CREATE,
        createBlock: 16_864_619,
        confirmationDepth: 12,
        interactiveBudgetMs: 5_000,
        fixture,
        skipStateView: true,
      },
    });
    const first = state.positions[0]!;
    const burn = makeMlLog({
      tickLower: first.tickLower,
      tickUpper: first.tickUpper,
      delta: -100n,
      salt: first.salt,
      blockNumber: 16_864_640,
      logIndex: 50,
      txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    const port2 = mockPort({
      head: 16_864_700,
      rangeLogs: [burn],
    });
    state = await incrementalSyncHookPositionIndex({
      port: port2,
      opts: {
        chainId: 4663,
        poolId: GME_POOL,
        hookAddress: DOPPLER_HOOK_INITIALIZER,
        positionManager: HOOK_POS_POSITION_MANAGER,
        poolManager: HOOK_POS_POOL_MANAGER,
        createTx: GME_CREATE,
        createBlock: 16_864_619,
        confirmationDepth: 12,
        interactiveBudgetMs: 5_000,
        skipStateView: true,
      },
      existing: state,
    });
    const updated = state.positions.find(
      (p) =>
        p.tickLower === first.tickLower && p.salt === first.salt,
    )!;
    expect(BigInt(updated.netLiquidityDelta!)).toBe(
      BigInt(first.netLiquidityDelta!) - 100n,
    );
  });
});

describe("Phase 11E — memory store validation", () => {
  it("rejects complete-with-empty-positions", () => {
    const key = buildHookPosIndexKey({ chainId: 4663, poolId: GME_POOL });
    const state = emptyHookPositionIndexState({
      chainId: 4663,
      poolId: GME_POOL,
    });
    state.hookDiscoveryComplete = true;
    expect(() => saveHookPosIndexMemory(key, state)).toThrow(HookPosStoreError);
  });

  it("round-trips memory", () => {
    const key = buildHookPosIndexKey({ chainId: 4663, poolId: GME_POOL });
    const state = applyFixtureBootstrap(
      {
        chainId: 4663,
        poolId: GME_POOL,
        hookAddress: DOPPLER_HOOK_INITIALIZER,
        positionManager: HOOK_POS_POSITION_MANAGER,
        poolManager: HOOK_POS_POOL_MANAGER,
      },
      findHookPoolFixtureByToken(GME_TOKEN)!,
    );
    saveHookPosIndexMemory(key, state);
    const loaded = loadHookPosIndexMemory(key)!;
    expect(loaded.positions).toHaveLength(8);
  });
});
