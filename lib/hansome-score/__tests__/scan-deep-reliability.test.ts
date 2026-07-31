import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DEEP_SCAN_MAX_EXECUTION_MS,
  DEEP_STALE_THRESHOLD_MS,
  isDeepStale,
  markScanPartial,
} from "@/lib/hansome-score/scan-deep";
import {
  FAST_SCAN_STAGES_READY,
  isDeepInProgress,
  isScanComplete,
} from "@/lib/hansome-score/scan-fast";
import { assertValidTokenAddress } from "@/lib/hansome-score/scan";
import type { ScanResponse } from "@/lib/hansome-score/types";

function stub(partial: Partial<ScanResponse>): ScanResponse {
  return {
    version: "t",
    scannedAt: new Date().toISOString(),
    overview: {
      address: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
      lpIntelligence: {
        lockDistribution: {
          available: false,
          reason: "Deep LP analysis pending",
        },
        detail: "Deep analysis in progress — Uniswap pending.",
      },
      creatorBehaviour: {
        available: false,
        status: "incomplete",
        detail: "Deep analysis in progress — creator pending.",
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
    } as ScanResponse["overview"],
    overall: { score: 1 } as ScanResponse["overall"],
    score: { score: 1 } as ScanResponse["score"],
    structural: { score: 1 } as ScanResponse["score"],
    activity: { level: "Low" } as ScanResponse["activity"],
    hansomeLevel: {
      id: "kinda_hansome",
      label: "KINDA HANSOME",
      emoji: "😐",
      rawLevel: "Low",
    },
    confidence: { percent: 1 } as ScanResponse["confidence"],
    liquidityUsd: null,
    context: {} as ScanResponse["context"],
    sources: [],
    disclaimers: [],
    uiWording: {
      overallSubtitle: "",
      scoreSubtitle: "",
      structuralSubtitle: "",
      confidenceNote: "",
    },
    ...partial,
  };
}

describe("Deep Scan reliability helpers", () => {
  it("exposes max execution and stale thresholds", () => {
    expect(DEEP_SCAN_MAX_EXECUTION_MS).toBe(270_000);
    expect(DEEP_STALE_THRESHOLD_MS).toBe(360_000);
    expect(DEEP_STALE_THRESHOLD_MS).toBeGreaterThan(DEEP_SCAN_MAX_EXECUTION_MS);
  });

  it("markScanPartial clears analyzing stages and keeps Fast body", () => {
    const base = stub({
      analysisPhase: "fast",
      analysisStatus: "deep_running",
      scoreProvisional: true,
      analysisStages: { ...FAST_SCAN_STAGES_READY },
      overall: { score: 51 } as ScanResponse["overall"],
    });
    const partial = markScanPartial(base);
    expect(partial.analysisStatus).toBe("partial");
    expect(partial.analysisPhase).toBe("fast");
    expect(partial.scoreProvisional).toBe(true);
    expect(partial.overall.score).toBe(51);
    expect(partial.analysisStages?.liquidity).toBe("partial");
    expect(partial.analysisStages?.creator).toBe("partial");
    expect(partial.analysisStages?.relationships).toBe("partial");
    expect(partial.analysisStages?.contract).toBe("done");
    expect(isScanComplete(partial)).toBe(false);
    expect(isDeepInProgress(partial)).toBe(false);
    expect(partial.overview.lpIntelligence.lockDistribution.reason).toMatch(
      /Temporarily unavailable/i,
    );
  });

  it("isDeepStale when deep_running exceeds threshold", () => {
    const started = new Date(
      Date.now() - DEEP_STALE_THRESHOLD_MS - 1_000,
    ).toISOString();
    expect(
      isDeepStale(
        stub({
          analysisStatus: "deep_running",
          analysisPhase: "fast",
          deepStartedAt: started,
        }),
      ),
    ).toBe(true);
    expect(
      isDeepStale(
        stub({
          analysisStatus: "deep_running",
          analysisPhase: "fast",
          deepStartedAt: new Date().toISOString(),
        }),
      ),
    ).toBe(false);
    expect(
      isDeepStale(
        stub({
          analysisStatus: "partial",
          deepStartedAt: started,
        }),
      ),
    ).toBe(false);
  });

  it("assertValidTokenAddress rejects invalid CA", () => {
    expect(() => assertValidTokenAddress("not-an-address")).toThrow(
      /Invalid token address/i,
    );
    expect(() => assertValidTokenAddress("0x1234")).toThrow(
      /Invalid token address/i,
    );
  });

  it("assertSupportedTokenPresent distinguishes EOA / non-token from RPC outage", async () => {
    const { assertSupportedTokenPresent, ScanRequestError } = await import(
      "@/lib/hansome-score/scan-errors"
    );
    const emptyRpc = {
      name: null,
      symbol: null,
      decimals: null,
      totalSupply: null,
      poolManagerBalance: null,
      deployerBalance: null,
    };

    expect(() =>
      assertSupportedTokenPresent({
        bytecode: "0x",
        rpc: emptyRpc,
        bsToken: null,
      }),
    ).toThrow(ScanRequestError);

    expect(() =>
      assertSupportedTokenPresent({
        bytecode: "0x6000",
        rpc: emptyRpc,
        bsToken: null,
      }),
    ).toThrow(/no supported token contract/i);

    // RPC bytecode failure → do not classify as token_not_found
    expect(() =>
      assertSupportedTokenPresent({
        bytecode: null,
        rpc: emptyRpc,
        bsToken: null,
      }),
    ).not.toThrow();

    expect(() =>
      assertSupportedTokenPresent({
        bytecode: "0x6000",
        rpc: { ...emptyRpc, decimals: 18, symbol: "T" },
        bsToken: null,
      }),
    ).not.toThrow();
  });
});

describe("scan-cache stale recovery + invalid CA", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("getCachedScan throws Invalid token address for bad CA", async () => {
    const { getCachedScan } = await import("@/lib/hansome-score/scan-cache");
    await expect(getCachedScan("not-a-valid-ca")).rejects.toThrow(
      /Invalid token address/i,
    );
  });

  it("recoverStaleDeepIfNeeded marks zombie deep_running as partial", async () => {
    vi.doMock("@/lib/hansome-score/scan-deep", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("@/lib/hansome-score/scan-deep")>();
      return {
        ...actual,
        // Hang so recovery can observe a zombie deep_running snapshot
        enrichScanDeep: vi.fn(
          () => new Promise<ScanResponse>(() => undefined),
        ),
      };
    });
    vi.doMock("@/lib/hansome-score/scan", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("@/lib/hansome-score/scan")>();
      return {
        ...actual,
        scanToken: vi.fn(async () => {
          throw new Error("should not run during recovery");
        }),
        fetchOptionalGeckoActivity: vi.fn(async () => ({
          volume24hUsd: null,
          transactions24h: null,
          liquidityUsd: null,
          tokenPriceUsd: null,
          quotePriceUsd: null,
          source: null,
        })),
      };
    });
    vi.doMock("@/lib/hansome-score/scan-fast", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("@/lib/hansome-score/scan-fast")>();
      return {
        ...actual,
        scanTokenFast: vi.fn(async (address: string) => {
          const now = new Date().toISOString();
          return {
            version: "test-fast",
            scannedAt: now,
            scoreComputedAt: now,
            activityUpdatedAt: now,
            deepStartedAt: now,
            analysisPhase: "fast",
            analysisStatus: "deep_running",
            scoreProvisional: true,
            analysisStages: { ...actual.FAST_SCAN_STAGES_READY },
            overview: {
              address,
              chainId: 4663,
              transfersCount: 10,
              topHolders: [],
              concentration: { top10AdjustedPct: 0 },
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
              deployer: null,
              decimals: 18,
              totalSupplyRaw: null,
              poolManagerBalanceRaw: null,
              contractVerified: true,
              holdersCount: 1,
              tokenAgeDays: 10,
              contractRisk: { findings: [] },
              lpIntelligence: {
                aggregateLockState: "UNABLE_TO_DETERMINE",
                sizeWarning: false,
                lockDistribution: {
                  available: false,
                  reason: "Deep LP analysis pending",
                },
                detail: "Deep analysis in progress",
                positions: [],
              },
              creatorBehaviour: {
                available: false,
                dumpDetected: false,
                transferThenSellDetected: false,
                status: "incomplete",
                detail: "pending",
              },
              supplyBurn: {
                burnFunction: "no",
                automaticBurn: "no",
                privilegedBurn: "no",
                burnActivity: {
                  windows: [],
                  lastBurnAt: null,
                  burnTransactionCount: null,
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
                  note: "pending",
                },
              },
            },
            overall: { score: 40 },
            score: { score: 70 },
            structural: { score: 70 },
            activity: {
              level: "Low",
              volume24hUsd: 10,
              transactions24h: 1,
            },
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

    const { getCachedScan, recoverStaleDeepIfNeeded, peekScanSnapshot } =
      await import("@/lib/hansome-score/scan-cache");
    const addr = "0xcccccccccccccccccccccccccccccccccccccccc";

    const fast = await getCachedScan(addr);
    expect(fast.analysisStatus).toBe("deep_running");
    expect(fast.overall.score).toBe(40);

    // Not stale yet
    expect(await recoverStaleDeepIfNeeded(addr)).toBeNull();

    // Age past threshold → recover to partial, preserve Fast scores
    const recovered = await recoverStaleDeepIfNeeded(
      addr,
      Date.now() + DEEP_STALE_THRESHOLD_MS + 5_000,
    );
    expect(recovered).not.toBeNull();
    expect(recovered!.analysisStatus).toBe("partial");
    expect(recovered!.overall.score).toBe(40);
    expect(recovered!.analysisStages?.liquidity).toBe("partial");
    expect(recovered!.deepRetryCount).toBe(1);
    expect(isDeepInProgress(recovered!)).toBe(false);

    const peeked = await peekScanSnapshot(addr);
    expect(peeked?.analysisStatus).toBe("partial");
    expect(peeked?.deepRetryCount).toBe(1);
  });
});

describe("/api/scan error status mapping", () => {
  it("maps invalid address and token_not_found to 400/404", async () => {
    const {
      httpStatusForScanError,
      scanErrorJson,
      ScanRequestError,
    } = await import("@/lib/hansome-score/scan-errors");

    expect(httpStatusForScanError(new Error("Invalid token address"))).toBe(400);
    expect(httpStatusForScanError(new Error('Address "0xzz" is invalid.'))).toBe(
      400,
    );
    expect(
      httpStatusForScanError(
        new Error(
          "No supported token contract was found at this address on Robinhood Chain.",
        ),
      ),
    ).toBe(404);
    expect(httpStatusForScanError(new Error("Failed to scan token"))).toBe(500);
    expect(
      httpStatusForScanError(new ScanRequestError("invalid_address")),
    ).toBe(400);
    expect(
      httpStatusForScanError(new ScanRequestError("token_not_found")),
    ).toBe(404);
    expect(scanErrorJson(new ScanRequestError("invalid_address"))).toEqual({
      error: "Invalid token address",
      code: "invalid_address",
    });
    expect(scanErrorJson(new ScanRequestError("token_not_found"))).toEqual({
      error:
        "No supported token contract was found at this address on Robinhood Chain.",
      code: "token_not_found",
    });
  });
});
