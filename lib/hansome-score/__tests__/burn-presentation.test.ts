import { describe, expect, it } from "vitest";
import { en } from "@/content/i18n/en";
import { zh } from "@/content/i18n/zh";
import {
  analyzeSupplyBurnFromParts,
  BURN_EXPLAINABILITY_TOOLTIP_KEYS,
  burnTriStateClassName,
  burnTriStateTone,
  combineBurnFunction,
  detectBurnMechanisms,
  formatBurnedPctForDisplay,
  isNonNegativeRemainingSupply,
  isValidKnownBurnedVsBurnFunctionState,
  knownBurnedWithinTotalSupply,
} from "@/lib/hansome-score/supply-burn";

const ZERO = "0x0000000000000000000000000000000000000000";
const DEAD = "0x000000000000000000000000000000000000dEaD";
const SUPPLY = 1_000_000_000n * 10n ** 18n;
const DECIMALS = 18;

function emptyDead(knownRaw = 0n, totalSupply: bigint | null = SUPPLY) {
  const burnedPct =
    totalSupply != null && totalSupply > 0n
      ? (Number(knownRaw) / Number(totalSupply)) * 100
      : null;
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
          ],
    knownBurnedRaw: knownRaw,
    knownBurnedFormatted: (Number(knownRaw) / 1e18).toString(),
    burnedPctOfTotalSupply: burnedPct,
    notes: [] as string[],
  };
}

const NO_BURN_ABI = [
  { type: "function" as const, name: "transfer", inputs: [] },
  { type: "function" as const, name: "balanceOf", inputs: [] },
];

const BURN_ABI = [
  {
    type: "function" as const,
    name: "burn",
    inputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
  },
  { type: "function" as const, name: "transfer", inputs: [] },
];

