import { describe, expect, it } from "vitest";
import { en } from "@/content/i18n/en";
import { zh } from "@/content/i18n/zh";
import { computeConcentration } from "@/lib/hansome-score/score";
import type { LabeledHolder } from "@/lib/hansome-score/types";
import {
  HOLDER_EXPLAINABILITY_TOOLTIP_KEYS,
  describeConcentrationPresentation,
  formatHolderPctForDisplay,
  hasDuplicateHolderAddresses,
  holderCategoryTooltipKey,
  holderCopyHasForbiddenCertainty,
  holderPctWithinHundred,
  holderPresentationCategory,
  holderUnknownToneClassName,
  isHolderCoverageIncomplete,
  normalizeHolderAddress,
} from "@/lib/hansome-score/holders/presentation";

function holder(
  address: string,
  pct: number,
  opts?: Partial<LabeledHolder>,
): LabeledHolder {
  return {
    address,
    balanceRaw: "0",
    balanceFormatted: "0",
    percentOfSupply: pct,
    excludedFromConcentration: false,
    ...opts,
  };
}

describe("holder explainability presentation", () => {
  it("1. Largest Holder = Unknown Wallet", () => {
    expect(holderPresentationCategory(undefined)).toBe("unknown_wallet");
    expect(holderPresentationCategory("")).toBe("unknown_wallet");
    expect(holderPresentationCategory("   ")).toBe("unknown_wallet");
    expect(holderCategoryTooltipKey("unknown_wallet")).toBe(
      "holderUnknownWalletTooltip",
    );
    expect(en.scan.holderUnknownWalletTooltip).toMatch(/could not be reliably classified/i);
    expect(en.scan.holderLargestTooltip).toMatch(/does not by itself identify/i);
  });

  it("2. Largest Holder = LP / Pool", () => {
    expect(
      holderPresentationCategory("Uniswap v4 PoolManager (AMM liquidity)"),
    ).toBe("lp_pool");
    expect(holderCategoryTooltipKey("lp_pool")).toBe("holderLpPoolTooltip");
    expect(en.scan.holderLpPoolTooltip).toMatch(/liquidity pool/i);
  });

  it("3. Largest Holder = Burn Address", () => {
    expect(holderPresentationCategory("Burn address")).toBe("known_burned");
    expect(holderCategoryTooltipKey("known_burned")).toBe(
      "holderKnownBurnedTooltip",
    );
    expect(en.scan.holderKnownBurnedTooltip).toMatch(/burn or dead/i);
  });

  it("4. Largest Holder = Exchange", () => {
    expect(holderPresentationCategory("Binance hot wallet")).toBe("exchange");
    expect(holderCategoryTooltipKey("exchange")).toBe("holderExchangeTooltip");
    expect(en.scan.holderExchangeTooltip).toMatch(/recognized as belonging/i);
  });

  it("5. Largest Holder = Treasury", () => {
    expect(holderPresentationCategory("GameTreasury")).toBe("treasury");
    expect(holderCategoryTooltipKey("treasury")).toBe("holderTreasuryTooltip");
    expect(en.scan.holderTreasuryTooltip).toMatch(/available evidence/i);
  });

  it("6. Top 10 raw concentration", () => {
    const holders = [
      holder("0x1", 40, {
        label: "Burn address",
        excludedFromConcentration: true,
      }),
      holder("0x2", 20),
      holder("0x3", 10),
    ];
    const c = computeConcentration(holders);
    expect(c.top10RawPct).toBe(70);
    const desc = describeConcentrationPresentation({
      top10RawPct: c.top10RawPct,
      top10AdjustedPct: c.top10AdjustedPct,
      totalSupplyAvailable: true,
    });
    expect(desc?.top10RawPct).toBe(70);
    expect(desc?.denominator).toBe("total_supply");
    expect(en.scan.holderIncludedInRawTooltip).toMatch(/without removing/i);
  });

  it("7. Adjusted concentration where already supported", () => {
    const holders = [
      holder("0x1", 40, {
        label: "Uniswap v4 PoolManager (AMM liquidity)",
        excludedFromConcentration: true,
      }),
      holder("0x2", 20),
      holder("0x3", 10),
      holder("0x4", 5),
    ];
    const c = computeConcentration(holders);
    expect(c.top10RawPct).toBe(75);
    expect(c.top10AdjustedPct).toBe(35);
    expect(c.top1AdjustedPct).toBe(20);
    const desc = describeConcentrationPresentation({
      top10RawPct: c.top10RawPct,
      top10AdjustedPct: c.top10AdjustedPct,
      totalSupplyAvailable: true,
    });
    expect(desc?.excludedCategoriesNote).toBe("pool_and_burn");
    expect(c.top10RawPct).not.toBe(c.top10AdjustedPct);
  });

  it("8. Incomplete holder coverage", () => {
    expect(
      isHolderCoverageIncomplete({
        holdersCount: null,
        totalSupplyRaw: "1000",
        topHoldersLength: 0,
      }),
    ).toBe(true);
    expect(
      isHolderCoverageIncomplete({
        holdersCount: 10,
        totalSupplyRaw: null,
        topHoldersLength: 5,
      }),
    ).toBe(true);
    expect(
      isHolderCoverageIncomplete({
        holdersCount: 5,
        totalSupplyRaw: "1000",
        topHoldersLength: 5,
      }),
    ).toBe(false);
    expect(en.scan.holderCoverageIncompleteTooltip).toMatch(/coverage is incomplete/i);
  });

  it("9. Unknown ≠ No (distinct tone)", () => {
    const tone = holderUnknownToneClassName();
    expect(tone).toContain("amber");
    expect(tone).not.toBe("text-foreground");
    expect(en.scan.holderUnknownWalletTooltip.toLowerCase()).not.toMatch(
      /\bmalicious\b.*\bmeans\b/,
    );
    expect(en.scan.holderUnknownWalletTooltip).toMatch(/does not mean unsafe/i);
  });

  it("10. Duplicate normalized addresses", () => {
    const a = "0xAbcDef0000000000000000000000000000000001";
    const b = "0xabcdef0000000000000000000000000000000001";
    expect(normalizeHolderAddress(a)).toBe(normalizeHolderAddress(b));
    expect(hasDuplicateHolderAddresses([a, b, "0x2"])).toBe(true);
    expect(
      hasDuplicateHolderAddresses([
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000002",
      ]),
    ).toBe(false);
  });

  it("11. Missing total supply", () => {
    const desc = describeConcentrationPresentation({
      top10RawPct: 10,
      top10AdjustedPct: 8,
      totalSupplyAvailable: false,
    });
    expect(desc?.denominator).toBe("unavailable");
    expect(
      isHolderCoverageIncomplete({
        holdersCount: 3,
        totalSupplyRaw: "",
        topHoldersLength: 3,
      }),
    ).toBe(true);
  });

  it("12. Percentage sanitization", () => {
    expect(formatHolderPctForDisplay(NaN)).toBeNull();
    expect(formatHolderPctForDisplay(Infinity)).toBeNull();
    expect(formatHolderPctForDisplay(-1)).toBeNull();
    expect(formatHolderPctForDisplay(null)).toBeNull();
    expect(formatHolderPctForDisplay(0, 2)).toBe("0.00%");
    expect(formatHolderPctForDisplay(12.345, 2)).toBe("12.35%");
    expect(holderPctWithinHundred(101)).toBe(false);
    expect(holderPctWithinHundred(101, { unsupportedMechanics: true })).toBe(
      true,
    );
    expect(holderPctWithinHundred(99.9)).toBe(true);
  });

  it("13. EN/ZH tooltip completeness", () => {
    for (const key of HOLDER_EXPLAINABILITY_TOOLTIP_KEYS) {
      const enText = en.scan[key];
      const zhText = zh.scan[key];
      expect(typeof enText).toBe("string");
      expect(typeof zhText).toBe("string");
      expect(enText.trim().length).toBeGreaterThan(20);
      expect(zhText.trim().length).toBeGreaterThan(10);
    }
    expect(zh.scan.holderLargestTooltip).toContain("不代表該地址一定屬於團隊");
    expect(zh.scan.holderUnknownWalletTooltip).toContain("無法可靠分類");
  });

  it("14. No ownership certainty claim", () => {
    for (const key of HOLDER_EXPLAINABILITY_TOOLTIP_KEYS) {
      expect(holderCopyHasForbiddenCertainty(en.scan[key])).toBe(false);
      expect(holderCopyHasForbiddenCertainty(zh.scan[key])).toBe(false);
    }
    expect(en.scan.holderTeamDeployerTooltip).toMatch(/not proof of beneficial ownership/i);
    expect(en.scan.holderTeamDeployerTooltip.toLowerCase()).not.toContain(
      "definitely owned",
    );
  });

  it("15. Raw vs adjusted label distinction", () => {
    expect(en.scan.holderRawTop10Label).not.toBe(en.scan.holderAdjustedTop10Label);
    expect(zh.scan.holderRawTop10Label).not.toBe(zh.scan.holderAdjustedTop10Label);
    expect(en.scan.holderIncludedInRawTooltip).toMatch(/Raw Top-10/i);
    expect(en.scan.adjustedNote.toLowerCase()).toMatch(/raw/);
    expect(en.scan.adjustedNote.toLowerCase()).toMatch(/adjusted/);
    expect(en.scan.holderDenominatorTotalSupply).toMatch(/total supply/i);
  });

  it("16. Team/Deployer / Locker / Bridge / Protocol categories map", () => {
    expect(holderPresentationCategory("Founder Wallet (official)")).toBe(
      "team_deployer",
    );
    expect(holderPresentationCategory("TitanLockerManagerV2")).toBe("locker");
    expect(holderPresentationCategory("Cross-chain Bridge")).toBe("bridge");
    expect(holderPresentationCategory("Protocol Contract")).toBe(
      "protocol_contract",
    );
  });
});
