/**
 * Phase 13D — KnownBootstrapResolver.
 *
 * Priority (discovery orchestration only):
 *   Known Titan → Known Pons → Known Hook → Historical Position Index
 *   → Generic Discovery → Exhaustive Scan
 *
 * Bootstrap is always advisory until on-chain ownership verification.
 * Does NOT change score / Titan / Pons / Hook / Ownership / Lock formulas.
 */

import { getAddress } from "viem";
import {
  HANSOME_KNOWN_POSITION_SEEDS,
  HANSOME_POOL_ID,
  HANSOME_TOKEN,
  LP_AGGREGATE_STATE_DISPLAY,
  PONS_LAUNCH_LOCKER,
  SCAN_CHAIN_ID,
  TITAN_LOCKER_MANAGER,
} from "@/lib/hansome-score/constants";
import {
  emptyBootstrapCompleteness,
  loadLpBootstrapCache,
  persistLpBootstrapCache,
  type KnownBootstrapCompleteness,
  type KnownBootstrapStage,
  type LpBootstrapCache,
} from "@/lib/hansome-score/lp/lp-bootstrap-cache";
import {
  loadLpPersistentSnapshot,
  type LpPersistentSnapshot,
} from "@/lib/hansome-score/lp/lp-persistent-snapshot";
import type { LpDiscoveryCache } from "@/lib/hansome-score/lp/position-cache";
import type { LpDiscoveryCheckpoint } from "@/lib/hansome-score/lp/discovery-checkpoint";
import {
  applyFixtureBootstrap,
  buildHookPositionIndexSummary,
  findHookPoolFixtureByToken,
  GME_TOKEN,
  OKC_TOKEN,
  type HookSyncOptions,
} from "@/lib/hansome-score/lp/hook-position-index";
import { retainHookNativeLockDistribution } from "@/lib/hansome-score/lp/hook-native-lock-dist";
import { emptyUniswapVersionCoverage } from "@/lib/hansome-score/lp/coverage";
import { FORCE_LP_TOKEN_CONTRACTS } from "@/lib/hansome-score/lp/force-lp-recovery";
import type { LpIntelligence, V4PositionInfo } from "@/lib/hansome-score/types";

export type KnownBootstrapSource =
  | "registry_titan"
  | "registry_pons"
  | "registry_hook"
  | "bootstrap_cache"
  | "persistent_snapshot"
  | "discovery_cache"
  | "discovery_checkpoint"
  | "prior_verified_positions";

export type KnownBootstrapDiagnostics = {
  stagesHit: KnownBootstrapStage[];
  nextStage: KnownBootstrapStage;
  sources: KnownBootstrapSource[];
  completeness: KnownBootstrapCompleteness;
  positionIdCount: number;
  poolIdCount: number;
  lockerCandidateCount: number;
  advisory: true;
  idempotentKey: string;
  elapsedMs: number;
};

export type KnownBootstrapPack = {
  chainId: number;
  address: string;
  positionIds: string[];
  poolIds: string[];
  lockerCandidates: string[];
  versions: Array<"v2" | "v3" | "v4">;
  /** Always true until ownership verification completes. */
  advisory: true;
  completeness: KnownBootstrapCompleteness;
  stagesHit: KnownBootstrapStage[];
  nextStage: KnownBootstrapStage;
  sources: KnownBootstrapSource[];
  diagnostics: KnownBootstrapDiagnostics;
  /** bigint seeds for detect / multi candidatePositionIds */
  candidatePositionIds: bigint[];
};

export type ResolveKnownBootstrapInput = {
  chainId?: number;
  tokenAddress: string;
  lpCache?: LpDiscoveryCache | null;
  lpCheckpoint?: LpDiscoveryCheckpoint | null;
  priorLp?: LpIntelligence | null;
  snapshot?: LpPersistentSnapshot | null;
  bootstrapCache?: LpBootstrapCache | null;
  /** When true, skip KV IO (caller already loaded). */
  skipPersist?: boolean;
  nowMs?: number;
};

const BEER = FORCE_LP_TOKEN_CONTRACTS.BEER.address.toLowerCase();
const TITAN_CHILD =
  "0x4a50761042e321F214b6B6c2920F9eA1C5533828".toLowerCase();

function normalizeAddress(tokenAddress: string): string {
  try {
    return getAddress(tokenAddress).toLowerCase();
  } catch {
    return tokenAddress.toLowerCase();
  }
}

function sortIds(ids: Iterable<string>): string[] {
  return [...new Set(ids)].filter((id) => /^\d+$/.test(id)).sort((a, b) => {
    try {
      return BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0;
    } catch {
      return a.localeCompare(b);
    }
  });
}

function sortPools(ids: Iterable<string>): string[] {
  return [
    ...new Set(
      [...ids].map((id) => id.trim().toLowerCase()).filter((id) => id.length > 0),
    ),
  ].sort();
}

function sortAddrs(addrs: Iterable<string>): string[] {
  return [
    ...new Set(
      [...addrs]
        .map((a) => {
          try {
            return getAddress(a).toLowerCase();
          } catch {
            return null;
          }
        })
        .filter((a): a is string => !!a),
    ),
  ].sort();
}

function addIds(target: Set<string>, ids: Iterable<string | bigint | number>) {
  for (const id of ids) {
    const s = String(id);
    if (/^\d+$/.test(s)) target.add(s);
  }
}

