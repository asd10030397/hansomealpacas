/**
 * Phase 10C-5 — forced-refresh LP terminal contract regressions.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  assertAllowedLpTransition,
  beginLpTerminal,
  hasVerifiedLockedResult,
  isLpHardTerminal,
  markLpTerminalPublishing,
  markLpTerminalRunning,
  mayLpForceRecover,
  MAX_LP_FORCE_RECOVERY_ATTEMPTS,
  recordLpWatchdogTimeout,
  resolveLpInterruptOutcome,
  settleLpFailedTerminal,
  settleLpSuccessTerminal,
} from "@/lib/hansome-score/lp/lp-terminal-contract";
import { shouldPublishLpBody } from "@/lib/hansome-score/lp/lp-result-publish";
import { markScanPartial } from "@/lib/hansome-score/scan-deep";
import { FAST_SCAN_STAGES_READY } from "@/lib/hansome-score/scan-fast";
import type { ScanResponse } from "@/lib/hansome-score/types";

function base(force = true): ScanResponse {
  const attemptId = "d_10c5_1";
  return {
    analysisStatus: "deep_running",
    analysisPhase: "fast",
    analysisStages: {
      ...FAST_SCAN_STAGES_READY,
      relationships: "analyzing",
      liquidity: "analyzing",
      creator: "analyzing",
      burn: "analyzing",
      score: "pending",
    },
    deepAttemptId: attemptId,
    deepRetryCount: 0,
    scoreProvisional: true,
    deepStartedAt: new Date().toISOString(),
    liquidityUsd: 1000,
    overview: {
      address: "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804",
      lpIntelligence: {
        positions: [],
        detail: "analyzing",
        aggregateState: "UNKNOWN_INCOMPLETE",
      },
    },
    lpTerminal: beginLpTerminal({
      attemptId,
      generation: attemptId,
      forceRefresh: force,
    }),
  } as unknown as ScanResponse;
}

function withVerified(response: ScanResponse): ScanResponse {
  return {
    ...response,
    overview: {
      ...response.overview,
      lpIntelligence: {
        ...response.overview.lpIntelligence!,
        positions: [
          {
            lockState: "LOCKED_VERIFIED_ONCHAIN",
            positionNftId: "436637",
            owner: "0x736D76699C26D0d966744cAe304C000d471f7F35",
          },
        ],
      },
    },
  } as ScanResponse;
}

afterEach(() => {
  /* pure helpers — no registry */
});

describe("Phase 10C-5 terminal contract fields", () => {
  it("SUCCESS_TERMINAL has all required fields", () => {
    const c = settleLpSuccessTerminal(
      markLpTerminalPublishing(
        markLpTerminalRunning(
          beginLpTerminal({
            attemptId: "a1",
            generation: "a1",
            forceRefresh: true,
          }),
        ),
      ),
    );
    expect(c.attemptId).toBe("a1");
    expect(c.generation).toBe("a1");
    expect(c.terminalReason).toBeTruthy();
    expect(c.terminalState).toBe("SUCCESS_TERMINAL");
    expect(Array.isArray(c.completedStages)).toBe(true);
    expect(Array.isArray(c.failedStages)).toBe(true);
    expect(typeof c.wallTime).toBe("number");
    expect(isLpHardTerminal(c)).toBe(true);
  });

  it("FAILED_TERMINAL has all required fields", () => {
    const c = settleLpFailedTerminal(
      beginLpTerminal({
        attemptId: "a2",
        generation: "a2",
        forceRefresh: true,
      }),
      { reason: "watchdog_timeout" },
    );
    expect(c.terminalState).toBe("FAILED_TERMINAL");
    expect(c.terminalReason).toBe("watchdog_timeout");
    expect(c.failedStages.length).toBeGreaterThan(0);
    expect(c.wallTime).toBeGreaterThanOrEqual(0);
  });

  it("forbids RUNNING → PARTIAL_TERMINAL (no such state)", () => {
    expect(assertAllowedLpTransition("RUNNING", "SUCCESS_TERMINAL")).toBe(true);
    expect(assertAllowedLpTransition("RUNNING", "FAILED_TERMINAL")).toBe(true);
    expect(assertAllowedLpTransition("RUNNING", "PUBLISHING")).toBe(true);
    expect(assertAllowedLpTransition("SUCCESS_TERMINAL", "RUNNING")).toBe(false);
  });
});

