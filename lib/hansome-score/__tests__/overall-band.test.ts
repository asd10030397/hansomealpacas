import { describe, expect, it } from "vitest";
import {
  getOverallScoreBand,
  OVERALL_SCORE_BANDS,
  OVERALL_SCORE_BAND_LEGEND,
} from "@/lib/hansome-score/overall-band";

describe("getOverallScoreBand", () => {
  it("maps boundary scores to the correct band", () => {
    expect(getOverallScoreBand(0).label).toBe("VERY WEAK");
    expect(getOverallScoreBand(19).label).toBe("VERY WEAK");
    expect(getOverallScoreBand(20).label).toBe("WEAK");
    expect(getOverallScoreBand(39).label).toBe("WEAK");
    expect(getOverallScoreBand(40).label).toBe("FAIR");
    expect(getOverallScoreBand(55).label).toBe("FAIR");
    expect(getOverallScoreBand(59).label).toBe("FAIR");
    expect(getOverallScoreBand(60).label).toBe("GOOD");
    expect(getOverallScoreBand(79).label).toBe("GOOD");
    expect(getOverallScoreBand(80).label).toBe("STRONG");
    expect(getOverallScoreBand(100).label).toBe("STRONG");
  });

  it("clamps out-of-range and non-finite values", () => {
    expect(getOverallScoreBand(-5).id).toBe("very_weak");
    expect(getOverallScoreBand(140).id).toBe("strong");
    expect(getOverallScoreBand(Number.NaN).id).toBe("very_weak");
  });

  it("exposes progressive semantic colors", () => {
    const byId = Object.fromEntries(
      OVERALL_SCORE_BANDS.map((b) => [b.id, b]),
    );
    expect(byId.very_weak!.color).toBe("#7f1d1d");
    expect(byId.weak!.textClass).toContain("red");
    expect(byId.fair!.textClass).toContain("amber");
    expect(byId.good!.textClass).toMatch(/lime|green/);
    expect(byId.strong!.textClass).toContain("green");
  });

  it("keeps a single source of truth for thresholds and legend", () => {
    expect(OVERALL_SCORE_BANDS).toHaveLength(5);
    expect(OVERALL_SCORE_BAND_LEGEND).toBe(
      [
        "80–100  STRONG",
        "60–79   GOOD",
        "40–59   FAIR",
        "20–39   WEAK",
        "0–19    VERY WEAK",
      ].join("\n"),
    );
  });
});
