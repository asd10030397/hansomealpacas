/**
 * Creator explainability presentation helpers.
 * Labels / display only — never retunes detection, classification, or scoring.
 */

import { BURN_ADDRESSES } from "@/lib/hansome-score/constants";
import type {
  CreatorBehaviourResult,
  CreatorTransferEvidence,
  LabeledHolder,
  SupplyBurnTriState,
} from "@/lib/hansome-score/types";

/** i18n key names for creator-field explainability tooltips (EN/ZH must both define). */
export const CREATOR_EXPLAINABILITY_TOOLTIP_KEYS = [
  "creatorDeployerTooltip",
  "creatorBalanceTooltip",
  "creatorSoldTooltip",
  "creatorBurnedTooltip",
  "creatorReceivedTooltip",
  "creatorCurrentOwnerTooltip",
  "creatorProxyTooltip",
  "creatorUnknownTooltip",
  "creatorIncompleteTooltip",
  "creatorAvailableTooltip",
  "creatorAddressTooltip",
  "creatorActivityTooltip",
  "creatorTransferredTooltip",
  "creatorDeploymentSourceTooltip",
  "creatorFundingWalletTooltip",
  "creatorCoverageTooltip",
] as const;

export type CreatorExplainabilityTooltipKey =
  (typeof CREATOR_EXPLAINABILITY_TOOLTIP_KEYS)[number];

const BURN_SET = new Set(
  [...BURN_ADDRESSES].map((a) => a.toLowerCase()),
);

/** Unknown must stay visually distinct from No / ordinary text. */
export function creatorUnknownToneClassName(): string {
  return "text-amber-900";
}

/** Incomplete coverage tone — honest, not treated as No. */
export function creatorIncompleteToneClassName(): string {
  return "text-amber-900";
}

/**
 * Safe creator-% display: never NaN / Infinity / negative in UI.
 * Returns null → caller should show em dash / Unavailable.
 */
export function formatCreatorPctForDisplay(
  pct: number | null | undefined,
  digits = 2,
): string | null {
  if (pct == null || !Number.isFinite(pct) || pct < 0) return null;
  if (pct === 0) return `${(0).toFixed(digits)}%`;
  return `${pct.toFixed(digits)}%`;
}

/** Normalize address for presentation/dedupe checks only. */
export function normalizeCreatorAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function creatorIdentityState(
  deployer: string | null | undefined,
): "known" | "unknown" {
  if (deployer == null || deployer.trim() === "") return "unknown";
  return "known";
}

/**
 * Whether numeric creator-activity metrics are measured enough to show,
 * including legitimate zero. Stub zeros with no indexed sample → unavailable.
 */
export function creatorActivityMetricAvailability(
  cb: Pick<
    CreatorBehaviourResult,
    "status" | "available" | "transfersIndexed" | "pagesFetched"
  >,
): "available" | "incomplete" | "unavailable" {
  if (cb.status === "unavailable") return "unavailable";
  if (cb.status === "indexed" && cb.available) return "available";
  if (cb.transfersIndexed > 0 || cb.pagesFetched > 0) return "incomplete";
  return "unavailable";
}

export type CreatorMetricDisplay =
  | { kind: "value"; text: string }
  | { kind: "unavailable" }
  | { kind: "unknown" }
  | { kind: "incomplete"; text: string };

/** Sold % — Unavailable when unmeasured; Incomplete may still show observed %. */
export function describeCreatorSoldPctDisplay(
  cb: CreatorBehaviourResult,
): CreatorMetricDisplay {
  const avail = creatorActivityMetricAvailability(cb);
  if (avail === "unavailable") return { kind: "unavailable" };
  const text = formatCreatorPctForDisplay(cb.creatorSellPctOfSupply);
  if (text == null) return { kind: "unavailable" };
  if (avail === "incomplete") return { kind: "incomplete", text };
  return { kind: "value", text };
}

/** Direct sell count — never render stub zero as a finished measurement. */
export function describeCreatorSoldCountDisplay(
  cb: CreatorBehaviourResult,
): CreatorMetricDisplay {
  const avail = creatorActivityMetricAvailability(cb);
  if (avail === "unavailable") return { kind: "unavailable" };
  const text = String(cb.sellTransferCount);
  if (avail === "incomplete") return { kind: "incomplete", text };
  return { kind: "value", text };
}

/** Outbound / transferred count presentation. */
export function describeCreatorTransferredDisplay(
  cb: CreatorBehaviourResult,
): CreatorMetricDisplay {
  const avail = creatorActivityMetricAvailability(cb);
  if (avail === "unavailable") return { kind: "unavailable" };
  const text = String(cb.outboundTransferCount);
  if (avail === "incomplete") return { kind: "incomplete", text };
  return { kind: "value", text };
}

/**
 * Presentation-only: sum evidence transfers whose recipient is a recognized
 * burn/dead address. Does not change analyzer classification.
 */
export function creatorBurnedPctFromEvidence(
  evidence: readonly CreatorTransferEvidence[] | null | undefined,
): number | null {
  if (!evidence || evidence.length === 0) return null;
  let sum = 0;
  let found = false;
  for (const e of evidence) {
    if (!e.to) continue;
    if (!BURN_SET.has(e.to.toLowerCase())) continue;
    if (!Number.isFinite(e.pctOfSupply) || e.pctOfSupply < 0) continue;
    found = true;
    sum += e.pctOfSupply;
  }
  return found ? sum : null;
}

