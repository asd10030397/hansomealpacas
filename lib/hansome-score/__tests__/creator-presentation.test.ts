import { describe, expect, it } from "vitest";
import { en } from "@/content/i18n/en";
import { zh } from "@/content/i18n/zh";
import { analyzeCreatorBehaviour } from "@/lib/hansome-score/creator";
import {
  CREATOR_EXPLAINABILITY_TOOLTIP_KEYS,
  creatorActivityMetricAvailability,
  creatorBalanceFromHolders,
  creatorBurnedPctFromEvidence,
  creatorCopyHasForbiddenCertainty,
  creatorIdentityState,
  creatorUnknownToneClassName,
  describeCreatorBalanceDisplay,
  describeCreatorBurnedDisplay,
  describeCreatorReceivedDisplay,
  describeCreatorSoldCountDisplay,
  describeCreatorSoldPctDisplay,
  describeProxyPresentation,
  formatCreatorPctForDisplay,
  isCreatorCoverageIncomplete,
  isValidCreatorBurnedVsBurnFunctionState,
  normalizeCreatorAddress,
} from "@/lib/hansome-score/creator/presentation";
import type {
  CreatorBehaviourResult,
  CreatorTransferEvidence,
  LabeledHolder,
} from "@/lib/hansome-score/types";

const DEPLOYER = "0x1111111111111111111111111111111111111111";
const DEAD = "0x000000000000000000000000000000000000dEaD";
const SUPPLY = 1_000_000_000n * 10n ** 18n;

function cb(
  partial: Partial<CreatorBehaviourResult>,
): CreatorBehaviourResult {
  return {
    status: "indexed",
    available: true,
    dumpDetected: false,
    transferThenSellDetected: false,
    creatorSellPctOfSupply: 0,
    outboundTransferCount: 0,
    sellTransferCount: 0,
    transferThenSellRecipientCount: 0,
    pagesFetched: 1,
    transfersIndexed: 10,
    paginationComplete: true,
    detail: "",
    evidence: [],
    ...partial,
  };
}

function holder(
  address: string,
  pct: number,
  balanceFormatted = "1000",
): LabeledHolder {
  return {
    address,
    balanceRaw: "1000",
    balanceFormatted,
    percentOfSupply: pct,
    excludedFromConcentration: false,
  };
}

