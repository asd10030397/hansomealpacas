/**
 * Deep retry / terminal-state fencing — concurrency regression tests.
 * Proves stale workers cannot regress deepRetryCount or revive terminal partial.
 */
import { describe, expect, it } from "vitest";
import {
  assignDeepAttempt,
  bumpDeepRetryCount,
  isDeepCollecting,
  isDeepRetryable,
  MAX_DEEP_AUTO_RETRIES,
  mergeMonotonicAnalysisStages,
  mergeMonotonicDeepRetryCount,
  preferAuthoritativeDeepResponse,
  preferStageState,
  rearmPartialForDeepRetry,
  retireDeepAttempt,
  shouldAcceptDeepProgress,
  shouldAcceptDeepSettle,
  shouldRejectUnfencedDeepWrite,
} from "@/lib/hansome-score/scan-progress";
import type { AnalysisStages, ScanResponse } from "@/lib/hansome-score/types";

const partialStages: AnalysisStages = {
  contract: "done",
  holders: "done",
  market: "done",
  burn: "partial",
  liquidity: "partial",
  creator: "partial",
  relationships: "done",
  score: "done",
};

function stub(partial: Partial<ScanResponse> = {}): ScanResponse {
  return {
    version: "test",
    scannedAt: new Date().toISOString(),
    analysisPhase: "fast",
    analysisStatus: "partial",
    analysisStages: partialStages,
    scoreProvisional: true,
    deepRetryCount: 0,
    overview: { address: "0xcccccccccccccccccccccccccccccccccccccccc" } as ScanResponse["overview"],
    overall: { score: 40 } as ScanResponse["overall"],
    score: { score: 70 } as ScanResponse["score"],
    structural: { score: 70 } as ScanResponse["structural"],
    activity: { level: "Low" } as ScanResponse["activity"],
    hansomeLevel: {
      id: "kinda_hansome",
      label: "KINDA HANSOME",
      emoji: "😐",
    } as ScanResponse["hansomeLevel"],
    confidence: { percent: 50 } as ScanResponse["confidence"],
    liquidityUsd: 1000,
    context: {},
    sources: [],
    disclaimers: [],
    uiWording: {},
    ...partial,
  } as ScanResponse;
}

