import { describe, expect, it } from "vitest";
import {
  LP_AGGREGATE_STATE_DISPLAY,
  LP_LOCK_STATE_DISPLAY,
} from "@/lib/hansome-score/constants";
import {
  isCoreEconomicLpEvidenceComplete,
  scoreLiquidityCoverage,
} from "@/lib/hansome-score/confidence";
import { emptyUniswapVersionCoverage } from "@/lib/hansome-score/lp/coverage";
import { markScanPartial } from "@/lib/hansome-score/scan-deep";
import { FAST_SCAN_STAGES_READY } from "@/lib/hansome-score/scan-fast";
import type {
  LockDistributionReport,
  ScanResponse,
  TokenOverview,
  UniswapVersionCoverage,
  V4PositionInfo,
} from "@/lib/hansome-score/types";

function pos(
  partial: Partial<V4PositionInfo> & { positionNftId: string },
): V4PositionInfo {
  return {
    owner: "0x1111111111111111111111111111111111111111",
    ownerLabel: null,
    lockerName: null,
    lockerAddress: null,
    lockState: "UNLOCKED_EOA_CONTROLLED",
    lockStateDisplay: LP_LOCK_STATE_DISPLAY.UNLOCKED_EOA_CONTROLLED,
    unlockTimestamp: null,
    unlockDateUtc: null,
    lockCreatedAt: null,
    lockTxHash: null,
    liquidity: "1000",
    amount0Raw: "1",
    amount1Raw: "1",
    valueUsd: 5000,
    poolId: "0xpool",
    currency0: "0x0000000000000000000000000000000000000000",
    currency1: "0x2222222222222222222222222222222222222222",
    fee: 500,
    tickSpacing: 10,
    tickLower: 0,
    tickUpper: 100,
    currentTick: 50,
    inRange: true,
    removableByEoa: true,
    evidenceLevel: "on_chain_verified",
    dataSource: "test",
    ...partial,
  };
}

/** v2/v3 searched empty; v4 present but discoveryComplete=false (known-first / non-exhaustive). */
function knownFirstVersionCoverage(
  overrides?: Partial<{
    v4DiscoveryComplete: boolean;
    v4LockComplete: boolean;
    coverageComplete: boolean;
  }>,
): UniswapVersionCoverage {
  const base = emptyUniswapVersionCoverage({
    v4Searched: true,
    v4Pools: 1,
    v4Positions: 3,
    v4DiscoveryComplete: overrides?.v4DiscoveryComplete ?? false,
    v4LockComplete: overrides?.v4LockComplete ?? false,
    v4Detail: "v4 known-first",
  });
  return {
    ...base,
    versionsDetected: ["v4"],
    coverageComplete: overrides?.coverageComplete ?? false,
    incompleteReason:
      overrides?.coverageComplete === true
        ? null
        : "INCOMPLETE COVERAGE — v4 discovery incomplete. Protocol version support ≠ locker support.",
    byVersion: {
      v2: {
        ...base.byVersion.v2,
        searched: true,
        discoveryComplete: true,
        lockAnalysisComplete: true,
        detail: "v2 probed — none",
      },
      v3: {
        ...base.byVersion.v3,
        searched: true,
        discoveryComplete: true,
        lockAnalysisComplete: true,
        detail: "v3 probed — none",
      },
      v4: base.byVersion.v4,
    },
  };
}

function lockDist(
  partial: Partial<LockDistributionReport> = {},
): LockDistributionReport {
  return {
    available: true,
    lockedPct: 28.9,
    unlockedPct: 71.1,
    unknownPct: 0,
    lockedUsd: 4600,
    unlockedUsd: 11400,
    unknownUsd: 0,
    totalPositionUsd: 16000,
    poolLiquidityUsd: 15500,
    reconciledWithPool: true,
    method: "token_amounts",
    reason: null,
    ...partial,
  };
}

