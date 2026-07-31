/**
 * Heavy-token Collecting UX helpers (pure — safe for Client Components).
 * Does not change Deep budgets, Burn semantics, or scoring.
 */

import type { AnalysisStageId } from "@/lib/hansome-score/types";
import { MAX_DEEP_AUTO_RETRIES } from "@/lib/hansome-score/scan-progress";

/** Soft UX estimate ceilings (ms) — not hard timeouts / not budget inflation. */
export const DEEP_STAGE_ESTIMATE_MS: Partial<Record<AnalysisStageId, number>> = {
  relationships: 15_000,
  creator: 120_000,
  burn: 120_000,
  liquidity: 240_000,
};

export function stageEstimateExceeded(
  elapsedMs: number,
  ceilingMs: number | null | undefined,
): boolean {
  if (ceilingMs == null || !Number.isFinite(ceilingMs) || ceilingMs <= 0) {
    return false;
  }
  return elapsedMs > ceilingMs;
}

/**
 * Keep short ETA initially; after the soft ceiling, replace with heavy-history copy.
 */
export function collectingEtaMessage(params: {
  exceeded: boolean;
  estimateLabel: string;
  stillAnalyzingLabel: string;
}): string {
  return params.exceeded ? params.stillAnalyzingLabel : params.estimateLabel;
}

/** User-facing retry attempt is 1-based: first Deep pass = attempt 1. */
export function deepRetryAttemptDisplay(deepRetryCount: number | null | undefined): {
  attempt: number;
  max: number;
} {
  const settledPartials = Math.max(0, Math.trunc(deepRetryCount ?? 0));
  return {
    attempt: settledPartials + 1,
    max: MAX_DEEP_AUTO_RETRIES + 1,
  };
}

export function hasTransferIndexProgress(params: {
  pagesFetched?: number | null;
  transfersIndexed?: number | null;
}): boolean {
  return (
    (params.pagesFetched != null && params.pagesFetched > 0) ||
    (params.transfersIndexed != null && params.transfersIndexed > 0)
  );
}
