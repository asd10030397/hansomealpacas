import {
  LP_AGGREGATE_STATE_DISPLAY,
  SCAN_CHAIN_ID,
} from "@/lib/hansome-score/constants";
import { discoverV2Liquidity } from "@/lib/hansome-score/lp/adapters/v2";
import { discoverV3Liquidity } from "@/lib/hansome-score/lp/adapters/v3";
import { discoverV4Liquidity } from "@/lib/hansome-score/lp/adapters/v4";
import type { VersionDiscoveryResult } from "@/lib/hansome-score/lp/adapters/types";
import { LOCKER_SUPPORT_PUBLIC_NOTE, UNISWAP_RH_DEPLOYMENTS } from "@/lib/hansome-score/lp/deployments";
import {
  computeLockDistribution,
  computeTokenAggregate,
  countPositionLocks,
} from "@/lib/hansome-score/lp/aggregate";
import type { DetectLpInput, DetectLpResult } from "@/lib/hansome-score/lp/detect";
import {
  persistLpDiscoveryCache,
  type LpUniswapVersion,
} from "@/lib/hansome-score/lp/position-cache";
import { emptyUniswapVersionCoverage } from "@/lib/hansome-score/lp/coverage";
import {
  isBeerToken,
  logBeerRemoteTrace,
} from "@/lib/hansome-score/lp/beer-remote-trace";
import { HOOK_NATIVE_LOCK_DISTRIBUTION_REASON } from "@/lib/hansome-score/lp/hook-native-lock-dist";
import {
  ADAPTIVE_VERSION_BUDGETS,
  adaptiveTimedProbe,
  type AdaptiveDiscoveryBudget,
} from "@/lib/hansome-score/lp/adaptive-discovery-budget";
import { formatTokenAmount } from "@/lib/hansome-score/rpc";
import type {
  EvidenceLevel,
  LpIntelligence,
  UniswapVersion,
  UniswapVersionCoverage,
  V4PositionInfo,
  VersionCoverageSlice,
} from "@/lib/hansome-score/types";

/**
 * Phase 10C-3 / 13D.2 — per-version probe budgets (base).
 * Adaptive path may expand while measurable progress continues.
 * A hung v4 Quick LP must not erase a finished v3/Pons result.
 */
export const VERSION_PROBE_BUDGET_MS = {
  v2: ADAPTIVE_VERSION_BUDGETS.v2.baseBudgetMs,
  v3: ADAPTIVE_VERSION_BUDGETS.v3.baseBudgetMs,
  v4: ADAPTIVE_VERSION_BUDGETS.v4.baseBudgetMs,
} as const;

/** Phase 13D.2 — adaptive version probe (extends while progress). */
async function adaptiveVersionProbe<T>(
  label: "v2" | "v3" | "v4",
  work: (budget: AdaptiveDiscoveryBudget) => Promise<T>,
  onTimeout: () => T,
): Promise<T> {
  const cfg = ADAPTIVE_VERSION_BUDGETS[label];
  const { result } = await adaptiveTimedProbe({
    label: `version_${label}`,
    config: { ...cfg },
    work,
    onTimeout: (budget) => {
      const d = budget.diagnostics();
      console.warn(
        `[lp-multi] ${label} adaptive terminate reason=${d.terminationReason}` +
          ` elapsed=${d.elapsedMs}ms expansions=${d.expansionCount} — soft-incomplete`,
      );
      return onTimeout();
    },
  });
  return result;
}

function v2TimeoutResult(): VersionDiscoveryResult {
  return {
    version: "v2",
    protocolSupportStatus: UNISWAP_RH_DEPLOYMENTS.v2.protocolSupportStatus,
    searched: true,
    discoveryComplete: false,
    lockAnalysisComplete: false,
    pools: [],
    positions: [],
    detail: `v2: probe budget exceeded (${VERSION_PROBE_BUDGET_MS.v2}ms) — incomplete.`,
    evidenceLevel: "unavailable",
  };
}

