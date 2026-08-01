import { describe, expect, it, vi } from "vitest";
import {
  DEEP_PARALLEL_DEPENDENCY_GRAPH,
  createDeepStagePublishHub,
  mergeParallelStageWrite,
  runParallelDeepJobs,
} from "@/lib/hansome-score/deep-parallel";
import { FAST_SCAN_STAGES_READY } from "@/lib/hansome-score/scan-fast";
import type { ScanResponse } from "@/lib/hansome-score/types";

function baseSnap(): ScanResponse {
  return {
    analysisStatus: "deep_running",
    analysisPhase: "fast",
    analysisStages: { ...FAST_SCAN_STAGES_READY },
    deepAttemptId: "d_parallel_1",
    deepRetryCount: 0,
    scoreProvisional: true,
    liquidityUsd: 1000,
    overview: {
      address: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
      relationship: { available: false, detail: "pending" },
      lpIntelligence: { poolDetected: false, detail: "pending" },
      creatorBehaviour: { available: false, status: "incomplete" },
      supplyBurn: { burnActivity: { pagesFetched: 0 } },
    },
  } as unknown as ScanResponse;
}

describe("deep-parallel dependency graph", () => {
  it("runs relationships/liquidity/creatorBurn in one wave; score waits", () => {
    expect([...DEEP_PARALLEL_DEPENDENCY_GRAPH.parallelWave]).toEqual([
      "relationships",
      "liquidity",
      "creatorBurn",
    ]);
    expect([...DEEP_PARALLEL_DEPENDENCY_GRAPH.scoreDependsOn]).toEqual([
      "relationships",
      "liquidity",
      "creatorBurn",
    ]);
    expect(DEEP_PARALLEL_DEPENDENCY_GRAPH.sharedTransferIndexJob).toBe(
      "creatorBurn",
    );
  });
});

describe("mergeParallelStageWrite", () => {
  it("does not clobber sibling LP when relationships publishes", () => {
    const prev = baseSnap();
    prev.overview = {
      ...prev.overview,
      lpIntelligence: {
        poolDetected: true,
        knownPositionsVerified: true,
        detail: "quick-lp",
      } as ScanResponse["overview"]["lpIntelligence"],
    };
    const incoming = {
      ...prev,
      overview: {
        ...prev.overview,
        lpIntelligence: {
          poolDetected: false,
          detail: "stale",
        } as ScanResponse["overview"]["lpIntelligence"],
        relationship: {
          available: true,
          detail: "ok",
          sharedFundingCount: 1,
        } as unknown as ScanResponse["overview"]["relationship"],
      },
      analysisStages: {
        ...prev.analysisStages!,
        relationships: "done" as const,
      },
    };
    const merged = mergeParallelStageWrite(prev, incoming, "relationships");
    expect(
      (merged.overview.relationship as { detail?: string } | undefined)?.detail,
    ).toBe("ok");
    expect(merged.overview.lpIntelligence?.detail).toBe("quick-lp");
    expect(merged.analysisStages?.relationships).toBe("done");
  });

  it("never regresses done liquidity to analyzing", () => {
    const prev = baseSnap();
    prev.analysisStages = {
      ...prev.analysisStages!,
      liquidity: "done",
    };
    const incoming = {
      ...prev,
      analysisStages: {
        ...prev.analysisStages!,
        liquidity: "analyzing" as const,
        creator: "done" as const,
        burn: "done" as const,
      },
    };
    const merged = mergeParallelStageWrite(prev, incoming, "creatorBurn");
    expect(merged.analysisStages?.liquidity).toBe("done");
    expect(merged.analysisStages?.creator).toBe("done");
  });

  it("13E.1: partial settle never wipes LOCKED_VERIFIED Known-First LP", () => {
    const prev = baseSnap();
    prev.overview = {
      ...prev.overview,
      lpLockStatus: "locked",
      lpLockDetail: "Known-Pons bootstrap verified",
      lpIntelligence: {
        poolDetected: true,
        positions: [
          {
            positionNftId: "436637",
            lockState: "LOCKED_VERIFIED_ONCHAIN",
            owner: "0x736D76699C26D0d966744cAe304C000d471f7F35",
          },
        ],
        aggregateState: "ALL_LOCKED",
        aggregateLockState: "LOCKED_VERIFIED_ONCHAIN",
        knownPositionsVerified: true,
        detail: "Known-Pons bootstrap",
        discoverySources: ["pons_pre_parallel"],
      } as ScanResponse["overview"]["lpIntelligence"],
    };
    const incoming = {
      ...prev,
      overview: {
        ...prev.overview,
        lpLockStatus: "unknown" as const,
        lpLockDetail:
          "Temporarily unavailable — liquidity did not finish in time.",
        lpIntelligence: {
          poolDetected: true,
          positions: [],
          aggregateState: "UNKNOWN_INCOMPLETE",
          aggregateLockState: "UNABLE_TO_DETERMINE",
          knownPositionsVerified: false,
          detail:
            "Temporarily unavailable — liquidity did not finish in time.",
        } as unknown as ScanResponse["overview"]["lpIntelligence"],
      },
      analysisStages: {
        ...prev.analysisStages!,
        liquidity: "partial" as const,
        relationships: "partial" as const,
      },
    };
    const merged = mergeParallelStageWrite(prev, incoming, "partial");
    expect(
      merged.overview.lpIntelligence?.positions?.some(
        (p) => p.positionNftId === "436637",
      ),
    ).toBe(true);
    expect(merged.overview.lpIntelligence?.positions?.[0]?.lockState).toBe(
      "LOCKED_VERIFIED_ONCHAIN",
    );
  });
});

