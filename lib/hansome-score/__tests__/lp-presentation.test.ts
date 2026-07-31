import { describe, expect, it } from "vitest";
import { LP_AGGREGATE_STATE_DISPLAY } from "@/lib/hansome-score/constants";
import {
  buildPresentationPools,
  isPerPoolLiquidityAttributionWithheld,
  sectionLiquidityTotals,
  userFacingAggregateLock,
  userFacingPositionLock,
  formatUsdLiquidity,
} from "@/lib/hansome-score/lp/presentation";
import type { LpIntelligence, V4PositionInfo } from "@/lib/hansome-score/types";
import { isMaterialPoolInventory } from "@/lib/hansome-score/lp/pool-materiality";

function pos(
  id: string,
  lockState: V4PositionInfo["lockState"],
  poolId = "0xpool",
): V4PositionInfo {
  const locked =
    lockState === "LOCKED_VERIFIED_ONCHAIN" ||
    lockState === "LOCK_DETECTED_EXPIRY_UNKNOWN";
  return {
    positionNftId: id,
    owner: "0x1111111111111111111111111111111111111111",
    ownerLabel: null,
    lockerName: locked ? "Titan" : null,
    lockerAddress: null,
    lockState,
    lockStateDisplay: locked
      ? "LOCKED — VERIFIED ON-CHAIN"
      : "UNLOCKED / EOA-CONTROLLED",
    unlockTimestamp: locked ? 1_816_012_800 : null,
    unlockDateUtc: locked ? "2027-07-15T00:00:00.000Z" : null,
    lockCreatedAt: null,
    lockTxHash: null,
    liquidity: "1000",
    amount0Raw: null,
    amount1Raw: null,
    poolId,
    currency0: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
    currency1: "0x0000000000000000000000000000000000000000",
    fee: 3000,
    tickSpacing: 60,
    tickLower: 0,
    tickUpper: 100,
    currentTick: 50,
    inRange: true,
    removableByEoa: !locked,
    evidenceLevel: "on_chain_verified",
    dataSource: "test",
  };
}

function baseLp(
  positions: V4PositionInfo[],
  aggregateState: LpIntelligence["aggregateState"],
): LpIntelligence {
  const locked = positions.filter(
    (p) =>
      p.lockState === "LOCKED_VERIFIED_ONCHAIN" ||
      p.lockState === "LOCK_DETECTED_EXPIRY_UNKNOWN",
  ).length;
  const unlocked = positions.filter(
    (p) => p.lockState === "UNLOCKED_EOA_CONTROLLED",
  ).length;
  return {
    poolDetected: true,
    poolsDetectedCount: 1,
    poolId: "0xpool",
    poolManagerBalanceRaw: "1",
    poolManagerBalanceFormatted: "1",
    aggregateLockState:
      aggregateState === "MIXED" ? "MIXED" : "LOCKED_VERIFIED_ONCHAIN",
    aggregateLockStateDisplay:
      aggregateState === "MIXED"
        ? LP_AGGREGATE_STATE_DISPLAY.MIXED
        : LP_AGGREGATE_STATE_DISPLAY.ALL_LOCKED,
    aggregateState,
    aggregateStateDisplay:
      aggregateState === "MIXED"
        ? LP_AGGREGATE_STATE_DISPLAY.MIXED
        : LP_AGGREGATE_STATE_DISPLAY.ALL_LOCKED,
    positionCounts: {
      detected: positions.length,
      material: positions.length,
      locked,
      unlocked,
      unknown: 0,
    },
    lockDistribution: {
      available: false,
      reason: "ranges differ",
      method: null,
      lockedPct: null,
      unlockedPct: null,
      unknownPct: null,
      lockedUsd: null,
      unlockedUsd: null,
      unknownUsd: null,
      totalPositionUsd: null,
      poolLiquidityUsd: null,
      reconciledWithPool: false,
    },
    discoveryComplete: true,
    completenessWarning: null,
    ownershipRiskNote: "",
    sizeWarning: false,
    positions,
    evidenceLevel: "on_chain_verified",
    detail: "",
    discoverySources: ["test"],
    uniswapVersions: {
      versionsDetected: ["v4"],
      coverageComplete: true,
      incompleteReason: null,
      protocolSupportNote: "test",
      lockerSupportNote: "test",
      byVersion: {
        v2: {
          version: "v2",
          protocolSupportStatus: "partial",
          searched: true,
          poolsFound: 0,
          positionsFound: 0,
          discoveryComplete: true,
          lockAnalysisComplete: false,
          detail: "",
        },
        v3: {
          version: "v3",
          protocolSupportStatus: "partial",
          searched: true,
          poolsFound: 0,
          positionsFound: 0,
          discoveryComplete: true,
          lockAnalysisComplete: false,
          detail: "",
        },
        v4: {
          version: "v4",
          protocolSupportStatus: "supported",
          searched: true,
          poolsFound: 1,
          positionsFound: positions.length,
          discoveryComplete: true,
          lockAnalysisComplete: true,
          detail: "",
        },
      },
    },
  };
}

