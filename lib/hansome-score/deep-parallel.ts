/**
 * Cold Perf V2 Phase 6 — true parallel Deep stage orchestration.
 * Phase 7.3 — bounded settlement: publish escape, hard barrier bound, fencing.
 * Performance / scheduling only. Does not change score, LP, burn, or creator semantics.
 *
 * Dependency graph (after Fast base):
 *   relationships ─┐
 *   liquidity     ─┼─► score
 *   creatorBurn   ─┘   (creator+burn share one transfer-index job — never double-fetch)
 *
 * Background continuations (LP exhaustive, transfer-index historical) stay non-blocking.
 */

import {
  stampDeepProgress,
  type DeepProgressStage,
} from "@/lib/hansome-score/deep-progress";
import {
  DEEP_PARALLEL_HARD_BOUND_MS,
  DEEP_PUBLISH_PERSIST_CAP_MS,
  DEEP_TERMINAL_PUBLISH_ESCAPE_MS,
  isTerminalProgressAction,
  raceWithCap,
  type DeepAttemptHandle,
} from "@/lib/hansome-score/deep-settlement";
import {
  beginDeepStallSpan,
  endDeepStallSpan,
} from "@/lib/hansome-score/deep-stall-trace";
import { mergeMonotonicAnalysisStages } from "@/lib/hansome-score/scan-progress";
import type { ScanResponse } from "@/lib/hansome-score/types";

/** Explicit Deep parallel wave — score waits for these only. */
export const DEEP_PARALLEL_STAGE_IDS = [
  "relationships",
  "liquidity",
  "creatorBurn",
] as const;

export type DeepParallelStageId = (typeof DEEP_PARALLEL_STAGE_IDS)[number];

export type DeepParallelDependencyGraph = {
  /** Stages that may run concurrently after Fast base is present. */
  parallelWave: readonly DeepParallelStageId[];
  /** Score depends on the parallel wave settling (done / partial / skipped). */
  scoreDependsOn: readonly DeepParallelStageId[];
  /**
   * Creator and Burn share one transfer-index coordinator job.
   * Never spawn a second Blockscout paging writer for the same token attempt.
   */
  sharedTransferIndexJob: "creatorBurn";
};

export const DEEP_PARALLEL_DEPENDENCY_GRAPH: DeepParallelDependencyGraph = {
  parallelWave: DEEP_PARALLEL_STAGE_IDS,
  scoreDependsOn: DEEP_PARALLEL_STAGE_IDS,
  sharedTransferIndexJob: "creatorBurn",
};

export type DeepProgressPatch = {
  stage: DeepProgressStage;
  action: string;
  completedUnits?: number;
  totalUnits?: number;
  pagesFetched?: number;
  transfersIndexed?: number;
  stalled?: boolean;
  stallReason?: string | null;
};

export type DeepStagePublishApply = (prev: ScanResponse) => ScanResponse;

export type DeepStagePublishOptions = {
  /** Terminal soft-fail / settle — must not await hung persist forever. */
  terminal?: boolean;
  stageAttemptId?: string;
  /** When true, skip if attempt cancelled/finalized (default true for terminal). */
  fence?: boolean;
};

export type DeepStagePublishHub = {
  /**
   * Serialize concurrent stage publishes. `apply` always sees the latest snapshot
   * so sibling stage fields are never clobbered by a stale copy.
   * Persist (onProgress) is capped so hung KV cannot block soft-fail settlement.
   */
  publish: (
    apply: DeepStagePublishApply,
    label: string,
    ms: number,
    progress?: DeepProgressPatch,
    opts?: DeepStagePublishOptions,
  ) => Promise<void>;
  get: () => ScanResponse;
};

/**
 * Mutex'd publish hub for parallel Deep stages.
 * Merges analysisStages monotonically so done never regresses to analyzing.
 * Phase 7.3: onProgress capped; terminal publishes escape a hung chain.
 */