describe("Deep retry race fencing", () => {
  it("retryCount 2 → stale attempt settles → retryCount remains 2", () => {
    const genB = assignDeepAttempt(
      stub({ deepRetryCount: MAX_DEEP_AUTO_RETRIES, analysisStatus: "partial" }),
    );
    // Authoritative KV after exhaustion
    const auth = {
      ...genB,
      deepRetryCount: 2,
      analysisStatus: "partial" as const,
    };
    // Late settle from older attempt with regressing count
    const staleSettle = {
      ...stub({
        deepAttemptId: "stale-attempt-a",
        deepRetryCount: 1,
        analysisStatus: "partial",
      }),
    };

    expect(shouldAcceptDeepSettle(auth, staleSettle)).toBe(false);

    // Even if a buggy path skipped the fence, monotonic merge must not regress
    const merged = mergeMonotonicDeepRetryCount(
      auth.deepRetryCount,
      staleSettle.deepRetryCount,
    );
    expect(merged).toBe(2);
    expect(isDeepRetryable({ ...auth, deepRetryCount: merged })).toBe(false);
    expect(isDeepCollecting({ ...auth, deepRetryCount: merged })).toBe(false);
  });

  it("terminal partial → stale onProgress → remains terminal partial", () => {
    const auth = assignDeepAttempt(
      stub({
        deepRetryCount: MAX_DEEP_AUTO_RETRIES,
        analysisStatus: "partial",
      }),
    );
    const staleProgress = {
      analysisStatus: "deep_running" as const,
      deepAttemptId: "orphan-old-gen",
    };

    expect(shouldAcceptDeepProgress(auth, staleProgress)).toBe(false);

    // Same generation must also refuse to revive exhausted terminal into collecting
    const sameGenRevive = {
      analysisStatus: "deep_running" as const,
      deepAttemptId: auth.deepAttemptId,
    };
    expect(shouldAcceptDeepProgress(auth, sameGenRevive)).toBe(false);
    expect(auth.analysisStatus).toBe("partial");
    expect(isDeepCollecting(auth)).toBe(false);
  });

  it("new generation → old generation settles → new generation remains authoritative", () => {
    const oldGen = assignDeepAttempt(stub({ deepRetryCount: 1 }));
    const newGen = rearmPartialForDeepRetry({
      ...oldGen,
      analysisStatus: "partial",
      deepRetryCount: 1,
    });
    expect(newGen.deepAttemptId).toBeTruthy();
    expect(newGen.deepAttemptId).not.toBe(oldGen.deepAttemptId);
    expect(newGen.analysisStatus).toBe("deep_running");

    const oldSettle = {
      ...oldGen,
      analysisStatus: "partial" as const,
      deepRetryCount: 2,
      deepAttemptId: oldGen.deepAttemptId,
    };
    expect(shouldAcceptDeepSettle(newGen, oldSettle)).toBe(false);
    expect(shouldAcceptDeepProgress(newGen, {
      analysisStatus: "deep_running",
      deepAttemptId: oldGen.deepAttemptId,
    })).toBe(false);

    // Current generation progress still accepted
    expect(
      shouldAcceptDeepProgress(newGen, {
        analysisStatus: "deep_running",
        deepAttemptId: newGen.deepAttemptId,
      }),
    ).toBe(true);
  });

  it("retry exhausted → no automatic re-arm", () => {
    const exhausted = stub({
      deepRetryCount: MAX_DEEP_AUTO_RETRIES,
      analysisStatus: "partial",
    });
    expect(isDeepRetryable(exhausted)).toBe(false);
    expect(isDeepCollecting(exhausted)).toBe(false);

    // Simulated late bump that would have re-armed before the fence
    const lateBump = bumpDeepRetryCount({
      ...exhausted,
      deepRetryCount: 1,
    });
    const monotonic = mergeMonotonicDeepRetryCount(
      exhausted.deepRetryCount,
      lateBump.deepRetryCount,
    );
    expect(monotonic).toBe(MAX_DEEP_AUTO_RETRIES);
    expect(
      isDeepRetryable({
        ...exhausted,
        deepRetryCount: monotonic,
      }),
    ).toBe(false);
  });

  it("manual Refresh → new generation may legitimately restart", () => {
    const exhausted = assignDeepAttempt(
      stub({
        deepRetryCount: MAX_DEEP_AUTO_RETRIES,
        analysisStatus: "partial",
      }),
    );
    // Manual refresh: re-arm + reset budget (scan-cache getCachedScan refresh path)
    const refreshed: ScanResponse = {
      ...rearmPartialForDeepRetry(exhausted),
      deepRetryCount: 0,
    };
    expect(refreshed.deepAttemptId).not.toBe(exhausted.deepAttemptId);
    expect(refreshed.deepRetryCount).toBe(0);
    expect(refreshed.analysisStatus).toBe("deep_running");
    // Collecting again is intentional after manual refresh
    expect(isDeepCollecting(refreshed)).toBe(true);
    // Old exhausted generation cannot overwrite the refresh
    expect(
      shouldAcceptDeepSettle(refreshed, {
        deepAttemptId: exhausted.deepAttemptId,
      }),
    ).toBe(false);
  });

  it("stale recovery retires generation so late writers no-op", () => {
    const running = assignDeepAttempt(
      stub({
        analysisStatus: "deep_running",
        deepRetryCount: 1,
        analysisStages: {
          ...partialStages,
          liquidity: "analyzing",
          burn: "analyzing",
          creator: "analyzing",
        },
      }),
    );
    const orphanAttemptId = running.deepAttemptId;
    // recoverStaleDeepIfNeeded: settle + retireDeepAttempt
    const recovered = retireDeepAttempt(
      bumpDeepRetryCount({
        ...running,
        analysisStatus: "partial",
        analysisStages: partialStages,
      }),
    );
    expect(recovered.deepAttemptId).not.toBe(orphanAttemptId);
    expect(
      shouldAcceptDeepProgress(recovered, {
        analysisStatus: "deep_running",
        deepAttemptId: orphanAttemptId,
      }),
    ).toBe(false);
    expect(
      shouldAcceptDeepSettle(recovered, {
        deepAttemptId: orphanAttemptId,
        analysisStatus: "partial",
      } as Pick<ScanResponse, "deepAttemptId" | "analysisStatus">),
    ).toBe(false);
  });

  it("mergeMonotonicDeepRetryCount never regresses", () => {
    expect(mergeMonotonicDeepRetryCount(2, 1)).toBe(2);
    expect(mergeMonotonicDeepRetryCount(1, 2)).toBe(2);
    expect(mergeMonotonicDeepRetryCount(undefined, 1)).toBe(1);
    expect(mergeMonotonicDeepRetryCount(0, undefined)).toBe(0);
  });

  it("preferAuthoritativeDeepResponse prefers higher retry / exhausted terminal", () => {
    const staleMem = stub({
      deepRetryCount: 1,
      analysisStatus: "deep_running",
      deepAttemptId: "mem-old",
    });
    const kvExhausted = stub({
      deepRetryCount: 2,
      analysisStatus: "partial",
      deepAttemptId: "kv-terminal",
    });
    expect(preferAuthoritativeDeepResponse(staleMem, kvExhausted)).toBe(
      kvExhausted,
    );
    expect(
      shouldRejectUnfencedDeepWrite(kvExhausted, {
        analysisStatus: "deep_running",
        deepAttemptId: "new-rearm",
        deepRetryCount: 1,
      }),
    ).toBe(true);
  });

  it("rearm preserves done Lock Distribution / Fast stages", () => {
    const withDoneLp = stub({
      deepRetryCount: 1,
      analysisStages: {
        ...partialStages,
        liquidity: "done",
        relationships: "done",
        burn: "partial",
        creator: "partial",
      },
    });
    const rearmed = rearmPartialForDeepRetry(withDoneLp);
    expect(rearmed.analysisStages?.liquidity).toBe("done");
    expect(rearmed.analysisStages?.relationships).toBe("done");
    expect(rearmed.analysisStages?.contract).toBe("done");
    expect(rearmed.analysisStages?.burn).toBe("analyzing");
    expect(rearmed.deepAttemptId).toBeTruthy();
  });

  it("same-generation stage merge never regresses done → analyzing/partial", () => {
    expect(preferStageState("done", "analyzing")).toBe("done");
    expect(preferStageState("done", "partial")).toBe("done");
    expect(preferStageState("partial", "analyzing")).toBe("partial");
    expect(preferStageState("analyzing", "done")).toBe("done");

    const auth = {
      ...partialStages,
      relationships: "done" as const,
      liquidity: "done" as const,
      burn: "analyzing" as const,
    };
    const lagging = {
      ...partialStages,
      relationships: "analyzing" as const,
      liquidity: "partial" as const,
      burn: "partial" as const,
    };
    const merged = mergeMonotonicAnalysisStages(auth, lagging);
    expect(merged?.relationships).toBe("done");
    expect(merged?.liquidity).toBe("done");
    expect(merged?.burn).toBe("partial");
  });
});

