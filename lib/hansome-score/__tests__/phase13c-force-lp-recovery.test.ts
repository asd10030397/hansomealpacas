/**
 * Phase 13C — Force LP refresh recovery contract (16 scenarios + invariants A|B|C).
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  armForceLpClearedAggregate,
  attachRefreshingPriorLp,
  bodyFromScanResponse,
  clearForceLpRecoveryTestState,
  commitForceLpRefresh,
  evaluateForceLpEndInvariants,
  FORCE_LP_DEDUP_MS,
  FORCE_LP_TOKEN_CONTRACTS,
  FORCE_LP_TXN_TTL_MS,
  isClearedLpShell,
  isDurableLpEvidence,
  isForceTxnExpired,
  loadLpRecoverySlot,
  loadPriorLpForForceDeep,
  prepareForceLpRefresh,
  rollbackForceLpRefresh,
  shouldDedupeForceLp,
  useForceLpRecoveryTestKv,
} from "@/lib/hansome-score/lp/force-lp-recovery";
import {
  clearLpPublishTestState,
  clearStaleLpEvidence,
  persistLpPublishedBody,
  useLpPublishTestKv,
  type LpPublishedBody,
} from "@/lib/hansome-score/lp/lp-result-publish";
import { beginLpTerminal, markLpTerminalRunning } from "@/lib/hansome-score/lp/lp-terminal-contract";
import { setDeploymentScopeForTests } from "@/lib/hansome-score/deployment-scope";
import type { ScanResponse } from "@/lib/hansome-score/types";

const SCOPE = "candidate:dpl_phase13c_test";
const BEER = FORCE_LP_TOKEN_CONTRACTS.BEER.address;
const HANSOME = FORCE_LP_TOKEN_CONTRACTS.HANSOME.address;
const GME = FORCE_LP_TOKEN_CONTRACTS.GME.address;
const OKC = FORCE_LP_TOKEN_CONTRACTS.OKC.address;

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

function hansomeBody(gen = "d_prior_hansome"): LpPublishedBody {
  return {
    schemaVersion: 1,
    deploymentScope: SCOPE,
    lpGeneration: gen,
    publishedAt: new Date().toISOString(),
    tokenAddress: HANSOME.toLowerCase(),
    chainId: 4663,
    intelligence: {
      poolDetected: true,
      poolsDetectedCount: 2,
      positions: [
        { lockState: "UNKNOWN", positionNftId: "1", ownershipClass: "posm_nft" },
        { lockState: "UNKNOWN", positionNftId: "2", ownershipClass: "posm_nft" },
      ],
      ownershipClass: "posm_nft",
      detail: "Titan/POSM positions",
      lockDistribution: { available: false, reason: "mixed", method: null },
    } as never,
    lpLockStatus: "unknown",
    lpLockDetail: null,
    poolId: "0xhansome",
    liquidityUsd: 500_000,
  };
}

function gmeBody(gen = "d_prior_gme"): LpPublishedBody {
  return {
    schemaVersion: 1,
    deploymentScope: SCOPE,
    lpGeneration: gen,
    publishedAt: new Date().toISOString(),
    tokenAddress: GME.toLowerCase(),
    chainId: 4663,
    intelligence: {
      poolDetected: true,
      poolsDetectedCount: 1,
      positions: [{ lockState: "UNKNOWN", positionNftId: "hook-1" }],
      ownershipClass: "hook_native",
      hookIntelligence: { status: "indexed", class: "hook_native" },
      detail: "Hook native LP",
      lockDistribution: { available: false, reason: "hook", method: null },
    } as never,
    lpLockStatus: "unknown",
    lpLockDetail: null,
    poolId: "0xgme",
    liquidityUsd: 200_000,
  };
}

function withBody(addr: string, body: LpPublishedBody): ScanResponse {
  return {
    version: "1.3.0-overall",
    scannedAt: new Date().toISOString(),
    analysisStatus: "partial",
    analysisPhase: "fast",
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
    deepAttemptId: body.lpGeneration,
    deepRetryCount: 0,
    lpPublish: {
      schemaVersion: body.schemaVersion,
      deploymentScope: body.deploymentScope,
      lpGeneration: body.lpGeneration,
      publishedAt: body.publishedAt,
      tokenAddress: body.tokenAddress,
      chainId: body.chainId,
    },
    overview: {
      address: addr,
      chainId: 4663,
      lpLockStatus: body.lpLockStatus,
      lpLockDetail: body.lpLockDetail,
      poolId: body.poolId,
      lpIntelligence: body.intelligence,
    },
    liquidityUsd: body.liquidityUsd,
  } as unknown as ScanResponse;
}

afterEach(() => {
  clearForceLpRecoveryTestState();
  clearLpPublishTestState();
  setDeploymentScopeForTests(null);
});

describe("Phase 13C force LP recovery (16)", () => {
  it("1. prepare stashes durable prior into recovery slot", async () => {
    useForceLpRecoveryTestKv(true);
    useLpPublishTestKv(true);
    setDeploymentScopeForTests(SCOPE);
    const body = beerBody();
    await persistLpPublishedBody(body);
    const prior = withBody(BEER, body);
    const prep = await prepareForceLpRefresh({
      response: prior,
      pendingGeneration: "d_pending_1",
    });
    expect(prep.preserved).toBe(true);
    expect(prep.mayDeleteActiveBody).toBe(false);
    expect(prep.meta.durablePrior).toBe(true);
    const slot = await loadLpRecoverySlot(SCOPE, BEER);
    expect(slot?.body.intelligence.positions?.[0]?.positionNftId).toBe("436637");
  });

  it("2. prepare does not treat cleared shell as durable", async () => {
    useForceLpRecoveryTestKv(true);
    setDeploymentScopeForTests(SCOPE);
    const cleared = clearStaleLpEvidence(withBody(BEER, beerBody()));
    const prep = await prepareForceLpRefresh({
      response: cleared,
      pendingGeneration: "d_pending_2",
    });
    expect(prep.preserved).toBe(false);
    expect(prep.mayDeleteActiveBody).toBe(true);
    expect(isClearedLpShell(cleared.overview.lpIntelligence)).toBe(true);
  });

  it("3. commit drops recovery slot and marks committed", async () => {
    useForceLpRecoveryTestKv(true);
    useLpPublishTestKv(true);
    setDeploymentScopeForTests(SCOPE);
    const body = beerBody();
    await persistLpPublishedBody(body);
    const prior = withBody(BEER, body);
    await prepareForceLpRefresh({
      response: prior,
      pendingGeneration: "d_pending_3",
    });
    const armed = armForceLpClearedAggregate(prior, {
      state: "open",
      priorGeneration: body.lpGeneration,
      pendingGeneration: "d_pending_3",
      reason: "force_refresh_started",
      savedAt: new Date().toISOString(),
      durablePrior: true,
    });
    const newBody = beerBody("d_new_gen");
    await persistLpPublishedBody(newBody);
    const published = {
      ...armed,
      lpPublish: {
        schemaVersion: 1,
        deploymentScope: SCOPE,
        lpGeneration: "d_new_gen",
        publishedAt: new Date().toISOString(),
        tokenAddress: BEER.toLowerCase(),
        chainId: 4663,
      },
      overview: {
        ...armed.overview,
        lpIntelligence: newBody.intelligence,
      },
    } as ScanResponse;
    const committed = await commitForceLpRefresh({
      scope: SCOPE,
      tokenAddress: BEER,
      response: published,
    });
    expect(committed.lpForceRecovery?.state).toBe("committed");
    expect(await loadLpRecoverySlot(SCOPE, BEER)).toBeNull();
  });

  it("4. rollback restores LOCKED_VERIFIED as stale_forced_refresh", async () => {
    useForceLpRecoveryTestKv(true);
    useLpPublishTestKv(true);
    setDeploymentScopeForTests(SCOPE);
    const body = beerBody();
    await persistLpPublishedBody(body);
    const prior = withBody(BEER, body);
    await prepareForceLpRefresh({
      response: prior,
      pendingGeneration: "d_pending_4",
    });
    const cleared = armForceLpClearedAggregate(prior, {
      state: "open",
      priorGeneration: body.lpGeneration,
      pendingGeneration: "d_pending_4",
      reason: "force_refresh_started",
      savedAt: new Date().toISOString(),
      durablePrior: true,
    });
    // Simulate failed force deleting active body.
    const { deleteLpPublishedBody } = await import(
      "@/lib/hansome-score/lp/lp-result-publish"
    );
    await deleteLpPublishedBody(SCOPE, BEER, 4663);
    const restored = await rollbackForceLpRefresh({ response: cleared, scope: SCOPE });
    expect(restored.lpForceRecovery?.reason).toBe("stale_forced_refresh");
    expect(
      restored.overview.lpIntelligence?.positions?.some(
        (p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN",
      ),
    ).toBe(true);
    expect(restored.overview.lpIntelligence?.positions?.[0]?.positionNftId).toBe(
      "436637",
    );
  });

  it("5. fence-style failure path restores prior via rollback", async () => {
    useForceLpRecoveryTestKv(true);
    useLpPublishTestKv(true);
    setDeploymentScopeForTests(SCOPE);
    const body = beerBody();
    await persistLpPublishedBody(body);
    const prior = withBody(BEER, body);
    const prep = await prepareForceLpRefresh({
      response: prior,
      pendingGeneration: "d_pend_fence",
    });
    const cleared = armForceLpClearedAggregate(prior, prep.meta);
    const restored = await rollbackForceLpRefresh({ response: cleared, scope: SCOPE });
    expect(isDurableLpEvidence(restored)).toBe(true);
    expect(restored.lpPublish?.lpGeneration).toBe(body.lpGeneration);
  });

  it("6. attachRefreshingPriorLp keeps analyzing honesty mid-force", () => {
    const body = beerBody();
    const prior = withBody(BEER, body);
    const cleared = clearStaleLpEvidence(prior);
    const mid = {
      ...cleared,
      analysisStages: { ...cleared.analysisStages!, liquidity: "analyzing" as const },
      lpForceRecovery: {
        state: "open" as const,
        priorGeneration: body.lpGeneration,
        pendingGeneration: "d_mid",
        reason: "force_refresh_started" as const,
        savedAt: new Date().toISOString(),
        durablePrior: true,
      },
    };
    const attached = attachRefreshingPriorLp(mid, body);
    expect(attached.analysisStages?.liquidity).toBe("analyzing");
    expect(attached.overview.lpIntelligence?.positions?.length).toBeGreaterThan(0);
  });

  it("7. concurrent force within dedup window reuses open txn", async () => {
    useForceLpRecoveryTestKv(true);
    useLpPublishTestKv(true);
    setDeploymentScopeForTests(SCOPE);
    const body = beerBody();
    await persistLpPublishedBody(body);
    const prior = withBody(BEER, body);
    const prep1 = await prepareForceLpRefresh({
      response: prior,
      pendingGeneration: "d_a",
    });
    const open = {
      ...prior,
      lpForceRecovery: prep1.meta,
    };
    expect(shouldDedupeForceLp(open)).toBe(true);
    const prep2 = await prepareForceLpRefresh({
      response: open,
      pendingGeneration: "d_b",
    });
    expect(prep2.meta.pendingGeneration).toBe(prep1.meta.pendingGeneration);
    expect(FORCE_LP_DEDUP_MS).toBeGreaterThan(0);
  });

  it("8. force txn expiry detected by TTL", () => {
    const expired = {
      state: "open" as const,
      priorGeneration: "d_old",
      pendingGeneration: "d_pend",
      reason: "force_refresh_started" as const,
      savedAt: new Date(Date.now() - FORCE_LP_TXN_TTL_MS - 1000).toISOString(),
      durablePrior: true,
    };
    expect(isForceTxnExpired(expired)).toBe(true);
    const fresh = { ...expired, savedAt: new Date().toISOString() };
    expect(isForceTxnExpired(fresh)).toBe(false);
  });

  it("9. generation-safe: pending gen differs from prior until commit", async () => {
    useForceLpRecoveryTestKv(true);
    useLpPublishTestKv(true);
    setDeploymentScopeForTests(SCOPE);
    const body = beerBody("d_prior_gen");
    await persistLpPublishedBody(body);
    const prep = await prepareForceLpRefresh({
      response: withBody(BEER, body),
      pendingGeneration: "d_pending_gen",
    });
    expect(prep.meta.priorGeneration).toBe("d_prior_gen");
    expect(prep.meta.pendingGeneration).toBe("d_pending_gen");
    expect(prep.meta.priorGeneration).not.toBe(prep.meta.pendingGeneration);
  });

  it("10. BEER contract: tokenId 436637 preserved on rollback", async () => {
    useForceLpRecoveryTestKv(true);
    useLpPublishTestKv(true);
    setDeploymentScopeForTests(SCOPE);
    const body = beerBody();
    await persistLpPublishedBody(body);
    await prepareForceLpRefresh({
      response: withBody(BEER, body),
      pendingGeneration: "d_beer",
    });
    const restored = await rollbackForceLpRefresh({
      response: armForceLpClearedAggregate(withBody(BEER, body), {
        state: "open",
        priorGeneration: body.lpGeneration,
        pendingGeneration: "d_beer",
        reason: "force_refresh_started",
        savedAt: new Date().toISOString(),
        durablePrior: true,
      }),
      scope: SCOPE,
    });
    expect(restored.overview.lpIntelligence?.positions?.[0]?.positionNftId).toBe(
      FORCE_LP_TOKEN_CONTRACTS.BEER.requireTokenId,
    );
  });

  it("11. HANSOME contract: non-empty positions restored on rollback", async () => {
    useForceLpRecoveryTestKv(true);
    useLpPublishTestKv(true);
    setDeploymentScopeForTests(SCOPE);
    const body = hansomeBody();
    await persistLpPublishedBody(body);
    await prepareForceLpRefresh({
      response: withBody(HANSOME, body),
      pendingGeneration: "d_h",
    });
    const restored = await rollbackForceLpRefresh({
      response: armForceLpClearedAggregate(withBody(HANSOME, body), {
        state: "open",
        priorGeneration: body.lpGeneration,
        pendingGeneration: "d_h",
        reason: "force_refresh_started",
        savedAt: new Date().toISOString(),
        durablePrior: true,
      }),
      scope: SCOPE,
    });
    expect((restored.overview.lpIntelligence?.positions ?? []).length).toBeGreaterThan(
      0,
    );
    expect(
      (restored.overview.lpIntelligence as { ownershipClass?: string })
        ?.ownershipClass,
    ).toBe("posm_nft");
  });

  it("12. GME contract: hook class / intel restored on rollback", async () => {
    useForceLpRecoveryTestKv(true);
    useLpPublishTestKv(true);
    setDeploymentScopeForTests(SCOPE);
    const body = gmeBody();
    await persistLpPublishedBody(body);
    await prepareForceLpRefresh({
      response: withBody(GME, body),
      pendingGeneration: "d_g",
    });
    const restored = await rollbackForceLpRefresh({
      response: armForceLpClearedAggregate(withBody(GME, body), {
        state: "open",
        priorGeneration: body.lpGeneration,
        pendingGeneration: "d_g",
        reason: "force_refresh_started",
        savedAt: new Date().toISOString(),
        durablePrior: true,
      }),
      scope: SCOPE,
    });
    const intel = restored.overview.lpIntelligence as {
      ownershipClass?: string;
      hookIntelligence?: unknown;
    };
    expect(intel.ownershipClass).toBe("hook_native");
    expect(intel.hookIntelligence).toBeTruthy();
  });

  it("13. OKC contract: force end is terminal (restored or unknown, not sticky analyzing)", async () => {
    useForceLpRecoveryTestKv(true);
    useLpPublishTestKv(true);
    setDeploymentScopeForTests(SCOPE);
    const body: LpPublishedBody = {
      schemaVersion: 1,
      deploymentScope: SCOPE,
      lpGeneration: "d_okc",
      publishedAt: new Date().toISOString(),
      tokenAddress: OKC.toLowerCase(),
      chainId: 4663,
      intelligence: {
        poolDetected: true,
        poolsDetectedCount: 1,
        positions: [{ lockState: "UNKNOWN" }],
        detail: "OKC partial",
        lockDistribution: { available: false, reason: "incomplete", method: null },
      } as never,
      lpLockStatus: "unknown",
      lpLockDetail: null,
      poolId: null,
      liquidityUsd: null,
    };
    await persistLpPublishedBody(body);
    await prepareForceLpRefresh({
      response: withBody(OKC, body),
      pendingGeneration: "d_okc_pend",
    });
    const restored = await rollbackForceLpRefresh({
      response: {
        ...armForceLpClearedAggregate(withBody(OKC, body), {
          state: "open",
          priorGeneration: body.lpGeneration,
          pendingGeneration: "d_okc_pend",
          reason: "force_refresh_started",
          savedAt: new Date().toISOString(),
          durablePrior: true,
        }),
        lpTerminal: {
          ...markLpTerminalRunning(
            beginLpTerminal({
              attemptId: "d_okc_pend",
              generation: "d_okc_pend",
              forceRefresh: true,
            }),
          ),
          terminalState: "FAILED_TERMINAL",
          terminalReason: "stale_forced_refresh",
        },
      },
      scope: SCOPE,
    });
    expect(restored.analysisStages?.liquidity).not.toBe("analyzing");
    expect(
      restored.analysisStages?.liquidity === "partial" ||
        restored.analysisStages?.liquidity === "done" ||
        restored.analysisStages?.liquidity === "unknown",
    ).toBe(true);
  });

  it("14. loadPriorLpForForceDeep prefers recovery slot over cleared aggregate", async () => {
    useForceLpRecoveryTestKv(true);
    useLpPublishTestKv(true);
    setDeploymentScopeForTests(SCOPE);
    const body = beerBody();
    await persistLpPublishedBody(body);
    const prior = withBody(BEER, body);
    await prepareForceLpRefresh({
      response: prior,
      pendingGeneration: "d_prior_load",
    });
    const cleared = clearStaleLpEvidence(prior);
    const loaded = await loadPriorLpForForceDeep({ response: cleared, scope: SCOPE });
    expect(loaded?.positions?.[0]?.positionNftId).toBe("436637");
  });

  it("15. bodyFromScanResponse / isDurableLpEvidence round-trip", () => {
    const body = beerBody();
    const resp = withBody(BEER, body);
    expect(isDurableLpEvidence(resp)).toBe(true);
    const extracted = bodyFromScanResponse(resp);
    expect(extracted?.lpGeneration).toBe(body.lpGeneration);
    expect(isDurableLpEvidence(clearStaleLpEvidence(resp))).toBe(false);
  });

  it("16. invariants A|B|C hold after force ends (rollback path)", async () => {
    useForceLpRecoveryTestKv(true);
    useLpPublishTestKv(true);
    setDeploymentScopeForTests(SCOPE);
    const body = beerBody();
    await persistLpPublishedBody(body);
    await prepareForceLpRefresh({
      response: withBody(BEER, body),
      pendingGeneration: "d_inv",
    });
    const restored = await rollbackForceLpRefresh({
      response: armForceLpClearedAggregate(withBody(BEER, body), {
        state: "open",
        priorGeneration: body.lpGeneration,
        pendingGeneration: "d_inv",
        reason: "force_refresh_started",
        savedAt: new Date().toISOString(),
        durablePrior: true,
      }),
      scope: SCOPE,
    });
    const slot = await loadLpRecoverySlot(SCOPE, BEER);
    const inv = evaluateForceLpEndInvariants({
      response: restored,
      slot,
      activeBody: body,
      forceEnded: true,
    });
    expect(inv.A).toBe(true);
    expect(inv.B).toBe(true);
    expect(inv.C).toBe(true);
  });
});

describe("Phase 13C force end invariants (explicit A|B|C)", () => {
  it("A: no sticky cleared-only when durable prior existed", async () => {
    useForceLpRecoveryTestKv(true);
    useLpPublishTestKv(true);
    setDeploymentScopeForTests(SCOPE);
    const body = beerBody();
    await persistLpPublishedBody(body);
    await prepareForceLpRefresh({
      response: withBody(BEER, body),
      pendingGeneration: "d_a",
    });
    const bad = clearStaleLpEvidence(withBody(BEER, body));
    const withMeta = {
      ...bad,
      lpForceRecovery: {
        state: "open" as const,
        priorGeneration: body.lpGeneration,
        pendingGeneration: "d_a",
        reason: "force_refresh_started" as const,
        savedAt: new Date().toISOString(),
        durablePrior: true,
      },
    };
    // Without rollback, A fails — with rollback, A passes.
    const sticky = evaluateForceLpEndInvariants({
      response: withMeta,
      slot: await loadLpRecoverySlot(SCOPE, BEER),
      activeBody: null,
      forceEnded: true,
    });
    expect(sticky.A).toBe(false);
    const restored = await rollbackForceLpRefresh({
      response: withMeta,
      scope: SCOPE,
    });
    const ok = evaluateForceLpEndInvariants({
      response: restored,
      slot: await loadLpRecoverySlot(SCOPE, BEER),
      activeBody: body,
      forceEnded: true,
    });
    expect(ok.A).toBe(true);
  });

  it("B: open force with durable prior requires slot or active body", async () => {
    useForceLpRecoveryTestKv(true);
    useLpPublishTestKv(true);
    setDeploymentScopeForTests(SCOPE);
    const body = beerBody();
    await persistLpPublishedBody(body);
    const prep = await prepareForceLpRefresh({
      response: withBody(BEER, body),
      pendingGeneration: "d_b",
    });
    const open = {
      ...withBody(BEER, body),
      lpForceRecovery: prep.meta,
    };
    const inv = evaluateForceLpEndInvariants({
      response: open,
      slot: await loadLpRecoverySlot(SCOPE, BEER),
      activeBody: body,
      forceEnded: false,
    });
    expect(inv.B).toBe(true);
  });

  it("C: hard-terminal ends with new gen or restored prior", async () => {
    useForceLpRecoveryTestKv(true);
    useLpPublishTestKv(true);
    setDeploymentScopeForTests(SCOPE);
    const body = beerBody();
    await persistLpPublishedBody(body);
    await prepareForceLpRefresh({
      response: withBody(BEER, body),
      pendingGeneration: "d_c",
    });
    const restored = await rollbackForceLpRefresh({
      response: armForceLpClearedAggregate(withBody(BEER, body), {
        state: "open",
        priorGeneration: body.lpGeneration,
        pendingGeneration: "d_c",
        reason: "force_refresh_started",
        savedAt: new Date().toISOString(),
        durablePrior: true,
      }),
      scope: SCOPE,
    });
    const inv = evaluateForceLpEndInvariants({
      response: {
        ...restored,
        lpTerminal: {
          attemptId: "d_c",
          generation: "d_c",
          terminalReason: "stale_forced_refresh",
          terminalState: "FAILED_TERMINAL",
          completedStages: [],
          failedStages: ["liquidity"],
          wallTime: 1,
          forceRefresh: true,
          startedAt: new Date().toISOString(),
          recoveryAttempts: 3,
        },
      },
      slot: await loadLpRecoverySlot(SCOPE, BEER),
      activeBody: body,
      forceEnded: true,
    });
    expect(inv.C).toBe(true);
  });
});
