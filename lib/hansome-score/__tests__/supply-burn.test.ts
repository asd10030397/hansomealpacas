import { describe, expect, it } from "vitest";
import { computeOverallTokenScore } from "@/lib/hansome-score/overall";
import { analyzeContractRisk } from "@/lib/hansome-score/contract-risk";
import { computeStructuralScore } from "@/lib/hansome-score/score";
import {
  aggregateKnownBurned,
  analyzeSupplyBurnFromParts,
  combineBurnFunction,
  computeBurnActivityHistory,
  computeSupplyReductionHistory,
  detectBurnMechanisms,
  enrichSupplyBurnWithHistory,
  extractBurnEventsFromTransfers,
  isProvenSupplyReducingTransfer,
  windowCompleteness,
} from "@/lib/hansome-score/supply-burn";
import type { ContractRiskResult } from "@/lib/hansome-score/types";
import type { BlockscoutTokenTransferRow } from "@/lib/hansome-score/blockscout";

const ZERO = "0x0000000000000000000000000000000000000000";
const DEAD = "0x000000000000000000000000000000000000dEaD";
const SUPPLY = 1_000_000_000n * 10n ** 18n;
const DECIMALS = 18;

function emptyDead(knownRaw = 0n) {
  const burnedPct =
    SUPPLY > 0n ? (Number(knownRaw) / Number(SUPPLY)) * 100 : null;
  return {
    balances:
      knownRaw > 0n
        ? [
            {
              address: DEAD,
              label: "burn_dead" as const,
              balanceRaw: knownRaw.toString(),
              balanceFormatted: (Number(knownRaw) / 1e18).toString(),
              percentOfTotalSupply: burnedPct,
            },
          ]
        : [
            {
              address: ZERO,
              label: "burn_dead" as const,
              balanceRaw: "0",
              balanceFormatted: "0",
              percentOfTotalSupply: 0,
            },
            {
              address: DEAD,
              label: "burn_dead" as const,
              balanceRaw: "0",
              balanceFormatted: "0",
              percentOfTotalSupply: 0,
            },
          ],
    knownBurnedRaw: knownRaw,
    knownBurnedFormatted: (Number(knownRaw) / 1e18).toString(),
    burnedPctOfTotalSupply: burnedPct ?? 0,
    notes: [] as string[],
  };
}

function cleanContract(overrides: Partial<ContractRiskResult> = {}): ContractRiskResult {
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
    ...overrides,
  };
}

function baseScoreInput(cr: ContractRiskResult) {
  return {
    totalSupply: SUPPLY,
    topHolders: [],
    deployer: "0x3333333333333333333333333333333333333333",
    deployerBalance: 0n,
    contractVerified: true,
    lpLockState: "LOCKED_VERIFIED_ONCHAIN" as const,
    poolManagerBalance: 100n,
    contractRisk: cr,
    relationship: {
      equalBalanceClusterSize: 0,
      equalBalanceClusterAddresses: [],
      deployerInEqualBalanceCluster: false,
      sharedFundingCount: 0,
      sharedFundingAddresses: [],
      sharedFundingFunder: null,
      deployerFundedCount: 0,
      deployerFundedAddresses: [],
      sameBlockEarlyBuyCount: 0,
      sameBlockEarlyBuyAddresses: [],
    },
    creatorBehaviourAvailable: true,
    creatorDumpDetected: false,
    creatorTransferThenSellDetected: false,
  };
}

describe("combineBurnFunction", () => {
  it("Yes if either burn() or burnFrom()", () => {
    expect(combineBurnFunction("yes", "no")).toBe("yes");
    expect(combineBurnFunction("no", "yes")).toBe("yes");
  });
  it("Unknown never collapses to No", () => {
    expect(combineBurnFunction("unknown", "no")).toBe("unknown");
    expect(combineBurnFunction("no", "unknown")).toBe("unknown");
  });
  it("No only when both No", () => {
    expect(combineBurnFunction("no", "no")).toBe("no");
  });
});

