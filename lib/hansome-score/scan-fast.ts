/**
 * Fast Scan — cheapest reliable data for first usable screen (target 5–15s).
 * Deep LP / creator / relationships / P2–P3 burn history stay in scanToken (deep).
 */
import { getAddress } from "viem";
import { computeActivity } from "@/lib/hansome-score/activity";
import {
  fetchBlockscoutAddress,
  fetchBlockscoutCounters,
  fetchBlockscoutHolders,
  fetchBlockscoutToken,
  fetchCreationTimestampDays,
} from "@/lib/hansome-score/blockscout";
import { resolveContractStaticAfterBytecode } from "@/lib/hansome-score/contract-cache";
import { computeConfidence } from "@/lib/hansome-score/confidence";
import {
  LP_AGGREGATE_STATE_DISPLAY,
  SCORE_DISCLAIMERS,
  SCORE_SPEC_VERSION,
  SCAN_CHAIN_ID,
} from "@/lib/hansome-score/constants";
import { analyzeContractRisk } from "@/lib/hansome-score/contract-risk";
import { hansomeLevelFromActivity } from "@/lib/hansome-score/hansome-level";
import { emptyUniswapVersionCoverage } from "@/lib/hansome-score/lp/coverage";
import { computeOverallTokenScore } from "@/lib/hansome-score/overall";
import {
  formatTokenAmount,
  readBytecode,
  readTokenViaRpc,
} from "@/lib/hansome-score/rpc";
import {
  computeConcentration,
  computeStructuralScore,
} from "@/lib/hansome-score/score";
import { assertSupportedTokenPresent } from "@/lib/hansome-score/scan-errors";
import { analyzeSupplyBurnIntelligence } from "@/lib/hansome-score/supply-burn";
import {
  emptyBurnActivityHistory,
  emptySupplyReductionHistory,
} from "@/lib/hansome-score/supply-burn/burn-history";
import { getTokenContextMetadata } from "@/lib/hansome-taxonomy";
import { fetchOptionalGeckoActivity, assertValidTokenAddress } from "@/lib/hansome-score/scan";
import {
  knownWalletLabel,
  shouldExcludeFromConcentration,
} from "@/lib/hansome-score/labels";
import type {
  AnalysisStages,
  CreatorBehaviourResult,
  DataSourceEntry,
  LabeledHolder,
  LpIntelligence,
  ScanResponse,
  WalletRelationshipSignals,
} from "@/lib/hansome-score/types";

export const FAST_SCAN_STAGES_READY: AnalysisStages = {
  contract: "done",
  holders: "done",
  market: "done",
  burn: "partial", // P0/P1 done; P2/P3 pending deep
  liquidity: "analyzing",
  creator: "analyzing",
  relationships: "analyzing",
  score: "partial",
};

export const DEEP_SCAN_STAGES_COMPLETE: AnalysisStages = {
  contract: "done",
  holders: "done",
  market: "done",
  burn: "done",
  liquidity: "done",
  creator: "done",
  relationships: "done",
  score: "done",
};

function buildHolders(
  tokenAddress: string,
  rows: { address: string; value: string }[],
  totalSupply: bigint | null,
  decimals: number | null,
): LabeledHolder[] {
  return rows.map((row) => {
    const balanceRaw = row.value;
    let balance = 0n;
    try {
      balance = BigInt(balanceRaw);
    } catch {
      balance = 0n;
    }
    const percentOfSupply =
      totalSupply && totalSupply > 0n
        ? (Number(balance) / Number(totalSupply)) * 100
        : 0;
    const label = knownWalletLabel(row.address, tokenAddress);
    return {
      address: getAddress(row.address),
      balanceRaw,
      balanceFormatted: formatTokenAmount(balance, decimals) ?? balanceRaw,
      percentOfSupply,
      label,
      excludedFromConcentration: shouldExcludeFromConcentration(row.address, label),
    };
  });
}