export function createDeepStagePublishHub(opts: {
  get: () => ScanResponse;
  set: (next: ScanResponse) => void;
  onProgress?: (partial: ScanResponse) => Promise<void>;
  logPrefix?: string;
  attempt?: DeepAttemptHandle | null;
}): DeepStagePublishHub {
  let chain: Promise<void> = Promise.resolve();
  const prefix = opts.logPrefix ?? "[scan-deep]";

  const shouldFenceOut = (publishOpts?: DeepStagePublishOptions): boolean => {
    const attempt = opts.attempt;
    if (!attempt) return false;
    if (publishOpts?.fence === false) return false;
    if (attempt.isFinalized()) return true;
    // Allow terminal soft-fail publishes after cancel so stages leave analyzing.
    if (attempt.isCancelled() && publishOpts?.terminal !== true) return true;
    return false;
  };

  const applyLocal = (
    apply: DeepStagePublishApply,
    label: string,
    ms: number,
    progress?: DeepProgressPatch,
  ): ScanResponse => {
    const prev = opts.get();
    let next = apply(prev);
    next = {
      ...next,
      analysisStages:
        mergeMonotonicAnalysisStages(
          prev.analysisStages,
          next.analysisStages,
        ) ?? next.analysisStages,
    };
    const stamped = progress ? stampDeepProgress(next, progress) : next;
    opts.set(stamped);
    console.info(
      `${prefix} stage=${label} ms=${ms} status=${stamped.analysisStatus}` +
        ` seq=${stamped.deepProgress?.sequence ?? "-"} action=${stamped.deepProgress?.action ?? "-"}`,
    );
    return stamped;
  };

  const persistCapped = async (
    stamped: ScanResponse,
    terminal: boolean,
  ): Promise<"completed" | "capped" | "error"> => {
    if (!opts.onProgress) return "completed";
    const raced = await raceWithCap(
      opts.onProgress(stamped),
      DEEP_PUBLISH_PERSIST_CAP_MS,
    );
    if (raced.ok) return "completed";
    if (terminal) {
      console.warn(
        `${prefix} terminal publish persist capped after ${DEEP_PUBLISH_PERSIST_CAP_MS}ms (stage settled locally)`,
      );
    }
    return "capped";
  };

  const publish: DeepStagePublishHub["publish"] = (
    apply,
    label,
    ms,
    progress,
    publishOpts,
  ) => {
    const terminal =
      publishOpts?.terminal === true ||
      isTerminalProgressAction(progress?.action) ||
      label.includes(":timeout") ||
      label.includes(":error") ||
      label.endsWith(":done") ||
      label === "partial" ||
      label === "complete";

    const run = async () => {
      if (shouldFenceOut({ ...publishOpts, terminal })) {
        return;
      }
      // Cancelled attempt: still allow terminal soft-fail so analyzing clears.
      if (
        opts.attempt?.isCancelled() &&
        !terminal &&
        publishOpts?.fence !== false
      ) {
        return;
      }

      const span = beginDeepStallSpan("scan.deep.publish", {
        stage: progress?.stage ?? label,
        operation: progress?.action ?? label,
        publishSequence: (opts.get().deepProgress?.sequence ?? 0) + 1,
        deepAttemptId: opts.attempt?.deepAttemptId ?? opts.get().deepAttemptId,
        token: opts.get().overview?.address,
      });

      const stamped = applyLocal(apply, label, ms, progress);
      try {
        const persistStatus = await persistCapped(stamped, terminal);
        endDeepStallSpan(span, persistStatus === "completed" ? "completed" : "timed_out", {
          publishSequence: stamped.deepProgress?.sequence,
          timeoutReason:
            persistStatus === "capped" ? "publish_persist_cap" : undefined,
        });
      } catch (err) {
        endDeepStallSpan(span, "aborted", {
          timeoutReason: err instanceof Error ? err.message : "onProgress_error",
        });
        // Never fail the settle path on persist errors.
        if (!terminal) throw err;
      }
    };

    if (terminal) {
      // Escape: do not wait forever behind a hung mid-progress chain link.
      const chained = chain.then(run, run);
      chain = chained.catch(() => {});
      return raceWithCap(chained, DEEP_TERMINAL_PUBLISH_ESCAPE_MS).then(
        async (r) => {
          if (r.ok) return;
          // Chain still hung — apply locally so stage leaves analyzing.
          if (shouldFenceOut({ ...publishOpts, terminal: true })) return;
          applyLocal(apply, label, ms, progress);
          const stamped = opts.get();
          void persistCapped(stamped, true);
        },
      );
    }

    chain = chain.then(run, run);
    return chain;
  };

  return { publish, get: opts.get };
}

