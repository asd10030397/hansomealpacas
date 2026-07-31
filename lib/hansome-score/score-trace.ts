/**
 * Deterministic Overall score trace (observation only).
 * Does NOT change scoring formulas — wraps existing overall.ts helpers.
 */

import {
  OVERALL_WEIGHTS,
  applyStructuralSafetyGate,
  computeOverallTokenScore,
  scoreActivityHealth,
  scoreHolderAdoption,
  scoreLiquidityDepth,
  scoreMaturity,
  type OverallComponentId,
  type OverallScoreInput,
  type OverallScoreResult,
} from "@/lib/hansome-score/overall";

export type ScoreComponentTrace = {
  id: OverallComponentId;
  componentScore: number;
  weight: number;
  contribution: number;
  contributionRounded6: number;
  provenance: string;
};

export type ScoreTrace = {
  version: string;
  input: OverallScoreInput;
  components: Record<OverallComponentId, number>;
  componentTraces: ScoreComponentTrace[];
  weightedRaw: number;
  weightedRawRounded6: number;
  afterSafetyGate: number;
  capsApplied: string[];
  finalScore: number;
  /** Math.round on gated weighted blend (same as clamp100 in overall.ts). */
  roundingStep: "Math.round(gatedWeighted)";
  note: string;
};

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Build a field-level score trace without mutating formula semantics.
 */
export function buildOverallScoreTrace(
  input: OverallScoreInput,
  provenance: Partial<Record<OverallComponentId | "input", string>> = {},
): ScoreTrace {
  const result: OverallScoreResult = computeOverallTokenScore(input);
  const componentTraces: ScoreComponentTrace[] = (
    Object.keys(OVERALL_WEIGHTS) as OverallComponentId[]
  ).map((id) => {
    const componentScore = result.components[id];
    const weight = OVERALL_WEIGHTS[id];
    const contribution = componentScore * weight;
    return {
      id,
      componentScore,
      weight,
      contribution,
      contributionRounded6: round6(contribution),
      provenance: provenance[id] ?? provenance.input ?? "unspecified",
    };
  });

  let weightedRaw = 0;
  for (const t of componentTraces) weightedRaw += t.contribution;
  const gated = applyStructuralSafetyGate(weightedRaw, result.components.structural);

  return {
    version: result.version,
    input: { ...input },
    components: { ...result.components },
    componentTraces,
    weightedRaw,
    weightedRawRounded6: round6(weightedRaw),
    afterSafetyGate: gated.score,
    capsApplied: gated.caps,
    finalScore: result.score,
    roundingStep: "Math.round(gatedWeighted)",
    note: result.note,
  };
}

/** Piecewise bucket labels for rounding / threshold audits. */
export function scoreInputBucketLabels(input: OverallScoreInput): Record<string, string> {
  const liq = scoreLiquidityDepth({
    liquidityUsd: input.liquidityUsd,
    poolInventoryPctOfSupply: input.poolInventoryPctOfSupply,
    sizeWarning: input.sizeWarning,
  });
  return {
    liquidityDepth: `score=${liq}`,
    holderAdoption: `score=${scoreHolderAdoption(input.holdersCount, input.top10AdjustedPct)}`,
    activity: `score=${scoreActivityHealth(input.volume24hUsd, input.transactions24h)}`,
    maturity: `score=${scoreMaturity(input.tokenAgeDays)}`,
    dataConfidence: `score=${Math.round(input.dataConfidencePercent)}`,
    structural: `score=${Math.round(input.structuralScore)}`,
  };
}

export type FieldDiff = {
  path: string;
  a: unknown;
  b: unknown;
  equal: boolean;
};

export function diffFields(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  prefix = "",
): FieldDiff[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: FieldDiff[] = [];
  for (const k of [...keys].sort()) {
    const path = prefix ? `${prefix}.${k}` : k;
    const av = a[k];
    const bv = b[k];
    if (
      av &&
      bv &&
      typeof av === "object" &&
      typeof bv === "object" &&
      !Array.isArray(av) &&
      !Array.isArray(bv)
    ) {
      out.push(
        ...diffFields(
          av as Record<string, unknown>,
          bv as Record<string, unknown>,
          path,
        ),
      );
      continue;
    }
    const equal = JSON.stringify(av) === JSON.stringify(bv);
    out.push({ path, a: av, b: bv, equal });
  }
  return out;
}
