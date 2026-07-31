/**
 * Supply & Burn presentation helpers.
 * Labels / display only — never retunes burn classification or scoring.
 */

import type { SupplyBurnTriState } from "@/lib/hansome-score/types";

/** i18n key names for burn-field explainability tooltips (EN/ZH must both define). */
export const BURN_EXPLAINABILITY_TOOLTIP_KEYS = [
  "supplyBurnKnownBurnedTooltip",
  "supplyBurnFunctionTooltip",
  "supplyBurnAutomaticTooltip",
  "supplyBurnPrivilegedTooltip",
] as const;

export type BurnExplainabilityTooltipKey =
  (typeof BURN_EXPLAINABILITY_TOOLTIP_KEYS)[number];

/**
 * Observed Known Burned inventory vs contract Burn Function capability
 * are independent — Known Burned > 0 with Burn Function = No is valid.
 */
export function isValidKnownBurnedVsBurnFunctionState(input: {
  knownBurnedRaw: bigint | null | undefined;
  burnFunction: SupplyBurnTriState | null | undefined;
}): boolean {
  const known = input.knownBurnedRaw;
  const fn = input.burnFunction;
  if (known == null || fn == null) return true;
  if (known < 0n) return false;
  // Capability Yes does not require inventory; inventory does not require capability.
  return true;
}

/** Unknown must never render with the same visual tone as No. */
export function burnTriStateTone(
  v: SupplyBurnTriState | null | undefined,
): "yes" | "no" | "unknown" | "admin_yes" {
  if (v === "yes") return "yes";
  if (v === "no") return "no";
  return "unknown";
}

export function burnTriStateClassName(
  v: SupplyBurnTriState | null | undefined,
  opts?: { privilegedYes?: boolean },
): string {
  if (opts?.privilegedYes && v === "yes") return "text-red-700";
  const tone = burnTriStateTone(v);
  if (tone === "unknown") return "text-amber-900";
  return "text-foreground";
}

/**
 * Safe burned-% display: never NaN / Infinity / negative in UI.
 * Returns null → caller should show em dash / unavailable.
 */
export function formatBurnedPctForDisplay(
  pct: number | null | undefined,
): string | null {
  if (pct == null || !Number.isFinite(pct) || pct < 0) return null;
  if (pct === 0) return "0%";
  return `${pct.toFixed(1)}%`;
}

/** Supply excluding known burns must not display as negative. */
export function isNonNegativeRemainingSupply(
  remainingRaw: string | null | undefined,
): boolean {
  if (remainingRaw == null) return true;
  try {
    return BigInt(remainingRaw) >= 0n;
  } catch {
    return false;
  }
}

/**
 * Known Burned ≤ total supply (when both finite), unless caller marks
 * unsupported elastic/rebasing (presentation gate skips hard fail).
 */
export function knownBurnedWithinTotalSupply(input: {
  knownBurnedRaw: string | null | undefined;
  totalSupplyRaw: string | null | undefined;
  unsupportedElastic?: boolean;
}): boolean {
  if (input.unsupportedElastic) return true;
  if (input.knownBurnedRaw == null || input.totalSupplyRaw == null) return true;
  try {
    const known = BigInt(input.knownBurnedRaw);
    const total = BigInt(input.totalSupplyRaw);
    if (known < 0n) return false;
    return known <= total;
  } catch {
    return false;
  }
}
