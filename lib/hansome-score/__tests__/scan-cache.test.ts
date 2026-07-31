import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/hansome-score/scan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/hansome-score/scan")>();
  return {
    ...actual,
    scanToken: vi.fn(async (address: string) => {
      const now = new Date().toISOString();
      return {
        version: "test",
        scannedAt: now,
        scoreComputedAt: now,
        activityUpdatedAt: now,
        analysisPhase: "complete",
        analysisStatus: "complete",
        scoreProvisional: false,
        overview: {
          address,
          chainId: 4663,
          transfersCount: 10,
          supplyBurn: {
            burnFunction: "no",
            automaticBurn: "no",
            privilegedBurn: "no",
          },
        },
        overall: { score: 55 },
        score: { score: 83 },
        structural: { score: 83 },
        activity: { level: "Low", volume24hUsd: 10, transactions24h: 1 },
        hansomeLevel: { id: "kinda_hansome", label: "KINDA HANSOME", emoji: "😐" },
        confidence: { percent: 89 },
        liquidityUsd: 1000,
        context: {},
        sources: [],
        disclaimers: [],
        uiWording: {},
      };
    }),
    fetchOptionalGeckoActivity: vi.fn(async () => ({
      volume24hUsd: 99,
      transactions24h: 3,
      liquidityUsd: 2000,
      tokenPriceUsd: 0.01,
      quotePriceUsd: 3000,
      source: "geckoterminal",
    })),
  };
});

vi.mock("@/lib/hansome-score/scan-deep", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/hansome-score/scan-deep")>();
  return {
    ...actual,
    enrichScanDeep: vi.fn(async (base: import("@/lib/hansome-score/types").ScanResponse) => {
      const { markScanComplete } = await import("@/lib/hansome-score/scan-fast");
      return markScanComplete({
        ...base,
        overall: { ...(base.overall as object), score: 55 } as typeof base.overall,
        score: { ...(base.score as object), score: 83 } as typeof base.score,
        structural: {
          ...(base.structural as object),
          score: 83,
        } as typeof base.structural,
      });
    }),
  };
});

vi.mock("@/lib/hansome-score/scan-fast", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/hansome-score/scan-fast")>();
  return {
    ...actual,
    scanTokenFast: vi.fn(async (address: string) => {
      const now = new Date().toISOString();
      return {
        version: "test-fast",
        scannedAt: now,
        scoreComputedAt: now,
        activityUpdatedAt: now,
        analysisPhase: "fast",
        analysisStatus: "deep_running",
        scoreProvisional: true,
        analysisStages: actual.FAST_SCAN_STAGES_READY,
        overview: {
          address,
          chainId: 4663,
          transfersCount: 10,
          supplyBurn: {
            burnFunction: "no",
            automaticBurn: "no",
            privilegedBurn: "no",
          },
        },
        overall: { score: 40 },
        score: { score: 70 },
        structural: { score: 70 },
        activity: { level: "Low", volume24hUsd: 10, transactions24h: 1 },
        hansomeLevel: {
          id: "kinda_hansome",
          label: "KINDA HANSOME",
          emoji: "😐",
        },
        confidence: { percent: 50 },
        liquidityUsd: 1000,
        context: {},
        sources: [],
        disclaimers: [],
        uiWording: {},
      };
    }),
  };
});

describe("scan-cache MVP + Fast Scan", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("cold miss returns Fast Scan without awaiting deep scanToken", async () => {
    const { scanToken } = await import("@/lib/hansome-score/scan");
    const { scanTokenFast } = await import("@/lib/hansome-score/scan-fast");
    const { getCachedScan } = await import("@/lib/hansome-score/scan-cache");
    const addr = "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875";

    const [a, b, c] = await Promise.all([
      getCachedScan(addr),
      getCachedScan(addr),
      getCachedScan(addr),
    ]);

    expect(vi.mocked(scanTokenFast).mock.calls.length).toBe(1);
    expect(a.analysisPhase).toBe("fast");
    expect(a.scoreProvisional).toBe(true);
    expect(a.overall.score).toBe(40);
    expect(a.cache.refreshing).toBe(true);
    // Deep may be scheduled but must not block the cold response
    expect(
      a.cache.source === "fast" ||
        b.cache.source === "inflight" ||
        c.cache.source === "inflight" ||
        a.cache.hit,
    ).toBe(true);
    // Allow a tick for scheduled deep — should coalesce, not stampede
    await new Promise((r) => setTimeout(r, 20));
    expect(vi.mocked(scanToken).mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("serves memory hit under TTL without second fast scan when complete", async () => {
    const { scanTokenFast, markScanComplete } = await import(
      "@/lib/hansome-score/scan-fast"
    );
    const { getCachedScan, ensureDeepAnalysis } = await import(
      "@/lib/hansome-score/scan-cache"
    );
    const addr = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    await getCachedScan(addr);
    // Finish deep so next hit is complete snapshot
    await ensureDeepAnalysis(addr);
    const callsAfterDeep = vi.mocked(scanTokenFast).mock.calls.length;
    const second = await getCachedScan(addr);
    expect(vi.mocked(scanTokenFast).mock.calls.length).toBe(callsAfterDeep);
    expect(second.cache.hit).toBe(true);
    expect(markScanComplete).toBeTypeOf("function");
    expect(second.analysisPhase === "complete" || second.analysisStatus === "complete").toBe(
      true,
    );
  });

  it("rate-limits manual refresh and returns cached with refreshDenied", async () => {
    const { getCachedScan } = await import("@/lib/hansome-score/scan-cache");
    const addr = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    await getCachedScan(addr, { refresh: true, clientIp: "1.2.3.4" });
    const denied = await getCachedScan(addr, {
      refresh: true,
      clientIp: "1.2.3.4",
    });
    expect(denied.cache.refreshDenied).toBe(true);
    expect(denied.cache.refreshAvailableInSec).toBeGreaterThan(0);
  });
});
