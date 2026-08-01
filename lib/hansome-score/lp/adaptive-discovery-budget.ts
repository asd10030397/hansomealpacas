/**
 * Phase 13D.2 — Adaptive Discovery Budget.
 *
 * Replaces fixed hard timeouts with adaptive budgets that continue while
 * measurable forward progress is observed. Terminates only on:
 *   - success
 *   - honest partial (explicit)
 *   - no forward progress (stall)
 *   - absolute max ceiling
 *
 * Orchestration only — does not change score / ownership / lock formulas.
 */

export type AdaptiveTerminationReason =
  | "success"
  | "honest_partial"
  | "no_forward_progress"
  | "max_budget_exhausted"
  | "external_abort"
  | "still_running";

export type AdaptiveDiscoveryDiagnostics = {
  elapsedMs: number;
  progressDelta: number;
  cumulativeProgress: number;
  stageBudgetMs: number;
  baseBudgetMs: number;
  maxBudgetMs: number;
  expansionCount: number;
  lastProgressAtElapsedMs: number | null;
  stallMs: number;
  terminationReason: AdaptiveTerminationReason;
};

export type AdaptiveDiscoveryBudgetConfig = {
  baseBudgetMs: number;
  maxBudgetMs: number;
  /** No progress for this long → terminate. */
  stallMs: number;
  /** Each expansion adds this many ms (capped by max). */
  expansionStepMs: number;
  maxExpansions: number;
  now?: () => number;
};

export const ADAPTIVE_LIQUIDITY_BUDGET = {
  baseBudgetMs: 180_000,
  maxBudgetMs: 255_000,
  stallMs: 28_000,
  expansionStepMs: 20_000,
  maxExpansions: 5,
} as const;

export const ADAPTIVE_VERSION_BUDGETS = {
  v2: {
    baseBudgetMs: 30_000,
    maxBudgetMs: 45_000,
    stallMs: 12_000,
    expansionStepMs: 8_000,
    maxExpansions: 2,
  },
  v3: {
    baseBudgetMs: 90_000,
    maxBudgetMs: 160_000,
    stallMs: 25_000,
    expansionStepMs: 25_000,
    maxExpansions: 3,
  },
  v4: {
    baseBudgetMs: 55_000,
    maxBudgetMs: 130_000,
    stallMs: 20_000,
    expansionStepMs: 20_000,
    maxExpansions: 4,
  },
} as const;

/** Parallel hard-bound ceiling while adaptive liquidity is still progressing. */
export const ADAPTIVE_HARD_BOUND_MAX_MS = 260_000;

export class AdaptiveDiscoveryBudget {
  readonly baseBudgetMs: number;
  readonly maxBudgetMs: number;
  readonly stallMs: number;
  readonly expansionStepMs: number;
  readonly maxExpansions: number;
  private readonly now: () => number;
  private readonly startedAt: number;
  private stageBudgetMs: number;
  private expansionCount = 0;
  private cumulativeProgress = 0;
  private lastProgressAt: number | null = null;
  private terminationReason: AdaptiveTerminationReason = "still_running";

  constructor(config: AdaptiveDiscoveryBudgetConfig) {
    this.baseBudgetMs = Math.max(1_000, config.baseBudgetMs);
    this.maxBudgetMs = Math.max(this.baseBudgetMs, config.maxBudgetMs);
    this.stallMs = Math.max(1_000, config.stallMs);
    this.expansionStepMs = Math.max(1_000, config.expansionStepMs);
    this.maxExpansions = Math.max(0, config.maxExpansions);
    this.now = config.now ?? Date.now;
    this.startedAt = this.now();
    this.stageBudgetMs = this.baseBudgetMs;
  }

  elapsedMs(): number {
    return Math.max(0, this.now() - this.startedAt);
  }

  /**
   * Record measurable forward progress (candidates found, positions evaluated,
   * stages advanced, heartbeats with new units, etc.).
   */
  noteProgress(delta = 1): void {
    if (this.terminationReason !== "still_running") return;
    const d = Number.isFinite(delta) ? Math.max(0, delta) : 0;
    if (d <= 0) return;
    this.cumulativeProgress += d;
    this.lastProgressAt = this.now();
    // Seed lastProgress so stall clock starts only after first real signal.
    this.maybeExpand();
  }

  /** Lightweight heartbeat (in-flight work) — resets stall without requiring units. */
  noteHeartbeat(): void {
    if (this.terminationReason !== "still_running") return;
    this.lastProgressAt = this.now();
    this.maybeExpand();
  }

  private maybeExpand(): void {
    if (this.expansionCount >= this.maxExpansions) return;
    if (this.stageBudgetMs >= this.maxBudgetMs) return;
    // Expand when we are within the last expansionStep of the current budget
    // and still making progress.
    const elapsed = this.elapsedMs();
    if (elapsed < this.stageBudgetMs - this.expansionStepMs) return;
    this.expansionCount += 1;
    this.stageBudgetMs = Math.min(
      this.maxBudgetMs,
      this.stageBudgetMs + this.expansionStepMs,
    );
  }

