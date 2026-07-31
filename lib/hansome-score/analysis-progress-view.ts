/**
 * Locale-facing view model for Deep progress bars (no React).
 * Keeps Progress vs Coverage separate for UI consumers/tests.
 */

import type {
  AnalysisModuleKey,
  AnalysisModuleProgress,
  AnalysisProgressMessageKey,
  AnalysisWorkflowProgress,
  AnalysisWorkflowStatus,
} from "@/lib/hansome-score/analysis-progress";

export type ProgressCopyBag = Record<
  | AnalysisProgressMessageKey
  | "progressOverallLabel"
  | "progressModulesCompleted"
  | "progressActiveStage"
  | "progressTimeVaries"
  | "progressUnavailableDetail"
  | "progressWorkflowCollecting"
  | "progressWorkflowRetrying"
  | "progressWorkflowComplete"
  | "progressWorkflowUnavailable"
  | "moduleProgressStructural"
  | "moduleProgressHolders"
  | "moduleProgressLiquidity"
  | "moduleProgressBurn"
  | "moduleProgressCreator"
  | "moduleProgressRelationships",
  string
>;

function fill(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function moduleTitleFromCopy(
  s: ProgressCopyBag,
  key: AnalysisModuleKey,
): string {
  switch (key) {
    case "structural":
      return s.moduleProgressStructural;
    case "holders":
      return s.moduleProgressHolders;
    case "liquidity":
      return s.moduleProgressLiquidity;
    case "burn":
      return s.moduleProgressBurn;
    case "creator":
      return s.moduleProgressCreator;
    case "relationships":
      return s.moduleProgressRelationships;
  }
}

export function workflowStatusLabelFromCopy(
  s: ProgressCopyBag,
  status: AnalysisWorkflowStatus,
): string {
  switch (status) {
    case "collecting":
      return s.progressWorkflowCollecting;
    case "retrying":
      return s.progressWorkflowRetrying;
    case "complete":
      return s.progressWorkflowComplete;
    case "unavailable":
      return s.progressWorkflowUnavailable;
  }
}

export type ProgressPanelView = {
  overallLabel: string;
  overallProgress: number;
  /** Analysis coverage — never equalized with overallProgress in UI. */
  analysisCoveragePercent: number | null;
  workflowStatus: AnalysisWorkflowStatus;
  workflowStatusLabel: string;
  modulesCompletedLine: string;
  activeStageLine: string | null;
  unavailableDetail: string | null;
  modules: Array<{
    key: AnalysisModuleKey;
    title: string;
    progress: number;
    statusText: string;
    unavailable: boolean;
  }>;
};

export function buildProgressPanelView(
  workflow: AnalysisWorkflowProgress,
  s: ProgressCopyBag,
): ProgressPanelView {
  const activeTitle = workflow.activeModuleKey
    ? moduleTitleFromCopy(s, workflow.activeModuleKey)
    : null;
  const activeModule = workflow.activeModuleKey
    ? workflow.modules.find((m) => m.key === workflow.activeModuleKey)
    : null;

  return {
    overallLabel: s.progressOverallLabel,
    overallProgress: workflow.overallProgress,
    analysisCoveragePercent: workflow.analysisCoveragePercent,
    workflowStatus: workflow.workflowStatus,
    workflowStatusLabel: workflowStatusLabelFromCopy(s, workflow.workflowStatus),
    modulesCompletedLine: fill(s.progressModulesCompleted, {
      done: workflow.completedModules,
      total: workflow.totalModules,
    }),
    activeStageLine:
      workflow.workflowStatus === "collecting" ||
      workflow.workflowStatus === "retrying"
        ? activeTitle
          ? fill(s.progressActiveStage, { stage: activeTitle })
          : activeModule
            ? s[activeModule.messageKey]
            : s.progressCollecting
        : null,
    unavailableDetail:
      workflow.workflowStatus === "unavailable"
        ? s.progressUnavailableDetail
        : null,
    modules: workflow.modules.map((m: AnalysisModuleProgress) => {
      const unavailable = m.status === "unavailable";
      const statusText =
        unavailable && m.progress < 100
          ? `${s[m.messageKey]} — ${s.progressUnavailableDetail}`
          : s[m.messageKey];
      return {
        key: m.key,
        title: moduleTitleFromCopy(s, m.key),
        progress: m.progress,
        statusText,
        unavailable,
      };
    }),
  };
}
