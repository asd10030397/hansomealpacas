import { describe, expect, it } from "vitest";
import {
  DEEP_SCAN_STAGES_COMPLETE,
  FAST_SCAN_STAGES_READY,
  isDeepInProgress,
  isScanComplete,
  markScanComplete,
} from "@/lib/hansome-score/scan-fast";
import type { ScanResponse } from "@/lib/hansome-score/types";

function stub(partial: Partial<ScanResponse>): ScanResponse {
  return {
    version: "t",
    scannedAt: new Date().toISOString(),
    overview: {} as ScanResponse["overview"],
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

describe("Fast Scan / Deep Analysis markers", () => {
  it("legacy snapshots without phase are treated as complete", () => {
    expect(isScanComplete(stub({}))).toBe(true);
  });

  it("fast / deep_running are not complete", () => {
    expect(
      isScanComplete(
        stub({ analysisPhase: "fast", analysisStatus: "deep_running" }),
      ),
    ).toBe(false);
  });

  it("markScanComplete clears provisional", () => {
    const done = markScanComplete(
      stub({
        analysisPhase: "fast",
        analysisStatus: "deep_running",
        scoreProvisional: true,
        analysisStages: FAST_SCAN_STAGES_READY,
      }),
    );
    expect(done.analysisPhase).toBe("complete");
    expect(done.analysisStatus).toBe("complete");
    expect(done.scoreProvisional).toBe(false);
    expect(done.analysisStages).toEqual(DEEP_SCAN_STAGES_COMPLETE);
    expect(isScanComplete(done)).toBe(true);
  });

  it("fast stages leave liquidity/creator analyzing", () => {
    expect(FAST_SCAN_STAGES_READY.liquidity).toBe("analyzing");
    expect(FAST_SCAN_STAGES_READY.creator).toBe("analyzing");
    expect(FAST_SCAN_STAGES_READY.contract).toBe("done");
    expect(FAST_SCAN_STAGES_READY.burn).toBe("partial");
  });

  it("partial status is not deep-in-progress", () => {
    expect(
      isDeepInProgress(
        stub({ analysisPhase: "fast", analysisStatus: "partial" }),
      ),
    ).toBe(false);
    expect(
      isDeepInProgress(
        stub({ analysisPhase: "fast", analysisStatus: "deep_running" }),
      ),
    ).toBe(true);
  });
});