function v3TimeoutResult(): VersionDiscoveryResult {
  return {
    version: "v3",
    protocolSupportStatus: UNISWAP_RH_DEPLOYMENTS.v3.protocolSupportStatus,
    searched: true,
    discoveryComplete: false,
    lockAnalysisComplete: false,
    positionDiscoveryComplete: false,
    pools: [],
    positions: [],
    detail: `v3: probe budget exceeded (${VERSION_PROBE_BUDGET_MS.v3}ms) — incomplete.`,
    evidenceLevel: "unavailable",
  };
}

function v4TimeoutPack(input: DetectLpInput): {
  version: VersionDiscoveryResult;
  detect: DetectLpResult;
} {
  const poolBal = input.poolManagerBalance ?? 0n;
  const poolDetected = poolBal > 0n;
  const formattedBal = formatTokenAmount(poolBal, input.decimals ?? 18);
  const detail = `v4: probe budget exceeded (${VERSION_PROBE_BUDGET_MS.v4}ms) — Quick/PM path incomplete; sibling version results preserved.`;
  const version: VersionDiscoveryResult = {
    version: "v4",
    protocolSupportStatus: UNISWAP_RH_DEPLOYMENTS.v4.protocolSupportStatus,
    searched: true,
    discoveryComplete: false,
    lockAnalysisComplete: false,
    pools: poolDetected
      ? [
          {
            version: "v4",
            poolOrPair: input.knownPoolId ?? "v4:pool-manager-inventory",
            quoteToken: null,
            fee: null,
            tokenBalanceRaw: poolBal.toString(),
            materiality: "inventory_unknown",
          },
        ]
      : [],
    positions: [],
    detail,
    evidenceLevel: "unavailable",
  };
  const intelligence: LpIntelligence = {
    poolDetected,
    poolsDetectedCount: poolDetected ? 1 : 0,
    poolId: input.knownPoolId ?? null,
    poolManagerBalanceRaw: poolBal.toString(),
    poolManagerBalanceFormatted: formattedBal,
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
    lockDistribution: {
      available: false,
      lockedPct: null,
      unlockedPct: null,
      unknownPct: null,
      lockedUsd: null,
      unlockedUsd: null,
      unknownUsd: null,
      totalPositionUsd: null,
      poolLiquidityUsd: null,
      reconciledWithPool: false,
      method: null,
      reason: detail,
    },
    discoveryComplete: false,
    knownPositionsVerified: false,
    exhaustiveDiscoveryComplete: false,
    completenessWarning: detail,
    ownershipRiskNote: detail,
    sizeWarning: false,
    positions: [],
    evidenceLevel: "unavailable",
    detail,
    discoverySources: ["v4_probe_budget_timeout"],
    uniswapVersions: emptyUniswapVersionCoverage({
      v4Searched: true,
      v4Pools: poolDetected ? 1 : 0,
      v4DiscoveryComplete: false,
      v4LockComplete: false,
      v4Detail: detail,
    }),
  };
  return {
    version,
    detect: { intelligence, legacyStatus: "unknown" },
  };
}

function sliceFrom(result: VersionDiscoveryResult): VersionCoverageSlice {
  return {
    version: result.version,
    protocolSupportStatus: result.protocolSupportStatus,
    searched: result.searched,
    poolsFound: result.pools.length,
    positionsFound: result.positions.length,
    discoveryComplete: result.discoveryComplete,
    lockAnalysisComplete: result.lockAnalysisComplete,
    positionDiscoveryComplete: result.positionDiscoveryComplete,
    detail: result.detail,
  };
}

