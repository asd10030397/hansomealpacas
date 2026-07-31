/**
 * Holder explainability presentation helpers.
 * Labels / display only — never retunes classification, concentration, or scoring.
 */

/** i18n key names for holder-field explainability tooltips (EN/ZH must both define). */
export const HOLDER_EXPLAINABILITY_TOOLTIP_KEYS = [
  "holderLargestTooltip",
  "holderTop10Tooltip",
  "holderConcentrationTooltip",
  "holderKnownBurnedTooltip",
  "holderLpPoolTooltip",
  "holderTreasuryTooltip",
  "holderTeamDeployerTooltip",
  "holderExchangeTooltip",
  "holderBridgeTooltip",
  "holderLockerTooltip",
  "holderProtocolContractTooltip",
  "holderUnknownWalletTooltip",
  "holderExcludedFromCirculatingTooltip",
  "holderIncludedInRawTooltip",
  "holderCoverageIncompleteTooltip",
] as const;

export type HolderExplainabilityTooltipKey =
  (typeof HOLDER_EXPLAINABILITY_TOOLTIP_KEYS)[number];

/** Presentation category for tooltip selection — does not change analyzer labels. */
export type HolderPresentationCategory =
  | "unknown_wallet"
  | "lp_pool"
  | "known_burned"
  | "treasury"
  | "team_deployer"
  | "exchange"
  | "bridge"
  | "locker"
  | "protocol_contract"
  | "other_labeled";

/**
 * Map an existing analyzer label string to a presentation tooltip category.
 * Read-only mapping — never invents new classification evidence.
 */
export function holderPresentationCategory(
  label?: string | null,
): HolderPresentationCategory {
  if (label == null || label.trim() === "") return "unknown_wallet";
  const lower = label.toLowerCase();

  if (
    lower.includes("poolmanager") ||
    lower.includes("amm liquidity") ||
    lower.includes("liquidity pool")
  ) {
    return "lp_pool";
  }
  if (lower.includes("burn")) return "known_burned";
  if (lower.includes("treasury")) return "treasury";
  if (
    lower.includes("locker") ||
    lower.includes("titan") ||
    lower.includes("escrow")
  ) {
    return "locker";
  }
  if (lower.includes("bridge")) return "bridge";
  if (
    lower.includes("exchange") ||
    lower.includes("binance") ||
    lower.includes("coinbase") ||
    lower.includes("okx") ||
    lower.includes("kraken") ||
    lower.includes("bybit")
  ) {
    return "exchange";
  }
  if (
    lower.includes("founder") ||
    lower.includes("deployer") ||
    lower.includes("team") ||
    lower.includes("(official)")
  ) {
    return "team_deployer";
  }
  if (
    lower.includes("protocol") ||
    (lower.includes("contract") && !lower.includes("burn"))
  ) {
    return "protocol_contract";
  }
  return "other_labeled";
}

/** Tooltip i18n key for a presentation category, if any. */
export function holderCategoryTooltipKey(
  category: HolderPresentationCategory,
): HolderExplainabilityTooltipKey | null {
  switch (category) {
    case "unknown_wallet":
      return "holderUnknownWalletTooltip";
    case "lp_pool":
      return "holderLpPoolTooltip";
    case "known_burned":
      return "holderKnownBurnedTooltip";
    case "treasury":
      return "holderTreasuryTooltip";
    case "team_deployer":
      return "holderTeamDeployerTooltip";
    case "exchange":
      return "holderExchangeTooltip";
    case "bridge":
      return "holderBridgeTooltip";
    case "locker":
      return "holderLockerTooltip";
    case "protocol_contract":
      return "holderProtocolContractTooltip";
    default:
      return null;
  }
}

/** Unknown wallet tone must stay distinct from ordinary / “No” styling. */
export function holderUnknownToneClassName(): string {
  return "text-amber-900";
}

/**
 * Safe holder-% display: never NaN / Infinity / negative in UI.
 * Returns null → caller should show em dash / unavailable.
 */
export function formatHolderPctForDisplay(
  pct: number | null | undefined,
  digits = 2,
): string | null {
  if (pct == null || !Number.isFinite(pct) || pct < 0) return null;
  if (pct === 0) return `${(0).toFixed(digits)}%`;
  return `${pct.toFixed(digits)}%`;
}

/** Soft gate: pct should not exceed 100 without an explicit unsupported flag. */
export function holderPctWithinHundred(
  pct: number | null | undefined,
  opts?: { unsupportedMechanics?: boolean },
): boolean {
  if (pct == null || !Number.isFinite(pct)) return true;
  if (opts?.unsupportedMechanics) return true;
  return pct <= 100 + 1e-6;
}

export type ConcentrationPresentation = {
  top10RawPct: number;
  top10AdjustedPct: number;
  denominator: "total_supply" | "unavailable";
  excludedCategoriesNote: "pool_and_burn";
};

/**
 * Describe existing analyzer concentration figures for UI copy.
 * Does not recompute — only names what the engine already returns.
 */
export function describeConcentrationPresentation(input: {
  top10RawPct: number | null | undefined;
  top10AdjustedPct: number | null | undefined;
  totalSupplyAvailable: boolean;
}): ConcentrationPresentation | null {
  if (
    input.top10RawPct == null ||
    input.top10AdjustedPct == null ||
    !Number.isFinite(input.top10RawPct) ||
    !Number.isFinite(input.top10AdjustedPct)
  ) {
    return null;
  }
  return {
    top10RawPct: input.top10RawPct,
    top10AdjustedPct: input.top10AdjustedPct,
    denominator: input.totalSupplyAvailable ? "total_supply" : "unavailable",
    excludedCategoriesNote: "pool_and_burn",
  };
}

/** Coverage incomplete when holder sample or supply denominator is missing. */
export function isHolderCoverageIncomplete(input: {
  holdersCount: number | null | undefined;
  totalSupplyRaw: string | null | undefined;
  topHoldersLength: number;
}): boolean {
  if (input.holdersCount == null) return true;
  if (input.totalSupplyRaw == null || input.totalSupplyRaw === "") return true;
  if (input.holdersCount > 0 && input.topHoldersLength === 0) return true;
  return false;
}

/** Forbidden certainty phrases must never appear in holder explainability copy. */
export const HOLDER_FORBIDDEN_CERTAINTY_PHRASES = [
  "definitely owned by the team",
  "safe holder",
  "malicious whale",
  "permanently locked",
  "exchange-owned funds",
] as const;

export function holderCopyHasForbiddenCertainty(text: string): boolean {
  const lower = text.toLowerCase();
  return HOLDER_FORBIDDEN_CERTAINTY_PHRASES.some((p) => lower.includes(p));
}

/** Normalize address for dedupe checks (presentation/validation only). */
export function normalizeHolderAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function hasDuplicateHolderAddresses(
  addresses: readonly string[],
): boolean {
  const seen = new Set<string>();
  for (const a of addresses) {
    const n = normalizeHolderAddress(a);
    if (!n) continue;
    if (seen.has(n)) return true;
    seen.add(n);
  }
  return false;
}
