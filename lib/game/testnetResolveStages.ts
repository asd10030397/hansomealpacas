/**
 * Testnet gasless resolve pipeline stages (UX + timing only — not game rules).
 */

export type TestnetResolveStage =
  | "idle"
  | "checking"
  | "waiting_seed"
  | "revealing"
  | "settling"
  | "finalizing"
  | "completed"
  | "error";

export type TestnetResolveTimings = {
  /** Wall time for the full POST /testnet-resolve call. */
  totalMs: number;
  seedMs: number | null;
  revealMs: number | null;
  settleMs: number | null;
  /** Where the pipeline stopped / last progressed. */
  stage: TestnetResolveStage;
};

export type TestnetResolveTimingSample = TestnetResolveTimings & {
  day: number;
  at: number;
  alreadySettled: boolean;
  ok: boolean;
};

/** Derive UI stage from a resolve response (client or server). */
export function stageFromResolveFlags(input: {
  alreadySettled?: boolean;
  finalized?: boolean;
  settleTxHash?: string | null;
  seedTxHash?: string | null;
  seedSkipped?: boolean;
  revealed?: number;
  revealTxHash?: string | null;
  hasSeed?: boolean | null;
  settledOnChain?: boolean | null;
  error?: string | null;
}): TestnetResolveStage {
  if (input.error) return "error";
  // Credits complete only — not merely finalizeDay / last settleTxHash.
  if (input.alreadySettled || input.settledOnChain) {
    return "completed";
  }
  if (input.finalized) {
    return "finalizing";
  }
  if (input.settleTxHash === undefined && input.hasSeed === false) {
    return "waiting_seed";
  }
  // Seed just written or still missing after attempt.
  if (!input.seedSkipped && input.seedTxHash) {
    if ((input.revealed ?? 0) > 0 || input.revealTxHash) return "revealing";
    return "settling";
  }
  if (input.hasSeed === false) return "waiting_seed";
  if ((input.revealed ?? 0) > 0 || input.revealTxHash) {
    return "settling";
  }
  if (input.seedSkipped || input.hasSeed) return "settling";
  return "checking";
}

export function emptyTimings(stage: TestnetResolveStage = "checking"): TestnetResolveTimings {
  return {
    totalMs: 0,
    seedMs: null,
    revealMs: null,
    settleMs: null,
    stage,
  };
}

export function summarizeTimingSamples(samples: TestnetResolveTimingSample[]): {
  count: number;
  avgTotalMs: number | null;
  maxTotalMs: number | null;
  avgSeedMs: number | null;
  avgRevealMs: number | null;
  avgSettleMs: number | null;
  bottleneck: "seed" | "reveal" | "settle" | "unknown";
} {
  if (samples.length === 0) {
    return {
      count: 0,
      avgTotalMs: null,
      maxTotalMs: null,
      avgSeedMs: null,
      avgRevealMs: null,
      avgSettleMs: null,
      bottleneck: "unknown",
    };
  }
  const totals = samples.map((s) => s.totalMs);
  const seeds = samples.map((s) => s.seedMs).filter((n): n is number => n != null);
  const reveals = samples.map((s) => s.revealMs).filter((n): n is number => n != null);
  const settles = samples.map((s) => s.settleMs).filter((n): n is number => n != null);
  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const avgSeedMs = avg(seeds);
  const avgRevealMs = avg(reveals);
  const avgSettleMs = avg(settles);
  const parts: Array<{ k: "seed" | "reveal" | "settle"; v: number }> = [];
  if (avgSeedMs != null) parts.push({ k: "seed", v: avgSeedMs });
  if (avgRevealMs != null) parts.push({ k: "reveal", v: avgRevealMs });
  if (avgSettleMs != null) parts.push({ k: "settle", v: avgSettleMs });
  parts.sort((a, b) => b.v - a.v);
  return {
    count: samples.length,
    avgTotalMs: avg(totals),
    maxTotalMs: Math.max(...totals),
    avgSeedMs,
    avgRevealMs,
    avgSettleMs,
    bottleneck: parts[0]?.k ?? "unknown",
  };
}