export function buildUniswapVersionCoverage(
  results: VersionDiscoveryResult[],
): UniswapVersionCoverage {
  const byVersion = {
    v2: sliceFrom(
      results.find((r) => r.version === "v2") ?? {
        version: "v2" as const,
        protocolSupportStatus: UNISWAP_RH_DEPLOYMENTS.v2.protocolSupportStatus,
        searched: false,
        discoveryComplete: false,
        lockAnalysisComplete: false,
        pools: [],
        positions: [],
        detail: "v2 not searched.",
        evidenceLevel: "unavailable" as EvidenceLevel,
      },
    ),
    v3: sliceFrom(
      results.find((r) => r.version === "v3") ?? {
        version: "v3" as const,
        protocolSupportStatus: UNISWAP_RH_DEPLOYMENTS.v3.protocolSupportStatus,
        searched: false,
        discoveryComplete: false,
        lockAnalysisComplete: false,
        pools: [],
        positions: [],
        detail: "v3 not searched.",
        evidenceLevel: "unavailable" as EvidenceLevel,
      },
    ),
    v4: sliceFrom(
      results.find((r) => r.version === "v4") ?? {
        version: "v4" as const,
        protocolSupportStatus: UNISWAP_RH_DEPLOYMENTS.v4.protocolSupportStatus,
        searched: false,
        discoveryComplete: false,
        lockAnalysisComplete: false,
        pools: [],
        positions: [],
        detail: "v4 not searched.",
        evidenceLevel: "unavailable" as EvidenceLevel,
      },
    ),
  };

  const versionsDetected = (["v2", "v3", "v4"] as UniswapVersion[]).filter(
    (v) => byVersion[v].poolsFound > 0,
  );

  const reasons: string[] = [];
  for (const v of ["v2", "v3", "v4"] as UniswapVersion[]) {
    const s = byVersion[v];
    if (!s.searched) {
      reasons.push(`${v} not searched`);
    } else if (!s.discoveryComplete) {
      reasons.push(`${v} discovery incomplete`);
    } else if (s.poolsFound > 0 && !s.lockAnalysisComplete) {
      reasons.push(
        `${v}: ${s.poolsFound} pool(s)/pair(s) found but lock/ownership analysis incomplete`,
      );
    }
  }

  const coverageComplete = reasons.length === 0;

  return {
    versionsDetected,
    coverageComplete,
    incompleteReason: coverageComplete
      ? null
      : `INCOMPLETE COVERAGE — ${reasons.join("; ")}. Protocol version support ≠ locker support. One Uniswap version cannot prove all-chain liquidity is locked.`,
    byVersion,
    protocolSupportNote:
      "Uniswap v2/v3/v4 deployments are active on Robinhood Chain. Adapters are partial: discovery probes run; full position/lock decode is not claimed for all versions.",
    lockerSupportNote: LOCKER_SUPPORT_PUBLIC_NOTE,
  };
}

/**
 * Cross-version token aggregate.
 * CRITICAL: a single-version lock must never yield ALL_LOCKED when other
 * versions were unsearched or have undecoded pools.
 */
export function computeMultiVersionAggregate(params: {
  positions: V4PositionInfo[];
  poolDetected: boolean;
  versionCoverage: UniswapVersionCoverage;
  /** v4-only discoveryComplete (position enumeration). */
  v4DiscoveryComplete: boolean;
}): {
  aggregate: ReturnType<typeof computeTokenAggregate>["aggregate"];
  display: string;
  scoreLockState: ReturnType<typeof computeTokenAggregate>["scoreLockState"];
  discoveryComplete: boolean;
} {
  const { positions, poolDetected, versionCoverage, v4DiscoveryComplete } = params;

  const discoveryComplete =
    versionCoverage.coverageComplete && v4DiscoveryComplete;

  // Force incomplete when multi-version coverage is incomplete — blocks ALL_LOCKED
  const r = computeTokenAggregate({
    positions,
    poolDetected,
    discoveryComplete,
  });

  // Extra safety: if any version has undecoded pools, never ALL_LOCKED
  if (
    r.aggregate === "ALL_LOCKED" &&
    !versionCoverage.coverageComplete
  ) {
    return {
      aggregate: "UNKNOWN_INCOMPLETE",
      display: LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE,
      scoreLockState: "UNABLE_TO_DETERMINE",
      discoveryComplete: false,
    };
  }

  return { ...r, discoveryComplete };
}

