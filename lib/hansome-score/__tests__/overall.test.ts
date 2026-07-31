import { describe, expect, it } from "vitest";
import { CATEGORY_CAPS } from "@/lib/hansome-score/constants";
import {
  applyStructuralSafetyGate,
  computeOverallTokenScore,
  OVERALL_WEIGHTS,
  scoreActivityHealth,
  scoreHolderAdoption,
  scoreLiquidityDepth,
  scoreMaturity,
} from "@/lib/hansome-score/overall";
import { computeStructuralScore } from "@/lib/hansome-score/score";
import type {
  ContractRiskResult,
  LabeledHolder,
  WalletRelationshipSignals,
} from "@/lib/hansome-score/types";

function cleanContract(): ContractRiskResult {
  return {
    status: "analyzed",
    mintable: false,
    honeypot: false,
    buyTaxBps: 0,
    sellTaxBps: 0,
    transferTaxBps: 0,
    modifiableTax: false,
    pausable: false,
    blacklistOrWhitelist: false,
    isProxy: false,
    hasOwnerAdmin: false,
    privilegedBurn: false,
    findings: [],
    goplusSupplement: null,
    detail: "clean",
  };
}

function noRel(): WalletRelationshipSignals {
  return {
    equalBalanceClusterSize: 0,
    equalBalanceClusterAddresses: [],
    deployerInEqualBalanceCluster: false,
    sharedFundingAddresses: [],
    sharedFundingFunder: null,
    deployerFundedAddresses: [],
    sameBlockEarlyBuyAddresses: [],
    sharedFundingCount: 0,
    deployerFundedCount: 0,
    sameBlockEarlyBuyCount: 0,
  };
}

function holder(
  address: string,
  balanceRaw: string,
  percent: number,
  opts?: Partial<LabeledHolder>,
): LabeledHolder {
  return {
    address,
    balanceRaw,
    balanceFormatted: balanceRaw,
    percentOfSupply: percent,
    ...opts,
  };
}

