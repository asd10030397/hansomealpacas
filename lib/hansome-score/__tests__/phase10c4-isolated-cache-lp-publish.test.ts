/**
 * Phase 10C-4 — isolated candidate cache + deterministic LP publish contracts.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  resolveDeploymentScope,
  scanSnapshotKvKey,
  scopedTokenKey,
  setDeploymentScopeForTests,
  LP_RESULT_SCHEMA_VERSION,
} from "@/lib/hansome-score/deployment-scope";
import {
  attachPublishedLp,
  clearLpPublishTestState,
  clearStaleLpEvidence,
  clearedLpIntelligence,
  persistLpPublishedBody,
  publishDeepLpResult,
  readLpContract,
  shouldPublishLpBody,
  useLpPublishTestKv,
  type LpPublishedBody,
  type LpPublishMeta,
} from "@/lib/hansome-score/lp/lp-result-publish";
import {
  lpEvidenceNeedsFullRefresh,
  rearmPartialForDeepRetry,
} from "@/lib/hansome-score/scan-progress";
import type { ScanResponse } from "@/lib/hansome-score/types";

const BEER = "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804";
const PONS = "0x736D76699C26D0d966744cAe304C000d471f7F35";
const CHAIN = 4663;

function lockedIntel() {
  const base = clearedLpIntelligence();
  return {
    ...base,
    poolDetected: true,
    poolsDetectedCount: 1,
    poolId: "0xC71E763a0a258f266d1481295115ea4f291D95ED",
    aggregateLockState: "LOCKED_VERIFIED" as const,
    aggregateState: "ALL_LOCKED" as const,
    discoveryComplete: true,
    knownPositionsVerified: true,
    completenessWarning: null,
    ownershipRiskNote: "PonsLaunchLocker verified",
    evidenceLevel: "on_chain_verified" as const,
    detail: "PonsLaunchLocker verified on-chain",
    lockDistribution: {
      ...base.lockDistribution,
      available: true,
      reason: "on-chain verified lock distribution",
      method: "position_usd",
      lockedPct: 100,
      unlockedPct: 0,
      unknownPct: 0,
    },
    positions: [
      {
        positionNftId: "436637",
        owner: PONS,
        lockerName: "PonsLaunchLocker",
        lockState: "LOCKED_VERIFIED_ONCHAIN" as const,
        liquidity: "36819258015569838458222",
        tickLower: -887200,
        tickUpper: 204200,
        poolId: "0xC71E763a0a258f266d1481295115ea4f291D95ED",
        positionDiscoveryComplete: true,
        lockAnalysisComplete: true,
      },
    ],
  };
}

function baseSnap(over: Partial<ScanResponse> = {}): ScanResponse {
  return {
    version: "test",
    scannedAt: new Date().toISOString(),
    analysisStatus: "partial",
    analysisPhase: "fast",
    deepAttemptId: "d_gen1",
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
    overview: {
      address: BEER,
      chainId: CHAIN,
      name: "BEER",
      symbol: "BEER",
      decimals: 18,
      totalSupplyRaw: null,
      totalSupplyFormatted: null,
      holdersCount: null,
      transfersCount: null,
      deployer: null,
      creationTxHash: null,
      contractVerified: null,
      poolManagerBalanceRaw: null,
      poolManagerBalanceFormatted: null,
      poolId: "0xC71E763a0a258f266d1481295115ea4f291D95ED",
      lpLockStatus: "locked",
      lpLockDetail: "Pons",
      lpIntelligence: lockedIntel(),
      contractRisk: {},
      supplyBurn: {},
      creatorBehaviour: {},
      concentration: {},
      relationships: {},
      labeledHolders: [],
    },
    overall: {},
    score: {},
    structural: {},
    activity: {},
    hansomeLevel: {},
    confidence: {},
    liquidityUsd: 1,
    context: {},
    sources: [],
    disclaimers: [],
    ...over,
  } as ScanResponse;
}

describe("Phase 10C-4 deployment scope isolation", () => {
  beforeEach(() => {
    setDeploymentScopeForTests(null);
    clearLpPublishTestState();
    useLpPublishTestKv(true);
  });
  afterEach(() => {
    setDeploymentScopeForTests(null);
    clearLpPublishTestState();
  });

  it("candidate cannot share Production snapshot key", () => {
    setDeploymentScopeForTests("production");
    const prod = scanSnapshotKvKey(scopedTokenKey("production", CHAIN, BEER));
    setDeploymentScopeForTests("candidate:dpl_testA");
    const cand = scanSnapshotKvKey(
      scopedTokenKey(resolveDeploymentScope(), CHAIN, BEER),
    );
    expect(prod).not.toBe(cand);
    expect(prod).toContain("production");
    expect(cand).toContain("candidate:dpl_testA");
  });

  it("Production cannot read candidate snapshot key", () => {
    const candKey = scopedTokenKey("candidate:dpl_old", CHAIN, BEER);
    const prodKey = scopedTokenKey("production", CHAIN, BEER);
    expect(candKey).not.toBe(prodKey);
    expect(prodKey.startsWith("production:")).toBe(true);
    expect(candKey.startsWith("candidate:")).toBe(true);
  });

  it("old candidate deployment cache key is rejected by scope mismatch", async () => {
    setDeploymentScopeForTests("candidate:dpl_new");
    const body: LpPublishedBody = {
      schemaVersion: LP_RESULT_SCHEMA_VERSION,
      deploymentScope: "candidate:dpl_old",
      lpGeneration: "d_old",
      publishedAt: new Date().toISOString(),
      tokenAddress: BEER.toLowerCase(),
      chainId: CHAIN,
      intelligence: lockedIntel() as never,
      lpLockStatus: "locked",
      lpLockDetail: "x",
      poolId: null,
      liquidityUsd: 1,
    };
    const meta: LpPublishMeta = { ...body };
    const read = readLpContract({
      deploymentScope: "candidate:dpl_new",
      expectedScope: "candidate:dpl_new",
      scanMeta: { ...meta, deploymentScope: "candidate:dpl_new" },
      lpBody: body,
      allowProductionFallback: false,
    });
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.reason).toBe("scope_mismatch");
  });
});

describe("Phase 10C-4 forced LP refresh clears body", () => {
  it("clears positions / lock aggregates / timeout detail", () => {
    const sticky = baseSnap({
      overview: {
        ...baseSnap().overview,
        lpIntelligence: {
          ...lockedIntel(),
          detail:
            "v3: probe budget exceeded (60000ms) — incomplete. Temporarily unavailable — liquidity did not finish in time.",
          aggregateState: "UNKNOWN_INCOMPLETE",
          positions: [{ positionNftId: "1", lockState: "UNABLE_TO_DETERMINE" }],
        } as never,
      } as never,
    });
    expect(lpEvidenceNeedsFullRefresh(sticky)).toBe(true);
    const cleared = clearStaleLpEvidence(sticky);
    expect(cleared.overview.lpIntelligence.positions).toEqual([]);
    expect(cleared.overview.lpIntelligence.detail).toMatch(/LP evidence cleared/);
    expect(cleared.overview.lpIntelligence.lockDistribution.reason).toMatch(
      /cleared for full refresh/,
    );
    expect(cleared.lpPublish).toBeUndefined();
    // Phase 13C: rearm flips liquidity analyzing but does not destroy bodies
    // (transactional clear is beginForceLpRefreshArm / clearStaleLpEvidence).
    const rearmed = rearmPartialForDeepRetry(sticky);
    expect(rearmed.analysisStages?.liquidity).toBe("analyzing");
    expect(rearmed.overview.lpIntelligence.positions?.length).toBeGreaterThan(0);
    expect(rearmed.overview.lpIntelligence.detail).not.toMatch(/LP evidence cleared/);
  });

  it("timeout detail removed after successful refresh clear", () => {
    const sticky = baseSnap();
    sticky.overview.lpIntelligence.detail =
      "liquidity did not finish in time / probe budget exceeded (60000ms)";
    sticky.overview.lpIntelligence.aggregateState = "UNKNOWN_INCOMPLETE";
    const cleared = clearStaleLpEvidence(sticky);
    expect(cleared.overview.lpIntelligence.detail).not.toMatch(
      /did not finish in time|probe budget exceeded/i,
    );
  });
});

describe("Phase 10C-4 publish / read contracts", () => {
  beforeEach(() => {
    setDeploymentScopeForTests("candidate:dpl_pub");
    clearLpPublishTestState();
    useLpPublishTestKv(true);
  });
  afterEach(() => {
    setDeploymentScopeForTests(null);
    clearLpPublishTestState();
  });

  it("stale generation publish rejected", async () => {
    const r = await publishDeepLpResult({
      attemptId: "d_old",
      generation: "d_old",
      deploymentScope: "candidate:dpl_pub",
      tokenAddress: BEER,
      authoritativeGeneration: "d_new",
      intelligence: lockedIntel() as never,
      lpLockStatus: "locked",
      lpLockDetail: null,
      poolId: null,
      liquidityUsd: 1,
      persistLpBody: async () => undefined,
      persistScanAggregate: async () => undefined,
      markLiquidityTerminal: async () => undefined,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("stale_publish_rejected");
      expect(r.partialWrite).toBe(false);
    }
  });

  it("valid current generation publish accepted", async () => {
    const writes: string[] = [];
    const r = await publishDeepLpResult({
      attemptId: "d_cur",
      generation: "d_cur",
      deploymentScope: "candidate:dpl_pub",
      tokenAddress: BEER,
      authoritativeGeneration: "d_cur",
      intelligence: lockedIntel() as never,
      lpLockStatus: "locked",
      lpLockDetail: "Pons",
      poolId: "0xpool",
      liquidityUsd: 2,
      persistLpBody: async () => {
        writes.push("lp");
      },
      persistScanAggregate: async () => {
        writes.push("scan");
      },
      markLiquidityTerminal: async () => {
        writes.push("term");
      },
    });
    expect(r.ok).toBe(true);
    expect(writes).toEqual(["lp", "scan", "term"]);
  });

  it("scan aggregate and LP body generation must match on read", async () => {
    const meta: LpPublishMeta = {
      schemaVersion: LP_RESULT_SCHEMA_VERSION,
      deploymentScope: "candidate:dpl_pub",
      lpGeneration: "d_a",
      publishedAt: new Date().toISOString(),
      tokenAddress: BEER.toLowerCase(),
      chainId: CHAIN,
    };
    const body: LpPublishedBody = {
      ...meta,
      lpGeneration: "d_b",
      intelligence: lockedIntel() as never,
      lpLockStatus: "locked",
      lpLockDetail: null,
      poolId: null,
      liquidityUsd: null,
    };
    const read = readLpContract({
      deploymentScope: "candidate:dpl_pub",
      expectedScope: "candidate:dpl_pub",
      scanMeta: meta,
      lpBody: body,
    });
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.reason).toBe("generation_mismatch");
  });

  it("terminal cannot publish before LP body write; failed second write stays nonterminal", async () => {
    let lp = 0;
    const r = await publishDeepLpResult({
      attemptId: "d_x",
      generation: "d_x",
      deploymentScope: "candidate:dpl_pub",
      tokenAddress: BEER,
      authoritativeGeneration: "d_x",
      intelligence: lockedIntel() as never,
      lpLockStatus: "locked",
      lpLockDetail: null,
      poolId: null,
      liquidityUsd: null,
      maxRetries: 0,
      persistLpBody: async () => {
        lp += 1;
      },
      persistScanAggregate: async () => {
        throw new Error("kv_down");
      },
      markLiquidityTerminal: async () => undefined,
    });
    expect(lp).toBe(1);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.partialWrite).toBe(true);
      expect(r.reason).toBe("scan_aggregate_write_failed");
    }
  });

  it("bounded retry succeeds after transient aggregate failure", async () => {
    let n = 0;
    const r = await publishDeepLpResult({
      attemptId: "d_y",
      generation: "d_y",
      deploymentScope: "candidate:dpl_pub",
      tokenAddress: BEER,
      authoritativeGeneration: "d_y",
      intelligence: lockedIntel() as never,
      lpLockStatus: "locked",
      lpLockDetail: null,
      poolId: null,
      liquidityUsd: null,
      maxRetries: 2,
      persistLpBody: async () => undefined,
      persistScanAggregate: async () => {
        n += 1;
        if (n < 2) throw new Error("transient");
      },
      markLiquidityTerminal: async () => undefined,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.retries).toBeGreaterThanOrEqual(1);
  });

  it("semantic-version mismatch rejected", () => {
    const meta: LpPublishMeta = {
      schemaVersion: 0,
      deploymentScope: "candidate:dpl_pub",
      lpGeneration: "d_a",
      publishedAt: new Date().toISOString(),
      tokenAddress: BEER.toLowerCase(),
      chainId: CHAIN,
    };
    const body: LpPublishedBody = {
      ...meta,
      schemaVersion: 0,
      intelligence: lockedIntel() as never,
      lpLockStatus: "locked",
      lpLockDetail: null,
      poolId: null,
      liquidityUsd: null,
    };
    const read = readLpContract({
      deploymentScope: "candidate:dpl_pub",
      expectedScope: "candidate:dpl_pub",
      scanMeta: meta,
      lpBody: body,
    });
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.reason).toBe("schema_rejected");
  });

  it("candidate must not fall back to Production LP", () => {
    const read = readLpContract({
      deploymentScope: "candidate:dpl_pub",
      expectedScope: "production",
      scanMeta: null,
      lpBody: null,
      allowProductionFallback: false,
    });
    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(
        read.reason === "production_fallback_forbidden" ||
          read.reason === "scope_mismatch",
      ).toBe(true);
    }
  });

  it("final serializer reads current LP generation (attach + round-trip)", async () => {
    const meta: LpPublishMeta = {
      schemaVersion: LP_RESULT_SCHEMA_VERSION,
      deploymentScope: "candidate:dpl_pub",
      lpGeneration: "d_beer",
      publishedAt: new Date().toISOString(),
      tokenAddress: BEER.toLowerCase(),
      chainId: CHAIN,
    };
    const intel = lockedIntel();
    await persistLpPublishedBody({
      ...meta,
      intelligence: intel as never,
      lpLockStatus: "locked",
      lpLockDetail: "Pons",
      poolId: intel.poolId,
      liquidityUsd: 1,
    });
    const snap = attachPublishedLp(baseSnap({ deepAttemptId: "d_beer" }), meta, {
      intelligence: intel as never,
      lpLockStatus: "locked",
      lpLockDetail: "Pons",
      poolId: intel.poolId,
      liquidityUsd: 1,
    });
    const round = JSON.parse(JSON.stringify(snap)) as ScanResponse;
    expect(round.lpPublish?.lpGeneration).toBe("d_beer");
    expect(round.overview.lpIntelligence.positions[0]?.lockState).toBe(
      "LOCKED_VERIFIED_ONCHAIN",
    );
    expect(round.overview.lpIntelligence.positions[0]?.positionNftId).toBe(
      "436637",
    );
    expect(shouldPublishLpBody(snap)).toBe(true);
    expect(shouldPublishLpBody(clearStaleLpEvidence(snap))).toBe(false);
  });

  it("concurrent refresh winner is deterministic by generation fence", async () => {
    const order: string[] = [];
    const winner = publishDeepLpResult({
      attemptId: "d_win",
      generation: "d_win",
      deploymentScope: "candidate:dpl_pub",
      tokenAddress: BEER,
      authoritativeGeneration: "d_win",
      intelligence: lockedIntel() as never,
      lpLockStatus: "locked",
      lpLockDetail: null,
      poolId: null,
      liquidityUsd: null,
      persistLpBody: async () => {
        order.push("win-lp");
      },
      persistScanAggregate: async () => {
        order.push("win-scan");
      },
      markLiquidityTerminal: async () => {
        order.push("win-term");
      },
    });
    const loser = publishDeepLpResult({
      attemptId: "d_lose",
      generation: "d_lose",
      deploymentScope: "candidate:dpl_pub",
      tokenAddress: BEER,
      authoritativeGeneration: "d_win",
      intelligence: lockedIntel() as never,
      lpLockStatus: "locked",
      lpLockDetail: null,
      poolId: null,
      liquidityUsd: null,
      persistLpBody: async () => {
        order.push("lose-lp");
      },
      persistScanAggregate: async () => {
        order.push("lose-scan");
      },
      markLiquidityTerminal: async () => {
        order.push("lose-term");
      },
    });
    const [w, l] = await Promise.all([winner, loser]);
    expect(w.ok).toBe(true);
    expect(l.ok).toBe(false);
    if (!l.ok) expect(l.reason).toBe("stale_publish_rejected");
    expect(order).toContain("win-lp");
    expect(order).not.toContain("lose-lp");
  });
});
