import { describe, expect, it } from "vitest";
import {
  ANALYSIS_MODULE_KEYS,
  applyMonotonicProgress,
  calculateOverallWorkflowProgress,
  coarseStageProgress,
  DEFAULT_TRANSFER_PAGE_TARGET,
  deriveAnalysisProgress,
  deriveModuleProgress,
  MODULE_WEIGHTS,
  shouldAcceptProgressUpdate,
  type AnalysisModuleProgress,
  type AnalysisWorkflowProgress,
} from "@/lib/hansome-score/analysis-progress";
import { FAST_SCAN_STAGES_READY } from "@/lib/hansome-score/scan-fast";
import { MAX_DEEP_AUTO_RETRIES } from "@/lib/hansome-score/scan-progress";
import type {
  AnalysisStages,
  ConfidenceResult,
  ScanResponse,
} from "@/lib/hansome-score/types";

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

function minimalOverview(
  partial: Partial<ScanResponse["overview"]> = {},
): ScanResponse["overview"] {
  const base = {
    address: "0x0000000000000000000000000000000000000001",
    chainId: 1,
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
    poolManagerBalanceRaw: null,
    poolManagerBalanceFormatted: null,
    poolId: null,
    lpLockStatus: "unknown",
    lpLockDetail: null,
    lpIntelligence: {
      poolDetected: false,
      poolsDetectedCount: 0,
      poolId: null,
      poolManagerBalanceRaw: null,
      poolManagerBalanceFormatted: null,
      aggregateLockState: "UNABLE_TO_DETERMINE",
      aggregateLockStateDisplay: "UNABLE TO DETERMINE",
      aggregateState: "UNKNOWN_INCOMPLETE",
      aggregateStateDisplay: "UNKNOWN / INCOMPLETE",
      positionCounts: {
        detected: 0,
        material: 0,
        locked: 0,
        unlocked: 0,
        unknown: 0,
      },
      lockDistribution: {
        available: false,
        lockedPct: null,
        unlockedPct: null,
        unknownPct: null,
        lockedUsd: null,
        unlockedUsd: null,
        unknownUsd: null,
        totalPositionUsd: null,
        poolLiquidityUsd: null,
        reconciledWithPool: false,
        method: null,
        reason: null,
      },
      discoveryComplete: false,
      completenessWarning: null,
      ownershipRiskNote: "",
      sizeWarning: false,
      positions: [],
      evidenceLevel: "unavailable",
      detail: "",
      uniswapVersions: {
        versionsDetected: [],
        coverageComplete: false,
        incompleteReason: null,
        byVersion: {
          v2: { searched: false, poolsFound: 0 },
          v3: { searched: false, poolsFound: 0 },
          v4: { searched: false, poolsFound: 0 },
        },
        protocolSupportNote: "",
        lockerSupportNote: "",
      },
    },
    contractRisk: {
      status: "analyzed",
      mintable: false,
      honeypot: false,
      buyTaxBps: 0,
      sellTaxBps: 0,
      transferTaxBps: 0,
      modifiableTax: false,
      pausable: false,
      blacklistOrWhitelist: false,
      isProxy: false,
      hasOwnerAdmin: false,
      privilegedBurn: false,
      findings: [],
      goplusSupplement: null,
      detail: "ok",
    },
    supplyBurn: {
      totalSupplyRaw: "1000",
      totalSupplyFormatted: "1000",
      knownBurnedSupplyRaw: null,
      knownBurnedSupplyFormatted: null,
      burnedPctOfTotalSupply: null,
      effectiveRemainingSupplyRaw: "1000",
      effectiveRemainingSupplyFormatted: "1000",
      effectiveRemainingMethod: "current_total_supply_only",
      burnMechanism: "unknown",
      burnFunction: "unknown",
      automaticBurn: "unknown",
      privilegedBurn: "unknown",
      holderBurnCallable: "unknown",
      burnFromPresent: "unknown",
      supplyReductionVerified: "unknown",
      deadAddressBalances: [],
      burnActivity: {
        lastBurnAt: null,
        burnTransactionCount: null,
        windows: [],
        headIndexed: false,
        pagesFetched: 0,
        transfersIndexed: 0,
        paginationComplete: false,
        fetchFailed: false,
        source: "none",
      },
      supplyReduction: {
        provenSupplyReductionRaw: null,
        provenSupplyReductionFormatted: null,
        historicalReductionStatus: "unknown",
        provenBurnEventCount: null,
        note: "",
      },
      findings: [],
      dataCompletenessNotes: [],
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
    concentration: {
      top1AdjustedPct: 0,
      top10AdjustedPct: 0,
      top10RawPct: 0,
      exclusions: [],
    },
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
    tokenAgeDays: 1,
    topHolders: [],
  };
  return {
    ...base,
    ...partial,
    lpIntelligence: {
      ...base.lpIntelligence,
      ...(partial.lpIntelligence ?? {}),
    },
    creatorBehaviour: {
      ...base.creatorBehaviour,
      ...(partial.creatorBehaviour ?? {}),
    },
    supplyBurn: {
      ...base.supplyBurn,
      ...(partial.supplyBurn ?? {}),
      burnActivity: {
        ...base.supplyBurn.burnActivity,
        ...(partial.supplyBurn?.burnActivity ?? {}),
      },
    },
  } as ScanResponse["overview"];
}

function snap(
  partial: Partial<ScanResponse> & {
    analysisStages?: AnalysisStages;
  } = {},
): Pick<
  ScanResponse,
  | "analysisStages"
  | "analysisStatus"
  | "analysisPhase"
  | "deepRetryCount"
  | "scoreProvisional"
  | "overview"
  | "deepAttemptId"
  | "confidence"
> {
  return {
    analysisPhase: "fast",
    analysisStatus: "deep_running",
    analysisStages: { ...FAST_SCAN_STAGES_READY },
    deepRetryCount: 0,
    scoreProvisional: true,
    deepAttemptId: "d_test_1",
    overview: minimalOverview(),
    confidence: emptyConfidence(42),
    ...partial,
  };
}

describe("analysis-progress stage mapping", () => {
  it("maps coarse stages without fabricating 100%", () => {
    expect(
      coarseStageProgress("pending", { hasEvidence: false, collecting: true }),
    ).toBe(5);
    expect(
      coarseStageProgress("analyzing", { hasEvidence: false, collecting: true }),
    ).toBe(10);
    expect(
      coarseStageProgress("analyzing", { hasEvidence: true, collecting: true }),
    ).toBe(25);
    expect(
      coarseStageProgress("partial", {
        hasEvidence: true,
        meaningfulPartial: true,
        collecting: true,
      }),
    ).toBe(60);
    expect(coarseStageProgress("done", { hasEvidence: true, collecting: false })).toBe(
      100,
    );
  });

  it("weights sum to 100 and include all architecture modules", () => {
    const sum = ANALYSIS_MODULE_KEYS.reduce((n, k) => n + MODULE_WEIGHTS[k], 0);
    expect(sum).toBe(100);
    expect(ANALYSIS_MODULE_KEYS).toEqual([
      "structural",
      "holders",
      "liquidity",
      "burn",
      "creator",
      "relationships",
    ]);
  });
});

describe("deriveModuleProgress", () => {
  it("marks Fast contract/holders done at 100%", () => {
    const s = snap();
    expect(deriveModuleProgress(s, "structural").progress).toBe(100);
    expect(deriveModuleProgress(s, "structural").status).toBe("done");
    expect(deriveModuleProgress(s, "holders").dataComplete).toBe(true);
  });

  it("keeps burn collecting (not unavailable) while Deep running with Fast partial", () => {
    // Phase 6 parallel: burn is not force-queued behind relationships; still <100 / not unavailable.
    const parallel = deriveModuleProgress(snap(), "burn");
    expect(parallel.status).not.toBe("unavailable");
    expect(parallel.resolved).toBe(false);
    expect(parallel.progress).toBeLessThan(100);

    const m = deriveModuleProgress(
      snap({
        analysisStages: {
          ...FAST_SCAN_STAGES_READY,
          relationships: "done",
          liquidity: "done",
          burn: "partial",
          creator: "analyzing",
        },
        deepProgress: {
          sequence: 2,
          updatedAt: new Date().toISOString(),
          stage: "creatorBurn",
          action: "start",
        },
      }),
      "burn",
    );
    expect(m.status).toBe("analyzing");
    expect(m.resolved).toBe(false);
    expect(m.progress).toBeGreaterThanOrEqual(10);
    expect(m.progress).toBeLessThan(100);
  });

  it("advances creator from real pagesFetched vs target", () => {
    const early = deriveModuleProgress(
      snap({
        overview: minimalOverview({
          creatorBehaviour: {
            ...minimalOverview().creatorBehaviour,
            pagesFetched: 4,
            transfersIndexed: 40,
          },
        }),
        analysisStages: {
          ...FAST_SCAN_STAGES_READY,
          relationships: "done",
          liquidity: "done",
          creator: "analyzing",
          burn: "analyzing",
        },
        deepProgress: {
          sequence: 3,
          updatedAt: new Date().toISOString(),
          stage: "creatorBurn",
          action: "page",
          pagesFetched: 4,
        },
      }),
      "creator",
    );
    expect(early.completedUnits).toBe(4);
    expect(early.totalUnits).toBe(DEFAULT_TRANSFER_PAGE_TARGET);
    expect(early.progress).toBeGreaterThan(25);
    expect(early.progress).toBeLessThan(100);

    const done = deriveModuleProgress(
      snap({
        analysisStages: {
          ...FAST_SCAN_STAGES_READY,
          creator: "done",
        },
      }),
      "creator",
    );
    expect(done.progress).toBe(100);
    expect(done.status).toBe("done");
  });

  it("done becomes 100%", () => {
    const m = deriveModuleProgress(
      snap({
        analysisStages: {
          ...FAST_SCAN_STAGES_READY,
          liquidity: "done",
          burn: "done",
          creator: "done",
          relationships: "done",
          score: "done",
        },
        analysisStatus: "complete",
        analysisPhase: "complete",
        scoreProvisional: false,
      }),
      "liquidity",
    );
    expect(m.progress).toBe(100);
    expect(m.resolved).toBe(true);
  });

  it("retry retains progress (does not reset)", () => {
    const prior: AnalysisModuleProgress = {
      key: "liquidity",
      status: "analyzing",
      progress: 61,
      messageKey: "progressCollectingLiquidity",
      resolved: false,
      dataComplete: false,
    };
    const retrying = deriveModuleProgress(
      snap({
        analysisStatus: "partial",
        deepRetryCount: 1,
        analysisStages: {
          ...FAST_SCAN_STAGES_READY,
          relationships: "done",
          liquidity: "partial",
        },
        deepProgress: {
          sequence: 4,
          updatedAt: new Date().toISOString(),
          stage: "liquidity",
          action: "retry",
          completedUnits: 2,
          totalUnits: 3,
        },
      }),
      "liquidity",
      prior,
    );
    expect(retrying.status).toBe("retrying");
    expect(retrying.progress).toBeGreaterThanOrEqual(61);
  });

  it("exhausted unavailable does not claim 100% without evidence", () => {
    const m = deriveModuleProgress(
      snap({
        analysisStatus: "partial",
        deepRetryCount: MAX_DEEP_AUTO_RETRIES,
        analysisStages: {
          ...FAST_SCAN_STAGES_READY,
          liquidity: "partial",
          burn: "partial",
          creator: "failed",
          relationships: "done",
        },
      }),
      "creator",
    );
    expect(m.status).toBe("unavailable");
    expect(m.resolved).toBe(true);
    expect(m.dataComplete).toBe(false);
    expect(m.progress).toBeLessThan(100);
  });

  it("never shows fake 100% before completion", () => {
    const m = deriveModuleProgress(
      snap({
        analysisStages: {
          ...FAST_SCAN_STAGES_READY,
          relationships: "done",
          liquidity: "analyzing",
        },
        deepProgress: {
          sequence: 2,
          updatedAt: new Date().toISOString(),
          stage: "liquidity",
          action: "known_positions",
        },
        overview: minimalOverview({
          lpIntelligence: {
            ...minimalOverview().lpIntelligence,
            poolDetected: true,
            poolsDetectedCount: 2,
            knownPositionsVerified: true,
            discoveryComplete: true,
            exhaustiveDiscoveryComplete: true,
            positionCounts: {
              detected: 4,
              material: 2,
              locked: 1,
              unlocked: 1,
              unknown: 0,
            },
          },
        }),
      }),
      "liquidity",
    );
    expect(m.progress).toBeLessThan(100);
  });
});

describe("weighted overall + coverage separation", () => {
  it("computes weighted overall and caps below 100 until resolved", () => {
    const modules: AnalysisModuleProgress[] = ANALYSIS_MODULE_KEYS.map(
      (key) => ({
        key,
        status: key === "structural" || key === "holders" ? "done" : "analyzing",
        progress: key === "structural" || key === "holders" ? 100 : 10,
        messageKey: "progressCollecting",
        resolved: key === "structural" || key === "holders",
        dataComplete: key === "structural" || key === "holders",
      }),
    );
    const overall = calculateOverallWorkflowProgress(modules);
    expect(overall).toBeLessThan(100);
    expect(overall).toBeGreaterThan(0);
  });

  it("reaches 100% only when all modules are workflow-resolved", () => {
    const modules: AnalysisModuleProgress[] = ANALYSIS_MODULE_KEYS.map(
      (key) => ({
        key,
        status: key === "creator" ? "unavailable" : "done",
        progress: key === "creator" ? 40 : 100,
        messageKey:
          key === "creator" ? "progressUnavailable" : "progressComplete",
        resolved: true,
        dataComplete: key !== "creator",
      }),
    );
    expect(calculateOverallWorkflowProgress(modules)).toBe(100);
  });

  it("keeps progress separate from analysis coverage", () => {
    const workflow = deriveAnalysisProgress(
      snap({
        confidence: emptyConfidence(88),
      }),
    );
    expect(workflow.analysisCoveragePercent).toBe(88);
    expect(workflow.overallProgress).not.toBe(88);
    expect(workflow.overallProgress).toBeLessThan(100);
  });

  it("unavailable does not falsely increase coverage", () => {
    const workflow = deriveAnalysisProgress(
      snap({
        analysisStatus: "partial",
        deepRetryCount: MAX_DEEP_AUTO_RETRIES,
        confidence: emptyConfidence(35),
        analysisStages: {
          ...FAST_SCAN_STAGES_READY,
          liquidity: "partial",
          burn: "partial",
          creator: "failed",
          relationships: "done",
          score: "partial",
        },
      }),
    );
    const creator = workflow.modules.find((m) => m.key === "creator")!;
    expect(creator.status).toBe("unavailable");
    expect(creator.dataComplete).toBe(false);
    expect(workflow.analysisCoveragePercent).toBe(35);
    expect(workflow.analysisCoveragePercent).not.toBe(workflow.overallProgress);
  });
});

describe("monotonic + stale generation", () => {
  it("applyMonotonicProgress never decreases within same deepAttemptId", () => {
    const a = deriveAnalysisProgress(snap({ deepAttemptId: "d1" }));
    const bumped: AnalysisWorkflowProgress = {
      ...a,
      modules: a.modules.map((m) =>
        m.key === "creator" ? { ...m, progress: 70 } : m,
      ),
      overallProgress: 55,
    };
    const lower = deriveAnalysisProgress(
      snap({
        deepAttemptId: "d1",
        overview: minimalOverview({
          creatorBehaviour: {
            ...minimalOverview().creatorBehaviour,
            pagesFetched: 1,
          },
        }),
      }),
      bumped,
    );
    const mono = applyMonotonicProgress(bumped, lower);
    const creator = mono.modules.find((m) => m.key === "creator")!;
    expect(creator.progress).toBeGreaterThanOrEqual(70);
    expect(mono.overallProgress).toBeGreaterThanOrEqual(55);
  });

  it("allows reset when deepAttemptId changes (manual refresh)", () => {
    const prior = deriveAnalysisProgress(snap({ deepAttemptId: "old" }));
    const priorHigh: AnalysisWorkflowProgress = {
      ...prior,
      overallProgress: 90,
      modules: prior.modules.map((m) => ({ ...m, progress: 90 })),
    };
    const fresh = deriveAnalysisProgress(snap({ deepAttemptId: "new" }));
    const next = applyMonotonicProgress(priorHigh, fresh);
    expect(next.deepAttemptId).toBe("new");
    expect(next.overallProgress).toBeLessThan(90);
  });

  it("shouldAcceptProgressUpdate rejects stale lower progress from other attempt while collecting", () => {
    const current = deriveAnalysisProgress(snap({ deepAttemptId: "current" }));
    const currentHigh: AnalysisWorkflowProgress = {
      ...current,
      overallProgress: 70,
      workflowStatus: "collecting",
    };
    const stale = {
      ...deriveAnalysisProgress(snap({ deepAttemptId: "stale" })),
      overallProgress: 20,
    };
    expect(shouldAcceptProgressUpdate(currentHigh, stale)).toBe(false);
  });

  it("partial cached scan renders collecting workflow", () => {
    const workflow = deriveAnalysisProgress(
      snap({
        analysisStatus: "partial",
        deepRetryCount: 1,
      }),
    );
    expect(workflow.workflowStatus).toBe("retrying");
    expect(workflow.modules.some((m) => m.status === "analyzing" || m.status === "retrying")).toBe(
      true,
    );
  });

  it("completed cached scan renders complete", () => {
    const workflow = deriveAnalysisProgress(
      snap({
        analysisStatus: "complete",
        analysisPhase: "complete",
        scoreProvisional: false,
        analysisStages: {
          contract: "done",
          holders: "done",
          market: "done",
          burn: "done",
          liquidity: "done",
          creator: "done",
          relationships: "done",
          score: "done",
        },
      }),
    );
    expect(workflow.workflowStatus).toBe("complete");
    expect(workflow.overallProgress).toBe(100);
    expect(workflow.completedModules).toBe(6);
  });
});