describe("userFacingAggregateLock", () => {
  it("maps MIXED → PARTIALLY_LOCKED for primary UI", () => {
    expect(userFacingAggregateLock("MIXED")).toBe("PARTIALLY_LOCKED");
    expect(userFacingAggregateLock("ALL_LOCKED")).toBe("LOCKED");
    expect(userFacingAggregateLock("ALL_UNLOCKED")).toBe("UNLOCKED");
    expect(userFacingAggregateLock("UNKNOWN_INCOMPLETE")).toBe("UNKNOWN");
  });
});

describe("buildPresentationPools — HANSOME-like MIXED", () => {
  it("builds one V4 pool with PARTIALLY_LOCKED and reliable USD", () => {
    const lp = baseLp(
      [
        pos("47299", "LOCKED_VERIFIED_ONCHAIN"),
        pos("357867", "UNLOCKED_EOA_CONTROLLED"),
        pos("142938", "UNLOCKED_EOA_CONTROLLED"),
      ],
      "MIXED",
    );
    const pools = buildPresentationPools({
      lp,
      tokenSymbol: "HANSOME",
      tokenAddress: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
      liquidityUsd: 16154.2,
    });
    expect(pools).toHaveLength(1);
    expect(pools[0].version).toBe("v4");
    expect(pools[0].lockStatus).toBe("PARTIALLY_LOCKED");
    expect(pools[0].pairLabel).toContain("HANSOME");
    expect(pools[0].liquidityUsd).toBe(16154.2);
    expect(pools[0].positions).toHaveLength(3);
    expect(userFacingPositionLock("LOCKED_VERIFIED_ONCHAIN")).toBe("LOCKED");
    expect(userFacingPositionLock("UNLOCKED_EOA_CONTROLLED")).toBe("UNLOCKED");
  });

  it("does not invent USD when missing", () => {
    const lp = baseLp([pos("1", "UNLOCKED_EOA_CONTROLLED")], "ALL_UNLOCKED");
    const pools = buildPresentationPools({
      lp,
      tokenSymbol: "X",
      tokenAddress: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
      liquidityUsd: null,
    });
    expect(pools[0].liquidityUsd).toBeNull();
    expect(formatUsdLiquidity(null)).toBeNull();
  });
});

const FOX = "0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1";
const WETH = "0x0Bd780A4C0900F7C5C0A1C0A1C0A1C0A1C0AAD73";
const USDG = "0x5fc5c26f6db252ce1b9f4d5c2e2e2e2e2e2ed168";

function foxSynth(poolId: string, quote: string, fee: number): V4PositionInfo {
  return {
    ...pos(`v3-pool:${poolId}:${fee}`, "UNABLE_TO_DETERMINE", poolId),
    owner: null,
    lockerName: null,
    lockStateDisplay: "UNABLE TO DETERMINE",
    unlockTimestamp: null,
    unlockDateUtc: null,
    liquidity: "1",
    currency0: quote.toLowerCase() < FOX.toLowerCase() ? quote : FOX,
    currency1: quote.toLowerCase() < FOX.toLowerCase() ? FOX : quote,
    fee,
    removableByEoa: null,
    evidenceLevel: "unavailable",
    dataSource: "test-v3-synthetic",
  };
}

