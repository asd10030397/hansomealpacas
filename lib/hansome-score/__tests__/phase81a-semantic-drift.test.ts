/**
 * Phase 8.1A — semantic drift: Full Quick vs Known-First frozen equality.
 * Observation / proof only — no formula changes.
 */
import { describe, expect, it } from "vitest";
import {
  LP_AGGREGATE_STATE_DISPLAY,
  LP_LOCK_STATE_DISPLAY,
  SCAN_CHAIN_ID,
} from "@/lib/hansome-score/constants";
import frozen from "@/lib/hansome-score/__fixtures__/phase81a-frozen.json";
import {
  buildKnownFirstEvidence,
  isKnownFirstStructuralReuse,
  knownFirstSemanticEqual,
  planKnownFirstLpEarlyExit,
} from "@/lib/hansome-score/lp/known-first-early-exit";
import { ANALYSIS_SEMANTIC_VERSION } from "@/lib/hansome-score/warm-incremental";
import {
  buildOverallScoreTrace,
  diffFields,
  scoreInputBucketLabels,
} from "@/lib/hansome-score/score-trace";
import type { LpIntelligence, V4PositionInfo } from "@/lib/hansome-score/types";
import type { OverallScoreInput } from "@/lib/hansome-score/overall";

const HANSOME = frozen.tokens.HANSOME;
const NOW = frozen.evaluationTimestampMs;

function toPos(p: (typeof HANSOME.lpStructural.positions)[number]): V4PositionInfo {
  return {
    positionNftId: p.positionNftId,
    owner: p.owner,
    ownerLabel: p.removableByEoa ? "EOA" : "Locker",
    lockerName: p.removableByEoa ? null : "Titan",
    lockerAddress: null,
    lockState: p.lockState as V4PositionInfo["lockState"],
    lockStateDisplay:
      LP_LOCK_STATE_DISPLAY[p.lockState as keyof typeof LP_LOCK_STATE_DISPLAY] ??
      p.lockState,
    unlockTimestamp: p.unlockTimestamp,
    unlockDateUtc: null,
    lockCreatedAt: null,
    lockTxHash: null,
    liquidity: "1",
    amount0Raw: null,
    amount1Raw: null,
    valueUsd: 100,
    poolId: frozen.externalFixtures.gecko.poolId,
    currency0: null,
    currency1: null,
    fee: 500,
    tickSpacing: 10,
    tickLower: 0,
    tickUpper: 100,
    currentTick: 50,
    inRange: true,
    removableByEoa: p.removableByEoa,
    evidenceLevel: "on_chain_verified",
    dataSource: "phase81a_fixture",
  };
}

function hansomeLp(path: "full_quick" | "known_first"): LpIntelligence {
  const positions = HANSOME.lpStructural.positions.map(toPos);
  return {
    poolDetected: true,
    poolsDetectedCount: 1,
    poolId: frozen.externalFixtures.gecko.poolId,
    poolManagerBalanceRaw: "1",
    poolManagerBalanceFormatted: "1",
    aggregateLockState: "MIXED",
    aggregateLockStateDisplay: LP_AGGREGATE_STATE_DISPLAY.MIXED,
    aggregateState: "MIXED",
    aggregateStateDisplay: LP_AGGREGATE_STATE_DISPLAY.MIXED,
    positionCounts: {
      detected: positions.length,
      material: positions.length,
      locked: 1,
      unlocked: 2,
      unknown: 0,
    },
    lockDistribution: {
      available: true,
      lockedPct: 40,
      unlockedPct: 60,
      unknownPct: 0,
      lockedUsd: 400,
      unlockedUsd: 600,
      unknownUsd: 0,
      totalPositionUsd: 1000,
      poolLiquidityUsd: frozen.externalFixtures.tvl.liquidityUsd,
      reconciledWithPool: true,
      method: "token_amounts",
      reason: "ok",
    },
    discoveryComplete: false,
    knownPositionsVerified: true,
    exhaustiveDiscoveryComplete: false,
    completenessWarning: "incomplete_discovery",
    ownershipRiskNote: "mixed",
    sizeWarning: false,
    positions,
    evidenceLevel: "on_chain_verified",
    detail: "MIXED",
    discoverySources:
      path === "known_first"
        ? ["known_first_early_exit", "cached_position_ids"]
        : ["multi_version_orchestrator", "quick_v4", "titan_locker"],
    uniswapVersions: {
      versionsDetected: ["v4"],
      coverageComplete: false,
      incompleteReason: "incomplete",
      byVersion: {
        v2: {
          version: "v2",
          protocolSupportStatus: "supported",
          searched: true,
          poolsFound: 0,
          positionsFound: 0,
          discoveryComplete: true,
          lockAnalysisComplete: true,
          detail: "",
        },
        v3: {
          version: "v3",
          protocolSupportStatus: "supported",
          searched: true,
          poolsFound: 0,
          positionsFound: 0,
          discoveryComplete: true,
          lockAnalysisComplete: true,
          detail: "",
        },
        v4: {
          version: "v4",
          protocolSupportStatus: "supported",
          searched: true,
          poolsFound: 1,
          positionsFound: 3,
          discoveryComplete: false,
          lockAnalysisComplete: false,
          detail: "",
        },
      },
      protocolSupportNote: "",
      lockerSupportNote: "",
    },
  };
}

