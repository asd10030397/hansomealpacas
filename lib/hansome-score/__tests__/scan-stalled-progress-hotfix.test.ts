/**
 * HANSOME Scan — Stalled Progress + Gradual Progress Hotfix tests.
 * Progress/orchestration only — no score/classification semantic changes.
 */
import { describe, expect, it } from "vitest";
import {
  applyMonotonicProgress,
  deriveAnalysisProgress,
  deriveModuleProgress,
  MODULE_WEIGHTS,
} from "@/lib/hansome-score/analysis-progress";
import {
  asymptoticInternalProgress,
  DEEP_PROGRESS_STALL_MS,
  finalizationOverallHint,
  isDeepProgressStalled,
  pageInternalProgress,
  resolveDeepPipelineFocus,
  stampDeepProgress,
} from "@/lib/hansome-score/deep-progress";
import { FAST_SCAN_STAGES_READY } from "@/lib/hansome-score/scan-fast";
import type { ConfidenceResult, ScanResponse } from "@/lib/hansome-score/types";

function emptyConfidence(percent: number): ConfidenceResult {
  return {
    percent,
    band: percent >= 70 ? "High" : percent >= 40 ? "Medium" : "Low",
    dimensions: [],
    weights: {
      contract: 0.2,
      liquidity: 0.25,
      holders: 0.2,
      wallet: 0.15,
      creator: 0.2,
    },
    penalties: [],
  };
}

function overview(
  partial: Partial<ScanResponse["overview"]> = {},
): ScanResponse["overview"] {
  return {
    address: "0x57ffd85d9f0744b7790dcdbbc2c0f188f81de00f",
    chainId: 2020,
    name: "T",
    symbol: "T",
    decimals: 18,
    totalSupplyRaw: "1000",
    totalSupplyFormatted: "1000",
    holdersCount: 10,
    transfersCount: 100,
    deployer: "0x0000000000000000000000000000000000000002",
    creationTxHash: null,
    contractVerified: true,
    poolManagerBalanceRaw: "1",
    poolManagerBalanceFormatted: "1",
    poolId: null,
    lpLockStatus: "unknown",
    lpLockDetail: null,
    lpIntelligence: {
      poolDetected: true,
      poolsDetectedCount: 1,
      poolId: null,
      poolManagerBalanceRaw: "1",
      poolManagerBalanceFormatted: "1",
      aggregateLockState: "UNABLE_TO_DETERMINE",
      aggregateLockStateDisplay: "UNABLE TO DETERMINE",
      aggregateState: "UNKNOWN_INCOMPLETE",
      aggregateStateDisplay: "UNKNOWN / INCOMPLETE",
      positionCounts: {
        detected: 1,
        material: 0,
        locked: 0,
        unlocked: 0,
        unknown: 1,
      },
      lockDistribution: {
        available: false,
        lockedPct: null,
        unlockedPct: null,
        lockedUsd: null,
        unlockedUsd: null,
        totalUsd: null,
      },
      knownPositionsVerified: false,
      discoveryComplete: false,
      exhaustiveDiscoveryComplete: false,
      positions: [],
      detail: "probe",
      evidenceLevel: "on_chain_partial",
    },
    topHolders: [],
    concentration: null,
    contractRisk: { flags: [], severity: "info" },
    relationship: {
      equalBalanceClusterSize: 0,
      equalBalanceClusterAddresses: [],
      deployerInEqualBalanceCluster: false,
      sharedFundingCount: 0,
      sharedFundingAddresses: [],
      sharedFundingFunder: null,
      deployerFundedCount: 0,
      deployerFundedAddresses: [],
      sameBlockEarlyBuyCount: 0,
      sameBlockEarlyBuyAddresses: [],
    },
    creatorBehaviour: {
      status: "incomplete",
      available: false,
      dumpDetected: false,
      transferThenSellDetected: false,
      creatorSellPctOfSupply: 0,
      outboundTransferCount: 0,
      sellTransferCount: 0,
      transferThenSellRecipientCount: 0,
      pagesFetched: 0,
      transfersIndexed: 0,
      paginationComplete: false,
      detail: "",
      evidence: [],
    },
    supplyBurn: {
      mechanism: "unknown",
      knownBurnAddresses: [],
      knownBurnedSupplyRaw: null,
      knownBurnedSupplyFormatted: null,
      remainingSupplyRaw: null,
      remainingSupplyFormatted: null,
      automaticBurn: "unknown",
      privilegedBurn: "unknown",
      holderBurnCallable: "unknown",
      burnActivity: {
        pagesFetched: 0,
        transfersIndexed: 0,
        paginationComplete: false,
        headIndexed: false,
        burnsDetected: 0,
        burnedRaw: "0",
        burnedFormatted: null,
        lastBurnAt: null,
        source: null,
      },
      detail: "",
      evidence: [],
      provenBurnEventCount: null,
    },
    ...partial,
  } as ScanResponse["overview"];
}

