/**
 * Overall Token Score (v1.0) — composite 0–100 for ordinary users.
 *
 * Structural Score (v1.1) remains the safety/transparency engine and keeps
 * its category weights untouched. Overall blends structural quality with
 * market health, adoption, activity, maturity, and data completeness.
 *
 * Design principles:
 * - Low popularity alone ≠ unsafe (Structural stays free of raw holder/volume).
 * - Clean ERC-20 alone ≠ high Overall (market/adoption/activity matter here).
 * - Severe structural risk cannot be washed out by trading heat.
 * - Formula is general — no token-specific hardcodes.
 */

export const OVERALL_SCORE_VERSION = "1.0.0-overall";

/** Documented weights — sum = 1. Not tuned to any single token headline. */
export const OVERALL_WEIGHTS = {
  /** Contract / LP ownership / concentration / relationships / launch / creator. */
  structural: 0.3,
  /** Tradable depth (USD liquidity when labeled; else pool inventory %). */
  liquidityDepth: 0.2,
  /** Holder count + light distribution for adoption (not structural safety). */
  holderAdoption: 0.18,
  /** 24h volume / txs — “is anyone trading?” */
  activity: 0.17,
  /** Token age — young launches carry more unknown history risk for users. */
  maturity: 0.1,
  /** Analysis coverage — incomplete data should not look polished. */
  dataConfidence: 0.05,
} as const;

export type OverallComponentId = keyof typeof OVERALL_WEIGHTS;

export type OverallScoreInput = {
  structuralScore: number;
  /** Labeled pool TVL / reserve USD when available (e.g. GeckoTerminal). */
  liquidityUsd: number | null;
  /** PoolManager (or equivalent) token inventory as % of total supply. */
  poolInventoryPctOfSupply: number | null;
  sizeWarning: boolean;
  holdersCount: number | null;
  /** Adjusted top-10 % (excl. pool/burn) — soft adoption modifier only. */
  top10AdjustedPct: number | null;
  volume24hUsd: number | null;
  transactions24h: number | null;
  tokenAgeDays: number | null;
  dataConfidencePercent: number;
};

export type OverallScoreResult = {
  score: number;
  version: string;
  components: Record<OverallComponentId, number>;
  weights: typeof OVERALL_WEIGHTS;
  /** Human-readable gates/ceilings that changed the raw weighted blend. */
  capsApplied: string[];
  note: string;
};

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Piecewise liquidity depth from labeled USD TVL. */
export function scoreLiquidityDepthUsd(liquidityUsd: number | null): number | null {
  if (liquidityUsd == null || !Number.isFinite(liquidityUsd) || liquidityUsd <= 0) {
    return null;
  }
  if (liquidityUsd < 1_000) return 15;
  if (liquidityUsd < 5_000) return 30;
  if (liquidityUsd < 25_000) return 45;
  if (liquidityUsd < 100_000) return 60;
  if (liquidityUsd < 500_000) return 75;
  if (liquidityUsd < 2_000_000) return 88;
  return 95;
}

/** Fallback when USD TVL unavailable — inventory % + thin-size warning. */
export function scoreLiquidityDepthInventory(
  poolInventoryPctOfSupply: number | null,
  sizeWarning: boolean,
): number {
  if (poolInventoryPctOfSupply == null || poolInventoryPctOfSupply <= 0) {
    return 12;
  }
  if (sizeWarning || poolInventoryPctOfSupply < 1) return 28;
  if (poolInventoryPctOfSupply < 5) return 48;
  if (poolInventoryPctOfSupply < 15) return 68;
  return 82;
}

export function scoreLiquidityDepth(input: {
  liquidityUsd: number | null;
  poolInventoryPctOfSupply: number | null;
  sizeWarning: boolean;
}): number {
  const fromUsd = scoreLiquidityDepthUsd(input.liquidityUsd);
  if (fromUsd != null) return fromUsd;
  return scoreLiquidityDepthInventory(
    input.poolInventoryPctOfSupply,
    input.sizeWarning,
  );
}

/**
 * Holder adoption for Overall — count informs this axis.
 * Soft concentration modifier only; heavy concentration remains Structural.
 */
export function scoreHolderAdoption(
  holdersCount: number | null,
  top10AdjustedPct: number | null,
): number {
  let base: number;
  if (holdersCount == null || !Number.isFinite(holdersCount)) {
    base = 35;
  } else if (holdersCount < 20) base = 12;
  else if (holdersCount < 50) base = 28;
  else if (holdersCount < 100) base = 40;
  else if (holdersCount < 250) base = 52;
  else if (holdersCount < 1_000) base = 68;
  else if (holdersCount < 5_000) base = 82;
  else base = 92;

  let adj = 0;
  if (top10AdjustedPct != null && Number.isFinite(top10AdjustedPct)) {
    if (top10AdjustedPct >= 80) adj -= 8;
    else if (top10AdjustedPct >= 60) adj -= 4;
    else if (top10AdjustedPct < 40) adj += 3;
  }
  return clamp100(base + adj);
}