describe("createDeepStagePublishHub", () => {
  it("serializes concurrent publishes without losing fields", async () => {
    let current = baseSnap();
    const hub = createDeepStagePublishHub({
      get: () => current,
      set: (n) => {
        current = n;
      },
    });

    await Promise.all([
      hub.publish(
        (prev) => ({
          ...prev,
          analysisStages: {
            ...prev.analysisStages!,
            relationships: "done",
          },
          overview: {
            ...prev.overview,
            relationship: {
              available: true,
              detail: "rel-done",
            } as unknown as ScanResponse["overview"]["relationship"],
          },
        }),
        "relationships:done",
        1,
        { stage: "relationships", action: "done" },
      ),
      hub.publish(
        (prev) => ({
          ...prev,
          analysisStages: {
            ...prev.analysisStages!,
            liquidity: "done",
          },
          overview: {
            ...prev.overview,
            lpIntelligence: {
              poolDetected: true,
              detail: "liq-done",
            } as ScanResponse["overview"]["lpIntelligence"],
          },
        }),
        "liquidity:done",
        2,
        { stage: "liquidity", action: "done" },
      ),
    ]);

    expect(current.analysisStages?.relationships).toBe("done");
    expect(current.analysisStages?.liquidity).toBe("done");
    expect(
      (current.overview.relationship as { detail?: string } | undefined)?.detail,
    ).toBe("rel-done");
    expect(current.overview.lpIntelligence?.detail).toBe("liq-done");
    expect(current.deepProgress?.sequence).toBeGreaterThanOrEqual(2);
  });
});