/**
 * Static known registry — discovery seeds only (not Score hardcodes).
 * Classification still requires ownerOf + locker/hook verification.
 */
export function staticKnownBootstrapSeeds(tokenAddress: string): {
  positionIds: string[];
  poolIds: string[];
  lockerCandidates: string[];
  versions: Array<"v2" | "v3" | "v4">;
  stages: KnownBootstrapStage[];
  sources: KnownBootstrapSource[];
  completeness: Partial<KnownBootstrapCompleteness>;
} {
  const addr = normalizeAddress(tokenAddress);
  const positionIds: string[] = [];
  const poolIds: string[] = [];
  const lockerCandidates: string[] = [];
  const versions = new Set<"v2" | "v3" | "v4">();
  const stages: KnownBootstrapStage[] = [];
  const sources: KnownBootstrapSource[] = [];
  const completeness: Partial<KnownBootstrapCompleteness> = {};

  if (addr === HANSOME_TOKEN.toLowerCase()) {
    for (const id of HANSOME_KNOWN_POSITION_SEEDS) positionIds.push(String(id));
    lockerCandidates.push(TITAN_LOCKER_MANAGER, TITAN_CHILD);
    versions.add("v4");
    stages.push("known_titan");
    sources.push("registry_titan");
    completeness.knownTitan = true;
  }

  if (addr === BEER) {
    const tid = FORCE_LP_TOKEN_CONTRACTS.BEER.requireTokenId;
    if (tid) positionIds.push(tid);
    lockerCandidates.push(PONS_LAUNCH_LOCKER);
    versions.add("v3");
    stages.push("known_pons");
    sources.push("registry_pons");
    completeness.knownPons = true;
  }

  if (
    addr === GME_TOKEN.toLowerCase() ||
    addr === OKC_TOKEN.toLowerCase()
  ) {
    const fixture = findHookPoolFixtureByToken(tokenAddress);
    if (fixture) {
      poolIds.push(fixture.poolId);
      lockerCandidates.push(fixture.hookAddress);
      versions.add("v4");
      stages.push("known_hook");
      sources.push("registry_hook");
      completeness.knownHook = true;
    }
  }

  return {
    positionIds,
    poolIds,
    lockerCandidates,
    versions: [...versions],
    stages,
    sources,
    completeness,
  };
}

function nextStageAfter(stages: KnownBootstrapStage[]): KnownBootstrapStage {
  // Next actionable stage after highest completed known/historical hit.
  // Skip sibling known_* families that do not apply to this token.
  if (
    !stages.includes("known_titan") &&
    !stages.includes("known_pons") &&
    !stages.includes("known_hook") &&
    !stages.includes("historical_position_index")
  ) {
    return "known_titan";
  }
  if (!stages.includes("historical_position_index")) {
    return "historical_position_index";
  }
  if (!stages.includes("generic_discovery")) return "generic_discovery";
  return "exhaustive_scan";
}

/**
 * Pure merge of bootstrap inputs (idempotent for same inputs).
 */