export function describeCreatorBurnedDisplay(
  cb: CreatorBehaviourResult,
): CreatorMetricDisplay {
  const avail = creatorActivityMetricAvailability(cb);
  if (avail === "unavailable") return { kind: "unavailable" };
  const burned = creatorBurnedPctFromEvidence(cb.evidence);
  // Indexed/incomplete with no burn evidence → honest zero, not Unavailable.
  const text = formatCreatorPctForDisplay(burned ?? 0);
  if (text == null) return { kind: "unavailable" };
  if (avail === "incomplete") return { kind: "incomplete", text };
  return { kind: "value", text };
}

/**
 * Creator Received is not a first-class analyzer field — stay Unavailable
 * rather than invent inbound totals.
 */
export function describeCreatorReceivedDisplay(): CreatorMetricDisplay {
  return { kind: "unavailable" };
}

/** Look up deployer in the existing holder sample — no new detection. */
export function creatorBalanceFromHolders(
  deployer: string | null | undefined,
  topHolders: readonly LabeledHolder[] | null | undefined,
): {
  balanceFormatted: string | null;
  percentOfSupply: number | null;
} {
  if (!deployer || !topHolders?.length) {
    return { balanceFormatted: null, percentOfSupply: null };
  }
  const needle = normalizeCreatorAddress(deployer);
  const hit = topHolders.find(
    (h) => normalizeCreatorAddress(h.address) === needle,
  );
  if (!hit) return { balanceFormatted: null, percentOfSupply: null };
  const pct =
    typeof hit.percentOfSupply === "number" &&
    Number.isFinite(hit.percentOfSupply) &&
    hit.percentOfSupply >= 0
      ? hit.percentOfSupply
      : null;
  return {
    balanceFormatted: hit.balanceFormatted ?? null,
    percentOfSupply: pct,
  };
}

export function describeCreatorBalanceDisplay(input: {
  deployer: string | null | undefined;
  topHolders: readonly LabeledHolder[] | null | undefined;
}): CreatorMetricDisplay {
  if (creatorIdentityState(input.deployer) === "unknown") {
    return { kind: "unknown" };
  }
  const bal = creatorBalanceFromHolders(input.deployer, input.topHolders);
  if (bal.balanceFormatted == null) return { kind: "unavailable" };
  return { kind: "value", text: bal.balanceFormatted };
}

export function describeCreatorBalancePctDisplay(input: {
  deployer: string | null | undefined;
  topHolders: readonly LabeledHolder[] | null | undefined;
}): CreatorMetricDisplay {
  if (creatorIdentityState(input.deployer) === "unknown") {
    return { kind: "unknown" };
  }
  const bal = creatorBalanceFromHolders(input.deployer, input.topHolders);
  const text = formatCreatorPctForDisplay(bal.percentOfSupply);
  if (text == null) return { kind: "unavailable" };
  return { kind: "value", text };
}

export type ProxyPresentation = "yes" | "no" | "unknown";

export function describeProxyPresentation(
  isProxy: boolean | null | undefined,
): ProxyPresentation {
  if (isProxy === true) return "yes";
  if (isProxy === false) return "no";
  return "unknown";
}

/**
 * Creator burned inventory (from evidence) vs contract Burn Function are
 * independent — burned > 0 with Burn Function = No is valid.
 */
export function isValidCreatorBurnedVsBurnFunctionState(input: {
  creatorBurnedPct: number | null | undefined;
  burnFunction: SupplyBurnTriState | null | undefined;
}): boolean {
  const burned = input.creatorBurnedPct;
  const fn = input.burnFunction;
  if (burned == null || fn == null) return true;
  if (!Number.isFinite(burned) || burned < 0) return false;
  return true;
}

/** Deployer must not be labeled current owner without separate ownership evidence. */
export function deployerDescribedAsCurrentOwnerWithoutEvidence(input: {
  deployer: string | null | undefined;
  currentOwner: string | null | undefined;
  copy: string;
}): boolean {
  const lower = input.copy.toLowerCase();
  if (!/current owner|目前擁有者|目前拥有者/.test(lower)) return false;
  if (input.currentOwner && input.deployer) {
    if (
      normalizeCreatorAddress(input.currentOwner) ===
      normalizeCreatorAddress(input.deployer)
    ) {
      return false;
    }
  }
  // Claiming deployer IS the current owner without an owner address is a failure.
  if (
    /deployer is (the )?current owner|部署者即目前擁有者|部署者就是目前拥有者/.test(
      lower,
    )
  ) {
    return true;
  }
  return false;
}

/** Forbidden certainty phrases must never appear in creator explainability copy. */
export const CREATOR_FORBIDDEN_CERTAINTY_PHRASES = [
  "definitely owned by team",
  "developer wallet",
  "scammer wallet",
  "dumped",
  "malicious creator",
  "safe creator",
  "permanently abandoned",
] as const;

/**
 * True when copy asserts a forbidden certainty claim.
 * Negations in approved Unknown copy ("does not mean No creator") are allowed.
 */
export function creatorCopyHasForbiddenCertainty(text: string): boolean {
  const lower = text.toLowerCase();
  if (CREATOR_FORBIDDEN_CERTAINTY_PHRASES.some((p) => lower.includes(p))) {
    return true;
  }
  // Bare "no creator" claim — allow approved negation forms.
  if (
    /\bno creator\b/.test(lower) &&
    !/does not mean no creator|not mean no creator|不代表沒有建立者|不代表没有建立者/.test(
      lower,
    )
  ) {
    return true;
  }
  return false;
}

export function isCreatorCoverageIncomplete(
  cb: Pick<
    CreatorBehaviourResult,
    "status" | "available" | "paginationComplete" | "transfersIndexed"
  >,
): boolean {
  if (cb.status === "incomplete") return true;
  if (cb.status === "unavailable") return true;
  if (!cb.available || !cb.paginationComplete) return true;
  return false;
}