function pendingLpIntelligence(
  poolManagerBalance: bigint | null,
  decimals: number | null,
): LpIntelligence {
  const poolDetected = (poolManagerBalance ?? 0n) > 0n;
  return {
    poolDetected,
    poolsDetectedCount: poolDetected ? 1 : 0,
    poolId: null,
    poolManagerBalanceRaw: poolManagerBalance?.toString() ?? null,
    poolManagerBalanceFormatted: formatTokenAmount(poolManagerBalance, decimals),
    aggregateLockState: poolDetected ? "UNABLE_TO_DETERMINE" : "NONE",
    aggregateLockStateDisplay: poolDetected
      ? LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE
      : LP_AGGREGATE_STATE_DISPLAY.NONE,
    aggregateState: poolDetected ? "UNKNOWN_INCOMPLETE" : "NONE",
    aggregateStateDisplay: poolDetected
      ? LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE
      : LP_AGGREGATE_STATE_DISPLAY.NONE,
    positionCounts: {
      detected: 0,
      material: 0,
      locked: 0,
      unlocked: 0,
      unknown: 0,
    },
    lockDistribution: {
      available: false,
      reason: "Deep LP analysis pending",
      method: null,
      lockedPct: null,
      unlockedPct: null,
      unknownPct: null,
      lockedUsd: null,
      unlockedUsd: null,
      unknownUsd: null,
      totalPositionUsd: null,
      poolLiquidityUsd: null,
      reconciledWithPool: false,
    },
    positions: [],
    discoveryComplete: false,
    knownPositionsVerified: false,
    exhaustiveDiscoveryComplete: false,
    completenessWarning:
      "Deep analysis in progress — multi-version LP discovery not finished.",
    ownershipRiskNote:
      "Lock ownership unknown until deep Uniswap v2/v3/v4 analysis completes.",
    sizeWarning: false,
    evidenceLevel: "unavailable",
    detail: "Deep analysis in progress — Uniswap v2/v3/v4 lock discovery pending.",
    uniswapVersions: emptyUniswapVersionCoverage(),
  };
}

function pendingCreator(): CreatorBehaviourResult {
  return {
    status: "incomplete",
    available: false,
    dumpDetected: false,
    transferThenSellDetected: false,
    creatorSellPctOfSupply: 0,
    outboundTransferCount: 0,
    sellTransferCount: 0,
    transferThenSellRecipientCount: 0,
    pagesFetched: 0,
    transfersIndexed: 0,
    paginationComplete: false,
    detail:
      "Deep analysis in progress — creator transfer history not indexed yet (provisional Score path).",
    evidence: [],
  };
}

function emptyRelationships(): WalletRelationshipSignals {
  return {
    equalBalanceClusterSize: 0,
    equalBalanceClusterAddresses: [],
    deployerInEqualBalanceCluster: false,
    sharedFundingCount: 0,
    sharedFundingAddresses: [],
    sharedFundingFunder: null,
    deployerFundedCount: 0,
    deployerFundedAddresses: [],
    sameBlockEarlyBuyCount: 0,
    sameBlockEarlyBuyAddresses: [],
  };
}

/**
 * Fast Scan: metadata, verification, holders sample, market, P0/P1 burn, provisional scores.
 * Does not paginate creator history or run deep LP discovery.
 */
