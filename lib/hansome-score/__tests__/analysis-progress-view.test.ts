import { describe, expect, it } from "vitest";
import { en } from "@/content/i18n/en";
import { zh } from "@/content/i18n/zh";
import { ANALYSIS_MODULE_KEYS } from "@/lib/hansome-score/analysis-progress";
import type { AnalysisWorkflowProgress } from "@/lib/hansome-score/analysis-progress";
import { buildProgressPanelView } from "@/lib/hansome-score/analysis-progress-view";

function sampleWorkflow(
  partial: Partial<AnalysisWorkflowProgress> = {},
): AnalysisWorkflowProgress {
  return {
    modules: ANALYSIS_MODULE_KEYS.map((key) => ({
      key,
      status:
        key === "structural" || key === "holders"
          ? ("done" as const)
          : ("analyzing" as const),
      progress: key === "structural" || key === "holders" ? 100 : 28,
      messageKey:
        key === "creator"
          ? ("progressScanningCreator" as const)
          : key === "structural" || key === "holders"
            ? ("progressComplete" as const)
            : ("progressCollecting" as const),
      resolved: key === "structural" || key === "holders",
      dataComplete: key === "structural" || key === "holders",
    })),
    overallProgress: 42,
    completedModules: 2,
    totalModules: 6,
    activeModuleKey: "creator",
    workflowStatus: "collecting",
    deepAttemptId: "d_ui_1",
    analysisCoveragePercent: 55,
    ...partial,
  };
}

describe("analysis-progress-view (component contract)", () => {
  it("Fast result visible while Deep progress is active", () => {
    const view = buildProgressPanelView(sampleWorkflow(), en.scan);
    expect(view.overallProgress).toBe(42);
    expect(view.workflowStatus).toBe("collecting");
    expect(view.modulesCompletedLine).toContain("2 / 6");
    expect(view.activeStageLine).toMatch(/Creator/i);
    // Structural/holders already done — provisional Fast modules present.
    expect(view.modules.filter((m) => m.progress === 100)).toHaveLength(2);
  });

  it("score/coverage updates independently from progress", () => {
    const view = buildProgressPanelView(
      sampleWorkflow({
        overallProgress: 82,
        analysisCoveragePercent: 40,
      }),
      en.scan,
    );
    expect(view.overallProgress).toBe(82);
    expect(view.analysisCoveragePercent).toBe(40);
    expect(view.overallProgress).not.toBe(view.analysisCoveragePercent);
  });

  it("status copy changes correctly on complete", () => {
    const collecting = buildProgressPanelView(sampleWorkflow(), en.scan);
    expect(collecting.workflowStatusLabel).toBe("Collecting");

    const complete = buildProgressPanelView(
      sampleWorkflow({
        workflowStatus: "complete",
        overallProgress: 100,
        completedModules: 6,
        activeModuleKey: null,
        modules: ANALYSIS_MODULE_KEYS.map((key) => ({
          key,
          status: "done" as const,
          progress: 100,
          messageKey: "progressComplete" as const,
          resolved: true,
          dataComplete: true,
        })),
      }),
      en.scan,
    );
    expect(complete.workflowStatusLabel).toBe("Complete");
    expect(complete.overallProgress).toBe(100);
    expect(complete.activeStageLine).toBeNull();
  });

  it("Traditional Chinese rendering", () => {
    const view = buildProgressPanelView(sampleWorkflow(), zh.scan);
    expect(view.overallLabel).toBe("深度分析");
    expect(view.modulesCompletedLine).toContain("已完成 2 / 6 個模組");
    expect(view.modules.find((m) => m.key === "creator")?.title).toBe(
      "創建者分析",
    );
    expect(view.modules.find((m) => m.key === "creator")?.statusText).toContain(
      "正在掃描創建者歷史",
    );
    expect(zh.scan.progressTimeVaries).toContain("鏈上歷史");
  });

  it("unavailable module copy has no Unknown", () => {
    const view = buildProgressPanelView(
      sampleWorkflow({
        workflowStatus: "unavailable",
        modules: ANALYSIS_MODULE_KEYS.map((key) =>
          key === "liquidity"
            ? {
                key,
                status: "unavailable" as const,
                progress: 61,
                messageKey: "progressUnavailable" as const,
                resolved: true,
                dataComplete: false,
              }
            : {
                key,
                status: "done" as const,
                progress: 100,
                messageKey: "progressComplete" as const,
                resolved: true,
                dataComplete: true,
              },
        ),
      }),
      en.scan,
    );
    const liq = view.modules.find((m) => m.key === "liquidity")!;
    expect(liq.statusText.toLowerCase()).toContain("temporarily unavailable");
    expect(liq.statusText.toLowerCase()).not.toContain("unknown");
    expect(liq.progress).toBe(61);
  });

  it("mobile layout contract: module titles are short single-line labels", () => {
    const view = buildProgressPanelView(sampleWorkflow(), en.scan);
    for (const m of view.modules) {
      expect(m.title.length).toBeLessThan(40);
      expect(m.title).not.toContain("\n");
    }
  });
});