/** Numeric activity health from 24h volume + txs (not the Low/Med/High label alone). */
export function scoreActivityHealth(
  volume24hUsd: number | null,
  transactions24h: number | null,
): number {
  let volScore: number;
  if (volume24hUsd == null || !Number.isFinite(volume24hUsd)) volScore = 10;
  else if (volume24hUsd < 100) volScore = 18;
  else if (volume24hUsd < 1_000) volScore = 32;
  else if (volume24hUsd < 10_000) volScore = 50;
  else if (volume24hUsd < 50_000) volScore = 68;
  else if (volume24hUsd < 250_000) volScore = 82;
  else volScore = 92;

  let txScore: number;
  if (transactions24h == null || !Number.isFinite(transactions24h)) txScore = 12;
  else if (transactions24h < 5) txScore = 20;
  else if (transactions24h < 20) txScore = 40;
  else if (transactions24h < 100) txScore = 65;
  else if (transactions24h < 500) txScore = 82;
  else txScore = 92;

  return clamp100(volScore * 0.7 + txScore * 0.3);
}

/** Maturity from token age in days. */
export function scoreMaturity(tokenAgeDays: number | null): number {
  if (tokenAgeDays == null || !Number.isFinite(tokenAgeDays) || tokenAgeDays < 0) {
    return 40;
  }
  if (tokenAgeDays < 1) return 10;
  if (tokenAgeDays < 3) return 20;
  if (tokenAgeDays < 7) return 32;
  if (tokenAgeDays < 14) return 42;
  if (tokenAgeDays < 30) return 55;
  if (tokenAgeDays < 90) return 70;
  if (tokenAgeDays < 180) return 80;
  if (tokenAgeDays < 365) return 88;
  return 95;
}

/**
 * Safety gate: market heat must not wash out severe structural risk
 * (inspired by publicly documented GT Score principle that serious safety
 * failures drag the composite — without copying unpublished GT weights).
 */
export function applyStructuralSafetyGate(
  overall: number,
  structuralScore: number,
): { score: number; caps: string[] } {
  const caps: string[] = [];
  let score = overall;
  if (structuralScore < 25) {
    const ceiling = structuralScore + 10;
    if (score > ceiling) {
      score = ceiling;
      caps.push(`structural_lt_25_ceiling_${ceiling}`);
    }
  } else if (structuralScore < 40) {
    const ceiling = structuralScore + 20;
    if (score > ceiling) {
      score = ceiling;
      caps.push(`structural_lt_40_ceiling_${ceiling}`);
    }
  }
  return { score, caps };
}

/**
 * Pure Overall Token Score.
 * Does not mutate Structural category caps or computeStructuralScore.
 */
export function computeOverallTokenScore(input: OverallScoreInput): OverallScoreResult {
  const components: Record<OverallComponentId, number> = {
    structural: clamp100(input.structuralScore),
    liquidityDepth: scoreLiquidityDepth({
      liquidityUsd: input.liquidityUsd,
      poolInventoryPctOfSupply: input.poolInventoryPctOfSupply,
      sizeWarning: input.sizeWarning,
    }),
    holderAdoption: scoreHolderAdoption(
      input.holdersCount,
      input.top10AdjustedPct,
    ),
    activity: scoreActivityHealth(input.volume24hUsd, input.transactions24h),
    maturity: scoreMaturity(input.tokenAgeDays),
    dataConfidence: clamp100(input.dataConfidencePercent),
  };

  let weighted = 0;
  for (const id of Object.keys(OVERALL_WEIGHTS) as OverallComponentId[]) {
    weighted += components[id] * OVERALL_WEIGHTS[id];
  }

  const gated = applyStructuralSafetyGate(weighted, components.structural);
  const score = clamp100(gated.score);

  return {
    score,
    version: OVERALL_SCORE_VERSION,
    components,
    weights: { ...OVERALL_WEIGHTS },
    capsApplied: gated.caps,
    note:
      "Overall Token Score blends structural quality with market/liquidity health, holder adoption, activity, maturity, and data completeness. It is not a safety guarantee or price prediction. Structural Score remains the structural-risk axis and is not a popularity meter.",
  };
}
