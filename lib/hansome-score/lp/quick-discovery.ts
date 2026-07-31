/**
 * Cold Perf V2 Phase 5 — Quick LP discovery bounds + honesty helpers.
 *
 * Orchestration / candidate ordering only. Does not change lock classification,
 * liquidity math, or Score weights.
 */

/** Recent PositionManager transfer pages in the first useful phase (not 6). */
export const QUICK_LP_PM_MAX_PAGES = 3;

/** Max hint-owner NFT inventory lookups in Quick LP. */
export const QUICK_LP_MAX_HINT_OWNERS = 12;

/** Max brand-new candidates evaluated during Quick LP (excludes already-proven). */
export const QUICK_LP_MAX_CANDIDATES = 40;

/** Soft wall for Quick LP expansion after known-first (ms). */
export const QUICK_LP_MAX_WALL_MS = 45_000;

/** Exhaustive PM pages (background / explicit exhaustive only). */
export const EXHAUSTIVE_LP_PM_MAX_PAGES = 6;

/** Max hint owners when entering exhaustive. */
export const EXHAUSTIVE_LP_MAX_HINT_OWNERS = 24;

export type QuickLpProgressPhase =
  | "cache_revalidate"
  | "titan"
  | "hint_inventory"
  | "pm_recent"
  | "evaluate"
  | "publish"
  | "complete";

export type QuickLpProgressEvent = {
  phase: QuickLpProgressPhase;
  candidatesQueued: number;
  candidatesEvaluated: number;
  positionsFound: number;
  pmPages?: number;
  /** 0–100 work units for deepProgress (never implies final validation). */
  completedUnits: number;
  totalUnits: number;
};

/**
 * Honest unknown / incomplete reason labels for detail strings.
 * Presentation only — uses existing LpIntelligence text fields (no schema change).
 */
export type LpHonestyReason =
  | "no_liquidity_detected"
  | "discovery_incomplete"
  | "ownership_unresolved"
  | "lock_status_unknown"
  | "unsupported_locker"
  | "detected_mixed"
  | "detected_locked"
  | "detected_unlocked";

export function classifyLpHonestyReason(params: {
  poolDetected: boolean;
  positionsFound: number;
  materialCount: number;
  lockedCount: number;
  unlockedCount: number;
  unknownCount: number;
  unsupportedLockerCount: number;
  discoveryComplete: boolean;
  aggregateState: string;
}): LpHonestyReason {
  if (!params.poolDetected && params.positionsFound === 0) {
    return "no_liquidity_detected";
  }
  if (params.unsupportedLockerCount > 0 && params.lockedCount === 0) {
    return "unsupported_locker";
  }
  if (params.aggregateState === "MIXED") return "detected_mixed";
  if (params.aggregateState === "ALL_LOCKED" && params.discoveryComplete) {
    return "detected_locked";
  }
  if (params.aggregateState === "ALL_UNLOCKED") return "detected_unlocked";
  if (params.materialCount > 0 && params.unknownCount > 0) {
    return "lock_status_unknown";
  }
  if (params.positionsFound > 0 && !params.discoveryComplete) {
    return "ownership_unresolved";
  }
  return "discovery_incomplete";
}

export function honestyReasonDetail(reason: LpHonestyReason): string {
  switch (reason) {
    case "no_liquidity_detected":
      return "No Liquidity Detected — PoolManager inventory empty and no positions evaluated.";
    case "unsupported_locker":
      return "Unsupported Locker — contract owner is not a recognized locker; lock not claimed.";
    case "lock_status_unknown":
      return "Detected—Lock Status Unknown — positions found but lock ownership not fully verified.";
    case "ownership_unresolved":
      return "Detected—Ownership Unresolved — positions found; discovery still incomplete.";
    case "discovery_incomplete":
      return "Discovery Incomplete — Quick LP finished without exhaustive PositionManager history.";
    case "detected_mixed":
      return "Detected—MIXED lock evidence (verified lock + removable position).";
    case "detected_locked":
      return "Detected—locks verified with discovery marked complete.";
    case "detected_unlocked":
      return "Detected—material positions appear EOA-controlled.";
    default:
      return "Discovery Incomplete.";
  }
}

/** Cap an ID list for Quick LP evaluation (preserve insertion order). */
export function boundQuickLpCandidates(
  ids: Iterable<bigint>,
  max: number = QUICK_LP_MAX_CANDIDATES,
): bigint[] {
  const out: bigint[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const k = id.toString();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

/** True when Quick LP should stop evaluating more candidates. */
export function quickLpEvidenceSufficient(params: {
  seeds: bigint[];
  positions: Array<{
    positionNftId: string;
    lockState: string;
    removableByEoa: boolean | null;
  }>;
}): boolean {
  const { seeds, positions } = params;
  if (positions.length === 0) return false;
  const foundIds = new Set(positions.map((p) => p.positionNftId));
  const seedsSatisfied =
    seeds.length > 0 && seeds.every((id) => foundIds.has(id.toString()));
  const hasLocked = positions.some(
    (p) =>
      p.lockState === "LOCKED_VERIFIED_ONCHAIN" ||
      p.lockState === "LOCK_DETECTED_EXPIRY_UNKNOWN",
  );
  const hasRemovable = positions.some(
    (p) =>
      p.removableByEoa === true || p.lockState === "UNLOCKED_EOA_CONTROLLED",
  );
  return seedsSatisfied || (hasLocked && hasRemovable);
}