describe("aggregateKnownBurned — allowlist only, no double-count", () => {
  it("sums only allowlisted dead addresses", () => {
    const r = aggregateKnownBurned(
      [
        { address: DEAD, balanceRaw: (100n * 10n ** 18n).toString() },
        { address: ZERO, balanceRaw: (20n * 10n ** 18n).toString() },
        // ordinary / treasury / locker — MUST NOT count
        {
          address: "0x1111111111111111111111111111111111111111",
          balanceRaw: (500n * 10n ** 18n).toString(),
        },
      ],
      SUPPLY,
      DECIMALS,
    );
    expect(r.knownBurnedRaw).toBe(120n * 10n ** 18n);
    // 120 / 1_000_000_000 * 100 ≈ 0.000012%
    expect(r.burnedPctOfTotalSupply).toBeCloseTo((120 / 1_000_000_000) * 100, 8);
  });

  it("does not treat inaccessible wallets as burned", () => {
    const r = aggregateKnownBurned(
      [
        {
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          balanceRaw: (999n * 10n ** 18n).toString(),
        },
      ],
      SUPPLY,
      DECIMALS,
    );
    expect(r.knownBurnedRaw).toBe(0n);
  });
});

describe("archetype: no burn", () => {
  it("clean ERC20 → Burn Function/Automatic/Admin = No; known burned 0", () => {
    const sb = analyzeSupplyBurnFromParts({
      tokenAddress: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
      totalSupply: SUPPLY,
      decimals: DECIMALS,
      verified: true,
      abi: [
        { type: "function", name: "transfer", inputs: [] },
        { type: "function", name: "balanceOf", inputs: [] },
      ],
      sourceCode: `// OpenZeppelin
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract T is ERC20 {
  constructor() ERC20("T","T") { _mint(msg.sender, 1); }
}`,
      deadInventory: emptyDead(0n),
    });
    expect(sb.burnedPctOfTotalSupply).toBe(0);
    expect(sb.burnFunction).toBe("no");
    expect(sb.automaticBurn).toBe("no");
    expect(sb.privilegedBurn).toBe("no");
    expect(sb.supplyReductionVerified).toBe("unknown");
  });
});

describe("archetype: dead-address burn only", () => {
  it("Known Burned > 0 but Burn Function No", () => {
    const burned = 120_000_000n * 10n ** 18n;
    const sb = analyzeSupplyBurnFromParts({
      tokenAddress: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
      totalSupply: SUPPLY,
      decimals: DECIMALS,
      verified: true,
      abi: [
        { type: "function", name: "transfer", inputs: [] },
        { type: "function", name: "balanceOf", inputs: [] },
      ],
      sourceCode: `// OpenZeppelin
contract T is ERC20 {
  constructor() { _mint(msg.sender, MAX); }
}`,
      deadInventory: emptyDead(burned),
    });
    expect(sb.burnedPctOfTotalSupply).toBeCloseTo(12, 5);
    expect(sb.burnFunction).toBe("no");
    expect(sb.effectiveRemainingMethod).toBe("total_minus_known_dead");
    expect(sb.effectiveRemainingSupplyFormatted).toBe("880000000");
    expect(sb.supplyReductionVerified).toBe("unknown");
    expect(sb.burnMechanism).toBe("dead_address_only");
  });
});

describe("archetype: holder burn()", () => {
  it("detects public burn(uint256)", () => {
    const m = detectBurnMechanisms({
      verified: true,
      abi: [
        {
          type: "function",
          name: "burn",
          inputs: [{ type: "uint256" }],
          stateMutability: "nonpayable",
        },
      ],
      sourceCode: `
contract T is ERC20 {
  function burn(uint256 amount) public {
    _burn(msg.sender, amount);
  }
}`,
    });
    expect(m.holderBurnCallable).toBe("yes");
    expect(m.privilegedBurn).toBe("no");
    expect(combineBurnFunction(m.holderBurnCallable, m.burnFromPresent)).toBe(
      "yes",
    );
  });
});

describe("archetype: burnFrom()", () => {
  it("detects burnFrom and ERC20Burnable", () => {
    const m = detectBurnMechanisms({
      verified: true,
      abi: [
        {
          type: "function",
          name: "burnFrom",
          inputs: [{ type: "address" }, { type: "uint256" }],
        },
        {
          type: "function",
          name: "burn",
          inputs: [{ type: "uint256" }],
        },
      ],
      sourceCode: `
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
contract T is ERC20, ERC20Burnable {
  function burn(uint256 amount) public override {
    super.burn(amount);
  }
  function burnFrom(address account, uint256 amount) public override {
    super.burnFrom(account, amount);
  }
}`,
    });
    expect(m.burnFromPresent).toBe("yes");
    expect(m.holderBurnCallable).toBe("yes");
    expect(m.privilegedBurn).toBe("no");
  });
});