export type DeepParallelJob = {
  id: DeepParallelStageId;
  skip: boolean;
  run: () => Promise<void>;
};

/**
 * Phase 7: given a warm stage plan, mark parallel jobs skip/reuse.
 * Does not change job bodies — orchestration only.
 */
export function applyWarmSkipToParallelJobs(
  jobs: DeepParallelJob[],
  skip: Partial<Record<DeepParallelStageId, boolean>>,
): DeepParallelJob[] {
  return jobs.map((j) => ({
    ...j,
    skip: skip[j.id] === true ? true : j.skip,
  }));
}

export class DeepParallelHardBoundError extends Error {
  constructor(message = "Deep parallel wave hard bound exceeded") {
    super(message);
    this.name = "DeepParallelHardBoundError";
  }
}

/**
 * Run independent Deep stages concurrently. Skipped jobs are no-ops.
 * Phase 7.3: each job is wrapped; barrier has a hard upper bound so score
 * finalization is never blocked indefinitely by a hung sibling.
 */
export async function runParallelDeepJobs(
  jobs: DeepParallelJob[],
  opts?: {
    onJobSettled?: (id: DeepParallelStageId, ok: boolean, err?: unknown) => void;
    hardBoundMs?: number;
    attempt?: DeepAttemptHandle | null;
    onHardBound?: () => void;
  },
): Promise<void> {
  const active = jobs.filter((j) => !j.skip);
  if (active.length === 0) return;

  const hardBoundMs = opts?.hardBoundMs ?? DEEP_PARALLEL_HARD_BOUND_MS;
  const settleSpan = beginDeepStallSpan("parallel.await.settle", {
    operation: active.map((j) => j.id).join(","),
    stage: "parallel",
  });

  const jobPromises = active.map(async (job) => {
    const jobSpan = beginDeepStallSpan(`${job.id}.start`, {
      stage: job.id,
      operation: "run",
    });
    try {
      await job.run();
      endDeepStallSpan(jobSpan, "completed");
      opts?.onJobSettled?.(job.id, true);
    } catch (err) {
      endDeepStallSpan(jobSpan, "aborted", {
        timeoutReason: err instanceof Error ? err.message : "job_error",
      });
      opts?.onJobSettled?.(job.id, false, err);
      throw err;
    }
  });

  let hardBoundTimer: ReturnType<typeof setTimeout> | undefined;
  const hardBoundPromise = new Promise<"hard_bound">((resolve) => {
    hardBoundTimer = setTimeout(() => resolve("hard_bound"), hardBoundMs);
  });

  const allSettled = Promise.allSettled(jobPromises).then((results) => ({
    kind: "settled" as const,
    results,
  }));

  try {
    const outcome = await Promise.race([allSettled, hardBoundPromise]);
    if (outcome === "hard_bound") {
      beginDeepStallSpan("parallel.hard_bound", {
        stage: "parallel",
        operation: "hard_bound",
        deepAttemptId: opts?.attempt?.deepAttemptId,
      });
      console.warn(
        `[deep-parallel] hard bound ${hardBoundMs}ms exceeded — detaching barrier for score finalization`,
      );
      opts?.attempt?.cancel("hard_bound");
      opts?.onHardBound?.();
      endDeepStallSpan(settleSpan, "timed_out", {
        timeoutReason: `hard_bound_${hardBoundMs}`,
      });
      // Detach: do not await remaining jobs. Soft-fail path in jobs should
      // observe abort; score proceeds with available evidence.
      return;
    }
    endDeepStallSpan(settleSpan, "completed");
    for (const r of outcome.results) {
      if (r.status === "rejected") throw r.reason;
    }
  } finally {
    if (hardBoundTimer) clearTimeout(hardBoundTimer);
  }
}

/** True when every parallel-wave dependency is terminal or was skipped. */
export function parallelWaveSettled(params: {
  relationshipsTerminal: boolean;
  liquidityTerminal: boolean;
  creatorBurnTerminal: boolean;
}): boolean {
  return (
    params.relationshipsTerminal &&
    params.liquidityTerminal &&
    params.creatorBurnTerminal
  );
}

