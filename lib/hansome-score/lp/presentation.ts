/**
 * User-facing Liquidity presentation helpers.
 * Labels / grouping only — never retunes Score or detection.
 */

import { zeroAddress } from "viem";
import { materialPositions } from "@/lib/hansome-score/lp/aggregate";
import { RH_QUOTE_TOKENS } from "@/lib/hansome-score/lp/deployments";
import type {
  LpAggregateState,
  LpIntelligence,
  LpLockState,
  UniswapVersion,
  V4OwnershipClass,
  V4OwnershipEvidence,
  V4PositionInfo,
} from "@/lib/hansome-score/types";
import {
  V4_OWNERSHIP_CLASS_DISPLAY,
  V4_OWNERSHIP_NOTE,
} from "@/lib/hansome-score/lp/v4-ownership-class";

/** Primary UI lock labels (internal MIXED → PARTIALLY_LOCKED). */
export type UserFacingLockStatus =
  | "LOCKED"
  | "UNLOCKED"
  | "PARTIALLY_LOCKED"
  | "UNKNOWN";

export type PresentationPool = {
  key: string;
  version: UniswapVersion;
  pairLabel: string;
  /** Reliable USD only; null → show Unavailable (never raw L). */
  liquidityUsd: number | null;
  lockStatus: UserFacingLockStatus;
  positions: V4PositionInfo[];
};

/** Map token-level aggregate — MIXED displays as PARTIALLY LOCKED. */
export function userFacingAggregateLock(
  state: LpAggregateState,
): UserFacingLockStatus {
  switch (state) {
    case "ALL_LOCKED":
      return "LOCKED";
    case "ALL_UNLOCKED":
      return "UNLOCKED";
    case "MIXED":
      return "PARTIALLY_LOCKED";
    case "UNKNOWN_INCOMPLETE":
    case "NONE":
    default:
      return "UNKNOWN";
  }
}

export function userFacingPositionLock(state: LpLockState): UserFacingLockStatus {
  switch (state) {
    case "LOCKED_VERIFIED_ONCHAIN":
    case "LOCK_DETECTED_EXPIRY_UNKNOWN":
      return "LOCKED";
    case "UNLOCKED_EOA_CONTROLLED":
      return "UNLOCKED";
    case "MIXED":
      return "PARTIALLY_LOCKED";
    default:
      return "UNKNOWN";
  }
}

/** Presentation-only V4 ownership class label — does not alter lock status. */
export function userFacingV4OwnershipClass(
  ownershipClass: V4OwnershipClass | null | undefined,
): string | null {
  if (!ownershipClass || ownershipClass === "unknown") return null;
  return V4_OWNERSHIP_CLASS_DISPLAY[ownershipClass];
}

export type V4OwnershipEvidenceLine = {
  key: string;
  /** Plain-language template key for i18n (scan.*). */
  messageKey: string;
  /** Optional interpolate values for fill(). */
  values?: Record<string, string | number>;
  /** Technical detail line (shortened ids) — optional secondary. */
  technical?: string | null;
};