describe("burn explainability presentation", () => {
  it("1. Known Burned > 0 + Burn Function = No is a valid independent state", () => {
    const burned = 50_000_000n * 10n ** 18n;
    const sb = analyzeSupplyBurnFromParts({
      tokenAddress: "0x0339f5459fc690ac85f1782e15782a151b4a9e1b",
      totalSupply: SUPPLY,
      decimals: DECIMALS,
      verified: true,
      abi: NO_BURN_ABI,
      sourceCode: "contract T is ERC20 { constructor() { _mint(msg.sender, MAX); } }",
      deadInventory: emptyDead(burned),
    });
    expect(BigInt(sb.knownBurnedSupplyRaw!)).toBeGreaterThan(0n);
    expect(sb.burnFunction).toBe("no");
    expect(
      isValidKnownBurnedVsBurnFunctionState({
        knownBurnedRaw: BigInt(sb.knownBurnedSupplyRaw!),
        burnFunction: sb.burnFunction,
      }),
    ).toBe(true);
  });

  it("2. Known Burned = 0 + Burn Function = Yes is valid (capability ≠ inventory)", () => {
    const sb = analyzeSupplyBurnFromParts({
      tokenAddress: "0x0339f5459fc690ac85f1782e15782a151b4a9e1b",
      totalSupply: SUPPLY,
      decimals: DECIMALS,
      verified: true,
      abi: BURN_ABI,
      sourceCode: `
contract T is ERC20 {
  function burn(uint256 amount) public { _burn(msg.sender, amount); }
}`,
      deadInventory: emptyDead(0n),
    });
    expect(sb.knownBurnedSupplyRaw).toBe("0");
    expect(sb.burnFunction).toBe("yes");
    expect(
      isValidKnownBurnedVsBurnFunctionState({
        knownBurnedRaw: 0n,
        burnFunction: "yes",
      }),
    ).toBe(true);
  });

  it("3. Known Burned > 0 + Burn Function = Yes is valid", () => {
    const burned = 10_000_000n * 10n ** 18n;
    const sb = analyzeSupplyBurnFromParts({
      tokenAddress: "0x0339f5459fc690ac85f1782e15782a151b4a9e1b",
      totalSupply: SUPPLY,
      decimals: DECIMALS,
      verified: true,
      abi: BURN_ABI,
      sourceCode: `
contract T is ERC20 {
  function burn(uint256 amount) public { _burn(msg.sender, amount); }
}`,
      deadInventory: emptyDead(burned),
    });
    expect(BigInt(sb.knownBurnedSupplyRaw!)).toBeGreaterThan(0n);
    expect(sb.burnFunction).toBe("yes");
  });

  it("4. Proxy implementation resolved → burn capability Yes/No (not forced Unknown)", () => {
    // Resolved implementation = verified ABI/source available (as scan passes through).
    const m = detectBurnMechanisms({
      verified: true,
      abi: BURN_ABI,
      sourceCode: `
contract Impl is ERC20 {
  function burn(uint256 amount) public { _burn(msg.sender, amount); }
}`,
    });
    const burnFn = combineBurnFunction(
      m.holderBurnCallable,
      m.burnFromPresent,
    );
    expect(burnFn).toBe("yes");
    expect(burnFn).not.toBe("unknown");
    // Automatic may still be Unknown if transfer auto-burn path is unclear — that is OK.
    expect(["yes", "no", "unknown"]).toContain(m.automaticBurn);
  });

  it("5. Proxy implementation unresolved → Unknown (not No)", () => {
    const m = detectBurnMechanisms({
      verified: false,
      abi: null,
      sourceCode: null,
    });
    expect(combineBurnFunction(m.holderBurnCallable, m.burnFromPresent)).toBe(
      "unknown",
    );
    expect(m.automaticBurn).toBe("unknown");
    expect(m.privilegedBurn).toBe("unknown");
    expect(burnTriStateTone("unknown")).toBe("unknown");
    expect(burnTriStateTone("no")).toBe("no");
    expect(burnTriStateClassName("unknown")).not.toBe(
      burnTriStateClassName("no"),
    );
  });

  it("6. Automatic Burn Unknown when bytecode/source incomplete", () => {
    const m = detectBurnMechanisms({
      verified: true,
      abi: null,
      sourceCode: null,
    });
    expect(m.automaticBurn).toBe("unknown");
    expect(burnTriStateClassName("unknown")).toContain("amber");
  });

  it("7. Admin Burn Unknown when bytecode/source incomplete", () => {
    const m = detectBurnMechanisms({
      verified: null,
      abi: [{ type: "function", name: "burn", inputs: [] }],
      sourceCode: null,
    });
    expect(m.privilegedBurn).toBe("unknown");
  });

  it("8. Burn amount equal to total supply → remaining 0, pct displayable", () => {
    const sb = analyzeSupplyBurnFromParts({
      tokenAddress: "0x0339f5459fc690ac85f1782e15782a151b4a9e1b",
      totalSupply: SUPPLY,
      decimals: DECIMALS,
      verified: true,
      abi: NO_BURN_ABI,
      sourceCode: "contract T is ERC20 {}",
      deadInventory: emptyDead(SUPPLY),
    });
    expect(sb.knownBurnedSupplyRaw).toBe(SUPPLY.toString());
    expect(sb.effectiveRemainingSupplyRaw).toBe("0");
    expect(isNonNegativeRemainingSupply(sb.effectiveRemainingSupplyRaw)).toBe(
      true,
    );
    expect(
      knownBurnedWithinTotalSupply({
        knownBurnedRaw: sb.knownBurnedSupplyRaw,
        totalSupplyRaw: sb.totalSupplyRaw,
      }),
    ).toBe(true);
    expect(formatBurnedPctForDisplay(sb.burnedPctOfTotalSupply)).toBe("100.0%");
  });

  it("9. Invalid or missing total supply → no NaN/Infinity pct; remaining unavailable", () => {
    const sb = analyzeSupplyBurnFromParts({
      tokenAddress: "0x0339f5459fc690ac85f1782e15782a151b4a9e1b",
      totalSupply: null,
      decimals: DECIMALS,
      verified: true,
      abi: NO_BURN_ABI,
      sourceCode: "contract T is ERC20 {}",
      deadInventory: emptyDead(1n * 10n ** 18n, null),
    });
    expect(sb.totalSupplyRaw).toBeNull();
    expect(sb.effectiveRemainingMethod).toBe("unavailable");
    expect(formatBurnedPctForDisplay(sb.burnedPctOfTotalSupply)).toBeNull();
    expect(formatBurnedPctForDisplay(Number.NaN)).toBeNull();
    expect(formatBurnedPctForDisplay(Number.POSITIVE_INFINITY)).toBeNull();
    expect(formatBurnedPctForDisplay(-1)).toBeNull();
  });

  it("10. EN/ZH tooltip keys complete and non-empty", () => {
    for (const key of BURN_EXPLAINABILITY_TOOLTIP_KEYS) {
      const enVal = en.scan[key];
      const zhVal = zh.scan[key];
      expect(typeof enVal).toBe("string");
      expect(enVal.trim().length).toBeGreaterThan(20);
      expect(typeof zhVal).toBe("string");
      expect(zhVal.trim().length).toBeGreaterThan(10);
    }
    expect(en.scan.supplyBurnKnownBurnedTooltip).toMatch(/burn function/i);
    expect(zh.scan.supplyBurnFunctionTooltip).toMatch(/燒幣|銷毀/);
  });
});