describe("Phase 10C-5 watchdog never partial-terminals LP", () => {
  it("watchdog timeout with verified → SUCCESS_TERMINAL", () => {
    const snap = withVerified(base());
    const outcome = resolveLpInterruptOutcome({
      response: snap,
      contract: markLpTerminalRunning(snap.lpTerminal!),
      interruptReason: "watchdog_timeout",
    });
    expect(outcome.kind).toBe("success");
    expect(outcome.contract.terminalState).toBe("SUCCESS_TERMINAL");
    expect(outcome.response.analysisStages?.liquidity).toBe("done");
    expect(outcome.response.analysisStages?.liquidity).not.toBe("partial");
  });

  it("watchdog timeout without verified → recover (not partial terminal)", () => {
    const snap = base();
    const outcome = resolveLpInterruptOutcome({
      response: snap,
      contract: markLpTerminalRunning(snap.lpTerminal!),
      interruptReason: "watchdog_timeout",
    });
    expect(outcome.kind).toBe("recover");
    expect(outcome.response.analysisStages?.liquidity).toBe("analyzing");
    expect(outcome.contract.terminalState).toBe("RUNNING");
    expect(outcome.contract.recoveryAttempts).toBe(1);
    expect(outcome.contract.watchdogTimeoutAt).toBeTruthy();
  });

  it("exhausted recoveries → FAILED_TERMINAL", () => {
    let contract = markLpTerminalRunning(
      beginLpTerminal({
        attemptId: "a3",
        generation: "a3",
        forceRefresh: true,
      }),
    );
    for (let i = 0; i < MAX_LP_FORCE_RECOVERY_ATTEMPTS; i++) {
      const o = resolveLpInterruptOutcome({
        response: base(),
        contract,
        interruptReason: "watchdog_timeout",
      });
      expect(o.kind).toBe("recover");
      contract = o.contract;
    }
    expect(mayLpForceRecover(contract)).toBe(false);
    const final = resolveLpInterruptOutcome({
      response: base(),
      contract,
      interruptReason: "watchdog_timeout",
    });
    expect(final.kind).toBe("failed");
    expect(final.contract.terminalState).toBe("FAILED_TERMINAL");
    expect(final.response.analysisStages?.liquidity).toBe("unknown");
  });

  it("recordLpWatchdogTimeout keeps RUNNING (not PARTIAL)", () => {
    const c = recordLpWatchdogTimeout(
      markLpTerminalRunning(
        beginLpTerminal({
          attemptId: "a4",
          generation: "a4",
          forceRefresh: true,
        }),
      ),
    );
    expect(c.terminalState).toBe("RUNNING");
    expect(c.terminalReason).toBe("watchdog_timeout");
  });
});

describe("Phase 10C-5 markScanPartial preserves force LP", () => {
  it("does not flip force-LP liquidity analyzing → partial", () => {
    const snap = base();
    const marked = markScanPartial(snap, { reason: "test" });
    expect(marked.analysisStages?.liquidity).toBe("analyzing");
  });
});

describe("Phase 10C-5 publish + verified helpers", () => {
  it("hasVerifiedLockedResult detects LOCKED_VERIFIED_ONCHAIN", () => {
    expect(hasVerifiedLockedResult(base())).toBe(false);
    expect(hasVerifiedLockedResult(withVerified(base()))).toBe(true);
  });

  it("shouldPublishLpBody accepts FAILED_TERMINAL unknown liquidity (non-cleared)", () => {
    const snap = base();
    const failed = resolveLpInterruptOutcome({
      response: snap,
      contract: {
        ...snap.lpTerminal!,
        recoveryAttempts: MAX_LP_FORCE_RECOVERY_ATTEMPTS,
      },
      interruptReason: "recovery_exhausted",
    });
    expect(failed.kind).toBe("failed");
    expect(
      shouldPublishLpBody({
        ...failed.response,
        overview: {
          ...failed.response.overview,
          lpIntelligence: {
            ...failed.response.overview.lpIntelligence!,
            detail: "Force LP recovery exhausted — lock unknown.",
            lockDistribution: {
              available: false,
              reason: "recovery_exhausted",
            },
          },
        },
      } as ScanResponse),
    ).toBe(true);
  });

  it("shouldPublishLpBody rejects cleared shell even on FAILED_TERMINAL (13C)", () => {
    const snap = base();
    const failed = resolveLpInterruptOutcome({
      response: snap,
      contract: {
        ...snap.lpTerminal!,
        recoveryAttempts: MAX_LP_FORCE_RECOVERY_ATTEMPTS,
      },
      interruptReason: "recovery_exhausted",
    });
    expect(
      shouldPublishLpBody({
        ...failed.response,
        overview: {
          ...failed.response.overview,
          lpIntelligence: {
            ...failed.response.overview.lpIntelligence!,
            detail: "LP evidence cleared — awaiting fresh multi-version discovery.",
            lockDistribution: {
              available: false,
              reason: "LP evidence cleared for full refresh",
            },
          },
        },
      } as ScanResponse),
    ).toBe(false);
  });
});

describe("Phase 10C-5 concurrent / generation fencing notes", () => {
  it("success terminal generation matches attempt", () => {
    const c = settleLpSuccessTerminal(
      beginLpTerminal({
        attemptId: "gen_x",
        generation: "gen_x",
        forceRefresh: true,
      }),
    );
    expect(c.attemptId).toBe(c.generation);
  });
});