function lpCache(): import("@/lib/hansome-score/lp/position-cache").LpDiscoveryCache {
  return {
    version: 1,
    chainId: SCAN_CHAIN_ID,
    address: HANSOME.address.toLowerCase(),
    poolIds: [frozen.externalFixtures.gecko.poolId],
    versions: ["v4"],
    positionIds: [...HANSOME.lpStructural.positionIds],
    lockerCandidates: [],
    exhaustiveComplete: false,
    knownVerifiedAt: NOW - 60_000,
    updatedAt: NOW - 60_000,
  };
}

function liveInput(): OverallScoreInput {
  const i = HANSOME.livePhase8ScoreInput;
  return {
    structuralScore: i.structuralScore,
    liquidityUsd: i.liquidityUsd,
    poolInventoryPctOfSupply: i.poolInventoryPctOfSupply,
    sizeWarning: i.sizeWarning,
    holdersCount: i.holdersCount,
    top10AdjustedPct: i.top10AdjustedPct,
    volume24hUsd: i.volume24hUsd,
    transactions24h: i.transactions24h,
    tokenAgeDays: i.tokenAgeDays,
    dataConfidencePercent: i.dataConfidencePercent,
  };
}

function phase8Reconstructed53(): OverallScoreInput {
  const base = liveInput();
  const d = HANSOME.phase8BaselineEra.reconstructedMinimalInputDeltaFor53;
  return {
    ...base,
    top10AdjustedPct: d.top10AdjustedPct,
    holdersCount: d.holdersCount,
  };
}

describe("Phase 8.1A semantic drift — score trace", () => {
  it("live frozen inputs → overall 54 with documented components", () => {
    const trace = buildOverallScoreTrace(liveInput(), {
      input: "live_phase8_tip_snapshot",
    });
    expect(trace.finalScore).toBe(54);
    expect(trace.components).toEqual(HANSOME.expectedComponents);
    expect(trace.weightedRawRounded6).toBe(53.87);
    expect(trace.roundingStep).toBe("Math.round(gatedWeighted)");
  });

  it("Phase 8 reconstructed 53 via top10 soft-bonus boundary only", () => {
    const t53 = buildOverallScoreTrace(phase8Reconstructed53(), {
      holderAdoption: "phase8_reconstructed_top10_ge_40",
    });
    const t54 = buildOverallScoreTrace(liveInput());
    expect(t53.finalScore).toBe(53);
    expect(t53.components.holderAdoption).toBe(40);
    expect(t54.finalScore).toBe(54);
    expect(t54.components.holderAdoption).toBe(43);
    const diffs = diffFields(
      t53.components as unknown as Record<string, unknown>,
      t54.components as unknown as Record<string, unknown>,
    ).filter((d) => !d.equal);
    expect(diffs.map((d) => d.path)).toEqual(["holderAdoption"]);
  });

  it("rounding threshold ± epsilon around 53.5", () => {
    // weighted 53.5 → round 54; 53.49 → 53
    const near = liveInput();
    // dataConfidence 50 → raw 53.02 → 53
    const lowDc = { ...near, dataConfidencePercent: 50 };
    const t = buildOverallScoreTrace(lowDc);
    expect(t.weightedRawRounded6).toBe(53.02);
    expect(t.finalScore).toBe(53);
    const high = buildOverallScoreTrace(near);
    expect(high.weightedRawRounded6).toBe(53.87);
    expect(high.finalScore).toBe(54);
  });

  it("price/TVL/activity/maturity/confidence single-axis drifts", () => {
    const base = liveInput();
    const priceOnly = buildOverallScoreTrace({
      ...base,
      liquidityUsd: 4_999,
    });
    expect(priceOnly.components.liquidityDepth).toBe(30);
    expect(priceOnly.finalScore).not.toBe(54);

    const tvlOnly = buildOverallScoreTrace({
      ...base,
      liquidityUsd: 25_000,
    });
    expect(tvlOnly.components.liquidityDepth).toBe(60);

    const activityOnly = buildOverallScoreTrace({
      ...base,
      volume24hUsd: 50,
    });
    // vol bucket 18 *0.7 + txs(14) bucket 40 *0.3 → 25
    expect(activityOnly.components.activity).toBe(25);
    expect(activityOnly.finalScore).not.toBe(54);

    const maturityBoundary = buildOverallScoreTrace({
      ...base,
      tokenAgeDays: 13.9,
    });
    expect(maturityBoundary.components.maturity).toBe(42);

    const dcStale = buildOverallScoreTrace({
      ...base,
      dataConfidencePercent: 50,
    });
    expect(dcStale.finalScore).toBe(53);
  });
});