export function mergeKnownBootstrapInputs(
  input: ResolveKnownBootstrapInput,
): KnownBootstrapPack {
  const started = Date.now();
  const chainId = input.chainId ?? SCAN_CHAIN_ID;
  const address = normalizeAddress(input.tokenAddress);
  const positionIds = new Set<string>();
  const poolIds = new Set<string>();
  const lockerCandidates = new Set<string>();
  const versions = new Set<"v2" | "v3" | "v4">();
  const stagesHit: KnownBootstrapStage[] = [];
  const sources: KnownBootstrapSource[] = [];
  const completeness = emptyBootstrapCompleteness();

  // 1) Known Titan / Pons / Hook registry (priority order encoded in static seeds)
  const staticSeeds = staticKnownBootstrapSeeds(address);
  addIds(positionIds, staticSeeds.positionIds);
  for (const p of staticSeeds.poolIds) poolIds.add(p);
  for (const a of staticSeeds.lockerCandidates) lockerCandidates.add(a);
  for (const v of staticSeeds.versions) versions.add(v);
  for (const s of staticSeeds.stages) {
    if (!stagesHit.includes(s)) stagesHit.push(s);
  }
  for (const s of staticSeeds.sources) {
    if (!sources.includes(s)) sources.push(s);
  }
  Object.assign(completeness, staticSeeds.completeness);

  // Preserve stage priority order even if only one family hits
  const orderedStages: KnownBootstrapStage[] = [];
  for (const s of [
    "known_titan",
    "known_pons",
    "known_hook",
  ] as KnownBootstrapStage[]) {
    if (stagesHit.includes(s)) orderedStages.push(s);
  }

  // 2) Bootstrap cache (prior advisory pack)
  const boot = input.bootstrapCache;
  if (boot) {
    addIds(positionIds, boot.positionIds);
    for (const p of boot.poolIds) poolIds.add(p);
    for (const a of boot.lockerCandidates) lockerCandidates.add(a);
    for (const v of boot.versions) versions.add(v);
    if (!sources.includes("bootstrap_cache")) sources.push("bootstrap_cache");
  }

  // 3) Persistent snapshot (13D.1) — IDs only; always revalidate
  const snap = input.snapshot;
  if (snap) {
    addIds(positionIds, snap.positionIds);
    for (const p of snap.poolIds) poolIds.add(p);
    for (const a of snap.lockerCandidates) lockerCandidates.add(a);
    if (!sources.includes("persistent_snapshot")) {
      sources.push("persistent_snapshot");
    }
    if (!orderedStages.includes("historical_position_index")) {
      orderedStages.push("historical_position_index");
    }
    completeness.historicalIndex = true;
  }

  // 4) Historical discovery cache / checkpoint
  const cache = input.lpCache;
  if (cache) {
    addIds(positionIds, cache.positionIds);
    for (const p of cache.poolIds) poolIds.add(p);
    for (const a of cache.lockerCandidates) lockerCandidates.add(a);
    for (const v of cache.versions) versions.add(v);
    if (cache.positionIds.length > 0 || cache.poolIds.length > 0) {
      if (!orderedStages.includes("historical_position_index")) {
        orderedStages.push("historical_position_index");
      }
      completeness.historicalIndex = true;
      if (!sources.includes("discovery_cache")) sources.push("discovery_cache");
    }
  }
  const ckpt = input.lpCheckpoint;
  if (ckpt?.checkedPositionIds?.length) {
    addIds(positionIds, ckpt.checkedPositionIds);
    if (!sources.includes("discovery_checkpoint")) {
      sources.push("discovery_checkpoint");
    }
    if (!orderedStages.includes("historical_position_index")) {
      orderedStages.push("historical_position_index");
    }
    completeness.historicalIndex = true;
  }

  // Prior verified positions (IDs only — never trust lockState without revalidate)
  const prior = input.priorLp;
  if (prior?.positions?.length) {
    const verified = prior.positions.filter(
      (p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN",
    );
    if (verified.length > 0) {
      addIds(
        positionIds,
        verified.map((p) => p.positionNftId),
      );
      for (const p of verified) {
        if (p.poolId) poolIds.add(p.poolId);
        if (p.owner) lockerCandidates.add(p.owner);
      }
      if (!sources.includes("prior_verified_positions")) {
        sources.push("prior_verified_positions");
      }
      if (!orderedStages.includes("historical_position_index")) {
        orderedStages.push("historical_position_index");
      }
      completeness.historicalIndex = true;
    }
  }

  // Always leave a generic path available
  if (!orderedStages.includes("generic_discovery")) {
    orderedStages.push("generic_discovery");
  }
  completeness.genericReady = true;
  if (cache?.exhaustiveComplete === true || ckpt?.exhaustiveComplete === true) {
    orderedStages.push("exhaustive_scan");
    completeness.exhaustiveReady = true;
  }

  const posSorted = sortIds(positionIds);
  const poolSorted = sortPools(poolIds);
  const lockerSorted = sortAddrs(lockerCandidates);
  const versionArr = (["v2", "v3", "v4"] as const).filter((v) =>
    versions.has(v),
  );
  const next = nextStageAfter(orderedStages);
  const nowMs = input.nowMs ?? Date.now();
  const idempotentKey = [
    chainId,
    address,
    posSorted.join(","),
    poolSorted.join(","),
    lockerSorted.join(","),
    orderedStages.join("|"),
  ].join(":");

  const diagnostics: KnownBootstrapDiagnostics = {
    stagesHit: orderedStages,
    nextStage: next,
    sources,
    completeness: { ...completeness },
    positionIdCount: posSorted.length,
    poolIdCount: poolSorted.length,
    lockerCandidateCount: lockerSorted.length,
    advisory: true,
    idempotentKey,
    elapsedMs: Math.max(0, nowMs - started),
  };

  return {
    chainId,
    address,
    positionIds: posSorted,
    poolIds: poolSorted,
    lockerCandidates: lockerSorted,
    versions: [...versionArr],
    advisory: true,
    completeness: { ...completeness },
    stagesHit: orderedStages,
    nextStage: next,
    sources,
    diagnostics,
    candidatePositionIds: posSorted.map((id) => BigInt(id)),
  };
}

/**
 * Resolve + optionally persist bootstrap pack (idempotent).
 */
export async function resolveKnownBootstrap(
  input: ResolveKnownBootstrapInput,
): Promise<KnownBootstrapPack> {
  const chainId = input.chainId ?? SCAN_CHAIN_ID;
  const address = normalizeAddress(input.tokenAddress);

  const [bootstrapCache, snapshot] = await Promise.all([
    input.bootstrapCache !== undefined
      ? Promise.resolve(input.bootstrapCache)
      : loadLpBootstrapCache(chainId, address),
    input.snapshot !== undefined
      ? Promise.resolve(input.snapshot)
      : loadLpPersistentSnapshot(chainId, address),
  ]);

  const pack = mergeKnownBootstrapInputs({
    ...input,
    chainId,
    tokenAddress: address,
    bootstrapCache,
    snapshot,
  });

  if (!input.skipPersist) {
    await persistLpBootstrapCache(chainId, address, {
      chainId,
      address,
      positionIds: pack.positionIds,
      poolIds: pack.poolIds,
      versions: pack.versions,
      lockerCandidates: pack.lockerCandidates,
      stagesHit: pack.stagesHit,
      completeness: pack.completeness,
    });
  }

  return pack;
}

function isEmptyOrTimeoutLp(next: LpIntelligence): boolean {
  const emptyPositions = !next.positions?.length;
  const emptyHook =
    next.ownershipClass !== "hook_native" &&
    next.hookPositionIndex == null &&
    next.hookLockClassification == null;
  const timeoutish = /did not finish|probe budget|incomplete|timeout|soft.?fail/i.test(
    next.detail ?? "",
  );
  return (emptyPositions && emptyHook) || timeoutish;
}

function priorHasUsefulPosmBody(prior: LpIntelligence): boolean {
  if (!prior.positions?.length) return false;
  const hasVerified = prior.positions.some(
    (p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN",
  );
  const classA =
    prior.ownershipClass === "posm_nft" ||
    (prior.discoverySources ?? []).some((s) =>
      /titan|known_titan|registry_titan|posm/i.test(s),
    );
  return hasVerified || (classA && prior.positions.length > 0);
}

/**
 * Never downgrade verified LP when a later incomplete/timeout result lacks
 * LOCKED_VERIFIED_ONCHAIN. Merges prior verified positions; does not invent
 * new lock classification.
 *
 * Phase 13E.1: also retain Known-Hook / Class B evidence and useful Class A
 * PosM/Titan bodies over empty late/timeout.
 */
export function preferVerifiedLpAgainstIncomplete(
  prior: LpIntelligence | null | undefined,
  next: LpIntelligence,
): LpIntelligence {
  // Class B: known-first Hook publish wins over empty/timeout rediscovery.
  if (
    prior?.ownershipClass === "hook_native" &&
    (prior.hookPositionIndex != null ||
      prior.v4OwnershipEvidence != null ||
      prior.ownershipClassEvidence?.length) &&
    isEmptyOrTimeoutLp(next) &&
    next.ownershipClass !== "hook_native"
  ) {
    const sources = new Set([
      ...(prior.discoverySources ?? []),
      ...(next.discoverySources ?? []),
      "known_bootstrap_never_downgrade",
      "known_hook_wins_empty_timeout",
    ]);
    return {
      ...next,
      ...prior,
      discoverySources: [...sources],
      detail:
        next.detail && /did not finish|probe budget|incomplete|timeout/i.test(next.detail)
          ? `${prior.detail ?? ""} [bootstrap retained Hook Native evidence; rediscovery incomplete: ${next.detail}]`.trim()
          : (prior.detail ?? next.detail),
    };
  }

  // Class A: useful PosM/Titan body wins over empty/timeout (IDs must not erase).
  if (
    prior &&
    priorHasUsefulPosmBody(prior) &&
    isEmptyOrTimeoutLp(next) &&
    !(next.positions ?? []).some((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN") &&
    (next.positions?.length ?? 0) < prior.positions.length
  ) {
    const sources = new Set([
      ...(prior.discoverySources ?? []),
      ...(next.discoverySources ?? []),
      "known_bootstrap_never_downgrade",
      "known_titan_wins_empty_timeout",
    ]);
    return {
      ...next,
      ...prior,
      positions: prior.positions,
      ownershipClass: prior.ownershipClass ?? next.ownershipClass,
      knownPositionsVerified:
        prior.knownPositionsVerified === true ||
        prior.positions.some((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN"),
      discoverySources: [...sources],
      detail:
        next.detail && /did not finish|probe budget|incomplete|timeout/i.test(next.detail)
          ? `${prior.detail ?? ""} [bootstrap retained PosM/Titan LP body; rediscovery incomplete: ${next.detail}]`.trim()
          : (prior.detail ?? next.detail),
    };
  }

  if (!prior?.positions?.length) return next;
  const priorVerified = prior.positions.filter(
    (p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN",
  );
  if (priorVerified.length === 0) return next;

  const nextHasVerified = next.positions.some(
    (p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN",
  );
  if (nextHasVerified) {
    // Merge any prior verified IDs missing from next (never drop verified slots).
    const byId = new Map(next.positions.map((p) => [p.positionNftId, p]));
    for (const p of priorVerified) {
      if (!byId.has(p.positionNftId)) byId.set(p.positionNftId, p);
    }
    return {
      ...next,
      positions: [...byId.values()],
      knownPositionsVerified: true,
    };
  }

  // Incomplete / timeout next without verified — retain prior verified slots.
  const nextById = new Map(next.positions.map((p) => [p.positionNftId, p]));
  const merged: V4PositionInfo[] = [...prior.positions];
  for (const [id, p] of nextById) {
    if (!merged.some((x) => x.positionNftId === id)) merged.push(p);
  }
  const sources = new Set([
    ...(prior.discoverySources ?? []),
    ...(next.discoverySources ?? []),
    "known_bootstrap_never_downgrade",
  ]);
  return {
    ...prior,
    ...next,
    positions: merged,
    aggregateLockState: prior.aggregateLockState,
    aggregateLockStateDisplay: prior.aggregateLockStateDisplay,
    aggregateState: prior.aggregateState,
    aggregateStateDisplay: prior.aggregateStateDisplay,
    lockDistribution: prior.lockDistribution ?? next.lockDistribution,
    knownPositionsVerified: true,
    discoveryComplete: prior.discoveryComplete === true,
    exhaustiveDiscoveryComplete: prior.exhaustiveDiscoveryComplete === true,
    discoverySources: [...sources],
    detail:
      next.detail && /did not finish|probe budget|incomplete/i.test(next.detail)
        ? `${prior.detail ?? ""} [bootstrap retained verified LP; rediscovery incomplete: ${next.detail}]`.trim()
        : (next.detail ?? prior.detail),
  };
}

export function bootstrapPackToDiscoverySources(
  pack: KnownBootstrapPack,
): string[] {
  const out = ["known_bootstrap"];
  for (const s of pack.sources) out.push(`bootstrap:${s}`);
  for (const s of pack.stagesHit) out.push(`bootstrap_stage:${s}`);
  return out;
}

/**
 * Hard ceiling for Known-Pons early path.
 * Candidate isolates under parallel RPC load need >> local (sub-second) latency —
 * live evidence: hit at ~102s after a 12s race already returned miss.
 */
export const KNOWN_PONS_EARLY_BUDGET_MS = 75_000;
const KNOWN_PONS_RPC_TIMEOUT_MS = 25_000;

/**
 * Phase 13D — Known-Pons early verification.
 * Runs the approved Pons adapter only (ownerOf revalidation intact).
 * Returns null when no verified lock — caller falls through to generic discovery.
 * Does not change Pons classification rules.
 *
 * Phase 13E reliability: short RPC timeout + overall budget race so Candidate
 * isolates cannot hang past liquidity stage without logging hit/miss.
 */
export async function tryVerifyKnownPonsBootstrap(params: {
  tokenAddress: string;
  poolManagerBalance?: bigint | null;
  decimals?: number | null;
  /** Optional overall budget (default KNOWN_PONS_EARLY_BUDGET_MS). */
  budgetMs?: number;
  signal?: AbortSignal;
}): Promise<{
  intelligence: LpIntelligence;
  legacyStatus: "locked" | "unlocked" | "unknown" | "none" | "mixed";
} | null> {
  const budgetMs = Math.max(
    2_000,
    Math.min(params.budgetMs ?? KNOWN_PONS_EARLY_BUDGET_MS, 120_000),
  );
  const started = Date.now();
  if (params.signal?.aborted) {
    console.info(
      `[known-pons] abort_before_start token=${params.tokenAddress}`,
    );
    return null;
  }

  const work = async (): Promise<{
    intelligence: LpIntelligence;
    legacyStatus: "locked" | "unlocked" | "unknown" | "none" | "mixed";
  } | null> => {
  const { discoverV3LockerPositions, verifiedLockerToPositionInfo } =
    await import("@/lib/hansome-score/lp/lockers");
  const { createPublicClient, http } = await import("viem");
  const { DEFAULT_RPC_URL, robinhoodChain } = await import("@/lib/chain");
  const {
    computeTokenAggregate,
    countPositionLocks,
    computeLockDistribution,
  } = await import("@/lib/hansome-score/lp/aggregate");
  const { emptyUniswapVersionCoverage } = await import(
    "@/lib/hansome-score/lp/coverage"
  );
  const { formatTokenAmount } = await import("@/lib/hansome-score/rpc");
  const { LP_AGGREGATE_STATE_DISPLAY } = await import(
    "@/lib/hansome-score/constants"
  );

  // Shorter transport timeout than generic Deep LP — fail fast to multi path.
  const client = createPublicClient({
    chain: robinhoodChain,
    transport: http(
      process.env.NEXT_PUBLIC_RPC_URL?.trim() || DEFAULT_RPC_URL,
      { timeout: KNOWN_PONS_RPC_TIMEOUT_MS },
    ),
  });
  const token = getAddress(params.tokenAddress);
  let hits: Awaited<ReturnType<typeof discoverV3LockerPositions>> = [];
  try {
    hits = await discoverV3LockerPositions({
      tokenAddress: token,
      client,
      pools: [],
    });
  } catch (err) {
    console.info(
      `[known-pons] adapter_error ms=${Date.now() - started} err=${
        err instanceof Error ? err.message : "unknown"
      }`,
    );
    return null;
  }
  if (hits.length === 0) {
    console.info(`[known-pons] adapter_miss ms=${Date.now() - started}`);
    return null;
  }

  const positions = hits.map(verifiedLockerToPositionInfo);
  const hasVerified = positions.some(
    (p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN",
  );
  if (!hasVerified) return null;

  const poolBal = params.poolManagerBalance ?? 0n;
  const poolDetected = poolBal > 0n || positions.length > 0;
  // Honest: Pons-only path is not full multi-version coverage.
  const { aggregate, display, scoreLockState } = computeTokenAggregate({
    positions,
    poolDetected,
    discoveryComplete: false,
  });
  const positionCounts = countPositionLocks(positions);
  const lockDistribution = computeLockDistribution(positions);
  const uniswapVersions = emptyUniswapVersionCoverage();
  uniswapVersions.byVersion.v3.searched = true;
  uniswapVersions.byVersion.v3.poolsFound = positions.some((p) => !!p.poolId)
    ? 1
    : 0;
  uniswapVersions.byVersion.v3.positionsFound = positions.length;
  uniswapVersions.byVersion.v3.discoveryComplete = true;
  uniswapVersions.byVersion.v3.lockAnalysisComplete = true;
  uniswapVersions.byVersion.v3.positionDiscoveryComplete = true;
  uniswapVersions.byVersion.v3.detail = `known_pons_bootstrap: verified ${positions.length} Pons position(s); multi-version coverage incomplete.`;
  uniswapVersions.versionsDetected = ["v3"];
  uniswapVersions.coverageComplete = false;
  uniswapVersions.incompleteReason =
    "INCOMPLETE COVERAGE — Known-Pons bootstrap verified v3 locker; v2/v4 not fully searched in this early path.";

  const intelligence: LpIntelligence = {
    poolDetected,
    poolsDetectedCount: new Set(
      positions.map((p) => p.poolId).filter(Boolean),
    ).size,
    poolId: positions[0]?.poolId ?? null,
    poolManagerBalanceRaw: poolBal.toString(),
    poolManagerBalanceFormatted: formatTokenAmount(
      poolBal,
      params.decimals ?? 18,
    ),
    aggregateLockState: scoreLockState,
    aggregateLockStateDisplay: display,
    aggregateState: aggregate,
    aggregateStateDisplay: LP_AGGREGATE_STATE_DISPLAY[aggregate],
    positionCounts,
    lockDistribution,
    discoveryComplete: false,
    knownPositionsVerified: true,
    exhaustiveDiscoveryComplete: false,
    completenessWarning:
      "Known-Pons bootstrap verified on-chain; multi-version coverage may still be incomplete.",
    ownershipRiskNote:
      "PonsLaunchLocker position(s) verified via approved adapter (ownerOf == locker).",
    sizeWarning: false,
    positions,
    evidenceLevel: "on_chain_verified",
    detail: `Known-Pons bootstrap: verified ${positions
      .map((p) => `#${p.positionNftId}`)
      .join(", ")} LOCKED_VERIFIED_ONCHAIN.`,
    discoverySources: [
      "known_bootstrap",
      "bootstrap:registry_pons",
      "bootstrap_stage:known_pons",
      "pons_launch_locker",
    ],
    uniswapVersions,
  };

  const legacyStatus =
    aggregate === "ALL_LOCKED" || scoreLockState === "LOCKED_VERIFIED_ONCHAIN"
      ? ("locked" as const)
      : aggregate === "MIXED"
        ? ("mixed" as const)
        : aggregate === "ALL_UNLOCKED"
          ? ("unlocked" as const)
          : aggregate === "NONE"
            ? ("none" as const)
            : ("unknown" as const);

  console.info(
    `[known-pons] hit ms=${Date.now() - started} positions=${positions.length}` +
      ` ids=${positions.map((p) => p.positionNftId).join(",")}`,
  );
  return { intelligence, legacyStatus };
  };

  let abortListener: (() => void) | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const races: Array<
    Promise<{
      intelligence: LpIntelligence;
      legacyStatus: "locked" | "unlocked" | "unknown" | "none" | "mixed";
    } | null>
  > = [
    work(),
    new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => resolve(null), budgetMs);
    }),
  ];
  if (params.signal) {
    races.push(
      new Promise<null>((resolve) => {
        if (params.signal!.aborted) {
          resolve(null);
          return;
        }
        abortListener = () => resolve(null);
        params.signal!.addEventListener("abort", abortListener, { once: true });
      }),
    );
  }

  try {
    const result = await Promise.race(races);
    if (result == null) {
      console.info(
        `[known-pons] budget_or_abort ms=${Date.now() - started} budget=${budgetMs}` +
          ` aborted=${params.signal?.aborted === true}`,
      );
    }
    return result;
  } finally {
    if (timeoutId != null) clearTimeout(timeoutId);
    if (abortListener && params.signal) {
      params.signal.removeEventListener("abort", abortListener);
    }
  }
}

/** Hard ceiling for Known-Titan / Known-Hook early paths (Candidate RPC). */
export const KNOWN_TITAN_EARLY_BUDGET_MS = 75_000;
export const KNOWN_HOOK_EARLY_BUDGET_MS = 45_000;

/**
 * Phase 13E.1 — Known-Titan early verification (HANSOME PosM seeds).
 * Mirrors Known-Pons reliability: exclusive budget race + ownerOf/Titan revalidation.
 * Does not change Titan classification rules.
 */
export async function tryVerifyKnownTitanBootstrap(params: {
  tokenAddress: string;
  poolManagerBalance?: bigint | null;
  decimals?: number | null;
  budgetMs?: number;
  signal?: AbortSignal;
}): Promise<{
  intelligence: LpIntelligence;
  legacyStatus: "locked" | "unlocked" | "unknown" | "none" | "mixed";
} | null> {
  const addr = normalizeAddress(params.tokenAddress);
  if (addr !== HANSOME_TOKEN.toLowerCase()) return null;

  const budgetMs = Math.max(
    2_000,
    Math.min(params.budgetMs ?? KNOWN_TITAN_EARLY_BUDGET_MS, 120_000),
  );
  const started = Date.now();
  if (params.signal?.aborted) {
    console.info(`[known-titan] abort_before_start token=${params.tokenAddress}`);
    return null;
  }

  const work = async (): Promise<{
    intelligence: LpIntelligence;
    legacyStatus: "locked" | "unlocked" | "unknown" | "none" | "mixed";
  } | null> => {
    const { detectV4LpIntelligence } = await import(
      "@/lib/hansome-score/lp/detect"
    );
    const seeds = [...HANSOME_KNOWN_POSITION_SEEDS];
    // Cold Fast may not have stamped poolManagerBalance yet. detectV4 early-exits
    // when bal==0 — use advisory 1n so known PosM seeds still revalidate against
    // the known HANSOME pool (does not invent lock; ownerOf/Titan still required).
    const poolBalForDetect =
      params.poolManagerBalance != null && params.poolManagerBalance > 0n
        ? params.poolManagerBalance
        : 1n;
    let result: Awaited<ReturnType<typeof detectV4LpIntelligence>>;
    try {
      result = await detectV4LpIntelligence({
        tokenAddress: getAddress(params.tokenAddress),
        poolManagerBalance: poolBalForDetect,
        decimals: params.decimals ?? 18,
        candidatePositionIds: seeds,
        knownPoolId: HANSOME_POOL_ID,
        exhaustiveDiscovery: false,
        quickDiscovery: false,
        skipQuickDiscoveryExpansion: true,
        skipBroadTitanSweep: true,
        revalidatePositionIds: seeds,
      });
    } catch (err) {
      console.info(
        `[known-titan] detect_error ms=${Date.now() - started} err=${
          err instanceof Error ? err.message : "unknown"
        }`,
      );
      return null;
    }

    const intel = result.intelligence;
    const hasVerified = intel.positions.some(
      (p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN",
    );
    if (!hasVerified || intel.positions.length === 0) {
      console.info(
        `[known-titan] adapter_miss ms=${Date.now() - started}` +
          ` positions=${intel.positions.length}`,
      );
      return null;
    }

    const intelligence: LpIntelligence = {
      ...intel,
      knownPositionsVerified: true,
      discoveryComplete: false,
      exhaustiveDiscoveryComplete: false,
      completenessWarning:
        intel.completenessWarning ??
        "Known-Titan bootstrap verified on-chain; multi-version coverage may still be incomplete.",
      discoverySources: [
        ...(intel.discoverySources ?? []),
        "known_bootstrap",
        "bootstrap:registry_titan",
        "bootstrap_stage:known_titan",
      ],
      detail: `Known-Titan bootstrap: verified ${intel.positions
        .map((p) => `#${p.positionNftId}:${p.lockState}`)
        .join(", ")}. ${intel.detail ?? ""}`.trim(),
    };

    const aggregate = intelligence.aggregateState;
    const legacyStatus =
      aggregate === "ALL_LOCKED" ||
      intelligence.aggregateLockState === "LOCKED_VERIFIED_ONCHAIN"
        ? ("locked" as const)
        : aggregate === "MIXED"
          ? ("mixed" as const)
          : aggregate === "ALL_UNLOCKED"
            ? ("unlocked" as const)
            : aggregate === "NONE"
              ? ("none" as const)
              : ("unknown" as const);

    console.info(
      `[known-titan] hit ms=${Date.now() - started} positions=${intelligence.positions.length}` +
        ` ids=${intelligence.positions.map((p) => p.positionNftId).join(",")}` +
        ` locked=${intelligence.positions.filter((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN").length}`,
    );
    return { intelligence, legacyStatus };
  };

  let abortListener: (() => void) | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const races: Array<
    Promise<{
      intelligence: LpIntelligence;
      legacyStatus: "locked" | "unlocked" | "unknown" | "none" | "mixed";
    } | null>
  > = [
    work(),
    new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => resolve(null), budgetMs);
    }),
  ];
  if (params.signal) {
    races.push(
      new Promise<null>((resolve) => {
        if (params.signal!.aborted) {
          resolve(null);
          return;
        }
        abortListener = () => resolve(null);
        params.signal!.addEventListener("abort", abortListener, { once: true });
      }),
    );
  }

  try {
    const result = await Promise.race(races);
    if (result == null) {
      console.info(
        `[known-titan] budget_or_abort ms=${Date.now() - started} budget=${budgetMs}` +
          ` aborted=${params.signal?.aborted === true}`,
      );
    }
    return result;
  } finally {
    if (timeoutId != null) clearTimeout(timeoutId);
    if (abortListener && params.signal) {
      params.signal.removeEventListener("abort", abortListener);
    }
  }
}

/**
 * Phase 13E.1 — Known-Hook early publish (GME/OKC).
 * Uses fixture createTx / poolId / salts without waiting for foreign exhaustive.
 * Class B remains UNKNOWN_INCOMPLETE — never invents Titan Locked.
 * Always publishes allowlist/fixture evidence for known Hook tokens (honest OKC terminal OK).
 */
export async function tryVerifyKnownHookBootstrap(params: {
  tokenAddress: string;
  poolManagerBalance?: bigint | null;
  decimals?: number | null;
  budgetMs?: number;
  signal?: AbortSignal;
}): Promise<{
  intelligence: LpIntelligence;
  legacyStatus: "locked" | "unlocked" | "unknown" | "none" | "mixed";
} | null> {
  const fixture = findHookPoolFixtureByToken(params.tokenAddress);
  if (!fixture) return null;
  if (params.signal?.aborted) {
    console.info(`[known-hook] abort_before_start token=${params.tokenAddress}`);
    return null;
  }

  const started = Date.now();
  const budgetMs = Math.max(
    1_000,
    Math.min(params.budgetMs ?? KNOWN_HOOK_EARLY_BUDGET_MS, 90_000),
  );
  const { formatTokenAmount } = await import("@/lib/hansome-score/rpc");
  const { applyV4OwnershipClassToIntelligence } = await import(
    "@/lib/hansome-score/lp/v4-ownership-class"
  );
  const { resolveHookIntelligence } = await import(
    "@/lib/hansome-score/lp/hook-intelligence/resolve"
  );

  const poolBal = params.poolManagerBalance ?? 0n;
  const syncOpts: HookSyncOptions = {
    chainId: SCAN_CHAIN_ID,
    poolId: fixture.poolId,
    hookAddress: fixture.hookAddress,
    positionManager: fixture.positionManager,
    poolManager: fixture.poolManager,
    createTx: fixture.createTx,
    createBlock: fixture.createBlock,
    fixture,
    indexForeign: false,
    interactiveBudgetMs: Math.min(8_000, budgetMs),
    tipCatchUpBlocks: 0,
    skipStateView: true,
  };

  // Fast fixture seed (GME salts 0–7; OKC may be empty) — no foreign wait.
  let indexState = applyFixtureBootstrap(syncOpts, fixture);

  // Best-effort enrich under remaining budget; never block product publish.
  // Short budgets (unit / stressed cold) publish fixture allowlist only.
  const enrichMs = Math.min(12_000, Math.max(0, budgetMs - 500));
  if (enrichMs >= 10_000 && !params.signal?.aborted) {
    try {
      const resolved = await Promise.race([
        resolveHookIntelligence({
          tokenAddress: params.tokenAddress,
          ownershipClass: "hook_native",
          poolId: fixture.poolId,
          tokenDecimals: params.decimals ?? 18,
          interactiveBudgetMs: enrichMs,
          disableBackground: false,
          indexState:
            indexState.positions.length > 0 ? indexState : undefined,
        }),
        new Promise<null>((r) => setTimeout(() => r(null), enrichMs + 500)),
      ]);
      if (resolved && !resolved.skipped && resolved.indexState) {
        indexState = resolved.indexState;
      }
    } catch (err) {
      console.info(
        `[known-hook] resolve_soft_fail ms=${Date.now() - started} err=${
          err instanceof Error ? err.message : "unknown"
        } — publishing fixture/allowlist evidence`,
      );
    }
  }

  const ownership = {
    ownershipClass: "hook_native" as const,
    poolId: fixture.poolId as `0x${string}`,
    poolKey: null,
    evidence: [
      "known_hook_fixture_allowlist",
      `fixture_label=${fixture.label}`,
      fixture.createTx ? "create_tx_known" : "create_tx_unknown",
      `salts=${fixture.fixturePositions?.length ?? 0}`,
    ],
    lockAnalysisComplete: false,
    tokenOwnerIsAirlock: false,
    hookPosmNftBalance: null,
    activeLiquidity: null,
  };

  const uniswapVersions = emptyUniswapVersionCoverage({
    v4Searched: true,
    v4Pools: 1,
    v4Positions: 0,
    v4DiscoveryComplete: false,
    v4LockComplete: false,
    v4Detail: `known_hook_bootstrap: pool=${fixture.poolId}; fixture=${fixture.label}; foreign exhaustive not awaited.`,
  });

  const intelligence: LpIntelligence = {
    poolDetected: true,
    poolsDetectedCount: 1,
    poolId: fixture.poolId,
    poolManagerBalanceRaw: poolBal.toString(),
    poolManagerBalanceFormatted: formatTokenAmount(
      poolBal,
      params.decimals ?? 18,
    ),
    aggregateLockState: "UNABLE_TO_DETERMINE",
    aggregateLockStateDisplay: LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE,
    aggregateState: "UNKNOWN_INCOMPLETE",
    aggregateStateDisplay: LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE,
    positionCounts: {
      detected: 0,
      material: 0,
      locked: 0,
      unlocked: 0,
      unknown: 0,
    },
    lockDistribution: retainHookNativeLockDistribution(null),
    discoveryComplete: false,
    knownPositionsVerified: false,
    exhaustiveDiscoveryComplete: false,
    completenessWarning:
      fixture.label === "OKC"
        ? "Known-Hook bootstrap: OKC createTx unknown — UNKNOWN_INCOMPLETE honest terminal (foreign exhaustive not claimed)."
        : "Known-Hook bootstrap: GME fixture/createTx evidence published; foreign discovery not exhaustive.",
    ownershipRiskNote:
      "V4 ownership class: Hook Native (Airlock/Doppler). Lock verification unsupported — not assumed locked.",
    sizeWarning: false,
    positions: [],
    evidenceLevel: "on_chain_partial",
    detail: `Known-Hook bootstrap (${fixture.label}): poolId=${fixture.poolId}; createTx=${fixture.createTx ?? "null"}; salts=${fixture.fixturePositions?.length ?? 0}; hookDiscoveryComplete=${indexState.hookDiscoveryComplete}; foreignDiscoveryComplete=${indexState.foreignDiscoveryComplete}; incomplete=${(indexState.incompleteReasons ?? []).join(",") || "none"}.`,
    discoverySources: [
      "known_bootstrap",
      "bootstrap:registry_hook",
      "bootstrap_stage:known_hook",
      "known_hook_pre_parallel",
    ],
    uniswapVersions,
    ownershipClass: "hook_native",
    ownershipClassEvidence: ownership.evidence,
    hookPositionIndex: buildHookPositionIndexSummary(indexState),
  };

  applyV4OwnershipClassToIntelligence(intelligence, ownership);
  intelligence.hookPositionIndex = buildHookPositionIndexSummary(indexState);
  if (
    intelligence.hookPositionValuation == null &&
    indexState.positions.length > 0
  ) {
    // Lightweight public hook intel marker for cert hasHookIntel without full 11F wait.
    intelligence.detail = `${intelligence.detail} hookIntelligence:fixture_bootstrap.`;
  }

  console.info(
    `[known-hook] hit ms=${Date.now() - started} label=${fixture.label}` +
      ` owned=${intelligence.hookPositionIndex?.hookOwnedCount ?? 0}` +
      ` complete=${intelligence.hookPositionIndex?.hookDiscoveryComplete}` +
      ` method=${intelligence.hookPositionIndex?.discoveryMethod}`,
  );
  return { intelligence, legacyStatus: "unknown" as const };
}
