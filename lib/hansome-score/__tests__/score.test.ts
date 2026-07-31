import { describe, expect, it } from "vitest";
import { computeActivity } from "@/lib/hansome-score/activity";
import { computeConfidence } from "@/lib/hansome-score/confidence";
import { analyzeContractRisk } from "@/lib/hansome-score/contract-risk";
import {
  HANSOME_LEVEL_CATALOG,
  toHansomeLevel,
} from "@/lib/hansome-score/hansome-level";
import {
  computeOverallTokenScore,
  OVERALL_WEIGHTS,
} from "@/lib/hansome-score/overall";
import { buildRelationshipSignals } from "@/lib/hansome-score/relationship";
import {
  computeStructuralScore,
  largestEqualBalanceCluster,
} from "@/lib/hansome-score/score";
import type {
  ContractRiskResult,
  LabeledHolder,
  TokenOverview,
  WalletRelationshipSignals,
} from "@/lib/hansome-score/types";
import { LP_LOCK_STATE_DISPLAY } from "@/lib/hansome-score/constants";
import { testCompleteVersionCoverage } from "@/lib/hansome-score/lp/coverage";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

function noRel(overrides?: Partial<WalletRelationshipSignals>): WalletRelationshipSignals {
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
    ...overrides,
  };
}

function baseInput(overrides: Partial<Parameters<typeof computeStructuralScore>[0]> = {}) {
  return {
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
    lpLockState: "LOCKED_VERIFIED_ONCHAIN" as const,
    poolManagerBalance: 100n,
    contractRisk: cleanContract(),
    relationship: noRel(),
    creatorBehaviourAvailable: true,
    creatorDumpDetected: false,
    creatorTransferThenSellDetected: false,
    ...overrides,
  };
}