describe("archetype: automatic burn/tax", () => {
  it("detects fee path that _burn on transfer", () => {
    const m = detectBurnMechanisms({
      verified: true,
      abi: [{ type: "function", name: "transfer", inputs: [] }],
      sourceCode: `
contract TaxToken is ERC20 {
  uint256 public burnFee = 2;
  function _update(address from, address to, uint256 value) internal override {
    uint256 fee = (value * burnFee) / 100;
    if (fee > 0) {
      _burn(from, fee);
    }
    super._update(from, to, value - fee);
  }
}`,
    });
    expect(m.automaticBurn).toBe("yes");
  });
});

describe("archetype: privileged/admin burn", () => {
  it("detects onlyOwner burn(address,uint256)", () => {
    const m = detectBurnMechanisms({
      verified: true,
      abi: [
        {
          type: "function",
          name: "burn",
          inputs: [{ type: "address" }, { type: "uint256" }],
        },
        { type: "function", name: "owner", inputs: [] },
      ],
      sourceCode: `
contract T is ERC20, Ownable {
  function burn(address account, uint256 amount) public onlyOwner {
    _burn(account, amount);
  }
}`,
    });
    expect(m.privilegedBurn).toBe("yes");
    expect(m.holderBurnCallable).toBe("no");
  });

  it("maps to Contract Risk deduction; voluntary burn does not boost score", () => {
    const withAdmin = computeStructuralScore(
      baseScoreInput(cleanContract({ privilegedBurn: true, hasOwnerAdmin: true })),
    );
    const clean = computeStructuralScore(baseScoreInput(cleanContract()));
    expect(withAdmin.deductions.some((d) => d.code === "privileged_burn")).toBe(
      true,
    );
    expect(withAdmin.categoryTotals.contract_risk).toBeGreaterThan(
      clean.categoryTotals.contract_risk,
    );
    expect(withAdmin.score).toBeLessThan(clean.score);

    // Dead-address inventory / holder burn capability is display-only — same structural score
    const overallClean = computeOverallTokenScore({
      structuralScore: clean.score,
      liquidityUsd: 100_000,
      poolInventoryPctOfSupply: 5,
      sizeWarning: false,
      holdersCount: 200,
      top10AdjustedPct: 30,
      volume24hUsd: 50_000,
      transactions24h: 400,
      tokenAgeDays: 40,
      dataConfidencePercent: 80,
    });
    const overallAfterBurnDisplay = computeOverallTokenScore({
      structuralScore: clean.score, // voluntary burn must not change structural
      liquidityUsd: 100_000,
      poolInventoryPctOfSupply: 5,
      sizeWarning: false,
      holdersCount: 200,
      top10AdjustedPct: 30,
      volume24hUsd: 50_000,
      transactions24h: 400,
      tokenAgeDays: 40,
      dataConfidencePercent: 80,
    });
    expect(overallAfterBurnDisplay.score).toBe(overallClean.score);
  });
});

describe("archetype: unverified / incomplete", () => {
  it("never silently turns Unknown into No", () => {
    const m = detectBurnMechanisms({
      verified: false,
      abi: null,
      sourceCode: null,
    });
    expect(m.holderBurnCallable).toBe("unknown");
    expect(m.burnFromPresent).toBe("unknown");
    expect(m.automaticBurn).toBe("unknown");
    expect(m.privilegedBurn).toBe("unknown");
    expect(combineBurnFunction(m.holderBurnCallable, m.burnFromPresent)).toBe(
      "unknown",
    );

    const cr = analyzeContractRisk({
      verified: false,
      abi: null,
      sourceCode: null,
      privilegedBurn: "unknown",
    });
    expect(cr.privilegedBurn).toBeNull();
    expect(cr.status).toBe("incomplete");
  });
});