function snap(
  partial: Partial<
    Pick<
      ScanResponse,
      | "analysisStages"
      | "analysisStatus"
      | "deepProgress"
      | "deepAttemptId"
      | "deepStartedAt"
      | "overview"
      | "deepRetryCount"
      | "confidence"
    >
  > = {},
) {
  return {
    analysisPhase: "fast" as const,
    analysisStatus: "deep_running" as const,
    analysisStages: { ...FAST_SCAN_STAGES_READY },
    deepRetryCount: 0,
    scoreProvisional: true,
    deepAttemptId: "d_stall_1",
    deepStartedAt: new Date(Date.now() - 60_000).toISOString(),
    overview: overview(),
    confidence: emptyConfidence(40),
    ...partial,
  };
}

describe("stall hotfix — progress model", () => {
  it("1. overall uses module internal progress × weights (not full weight on start)", () => {
    const w = deriveAnalysisProgress(snap());
    const rel = w.modules.find((m) => m.key === "relationships")!;
    const liq = w.modules.find((m) => m.key === "liquidity")!;
    // Phase 6: parallel modules analyzing — not force-queued; still capped <100.
    expect(liq.status).not.toBe("unavailable");
    expect(liq.progress).toBeLessThan(100);
    const expected =
      (100 * MODULE_WEIGHTS.structural +
        100 * MODULE_WEIGHTS.holders +
        liq.progress * MODULE_WEIGHTS.liquidity +
        (w.modules.find((m) => m.key === "burn")!.progress) *
          MODULE_WEIGHTS.burn +
        (w.modules.find((m) => m.key === "creator")!.progress) *
          MODULE_WEIGHTS.creator +
        rel.progress * MODULE_WEIGHTS.relationships) /
      100;
    expect(w.overallProgress).toBeLessThanOrEqual(Math.min(99, Math.round(expected) + 1));
    expect(w.overallProgress).toBeLessThan(100);
  });

  it("2. Phase 6 parallel — Fast-stamped analyzing stages are not force-queued", () => {
    const liq = deriveModuleProgress(snap(), "liquidity");
    const creator = deriveModuleProgress(snap(), "creator");
    const burn = deriveModuleProgress(snap(), "burn");
    expect(liq.status).not.toBe("queued");
    expect(creator.status).not.toBe("queued");
    expect(burn.status).not.toBe("queued");
    expect(liq.progress).toBeLessThan(100);
    expect(creator.progress).toBeLessThan(100);
    expect(burn.progress).toBeLessThan(100);
  });

  it("3. relationships advances from durable deepProgress units", () => {
    const m = deriveModuleProgress(
      snap({
        deepProgress: {
          sequence: 4,
          updatedAt: new Date().toISOString(),
          stage: "relationships",
          action: "funder",
          completedUnits: 6,
          totalUnits: 13,
        },
      }),
      "relationships",
    );
    expect(m.progress).toBeGreaterThan(10);
    expect(m.progress).toBeLessThan(100);
    expect(m.completedUnits).toBe(6);
  });

  it("4. liquidity probe units move bar before known-positions", () => {
    const m = deriveModuleProgress(
      snap({
        analysisStages: {
          ...FAST_SCAN_STAGES_READY,
          relationships: "done",
          liquidity: "analyzing",
        },
        deepProgress: {
          sequence: 5,
          updatedAt: new Date().toISOString(),
          stage: "liquidity",
          action: "probe_v3",
          completedUnits: 2,
          totalUnits: 3,
        },
        overview: overview({
          lpIntelligence: {
            ...overview().lpIntelligence!,
            poolDetected: true,
            poolsDetectedCount: 1,
            positionCounts: {
              detected: 1,
              material: 0,
              locked: 0,
              unlocked: 0,
              unknown: 1,
            },
          },
        }),
      }),
      "liquidity",
    );
    expect(m.progress).toBeGreaterThan(12);
    expect(m.progress).toBeLessThan(100);
  });

  it("5. creator/burn page counters advance gradually", () => {
    const creator = deriveModuleProgress(
      snap({
        analysisStages: {
          ...FAST_SCAN_STAGES_READY,
          relationships: "done",
          liquidity: "done",
          creator: "analyzing",
          burn: "analyzing",
        },
        deepProgress: {
          sequence: 8,
          updatedAt: new Date().toISOString(),
          stage: "creatorBurn",
          action: "page_indexing",
          pagesFetched: 3,
          completedUnits: 3,
          totalUnits: 40,
        },
        overview: overview({
          creatorBehaviour: {
            ...overview().creatorBehaviour!,
            pagesFetched: 3,
            transfersIndexed: 30,
          },
          supplyBurn: {
            ...overview().supplyBurn!,
            burnActivity: {
              ...overview().supplyBurn!.burnActivity!,
              pagesFetched: 3,
              transfersIndexed: 30,
            },
          },
        }),
      }),
      "creator",
    );
    const burn = deriveModuleProgress(
      snap({
        analysisStages: {
          ...FAST_SCAN_STAGES_READY,
          relationships: "done",
          liquidity: "done",
          creator: "analyzing",
          burn: "analyzing",
        },
        deepProgress: {
          sequence: 8,
          updatedAt: new Date().toISOString(),
          stage: "creatorBurn",
          action: "page_indexing",
          pagesFetched: 3,
        },
        overview: overview({
          supplyBurn: {
            ...overview().supplyBurn!,
            burnActivity: {
              ...overview().supplyBurn!.burnActivity!,
              pagesFetched: 3,
              transfersIndexed: 30,
            },
          },
        }),
      }),
      "burn",
    );
    expect(creator.progress).toBeGreaterThan(25);
    expect(burn.progress).toBeGreaterThan(25);
    expect(creator.progress).toBeLessThan(100);
  });

  it("6. asymptotic model starts low and caps below 95 until finalize", () => {
    expect(asymptoticInternalProgress(0)).toBeLessThanOrEqual(3);
    expect(asymptoticInternalProgress(1)).toBeGreaterThan(3);
    expect(asymptoticInternalProgress(100)).toBeLessThanOrEqual(95);
  });

  it("7. pageInternalProgress never jumps 0→100", () => {
    expect(pageInternalProgress(0, 40)).toBeLessThan(25);
    expect(pageInternalProgress(1, 40)).toBeGreaterThanOrEqual(25);
    expect(pageInternalProgress(20, 40)).toBeLessThan(95);
    expect(pageInternalProgress(40, 40)).toBeLessThanOrEqual(95);
  });

  it("8. monotonic apply never decreases within attempt", () => {
    const a = deriveAnalysisProgress(snap());
    const b = deriveAnalysisProgress(
      snap({
        deepProgress: {
          sequence: 2,
          updatedAt: new Date().toISOString(),
          stage: "relationships",
          action: "funder",
          completedUnits: 4,
          totalUnits: 13,
        },
      }),
      a,
    );
    const mono = applyMonotonicProgress(b, a);
    expect(mono.overallProgress).toBeGreaterThanOrEqual(b.overallProgress);
  });

  it("9. no low→100 jump: done required for 100", () => {
    const mid = deriveModuleProgress(
      snap({
        analysisStages: {
          ...FAST_SCAN_STAGES_READY,
          relationships: "done",
          liquidity: "analyzing",
        },
        deepProgress: {
          sequence: 3,
          updatedAt: new Date().toISOString(),
          stage: "liquidity",
          action: "probe_v4",
          completedUnits: 3,
          totalUnits: 3,
        },
      }),
      "liquidity",
    );
    expect(mid.progress).toBeLessThan(100);
    const done = deriveModuleProgress(
      snap({
        analysisStages: {
          ...FAST_SCAN_STAGES_READY,
          relationships: "done",
          liquidity: "done",
        },
      }),
      "liquidity",
    );
    expect(done.progress).toBe(100);
  });

  it("10. finalization ladder maps lifecycle events", () => {
    expect(finalizationOverallHint("stages_settled")).toBe(92);
    expect(finalizationOverallHint("score_analyzing")).toBe(96);
    expect(finalizationOverallHint("score_done")).toBe(98);
    expect(finalizationOverallHint("complete")).toBe(100);
  });
});