describe("computeStructuralScore v1.1", () => {
  it("does not penalize verified locked LP ownership", () => {
    const result = computeStructuralScore(baseInput());
    expect(result.categoryTotals.liquidity_ownership).toBe(0);
    expect(result.score).toBe(100);
  });

  it("penalizes concentration and unlocked LP, not raw holder count", () => {
    const result = computeStructuralScore(
      baseInput({
        totalSupply: 100n,
        topHolders: [holder("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "40", 40)],
        deployerBalance: 1n,
        lpLockState: "UNLOCKED_EOA_CONTROLLED",
        poolManagerBalance: 10n,
      }),
    );
    expect(result.categoryTotals.liquidity_ownership).toBe(20);
    expect(result.categoryTotals.holder_concentration).toBeGreaterThanOrEqual(14);
    expect(result.score).toBeLessThan(70);
  });

  it("applies probabilistic equal-balance cluster deduction", () => {
    const result = computeStructuralScore(
      baseInput({
        relationship: noRel({ equalBalanceClusterSize: 4 }),
      }),
    );
    expect(result.categoryTotals.wallet_relationship).toBe(6);
    expect(result.flags.some((f) => f.code === "possible_related_wallets")).toBe(true);
  });

  it("Top-10 ~59% is not zero concentration deduction", () => {
    const holders = Array.from({ length: 10 }, (_, i) =>
      holder(`0x${(i + 1).toString(16).padStart(40, "0")}`, "1", 5.9),
    );
    const result = computeStructuralScore(
      baseInput({
        topHolders: holders,
      }),
    );
    expect(result.categoryTotals.holder_concentration).toBeGreaterThanOrEqual(4);
    expect(result.deductions.some((d) => d.code === "top10_ge_50")).toBe(true);
  });

  it("never maps unable-to-determine LP as unlocked (deducts without unlocked code)", () => {
    const result = computeStructuralScore(
      baseInput({ lpLockState: "UNABLE_TO_DETERMINE" }),
    );
    expect(result.categoryTotals.liquidity_ownership).toBe(12);
    expect(result.deductions.some((d) => d.code === "lp_unlocked_eoa")).toBe(false);
    expect(result.deductions.some((d) => d.code === "lp_unable_to_determine")).toBe(true);
  });
});

describe("adversarial constructs — hostile must not score 80–90+ from missing data", () => {
  it("Construct A stealth rug template scores well below 80", () => {
    // mintable + honeypot ignored would have been ~90 in v1; v1.1 must crush it
    const result = computeStructuralScore(
      baseInput({
        contractRisk: {
          ...cleanContract(),
          mintable: true,
          honeypot: true,
          buyTaxBps: 5000,
          sellTaxBps: 5000,
          modifiableTax: true,
          pausable: true,
          blacklistOrWhitelist: true,
        },
        lpLockState: "UNABLE_TO_DETERMINE",
        topHolders: Array.from({ length: 10 }, (_, i) =>
          holder(`0x${(i + 10).toString(16).padStart(40, "0")}`, "1", 5.9),
        ),
        deployerBalance: (1_000_000_000n * 10n ** 18n * 49n) / 1000n, // 4.9%
        creatorBehaviourAvailable: false,
        relationship: noRel(),
      }),
    );
    expect(result.score).toBeLessThan(80);
    expect(result.categoryTotals.contract_risk).toBeGreaterThan(0);
  });

  it("clean fixed-supply locked token can still score high", () => {
    const result = computeStructuralScore(
      baseInput({
        creatorBehaviourAvailable: false,
        relationship: noRel({ equalBalanceClusterSize: 3 }),
        topHolders: [
          holder("0x1111111111111111111111111111111111111111", "1", 11, {
            excludedFromConcentration: true,
            label: "Uniswap v4 PoolManager (AMM liquidity)",
          }),
          ...Array.from({ length: 10 }, (_, i) =>
            holder(`0x${(i + 2).toString(16).padStart(40, "0")}`, "1", 3.5),
          ),
        ],
      }),
    );
    // creator provisional -8 + cluster -6 = 86 if no concentration
    expect(result.categoryTotals.contract_risk).toBe(0);
    expect(result.categoryTotals.liquidity_ownership).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("mintable token is heavily penalized", () => {
    const result = computeStructuralScore(
      baseInput({
        contractRisk: { ...cleanContract(), mintable: true },
        creatorBehaviourAvailable: true,
      }),
    );
    expect(result.categoryTotals.contract_risk).toBe(18);
    expect(result.score).toBe(82);
  });

  it("honeypot hits category cap", () => {
    const result = computeStructuralScore(
      baseInput({
        contractRisk: { ...cleanContract(), honeypot: true, mintable: true },
      }),
    );
    expect(result.categoryTotals.contract_risk).toBe(25);
  });

  it("50% tax is heavily penalized", () => {
    const result = computeStructuralScore(
      baseInput({
        contractRisk: {
          ...cleanContract(),
          buyTaxBps: 5000,
          sellTaxBps: 5000,
        },
      }),
    );
    expect(result.deductions.some((d) => d.code === "tax_ge_50")).toBe(true);
    expect(result.score).toBeLessThanOrEqual(80);
  });

  it("unlocked LP deducts 20", () => {
    const result = computeStructuralScore(
      baseInput({ lpLockState: "UNLOCKED_EOA_CONTROLLED" }),
    );
    expect(result.categoryTotals.liquidity_ownership).toBe(20);
  });

  it("highly concentrated top-1 ≥50% maxes concentration", () => {
    const result = computeStructuralScore(
      baseInput({
        topHolders: [holder("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "1", 55)],
      }),
    );
    expect(result.categoryTotals.holder_concentration).toBe(20);
  });

  it("creator dump when indexed deducts", () => {
    const result = computeStructuralScore(
      baseInput({
        creatorBehaviourAvailable: true,
        creatorDumpDetected: true,
      }),
    );
    expect(result.categoryTotals.creator_behaviour).toBe(10);
  });

  it("missing creator data applies provisional — not full award", () => {
    const result = computeStructuralScore(
      baseInput({ creatorBehaviourAvailable: false }),
    );
    expect(result.categoryTotals.creator_behaviour).toBe(8);
    expect(result.incompleteCategories).toContain("creator_behaviour");
  });

  it("coordinated cluster with shared funding + deployer-funded signals", () => {
    // Count-only (empty wallet sets) → overlap unknown → stacking still allowed under cap
    const result = computeStructuralScore(
      baseInput({
        relationship: noRel({
          equalBalanceClusterSize: 5,
          sharedFundingCount: 4,
          deployerFundedCount: 3,
          sameBlockEarlyBuyCount: 4,
          deployerInEqualBalanceCluster: true,
        }),
      }),
    );
    expect(result.categoryTotals.wallet_relationship).toBe(15);
  });

  it("same-cluster equal_balance + shared_funding does not double-stack", () => {
    const cluster = [
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "0xcccccccccccccccccccccccccccccccccccccccc",
      "0xdddddddddddddddddddddddddddddddddddddddd",
    ];
    const result = computeStructuralScore(
      baseInput({
        relationship: noRel({
          equalBalanceClusterSize: 4,
          equalBalanceClusterAddresses: cluster,
          sharedFundingCount: 3,
          // 3 of 4 equal-balance wallets share a funder → material overlap
          sharedFundingAddresses: cluster.slice(0, 3),
          sharedFundingFunder: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        }),
      }),
    );
    expect(result.categoryTotals.wallet_relationship).toBe(6);
    expect(result.deductions.some((d) => d.code === "equal_balance_cluster")).toBe(true);
    expect(result.deductions.some((d) => d.code === "shared_funding_pattern")).toBe(false);
    const primary = result.deductions.find((d) => d.code === "equal_balance_cluster");
    expect(primary?.mergedFrom).toContain("shared_funding_pattern");
    expect(primary?.wallets?.length).toBe(4);
  });

  it("independent equal_balance + shared_funding may stack under category cap", () => {
    const result = computeStructuralScore(
      baseInput({
        relationship: noRel({
          equalBalanceClusterSize: 3,
          equalBalanceClusterAddresses: [
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "0xcccccccccccccccccccccccccccccccccccccccc",
          ],
          sharedFundingCount: 2,
          // Disjoint wallets → independent evidence
          sharedFundingAddresses: [
            "0x1111111111111111111111111111111111111111",
            "0x2222222222222222222222222222222222222222",
          ],
          sharedFundingFunder: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        }),
      }),
    );
    expect(result.categoryTotals.wallet_relationship).toBe(11);
    expect(result.deductions.some((d) => d.code === "equal_balance_cluster")).toBe(true);
    expect(result.deductions.some((d) => d.code === "shared_funding_pattern")).toBe(true);
  });

  it("missing critical data applies score ceiling ≤85", () => {
    const result = computeStructuralScore(
      baseInput({
        creatorBehaviourAvailable: false,
        contractRisk: {
          ...cleanContract(),
          status: "incomplete",
          mintable: null,
          honeypot: null,
          buyTaxBps: null,
          sellTaxBps: null,
          transferTaxBps: null,
          modifiableTax: null,
          pausable: null,
          blacklistOrWhitelist: null,
          isProxy: null,
          hasOwnerAdmin: null,
          privilegedBurn: null,
        },
        lpLockState: "UNABLE_TO_DETERMINE",
        // Keep other deductions modest so ceiling is the binding constraint
        relationship: noRel(),
        topHolders: [holder("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "1", 3)],
      }),
    );
    expect(result.score).toBeLessThanOrEqual(85);
    expect(result.scoreCeilingApplied).toBe(85);
  });

  it("hostile missing-data-only token cannot reach 80–90+", () => {
    // Unverified, no ABI, unknown LP, concentrated 59% top10, no creator index
    const result = computeStructuralScore(
      baseInput({
        contractVerified: false,
        contractRisk: {
          status: "incomplete",
          mintable: null,
          honeypot: null,
          buyTaxBps: null,
          sellTaxBps: null,
          transferTaxBps: null,
          modifiableTax: null,
          pausable: null,
          blacklistOrWhitelist: null,
          isProxy: null,
          hasOwnerAdmin: null,
          privilegedBurn: null,
          findings: [],
          goplusSupplement: null,
          detail: "incomplete",
        },
        lpLockState: "UNABLE_TO_DETERMINE",
        creatorBehaviourAvailable: false,
        topHolders: Array.from({ length: 10 }, (_, i) =>
          holder(`0x${(i + 1).toString(16).padStart(40, "0")}`, "1", 5.9),
        ),
        deployerBalance: (1_000_000_000n * 10n ** 18n * 49n) / 1000n,
        relationship: noRel(),
      }),
    );
    expect(result.score).toBeLessThan(80);
  });
});

describe("analyzeContractRisk", () => {
  it("detects mintable from ABI", () => {
    const r = analyzeContractRisk({
      verified: true,
      abi: [{ type: "function", name: "mint", inputs: [], stateMutability: "nonpayable" }],
      sourceCode: "contract T { function mint() public {} }",
    });
    expect(r.status).toBe("analyzed");
    expect(r.mintable).toBe(true);
  });

  it("marks incomplete when unverified", () => {
    const r = analyzeContractRisk({
      verified: false,
      abi: null,
      sourceCode: null,
    });
    expect(r.status).toBe("incomplete");
  });

  it("clean OZ ERC20 fixed supply", () => {
    const r = analyzeContractRisk({
      verified: true,
      abi: [
        { type: "function", name: "transfer", inputs: [], stateMutability: "nonpayable" },
        { type: "function", name: "balanceOf", inputs: [], stateMutability: "view" },
      ],
      sourceCode:
        "// OpenZeppelin ERC20\ncontract HansomeAlpacas is ERC20 {\n  constructor() { _mint(msg.sender, MAX_SUPPLY); }\n}",
    });
    expect(r.mintable).toBe(false);
    expect(r.buyTaxBps).toBe(0);
  });

  it("does not treat NatSpec 'no honeypot/tax' as risk", () => {
    const r = analyzeContractRisk({
      verified: true,
      abi: [
        { type: "function", name: "transfer", inputs: [], stateMutability: "nonpayable" },
        { type: "function", name: "balanceOf", inputs: [], stateMutability: "view" },
      ],
      sourceCode: `/**
 * @dev No mint, blacklist, whitelist, transfer tax, owner controls, or honeypot logic.
 */
// OpenZeppelin
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract T is ERC20 {
  constructor() ERC20("T","T") { _mint(msg.sender, 1); }
}`,
    });
    expect(r.honeypot).toBe(false);
    expect(r.mintable).toBe(false);
    expect(r.buyTaxBps).toBe(0);
  });
});

describe("buildRelationshipSignals", () => {
  it("counts shared funding and deployer-funded", () => {
    const holders = [
      holder("0x1111111111111111111111111111111111111111", "100", 1),
      holder("0x2222222222222222222222222222222222222222", "100", 1),
      holder("0x3333333333333333333333333333333333333333", "50", 1),
    ];
    const deployer = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const sig = buildRelationshipSignals({
      holders,
      deployer,
      fundingEdges: [
        { from: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", to: holders[0]!.address, blockNumber: 1 },
        { from: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", to: holders[1]!.address, blockNumber: 2 },
        { from: deployer, to: holders[0]!.address, blockNumber: 3 },
        { from: deployer, to: holders[2]!.address, blockNumber: 4 },
      ],
      earlyBuys: [
        { buyer: holders[0]!.address, blockNumber: 100 },
        { buyer: holders[1]!.address, blockNumber: 100 },
        { buyer: holders[2]!.address, blockNumber: 100 },
      ],
    });
    expect(sig.sharedFundingCount).toBeGreaterThanOrEqual(2);
    expect(sig.deployerFundedCount).toBeGreaterThanOrEqual(2);
    expect(sig.sameBlockEarlyBuyCount).toBe(3);
    expect(sig.equalBalanceClusterSize).toBe(2);
  });
});

describe("largestEqualBalanceCluster", () => {
  it("counts identical non-excluded balances", () => {
    const holders = [
      holder("0x1", "100", 1),
      holder("0x2", "100", 1),
      holder("0x3", "100", 1),
      holder("0x4", "50", 1),
      holder("0x5", "100", 1, { excludedFromConcentration: true }),
    ];
    expect(largestEqualBalanceCluster(holders)).toBe(3);
  });
});

describe("computeActivity", () => {
  it("returns Low without inventing volume safety", () => {
    const a = computeActivity({
      volume24hUsd: 10,
      transactions24h: 2,
      transfersCount: 5,
      volumeSource: "geckoterminal",
    });
    expect(a.level).toBe("Low");
  });

  it("returns High only with labeled volume+txs thresholds", () => {
    const a = computeActivity({
      volume24hUsd: 60_000,
      transactions24h: 120,
      transfersCount: 1000,
      volumeSource: "geckoterminal",
    });
    expect(a.level).toBe("High");
    expect(a.source).toBe("geckoterminal");
  });
});

describe("HANSOME Level presentation", () => {
  it("maps Low → KINDA HANSOME", () => {
    const level = toHansomeLevel("Low");
    expect(level.id).toBe("kinda_hansome");
    expect(level.label).toBe("KINDA HANSOME");
    expect(level.emoji).toBe("😐");
    expect(level.rawLevel).toBe("Low");
  });

  it("maps the full branded catalog including future raw levels", () => {
    expect(toHansomeLevel("Very Low")).toMatchObject({
      id: "not_hansome",
      label: "NOT HANSOME",
      emoji: "💀",
    });
    expect(toHansomeLevel("Inactive")).toMatchObject({
      id: "not_hansome",
      label: "NOT HANSOME",
    });
    expect(toHansomeLevel("Medium")).toMatchObject({
      id: "hansome",
      label: "HANSOME",
      emoji: "🦙",
    });
    expect(toHansomeLevel("High")).toMatchObject({
      id: "very_hansome",
      label: "VERY HANSOME",
      emoji: "😎",
    });
    expect(toHansomeLevel("Very High")).toMatchObject({
      id: "too_hansome",
      label: "TOO HANSOME",
      emoji: "🔥",
    });
    expect(HANSOME_LEVEL_CATALOG).toHaveLength(5);
  });

  it("does not use branded labels in Structural or Overall scoring", () => {
    const scoreSrc = readFileSync(
      resolve(__dirname, "../score.ts"),
      "utf8",
    );
    const overallSrc = readFileSync(
      resolve(__dirname, "../overall.ts"),
      "utf8",
    );
    const activitySrc = readFileSync(
      resolve(__dirname, "../activity.ts"),
      "utf8",
    );
    const confidenceSrc = readFileSync(
      resolve(__dirname, "../confidence.ts"),
      "utf8",
    );

    for (const src of [scoreSrc, overallSrc, activitySrc, confidenceSrc]) {
      expect(src).not.toMatch(/KINDA HANSOME|TOO HANSOME|toHansomeLevel|hansome-level/);
    }

    const before = computeOverallTokenScore({
      structuralScore: 72,
      liquidityUsd: 25_000,
      poolInventoryPctOfSupply: 8,
      sizeWarning: false,
      holdersCount: 400,
      top10AdjustedPct: 35,
      volume24hUsd: 10,
      transactions24h: 2,
      tokenAgeDays: 40,
      dataConfidencePercent: 70,
    });
    const after = computeOverallTokenScore({
      structuralScore: 72,
      liquidityUsd: 25_000,
      poolInventoryPctOfSupply: 8,
      sizeWarning: false,
      holdersCount: 400,
      top10AdjustedPct: 35,
      volume24hUsd: 10,
      transactions24h: 2,
      tokenAgeDays: 40,
      dataConfidencePercent: 70,
    });
    // Same raw inputs → same Overall; branded Activity labels are never an input.
    expect(after.score).toBe(before.score);
    expect(after.components.activity).toBe(before.components.activity);
    expect(OVERALL_WEIGHTS.activity).toBe(0.17);
    expect(toHansomeLevel("Low").label).toBe("KINDA HANSOME");
  });
});

describe("LP lock state display map", () => {
  it("never aliases unable-to-determine as unlocked", () => {
    expect(LP_LOCK_STATE_DISPLAY.UNABLE_TO_DETERMINE).toBe("UNABLE TO DETERMINE");
    expect(LP_LOCK_STATE_DISPLAY.UNLOCKED_EOA_CONTROLLED).toBe("UNLOCKED / EOA-CONTROLLED");
    expect(LP_LOCK_STATE_DISPLAY.LOCKED_VERIFIED_ONCHAIN).toContain("LOCKED");
  });
});

function baseLpIntelligence(
  overrides: Partial<TokenOverview["lpIntelligence"]> = {},
): TokenOverview["lpIntelligence"] {
  return {
    poolDetected: true,
    poolsDetectedCount: 1,
    poolId: "0xpool",
    poolManagerBalanceRaw: "1",
    poolManagerBalanceFormatted: "1",
    aggregateLockState: "LOCKED_VERIFIED_ONCHAIN",
    aggregateLockStateDisplay: "ALL LOCKED — VERIFIED ON-CHAIN",
    aggregateState: "ALL_LOCKED",
    aggregateStateDisplay: "ALL LOCKED — VERIFIED ON-CHAIN",
    positionCounts: { detected: 1, material: 1, locked: 1, unlocked: 0, unknown: 0 },
    lockDistribution: {
      available: true,
      lockedPct: 100,
      unlockedPct: 0,
      unknownPct: 0,
      lockedUsd: 1000,
      unlockedUsd: 0,
      unknownUsd: 0,
      totalPositionUsd: 1000,
      poolLiquidityUsd: 1000,
      reconciledWithPool: true,
      method: "token_amounts",
      reason: null,
    },
    discoveryComplete: true,
    completenessWarning: null,
    ownershipRiskNote: "ok",
    sizeWarning: false,
    positions: [
      {
        positionNftId: "1",
        owner: "0x26b0654A0756DCd036D4e7215324f3D2Be34D79e",
        ownerLabel: "Titan",
        lockerName: "Titan",
        lockerAddress: "0x26b0654A0756DCd036D4e7215324f3D2Be34D79e",
        lockState: "LOCKED_VERIFIED_ONCHAIN",
        lockStateDisplay: "LOCKED — VERIFIED ON-CHAIN",
        unlockTimestamp: null,
        unlockDateUtc: null,
        lockCreatedAt: null,
        lockTxHash: null,
        liquidity: "1000",
        amount0Raw: null,
        amount1Raw: null,
        poolId: "0xpool",
        currency0: null,
        currency1: null,
        fee: null,
        tickSpacing: null,
        tickLower: null,
        tickUpper: null,
        currentTick: null,
        inRange: null,
        removableByEoa: false,
        evidenceLevel: "on_chain_verified",
        dataSource: "test",
      },
    ],
    evidenceLevel: "on_chain_verified",
    detail: "ok",
    discoverySources: ["titan_locker", "hint_address_nft_inventory"],
    uniswapVersions: testCompleteVersionCoverage(["v4"]),
    ...overrides,
  };
}

function baseOverview(overrides: Partial<TokenOverview> = {}): TokenOverview {
  return {
    address: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
    chainId: 4663,
    name: "Hansome Alpacas",
    symbol: "HANSOME",
    decimals: 18,
    totalSupplyRaw: "1000000000000000000000000000",
    totalSupplyFormatted: "1000000000",
    holdersCount: 92,
    transfersCount: 1000,
    deployer: "0xfEff679d14f7D1a2F343095680430e4c96dE691F",
    creationTxHash: "0xabc",
    contractVerified: true,
    poolManagerBalanceRaw: "1",
    poolManagerBalanceFormatted: "1",
    poolId: "0xpool",
    lpLockStatus: "locked",
    lpLockDetail: "locked",
    lpIntelligence: baseLpIntelligence(),
    contractRisk: cleanContract(),
    supplyBurn: {
      totalSupplyRaw: "1000000000000000000000000000",
      totalSupplyFormatted: "1000000000",
      knownBurnedSupplyRaw: "0",
      knownBurnedSupplyFormatted: "0",
      burnedPctOfTotalSupply: 0,
      effectiveRemainingSupplyRaw: "1000000000000000000000000000",
      effectiveRemainingSupplyFormatted: "1000000000",
      effectiveRemainingMethod: "total_minus_known_dead",
      burnMechanism: "none_detected",
      burnFunction: "no",
      automaticBurn: "no",
      privilegedBurn: "no",
      holderBurnCallable: "no",
      burnFromPresent: "no",
      supplyReductionVerified: "unknown",
      deadAddressBalances: [],
      burnActivity: {
        lastBurnAt: null,
        burnTransactionCount: null,
        windows: [
          {
            window: "24h",
            burnedToDeadRaw: null,
            burnedToDeadFormatted: null,
            completeness: "unknown",
            note: "test",
          },
          {
            window: "7d",
            burnedToDeadRaw: null,
            burnedToDeadFormatted: null,
            completeness: "unknown",
            note: "test",
          },
          {
            window: "30d",
            burnedToDeadRaw: null,
            burnedToDeadFormatted: null,
            completeness: "unknown",
            note: "test",
          },
          {
            window: "all",
            burnedToDeadRaw: null,
            burnedToDeadFormatted: null,
            completeness: "unknown",
            note: "test",
          },
        ],
        headIndexed: false,
        pagesFetched: 0,
        transfersIndexed: 0,
        paginationComplete: false,
        fetchFailed: false,
        source: "none",
      },
      supplyReduction: {
        provenSupplyReductionRaw: null,
        provenSupplyReductionFormatted: null,
        historicalReductionStatus: "unknown",
        provenBurnEventCount: null,
        note: "test",
      },
      findings: [],
      dataCompletenessNotes: [],
    },
    creatorBehaviour: {
      status: "indexed",
      available: true,
      dumpDetected: false,
      transferThenSellDetected: false,
      creatorSellPctOfSupply: 0,
      outboundTransferCount: 0,
      sellTransferCount: 0,
      transferThenSellRecipientCount: 0,
      pagesFetched: 10,
      transfersIndexed: 200,
      paginationComplete: true,
      detail: "indexed",
      evidence: [],
    },
    concentration: {
      top1AdjustedPct: 6,
      top10AdjustedPct: 35,
      top10RawPct: 45,
      exclusions: [],
    },
    relationship: noRel(),
    tokenAgeDays: 30,
    topHolders: Array.from({ length: 20 }, (_, i) =>
      holder(`0x${(i + 1).toString(16).padStart(40, "0")}`, "1", 1),
    ),
    ...overrides,
  };
}

const fullWalletGraph = {
  sampled: false,
  sampleSize: 12,
  fundersResolved: 12,
  earlyBuysCount: 40,
};

describe("Data Confidence / Analysis Coverage (v1.2)", () => {
  it("complete/clean fixture can still score high Data Confidence", () => {
    const c = computeConfidence({
      overview: baseOverview(),
      hasActivityVolume: true,
      walletGraph: fullWalletGraph,
      honeypotSwapSimulated: true,
    });
    expect(c.percent).toBeGreaterThanOrEqual(85);
    expect(c.band).toBe("High");
    expect(c.dimensions).toHaveLength(5);
    for (const d of c.dimensions) {
      expect(d.score).toBeGreaterThanOrEqual(75);
      expect(d.incomplete).toBe(false);
    }
  });

  it("liquidity incomplete alone pulls liquidity well below ~100% and lowers aggregate", () => {
    const complete = computeConfidence({
      overview: baseOverview(),
      hasActivityVolume: true,
      walletGraph: fullWalletGraph,
      honeypotSwapSimulated: true,
    });
    const incompleteLp = computeConfidence({
      overview: baseOverview({
        lpIntelligence: baseLpIntelligence({
          discoveryComplete: false,
          completenessWarning:
            "Liquidity position discovery may be incomplete. One locked Position NFT does not mean all liquidity is locked.",
          aggregateState: "UNKNOWN_INCOMPLETE",
          aggregateStateDisplay: "UNKNOWN / INCOMPLETE",
          aggregateLockState: "UNABLE_TO_DETERMINE",
          aggregateLockStateDisplay: "UNABLE TO DETERMINE",
          positionCounts: {
            detected: 1,
            material: 1,
            locked: 1,
            unlocked: 0,
            unknown: 0,
          },
        }),
        lpLockStatus: "unknown",
      }),
      hasActivityVolume: true,
      walletGraph: fullWalletGraph,
      honeypotSwapSimulated: true,
    });
    const liq = incompleteLp.dimensions.find((d) => d.id === "liquidity")!;
    expect(liq.score).toBeLessThanOrEqual(55);
    expect(liq.score).toBeLessThan(70);
    expect(liq.incomplete).toBe(true);
    expect(incompleteLp.percent).toBeLessThan(complete.percent - 8);
  });

  it("missing creator history + incomplete LP discovery cannot still result in ~90% Data Confidence", () => {
    const c = computeConfidence({
      overview: baseOverview({
        creatorBehaviour: {
          status: "incomplete",
          available: false,
          dumpDetected: false,
          transferThenSellDetected: false,
          creatorSellPctOfSupply: 0,
          outboundTransferCount: 0,
          sellTransferCount: 0,
          transferThenSellRecipientCount: 0,
          pagesFetched: 0,
          transfersIndexed: 0,
          paginationComplete: false,
          detail: "Creator behaviour not indexed",
          evidence: [],
        },
        lpIntelligence: baseLpIntelligence({
          discoveryComplete: false,
          completenessWarning: "Liquidity position discovery may be incomplete.",
          aggregateState: "UNKNOWN_INCOMPLETE",
          aggregateStateDisplay: "UNKNOWN / INCOMPLETE",
          aggregateLockState: "LOCK_DETECTED_EXPIRY_UNKNOWN",
          aggregateLockStateDisplay: "LOCK DETECTED — EXPIRY UNKNOWN",
        }),
        contractRisk: { ...cleanContract(), status: "analyzed" },
      }),
      hasActivityVolume: true,
      walletGraph: {
        sampled: true,
        sampleSize: 12,
        fundersResolved: 8,
        earlyBuysCount: 20,
      },
      honeypotSwapSimulated: false,
    });

    const creator = c.dimensions.find((d) => d.id === "creator")!;
    const liquidity = c.dimensions.find((d) => d.id === "liquidity")!;
    expect(creator.score).toBeLessThanOrEqual(25);
    expect(creator.band).toBe("Low");
    expect(liquidity.score).toBeLessThanOrEqual(55);
    expect(liquidity.incomplete).toBe(true);
    // Old model could still land ~90 with only −10 creator; new model must not
    expect(c.percent).toBeLessThan(75);
    expect(c.percent).toBeLessThan(85);
    expect(c.band).not.toBe("High");
  });

  it("exposes documented weights and dimension breakdown on the result", () => {
    const c = computeConfidence({
      overview: baseOverview(),
      hasActivityVolume: true,
      walletGraph: fullWalletGraph,
      honeypotSwapSimulated: true,
    });
    const sum = Object.values(c.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(c.weights.liquidity).toBe(0.25);
    expect(c.weights.creator).toBe(0.22);
    expect(c.weights.contract).toBe(0.22);
    expect(c.weights.holders).toBe(0.16);
    expect(c.weights.wallet).toBe(0.15);
  });
});
