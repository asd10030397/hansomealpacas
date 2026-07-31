/**
 * Phase 8 — profiling helpers + gecko overlap invariants (orchestration only).
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  beginProfileSpan,
  buildDeepProfileSummary,
  endProfileSpan,
  rankHotspots,
  resetDeepProfile,
  setDeepProfileEnabledForTests,
  withProfileSpan,
} from "@/lib/hansome-score/deep-profile";

describe("Phase 8 deep profile", () => {
  beforeEach(() => {
    setDeepProfileEnabledForTests(true);
    resetDeepProfile();
  });

  it("builds hierarchical spans and critical path", async () => {
    const root = beginProfileSpan("scan.manual_refresh", { category: "other" });
    await withProfileSpan(
      "scan.deep.parallel_wave",
      { category: "sequential", stage: "parallel" },
      async () => {
        await Promise.all([
          withProfileSpan(
            "scan.deep.relationships",
            { category: "blockscout", stage: "relationships" },
            async () => {
              await new Promise((r) => setTimeout(r, 30));
            },
          ),
          withProfileSpan(
            "scan.deep.liquidity",
            { category: "rpc", stage: "liquidity" },
            async () => {
              await new Promise((r) => setTimeout(r, 80));
            },
          ),
        ]);
      },
    );
    endProfileSpan(root, "completed");
    const summary = buildDeepProfileSummary();
    expect(summary.spans.length).toBeGreaterThanOrEqual(3);
    expect(summary.criticalPath[0]).toBe("scan.manual_refresh");
    const hot = rankHotspots(summary);
    expect(hot[0]?.name).toMatch(/liquidity|parallel|manual/);
  });

  it("records reused_cache status for dup gecko", () => {
    const span = beginProfileSpan("scan.deep.score.gecko", {
      category: "dup",
      stage: "score",
      operation: "gecko_reuse_from_liquidity",
    });
    endProfileSpan(span, "reused_cache", { cacheHit: true });
    const summary = buildDeepProfileSummary();
    expect(summary.spans.some((s) => s.cacheHit === true)).toBe(true);
  });
});