describe("creator explainability presentation", () => {
  it("1. creator known", () => {
    expect(creatorIdentityState(DEPLOYER)).toBe("known");
    expect(normalizeCreatorAddress(DEPLOYER)).toBe(DEPLOYER.toLowerCase());
    expect(en.scan.creatorDeployerTooltip).toMatch(
      /does not necessarily identify the current owner/i,
    );
  });

  it("2. creator unknown", () => {
    expect(creatorIdentityState(null)).toBe("unknown");
    expect(creatorIdentityState("")).toBe("unknown");
    expect(creatorUnknownToneClassName()).toBe("text-amber-900");
    expect(en.scan.creatorUnknownTooltip).toMatch(/does not mean No creator/i);
    expect(zh.scan.creatorUnknownTooltip).toMatch(/不代表沒有建立者|不代表没有建立者/);
  });

  it("3. creator unavailable", () => {
    const unavailable = cb({
      status: "unavailable",
      available: false,
      transfersIndexed: 0,
      pagesFetched: 0,
      sellTransferCount: 0,
      creatorSellPctOfSupply: 0,
    });
    expect(creatorActivityMetricAvailability(unavailable)).toBe("unavailable");
    expect(describeCreatorSoldCountDisplay(unavailable).kind).toBe(
      "unavailable",
    );
    expect(describeCreatorSoldPctDisplay(unavailable).kind).toBe(
      "unavailable",
    );
    expect(en.scan.creatorAvailableTooltip).toMatch(
      /only when sufficient deployment identity/i,
    );
  });

  it("4. creator incomplete", () => {
    const incomplete = cb({
      status: "incomplete",
      available: false,
      paginationComplete: false,
      transfersIndexed: 5,
      pagesFetched: 1,
      sellTransferCount: 2,
      creatorSellPctOfSupply: 1.25,
    });
    expect(creatorActivityMetricAvailability(incomplete)).toBe("incomplete");
    expect(isCreatorCoverageIncomplete(incomplete)).toBe(true);
    const sold = describeCreatorSoldPctDisplay(incomplete);
    expect(sold.kind).toBe("incomplete");
    if (sold.kind === "incomplete") expect(sold.text).toBe("1.25%");
    expect(en.scan.creatorIncompleteTooltip).toMatch(
      /may change while historical indexing is incomplete/i,
    );
  });

  it("5. creator balance = 0", () => {
    const bal = creatorBalanceFromHolders(DEPLOYER, [
      holder(DEPLOYER, 0, "0"),
    ]);
    expect(bal.balanceFormatted).toBe("0");
    expect(bal.percentOfSupply).toBe(0);
    const display = describeCreatorBalanceDisplay({
      deployer: DEPLOYER,
      topHolders: [holder(DEPLOYER, 0, "0")],
    });
    expect(display).toEqual({ kind: "value", text: "0" });
    expect(formatCreatorPctForDisplay(0)).toBe("0.00%");
  });

  it("6. creator sold > 0", () => {
    const sold = cb({
      sellTransferCount: 3,
      creatorSellPctOfSupply: 6.5,
      dumpDetected: true,
    });
    const pct = describeCreatorSoldPctDisplay(sold);
    expect(pct).toEqual({ kind: "value", text: "6.50%" });
    expect(describeCreatorSoldCountDisplay(sold)).toEqual({
      kind: "value",
      text: "3",
    });
    expect(en.scan.creatorSoldTooltip).toMatch(/not a judgment of intent/i);
  });

  it("7. creator burned > 0", () => {
    const evidence: CreatorTransferEvidence[] = [
      {
        kind: "transfer",
        from: DEPLOYER,
        to: DEAD,
        valueRaw: "1",
        pctOfSupply: 2.5,
        txHash: "0xabc",
        blockNumber: 1,
        timestamp: null,
      },
    ];
    expect(creatorBurnedPctFromEvidence(evidence)).toBe(2.5);
    const display = describeCreatorBurnedDisplay(
      cb({ evidence, transfersIndexed: 1 }),
    );
    expect(display).toEqual({ kind: "value", text: "2.50%" });
    expect(en.scan.creatorBurnedTooltip).toMatch(
      /separate from whether the token contract has a burn function/i,
    );
  });

  it("8. creator received > 0", () => {
    // Analyzer has no inbound received total — UI stays Unavailable (no invented number).
    expect(describeCreatorReceivedDisplay().kind).toBe("unavailable");
    expect(en.scan.creatorReceivedTooltip).toMatch(
      /does not prove their purpose/i,
    );
    // Formatter still supports positive received values for display gates.
    expect(formatCreatorPctForDisplay(3.2)).toBe("3.20%");
  });

  it("9. burn function No + creator burned > 0", () => {
    expect(
      isValidCreatorBurnedVsBurnFunctionState({
        creatorBurnedPct: 2.5,
        burnFunction: "no",
      }),
    ).toBe(true);
    expect(en.scan.creatorBurnedTooltip.toLowerCase()).not.toMatch(
      /burn function = yes|implies burn function/,
    );
  });

  it("10. deployer ≠ current owner", () => {
    expect(en.scan.creatorDeployerTooltip).toMatch(
      /does not necessarily identify the current owner/i,
    );
    expect(en.scan.creatorCurrentOwnerTooltip).toMatch(
      /may differ from the original contract deployer/i,
    );
    expect(zh.scan.creatorCurrentOwnerTooltip).toMatch(
      /可能與原始部署者不同|可能与原始部署者不同/,
    );
  });

  it("11. proxy deployer ≠ implementation deployer", () => {
    expect(describeProxyPresentation(true)).toBe("yes");
    expect(describeProxyPresentation(false)).toBe("no");
    expect(describeProxyPresentation(null)).toBe("unknown");
    expect(en.scan.creatorProxyTooltip).toMatch(
      /should not be assumed to be the same entity/i,
    );
    expect(zh.scan.creatorProxyTooltip).toMatch(
      /不應被假設為同一實體|不应被假设为同一实体/,
    );
  });

  it("12. missing total supply", () => {
    const result = analyzeCreatorBehaviour({
      deployer: DEPLOYER,
      totalSupply: null,
      transfers: [],
      paginationComplete: true,
      pagesFetched: 0,
    });
    expect(result.available).toBe(false);
    expect(result.status).toBe("incomplete");
    expect(creatorActivityMetricAvailability(result)).toBe("unavailable");
    expect(describeCreatorSoldPctDisplay(result).kind).toBe("unavailable");
  });

  it("13. percentage sanitization", () => {
    expect(formatCreatorPctForDisplay(Number.NaN)).toBeNull();
    expect(formatCreatorPctForDisplay(Number.POSITIVE_INFINITY)).toBeNull();
    expect(formatCreatorPctForDisplay(-1)).toBeNull();
    expect(formatCreatorPctForDisplay(null)).toBeNull();
    expect(formatCreatorPctForDisplay(12.345, 1)).toBe("12.3%");
  });

  it("14. Unknown ≠ No", () => {
    expect(creatorUnknownToneClassName()).toBe("text-amber-900");
    expect(describeProxyPresentation(null)).toBe("unknown");
    expect(describeProxyPresentation(false)).toBe("no");
    expect(describeProxyPresentation(null)).not.toBe(
      describeProxyPresentation(false),
    );
    expect(creatorIdentityState(null)).toBe("unknown");
    expect(en.scan.creatorUnknownTooltip).toMatch(/does not mean No creator/i);
  });

  it("15. unavailable ≠ zero", () => {
    const stub = cb({
      status: "incomplete",
      available: false,
      transfersIndexed: 0,
      pagesFetched: 0,
      sellTransferCount: 0,
      creatorSellPctOfSupply: 0,
    });
    expect(creatorActivityMetricAvailability(stub)).toBe("unavailable");
    expect(describeCreatorSoldCountDisplay(stub).kind).toBe("unavailable");
    expect(describeCreatorSoldCountDisplay(stub)).not.toEqual({
      kind: "value",
      text: "0",
    });
    expect(describeCreatorReceivedDisplay().kind).toBe("unavailable");
  });

  it("16. EN/ZH tooltip completeness", () => {
    for (const key of CREATOR_EXPLAINABILITY_TOOLTIP_KEYS) {
      const enText = en.scan[key];
      const zhText = zh.scan[key];
      expect(typeof enText).toBe("string");
      expect(typeof zhText).toBe("string");
      expect(enText.trim().length).toBeGreaterThan(20);
      expect(zhText.trim().length).toBeGreaterThan(10);
    }
  });

  it("17. no beneficial-ownership certainty claim", () => {
    for (const key of CREATOR_EXPLAINABILITY_TOOLTIP_KEYS) {
      expect(creatorCopyHasForbiddenCertainty(en.scan[key])).toBe(false);
      expect(creatorCopyHasForbiddenCertainty(zh.scan[key])).toBe(false);
    }
    expect(
      creatorCopyHasForbiddenCertainty("definitely owned by team wallet"),
    ).toBe(true);
    expect(creatorCopyHasForbiddenCertainty("this is a no creator token")).toBe(
      true,
    );
    expect(
      creatorCopyHasForbiddenCertainty(
        "Unknown does not mean No creator or unsafe.",
      ),
    ).toBe(false);
  });

  it("18. score unchanged (analyzer output preserved)", () => {
    const transfers = [
      {
        from: DEPLOYER,
        to: "0xA687b664662B96b180346D699a6d5b42e9B05d31",
        valueRaw: (SUPPLY / 10n).toString(),
        blockNumber: 1,
        timestamp: null,
        txHash: "0x1",
        toIsContract: true,
        method: "swap",
      },
    ];
    const a = analyzeCreatorBehaviour({
      deployer: DEPLOYER,
      totalSupply: SUPPLY,
      transfers,
      paginationComplete: true,
      pagesFetched: 1,
    });
    const b = analyzeCreatorBehaviour({
      deployer: DEPLOYER,
      totalSupply: SUPPLY,
      transfers,
      paginationComplete: true,
      pagesFetched: 1,
    });
    expect(a).toEqual(b);
    expect(a.dumpDetected).toBe(true);
    expect(a.available).toBe(true);
    // Presentation must not mutate analyzer fields.
    describeCreatorSoldPctDisplay(a);
    describeCreatorBurnedDisplay(a);
    expect(a.creatorSellPctOfSupply).toBe(b.creatorSellPctOfSupply);
    expect(a.sellTransferCount).toBe(b.sellTransferCount);
  });
});