describe("buildPresentationPools — FOX multi-pool + dust", () => {
  it("attaches labeled TVL when dust inventory leaves one material pool", () => {
    // Adapter filters 1-wei dust + inventory_unknown; presentation sees one material pool.
    expect(isMaterialPoolInventory(1n)).toBe(false);
    expect(isMaterialPoolInventory(null)).toBe(false);
    expect(isMaterialPoolInventory(70_360_000n * 10n ** 18n)).toBe(true);

    const mainPool = "0x9C49F21aDDa14AF527BC56C2a8fAb854F6248685";
    const lp = baseLp([foxSynth(mainPool, WETH, 10000)], "UNKNOWN_INCOMPLETE");
    // Discovered may remain 2 (dust factory hit) while material presentation is 1.
    lp.poolsDetectedCount = 2;
    lp.uniswapVersions.byVersion.v3.poolsFound = 2;
    lp.uniswapVersions.versionsDetected = ["v3"];

    const pools = buildPresentationPools({
      lp,
      tokenSymbol: "FOX",
      tokenAddress: FOX,
      liquidityUsd: 96_400,
    });
    expect(pools).toHaveLength(1);
    expect(pools[0].liquidityUsd).toBe(96_400);
    expect(pools[0].lockStatus).toBe("UNKNOWN");
    expect(formatUsdLiquidity(pools[0].liquidityUsd)).toMatch(/\$96/);
  });

  it("does not split aggregate USD across multi-pool cards; section totals use labeled aggregate", () => {
    const mainPool = "0x9C49F21aDDa14AF527BC56C2a8fAb854F6248685";
    const dustPool = "0x765657607a7e1a0D822513c0233F2fEE793D6ed0";
    const lp = baseLp(
      [foxSynth(mainPool, WETH, 10000), foxSynth(dustPool, USDG, 500)],
      "UNKNOWN_INCOMPLETE",
    );
    lp.poolsDetectedCount = 2;

    const pools = buildPresentationPools({
      lp,
      tokenSymbol: "FOX",
      tokenAddress: FOX,
      liquidityUsd: 96_400,
    });
    expect(pools).toHaveLength(2);
    // Never invent per-pool allocation from token-level TVL
    expect(pools.every((p) => p.liquidityUsd == null)).toBe(true);
    expect(pools.every((p) => p.lockStatus === "UNKNOWN")).toBe(true);

    const totals = sectionLiquidityTotals({
      pools,
      labeledLiquidityUsd: 96_400,
    });
    expect(totals.source).toBe("labeled_aggregate");
    expect(totals.totalLiquidityUsd).toBe(96_400);
    expect(totals.totalPools).toBe(2);
    // Guard: not an even split onto cards
    expect(pools[0].liquidityUsd).not.toBe(48_200);
    expect(pools[1].liquidityUsd).not.toBe(48_200);

    // Presentation UX: cards should use "Included in Total Liquidity", not Unavailable
    expect(
      isPerPoolLiquidityAttributionWithheld({
        presentationPoolCount: pools.length,
        poolLiquidityUsd: pools[0].liquidityUsd,
        totalLiquidityUsd: totals.totalLiquidityUsd,
      }),
    ).toBe(true);
  });

  it("does not claim ALL_LOCKED / LOCKED from synthetic stubs + TVL", () => {
    const lp = baseLp(
      [
        foxSynth("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", WETH, 10000),
        foxSynth("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", USDG, 500),
      ],
      "UNKNOWN_INCOMPLETE",
    );
    lp.poolsDetectedCount = 2;
    const pools = buildPresentationPools({
      lp,
      tokenSymbol: "FOX",
      tokenAddress: FOX,
      liquidityUsd: 96_400,
    });
    expect(userFacingAggregateLock(lp.aggregateState)).toBe("UNKNOWN");
    expect(pools.every((p) => p.lockStatus === "UNKNOWN")).toBe(true);
    expect(pools.some((p) => p.lockStatus === "LOCKED")).toBe(false);
  });
});

