import { describe, expect, it } from "vitest";
import {
  SETTLEMENT_RESULT_SFX_CATALOG,
  SETTLEMENT_RESULT_SFX_IDS,
  parseSettlementResultSfxId,
  settlementResultSfxUrls,
} from "@/lib/game/settlementResults/catalog";

describe("settlement result SFX catalog", () => {
  it("maps authoritative mock outcomes", () => {
    expect(parseSettlementResultSfxId("Hunted — penalty applied")).toBe(
      "alpaca-hunted",
    );
    expect(parseSettlementResultSfxId("Safe (Home / no hunt)")).toBe("alpaca-safe");
    expect(parseSettlementResultSfxId("Survived under hunt")).toBe("alpaca-safe");
    expect(parseSettlementResultSfxId("Escaped hunt")).toBe("alpaca-safe");
    expect(parseSettlementResultSfxId("Hunt success")).toBe("cougar-hunt-success");
    expect(parseSettlementResultSfxId("Hunt miss")).toBe("cougar-hunt-failed");
  });

  it("does not invent cues for live placeholders or unresolved labels", () => {
    expect(
      parseSettlementResultSfxId(
        "Settled on-chain (detail fields not exposed by contract)",
      ),
    ).toBeNull();
    expect(parseSettlementResultSfxId("Revealed — awaiting settlement")).toBeNull();
    expect(parseSettlementResultSfxId("Participated")).toBeNull();
    expect(parseSettlementResultSfxId(null)).toBeNull();
  });

  it("maps each result id to folder-backed audio URLs", () => {
    for (const id of SETTLEMENT_RESULT_SFX_IDS) {
      const urls = settlementResultSfxUrls(id);
      expect(urls.ogg).toContain(`/audio/game/settlement-results/${id}/effect.ogg`);
      expect(urls.mp3).toContain(`/audio/game/settlement-results/${id}/effect.mp3`);
    }
  });

  it("exposes a presentation banner and dramatic label for each result", () => {
    for (const id of SETTLEMENT_RESULT_SFX_IDS) {
      expect(SETTLEMENT_RESULT_SFX_CATALOG[id].banner.length).toBeGreaterThan(0);
      expect(SETTLEMENT_RESULT_SFX_CATALOG[id].dramaticLabel.length).toBeGreaterThan(0);
      // 2× Battle Result presentation: Season-1 baselines × 1.5 × 2
      expect(SETTLEMENT_RESULT_SFX_CATALOG[id].durationMs).toBeGreaterThanOrEqual(3000);
      expect(SETTLEMENT_RESULT_SFX_CATALOG[id].durationMs).toBeLessThanOrEqual(4200);
    }
  });
});