  /** Remaining ms under current (possibly expanded) stage budget. */
  remainingMs(): number {
    return Math.max(0, this.stageBudgetMs - this.elapsedMs());
  }

  currentStageBudgetMs(): number {
    return this.stageBudgetMs;
  }

  /**
   * Whether work should continue. False when stalled / exhausted / terminal.
   */
  shouldContinue(): boolean {
    if (this.terminationReason !== "still_running") return false;
    const elapsed = this.elapsedMs();
    if (elapsed >= this.maxBudgetMs && this.remainingMs() <= 0) {
      this.terminationReason = "max_budget_exhausted";
      return false;
    }
    if (elapsed >= this.stageBudgetMs) {
      // Allow one more expansion check if progress was recent
      this.maybeExpand();
      if (elapsed >= this.stageBudgetMs) {
        this.terminationReason = "max_budget_exhausted";
        return false;
      }
    }
    if (this.lastProgressAt != null) {
      const sinceProgress = this.now() - this.lastProgressAt;
      if (sinceProgress >= this.stallMs) {
        this.terminationReason = "no_forward_progress";
        return false;
      }
    } else if (elapsed >= this.stallMs) {
      // Never made progress within stall window from start
      this.terminationReason = "no_forward_progress";
      return false;
    }
    return true;
  }

  markSuccess(): void {
    this.terminationReason = "success";
  }

  markHonestPartial(): void {
    this.terminationReason = "honest_partial";
  }

  markExternalAbort(): void {
    this.terminationReason = "external_abort";
  }

  diagnostics(): AdaptiveDiscoveryDiagnostics {
    const elapsed = this.elapsedMs();
    const lastProgressAtElapsedMs =
      this.lastProgressAt == null
        ? null
        : Math.max(0, this.lastProgressAt - this.startedAt);
    const progressDelta =
      this.lastProgressAt == null
        ? 0
        : Math.max(0, this.cumulativeProgress);
    return {
      elapsedMs: elapsed,
      progressDelta,
      cumulativeProgress: this.cumulativeProgress,
      stageBudgetMs: this.stageBudgetMs,
      baseBudgetMs: this.baseBudgetMs,
      maxBudgetMs: this.maxBudgetMs,
      expansionCount: this.expansionCount,
      lastProgressAtElapsedMs,
      stallMs: this.stallMs,
      terminationReason: this.terminationReason,
    };
  }
}

/**
 * Adaptive timed probe: extends while `onTick` reports progress via budget.noteProgress.
 * Resolves with work result on success, or onTimeout() on stall / max budget.
 */
export function adaptiveTimedProbe<T>(params: {
  label: string;
  config: AdaptiveDiscoveryBudgetConfig;
  work: (budget: AdaptiveDiscoveryBudget) => Promise<T>;
  onTimeout: (budget: AdaptiveDiscoveryBudget) => T;
  /** Optional poll interval to evaluate stall (default 2s). */
  pollMs?: number;
}): Promise<{ result: T; budget: AdaptiveDiscoveryBudget }> {
  const budget = new AdaptiveDiscoveryBudget(params.config);
  const pollMs = params.pollMs ?? 2_000;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: T) => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      resolve({ result, budget });
    };

    const timer = setInterval(() => {
      if (settled) return;
      if (!budget.shouldContinue()) {
        console.warn(
          `[lp-adaptive] ${params.label} terminate reason=${budget.diagnostics().terminationReason}` +
            ` elapsed=${budget.elapsedMs()}ms expansions=${budget.diagnostics().expansionCount}`,
        );
        finish(params.onTimeout(budget));
      }
    }, pollMs);

    void params
      .work(budget)
      .then((r) => {
        if (settled) return;
        budget.markSuccess();
        finish(r);
      })
      .catch((err) => {
        if (settled) return;
        console.warn(`[lp-adaptive] ${params.label} error:`, err);
        budget.markHonestPartial();
        finish(params.onTimeout(budget));
      });
  });
}

/**
 * Compute parallel hard-bound ms given absolute deadline remaining and
 * whether known-bootstrap / adaptive liquidity is active.
 */
export function computeAdaptiveHardBoundMs(params: {
  remainingDeadlineMs: number;
  adaptiveLiquidityMaxMs?: number;
}): number {
  const maxBound = Math.min(
    ADAPTIVE_HARD_BOUND_MAX_MS,
    params.adaptiveLiquidityMaxMs ?? ADAPTIVE_LIQUIDITY_BUDGET.maxBudgetMs + 5_000,
  );
  return Math.min(params.remainingDeadlineMs + 5_000, maxBound);
}