function legacyStatus(
  aggregate: LpIntelligence["aggregateState"],
): DetectLpResult["legacyStatus"] {
  switch (aggregate) {
    case "ALL_LOCKED":
      return "locked";
    case "ALL_UNLOCKED":
      return "unlocked";
    case "MIXED":
      return "mixed";
    case "NONE":
      return "none";
    default:
      return "unknown";
  }
}

/**
 * Multi-version LP intelligence: v2 + v3 probes + v4 PositionManager path.
 * Additive — does not replace Titan/MIXED accuracy inside detectV4LpIntelligence.
 * v2/v3/v4 run in parallel. V4 uses known-first revalidation by default
 * (skips PositionManager history when seeds/cache already yield lock evidence).
 */
export async function detectMultiVersionLpIntelligence(
  input: DetectLpInput,
): Promise<DetectLpResult> {
  const multiStarted = Date.now();
  let completedProbes = 0;
  const totalProbes = 3;
  const versionTimedOut = new Set<"v2" | "v3" | "v4">();
  const notifyProbe = async (
    version: "v2" | "v3" | "v4",
    poolsFound: number,
    positionsFound: number,
  ) => {
    completedProbes += 1;
    if (input.onVersionProbeProgress) {
      await input.onVersionProbeProgress({
        version,
        completedProbes,
        totalProbes,
        poolsFound,
        positionsFound,
      });
    }
  };

  // Phase 10C-3 / 13D.2: adaptive per-version budgets — hung v4 must not drop v3/Pons.
  // Phase 13E: start probes in parallel, but for Known-Pons tokens (BEER) settle as
  // soon as v3 returns LOCKED_VERIFIED — do not wait on sibling v2/v4 wall time.
  // Classification unchanged (same adapter gates); coverage remains honestly incomplete.
  const v2P = adaptiveVersionProbe(
    "v2",
    (budget) =>
      discoverV2Liquidity({ tokenAddress: input.tokenAddress }).then(
        async (r) => {
          budget.noteProgress(1 + r.pools.length + r.positions.length);
          await notifyProbe("v2", r.pools.length, r.positions.length);
          return r;
        },
      ),
    () => {
      versionTimedOut.add("v2");
      return v2TimeoutResult();
    },
  );
  const v3P = adaptiveVersionProbe(
    "v3",
    (budget) => {
      // Heartbeat while Pons/factory work — prevents stall terminate under load.
      budget.noteHeartbeat();
      const beat = setInterval(() => budget.noteHeartbeat(), 4_000);
      return discoverV3Liquidity({ tokenAddress: input.tokenAddress })
        .then(async (r) => {
          budget.noteProgress(1 + r.pools.length + r.positions.length);
          await notifyProbe("v3", r.pools.length, r.positions.length);
          return r;
        })
        .finally(() => clearInterval(beat));
    },
    () => {
      versionTimedOut.add("v3");
      return v3TimeoutResult();
    },
  );
  const v4P = adaptiveVersionProbe(
    "v4",
    (budget) => {
      budget.noteHeartbeat();
      const beat = setInterval(() => budget.noteHeartbeat(), 4_000);
      return discoverV4Liquidity(input)
        .then(async (pack) => {
          budget.noteProgress(
            1 +
              pack.version.pools.length +
              pack.version.positions.length,
          );
          await notifyProbe(
            "v4",
            pack.version.pools.length,
            pack.version.positions.length,
          );
          return pack;
        })
        .finally(() => clearInterval(beat));
    },
    () => {
      versionTimedOut.add("v4");
      return v4TimeoutPack(input);
    },
  );

  const v3 = await v3P;
  const ponsLockedEarly =
    isBeerToken(input.tokenAddress) &&
    v3.positions.some(
      (p) =>
        p.lockState === "LOCKED_VERIFIED_ONCHAIN" &&
        (p.lockerName === "PonsLaunchLocker" ||
          p.owner?.toLowerCase() ===
            "0x736d76699c26d0d966744cae304c000d471f7f35"),
    );

  let v2: VersionDiscoveryResult;
  let v4pack: Awaited<typeof v4P>;
  if (ponsLockedEarly) {
    // Sibling probes may still run in background; do not block publish path.
    versionTimedOut.add("v2");
    versionTimedOut.add("v4");
    v2 = v2TimeoutResult();
    v4pack = v4TimeoutPack(input);
    console.info(
      `[lp-multi] known-pons early-settle after v3 Locked (skip await v2/v4) token=${input.tokenAddress}`,
    );
  } else {
    [v2, v4pack] = await Promise.all([v2P, v4P]);
  }

  const v4 = v4pack.version;
  const v4Intel = v4pack.detect.intelligence;
  const versionResults = [v2, v3, v4];
  const uniswapVersions = buildUniswapVersionCoverage(versionResults);

  // Merge ownership slots: real v4 positions + synthetic unknown for material undecoded v2/v3 pools.
  // Dust / inventory_unknown stay in version.pools (discovered) but do not get presentation stubs.
  const positions: V4PositionInfo[] = [
    ...v4Intel.positions,
    ...v2.positions,
    ...v3.positions,
  ];

  const discoveredV2V3 = [...v2.pools, ...v3.pools];
  const hasInventoryUnknown = discoveredV2V3.some(
    (p) => p.materiality === "inventory_unknown",
  );
  const hasMaterialPresentation =
    v2.positions.length > 0 || v3.positions.length > 0;
  const poolDetected =
    v4Intel.poolDetected || hasMaterialPresentation || hasInventoryUnknown;

  // Discovered pool IDs include dust (factory hit ≠ presentation materiality).
  const poolIds = new Set<string>();
  for (const p of positions) {
    if (p.poolId) poolIds.add(p.poolId.toLowerCase());
  }
  for (const pool of [...v2.pools, ...v3.pools, ...v4.pools]) {
    poolIds.add(pool.poolOrPair.toLowerCase());
  }

  const { aggregate, display, scoreLockState, discoveryComplete } =
    computeMultiVersionAggregate({
      positions,
      poolDetected,
      versionCoverage: uniswapVersions,
      v4DiscoveryComplete: v4Intel.poolDetected ? v4Intel.discoveryComplete : true,
    });

  const positionCounts = countPositionLocks(positions);
  // Lock % only from comparable v4 concentrated positions — exclude synthetic v2/v3 unknowns
  const lockDistribution = computeLockDistribution(
    positions.filter((p) => !p.positionNftId.startsWith("v2-") && !p.positionNftId.startsWith("v3-")),
  );

  const versionsLabel =
    uniswapVersions.versionsDetected.length > 0
      ? uniswapVersions.versionsDetected.join(", ").toUpperCase()
      : "none";

  const completenessWarning = !discoveryComplete
    ? uniswapVersions.incompleteReason ??
      v4Intel.completenessWarning ??
      "Liquidity discovery may be incomplete across Uniswap versions. One locked position or one version does not mean all liquidity is locked."
    : aggregate === "MIXED"
      ? null
      : v4Intel.completenessWarning;

  let evidenceLevel: EvidenceLevel = v4Intel.evidenceLevel;
  if (discoveredV2V3.length > 0) {
    if (evidenceLevel === "on_chain_verified") evidenceLevel = "on_chain_partial";
    if (evidenceLevel === "unavailable") evidenceLevel = "on_chain_partial";
  }

  const detailParts = [
    `Uniswap versions with liquidity: ${versionsLabel}.`,
    `Pools/pairs across versions: ${poolIds.size}; ownership slots: ${positions.length}.`,
    v2.detail,
    v3.detail,
    `v4: ${v4Intel.detail}`,
    `Coverage complete=${uniswapVersions.coverageComplete}.`,
  ];
  if (!uniswapVersions.coverageComplete && uniswapVersions.incompleteReason) {
    detailParts.push(uniswapVersions.incompleteReason);
  }
  if (aggregate === "MIXED") {
    detailParts.push(
      "Aggregate MIXED: verified lock(s) coexist with removable/unlocked position(s) — never reported as fully locked.",
    );
  }

  // Class B (hook-native): never promote aggregate to Locked / never claim lock%.
  const hookNative = v4.ownershipClass === "hook_native";
  const finalAggregate = hookNative ? "UNKNOWN_INCOMPLETE" : aggregate;
  const finalDisplay = hookNative
    ? LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE
    : display;
  const finalScoreLock = hookNative ? "UNABLE_TO_DETERMINE" : scoreLockState;
  const finalDiscoveryComplete = hookNative ? false : discoveryComplete;
  const finalLockDistribution = hookNative
    ? {
        ...lockDistribution,
        available: false,
        lockedPct: null,
        unlockedPct: null,
        unknownPct: null,
        lockedUsd: null,
        unlockedUsd: null,
        unknownUsd: null,
        totalPositionUsd: null,
        reason: HOOK_NATIVE_LOCK_DISTRIBUTION_REASON,
      }
    : lockDistribution;

  if (hookNative) {
    uniswapVersions.byVersion.v4.lockAnalysisComplete = false;
    uniswapVersions.coverageComplete = false;
    if (!uniswapVersions.incompleteReason) {
      uniswapVersions.incompleteReason =
        "INCOMPLETE COVERAGE — V4 hook-native (Class B) ownership detected; lock verification unsupported.";
    }
  }

  const intelligence: LpIntelligence = {
    poolDetected,
    poolsDetectedCount: poolIds.size || (v4Intel.poolId ? 1 : 0),
    poolId: v4Intel.poolId,
    poolManagerBalanceRaw: v4Intel.poolManagerBalanceRaw,
    poolManagerBalanceFormatted: v4Intel.poolManagerBalanceFormatted,
    aggregateLockState: finalScoreLock,
    aggregateLockStateDisplay: finalDisplay,
    aggregateState: finalAggregate,
    aggregateStateDisplay: LP_AGGREGATE_STATE_DISPLAY[finalAggregate],
    positionCounts,
    lockDistribution: finalLockDistribution,
    discoveryComplete: finalDiscoveryComplete,
    knownPositionsVerified: v4Intel.knownPositionsVerified === true,
    exhaustiveDiscoveryComplete: v4Intel.exhaustiveDiscoveryComplete === true,
    completenessWarning: hookNative
      ? "V4 Hook Native ownership — lock verification unsupported. Not assumed locked."
      : completenessWarning,
    ownershipRiskNote: hookNative
      ? "V4 ownership class: Hook Native (Airlock/Doppler). Lock verification unsupported — not assumed locked. PoolManager inventory alone is not ownership proof."
      : aggregate === "ALL_LOCKED"
        ? "All material detected positions across searched Uniswap versions verified locked — coverage marked complete."
        : aggregate === "MIXED"
          ? "Mixed: at least one verified lock and at least one removable/unlocked position. One locked NFT or one Uniswap version ≠ locked liquidity."
          : aggregate === "ALL_UNLOCKED"
            ? "All material detected positions appear EOA-controlled — withdrawal risk."
            : aggregate === "UNKNOWN_INCOMPLETE"
              ? "LP enumeration/lock ownership incomplete across Uniswap versions — not assumed fully locked or unlocked. INCOMPLETE COVERAGE may apply."
              : "No detectable Uniswap v2/v3/v4 liquidity in probe set.",
    sizeWarning: v4Intel.sizeWarning && !poolDetected,
    positions,
    evidenceLevel,
    detail: detailParts.join(" "),
    discoverySources: [
      ...(v4Intel.discoverySources ?? []),
      ...(v2.pools.length > 0 ? ["uniswap_v2_factory"] : []),
      ...(v3.pools.length > 0 ? ["uniswap_v3_factory"] : []),
      "multi_version_orchestrator",
    ],
    uniswapVersions,
    ownershipClass: v4.ownershipClass ?? v4Intel.ownershipClass ?? null,
    ownershipClassEvidence: v4Intel.ownershipClassEvidence ?? null,
    v4OwnershipEvidence: v4Intel.v4OwnershipEvidence ?? null,
    hookPositionIndex: v4Intel.hookPositionIndex ?? null,
    hookPositionValuation: v4Intel.hookPositionValuation ?? null,
    hookForeignLpSeparation: v4Intel.hookForeignLpSeparation ?? null,
    hookLockClassification: v4Intel.hookLockClassification ?? null,
  };

  // Persist cross-version discovery inputs (pools/versions). Position IDs already
  // written by v4 detect with replace-on-revalidate; here we only union pools.
  const versionsSeen: LpUniswapVersion[] = [];
  if (v2.pools.length > 0) versionsSeen.push("v2");
  if (v3.pools.length > 0) versionsSeen.push("v3");
  if (v4.pools.length > 0 || v4Intel.poolDetected) versionsSeen.push("v4");
  if (poolIds.size > 0 || versionsSeen.length > 0) {
    try {
      await persistLpDiscoveryCache(SCAN_CHAIN_ID, input.tokenAddress, {
        poolIds,
        versions: versionsSeen,
        // Do not replace positionIds — v4 path owns revalidated ID set.
        replacePositionIds: false,
        positionIds: undefined,
      });
    } catch (err) {
      console.warn("[lp-multi] discovery cache persist failed:", err);
    }
  }

  if (isBeerToken(input.tokenAddress)) {
    const numeric = positions.filter(
      (p) => p.positionNftId && !p.positionNftId.startsWith("v3-pool:"),
    );
    const p0 = numeric[0] ?? positions[0];
    logBeerRemoteTrace(input.tokenAddress, {
      phase: "multi_version_settle",
      positionIndexPath: v3.positionDiscoverySource ?? null,
      tokenId: p0?.positionNftId ?? null,
      ownerOf: p0?.owner ?? null,
      ownerIsPons:
        p0?.owner?.toLowerCase() ===
        "0x736d76699c26d0d966744cae304c000d471f7f35",
      adapterId: p0?.lockerName === "PonsLaunchLocker" ? "pons_launch" : null,
      positionsCount: positions.length,
      liquidityGt0: (() => {
        try {
          return p0?.liquidity != null && BigInt(p0.liquidity) > 0n;
        } catch {
          return null;
        }
      })(),
      positionDiscoveryComplete: v3.positionDiscoveryComplete ?? null,
      lockAnalysisComplete: v3.lockAnalysisComplete,
      lockState: p0?.lockState ?? null,
      lockerName: p0?.lockerName ?? null,
      where:
        versionTimedOut.size > 0
          ? `version_probe_timeout:${[...versionTimedOut].join(",")}`
          : "multi_version_ok",
      versionTimedOut:
        versionTimedOut.size > 0 ? [...versionTimedOut].join(",") : null,
      v3Searched: v3.searched,
      wallMs: Date.now() - multiStarted,
      detail: intelligence.detail.slice(0, 240),
    });
  }

  // Phase 12A.1 — legacyStatus follows ownership-aware aggregate (Class B ≠ LOCKED).
  return { intelligence, legacyStatus: legacyStatus(finalAggregate) };
}