export async function scanTokenFast(rawAddress: string): Promise<ScanResponse> {
  const address = assertValidTokenAddress(rawAddress);

  // Parallel wave: explorer + market + RPC. Contract ABI/source uses Phase 3 cache
  // after bytecode is known (hash-keyed); cache miss still fetches Blockscout.
  // GoPlus deferred to deep — labeled supplement only, not required for first screen.
  const [bsToken, bsCounters, bsHolders, bsAddr, gecko, rpc, bytecode] =
    await Promise.all([
      fetchBlockscoutToken(address).catch(() => null),
      fetchBlockscoutCounters(address),
      fetchBlockscoutHolders(address).catch(
        () => [] as { address: string; value: string }[],
      ),
      fetchBlockscoutAddress(address).catch(() => null),
      fetchOptionalGeckoActivity(address),
      readTokenViaRpc(address, null),
      readBytecode(address),
    ]);

  assertSupportedTokenPresent({ bytecode, rpc, bsToken });

  const contractStatic = await resolveContractStaticAfterBytecode({
    tokenAddress: address,
    bytecode,
  });
  const smart = contractStatic.smart ?? {
    isVerified: false,
    abi: null,
    sourceCode: null,
    fullSourceCode: null,
    name: null,
  };
  const verified = contractStatic.verified === true;

  const deployer = bsAddr?.creator ?? null;
  const creationTxHash = bsAddr?.creationTxHash ?? null;

  const decimals =
    rpc.decimals ??
    (bsToken?.decimals != null ? Number(bsToken.decimals) : null);
  const totalSupply =
    rpc.totalSupply ??
    (bsToken?.totalSupply != null ? BigInt(bsToken.totalSupply) : null);

  const topHolders = buildHolders(address, bsHolders, totalSupply, decimals);
  const concentration = computeConcentration(topHolders);

  const [tokenAgeDays, supplyBurnBase] = await Promise.all([
    fetchCreationTimestampDays(creationTxHash),
    analyzeSupplyBurnIntelligence({
      tokenAddress: address,
      totalSupply,
      decimals,
      verified: smart.isVerified || verified,
      abi: (smart.abi as { type?: string; name?: string }[] | null) ?? null,
      sourceCode: smart.sourceCode,
    }),
  ]);
  // Fast path: keep P0/P1; leave P2/P3 Incomplete until deep
  const supplyBurn = {
    ...supplyBurnBase,
    burnActivity: emptyBurnActivityHistory(
      "Deep analysis in progress — burn activity history (P2) pending.",
    ),
    supplyReduction: emptySupplyReductionHistory(
      "Deep analysis in progress — supply reduction history (P3) pending.",
    ),
    supplyReductionVerified: "unknown" as const,
  };

  const contractRisk = analyzeContractRisk({
    verified: smart.isVerified || verified,
    abi: (smart.abi as { type?: string; name?: string }[] | null) ?? null,
    sourceCode: smart.sourceCode,
    goplus: null,
    privilegedBurn: supplyBurn.privilegedBurn,
  });

  const lpIntelligence = pendingLpIntelligence(rpc.poolManagerBalance, decimals);
  const creatorBehaviour = pendingCreator();
  const relationship = emptyRelationships();

  const score = computeStructuralScore({
    totalSupply,
    topHolders,
    deployer,
    deployerBalance: rpc.deployerBalance,
    contractVerified: smart.isVerified || verified,
    lpLockState: lpIntelligence.aggregateLockState,
    poolManagerBalance: rpc.poolManagerBalance,
    contractRisk,
    relationship,
    creatorBehaviourAvailable: false,
    creatorDumpDetected: false,
    creatorTransferThenSellDetected: false,
  });
  score.flags.push({
    severity: "info",
    code: "score_provisional_fast_scan",
    message:
      "Provisional Structural Score — deep liquidity, creator history, and relationships still analyzing.",
  });

  const activity = computeActivity({
    volume24hUsd: gecko.volume24hUsd,
    transactions24h: gecko.transactions24h,
    transfersCount: bsCounters.transfersCount,
    volumeSource: gecko.source,
  });

  const overview = {
    address,
    chainId: SCAN_CHAIN_ID,
    name: rpc.name ?? bsToken?.name ?? null,
    symbol: rpc.symbol ?? bsToken?.symbol ?? null,
    decimals,
    totalSupplyRaw: totalSupply?.toString() ?? null,
    totalSupplyFormatted: formatTokenAmount(totalSupply, decimals),
    holdersCount: bsCounters.holdersCount ?? bsToken?.holdersCount ?? null,
    transfersCount: bsCounters.transfersCount,
    deployer,
    creationTxHash,
    contractVerified: smart.isVerified || verified,
    poolManagerBalanceRaw: rpc.poolManagerBalance?.toString() ?? null,
    poolManagerBalanceFormatted: formatTokenAmount(
      rpc.poolManagerBalance,
      decimals,
    ),
    poolId: null,
    lpLockStatus: "unknown" as const,
    lpLockDetail: lpIntelligence.detail,
    lpIntelligence,
    contractRisk,
    supplyBurn,
    creatorBehaviour,
    concentration,
    relationship,
    tokenAgeDays,
    topHolders: topHolders.slice(0, 20),
  };

  const confidence = computeConfidence({
    overview,
    hasActivityVolume: gecko.volume24hUsd != null,
    walletGraph: {
      sampled: true,
      sampleSize: 0,
      fundersResolved: 0,
      earlyBuysCount: 0,
    },
    honeypotSwapSimulated: false,
  });

  const poolInventoryPctOfSupply =
    totalSupply && totalSupply > 0n && rpc.poolManagerBalance != null
      ? (Number(rpc.poolManagerBalance) / Number(totalSupply)) * 100
      : null;

  const overall = computeOverallTokenScore({
    structuralScore: score.score,
    liquidityUsd: gecko.liquidityUsd,
    poolInventoryPctOfSupply,
    sizeWarning: false,
    holdersCount: overview.holdersCount,
    top10AdjustedPct: concentration.top10AdjustedPct,
    volume24hUsd: gecko.volume24hUsd,
    transactions24h: gecko.transactions24h,
    tokenAgeDays,
    dataConfidencePercent: confidence.percent,
  });

  const sources: DataSourceEntry[] = [
    {
      id: "rpc",
      label: "Robinhood RPC",
      usedFor: "metadata, totalSupply, PoolManager balance, dead-address inventory",
      affectsScore: true,
    },
    {
      id: "blockscout",
      label: "Blockscout",
      usedFor: "holders sample, counters, verification, ABI/source (fast path)",
      affectsScore: true,
    },
    {
      id: "geckoterminal",
      label: "GeckoTerminal",
      usedFor: "Activity / price / labeled liquidity (fast path)",
      affectsScore: false,
    },
    {
      id: "fast_scan",
      label: "Fast Scan",
      usedFor:
        "First usable screen — deep LP, creator history, relationships, P2/P3 burn pending",
      affectsScore: true,
    },
  ];

  const nowIso = new Date().toISOString();
  return {
    version: SCORE_SPEC_VERSION,
    scannedAt: nowIso,
    scoreComputedAt: nowIso,
    activityUpdatedAt: nowIso,
    analysisPhase: "fast",
    analysisStatus: "deep_running",
    deepStartedAt: nowIso,
    scoreProvisional: true,
    analysisStages: { ...FAST_SCAN_STAGES_READY },
    overview,
    overall,
    score,
    structural: score,
    activity,
    hansomeLevel: hansomeLevelFromActivity(activity.level),
    confidence,
    liquidityUsd: gecko.liquidityUsd,
    context: getTokenContextMetadata(address, SCAN_CHAIN_ID),
    sources,
    disclaimers: [
      ...SCORE_DISCLAIMERS,
      "Fast Scan result — Overall and Structural scores are provisional until deep analysis completes.",
    ],
    uiWording: {
      overallSubtitle:
        "Provisional — deep liquidity & creator checks still running. Not a safety guarantee.",
      scoreSubtitle: "Provisional structural view — deep analysis in progress.",
      structuralSubtitle: "Provisional structural view — deep analysis in progress.",
      confidenceNote:
        "How much reliable data we have so far. Deep analysis may raise coverage when complete.",
    },
  };
}

