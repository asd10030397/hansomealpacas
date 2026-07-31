/**
 * Durable Deep scan progress metadata — orchestration/progress only.
 * Does not change scores, classifications, or risk semantics.
 */

import type { AnalysisStages, ScanResponse } from "@/lib/hansome-score/types";

/** Pipeline stage labels stamped onto ScanResponse.deepProgress. */
export type DeepProgressStage =
  | "relationships"
  | "liquidity"
  | "creatorBurn"
  | "score"
  | "partial"
  | "complete";

export type DeepProgressMeta = {
  /** Monotonic publish sequence within a deepAttemptId (survives isolate switches via KV). */
  sequence: number;
  /** ISO timestamp of last real progress publish. */
  updatedAt: string;
  stage: DeepProgressStage;
  /** Short machine action id (e.g. page, funder, probe). */
  action: string;
  completedUnits?: number;
  totalUnits?: number;
  /** Optional pages / transfers mirrors for UI without re-deriving. */
  pagesFetched?: number;
  transfersIndexed?: number;
  /** True when watchdog marked this snapshot as stalled (honest; not fake %). */
  stalled?: boolean;
  stallReason?: string;
};

/** No progress publish for this long → stall watchdog (honest status, not fake %). */
export const DEEP_PROGRESS_STALL_MS = 45_000;

/** Cap internal progress before stage finalize. */
export const DEEP_INTERNAL_PROGRESS_CAP = 95;

/**
 * Asymptotic 1–95% when total is unknown.
 * Tied to real completedUnits — never timer-fabricated.
 */
export function asymptoticInternalProgress(
  completedUnits: number,
  opts?: { halfLifeUnits?: number; startPct?: number; capPct?: number },
): number {
  const start = opts?.startPct ?? 2;
  const cap = opts?.capPct ?? DEEP_INTERNAL_PROGRESS_CAP;
  const half = Math.max(1, opts?.halfLifeUnits ?? 4);
  const u = Math.max(0, completedUnits);
  if (u <= 0) return start;
  const ratio = 1 - Math.exp(-u / half);
  return Math.min(cap, Math.round(start + (cap - start) * ratio));
}

/** Linear page band: first page ≥25, approaches cap while incomplete. */
export function pageInternalProgress(
  pages: number,
  target: number,
  opts?: { startPct?: number; capPct?: number },
): number {
  const start = opts?.startPct ?? 10;
  const cap = opts?.capPct ?? DEEP_INTERNAL_PROGRESS_CAP;
  if (pages <= 0) return start;
  const total = Math.max(1, target);
  const ratio = Math.min(1, pages / total);
  return Math.min(cap, Math.round(25 + ratio * (cap - 25)));
}

export function isDeepStageTerminal(
  st: AnalysisStages[keyof AnalysisStages] | undefined,
): boolean {
  return st === "done" || st === "partial" || st === "failed" || st === "unknown";
}

/**
 * Which Deep pipeline segment last advanced (Phase 6 parallel orchestration).
 * Prefer durable deepProgress.stage when that stage is still non-terminal;
 * otherwise pick any active parallel stage (not sequential gating).
 */
export function resolveDeepPipelineFocus(
  stages: AnalysisStages | undefined,
  deepProgress?: DeepProgressMeta | null,
): DeepProgressStage {
  if (deepProgress?.stage === "complete" || deepProgress?.stage === "partial") {
    return deepProgress.stage;
  }
  if (deepProgress?.stage === "score") return "score";

  const dp = deepProgress?.stage;
  if (dp === "creatorBurn") {
    const creatorPending =
      !isDeepStageTerminal(stages?.creator) ||
      !isDeepStageTerminal(stages?.burn) ||
      (stages?.burn === "partial" && stages?.creator !== "done");
    if (creatorPending || stages?.creator === "analyzing" || stages?.burn === "analyzing") {
      return "creatorBurn";
    }
  }
  if (dp === "liquidity" && !isDeepStageTerminal(stages?.liquidity)) {
    return "liquidity";
  }
  if (dp === "relationships" && !isDeepStageTerminal(stages?.relationships)) {
    return "relationships";
  }

  // Parallel fallback: any active wave stage; score last.
  if (!isDeepStageTerminal(stages?.liquidity) && stages?.liquidity === "analyzing") {
    return "liquidity";
  }
  const creatorPending =
    stages?.creator === "analyzing" ||
    stages?.creator === "pending" ||
    stages?.burn === "analyzing" ||
    stages?.burn === "pending" ||
    (stages?.burn === "partial" && stages?.creator !== "done");
  if (creatorPending) return "creatorBurn";
  if (!isDeepStageTerminal(stages?.relationships)) return "relationships";
  if (!isDeepStageTerminal(stages?.liquidity)) return "liquidity";
  if (stages?.score !== "done") return "score";
  return "complete";
}

export function stampDeepProgress(
  response: ScanResponse,
  patch: {
    stage: DeepProgressStage;
    action: string;
    completedUnits?: number;
    totalUnits?: number;
    pagesFetched?: number;
    transfersIndexed?: number;
    stalled?: boolean;
    stallReason?: string | null;
  },
): ScanResponse {
  const prev = response.deepProgress;
  const sequence = (prev?.sequence ?? 0) + 1;
  const next: DeepProgressMeta = {
    sequence,
    updatedAt: new Date().toISOString(),
    stage: patch.stage,
    action: patch.action,
    completedUnits: patch.completedUnits,
    totalUnits: patch.totalUnits,
    pagesFetched: patch.pagesFetched ?? prev?.pagesFetched,
    transfersIndexed: patch.transfersIndexed ?? prev?.transfersIndexed,
    stalled: patch.stalled === true ? true : undefined,
    stallReason:
      patch.stallReason === null
        ? undefined
        : (patch.stallReason ?? (patch.stalled ? prev?.stallReason : undefined)),
  };
  return { ...response, deepProgress: next };
}

/** True when deep_running and last progress publish is older than stall threshold. */
export function isDeepProgressStalled(
  response: Pick<
    ScanResponse,
    "analysisStatus" | "deepProgress" | "deepStartedAt"
  >,
  now = Date.now(),
  thresholdMs = DEEP_PROGRESS_STALL_MS,
): boolean {
  if (response.analysisStatus !== "deep_running") return false;
  const updatedAt = response.deepProgress?.updatedAt ?? response.deepStartedAt;
  if (!updatedAt) return false;
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return false;
  return now - t >= thresholdMs;
}

/**
 * Finalization ladder — maps real lifecycle events to near-complete overall %.
 * Never used alone for mid-work; only when stages have real terminal evidence.
 */
export function finalizationOverallHint(
  event: "stages_settled" | "score_analyzing" | "score_done" | "complete",
): number {
  switch (event) {
    case "stages_settled":
      return 92;
    case "score_analyzing":
      return 96;
    case "score_done":
      return 98;
    case "complete":
      return 100;
  }
}