describe("buildPresentationPools — CATE / PONS / CASHCAT-style rendering", () => {
  it("single-pool unknown lock still gets labeled USD (CATE-like)", () => {
    const lp = baseLp(
      [foxSynth("0xcccccccccccccccccccccccccccccccccccccccc", WETH, 3000)],
      "UNKNOWN_INCOMPLETE",
    );
    lp.poolsDetectedCount = 1;
    const pools = buildPresentationPools({
      lp,
      tokenSymbol: "CATE",
      tokenAddress: "0xb61a4de2e1797e504f8a8ca134096e9ac0d47777",
      liquidityUsd: 15_924,
    });
    expect(pools).toHaveLength(1);
    expect(pools[0].liquidityUsd).toBe(15_924);
    expect(pools[0].lockStatus).toBe("UNKNOWN");
  });

  it("single-pool MIXED HANSOME path unchanged (no regress)", () => {
    const lp = baseLp(
      [
        pos("47299", "LOCKED_VERIFIED_ONCHAIN"),
        pos("357867", "UNLOCKED_EOA_CONTROLLED"),
      ],
      "MIXED",
    );
    const pools = buildPresentationPools({
      lp,
      tokenSymbol: "HANSOME",
      tokenAddress: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
      liquidityUsd: 16_154.2,
    });
    expect(pools).toHaveLength(1);
    expect(pools[0].lockStatus).toBe("PARTIALLY_LOCKED");
    expect(pools[0].liquidityUsd).toBe(16_154.2);
    const totals = sectionLiquidityTotals({
      pools,
      labeledLiquidityUsd: 16_154.2,
    });
    // Single pool: section sum path not used for multi aggregate
    expect(totals.source).toBe("sum_of_pools");
    expect(totals.totalLiquidityUsd).toBe(16_154.2);
  });

  it("PONS/CASHCAT-style incomplete multi without labeled TVL stays unavailable", () => {
    const lp = baseLp(
      [
        foxSynth("0xdddddddddddddddddddddddddddddddddddddddd", WETH, 3000),
        foxSynth("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", USDG, 500),
      ],
      "UNKNOWN_INCOMPLETE",
    );
    lp.poolsDetectedCount = 2;
    const pools = buildPresentationPools({
      lp,
      tokenSymbol: "PONS",
      tokenAddress: "0x39dbed3a2bd333467115de45665cc57f813c4571",
      liquidityUsd: null,
    });
    expect(pools.every((p) => p.liquidityUsd == null)).toBe(true);
    const totals = sectionLiquidityTotals({
      pools,
      labeledLiquidityUsd: null,
    });
    expect(totals.totalLiquidityUsd).toBeNull();
    expect(totals.source).toBe("none");
    // No labeled total → keep Unavailable (do not claim "Included in Total")
    expect(
      isPerPoolLiquidityAttributionWithheld({
        presentationPoolCount: pools.length,
        poolLiquidityUsd: pools[0].liquidityUsd,
        totalLiquidityUsd: totals.totalLiquidityUsd,
      }),
    ).toBe(false);
  });

  it("TYGR/CASHCAT-style single material pool keeps labeled USD + UNKNOWN lock", () => {
    for (const sample of [
      {
        symbol: "TYGR",
        address: "0x69984ad3322300039f2855f81c44dbc532efe744",
        usd: 12_345,
      },
      {
        symbol: "CASHCAT",
        address: "0x020bfc650a365f8bb26819deaabf3e21291018b4",
        usd: 8_001,
      },
    ]) {
      const lp = baseLp(
        [foxSynth("0xcafecafe00000000000000000000000000000001", WETH, 3000)],
        "UNKNOWN_INCOMPLETE",
      );
      lp.poolsDetectedCount = 1;
      const pools = buildPresentationPools({
        lp,
        tokenSymbol: sample.symbol,
        tokenAddress: sample.address,
        liquidityUsd: sample.usd,
      });
      expect(pools).toHaveLength(1);
      expect(pools[0].liquidityUsd).toBe(sample.usd);
      expect(pools[0].lockStatus).toBe("UNKNOWN");
    }
  });
});