function economicOverview(
  overrides: Partial<TokenOverview["lpIntelligence"]> & {
    lpLockStatus?: TokenOverview["lpLockStatus"];
  } = {},
): TokenOverview {
  const { lpLockStatus, ...lpOverrides } = overrides;
  const positions = [
    pos({
      positionNftId: "1",
      lockState: "LOCKED_VERIFIED_ONCHAIN",
      lockStateDisplay: LP_LOCK_STATE_DISPLAY.LOCKED_VERIFIED_ONCHAIN,
      removableByEoa: false,
      lockerName: "Titan",
      valueUsd: 4600,
    }),
    pos({ positionNftId: "2", valueUsd: 5700 }),
    pos({ positionNftId: "3", valueUsd: 5700 }),
  ];
  return {
    lpLockStatus: lpLockStatus ?? "mixed",
    lpIntelligence: {
      poolDetected: true,
      poolsDetectedCount: 1,
      poolId: "0xpool",
      poolManagerBalanceRaw: "1",
      poolManagerBalanceFormatted: "1",
      aggregateLockState: "MIXED",
      aggregateLockStateDisplay: "Mixed",
      aggregateState: "MIXED",
      aggregateStateDisplay: LP_AGGREGATE_STATE_DISPLAY.MIXED,
      positionCounts: {
        detected: 3,
        material: 3,
        locked: 1,
        unlocked: 2,
        unknown: 0,
      },
      lockDistribution: lockDist(),
      discoveryComplete: false,
      knownPositionsVerified: true,
      exhaustiveDiscoveryComplete: false,
      completenessWarning:
        "Verified known positions shown — full PositionManager history discovery not finished.",
      ownershipRiskNote: "Mixed",
      sizeWarning: false,
      positions,
      evidenceLevel: "on_chain_verified",
      detail: "Known-first MIXED with lock distribution.",
      discoverySources: ["seeded_candidates", "multi_version_orchestrator"],
      uniswapVersions: knownFirstVersionCoverage(),
      ...lpOverrides,
    },
  } as unknown as TokenOverview;
}