describe("OVERALL_WEIGHTS", () => {
  it("sums to 1", () => {
    const sum = Object.values(OVERALL_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe("Structural CATEGORY_CAPS regression", () => {
  it("keeps v1.1 structural caps unchanged", () => {
    expect(CATEGORY_CAPS).toEqual({
      contract_risk: 25,
      liquidity_ownership: 20,
      holder_concentration: 20,
      wallet_relationship: 15,
      launch_fairness: 10,
      creator_behaviour: 10,
    });
  });

  it("computeStructuralScore unchanged for clean locked fixture", () => {
    const result = computeStructuralScore({
      totalSupply: 1_000_000_000n * 10n ** 18n,
      topHolders: [
        holder("0x1111111111111111111111111111111111111111", "1", 5, {
          excludedFromConcentration: true,
          label: "Uniswap v4 PoolManager (AMM liquidity)",
        }),
        holder("0x2222222222222222222222222222222222222222", "1", 4),
      ],
      deployer: "0x3333333333333333333333333333333333333333",
      deployerBalance: 0n,
      contractVerified: true,
      lpLockState: "LOCKED_VERIFIED_ONCHAIN",
      poolManagerBalance: 100n,
      contractRisk: cleanContract(),
      relationship: noRel(),
      creatorBehaviourAvailable: true,
      creatorDumpDetected: false,
      creatorTransferThenSellDetected: false,
    });
    expect(result.score).toBe(100);
    expect(result.categoryTotals.liquidity_ownership).toBe(0);
  });
});

describe("component scorers", () => {
  it("scores thin USD liquidity low", () => {
    expect(scoreLiquidityDepth({ liquidityUsd: 50, poolInventoryPctOfSupply: 10, sizeWarning: false })).toBe(15);
    expect(scoreLiquidityDepth({ liquidityUsd: 80_000, poolInventoryPctOfSupply: null, sizeWarning: false })).toBe(60);
  });

  it("falls back to inventory when USD missing", () => {
    expect(
      scoreLiquidityDepth({
        liquidityUsd: null,
        poolInventoryPctOfSupply: 0.5,
        sizeWarning: true,
      }),
    ).toBe(28);
  });

  it("scores ~96 holders in mid-low adoption band", () => {
    expect(scoreHolderAdoption(96, 25)).toBe(43); // 40 + 3 for top10 < 40
    expect(scoreHolderAdoption(96, 55)).toBe(40);
  });

  it("scores tiny activity low", () => {
    expect(scoreActivityHealth(51, 3)).toBe(19); // 18*0.7 + 20*0.3
  });

  it("scores young maturity mid-low", () => {
    expect(scoreMaturity(16)).toBe(55);
    expect(scoreMaturity(2)).toBe(20);
  });
});

describe("computeOverallTokenScore", () => {
  it("does not give 80+ Overall to clean-but-thin young token via general formula", () => {
    const result = computeOverallTokenScore({
      structuralScore: 83,
      liquidityUsd: 2_500,
      poolInventoryPctOfSupply: 11,
      sizeWarning: false,
      holdersCount: 96,
      top10AdjustedPct: 30,
      volume24hUsd: 51,
      transactions24h: 3,
      tokenAgeDays: 16,
      dataConfidencePercent: 55,
    });
    expect(result.score).toBeLessThan(80);
    expect(result.score).toBeGreaterThan(20);
    // Structural high, Overall pulled down by market axes
    expect(result.components.structural).toBe(83);
    expect(result.components.activity).toBeLessThan(30);
    expect(result.components.holderAdoption).toBeLessThan(50);
  });

  it("gives high Overall to established high-activity profile", () => {
    const result = computeOverallTokenScore({
      structuralScore: 92,
      liquidityUsd: 1_500_000,
      poolInventoryPctOfSupply: 8,
      sizeWarning: false,
      holdersCount: 8_000,
      top10AdjustedPct: 35,
      volume24hUsd: 400_000,
      transactions24h: 600,
      tokenAgeDays: 200,
      dataConfidencePercent: 78,
    });
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("sensitivity: raising activity moves Overall up", () => {
    const base = {
      structuralScore: 85,
      liquidityUsd: 40_000,
      poolInventoryPctOfSupply: 5,
      sizeWarning: false,
      holdersCount: 400,
      top10AdjustedPct: 45,
      volume24hUsd: 200,
      transactions24h: 4,
      tokenAgeDays: 40,
      dataConfidencePercent: 60,
    };
    const low = computeOverallTokenScore(base);
    const high = computeOverallTokenScore({
      ...base,
      volume24hUsd: 300_000,
      transactions24h: 400,
    });
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("sensitivity: raising holders moves Overall up", () => {
    const thin = computeOverallTokenScore({
      structuralScore: 90,
      liquidityUsd: 50_000,
      poolInventoryPctOfSupply: 5,
      sizeWarning: false,
      holdersCount: 40,
      top10AdjustedPct: 50,
      volume24hUsd: 20_000,
      transactions24h: 80,
      tokenAgeDays: 60,
      dataConfidencePercent: 65,
    });
    const thick = computeOverallTokenScore({
      structuralScore: 90,
      liquidityUsd: 50_000,
      poolInventoryPctOfSupply: 5,
      sizeWarning: false,
      holdersCount: 6_000,
      top10AdjustedPct: 35,
      volume24hUsd: 20_000,
      transactions24h: 80,
      tokenAgeDays: 60,
      dataConfidencePercent: 65,
    });
    expect(thick.score).toBeGreaterThan(thin.score);
  });

  it("sensitivity: deeper liquidity moves Overall up", () => {
    const shallow = computeOverallTokenScore({
      structuralScore: 88,
      liquidityUsd: 800,
      poolInventoryPctOfSupply: 2,
      sizeWarning: true,
      holdersCount: 500,
      top10AdjustedPct: 40,
      volume24hUsd: 15_000,
      transactions24h: 50,
      tokenAgeDays: 90,
      dataConfidencePercent: 70,
    });
    const deep = computeOverallTokenScore({
      structuralScore: 88,
      liquidityUsd: 3_000_000,
      poolInventoryPctOfSupply: 2,
      sizeWarning: false,
      holdersCount: 500,
      top10AdjustedPct: 40,
      volume24hUsd: 15_000,
      transactions24h: 50,
      tokenAgeDays: 90,
      dataConfidencePercent: 70,
    });
    expect(deep.score).toBeGreaterThan(shallow.score);
  });

  it("divergence: high Structural + thin market → Overall much lower", () => {
    const result = computeOverallTokenScore({
      structuralScore: 95,
      liquidityUsd: 1_200,
      poolInventoryPctOfSupply: 0.4,
      sizeWarning: true,
      holdersCount: 80,
      top10AdjustedPct: 55,
      volume24hUsd: 40,
      transactions24h: 2,
      tokenAgeDays: 10,
      dataConfidencePercent: 50,
    });
    expect(result.components.structural - result.score).toBeGreaterThanOrEqual(25);
  });

  it("safety gate: honeypot-like structural cannot be washed by volume", () => {
    const gated = applyStructuralSafetyGate(85, 22);
    expect(gated.score).toBeLessThanOrEqual(32);
    expect(gated.caps.length).toBeGreaterThan(0);

    const overall = computeOverallTokenScore({
      structuralScore: 22,
      liquidityUsd: 800_000,
      poolInventoryPctOfSupply: 10,
      sizeWarning: false,
      holdersCount: 3_000,
      top10AdjustedPct: 30,
      volume24hUsd: 500_000,
      transactions24h: 800,
      tokenAgeDays: 120,
      dataConfidencePercent: 70,
    });
    expect(overall.score).toBeLessThanOrEqual(32);
    expect(overall.capsApplied.length).toBeGreaterThan(0);
  });

  it("safety gate: structural_lt_40 is exclusive (<40), not ≤40", () => {
    // Spec §2.3: Structural < 40 → Overall ≤ Structural + 20
    const at39 = applyStructuralSafetyGate(67, 39);
    expect(at39.score).toBe(59);
    expect(at39.caps).toContain("structural_lt_40_ceiling_59");

    const at40 = applyStructuralSafetyGate(67, 40);
    expect(at40.score).toBe(67);
    expect(at40.caps).toEqual([]);
  });

  it("adversarial: holder count alone cannot dominate (weight 0.18)", () => {
    const few = computeOverallTokenScore({
      structuralScore: 80,
      liquidityUsd: 100_000,
      poolInventoryPctOfSupply: 5,
      sizeWarning: false,
      holdersCount: 30,
      top10AdjustedPct: 40,
      volume24hUsd: 40_000,
      transactions24h: 120,
      tokenAgeDays: 60,
      dataConfidencePercent: 80,
    });
    const many = computeOverallTokenScore({
      structuralScore: 80,
      liquidityUsd: 100_000,
      poolInventoryPctOfSupply: 5,
      sizeWarning: false,
      holdersCount: 50_000,
      top10AdjustedPct: 40,
      volume24hUsd: 40_000,
      transactions24h: 120,
      tokenAgeDays: 60,
      dataConfidencePercent: 80,
    });
    // Max theoretical swing from holders ≈ 0.18 * (92-12) ≈ 14.4
    expect(many.score - few.score).toBeLessThanOrEqual(16);
    expect(many.score - few.score).toBeGreaterThan(0);
  });

  it("adversarial: liquidity alone cannot dominate (weight 0.20)", () => {
    const shallow = computeOverallTokenScore({
      structuralScore: 80,
      liquidityUsd: 500,
      poolInventoryPctOfSupply: 1,
      sizeWarning: true,
      holdersCount: 500,
      top10AdjustedPct: 40,
      volume24hUsd: 40_000,
      transactions24h: 120,
      tokenAgeDays: 60,
      dataConfidencePercent: 80,
    });
    const deep = computeOverallTokenScore({
      structuralScore: 80,
      liquidityUsd: 5_000_000,
      poolInventoryPctOfSupply: 1,
      sizeWarning: false,
      holdersCount: 500,
      top10AdjustedPct: 40,
      volume24hUsd: 40_000,
      transactions24h: 120,
      tokenAgeDays: 60,
      dataConfidencePercent: 80,
    });
    // Max swing ≈ 0.20 * (95-15) = 16
    expect(deep.score - shallow.score).toBeLessThanOrEqual(18);
  });

  it("adversarial: Data Confidence is not treated as token quality (weight 0.05)", () => {
    const low = computeOverallTokenScore({
      structuralScore: 75,
      liquidityUsd: 80_000,
      poolInventoryPctOfSupply: 5,
      sizeWarning: false,
      holdersCount: 400,
      top10AdjustedPct: 40,
      volume24hUsd: 30_000,
      transactions24h: 90,
      tokenAgeDays: 45,
      dataConfidencePercent: 20,
    });
    const high = computeOverallTokenScore({
      structuralScore: 75,
      liquidityUsd: 80_000,
      poolInventoryPctOfSupply: 5,
      sizeWarning: false,
      holdersCount: 400,
      top10AdjustedPct: 40,
      volume24hUsd: 30_000,
      transactions24h: 90,
      tokenAgeDays: 45,
      dataConfidencePercent: 100,
    });
    expect(high.score - low.score).toBeLessThanOrEqual(5);
  });

  it("adversarial: young maturity lowers Overall but Structural input is unchanged", () => {
    const young = computeOverallTokenScore({
      structuralScore: 90,
      liquidityUsd: 100_000,
      poolInventoryPctOfSupply: 5,
      sizeWarning: false,
      holdersCount: 500,
      top10AdjustedPct: 40,
      volume24hUsd: 50_000,
      transactions24h: 150,
      tokenAgeDays: 1,
      dataConfidencePercent: 70,
    });
    const mature = computeOverallTokenScore({
      structuralScore: 90,
      liquidityUsd: 100_000,
      poolInventoryPctOfSupply: 5,
      sizeWarning: false,
      holdersCount: 500,
      top10AdjustedPct: 40,
      volume24hUsd: 50_000,
      transactions24h: 150,
      tokenAgeDays: 400,
      dataConfidencePercent: 70,
    });
    expect(young.components.structural).toBe(90);
    expect(mature.components.structural).toBe(90);
    expect(mature.score).toBeGreaterThan(young.score);
    // maturity weight 0.10 → max swing ~8.5
    expect(mature.score - young.score).toBeLessThanOrEqual(10);
  });

  it("adversarial: activity volume is only in Overall activity axis (no double Structural path)", () => {
    expect(OVERALL_WEIGHTS.activity).toBe(0.17);
    // Structural CATEGORY_CAPS has no volume/activity key
    expect(
      Object.keys(CATEGORY_CAPS).some((k) => /volume|activity|trending/i.test(k)),
    ).toBe(false);
  });

  it("sanity archetypes: clean-thin vs hot-risky vs mature-liquid", () => {
    const cleanThin = computeOverallTokenScore({
      structuralScore: 85,
      liquidityUsd: 3_000,
      poolInventoryPctOfSupply: 8,
      sizeWarning: false,
      holdersCount: 96,
      top10AdjustedPct: 30,
      volume24hUsd: 50,
      transactions24h: 3,
      tokenAgeDays: 16,
      dataConfidencePercent: 88,
    });
    const hotRisky = computeOverallTokenScore({
      // <40 triggers structural_lt_40 ceiling (Overall ≤ Structural+20)
      structuralScore: 38,
      liquidityUsd: 400_000,
      poolInventoryPctOfSupply: 12,
      sizeWarning: false,
      holdersCount: 4_000,
      top10AdjustedPct: 45,
      volume24hUsd: 200_000,
      transactions24h: 400,
      tokenAgeDays: 90,
      dataConfidencePercent: 70,
    });
    const matureLiquid = computeOverallTokenScore({
      structuralScore: 88,
      liquidityUsd: 2_500_000,
      poolInventoryPctOfSupply: 10,
      sizeWarning: false,
      holdersCount: 12_000,
      top10AdjustedPct: 32,
      volume24hUsd: 500_000,
      transactions24h: 900,
      tokenAgeDays: 300,
      dataConfidencePercent: 85,
    });
    expect(cleanThin.components.structural).toBeGreaterThan(hotRisky.components.structural);
    expect(cleanThin.score).toBeLessThan(80);
    expect(hotRisky.score).toBeGreaterThan(cleanThin.score); // market can lift Overall above clean-thin
    // Ungated market blend for this fixture is ~67; gate caps at 38+20.
    // Note: structuralScore must be <40 (exclusive) — 40 does not trigger the gate.
    expect(hotRisky.capsApplied).toContain("structural_lt_40_ceiling_58");
    expect(hotRisky.score).toBeLessThanOrEqual(58); // structural_lt_40 gate → ≤38+20
    expect(matureLiquid.score).toBeGreaterThan(hotRisky.score);
    expect(matureLiquid.score).toBeGreaterThan(cleanThin.score);
  });
});
