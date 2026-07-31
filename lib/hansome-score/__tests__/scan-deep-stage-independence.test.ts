import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScanResponse } from "@/lib/hansome-score/types";
import { FAST_SCAN_STAGES_READY } from "@/lib/hansome-score/scan-fast";

const detectLp = vi.fn();
const fetchTransfersPaged = vi.fn();
const fetchNativeFunder = vi.fn();
const fetchEarlyTransfers = vi.fn();
const fetchGecko = vi.fn();
const fetchEthUsd = vi.fn();

vi.mock("@/lib/hansome-score/lp/multi", () => ({
  detectMultiVersionLpIntelligence: (...args: unknown[]) => detectLp(...args),
}));

vi.mock("@/lib/hansome-score/lp/discovery-checkpoint", () => ({
  scheduleLpExhaustiveBackground: () => {},
  loadLpDiscoveryCheckpoint: async () => null,
}));

vi.mock("@/lib/hansome-score/lp/position-value", () => ({
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

vi.mock("@/lib/hansome-score/blockscout", () => ({
  fetchNativeFunder: (...args: unknown[]) => fetchNativeFunder(...args),
  fetchEarlyTokenTransfers: (...args: unknown[]) => fetchEarlyTransfers(...args),
}));

vi.mock("@/lib/hansome-score/transfer-index", () => ({
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

vi.mock("@/lib/hansome-score/scan", () => ({
  fetchOptionalGeckoActivity: (...args: unknown[]) => fetchGecko(...args),
}));

vi.mock("@/lib/market/eth-usd", () => ({
  fetchEthUsd: (...args: unknown[]) => fetchEthUsd(...args),
}));

vi.mock("@/lib/hansome-score/creator", () => ({
  analyzeCreatorBehaviour: () => ({
    available: true,
    status: "complete",
    detail: "ok",
    dumpDetected: false,
    transferThenSellDetected: false,
  }),
}));

vi.mock("@/lib/hansome-score/supply-burn", () => ({
  enrichSupplyBurnWithHistory: async ({
    supplyBurn,
  }: {
    supplyBurn: ScanResponse["overview"]["supplyBurn"];
  }) => supplyBurn,
}));

vi.mock("@/lib/hansome-score/relationship", () => ({
  buildRelationshipSignals: () => ({
    available: true,
    sharedFundingCount: 0,
    deployerFundedCount: 0,
    sameBlockEarlyBuyCount: 0,
    detail: "ok",
  }),
}));

vi.mock("@/lib/hansome-score/score", () => ({
  computeStructuralScore: () => ({
    score: 77,
    band: "Solid",
    deductions: [],
    notes: [],
  }),
}));

vi.mock("@/lib/hansome-score/overall", () => ({
  computeOverallTokenScore: () => ({
    score: 51,
    band: "Watch",
    components: {},
  }),
}));

vi.mock("@/lib/hansome-score/confidence", () => ({
  computeConfidence: () => ({ percent: 60, notes: [] }),
}));

vi.mock("@/lib/hansome-score/activity", () => ({
  computeActivity: () => ({
    level: "Low",
    volume24hUsd: null,
    transactions24h: null,
  }),
}));

vi.mock("@/lib/hansome-score/hansome-level", () => ({
  hansomeLevelFromActivity: () => ({
    id: "kinda_hansome",
    label: "KINDA HANSOME",
    emoji: "😐",
    rawLevel: "Low",
  }),
}));

function fastBase(): ScanResponse {
  const now = new Date().toISOString();
  return {
    version: "t",
    scannedAt: now,
    scoreComputedAt: now,
    deepStartedAt: now,
    analysisPhase: "fast",
    analysisStatus: "fast_ready",
    scoreProvisional: true,
    analysisStages: { ...FAST_SCAN_STAGES_READY },
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
      holdersCount: 1,
      transfersCount: 1,
      tokenAgeDays: 30,
      contractVerified: true,
      contractRisk: { available: false },
      relationship: { available: false },
      lpIntelligence: {
        poolDetected: false,
        poolsDetectedCount: 0,
        poolId: null,
        poolManagerBalanceRaw: null,
        poolManagerBalanceFormatted: null,
        aggregateLockState: "UNKNOWN",
        aggregateLockStateDisplay: "Unknown",
        aggregateState: "UNKNOWN_INCOMPLETE",
        aggregateStateDisplay: "Unknown",
        positionCounts: { locked: 0, unlocked: 0, unknown: 0 },
        lockDistribution: {
          available: false,
          reason: "Deep LP analysis pending",
        },
        discoveryComplete: false,
        completenessWarning: null,
        ownershipRiskNote: "",
        sizeWarning: false,
        positions: [],
        evidenceLevel: "low",
        detail: "Deep analysis in progress — Uniswap pending.",
        uniswapVersions: {
          v2: "unsupported",
          v3: "unsupported",
          v4: "pending",
        },
      },
      creatorBehaviour: {
        available: false,
        status: "incomplete",
        detail: "Deep analysis in progress — creator pending.",
        dumpDetected: false,
        transferThenSellDetected: false,
      },
      supplyBurn: {
        burnActivity: {
          windows: [
            {
              window: "24h",
              burnedToDeadRaw: null,
              burnedToDeadFormatted: null,
              completeness: "unknown",
              note: "Deep analysis in progress — burn activity history (P2) pending.",
            },
          ],
        },
        supplyReduction: {
          note: "Deep analysis in progress — supply reduction history (P3) pending.",
        },
      },
    } as unknown as ScanResponse["overview"],
    overall: { score: 51 } as ScanResponse["overall"],
    score: { score: 77 } as ScanResponse["score"],
    structural: { score: 77 } as ScanResponse["score"],
    activity: { level: "Low" } as ScanResponse["activity"],
    hansomeLevel: {
      id: "kinda_hansome",
      label: "KINDA HANSOME",
      emoji: "😐",
      rawLevel: "Low",
    },
    confidence: { percent: 60 } as ScanResponse["confidence"],
    liquidityUsd: 16_000,
    context: {} as ScanResponse["context"],
    sources: [],
    disclaimers: [],
    uiWording: {
      overallSubtitle: "",
      scoreSubtitle: "",
      structuralSubtitle: "",
      confidenceNote: "",
    },
  };
}

describe("enrichScanDeep stage independence", () => {
  beforeEach(() => {
    vi.resetModules();
    detectLp.mockReset();
    fetchTransfersPaged.mockReset();
    fetchNativeFunder.mockReset();
    fetchEarlyTransfers.mockReset();
    fetchGecko.mockReset();
    fetchEthUsd.mockReset();

    fetchNativeFunder.mockResolvedValue(null);
    fetchEarlyTransfers.mockResolvedValue([]);
    fetchGecko.mockResolvedValue({
      volume24hUsd: null,
      transactions24h: null,
      liquidityUsd: 16_000,
      tokenPriceUsd: 1,
      quotePriceUsd: 3000,
      source: "gecko",
    });
    fetchEthUsd.mockResolvedValue(3000);

    detectLp.mockImplementation(async (opts: {
      onKnownPositions?: (partial: {
        intelligence: ScanResponse["overview"]["lpIntelligence"];
        legacyStatus: string;
      }) => Promise<void>;
    }) => {
      const intelligence = {
        poolDetected: true,
        poolsDetectedCount: 1,
        poolId: "0xpool",
        poolManagerBalanceRaw: "1",
        poolManagerBalanceFormatted: "1",
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
        positions: [
          { positionNftId: "47299" },
          { positionNftId: "357867" },
          { positionNftId: "142938" },
        ],
        evidenceLevel: "high",
        detail: "Known positions verified",
        uniswapVersions: { v2: "none", v3: "none", v4: "detected" },
      } as unknown as ScanResponse["overview"]["lpIntelligence"];
      if (opts.onKnownPositions) {
        await opts.onKnownPositions({
          intelligence,
          legacyStatus: "mixed",
        });
      }
      return { intelligence, legacyStatus: "mixed" };
    });
  });

  it("runs liquidity / known-first even when creatorBurn times out", async () => {
    const { enrichScanDeep, DeepScanTimeoutError } = await import(
      "@/lib/hansome-score/scan-deep"
    );
    fetchTransfersPaged.mockRejectedValue(
      new DeepScanTimeoutError("Deep stage timeout: creatorBurn"),
    );

    const progress: string[] = [];
    const result = await enrichScanDeep(fastBase(), {
      deadline: Date.now() + 60_000,
      onProgress: async (snap) => {
        progress.push(
          `liq=${snap.analysisStages?.liquidity};creator=${snap.analysisStages?.creator};status=${snap.analysisStatus}`,
        );
      },
    });

    expect(detectLp).toHaveBeenCalledTimes(1);
    expect(result.overview.lpIntelligence.lockDistribution.available).toBe(true);
    expect(result.overview.lpIntelligence.knownPositionsVerified).toBe(true);
    expect(
      result.overview.lpIntelligence.positions.map((p) => p.positionNftId),
    ).toEqual(["47299", "357867", "142938"]);
    expect(result.analysisStages?.liquidity).toBe("done");
    expect(result.analysisStages?.creator).toBe("partial");
    expect(result.analysisStages?.burn).toBe("partial");
    expect(result.analysisStatus).toBe("partial");
    // Liquidity published before creatorBurn soft-fail finalized.
    expect(progress.some((p) => p.includes("liq=done"))).toBe(true);
  });

  it("does not early-return after relationships timeout — liquidity still runs", async () => {
    const { enrichScanDeep, DeepScanTimeoutError } = await import(
      "@/lib/hansome-score/scan-deep"
    );
    fetchNativeFunder.mockRejectedValue(
      new DeepScanTimeoutError("Deep stage timeout: relationships"),
    );
    fetchTransfersPaged.mockResolvedValue({
      transfers: [],
      paginationComplete: true,
      fetchFailed: false,
      pagesFetched: 1,
      fetchMode: "reuse_hit",
      rpcPagesThisCall: 0,
      pipelinePhase: "complete",
      historicalContinuationPending: false,
      stats: {
        rpcPagesThisCall: 0,
        resumedPages: 0,
        skippedPages: 1,
        cacheReuse: true,
        checkpointReuse: true,
        recentTierPages: 0,
        historicalPagesThisCall: 0,
      },
    });

    const result = await enrichScanDeep(fastBase(), {
      deadline: Date.now() + 60_000,
      relationshipSampleSize: 1,
    });

    expect(detectLp).toHaveBeenCalledTimes(1);
    expect(result.analysisStages?.relationships).toBe("partial");
    expect(result.analysisStages?.liquidity).toBe("done");
    expect(result.overview.lpIntelligence.lockDistribution.available).toBe(true);
  });

  it("resume does not regress done relationships to analyzing (same generation)", async () => {
    const { enrichScanDeep } = await import("@/lib/hansome-score/scan-deep");
    fetchTransfersPaged.mockResolvedValue({
      transfers: [],
      paginationComplete: true,
      fetchFailed: false,
      pagesFetched: 1,
      fetchMode: "reuse_hit",
      rpcPagesThisCall: 0,
      pipelinePhase: "complete",
      historicalContinuationPending: false,
      stats: {
        rpcPagesThisCall: 0,
        resumedPages: 0,
        skippedPages: 1,
        cacheReuse: true,
        checkpointReuse: true,
        recentTierPages: 0,
        historicalPagesThisCall: 0,
      },
    });

    const base = fastBase();
    base.analysisStatus = "deep_running";
    base.deepAttemptId = "d_resume_same_gen";
    base.analysisStages = {
      ...FAST_SCAN_STAGES_READY,
      relationships: "done",
      liquidity: "analyzing",
      creator: "analyzing",
      burn: "analyzing",
      score: "analyzing",
    };
    base.overview = {
      ...base.overview,
      relationship: {
        ...(base.overview.relationship as object),
        available: true,
        detail: "preserved",
      },
    } as unknown as ScanResponse["overview"];

    const relStates: string[] = [];
    const result = await enrichScanDeep(base, {
      deadline: Date.now() + 60_000,
      onProgress: async (snap) => {
        relStates.push(String(snap.analysisStages?.relationships));
      },
    });

    expect(fetchNativeFunder).not.toHaveBeenCalled();
    expect(fetchEarlyTransfers).not.toHaveBeenCalled();
    expect(relStates.every((s) => s === "done")).toBe(true);
    expect(result.analysisStages?.relationships).toBe("done");
    expect(
      (result.overview.relationship as { detail?: string } | undefined)?.detail,
    ).toBe("preserved");
    expect(result.analysisStages?.liquidity).toBe("done");
  });
});
