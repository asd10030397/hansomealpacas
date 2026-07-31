import { describe, expect, it } from "vitest";
import {
  bumpDeepRetryCount,
  hasRetryableUnresolvedStages,
  isDeepCollecting,
  isDeepRetryable,
  MAX_DEEP_AUTO_RETRIES,
  needsDeepWork,
  rearmPartialForDeepRetry,
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

function stub(
  partial: Partial<ScanResponse> & {
    analysisStatus?: ScanResponse["analysisStatus"];
    analysisStages?: AnalysisStages;
    deepRetryCount?: number;
  },
): Pick<
  ScanResponse,
  | "analysisStatus"
  | "analysisPhase"
  | "analysisStages"
  | "deepRetryCount"
  | "scoreProvisional"
> {
  return {
    analysisPhase: "fast",
    analysisStatus: "partial",
    analysisStages: partialStages,
    scoreProvisional: true,
    ...partial,
  };
}

describe("scan-progress collecting vs unavailable", () => {
  it("exposes a finite auto-retry budget", () => {
    expect(MAX_DEEP_AUTO_RETRIES).toBe(2);
    expect(MAX_DEEP_AUTO_RETRIES).toBeGreaterThan(0);
  });

  it("detects retryable unresolved deep stages", () => {
    expect(hasRetryableUnresolvedStages(stub({}))).toBe(true);
    expect(
      hasRetryableUnresolvedStages(
        stub({
          analysisStages: {
            ...partialStages,
            burn: "done",
            liquidity: "done",
            creator: "done",
            score: "done",
          },
        }),
      ),
    ).toBe(false);
  });

  it("treats fresh partial as retryable collecting", () => {
    const r = stub({ deepRetryCount: 1 });
    expect(isDeepRetryable(r)).toBe(true);
    expect(isDeepCollecting(r)).toBe(true);
    expect(needsDeepWork(r)).toBe(true);
  });

  it("stops retry when budget exhausted — honest terminal unavailable", () => {
    const r = stub({ deepRetryCount: MAX_DEEP_AUTO_RETRIES });
    expect(isDeepRetryable(r)).toBe(false);
    expect(isDeepCollecting(r)).toBe(false);
    expect(needsDeepWork(r)).toBe(false);
  });

  it("keeps deep_running as collecting", () => {
    const r = stub({ analysisStatus: "deep_running", deepRetryCount: 0 });
    expect(isDeepCollecting(r)).toBe(true);
    expect(isDeepRetryable(r)).toBe(false);
    expect(needsDeepWork(r)).toBe(true);
  });

  it("re-arms partial stages to analyzing while preserving done", () => {
    const rearmed = rearmPartialForDeepRetry({
      analysisStatus: "partial",
      analysisPhase: "fast",
      analysisStages: partialStages,
      deepRetryCount: 1,
      scoreProvisional: true,
      deepAttemptId: "prior-gen",
    } as ScanResponse);
    expect(rearmed.analysisStatus).toBe("deep_running");
    expect(rearmed.analysisStages?.relationships).toBe("done");
    expect(rearmed.analysisStages?.liquidity).toBe("analyzing");
    expect(rearmed.analysisStages?.creator).toBe("analyzing");
    expect(rearmed.analysisStages?.burn).toBe("analyzing");
    expect(rearmed.deepStartedAt).toBeTruthy();
    expect(rearmed.deepAttemptId).toBeTruthy();
    expect(rearmed.deepAttemptId).not.toBe("prior-gen");
  });

  it("bumps deepRetryCount on settlement", () => {
    expect(bumpDeepRetryCount({} as ScanResponse).deepRetryCount).toBe(1);
    expect(
      bumpDeepRetryCount({ deepRetryCount: 1 } as ScanResponse).deepRetryCount,
    ).toBe(2);
  });
});
