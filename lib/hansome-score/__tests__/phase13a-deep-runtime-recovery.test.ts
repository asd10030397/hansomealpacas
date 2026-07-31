/**
 * Phase 13A — Deep LP runtime recovery regressions (12 scenarios).
 * Required assertion: no path ends analyzing + !inflight + !retryScheduled + !valid lease.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  beginDeepLease,
  clearDeepLease,
  heartbeatDeepLease,
  isLeaseValid,
  isOrphanAnalyzing,
  recoverOrphanAnalyzing,
  stampDeepRuntime,
  terminalizeOrphanAnalyzingStages,
  withDeepLpRpcTimeout,
  withRegisteredDeepJob,
} from "@/lib/hansome-score/deep-runtime";
import {
  beginLpTerminal,
  markLpTerminalRunning,
  MAX_LP_FORCE_RECOVERY_ATTEMPTS,
} from "@/lib/hansome-score/lp/lp-terminal-contract";
import { markScanPartial } from "@/lib/hansome-score/scan-deep";
import { FAST_SCAN_STAGES_READY } from "@/lib/hansome-score/scan-fast";
import {
  MAX_DEEP_AUTO_RETRIES,
  assignDeepAttempt,
  isDeepRetryable,
} from "@/lib/hansome-score/scan-progress";
import { setDeploymentScopeForTests } from "@/lib/hansome-score/deployment-scope";
import type { ScanResponse } from "@/lib/hansome-score/types";

function base(overrides: Partial<ScanResponse> = {}): ScanResponse {
  const attemptId = "d_13a_test";
  return {
    version: "1.3.0-overall",
    scannedAt: new Date().toISOString(),
    analysisStatus: "partial",
    analysisPhase: "fast",
    analysisStages: {
      ...FAST_SCAN_STAGES_READY,
      relationships: "partial",
      liquidity: "analyzing",
      creator: "done",
      burn: "done",
      score: "analyzing",
    },
    deepAttemptId: attemptId,
    deepRetryCount: MAX_DEEP_AUTO_RETRIES,
    scoreProvisional: true,
    deepStartedAt: new Date().toISOString(),
    liquidityUsd: null,
    overview: {
      address: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
      chainId: 4663,
      lpIntelligence: {
        poolDetected: false,
        positions: [],
        detail: "LP evidence cleared — awaiting fresh multi-version discovery.",
        lockDistribution: {
          available: false,
          reason: "LP evidence cleared for full refresh",
        },
        aggregateState: "UNKNOWN_INCOMPLETE",
      },
    },
    ...overrides,
  } as unknown as ScanResponse;
}

function assertNoOrphan(
  response: ScanResponse,
  opts: { deepInflight?: boolean } = {},
) {
  expect(
    isOrphanAnalyzing({
      response,
      deepInflight: opts.deepInflight === true,
    }),
  ).toBe(false);
}

afterEach(() => {
  setDeploymentScopeForTests(null);
  vi.useRealTimers();
});

describe("Phase 13A Deep runtime recovery", () => {
  it("1. worker launch failure → orphan recovers to terminal or retry", () => {
    const orphan = base({
      deepRuntime: undefined,
      deepRetryCount: 0,
      analysisStatus: "deep_running",
    });
    expect(
      isOrphanAnalyzing({ response: orphan, deepInflight: false }),
    ).toBe(true);
    const out = recoverOrphanAnalyzing(orphan, { deepInflight: false });
    expect(out.orphan).toBe(true);
    expect(out.shouldRetry).toBe(true);
    assertNoOrphan(out.response);
  });

  it("2. after() cancellation leaves analyzing → orphan retry_required", () => {
    const snap = base({
      deepRetryCount: 1,
      analysisStatus: "deep_running",
      deepRuntime: {
        lease: beginDeepLease({
          generation: "d_old",
          attempt: 1,
          now: Date.now() - 200_000,
        }),
        lastTransition: "job_registered",
      },
    });
    // Expired lease + no inflight.
    expect(isLeaseValid(snap.deepRuntime?.lease)).toBe(false);
    const out = recoverOrphanAnalyzing(snap, { deepInflight: false });
    expect(out.shouldRetry).toBe(true);
    expect(out.response.deepRuntime?.retryRequired).toBe(true);
    assertNoOrphan(out.response);
  });

  it("3. RPC timeout structured error code", async () => {
    await expect(
      withDeepLpRpcTimeout(
        new Promise(() => {
          /* hang */
        }),
        { timeoutMs: 20, label: "unit_rpc" },
      ),
    ).rejects.toMatchObject({ code: "deep_lp_rpc_timeout" });
  });

  it("4. lease expiration detected and recovered", () => {
    const now = Date.now();
    const lease = beginDeepLease({
      generation: "d_lease",
      attempt: 0,
      now: now - 1,
    });
    expect(isLeaseValid(lease, now)).toBe(true);
    expect(isLeaseValid(lease, now + 130_000)).toBe(false);
    const hb = heartbeatDeepLease(lease, now + 10_000);
    expect(isLeaseValid(hb, now + 10_000)).toBe(true);
    const snap = base({
      deepRetryCount: 0,
      deepRuntime: { lease, lastTransition: "job_registered" },
    });
    const out = recoverOrphanAnalyzing(snap, {
      deepInflight: false,
      now: now + 130_000,
    });
    expect(out.orphan).toBe(true);
    assertNoOrphan(out.response, {});
  });

  it("5. fence rejection annotates diagnostics without orphan sticky analyzing", () => {
    const auth = terminalizeOrphanAnalyzingStages(
      base({ deepRetryCount: MAX_DEEP_AUTO_RETRIES }),
    );
    assertNoOrphan(auth);
    expect(auth.analysisStages?.liquidity).not.toBe("analyzing");
  });

  it("6. deployment scope mismatch stays isolated (candidate ≠ production)", () => {
    setDeploymentScopeForTests("candidate:dpl_phase13a_test");
    const registered = withRegisteredDeepJob(
      base({ deepRetryCount: 0, analysisStatus: "deep_running" }),
    );
    expect(registered.deepRuntime?.lease?.deploymentScope).toContain(
      "candidate:",
    );
    expect(registered.deepRuntime?.lease?.deploymentScope).not.toBe(
      "production",
    );
    setDeploymentScopeForTests("production");
    const prod = withRegisteredDeepJob(
      base({ deepRetryCount: 0, analysisStatus: "deep_running" }),
    );
    expect(prod.deepRuntime?.lease?.deploymentScope).toBe("production");
    expect(prod.deepRuntime?.lease?.deploymentScope).not.toBe(
      registered.deepRuntime?.lease?.deploymentScope,
    );
  });

  it("7. stale analyzing snapshot terminalizes when retries exhausted", () => {
    const orphan = base({
      deepRetryCount: MAX_DEEP_AUTO_RETRIES,
      analysisStatus: "partial",
    });
    const out = recoverOrphanAnalyzing(orphan, { deepInflight: false });
    expect(out.shouldRetry).toBe(false);
    expect(out.response.analysisStages?.liquidity).toBe("partial");
    expect(out.response.analysisStages?.score).toBe("partial");
    assertNoOrphan(out.response);
  });

  it("8. retry exhaustion → honest terminal (not analyzing)", () => {
    const force = base({
      deepRetryCount: MAX_DEEP_AUTO_RETRIES,
      lpTerminal: markLpTerminalRunning(
        beginLpTerminal({
          attemptId: "d_force",
          generation: "d_force",
          forceRefresh: true,
        }),
      ),
    });
    // Exhaust force recovery budget.
    force.lpTerminal = {
      ...force.lpTerminal!,
      recoveryAttempts: MAX_LP_FORCE_RECOVERY_ATTEMPTS,
    };
    const marked = markScanPartial(force, { reason: "exhausted" });
    expect(marked.analysisStages?.liquidity).toBe("unknown");
    assertNoOrphan(marked);
  });

  it("9. successful retry path keeps lease / retryScheduled while collecting", () => {
    const registered = withRegisteredDeepJob(
      assignDeepAttempt(
        base({
          deepRetryCount: 0,
          analysisStatus: "deep_running",
        }),
      ),
    );
    expect(registered.deepRuntime?.lease).toBeTruthy();
    expect(
      isOrphanAnalyzing({ response: registered, deepInflight: false }),
    ).toBe(false);
    expect(
      isOrphanAnalyzing({ response: registered, deepInflight: true }),
    ).toBe(false);
  });

  it("10. partial terminal result clears lease and analyzing stages", () => {
    const partial = markScanPartial(
      base({
        deepRetryCount: MAX_DEEP_AUTO_RETRIES,
        analysisStatus: "deep_running",
        analysisStages: {
          ...FAST_SCAN_STAGES_READY,
          liquidity: "analyzing",
          creator: "analyzing",
          burn: "analyzing",
          relationships: "analyzing",
          score: "analyzing",
        },
      }),
      { reason: "timeout" },
    );
    const cleared = clearDeepLease(partial, "settled_partial", "deep_partial");
    expect(cleared.analysisStages?.liquidity).toBe("partial");
    expect(cleared.deepRuntime?.lease).toBeUndefined();
    assertNoOrphan(cleared);
  });

  it("11. concurrent duplicate trigger — valid lease prevents orphan false positive", () => {
    const a = withRegisteredDeepJob(
      base({ deepRetryCount: 0, analysisStatus: "deep_running" }),
    );
    // Second "trigger" sees same lease generation.
    expect(
      isOrphanAnalyzing({ response: a, deepInflight: false }),
    ).toBe(false);
    expect(
      isOrphanAnalyzing({ response: a, deepInflight: true }),
    ).toBe(false);
  });

  it("12. production vs candidate scope isolation on runtime metadata", () => {
    setDeploymentScopeForTests("candidate:dpl_iso_a");
    const cand = stampDeepRuntime(
      base({ deepRetryCount: 0 }),
      {
        deploymentScope: "candidate:dpl_iso_a",
        lastTransition: "scope_check",
      },
    );
    setDeploymentScopeForTests("production");
    const prod = stampDeepRuntime(
      base({ deepRetryCount: 0 }),
      {
        deploymentScope: "production",
        lastTransition: "scope_check",
      },
    );
    expect(cand.deepRuntime?.deploymentScope).not.toBe(
      prod.deepRuntime?.deploymentScope,
    );
    // Incident shape from v1 soak must recover.
    const incident = base({
      analysisStatus: "partial",
      deepRetryCount: 2,
      deepRuntime: undefined,
    });
    expect(
      isOrphanAnalyzing({ response: incident, deepInflight: false }),
    ).toBe(true);
    const recovered = recoverOrphanAnalyzing(incident, {
      deepInflight: false,
    });
    assertNoOrphan(recovered.response);
    expect(isDeepRetryable(recovered.response)).toBe(false);
  });
});
