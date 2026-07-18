import { describe, expect, it } from "vitest";
import { midrankPercentileScores, roundMetric } from "../percentile";

describe("midrankPercentileScores", () => {
  it("returns neutral 50 when n < n_min", () => {
    const items = [1, 2, 3, 4];
    const ranked = midrankPercentileScores(items, (x) => x, { nMin: 5 });
    expect(ranked.every((r) => r.score === 50)).toBe(true);
    expect(ranked.every((r) => r.fallback === "neutral_insufficient_peers")).toBe(
      true,
    );
  });

  it("assigns identical scores for identical metrics (true ties)", () => {
    const items = ["a", "b", "c", "d", "e", "f"];
    const metric = (x: string) => (x === "a" || x === "b" ? 10 : 20);
    const ranked = midrankPercentileScores(items, metric, { nMin: 5 });
    const a = ranked.find((r) => r.item === "a")!;
    const b = ranked.find((r) => r.item === "b")!;
    expect(a.score).toBe(b.score);
    expect(a.fallback).toBe("identical_tie_shared_midrank");
    expect(b.fallback).toBe("identical_tie_shared_midrank");
  });

  it("does not invent spread when all metrics are equal", () => {
    const items = [1, 2, 3, 4, 5, 6];
    const ranked = midrankPercentileScores(items, () => 42, { nMin: 5 });
    const scores = new Set(ranked.map((r) => r.score));
    expect(scores.size).toBe(1);
    expect(ranked[0]!.score).toBe(50); // midrank of full tie: (0+5)/2 = 2.5 → 100*(2.5+0.5)/6 = 50
  });

  it("ranks higher metric above lower", () => {
    const items = [1, 2, 3, 4, 5];
    const ranked = midrankPercentileScores(items, (x) => x, { nMin: 5 });
    const byItem = Object.fromEntries(ranked.map((r) => [r.item, r.score]));
    expect(byItem[5]!).toBeGreaterThan(byItem[1]!);
  });

  it("roundMetric is stable", () => {
    expect(roundMetric(1.23456789111)).toBe(1.23456789);
  });
});