function shortHex(value: string, head = 6, tail = 4): string {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/**
 * Map structured v4OwnershipEvidence → plain-language UI lines.
 * Never invents lock claims; skips lock_verification_unsupported from primary list
 * (lock status UI remains authoritative).
 */
export function v4OwnershipEvidenceLines(
  evidence: V4OwnershipEvidence | null | undefined,
): V4OwnershipEvidenceLine[] {
  if (!evidence?.notes?.length && !evidence?.positionIds?.length) {
    if (evidence?.source === "unknown") {
      return [
        {
          key: "ownership_unproven",
          messageKey: "v4EvidenceOwnershipUnproven",
        },
      ];
    }
    return [];
  }
  const lines: V4OwnershipEvidenceLine[] = [];
  const notes = evidence.notes ?? [];
  const seen = new Set<string>();

  const push = (line: V4OwnershipEvidenceLine) => {
    if (seen.has(line.key)) return;
    seen.add(line.key);
    lines.push(line);
  };

  for (const note of notes) {
    switch (note) {
      case V4_OWNERSHIP_NOTE.POSITION_NFT_DETECTED:
      case V4_OWNERSHIP_NOTE.POSITION_NFT_IDS: {
        const ids = evidence.positionIds ?? [];
        if (ids.length === 0) {
          push({
            key: "posm_detected",
            messageKey: "v4EvidencePositionNftDetected",
          });
        } else {
          push({
            key: "posm_ids",
            messageKey: "v4EvidencePositionNftIds",
            values: { ids: ids.slice(0, 4).map((id) => `#${id}`).join(", ") },
            technical:
              ids.length > 4
                ? `+${ids.length - 4} more`
                : null,
          });
        }
        break;
      }
      case V4_OWNERSHIP_NOTE.POOL_MATCHED_ONCHAIN:
        push({
          key: "pool_matched",
          messageKey: "v4EvidencePoolMatched",
          technical: evidence.poolIds?.[0]
            ? `poolId ${shortHex(evidence.poolIds[0], 10, 6)}`
            : null,
        });
        break;
      case V4_OWNERSHIP_NOTE.OWNER_OF_VERIFIED:
        push({
          key: "owner_of",
          messageKey: "v4EvidenceOwnerOfVerified",
        });
        break;
      case V4_OWNERSHIP_NOTE.MATERIAL_LIQUIDITY:
        push({
          key: "material_liq",
          messageKey: "v4EvidenceMaterialLiquidity",
        });
        break;
      case V4_OWNERSHIP_NOTE.TITAN_OWNERSHIP:
        push({
          key: "titan",
          messageKey: "v4EvidenceTitanOwnership",
        });
        break;
      case V4_OWNERSHIP_NOTE.DISCOVERY_INCOMPLETE:
        push({
          key: "discovery_incomplete",
          messageKey: "v4EvidenceDiscoveryIncomplete",
        });
        break;
      case V4_OWNERSHIP_NOTE.AIRLOCK_DOPPLER_POOL:
        push({
          key: "airlock_doppler",
          messageKey: "v4EvidenceAirlockDoppler",
          technical: evidence.hookAddress
            ? `hook ${shortHex(evidence.hookAddress)}`
            : evidence.airlockAddress
              ? `airlock ${shortHex(evidence.airlockAddress)}`
              : null,
        });
        break;
      case V4_OWNERSHIP_NOTE.DYNAMIC_FEE_HOOK_POOL:
        push({
          key: "dynamic_fee",
          messageKey: "v4EvidenceDynamicFee",
        });
        break;
      case V4_OWNERSHIP_NOTE.HOOK_NO_POSM_NFT:
        push({
          key: "hook_no_nft",
          messageKey: "v4EvidenceHookNoPosm",
        });
        break;
      case V4_OWNERSHIP_NOTE.ACTIVE_HOOK_LIQUIDITY:
        push({
          key: "active_hook_liq",
          messageKey: "v4EvidenceActiveHookLiquidity",
          technical: evidence.poolIds?.[0]
            ? `poolId ${shortHex(evidence.poolIds[0], 10, 6)}`
            : null,
        });
        break;
      case V4_OWNERSHIP_NOTE.OWNERSHIP_UNPROVEN:
        push({
          key: "unproven",
          messageKey: "v4EvidenceOwnershipUnproven",
        });
        break;
      case V4_OWNERSHIP_NOTE.LOCK_UNSUPPORTED:
        // Lock status panel stays authoritative — skip as primary evidence line.
        break;
      default:
        break;
    }
  }

  if (lines.length === 0 && evidence.source === "unknown") {
    push({
      key: "unproven",
      messageKey: "v4EvidenceOwnershipUnproven",
    });
  }
  return lines;
}

export function formatUsdLiquidity(usd: number | null | undefined): string | null {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: usd >= 1000 ? 0 : 2,
  }).format(usd);
}