describe("runParallelDeepJobs", () => {
  it("runs independent jobs concurrently and skips completed", async () => {
    const order: string[] = [];
    const delays = { relationships: 30, liquidity: 5, creatorBurn: 15 };
    await runParallelDeepJobs([
      {
        id: "relationships",
        skip: false,
        run: async () => {
          await new Promise((r) => setTimeout(r, delays.relationships));
          order.push("relationships");
        },
      },
      {
        id: "liquidity",
        skip: false,
        run: async () => {
          await new Promise((r) => setTimeout(r, delays.liquidity));
          order.push("liquidity");
        },
      },
      {
        id: "creatorBurn",
        skip: true,
        run: async () => {
          order.push("creatorBurn");
        },
      },
    ]);
    expect(order).toContain("liquidity");
    expect(order).toContain("relationships");
    expect(order).not.toContain("creatorBurn");
    // Liquidity (5ms) finishes before relationships (30ms) → overlap proven.
    expect(order.indexOf("liquidity")).toBeLessThan(order.indexOf("relationships"));
  });

  it("surfaces non-soft failures from any job", async () => {
    await expect(
      runParallelDeepJobs([
        {
          id: "relationships",
          skip: false,
          run: async () => {
            /* ok */
          },
        },
        {
          id: "liquidity",
          skip: false,
          run: async () => {
            throw new Error("fatal_rpc");
          },
        },
        {
          id: "creatorBurn",
          skip: false,
          run: async () => {
            /* ok */
          },
        },
      ]),
    ).rejects.toThrow("fatal_rpc");
  });

  it("reports settled callbacks for partial success", async () => {
    const settled: Array<{ id: string; ok: boolean }> = [];
    await runParallelDeepJobs(
      [
        {
          id: "relationships",
          skip: false,
          run: async () => {
            /* ok */
          },
        },
        {
          id: "liquidity",
          skip: false,
          run: async () => {
            /* ok */
          },
        },
        {
          id: "creatorBurn",
          skip: true,
          run: async () => {
            throw new Error("should not run");
          },
        },
      ],
      {
        onJobSettled: (id, ok) => settled.push({ id, ok }),
      },
    );
    expect(settled).toEqual([
      { id: "relationships", ok: true },
      { id: "liquidity", ok: true },
    ]);
  });
});