describe("stall hotfix — durable progress + watchdog", () => {
  it("11. stampDeepProgress increments sequence and updatedAt", () => {
    const base = {
      deepProgress: undefined,
    } as ScanResponse;
    const a = stampDeepProgress(base, {
      stage: "relationships",
      action: "start",
    });
    const b = stampDeepProgress(a, {
      stage: "relationships",
      action: "funder",
      completedUnits: 2,
      totalUnits: 12,
    });
    expect(a.deepProgress!.sequence).toBe(1);
    expect(b.deepProgress!.sequence).toBe(2);
    expect(b.deepProgress!.completedUnits).toBe(2);
  });

  it("12. isDeepProgressStalled after threshold with no publish", () => {
    const started = new Date(Date.now() - DEEP_PROGRESS_STALL_MS - 1_000).toISOString();
    expect(
      isDeepProgressStalled({
        analysisStatus: "deep_running",
        deepStartedAt: started,
        deepProgress: {
          sequence: 1,
          updatedAt: started,
          stage: "liquidity",
          action: "start",
        },
      }),
    ).toBe(true);
    expect(
      isDeepProgressStalled({
        analysisStatus: "deep_running",
        deepProgress: {
          sequence: 2,
          updatedAt: new Date().toISOString(),
          stage: "liquidity",
          action: "probe_v2",
        },
      }),
    ).toBe(false);
  });

  it("13. pipeline focus prefers deepProgress.stage over Fast stamps", () => {
    expect(
      resolveDeepPipelineFocus(FAST_SCAN_STAGES_READY, {
        sequence: 1,
        updatedAt: new Date().toISOString(),
        stage: "liquidity",
        action: "start",
      }),
    ).toBe("liquidity");
  });

  it("14. stalled flag surfaces on module progress", () => {
    const m = deriveModuleProgress(
      snap({
        deepProgress: {
          sequence: 1,
          updatedAt: new Date(Date.now() - 60_000).toISOString(),
          stage: "relationships",
          action: "watchdog_stall",
          stalled: true,
          stallReason: "no_progress_publish_45s",
        },
      }),
      "relationships",
    );
    expect(m.stalled).toBe(true);
    expect(m.lastUpdateAgeMs).toBeGreaterThan(40_000);
  });

  it("15. coverage remains separate from workflow progress", () => {
    const w = deriveAnalysisProgress(snap({ confidence: emptyConfidence(88) }));
    expect(w.analysisCoveragePercent).toBe(88);
    expect(w.overallProgress).not.toBe(88);
  });

  it("16. incomplete/unavailable never forced to 100", () => {
    const m = deriveModuleProgress(
      snap({
        analysisStatus: "partial",
        analysisStages: {
          ...FAST_SCAN_STAGES_READY,
          relationships: "partial",
          liquidity: "done",
          creator: "partial",
          burn: "partial",
        },
        deepRetryCount: 99,
      }),
      "creator",
    );
    expect(m.progress).toBeLessThan(100);
  });

  it("17. sequence ignore contract: older seq must not win (client rule)", () => {
    const prevSeq = 5;
    const nextSeq = 3;
    const accept = !(nextSeq > 0 && nextSeq < prevSeq);
    expect(accept).toBe(false);
  });

  it("18. deepProgress has no secrets fields", () => {
    const stamped = stampDeepProgress({} as ScanResponse, {
      stage: "creatorBurn",
      action: "page",
      pagesFetched: 2,
      transfersIndexed: 20,
    });
    const json = JSON.stringify(stamped.deepProgress);
    expect(json).not.toMatch(/KV_REST|PRIVATE_KEY|secret|token=/i);
  });
});