export function formatUnlockDate(isoOrNull: string | null, locale: string): string | null {
  if (!isoOrNull) return null;
  const d = new Date(isoOrNull);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale.startsWith("zh") ? "zh-TW" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function currencyLabel(
  addr: string | null | undefined,
  tokenSymbol: string | null,
  tokenAddress: string,
): string {
  if (!addr) return "?";
  const lc = addr.toLowerCase();
  if (lc === zeroAddress || lc === RH_QUOTE_TOKENS.WETH.toLowerCase()) return "ETH";
  if (lc === RH_QUOTE_TOKENS.USDG.toLowerCase()) return "USDG";
  if (lc === tokenAddress.toLowerCase()) return tokenSymbol?.trim() || shortAddr(addr);
  return shortAddr(addr);
}

export function inferUniswapVersion(position: V4PositionInfo): UniswapVersion {
  const id = position.positionNftId.toLowerCase();
  if (id.startsWith("v2-")) return "v2";
  if (id.startsWith("v3-")) return "v3";
  return "v4";
}

function poolLockStatus(positions: V4PositionInfo[]): UserFacingLockStatus {
  const material = materialPositions(positions);
  let locked = 0;
  let unlocked = 0;
  let unknown = 0;
  for (const p of material) {
    const s = userFacingPositionLock(p.lockState);
    if (s === "LOCKED") locked++;
    else if (s === "UNLOCKED") unlocked++;
    else unknown++;
  }
  if (locked > 0 && unlocked > 0) return "PARTIALLY_LOCKED";
  if (locked > 0 && unknown === 0 && unlocked === 0) return "LOCKED";
  if (unlocked > 0 && locked === 0 && unknown === 0) return "UNLOCKED";
  if (locked === 0 && unlocked === 0 && unknown === 0) return "UNKNOWN";
  return "UNKNOWN";
}

/**
 * Build one presentation card per distinct pool.
 * Per-pool USD is attached only when a single material pool can reliably own the
 * labeled TVL. Multi-pool never splits aggregate evenly across cards.
 */
export function buildPresentationPools(params: {
  lp: LpIntelligence;
  tokenSymbol: string | null;
  tokenAddress: string;
  /** Labeled market/TVL USD when available — never invent from raw L. */
  liquidityUsd: number | null;
}): PresentationPool[] {
  const { lp, tokenSymbol, tokenAddress, liquidityUsd } = params;
  const material = materialPositions(lp.positions);
  const byPool = new Map<string, V4PositionInfo[]>();

  for (const p of material) {
    const key = (p.poolId ?? `unknown-${p.positionNftId}`).toLowerCase();
    const list = byPool.get(key) ?? [];
    list.push(p);
    byPool.set(key, list);
  }

  // Pool detected via balance but no positions yet — still surface one card.
  if (byPool.size === 0 && lp.poolDetected) {
    const key = (lp.poolId ?? "unknown-pool").toLowerCase();
    byPool.set(key, []);
  }

  // Attribute labeled TVL to a pool card only when presentation has exactly one pool.
  // Do not use poolsDetectedCount here — dust/filtered extras must not hide USD on the
  // single material card, and multi-card views must not invent per-pool splits.
  const presentationPoolCount = byPool.size;
  const reliableSinglePoolUsd =
    presentationPoolCount === 1 &&
    liquidityUsd != null &&
    Number.isFinite(liquidityUsd) &&
    liquidityUsd > 0
      ? liquidityUsd
      : null;

  const pools: PresentationPool[] = [];
  for (const [key, positions] of byPool) {
    const sample = positions[0];
    const version = sample ? inferUniswapVersion(sample) : "v4";
    const c0 = currencyLabel(sample?.currency0, tokenSymbol, tokenAddress);
    const c1 = currencyLabel(sample?.currency1, tokenSymbol, tokenAddress);
    // Prefer scanned token first (e.g. HANSOME / ETH).
    let pairLabel = "—";
    if (sample?.currency0 || sample?.currency1) {
      const tokenLc = tokenAddress.toLowerCase();
      const isToken0 = sample?.currency0?.toLowerCase() === tokenLc;
      const isToken1 = sample?.currency1?.toLowerCase() === tokenLc;
      if (isToken0) pairLabel = `${c0} / ${c1}`;
      else if (isToken1) pairLabel = `${c1} / ${c0}`;
      else pairLabel = `${c0} / ${c1}`;
    } else if (tokenSymbol) {
      pairLabel = `${tokenSymbol} / ETH`;
    }

    // Phase 12A.1 — Class B never surfaces Titan LOCKED from PosM dust rows.
    const lockStatus =
      lp.ownershipClass === "hook_native"
        ? ("UNKNOWN" as UserFacingLockStatus)
        : positions.length > 0
          ? poolLockStatus(positions)
          : userFacingAggregateLock(lp.aggregateState);

    pools.push({
      key,
      version,
      pairLabel,
      liquidityUsd: reliableSinglePoolUsd,
      lockStatus,
      positions,
    });
  }

  // If poolsDetectedCount > grouped size (rare), keep count honest via empty cards skipped —
  // UI uses lp.poolsDetectedCount for the headline.
  return pools;
}

/**
 * Section-level liquidity totals for the Liquidity panel.
 *
 * - When every pool card has reliable per-pool USD → sum (no inventing).
 * - When multi-pool lacks per-pool USD but labeled token-level TVL exists → surface
 *   that aggregate at section level only (never split evenly onto cards).
 * - Never derives USD from raw concentrated-liquidity L.
 */
export function sectionLiquidityTotals(params: {
  pools: PresentationPool[];
  labeledLiquidityUsd: number | null;
}): {
  totalPools: number;
  totalLiquidityUsd: number | null;
  source: "sum_of_pools" | "labeled_aggregate" | "none";
} {
  const { pools, labeledLiquidityUsd } = params;
  const totalPools = pools.length;
  if (totalPools === 0) {
    return { totalPools: 0, totalLiquidityUsd: null, source: "none" };
  }

  const allHaveUsd = pools.every(
    (p) => p.liquidityUsd != null && Number.isFinite(p.liquidityUsd) && p.liquidityUsd > 0,
  );
  if (allHaveUsd) {
    return {
      totalPools,
      totalLiquidityUsd: pools.reduce((sum, p) => sum + (p.liquidityUsd ?? 0), 0),
      source: "sum_of_pools",
    };
  }

  if (
    totalPools > 1 &&
    labeledLiquidityUsd != null &&
    Number.isFinite(labeledLiquidityUsd) &&
    labeledLiquidityUsd > 0
  ) {
    return {
      totalPools,
      totalLiquidityUsd: labeledLiquidityUsd,
      source: "labeled_aggregate",
    };
  }

  return { totalPools, totalLiquidityUsd: null, source: "none" };
}

/**
 * Presentation-only: total liquidity is known, but per-pool USD is intentionally
 * withheld because multiple material pools exist (never split aggregate onto cards).
 */
export function isPerPoolLiquidityAttributionWithheld(params: {
  presentationPoolCount: number;
  poolLiquidityUsd: number | null | undefined;
  totalLiquidityUsd: number | null | undefined;
}): boolean {
  const { presentationPoolCount, poolLiquidityUsd, totalLiquidityUsd } = params;
  return (
    presentationPoolCount > 1 &&
    totalLiquidityUsd != null &&
    Number.isFinite(totalLiquidityUsd) &&
    totalLiquidityUsd > 0 &&
    (poolLiquidityUsd == null || !Number.isFinite(poolLiquidityUsd))
  );
}

/** @deprecated Prefer sectionLiquidityTotals — kept for call-site compatibility. */
export function totalsWhenComparable(pools: PresentationPool[]): {
  totalPools: number;
  totalLiquidityUsd: number | null;
} {
  const t = sectionLiquidityTotals({ pools, labeledLiquidityUsd: null });
  return { totalPools: t.totalPools, totalLiquidityUsd: t.totalLiquidityUsd };
}
