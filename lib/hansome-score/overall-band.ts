/**
 * Overall Token Score presentation bands.
 *
 * Single source of truth for Scan UI, future /explore, and token cards.
 * Bands are display-only — they do not affect the Overall formula or weights.
 *
 * Wording: labels are tier quality (VERY WEAK…STRONG), never SAFE/BUY/SCAM/SELL.
 */

export type OverallScoreBandId =
  | "very_weak"
  | "weak"
  | "fair"
  | "good"
  | "strong";

export type OverallScoreBand = {
  id: OverallScoreBandId;
  /** Product term (EN), e.g. FAIR — keep as brand-style labels. */
  label: string;
  min: number;
  max: number;
  /** Tailwind text class for Scan / light-theme surfaces. */
  textClass: string;
  /** Hex color for non-Tailwind consumers (Explore cards, charts). */
  color: string;
  /** CSS custom-property name (define value = `color` where needed). */
  colorCssVar: string;
};

/** Fixed thresholds — do not retune without product approval. */
export const OVERALL_SCORE_BANDS: readonly OverallScoreBand[] = [
  {
    id: "very_weak",
    label: "VERY WEAK",
    min: 0,
    max: 19,
    textClass: "text-red-900",
    color: "#7f1d1d",
    colorCssVar: "--hansome-overall-band-very-weak",
  },
  {
    id: "weak",
    label: "WEAK",
    min: 20,
    max: 39,
    textClass: "text-red-700",
    color: "#b91c1c",
    colorCssVar: "--hansome-overall-band-weak",
  },
  {
    id: "fair",
    label: "FAIR",
    min: 40,
    max: 59,
    textClass: "text-amber-700",
    color: "#b45309",
    colorCssVar: "--hansome-overall-band-fair",
  },
  {
    id: "good",
    label: "GOOD",
    min: 60,
    max: 79,
    textClass: "text-lime-700",
    color: "#4d7c0f",
    colorCssVar: "--hansome-overall-band-good",
  },
  {
    id: "strong",
    label: "STRONG",
    min: 80,
    max: 100,
    textClass: "text-green-700",
    color: "#15803d",
    colorCssVar: "--hansome-overall-band-strong",
  },
] as const;

function formatBandLegendLine(band: OverallScoreBand): string {
  const range = `${band.min}–${band.max}`;
  // Align labels under the widest range ("80–100").
  return `${range.padEnd(7, " ")} ${band.label}`;
}

/** Compact legend lines for tooltip / chrome (highest first). */
export const OVERALL_SCORE_BAND_LEGEND_LINES: readonly string[] = [
  ...OVERALL_SCORE_BANDS,
]
  .reverse()
  .map(formatBandLegendLine);

export const OVERALL_SCORE_BAND_LEGEND =
  OVERALL_SCORE_BAND_LEGEND_LINES.join("\n");

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Map an Overall Token Score (0–100) to its presentation band.
 * Out-of-range / non-finite values clamp to 0–100 before lookup.
 */
export function getOverallScoreBand(score: number): OverallScoreBand {
  const n = clampScore(score);
  for (const band of OVERALL_SCORE_BANDS) {
    if (n >= band.min && n <= band.max) return band;
  }
  return OVERALL_SCORE_BANDS[OVERALL_SCORE_BANDS.length - 1]!;
}