/** Mark a completed deep scan response with analysis metadata. */
export function markScanComplete(response: ScanResponse): ScanResponse {
  return {
    ...response,
    analysisPhase: "complete",
    analysisStatus: "complete",
    scoreProvisional: false,
    analysisStages: { ...DEEP_SCAN_STAGES_COMPLETE },
    deepStartedAt: undefined,
  };
}

export function isScanComplete(response: ScanResponse): boolean {
  if (response.analysisStatus === "complete") return true;
  if (response.analysisPhase === "complete") return true;
  // Legacy snapshots without phase fields are treated as complete
  if (response.analysisPhase == null && response.analysisStatus == null) {
    return true;
  }
  return false;
}

/**
 * True while a Deep job is actively expected to mutate the snapshot.
 * Settled `partial`/`failed` is false here — use `isDeepRetryable` /
 * `needsDeepWork` from scan-progress when auto-retry may still re-arm.
 */
export function isDeepInProgress(response: ScanResponse): boolean {
  if (isScanComplete(response)) return false;
  if (response.analysisStatus === "partial" || response.analysisStatus === "failed") {
    return false;
  }
  return (
    response.analysisPhase === "fast" ||
    response.analysisStatus === "fast_ready" ||
    response.analysisStatus === "deep_running"
  );
}

export function isFastOrRunning(response: ScanResponse): boolean {
  return isDeepInProgress(response);
}
