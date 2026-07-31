import { describe, expect, it } from "vitest";
import {
  collectingEtaMessage,
  DEEP_STAGE_ESTIMATE_MS,
  deepRetryAttemptDisplay,
  hasTransferIndexProgress,
  stageEstimateExceeded,
} from "@/lib/hansome-score/heavy-token-ux";
import { MAX_DEEP_AUTO_RETRIES } from "@/lib/hansome-score/scan-progress";

describe("heavy-token Collecting UX", () => {
  it("keeps estimate under ceiling and replaces when exceeded", () => {
    expect(stageEstimateExceeded(60_000, DEEP_STAGE_ESTIMATE_MS.creator)).toBe(
      false,
    );
    expect(stageEstimateExceeded(120_001, DEEP_STAGE_ESTIMATE_MS.creator)).toBe(
      true,
    );
    expect(
      collectingEtaMessage({
        exceeded: false,
        estimateLabel: "Estimated time: ~1–2 minutes",
        stillAnalyzingLabel:
          "Still analyzing — this token has more on-chain history than usual.",
      }),
    ).toBe("Estimated time: ~1–2 minutes");
    expect(
      collectingEtaMessage({
        exceeded: true,
        estimateLabel: "Estimated time: ~1–2 minutes",
        stillAnalyzingLabel:
          "Still analyzing — this token has more on-chain history than usual.",
      }),
    ).toBe(
      "Still analyzing — this token has more on-chain history than usual.",
    );
  });

  it("surfaces transfer progress when pages/transfers > 0", () => {
    expect(hasTransferIndexProgress({ pagesFetched: 0, transfersIndexed: 0 })).toBe(
      false,
    );
    expect(hasTransferIndexProgress({ pagesFetched: 4, transfersIndexed: 0 })).toBe(
      true,
    );
    expect(
      hasTransferIndexProgress({ pagesFetched: 0, transfersIndexed: 12 }),
    ).toBe(true);
  });

  it("maps deepRetryCount to user-facing attempt of max", () => {
    expect(deepRetryAttemptDisplay(0)).toEqual({
      attempt: 1,
      max: MAX_DEEP_AUTO_RETRIES + 1,
    });
    expect(deepRetryAttemptDisplay(2)).toEqual({
      attempt: 3,
      max: MAX_DEEP_AUTO_RETRIES + 1,
    });
  });

  it("EN/ZH heavy-history copy matches product strings", async () => {
    const { messages } = await import("@/content/i18n");
    expect(messages.en.scan.deepAnalysisStillAnalyzing).toBe(
      "Still analyzing — this token has more on-chain history than usual.",
    );
    expect(messages.zh.scan.deepAnalysisStillAnalyzing).toBe(
      "仍在分析中 — 此代幣的鏈上歷史較多，因此需要更多時間。",
    );
  });
});
