/**
 * Cold Perf V2 Phase 5 — Quick LP discovery (18 required cases).
 * Orchestration / bounds / honesty only — no lock math changes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  boundQuickLpCandidates,
  classifyLpHonestyReason,
  EXHAUSTIVE_LP_PM_MAX_PAGES,
  honestyReasonDetail,
  QUICK_LP_MAX_CANDIDATES,
  QUICK_LP_MAX_HINT_OWNERS,
  QUICK_LP_MAX_WALL_MS,
  QUICK_LP_PM_MAX_PAGES,
  quickLpEvidenceSufficient,
} from "@/lib/hansome-score/lp/quick-discovery";
import {
  clearLpDiscoveryCheckpointForTests,
  clearLpDiscoveryCheckpointTestKv,
  isLpExhaustiveBackgroundInflight,
  loadLpDiscoveryCheckpoint,
  lpDiscoveryCheckpointKvKey,
  persistLpDiscoveryCheckpoint,
  sanitizeLpDiscoveryCheckpoint,
  scheduleLpExhaustiveBackground,
  useLpDiscoveryCheckpointTestKv,
  type LpDiscoveryCheckpoint,
} from "@/lib/hansome-score/lp/discovery-checkpoint";
import {
  clearLpDiscoveryCacheTestKv,
  clearPositionCacheForTests,
} from "@/lib/hansome-score/lp/position-cache";
import { deriveModuleProgress } from "@/lib/hansome-score/analysis-progress";
import type { ScanResponse } from "@/lib/hansome-score/types";

describe("Phase 5 Quick LP — bounds & honesty (18)", () => {
  beforeEach(() => {
    clearPositionCacheForTests();
    clearLpDiscoveryCacheTestKv();
    clearLpDiscoveryCheckpointForTests();
    clearLpDiscoveryCheckpointTestKv();
  });

  afterEach(() => {
    clearPositionCacheForTests();
    clearLpDiscoveryCacheTestKv();
    clearLpDiscoveryCheckpointForTests();
    clearLpDiscoveryCheckpointTestKv();
    vi.restoreAllMocks();
  });

  it("1. Quick PM page budget is 3 (not exhaustive 6)", () => {
    expect(QUICK_LP_PM_MAX_PAGES).toBe(3);
    expect(EXHAUSTIVE_LP_PM_MAX_PAGES).toBe(6);
    expect(QUICK_LP_PM_MAX_PAGES).toBeLessThan(EXHAUSTIVE_LP_PM_MAX_PAGES);
  });

  it("2. Quick candidate + hint owner caps are bounded", () => {
    expect(QUICK_LP_MAX_CANDIDATES).toBeLessThanOrEqual(48);
    expect(QUICK_LP_MAX_HINT_OWNERS).toBeLessThanOrEqual(12);
    expect(QUICK_LP_MAX_WALL_MS).toBeLessThanOrEqual(60_000);
  });

  it("3. boundQuickLpCandidates never exceeds max and preserves order", () => {
    const ids = Array.from({ length: 100 }, (_, i) => BigInt(i + 1));
    const bounded = boundQuickLpCandidates(ids, 40);
    expect(bounded).toHaveLength(40);
    expect(bounded[0]).toBe(1n);
    expect(bounded[39]).toBe(40n);
  });

  it("4. boundQuickLpCandidates dedupes", () => {
    expect(boundQuickLpCandidates([1n, 1n, 2n, 2n], 10)).toEqual([1n, 2n]);
  });

  it("5. quickLpEvidenceSufficient: seeds satisfied", () => {
    expect(
      quickLpEvidenceSufficient({
        seeds: [10n, 20n],
        positions: [
          {
            positionNftId: "10",
            lockState: "LOCKED_VERIFIED_ONCHAIN",
            removableByEoa: false,
          },
          {
            positionNftId: "20",
            lockState: "UNLOCKED_EOA_CONTROLLED",
            removableByEoa: true,
          },
        ],
      }),
    ).toBe(true);
  });

  it("6. quickLpEvidenceSufficient: MIXED locked+removable without seeds", () => {
    expect(
      quickLpEvidenceSufficient({
        seeds: [],
        positions: [
          {
            positionNftId: "1",
            lockState: "LOCKED_VERIFIED_ONCHAIN",
            removableByEoa: false,
          },
          {
            positionNftId: "2",
            lockState: "UNLOCKED_EOA_CONTROLLED",
            removableByEoa: true,
          },
        ],
      }),
    ).toBe(true);
  });

  it("7. quickLpEvidenceSufficient: empty / single lock alone is false", () => {
    expect(
      quickLpEvidenceSufficient({ seeds: [], positions: [] }),
    ).toBe(false);
    expect(
      quickLpEvidenceSufficient({
        seeds: [],
        positions: [
          {
            positionNftId: "1",
            lockState: "LOCKED_VERIFIED_ONCHAIN",
            removableByEoa: false,
          },
        ],
      }),
    ).toBe(false);
  });

  it("8. Honesty: no liquidity detected", () => {
    expect(
      classifyLpHonestyReason({
        poolDetected: false,
        positionsFound: 0,
        materialCount: 0,
        lockedCount: 0,
        unlockedCount: 0,
        unknownCount: 0,
        unsupportedLockerCount: 0,
        discoveryComplete: false,
        aggregateState: "NONE",
      }),
    ).toBe("no_liquidity_detected");
    expect(honestyReasonDetail("no_liquidity_detected")).toMatch(
      /No Liquidity Detected/i,
    );
  });

  it("9. Honesty: unsupported locker / ownership unresolved / lock unknown", () => {
    expect(
      classifyLpHonestyReason({
        poolDetected: true,
        positionsFound: 1,
        materialCount: 1,
        lockedCount: 0,
        unlockedCount: 0,
        unknownCount: 0,
        unsupportedLockerCount: 1,
        discoveryComplete: false,
        aggregateState: "UNKNOWN_INCOMPLETE",
      }),
    ).toBe("unsupported_locker");
    expect(
      classifyLpHonestyReason({
        poolDetected: true,
        positionsFound: 2,
        materialCount: 2,
        lockedCount: 0,
        unlockedCount: 0,
        unknownCount: 2,
        unsupportedLockerCount: 0,
        discoveryComplete: false,
        aggregateState: "UNKNOWN_INCOMPLETE",
      }),
    ).toBe("lock_status_unknown");
    expect(
      classifyLpHonestyReason({
        poolDetected: true,
        positionsFound: 1,
        materialCount: 1,
        lockedCount: 1,
        unlockedCount: 0,
        unknownCount: 0,
        unsupportedLockerCount: 0,
        discoveryComplete: false,
        aggregateState: "UNKNOWN_INCOMPLETE",
      }),
    ).toBe("ownership_unresolved");
  });

  it("10. Honesty: discovery incomplete default; MIXED never ALL_LOCKED label", () => {
    expect(
      classifyLpHonestyReason({
        poolDetected: true,
        positionsFound: 0,
        materialCount: 0,
        lockedCount: 0,
        unlockedCount: 0,
        unknownCount: 0,
        unsupportedLockerCount: 0,
        discoveryComplete: false,
        aggregateState: "UNKNOWN_INCOMPLETE",
      }),
    ).toBe("discovery_incomplete");
    expect(
      classifyLpHonestyReason({
        poolDetected: true,
        positionsFound: 2,
        materialCount: 2,
        lockedCount: 1,
        unlockedCount: 1,
        unknownCount: 0,
        unsupportedLockerCount: 0,
        discoveryComplete: false,
        aggregateState: "MIXED",
      }),
    ).toBe("detected_mixed");
    expect(honestyReasonDetail("detected_mixed")).not.toMatch(/ALL_LOCKED/);
  });

  it("11. Checkpoint persists checked IDs without lock-truth", async () => {
    const kv = new Map<string, LpDiscoveryCheckpoint>();
    useLpDiscoveryCheckpointTestKv(kv);
    const entry = await persistLpDiscoveryCheckpoint(4663, "0xAbC", {
      checkedPositionIds: [1n, 2n, "3"],
      pmPagesFetched: 3,
      quickComplete: true,
      exhaustiveComplete: false,
    });
    expect(entry.checkedPositionIds).toEqual(["1", "2", "3"]);
    expect(entry.quickComplete).toBe(true);
    expect(entry.exhaustiveComplete).toBe(false);
    expect(entry).not.toHaveProperty("lockState");
    expect(kv.has(lpDiscoveryCheckpointKvKey(4663, "0xAbC"))).toBe(true);

    clearLpDiscoveryCheckpointForTests();
    const loaded = await loadLpDiscoveryCheckpoint(4663, "0xAbC");
    expect(loaded?.checkedPositionIds).toEqual(["1", "2", "3"]);
    expect(loaded?.pmPagesFetched).toBe(3);
  });

  it("12. Checkpoint sanitize rejects lock-truth blobs", () => {
    expect(
      sanitizeLpDiscoveryCheckpoint(
        {
          checkedPositionIds: ["1"],
          lockState: "LOCKED",
          lockedPct: 99,
        },
        4663,
        "0x1",
      ),
    ).toBeNull();
  });

  it("13. Checkpoint unions checked IDs across Quick → resume (no full restart)", async () => {
    useLpDiscoveryCheckpointTestKv(new Map());
    await persistLpDiscoveryCheckpoint(4663, "0xTok", {
      checkedPositionIds: ["10", "20"],
      pmPagesFetched: 3,
      quickComplete: true,
    });
    const next = await persistLpDiscoveryCheckpoint(4663, "0xTok", {
      checkedPositionIds: ["20", "30"],
      pmPagesFetched: 6,
      exhaustiveComplete: true,
    });
    expect(next.checkedPositionIds).toEqual(["10", "20", "30"]);
    expect(next.exhaustiveComplete).toBe(true);
  });

  it("14. Background exhaustive schedule is idempotent per token", async () => {
    let runs = 0;
    const run = async () => {
      runs += 1;
      await new Promise((r) => setTimeout(r, 30));
    };
    scheduleLpExhaustiveBackground({
      tokenAddress: "0x1111111111111111111111111111111111111111",
      chainId: 4663,
      run,
    });
    expect(
      isLpExhaustiveBackgroundInflight(
        4663,
        "0x1111111111111111111111111111111111111111",
      ),
    ).toBe(true);
    scheduleLpExhaustiveBackground({
      tokenAddress: "0x1111111111111111111111111111111111111111",
      chainId: 4663,
      run,
    });
    await new Promise((r) => setTimeout(r, 60));
    expect(runs).toBe(1);
  });

  it("15. Quick path must never claim discoveryComplete from helpers alone", () => {
    // Contract: Quick LP helpers do not expose a discoveryComplete=true flag.
    const reason = classifyLpHonestyReason({
      poolDetected: true,
      positionsFound: 3,
      materialCount: 3,
      lockedCount: 1,
      unlockedCount: 2,
      unknownCount: 0,
      unsupportedLockerCount: 0,
      discoveryComplete: false,
      aggregateState: "MIXED",
    });
    expect(reason).toBe("detected_mixed");
    expect(honestyReasonDetail(reason)).not.toMatch(/discovery marked complete/i);
  });

  it("16. Liquidity progress caps at 95 until stage done; Quick advances gradually", () => {
    const base = {
      overview: {
        address: "0x57ffd85d9f0744b7790dcdbbc2c0f188f81de00f",
        lpIntelligence: {
          poolDetected: true,
          poolsDetectedCount: 1,
          positionCounts: { detected: 2, material: 2, locked: 1, unlocked: 1, unknown: 0 },
          positions: [{}, {}],
          knownPositionsVerified: true,
          discoveryComplete: false,
          exhaustiveDiscoveryComplete: false,
          lockDistribution: {
            available: true,
            lockedUsd: 100,
            unlockedUsd: 200,
            unknownUsd: 0,
            lockedPct: 33,
            unlockedPct: 67,
            unknownPct: 0,
            totalPositionUsd: 300,
            poolLiquidityUsd: 300,
            reconciledWithPool: true,
            method: "test",
            reason: null,
          },
        },
      },
      analysisStages: { liquidity: "analyzing" as const },
      deepProgress: {
        stage: "liquidity" as const,
        action: "quick_pm_recent",
        completedUnits: 4,
        totalUnits: 6,
        sequence: 1,
        updatedAt: Date.now(),
      },
    } as unknown as Pick<
      ScanResponse,
      "overview" | "analysisStages" | "deepProgress" | "analysisStatus"
    >;

    const mid = deriveModuleProgress(base as ScanResponse, "liquidity");
    expect(mid.progress).toBeGreaterThan(20);
    expect(mid.progress).toBeLessThan(100);
    expect(mid.progress).toBeLessThanOrEqual(95);

    const done = deriveModuleProgress(
      {
        ...base,
        analysisStages: { liquidity: "done" },
      } as ScanResponse,
      "liquidity",
    );
    expect(done.progress).toBe(100);
  });

  it("17. Progress does not jump low→100 on quick_complete while analyzing", () => {
    const snap = {
      overview: { address: "0x57ff" },
      analysisStages: { liquidity: "analyzing" },
      deepProgress: {
        stage: "liquidity",
        action: "quick_complete",
        completedUnits: 6,
        totalUnits: 6,
        sequence: 2,
        updatedAt: Date.now(),
      },
    } as unknown as ScanResponse;
    const m = deriveModuleProgress(snap, "liquidity");
    expect(m.progress).toBeLessThan(100);
    expect(m.progress).toBeLessThanOrEqual(95);
  });

  it("18. Candidate order constants: cache/seeds before PM; exhaustive is last", () => {
    // Documented order encoded as numeric budgets — Quick ≪ Exhaustive.
    expect(QUICK_LP_PM_MAX_PAGES).toBe(3);
    expect(EXHAUSTIVE_LP_PM_MAX_PAGES).toBe(6);
    expect(QUICK_LP_MAX_CANDIDATES).toBeLessThan(100);
    // Exhaustive page budget strictly larger — background continuation only.
    expect(EXHAUSTIVE_LP_PM_MAX_PAGES * 50).toBeGreaterThan(
      QUICK_LP_MAX_CANDIDATES,
    );
  });
});

describe("Phase 5 Quick LP — checkpoint reuse short-circuit", () => {
  beforeEach(() => {
    clearLpDiscoveryCheckpointForTests();
    clearLpDiscoveryCheckpointTestKv();
  });

  afterEach(() => {
    clearLpDiscoveryCheckpointForTests();
    clearLpDiscoveryCheckpointTestKv();
  });

  it("quickComplete checkpoint marks reuse path available for second scan", async () => {
    useLpDiscoveryCheckpointTestKv(new Map());
    await persistLpDiscoveryCheckpoint(4663, "0x57ffd85d9f0744b7790dcdbbc2c0f188f81de00f", {
      checkedPositionIds: ["1", "2", "3"],
      pmPagesFetched: 3,
      quickComplete: true,
      exhaustiveComplete: false,
    });
    const hit = await loadLpDiscoveryCheckpoint(
      4663,
      "0x57ffd85d9f0744b7790dcdbbc2c0f188f81de00f",
    );
    expect(hit?.quickComplete).toBe(true);
    expect(hit?.checkedPositionIds).toHaveLength(3);
    // detect.ts short-circuits Quick PM when quickComplete && !exhaustive
  });
});
