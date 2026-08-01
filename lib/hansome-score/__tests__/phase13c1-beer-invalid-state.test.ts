/**
 * Phase 13C.1 — BEER invalid-state regressions.
 * Proves: analyzing + deepInflightLocal + lease=none + !retryScheduled is orphan;
 * lp_read_rearm schedules or terminalizes; diagnostics distinguish local vs lease;
 * destructive clears stay inside force-LP recovery txn.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  beginDeepLease,
  isOrphanAnalyzing,
  recoverOrphanAnalyzing,
  stampDeepRuntime,
  toDeepRuntimeDiagnostics,
  withRegisteredDeepJob,
} from "@/lib/hansome-score/deep-runtime";
import {
  armForceLpClearedAggregate,
  clearForceLpRecoveryTestState,
  isClearedLpShell,
  prepareForceLpRefresh,
  useForceLpRecoveryTestKv,
} from "@/lib/hansome-score/lp/force-lp-recovery";
import {
  clearLpPublishTestState,
  clearStaleLpEvidence,
  persistLpPublishedBody,
  shouldPublishLpBody,
  useLpPublishTestKv,
  type LpPublishedBody,
} from "@/lib/hansome-score/lp/lp-result-publish";
import { FAST_SCAN_STAGES_READY } from "@/lib/hansome-score/scan-fast";
import { MAX_DEEP_AUTO_RETRIES } from "@/lib/hansome-score/scan-progress";
import { setDeploymentScopeForTests } from "@/lib/hansome-score/deployment-scope";
import type { ScanResponse } from "@/lib/hansome-score/types";

const SCOPE = "candidate:dpl_phase13c1_beer";
const BEER = "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804";

function beerInvalidMid(): ScanResponse {
  // Shape from reports/data/phase13c_beer_mid_status.json
  return {
    version: "1.3.0-overall",
    scannedAt: "2026-07-31T22:50:50.704Z",
    analysisStatus: "partial",
    analysisPhase: "fast",
    scoreProvisional: true,
    deepAttemptId: "d_ms9jek8x_39ae3zaa",
    deepRetryCount: 1,
    deepStartedAt: "2026-07-31T22:50:50.896Z",
    analysisStages: {
      ...FAST_SCAN_STAGES_READY,
      burn: "partial",
      liquidity: "analyzing",
      creator: "partial",
      relationships: "partial",
      score: "analyzing",
    },
    deepRuntime: {
      retryRequired: true,
      retryScheduled: false,
      lastTransition: "lp_read_rearm",
      lastErrorCode: "missing_scan_meta",
      fenceResult: "none",
    },
    overview: {
      address: BEER,
      chainId: 4663,
      lpIntelligence: {
        poolDetected: false,
        poolsDetectedCount: 0,
        positions: [],
        detail: "LP evidence cleared — awaiting fresh multi-version discovery.",
        lockDistribution: {
          available: false,
          reason: "LP evidence cleared for full refresh",
        },
        aggregateState: "UNKNOWN_INCOMPLETE",
      },
    },
    liquidityUsd: 7108,
  } as unknown as ScanResponse;
}

function beerBody(gen = "d_prior_beer"): LpPublishedBody {
  return {
    schemaVersion: 1,
    deploymentScope: SCOPE,
    lpGeneration: gen,
    publishedAt: new Date().toISOString(),
    tokenAddress: BEER.toLowerCase(),
    chainId: 4663,
    intelligence: {
      poolDetected: true,
      poolsDetectedCount: 1,
      positions: [
        {
          lockState: "LOCKED_VERIFIED_ONCHAIN",
          positionNftId: "436637",
          owner: "0x736D76699C26D0d966744cAe304C000d471f7F35",
        },
      ],
      aggregateState: "LOCKED",
      aggregateLockState: "LOCKED_VERIFIED_ONCHAIN",
      detail: "Pons Locked verified",
      discoveryComplete: true,
      lockDistribution: { available: true, reason: "pons", method: "pons" },
    } as never,
    lpLockStatus: "locked",
    lpLockDetail: "Pons",
    poolId: "0xpool",
    liquidityUsd: 1_000_000,
  };
}

afterEach(() => {
  setDeploymentScopeForTests(null);
  clearForceLpRecoveryTestState();
  clearLpPublishTestState();
});

describe("Phase 13C.1 BEER invalid-state", () => {
  it("1. analyzing + deepInflightLocal + lease=none + !retryScheduled is orphan", () => {
    const mid = beerInvalidMid();
    expect(
      isOrphanAnalyzing({ response: mid, deepInflight: true }),
    ).toBe(true);
    expect(
      isOrphanAnalyzing({ response: mid, deepInflight: false }),
    ).toBe(true);
  });

  it("2. orphan recovery with local inflight still rearm or terminalizes", () => {
    const mid = beerInvalidMid();
    const out = recoverOrphanAnalyzing(mid, { deepInflight: true });
    expect(out.orphan).toBe(true);
    expect(out.shouldRetry).toBe(true);
    expect(out.response.deepRuntime?.retryScheduled).toBe(true);
    expect(
      isOrphanAnalyzing({
        response: out.response,
        deepInflight: true,
      }),
    ).toBe(false);
  });

  it("3. valid durable lease is not orphan even without local inflight", () => {
    const leased = withRegisteredDeepJob(
      beerInvalidMid(),
    );
    expect(leased.deepRuntime?.lease).toBeTruthy();
    expect(
      isOrphanAnalyzing({ response: leased, deepInflight: false }),
    ).toBe(false);
  });

  it("4. lp_read_rearm shape with retryScheduled=true is not orphan", () => {
    const fixed = stampDeepRuntime(beerInvalidMid(), {
      lease: undefined,
      retryRequired: true,
      retryScheduled: true,
      lastTransition: "lp_read_rearm",
      lastErrorCode: "missing_scan_meta",
    });
    expect(
      isOrphanAnalyzing({ response: fixed, deepInflight: false }),
    ).toBe(false);
    expect(fixed.deepRuntime?.retryScheduled).toBe(true);
  });

  it("5. diagnostics distinguish deepInflightLocal from deepLeaseOwned", () => {
    const mid = beerInvalidMid();
    const diagLocal = toDeepRuntimeDiagnostics(mid, Date.now(), {
      deepInflightLocal: true,
    });
    expect(diagLocal.deepLeaseState).toBe("none");
    expect(diagLocal.deepLeaseOwned).toBe(false);
    expect(diagLocal.deepInflightLocal).toBe(true);

    const leased = withRegisteredDeepJob(beerInvalidMid());
    const diagLease = toDeepRuntimeDiagnostics(leased, Date.now(), {
      deepInflightLocal: false,
    });
    expect(diagLease.deepLeaseState).toBe("valid");
    expect(diagLease.deepLeaseOwned).toBe(true);
    expect(diagLease.deepInflightLocal).toBe(false);
  });

  it("6. expired lease + retryScheduled=false is orphan regardless of inflight", () => {
    const snap = stampDeepRuntime(beerInvalidMid(), {
      lease: beginDeepLease({
        generation: "d_old",
        attempt: 1,
        now: Date.now() - 200_000,
      }),
      retryScheduled: false,
      lastTransition: "stale",
    });
    expect(
      isOrphanAnalyzing({ response: snap, deepInflight: true }),
    ).toBe(true);
  });

  it("7. retry exhaustion terminalizes — no sticky analyzing", () => {
    const exhausted = {
      ...beerInvalidMid(),
      deepRetryCount: MAX_DEEP_AUTO_RETRIES,
    };
    const out = recoverOrphanAnalyzing(exhausted, { deepInflight: true });
    expect(out.orphan).toBe(true);
    expect(out.shouldRetry).toBe(false);
    expect(out.response.analysisStages?.liquidity).not.toBe("analyzing");
    expect(out.response.analysisStages?.liquidity).not.toBe("pending");
  });

  it("8. shouldPublishLpBody rejects cleared shell (no sticky publish)", () => {
    const cleared = clearStaleLpEvidence(beerInvalidMid());
    expect(isClearedLpShell(cleared.overview.lpIntelligence)).toBe(true);
    expect(shouldPublishLpBody(cleared)).toBe(false);
  });

  it("9. destructive clear allowed only via force recovery txn arm", async () => {
    useForceLpRecoveryTestKv(true);
    useLpPublishTestKv(true);
    setDeploymentScopeForTests(SCOPE);
    const body = beerBody();
    await persistLpPublishedBody(body);
    const prior = {
      ...beerInvalidMid(),
      analysisStages: {
        ...FAST_SCAN_STAGES_READY,
        liquidity: "done",
        score: "done",
      },
      analysisStatus: "complete" as const,
      deepAttemptId: "d_prior_beer",
      overview: {
        address: BEER,
        chainId: 4663,
        lpIntelligence: body.intelligence,
        lpLockStatus: body.lpLockStatus,
        lpLockDetail: body.lpLockDetail,
        poolId: body.poolId,
      },
      lpPublish: {
        schemaVersion: 1 as const,
        deploymentScope: SCOPE,
        lpGeneration: body.lpGeneration,
        publishedAt: body.publishedAt,
        tokenAddress: body.tokenAddress,
        chainId: body.chainId,
      },
      liquidityUsd: body.liquidityUsd,
    } as ScanResponse;
    const prep = await prepareForceLpRefresh({
      response: prior,
      pendingGeneration: "d_force_new",
    });
    expect(prep.meta.durablePrior).toBe(true);
    expect(prep.meta.state).toBe("open");
    const armed = armForceLpClearedAggregate(prior, prep.meta);
    expect(isClearedLpShell(armed.overview.lpIntelligence)).toBe(true);
    expect(armed.lpForceRecovery?.state).toBe("open");
    expect(armed.lpForceRecovery?.durablePrior).toBe(true);
  });

  it("10. invalid mid-state must not remain uncleared without metadata after recover", () => {
    const mid = beerInvalidMid();
    expect(isClearedLpShell(mid.overview.lpIntelligence)).toBe(true);
    const out = recoverOrphanAnalyzing(mid, { deepInflight: true });
    // Retry path keeps shell but stamps retryScheduled + transition metadata.
    if (out.shouldRetry) {
      expect(out.response.deepRuntime?.retryScheduled).toBe(true);
      expect(out.response.deepRuntime?.lastTransition).toBeTruthy();
      expect(out.response.deepRuntime?.lastErrorCode).toBe("orphan_analyzing");
    } else {
      expect(out.response.analysisStages?.liquidity).not.toBe("analyzing");
    }
  });
});