describe("GoPlus not sole privileged-burn evidence", () => {
  it("GoPlus owner_change_balance alone does not set privilegedBurn=yes", () => {
    const cr = analyzeContractRisk({
      verified: true,
      abi: [
        { type: "function", name: "transfer", inputs: [] },
        { type: "function", name: "balanceOf", inputs: [] },
        { type: "function", name: "owner", inputs: [] },
      ],
      sourceCode: `// OpenZeppelin ERC20 Ownable — no burn
contract T is ERC20, Ownable {
  constructor() ERC20("T","T") { _mint(msg.sender, 1); }
}`,
      goplus: { owner_change_balance: "1" },
      privilegedBurn: "no",
    });
    expect(cr.privilegedBurn).toBe(false);
    expect(cr.findings.some((f) => f.code === "goplus_owner_change_balance")).toBe(
      true,
    );
    expect(cr.findings.some((f) => f.code === "privileged_burn")).toBe(false);
  });
});

const HOLDER = "0x1111111111111111111111111111111111111111";
const TREASURY = "0x2222222222222222222222222222222222222222";
const ONE = (10n ** 18n).toString();

function transfer(
  partial: Partial<BlockscoutTokenTransferRow> &
    Pick<BlockscoutTokenTransferRow, "from" | "to" | "timestamp">,
): BlockscoutTokenTransferRow {
  return {
    valueRaw: ONE,
    blockNumber: 1,
    txHash: partial.txHash ?? `0x${partial.timestamp}`,
    toIsContract: false,
    method: partial.method ?? "transfer",
    ...partial,
  };
}

describe("P2: burn activity windows", () => {
  const nowMs = Date.parse("2026-07-28T00:00:00.000Z");

  it("window complete when oldest indexed row is at/before window start", () => {
    expect(
      windowCompleteness({
        windowStartMs: nowMs - 24 * 60 * 60 * 1000,
        oldestIndexedMs: nowMs - 48 * 60 * 60 * 1000,
        newestIndexedMs: nowMs,
        paginationComplete: false,
        fetchFailed: false,
        pagesFetched: 2,
        nowMs,
      }),
    ).toBe("complete");
  });

  it("all-time incomplete when pagination not exhausted — never silent partial-as-full", () => {
    const burns = extractBurnEventsFromTransfers([
      transfer({
        from: HOLDER,
        to: DEAD,
        timestamp: new Date(nowMs - 3600_000).toISOString(),
        valueRaw: (5n * 10n ** 18n).toString(),
        method: "transfer",
      }),
    ]).burns;
    const activity = computeBurnActivityHistory({
      burns,
      pagesFetched: 40,
      paginationComplete: false,
      fetchFailed: false,
      transfersIndexed: 2000,
      oldestIndexedMs: nowMs - 2 * 3600_000,
      newestIndexedMs: nowMs,
      decimals: DECIMALS,
      nowMs,
    });
    const all = activity.windows.find((w) => w.window === "all")!;
    expect(all.completeness).toBe("incomplete");
    expect(all.burnedToDeadRaw).toBeNull();
    expect(activity.burnTransactionCount).toBeNull();
  });

  it("counts only allowlisted dead inflows; ignores treasury/locker", () => {
    const rows = [
      transfer({
        from: HOLDER,
        to: DEAD,
        timestamp: new Date(nowMs - 3600_000).toISOString(),
        valueRaw: (10n * 10n ** 18n).toString(),
        txHash: "0xdead1",
      }),
      transfer({
        from: HOLDER,
        to: TREASURY,
        timestamp: new Date(nowMs - 1800_000).toISOString(),
        valueRaw: (999n * 10n ** 18n).toString(),
        txHash: "0xtreas",
      }),
    ];
    const { burns, oldestIndexedMs, newestIndexedMs } =
      extractBurnEventsFromTransfers(rows);
    expect(burns).toHaveLength(1);
    const activity = computeBurnActivityHistory({
      burns,
      pagesFetched: 1,
      paginationComplete: true,
      fetchFailed: false,
      transfersIndexed: rows.length,
      oldestIndexedMs,
      newestIndexedMs,
      decimals: DECIMALS,
      nowMs,
    });
    const all = activity.windows.find((w) => w.window === "all")!;
    expect(all.completeness).toBe("complete");
    expect(all.burnedToDeadRaw).toBe((10n * 10n ** 18n).toString());
    expect(activity.burnTransactionCount).toBe(1);
    expect(activity.lastBurnAt).toBeTruthy();
  });

  it("enrich attaches P2 without boosting score inputs", async () => {
    const base = analyzeSupplyBurnFromParts({
      tokenAddress: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
      totalSupply: SUPPLY,
      decimals: DECIMALS,
      verified: true,
      abi: [{ type: "function", name: "transfer", inputs: [] }],
      sourceCode: "contract T is ERC20 {}",
      deadInventory: emptyDead(100n * 10n ** 18n),
    });
    const enriched = await enrichSupplyBurnWithHistory({
      supplyBurn: base,
      tokenAddress: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
      transfers: [
        transfer({
          from: HOLDER,
          to: DEAD,
          // Relative to real clock — enrich uses Date.now() for window bounds
          timestamp: new Date(Date.now() - 3600_000).toISOString(),
          valueRaw: (3n * 10n ** 18n).toString(),
        }),
      ],
      pagesFetched: 1,
      paginationComplete: true,
      fetchFailed: false,
      decimals: DECIMALS,
      persist: false,
    });
    const all = enriched.burnActivity.windows.find((w) => w.window === "all")!;
    expect(all.burnedToDeadRaw).toBe((3n * 10n ** 18n).toString());
    expect(enriched.supplyReduction.historicalReductionStatus).toBe("unknown");
    expect(enriched.supplyReductionVerified).toBe("unknown");
    // P0 inventory unchanged by P2
    expect(enriched.knownBurnedSupplyRaw).toBe(base.knownBurnedSupplyRaw);
  });
});