function uniqStrings(a?: string[], b?: string[]): string[] {
  return [...(a ?? []), ...(b ?? [])].filter(
    (d, i, arr) => arr.indexOf(d) === i,
  );
}

/**
 * Merge a stage's published snapshot onto the latest authoritative snapshot.
 * Sibling stage fields on `prev` win over stale copies inside `incoming`.
 */
export function mergeParallelStageWrite(
  prev: ScanResponse,
  incoming: ScanResponse,
  focus?: DeepProgressStage | string | null,
): ScanResponse {
  const stage = focus ?? "";
  const stages =
    mergeMonotonicAnalysisStages(prev.analysisStages, incoming.analysisStages) ??
    incoming.analysisStages ??
    prev.analysisStages;

  const oPrev = prev.overview;
  const oIn = incoming.overview;
  if (!oPrev) return { ...incoming, analysisStages: stages };
  if (!oIn) {
    return {
      ...prev,
      analysisStatus: incoming.analysisStatus ?? prev.analysisStatus,
      analysisStages: stages,
      disclaimers: uniqStrings(prev.disclaimers, incoming.disclaimers),
    };
  }

  const label = String(stage);
  const takeRel =
    label === "relationships" || label.startsWith("relationships");
  const takeLiq = label === "liquidity" || label.startsWith("liquidity");
  const takeCreatorBurn =
    label === "creatorBurn" || label.startsWith("creatorBurn");
  const takeScore =
    label === "score" ||
    label === "partial" ||
    label === "complete" ||
    label.startsWith("score");

  if (takeScore) {
    return {
      ...incoming,
      analysisStages: stages,
      overview: {
        ...oPrev,
        ...oIn,
        // Preserve any sibling fields that landed on prev after incoming was built.
        relationship: oIn.relationship ?? oPrev.relationship,
        lpIntelligence: oIn.lpIntelligence ?? oPrev.lpIntelligence,
        lpLockStatus: oIn.lpLockStatus ?? oPrev.lpLockStatus,
        lpLockDetail: oIn.lpLockDetail ?? oPrev.lpLockDetail,
        poolId: oIn.poolId ?? oPrev.poolId,
        creatorBehaviour: oIn.creatorBehaviour ?? oPrev.creatorBehaviour,
        supplyBurn: oIn.supplyBurn ?? oPrev.supplyBurn,
      },
      disclaimers: uniqStrings(prev.disclaimers, incoming.disclaimers),
    };
  }

  const overview = {
    ...oPrev,
    ...(takeRel
      ? {
          relationship: oIn.relationship ?? oPrev.relationship,
        }
      : {}),
    ...(takeLiq
      ? {
          poolId: oIn.poolId ?? oPrev.poolId,
          lpLockStatus: oIn.lpLockStatus ?? oPrev.lpLockStatus,
          lpLockDetail: oIn.lpLockDetail ?? oPrev.lpLockDetail,
          lpIntelligence: oIn.lpIntelligence ?? oPrev.lpIntelligence,
        }
      : {}),
    ...(takeCreatorBurn
      ? {
          creatorBehaviour: oIn.creatorBehaviour ?? oPrev.creatorBehaviour,
          supplyBurn: oIn.supplyBurn ?? oPrev.supplyBurn,
        }
      : {}),
  };

  return {
    ...prev,
    analysisStatus: incoming.analysisStatus ?? prev.analysisStatus,
    analysisPhase: incoming.analysisPhase ?? prev.analysisPhase,
    scoreProvisional:
      incoming.scoreProvisional ?? prev.scoreProvisional,
    analysisStages: stages,
    liquidityUsd: takeLiq
      ? (incoming.liquidityUsd ?? prev.liquidityUsd)
      : prev.liquidityUsd,
    overview,
    disclaimers: uniqStrings(prev.disclaimers, incoming.disclaimers),
    activity: prev.activity,
    overall: prev.overall,
    score: prev.score,
    structural: prev.structural,
    confidence: prev.confidence,
    hansomeLevel: prev.hansomeLevel,
    uiWording: incoming.uiWording ?? prev.uiWording,
  };
}
