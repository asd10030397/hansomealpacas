/**
 * Phase 9 — critical path profiler exporters + DAG (diagnostics only).
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  beginCriticalPathSession,
  beginProfileSpan,
  buildCriticalPathCompact,
  buildCriticalPathReport,
  endProfileSpan,
  recordRpcCall,
  recordWait,
  resetCriticalPathProfiler,
  setCriticalPathProfileEnabledForTests,
  withProfileSpan,
} from "@/lib/hansome-score/critical-path-profiler";

describe("Phase 9 critical path profiler", () => {
  beforeEach(() => {
    setCriticalPathProfileEnabledForTests(true);
    resetCriticalPathProfiler();
    beginCriticalPathSession({
      scanId: "scan_test",
      attemptId: "deep_test",
      token: "0xabc",
      chain: 2025,
    });
  });

  it("emits chrome trace, mermaid, flamegraph, and critical path table", async () => {
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
              recordRpcCall({
                provider: "blockscout",
                name: "/api/v2/addresses/x/transactions",
                start: Date.now() - 40,
                finish: Date.now(),
              });
              await new Promise((r) => setTimeout(r, 25));
            },
          ),
          withProfileSpan(
            "scan.deep.liquidity",
            { category: "rpc", stage: "liquidity" },
            async () => {
              await withProfileSpan(
                "scan.deep.liquidity.lp_market_refresh",
                { category: "api", stage: "liquidity" },
                async () => {
                  recordRpcCall({
                    provider: "gecko",
                    name: "gecko_pool",
                    start: Date.now() - 30,
                    finish: Date.now(),
                  });
                  await new Promise((r) => setTimeout(r, 55));
                },
              );
            },
          ),
          withProfileSpan(
            "scan.deep.creatorBurn",
            { category: "blockscout", stage: "creator" },
            async () => {
              await new Promise((r) => setTimeout(r, 20));
            },
          ),
        ]);
      },
    );
    await withProfileSpan(
      "scan.deep.score.recompute",
      { category: "cpu", stage: "score" },
      async () => {
        recordWait({
          kind: "publish",
          name: "publish:complete",
          start: Date.now() - 5,
          finish: Date.now(),
        });
      },
    );
    endProfileSpan(root, "completed");

    const report = buildCriticalPathReport();
    expect(report.version).toBe("phase9");
    expect(report.nodes.length).toBeGreaterThanOrEqual(5);
    expect(report.chromeTrace.traceEvents.length).toBeGreaterThan(0);
    expect(report.mermaidDag).toContain("flowchart TD");
    expect(report.flamegraphTimeline.length).toBeGreaterThan(0);
    expect(report.criticalPathTable.length).toBeGreaterThan(0);
    expect(report.criticalPath[0]).toBe("scan.manual_refresh");
    expect(report.rpcByProvider.blockscout.count).toBeGreaterThanOrEqual(1);
    expect(report.rpcByProvider.gecko.count).toBeGreaterThanOrEqual(1);
    expect(report.top30LongestNodes.length).toBeGreaterThan(0);
    expect(report.parallelization.alreadyParallel.length).toBeGreaterThan(0);
    expect(report.optimizationOpportunities.length).toBeGreaterThanOrEqual(0);

    const compact = buildCriticalPathCompact();
    expect(compact.nodeCount).toBe(report.nodes.length);
    expect(compact.rpcCount).toBeGreaterThanOrEqual(2);
  });

  it("is inert when disabled", () => {
    setCriticalPathProfileEnabledForTests(false);
    resetCriticalPathProfiler();
    recordRpcCall({
      provider: "gecko",
      name: "should_not_record",
      start: Date.now() - 10,
      finish: Date.now(),
    });
    const root = beginProfileSpan("scan.manual_refresh", { category: "other" });
    expect(root).toBeNull();
    endProfileSpan(root, "completed");
  });
});