describe("P3: supply reduction vs dead inventory", () => {
  it("does not infer supply reduction from dead-address balance alone", () => {
    const burns = extractBurnEventsFromTransfers([
      transfer({
        from: HOLDER,
        to: DEAD,
        timestamp: "2026-07-27T00:00:00.000Z",
        valueRaw: (50n * 10n ** 18n).toString(),
        method: "transfer",
      }),
    ]).burns;
    const red = computeSupplyReductionHistory({
      burns,
      paginationComplete: true,
      fetchFailed: false,
      pagesFetched: 1,
      hasSupplyReducingAbiPath: false,
      decimals: DECIMALS,
    });
    expect(red.historicalReductionStatus).toBe("unknown");
    expect(red.provenSupplyReductionRaw).toBeNull();
  });

  it("classifies burn-method Transfer to zero as proven supply reduction", () => {
    expect(
      isProvenSupplyReducingTransfer({
        from: HOLDER,
        to: ZERO,
        method: "burn",
      }),
    ).toBe(true);
    expect(
      isProvenSupplyReducingTransfer({
        from: HOLDER,
        to: DEAD,
        method: "burn",
      }),
    ).toBe(false);

    const burns = extractBurnEventsFromTransfers([
      transfer({
        from: HOLDER,
        to: ZERO,
        timestamp: "2026-07-27T12:00:00.000Z",
        valueRaw: (25n * 10n ** 18n).toString(),
        method: "burn",
        txHash: "0xburn1",
      }),
    ]).burns;
    expect(burns[0]?.supplyReducing).toBe(true);
    const verified = computeSupplyReductionHistory({
      burns,
      paginationComplete: true,
      fetchFailed: false,
      pagesFetched: 1,
      hasSupplyReducingAbiPath: true,
      decimals: DECIMALS,
    });
    expect(verified.historicalReductionStatus).toBe("verified");
    expect(verified.provenSupplyReductionRaw).toBe((25n * 10n ** 18n).toString());

    const partial = computeSupplyReductionHistory({
      burns,
      paginationComplete: false,
      fetchFailed: false,
      pagesFetched: 10,
      hasSupplyReducingAbiPath: true,
      decimals: DECIMALS,
    });
    expect(partial.historicalReductionStatus).toBe("partial");
  });

  it("P2/P3 remain informational — structural score unchanged by burn windows", () => {
    const clean = computeStructuralScore(baseScoreInput(cleanContract()));
    // Same structural inputs with or without burn history in overview — score path ignores burnActivity
    const again = computeStructuralScore(baseScoreInput(cleanContract()));
    expect(again.score).toBe(clean.score);
  });
});