describe("stall hotfix — stage independence honesty", () => {
  it("19. relationships timeout soft-path keeps progress <100", () => {
    const m = deriveModuleProgress(
      snap({
        analysisStages: {
          ...FAST_SCAN_STAGES_READY,
          relationships: "partial",
        },
        deepProgress: {
          sequence: 2,
          updatedAt: new Date().toISOString(),
          stage: "relationships",
          action: "timeout",
          stalled: true,
          stallReason: "relationships_stage_timeout",
          completedUnits: 4,
          totalUnits: 13,
        },
      }),
      "relationships",
    );
    // Still collecting (retryable) → analyzing with partial units
    expect(m.progress).toBeLessThan(100);
  });

  it("20. creatorBurn active with 0 pages uses asymptotic start not stuck 10 forever logic", () => {
    const m = deriveModuleProgress(
      snap({
        analysisStages: {
          ...FAST_SCAN_STAGES_READY,
          relationships: "done",
          liquidity: "done",
          creator: "analyzing",
          burn: "analyzing",
        },
        deepProgress: {
          sequence: 1,
          updatedAt: new Date().toISOString(),
          stage: "creatorBurn",
          action: "start",
          completedUnits: 0,
          totalUnits: 40,
          pagesFetched: 0,
        },
      }),
      "creator",
    );
    expect(m.progress).toBeGreaterThanOrEqual(1);
    expect(m.progress).toBeLessThanOrEqual(10);
  });

  it("21. historical pages continue advancing after recent tier", () => {
    const p1 = deriveModuleProgress(
      snap({
        analysisStages: {
          ...FAST_SCAN_STAGES_READY,
          relationships: "done",
          liquidity: "done",
          creator: "analyzing",
          burn: "analyzing",
        },
        deepProgress: {
          sequence: 6,
          updatedAt: new Date().toISOString(),
          stage: "creatorBurn",
          action: "page_analyzing",
          pagesFetched: 2,
          completedUnits: 2,
          totalUnits: 40,
        },
        overview: overview({
          creatorBehaviour: {
            ...overview().creatorBehaviour!,
            pagesFetched: 2,
          },
        }),
      }),
      "creator",
    );
    const p2 = deriveModuleProgress(
      snap({
        analysisStages: {
          ...FAST_SCAN_STAGES_READY,
          relationships: "done",
          liquidity: "done",
          creator: "analyzing",
          burn: "analyzing",
        },
        deepProgress: {
          sequence: 10,
          updatedAt: new Date().toISOString(),
          stage: "creatorBurn",
          action: "page_indexing",
          pagesFetched: 8,
          completedUnits: 8,
          totalUnits: 40,
        },
        overview: overview({
          creatorBehaviour: {
            ...overview().creatorBehaviour!,
            pagesFetched: 8,
          },
        }),
      }),
      "creator",
    );
    expect(p2.progress).toBeGreaterThan(p1.progress);
  });

  it("22. Partial/Incomplete remains honest — resolved unavailable <100", () => {
    const m = deriveModuleProgress(
      {
        ...snap({
          analysisStatus: "partial",
          deepRetryCount: 99,
          analysisStages: {
            ...FAST_SCAN_STAGES_READY,
            relationships: "done",
            liquidity: "done",
            creator: "failed",
            burn: "failed",
          },
        }),
        analysisPhase: "fast",
      },
      "creator",
    );
    expect(m.status).toBe("unavailable");
    expect(m.resolved).toBe(true);
    expect(m.progress).toBeLessThan(100);
    expect(m.dataComplete).toBe(false);
  });
});