describe("liquidity coverage model (Verdict B)", () => {
  it("fully available economic LP + non-exhaustive history is not capped at 45%", () => {
    const overview = economicOverview();
    expect(isCoreEconomicLpEvidenceComplete(overview)).toBe(true);
    const dim = scoreLiquidityCoverage(overview);
    expect(dim.score).toBeGreaterThan(45);
    expect(dim.score).toBeGreaterThanOrEqual(90);
    expect(dim.score).toBeLessThan(100);
    expect(dim.band).toBe("High");
    expect(dim.evidence).toContain("core_economic_lp_evidence_complete");
    expect(dim.evidence).toContain("exhaustive_discovery_soft_residual");
    expect(dim.evidence).not.toContain("multi_version_coverage_incomplete");
    // PARTIALLY LOCKED / MIXED must not itself force incomplete hard-cap
    expect(dim.evidence).toContain(
      "mixed_partially_locked_result_not_coverage_penalty",
    );
    expect(dim.evidence).not.toContain("mixed_with_incomplete_discovery");
  });

  it("PARTIALLY LOCKED / MIXED does not reduce coverage by itself", () => {
    const withExhaustive = economicOverview({
      discoveryComplete: true,
      exhaustiveDiscoveryComplete: true,
      uniswapVersions: knownFirstVersionCoverage({
        v4DiscoveryComplete: true,
        v4LockComplete: true,
        coverageComplete: true,
      }),
    });
    const dim = scoreLiquidityCoverage(withExhaustive);
    expect(dim.score).toBe(100);
    expect(dim.incomplete).toBe(false);
    expect(dim.evidence).toContain(
      "mixed_partially_locked_result_not_coverage_penalty",
    );
  });

  it("missing Lock Distribution lowers coverage", () => {
    const overview = economicOverview({
      lockDistribution: lockDist({
        available: false,
        lockedPct: null,
        unlockedPct: null,
        reconciledWithPool: false,
        reason: "Lock percentage unavailable",
      }),
    });
    expect(isCoreEconomicLpEvidenceComplete(overview)).toBe(false);
    const dim = scoreLiquidityCoverage(overview);
    expect(dim.score).toBeLessThanOrEqual(52);
    expect(dim.evidence).toContain("lock_pct_unavailable");
  });

  it("unknown positions lower coverage", () => {
    const overview = economicOverview({
      positionCounts: {
        detected: 3,
        material: 3,
        locked: 1,
        unlocked: 1,
        unknown: 1,
      },
      positions: [
        pos({
          positionNftId: "1",
          lockState: "LOCKED_VERIFIED_ONCHAIN",
          lockStateDisplay: LP_LOCK_STATE_DISPLAY.LOCKED_VERIFIED_ONCHAIN,
          removableByEoa: false,
          valueUsd: 4600,
        }),
        pos({ positionNftId: "2", valueUsd: 5700 }),
        pos({
          positionNftId: "3",
          lockState: "UNABLE_TO_DETERMINE",
          lockStateDisplay: LP_LOCK_STATE_DISPLAY.UNABLE_TO_DETERMINE,
          removableByEoa: null,
          valueUsd: 5700,
        }),
      ],
    });
    expect(isCoreEconomicLpEvidenceComplete(overview)).toBe(false);
    const dim = scoreLiquidityCoverage(overview);
    expect(dim.score).toBeLessThan(90);
    expect(dim.incomplete).toBe(true);
    expect(dim.evidence.some((e) => e.startsWith("unknown_positions="))).toBe(
      true,
    );
  });

  it("unreconciled position economics lower coverage", () => {
    const overview = economicOverview({
      lockDistribution: lockDist({
        available: true,
        reconciledWithPool: false,
        poolLiquidityUsd: 50_000,
        reason: "does not reconcile",
      }),
    });
    // Still economic-complete by available dist, but unreconciled soft/hard penalty applies
    const dim = scoreLiquidityCoverage(overview);
    expect(dim.score).toBeLessThan(95);
    expect(dim.evidence).toContain("position_economics_unreconciled");
  });

  it("unsupported / unknown lockers are honestly reflected", () => {
    const overview = economicOverview({
      lpLockStatus: "unknown",
      aggregateLockState: "UNABLE_TO_DETERMINE",
      aggregateState: "UNKNOWN_INCOMPLETE",
      aggregateStateDisplay: LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE,
      lockDistribution: lockDist({ available: false, reason: "unknown locker" }),
      knownPositionsVerified: false,
    });
    const dim = scoreLiquidityCoverage(overview);
    expect(dim.score).toBeLessThanOrEqual(48);
    expect(dim.incomplete).toBe(true);
    expect(
      dim.evidence.includes("lock_unable_to_determine") ||
        dim.evidence.includes("aggregate_unknown_incomplete"),
    ).toBe(true);
  });

  it("exhaustiveComplete=false prevents 100% where appropriate", () => {
    const overview = economicOverview({
      // Even with coverageComplete true, unfinished exhaustive soft-caps below 100
      discoveryComplete: false,
      exhaustiveDiscoveryComplete: false,
      uniswapVersions: knownFirstVersionCoverage({
        v4DiscoveryComplete: false,
        coverageComplete: true,
      }),
    });
    const dim = scoreLiquidityCoverage(overview);
    expect(dim.score).toBeLessThan(100);
    expect(dim.evidence).toContain("exhaustive_discovery_soft_residual");
  });

  it("completed LP evidence survives later partial stages (markScanPartial)", () => {
    const overview = economicOverview();
    const response = {
      version: "t",
      scannedAt: new Date().toISOString(),
      analysisPhase: "fast",
      analysisStatus: "deep_running",
      analysisStages: {
        ...FAST_SCAN_STAGES_READY,
        liquidity: "done",
        creator: "analyzing",
        burn: "analyzing",
      },
      overview: {
        ...overview,
        address: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
        lpIntelligence: overview.lpIntelligence,
      },
      overall: { score: 51 },
      score: { score: 51 },
      structural: { score: 51 },
      activity: { level: "Low" },
      hansomeLevel: {
        id: "kinda_hansome",
        label: "KINDA HANSOME",
        emoji: "😐",
        rawLevel: "Low",
      },
      confidence: { percent: 50 },
      liquidityUsd: 15500,
      context: {},
      sources: [],
      disclaimers: [],
      uiWording: {
        overallSubtitle: "",
        scoreSubtitle: "",
        structuralSubtitle: "",
        confidenceNote: "",
      },
      scoreProvisional: true,
    } as unknown as ScanResponse;

    const warningBefore = response.overview.lpIntelligence.completenessWarning;
    const distBefore = {
      ...response.overview.lpIntelligence.lockDistribution,
    };
    const partial = markScanPartial(response);

    expect(partial.analysisStages?.liquidity).toBe("done");
    expect(partial.analysisStages?.creator).toBe("partial");
    expect(partial.overview.lpIntelligence.discoveryComplete).toBe(false);
    expect(partial.overview.lpIntelligence.knownPositionsVerified).toBe(true);
    expect(partial.overview.lpIntelligence.lockDistribution.available).toBe(
      true,
    );
    expect(partial.overview.lpIntelligence.lockDistribution.lockedPct).toBe(
      distBefore.lockedPct,
    );
    expect(partial.overview.lpIntelligence.completenessWarning).toBe(
      warningBefore,
    );
    expect(partial.overview.lpIntelligence.completenessWarning).not.toMatch(
      /Temporarily unavailable/i,
    );
    expect(partial.overview.lpIntelligence.detail).not.toMatch(
      /Temporarily unavailable/i,
    );

    const dim = scoreLiquidityCoverage({
      lpLockStatus: "mixed",
      lpIntelligence: partial.overview.lpIntelligence,
    } as TokenOverview);
    expect(dim.score).toBeGreaterThan(45);
    expect(dim.score).toBeGreaterThanOrEqual(90);
  });

  it("true multi-version gap (unsearched v2/v3) still hard-caps at 45%", () => {
    const overview = economicOverview({
      uniswapVersions: emptyUniswapVersionCoverage({
        v4Searched: true,
        v4Pools: 1,
        v4Positions: 3,
        v4DiscoveryComplete: true,
        v4LockComplete: true,
      }),
    });
    expect(isCoreEconomicLpEvidenceComplete(overview)).toBe(false);
    const dim = scoreLiquidityCoverage(overview);
    expect(dim.score).toBeLessThanOrEqual(45);
    expect(dim.evidence).toContain("multi_version_coverage_incomplete");
  });
});