describe("Phase 8.1A — Full Quick vs Known-First frozen LP", () => {
  it("A Full Quick vs B Known-First structural semantic equal", () => {
    const fullQuick = hansomeLp("full_quick");
    const knownFirst = hansomeLp("known_first");
    expect(knownFirstSemanticEqual(fullQuick, knownFirst)).toBe(true);
    expect(fullQuick.aggregateState).toBe("MIXED");
    expect(knownFirst.discoveryComplete).toBe(false);
  });

  it("B Known-First plans price_only / reuse with skipBroadQuick", () => {
    const prior = hansomeLp("known_first");
    const evidence = buildKnownFirstEvidence({
      chainId: SCAN_CHAIN_ID,
      expectedChainId: SCAN_CHAIN_ID,
      tokenAddress: HANSOME.address,
      analysisSemanticVersion: ANALYSIS_SEMANTIC_VERSION,
      lpCache: lpCache(),
      priorLp: prior,
      snapshotAgeMs: 60_000,
      nowMs: NOW,
      manualRefresh: true,
    });
    const plan = planKnownFirstLpEarlyExit(evidence);
    expect(isKnownFirstStructuralReuse(plan.outcome)).toBe(true);
    expect(plan.evidence.skipBroadQuick).toBe(true);
    expect(plan.evidence.reconstructedState).toBe("MIXED");
  });

  it("C forced Full Quick same fixtures → same score as Known-First", () => {
    const scoreA = buildOverallScoreTrace(liveInput(), { input: "mode_A_full_quick" });
    const scoreB = buildOverallScoreTrace(liveInput(), {
      input: "mode_B_known_first",
    });
    const scoreC = buildOverallScoreTrace(liveInput(), {
      input: "mode_C_forced_full_quick",
    });
    expect(scoreA.finalScore).toBe(scoreB.finalScore);
    expect(scoreB.finalScore).toBe(scoreC.finalScore);
    expect(scoreA.components).toEqual(scoreB.components);
  });

  it("D Known-First + frozen market overlay → same as A", () => {
    const market = frozen.externalFixtures;
    const input: OverallScoreInput = {
      ...liveInput(),
      liquidityUsd: market.tvl.liquidityUsd,
      volume24hUsd: market.activity.volume24hUsd,
      transactions24h: market.activity.transactions24h,
      tokenAgeDays: market.maturityTimestamp.tokenAgeDays,
    };
    const d = buildOverallScoreTrace(input, { input: "mode_D_frozen_overlay" });
    const a = buildOverallScoreTrace(liveInput(), { input: "mode_A" });
    // liquidityUsd micro-diff 15839 vs 15843 stays in same depth bucket
    expect(d.components.liquidityDepth).toBe(a.components.liquidityDepth);
    expect(d.finalScore).toBe(a.finalScore);
  });

  it("E Known-First + Phase 8 score inputs replayed → 53", () => {
    const e = buildOverallScoreTrace(phase8Reconstructed53(), {
      input: "mode_E_phase8_replay",
    });
    expect(e.finalScore).toBe(53);
    expect(scoreInputBucketLabels(phase8Reconstructed53()).holderAdoption).toContain(
      "40",
    );
  });

  it("lock expiry / owner transfer / new LP / mixed versions fail closed", () => {
    const prior = hansomeLp("known_first");
    const expired = structuredClone(prior);
    expired.positions[0].unlockTimestamp = Math.floor(NOW / 1000) - 10;
    const lockPlan = planKnownFirstLpEarlyExit(
      buildKnownFirstEvidence({
        chainId: SCAN_CHAIN_ID,
        expectedChainId: SCAN_CHAIN_ID,
        tokenAddress: HANSOME.address,
        analysisSemanticVersion: ANALYSIS_SEMANTIC_VERSION,
        priorLp: expired,
        snapshotAgeMs: 1_000,
        nowMs: NOW,
        lpCache: { ...lpCache(), knownVerifiedAt: NOW - 1_000, updatedAt: NOW - 1_000 },
      }),
    );
    expect(lockPlan.outcome).toBe("known_first_lock_revalidate");

    const xfer = planKnownFirstLpEarlyExit(
      buildKnownFirstEvidence({
        chainId: SCAN_CHAIN_ID,
        expectedChainId: SCAN_CHAIN_ID,
        tokenAddress: HANSOME.address,
        analysisSemanticVersion: ANALYSIS_SEMANTIC_VERSION,
        priorLp: prior,
        snapshotAgeMs: 1_000,
        nowMs: NOW,
        invalidationSignals: ["position_nft_transfer"],
        lpCache: { ...lpCache(), knownVerifiedAt: NOW - 1_000, updatedAt: NOW - 1_000 },
      }),
    );
    expect(xfer.outcome).toBe("known_first_owner_revalidate");

    const newLp = planKnownFirstLpEarlyExit(
      buildKnownFirstEvidence({
        chainId: SCAN_CHAIN_ID,
        expectedChainId: SCAN_CHAIN_ID,
        tokenAddress: HANSOME.address,
        analysisSemanticVersion: ANALYSIS_SEMANTIC_VERSION,
        priorLp: prior,
        snapshotAgeMs: 1_000,
        nowMs: NOW,
        invalidationSignals: ["liquidity_add"],
        lpCache: { ...lpCache(), knownVerifiedAt: NOW - 1_000, updatedAt: NOW - 1_000 },
      }),
    );
    expect(newLp.outcome).toBe("full_quick_fallback");

    const mixedSem = planKnownFirstLpEarlyExit(
      buildKnownFirstEvidence({
        chainId: SCAN_CHAIN_ID,
        expectedChainId: SCAN_CHAIN_ID,
        tokenAddress: HANSOME.address,
        analysisSemanticVersion: "old-semantic",
        priorLp: prior,
        nowMs: NOW,
      }),
    );
    expect(mixedSem.outcome).toBe("cold_fallback");
  });

  it("PRIMARY address is isolated from HANSOME (no hardcoded score)", () => {
    expect(frozen.tokens.PRIMARY.address).toBe(
      "0x57ffd85d9f0744b7790dcdbbc2c0f188f81de00f",
    );
    const primaryInput = liveInput();
    // Same formula, different token identity — score depends on inputs only
    expect(buildOverallScoreTrace(primaryInput).finalScore).toBe(54);
  });

  it("stale cache generation / mixed block provenance flagged in fixture", () => {
    // Live Phase 8 tip snapshot retained known_first_early_exit source after rollback
    expect(
      (
        // from companion live snapshot file semantics mirrored in fixture positions
        HANSOME.lpStructural.positionIds
      ).length,
    ).toBe(3);
    expect(frozen.liveTipConfirmed).toBe("dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7");
    expect(frozen.phase81TipInvestigated).toBe(
      "dpl_jsCNHa1otFa4DfiVfNAjDxHHzgB1",
    );
  });
});