describe("enrichScanDeep parallel orchestration", () => {
  it("overlaps liquidity with creatorBurn (liquidity finishes while transfers pending)", async () => {
    const detectLp = vi.fn();
    const fetchTransfersPaged = vi.fn();
    const fetchNativeFunder = vi.fn().mockResolvedValue(null);
    const fetchEarlyTransfers = vi.fn().mockResolvedValue([]);
    const fetchGecko = vi.fn().mockResolvedValue({
      volume24hUsd: null,
      transactions24h: null,
      liquidityUsd: 16_000,
      tokenPriceUsd: 1,
      quotePriceUsd: 3000,
      source: "gecko",
    });
    const fetchEthUsd = vi.fn().mockResolvedValue(3000);

    vi.resetModules();
    // Keep parallel-wave timing deterministic: do not await live Known-Titan RPC.
    vi.doMock("@/lib/hansome-score/lp/known-bootstrap-resolver", async () => {
      const actual = await vi.importActual<
        typeof import("@/lib/hansome-score/lp/known-bootstrap-resolver")
      >("@/lib/hansome-score/lp/known-bootstrap-resolver");
      return {
        ...actual,
        tryVerifyKnownTitanBootstrap: async () => null,
        tryVerifyKnownPonsBootstrap: async () => null,
        tryVerifyKnownHookBootstrap: async () => null,
        staticKnownBootstrapSeeds: (token: string) => ({
          ...actual.staticKnownBootstrapSeeds(token),
          completeness: {
            ...actual.staticKnownBootstrapSeeds(token).completeness,
            knownTitan: false,
            knownPons: false,
            knownHook: false,
          },
        }),
      };
    });
    vi.doMock("@/lib/hansome-score/lp/multi", () => ({
      detectMultiVersionLpIntelligence: (...args: unknown[]) => detectLp(...args),
    }));
    vi.doMock("@/lib/hansome-score/lp/discovery-checkpoint", () => ({
      scheduleLpExhaustiveBackground: () => {},
      loadLpDiscoveryCheckpoint: async () => null,
    }));
    vi.doMock("@/lib/hansome-score/lp/position-value", () => ({
      attachPositionUsdValues: (positions: unknown[]) => positions,
      computeEconomicLockDistribution: () => ({
        available: true,
        lockedUsd: 4600,
        unlockedUsd: 11400,
        lockedPctOfPool: 28.9,
        unlockedPctOfPool: 71.1,
        reconciled: true,
        reason: null,
      }),
    }));
    vi.doMock("@/lib/hansome-score/blockscout", () => ({
      fetchNativeFunder: (...args: unknown[]) => fetchNativeFunder(...args),
      fetchEarlyTokenTransfers: (...args: unknown[]) => fetchEarlyTransfers(...args),
    }));
    vi.doMock("@/lib/hansome-score/transfer-index", () => ({
      fetchTokenTransfersWithCheckpoint: (...args: unknown[]) =>
        fetchTransfersPaged(...args),
      loadEarlyTransfersFromIndex: async () => null,
      loadTransferIndexProgress: async () => ({
        pagesFetched: 0,
        transfersIndexed: 0,
        paginationComplete: false,
        nextPageParams: null,
        generation: null,
        indexState: null,
        reuseStatus: null,
        meta: null,
      }),
      scheduleTransferIndexBackgroundRefresh: () => {},
      peekTransferIndexValidation: async () => ({
        status: "rebuilding",
        meta: null,
        reusable: false,
        needsBackgroundRefresh: true,
        needsHeadRefresh: false,
        needsResume: false,
        needsRebuild: true,
        reason: "missing",
        ageMs: null,
      }),
    }));
    vi.doMock("@/lib/hansome-score/scan", () => ({
      fetchOptionalGeckoActivity: (...args: unknown[]) => fetchGecko(...args),
    }));
    vi.doMock("@/lib/market/eth-usd", () => ({
      fetchEthUsd: (...args: unknown[]) => fetchEthUsd(...args),
    }));
    vi.doMock("@/lib/hansome-score/creator", () => ({
      analyzeCreatorBehaviour: () => ({
        available: true,
        status: "complete",
        detail: "ok",
        dumpDetected: false,
        transferThenSellDetected: false,
        pagesFetched: 1,
        transfersIndexed: 10,
      }),
    }));
    vi.doMock("@/lib/hansome-score/supply-burn", () => ({
      enrichSupplyBurnWithHistory: async ({
        supplyBurn,
      }: {
        supplyBurn: ScanResponse["overview"]["supplyBurn"];
      }) => supplyBurn,
    }));
    vi.doMock("@/lib/hansome-score/relationship", () => ({
      buildRelationshipSignals: () => ({
        available: true,
        sharedFundingCount: 0,
        deployerFundedCount: 0,
        sameBlockEarlyBuyCount: 0,
        detail: "ok",
      }),
    }));
    vi.doMock("@/lib/hansome-score/score", () => ({
      computeStructuralScore: () => ({
        score: 77,
        band: "Solid",
        deductions: [],
        notes: [],
      }),
    }));
    vi.doMock("@/lib/hansome-score/overall", () => ({
      computeOverallTokenScore: () => ({
        score: 70,
        band: "Solid",
        dimensions: [],
      }),
    }));
    vi.doMock("@/lib/hansome-score/confidence", () => ({
      computeConfidence: () => ({
        percent: 50,
        band: "Medium",
        dimensions: [],
        weights: {},
        penalties: [],
      }),
    }));
    vi.doMock("@/lib/hansome-score/activity", () => ({
      computeActivity: () => ({
        level: "Low",
        volume24hUsd: null,
        transactions24h: null,
      }),
    }));
    vi.doMock("@/lib/hansome-score/hansome-level", () => ({
      hansomeLevelFromActivity: () => "Observer",
    }));

    detectLp.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return {
        intelligence: {
          poolDetected: true,
          poolsDetectedCount: 1,
          poolId: "0xpool",
          aggregateLockState: "MIXED",
          aggregateLockStateDisplay: "Mixed",
          aggregateState: "MIXED",
          aggregateStateDisplay: "Mixed",
          positionCounts: { locked: 1, unlocked: 2, unknown: 0 },
          lockDistribution: {
            available: true,
            lockedUsd: 4600,
            unlockedUsd: 11400,
            lockedPctOfPool: 28.9,
            unlockedPctOfPool: 71.1,
            reconciled: true,
            reason: null,
          },
          discoveryComplete: false,
          knownPositionsVerified: true,
          exhaustiveDiscoveryComplete: false,
          completenessWarning: null,
          ownershipRiskNote: "",
          sizeWarning: false,
          positions: [{ positionNftId: "47299" }],
          evidenceLevel: "high",
          detail: "Known positions verified",
          uniswapVersions: { v2: "none", v3: "none", v4: "detected" },
        },
        legacyStatus: "mixed",
      };
    });

    let sawLiqDoneWhileCreatorPending = false;
    fetchTransfersPaged.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 80));
      return {
        transfers: [],
        paginationComplete: true,
        fetchFailed: false,
        pagesFetched: 1,
        fetchMode: "rpc",
        rpcPagesThisCall: 1,
        pipelinePhase: "complete",
        historicalContinuationPending: false,
        stats: {
          rpcPagesThisCall: 1,
          resumedPages: 0,
          skippedPages: 0,
          cacheReuse: false,
          checkpointReuse: false,
          recentTierPages: 1,
          historicalPagesThisCall: 0,
        },
      };
    });

    const { enrichScanDeep } = await import("@/lib/hansome-score/scan-deep");
    const { FAST_SCAN_STAGES_READY: ready } = await import(
      "@/lib/hansome-score/scan-fast"
    );

    const result = await enrichScanDeep(
      {
        analysisStatus: "fast_ready",
        analysisPhase: "fast",
        analysisStages: { ...ready },
        deepAttemptId: "d_par_e2e",
        deepRetryCount: 0,
        scoreProvisional: true,
        liquidityUsd: 16_000,
        overview: {
          address: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
          decimals: 18,
          totalSupplyRaw: "1000000000000000000000000",
          poolManagerBalanceRaw: "1000000000000000000000",
          deployer: "0x1111111111111111111111111111111111111111",
          topHolders: [
            {
              address: "0x2222222222222222222222222222222222222222",
              excludedFromConcentration: false,
              balanceRaw: "1",
              percentOfSupply: 1,
            },
          ],
          concentration: { top10AdjustedPct: 10 },
          contractVerified: true,
          contractRisk: { available: true },
          relationship: { available: false },
          creatorBehaviour: { available: false, status: "incomplete" },
          supplyBurn: {
            burnActivity: { pagesFetched: 0, windows: [] },
            supplyReduction: {},
          },
          lpIntelligence: {
            poolDetected: false,
            lockDistribution: { available: false },
          },
          transfersCount: 10,
          holdersCount: 100,
          tokenAgeDays: 30,
        },
        activity: { level: "Low", volume24hUsd: null, transactions24h: null },
        confidence: { percent: 40, band: "Medium", dimensions: [], weights: {}, penalties: [] },
        uiWording: {},
      } as unknown as ScanResponse,
      {
        deadline: Date.now() + 60_000,
        relationshipSampleSize: 1,
        onProgress: async (snap) => {
          // 13E.1 Known-Titan pre-parallel may finish liquidity before transfers
          // start; still require liquidity not gated behind creatorBurn done.
          if (
            snap.analysisStages?.liquidity === "done" &&
            snap.analysisStages?.creator !== "done"
          ) {
            sawLiqDoneWhileCreatorPending = true;
          }
        },
      },
    );

    expect(detectLp).toHaveBeenCalled();
    expect(fetchTransfersPaged).toHaveBeenCalledTimes(1);
    expect(result.analysisStages?.liquidity).toBe("done");
    expect(result.analysisStages?.creator).toBe("done");
    expect(sawLiqDoneWhileCreatorPending).toBe(true);
  });
});
