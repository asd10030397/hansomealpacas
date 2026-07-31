import { getAddress, isAddress } from "viem";
import {
  assertSupportedTokenPresent,
  SCAN_ERROR_MESSAGES,
  ScanRequestError,
} from "@/lib/hansome-score/scan-errors";
import { computeActivity } from "@/lib/hansome-score/activity";
import { hansomeLevelFromActivity } from "@/lib/hansome-score/hansome-level";
import {
  fetchBlockscoutAddress,
  fetchBlockscoutCounters,
  fetchBlockscoutHolders,
  fetchBlockscoutSmartContract,
  fetchBlockscoutToken,
  fetchBlockscoutVerified,
  fetchCreationTimestampDays,
  fetchEarlyTokenTransfers,
  fetchNativeFunder,
  fetchTokenTransfersPaged,
} from "@/lib/hansome-score/blockscout";
import { computeConfidence } from "@/lib/hansome-score/confidence";
import {
  HANSOME_POOL_ID,
  HANSOME_TOKEN,
  SCORE_DISCLAIMERS,
  SCORE_SPEC_VERSION,
  SCAN_CHAIN_ID,
} from "@/lib/hansome-score/constants";
import { analyzeContractRisk } from "@/lib/hansome-score/contract-risk";
import { analyzeCreatorBehaviour } from "@/lib/hansome-score/creator";
import {
  analyzeSupplyBurnIntelligence,
  enrichSupplyBurnWithHistory,
} from "@/lib/hansome-score/supply-burn";
import { fetchGoPlusTokenSecurity } from "@/lib/hansome-score/goplus";
import {
  knownPositionSeeds,
  knownWalletLabel,
  shouldExcludeFromConcentration,
  transparencyHintAddresses,
  transparencyLockHint,
} from "@/lib/hansome-score/labels";
import { detectMultiVersionLpIntelligence } from "@/lib/hansome-score/lp/multi";
import {
  isHookNativeOwnership,
  retainHookNativeLockDistribution,
} from "@/lib/hansome-score/lp/hook-native-lock-dist";
import {
  attachPositionUsdValues,
  computeEconomicLockDistribution,
} from "@/lib/hansome-score/lp/position-value";
import { buildRelationshipSignals } from "@/lib/hansome-score/relationship";
import {
  formatTokenAmount,
  readBytecode,
  readTokenViaRpc,
} from "@/lib/hansome-score/rpc";
import { getTokenContextMetadata } from "@/lib/hansome-taxonomy";
import { computeOverallTokenScore } from "@/lib/hansome-score/overall";
import {
  computeConcentration,
  computeStructuralScore,
} from "@/lib/hansome-score/score";
import { fetchEthUsd } from "@/lib/market/eth-usd";
import { withRpcTiming } from "@/lib/hansome-score/critical-path-profiler";
import type {
  DataSourceEntry,
  LabeledHolder,
  ScanResponse,
} from "@/lib/hansome-score/types";

/** Exported for scan-cache Activity overlay (no structural rescan). */
export async function fetchOptionalGeckoActivity(
  tokenAddress: string,
  opts?: { signal?: AbortSignal },
): Promise<{
  volume24hUsd: number | null;
  transactions24h: number | null;
  liquidityUsd: number | null;
  tokenPriceUsd: number | null;
  quotePriceUsd: number | null;
  source: string | null;
}> {
  const empty = {
    volume24hUsd: null as number | null,
    transactions24h: null as number | null,
    liquidityUsd: null as number | null,
    tokenPriceUsd: null as number | null,
    quotePriceUsd: null as number | null,
    source: null as string | null,
  };
  try {
    const isHansome =
      getAddress(tokenAddress).toLowerCase() === HANSOME_TOKEN.toLowerCase();
    const url = isHansome
      ? `https://api.geckoterminal.com/api/v2/networks/robinhood/pools/${HANSOME_POOL_ID}`
      : `https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/${tokenAddress}/pools`;

    type GeckoJson = {
      data?:
        | {
            attributes?: {
              volume_usd?: { h24?: string };
              reserve_in_usd?: string;
              base_token_price_usd?: string;
              quote_token_price_usd?: string;
              transactions?: { h24?: { buys?: number; sells?: number } };
            };
          }
        | Array<{
            attributes?: {
              volume_usd?: { h24?: string };
              reserve_in_usd?: string;
              base_token_price_usd?: string;
              quote_token_price_usd?: string;
              transactions?: { h24?: { buys?: number; sells?: number } };
            };
          }>;
    };

    const json = await withRpcTiming(
      "gecko",
      isHansome ? "gecko_pool" : "gecko_token_pools",
      async () => {
        const res = await fetch(url, {
          headers: { accept: "application/json" },
          cache: "no-store",
          signal: opts?.signal ?? AbortSignal.timeout(12_000),
        });
        if (!res.ok) return null;
        return (await res.json()) as GeckoJson;
      },
    );
    if (!json) return empty;

    const pool = Array.isArray(json.data) ? json.data[0] : json.data;
    if (!pool?.attributes) return empty;

    const vol = Number(pool.attributes.volume_usd?.h24);
    const liq = Number(pool.attributes.reserve_in_usd);
    const basePx = Number(pool.attributes.base_token_price_usd);
    const quotePx = Number(pool.attributes.quote_token_price_usd);
    const buys = pool.attributes.transactions?.h24?.buys ?? 0;
    const sells = pool.attributes.transactions?.h24?.sells ?? 0;
    const txs = buys + sells;
    // Prefer the non-ETH-like side as the scanned token price when one side looks like ETH.
    const ethish = (px: number) => Number.isFinite(px) && px > 500 && px < 20_000;
    let tokenPriceUsd: number | null = Number.isFinite(basePx) ? basePx : null;
    let quotePriceUsd: number | null = Number.isFinite(quotePx) ? quotePx : null;
    if (ethish(basePx) && Number.isFinite(quotePx) && !ethish(quotePx)) {
      tokenPriceUsd = quotePx;
      quotePriceUsd = basePx;
    } else if (ethish(quotePx) && Number.isFinite(basePx) && !ethish(basePx)) {
      tokenPriceUsd = basePx;
      quotePriceUsd = quotePx;
    }

    return {
      volume24hUsd: Number.isFinite(vol) ? vol : null,
      transactions24h: Number.isFinite(txs) ? txs : null,
      liquidityUsd: Number.isFinite(liq) ? liq : null,
      tokenPriceUsd,
      quotePriceUsd,
      source: "geckoterminal",
    };
  } catch {
    return empty;
  }
}

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

export function assertValidTokenAddress(address: string): string {
  if (!isAddress(address)) {
    throw new ScanRequestError(
      "invalid_address",
      SCAN_ERROR_MESSAGES.invalid_address,
    );
  }
  return getAddress(address);
}

export type ScanTokenOptions = {
  /** Cap creator-transfer pagination (default 40). Batch validation may lower this. */
  maxTransferPages?: number;
  /** Top non-excluded holders for relationship funding graph (default 12). */
  relationshipSampleSize?: number;
};

export async function scanToken(
  rawAddress: string,
  options?: ScanTokenOptions,
): Promise<ScanResponse> {
  const address = assertValidTokenAddress(rawAddress);
  const isHansome = address.toLowerCase() === HANSOME_TOKEN.toLowerCase();
  const maxTransferPages = options?.maxTransferPages ?? 40;
  const relationshipSampleSize = options?.relationshipSampleSize ?? 12;

  const [bsToken, bsCounters, bsHolders, bsAddr, verified, gecko, smart, goplus, ethUsd] =
    await Promise.all([
      fetchBlockscoutToken(address).catch(() => null),
      fetchBlockscoutCounters(address),
      fetchBlockscoutHolders(address).catch(() => [] as { address: string; value: string }[]),
      fetchBlockscoutAddress(address).catch(() => null),
      fetchBlockscoutVerified(address),
      fetchOptionalGeckoActivity(address),
      fetchBlockscoutSmartContract(address),
      fetchGoPlusTokenSecurity(address),
      fetchEthUsd().catch(() => null as number | null),
    ]);

  const deployer = bsAddr?.creator ?? null;
  const creationTxHash = bsAddr?.creationTxHash ?? null;
  const [rpc, bytecode] = await Promise.all([
    readTokenViaRpc(address, deployer),
    readBytecode(address),
  ]);
  assertSupportedTokenPresent({ bytecode, rpc, bsToken });
  const tokenAgeDays = await fetchCreationTimestampDays(creationTxHash);

  const decimals = rpc.decimals ?? (bsToken?.decimals != null ? Number(bsToken.decimals) : null);
  const totalSupply =
    rpc.totalSupply ??
    (bsToken?.totalSupply != null ? BigInt(bsToken.totalSupply) : null);

  const topHolders = buildHolders(address, bsHolders, totalSupply, decimals);
  const concentration = computeConcentration(topHolders);

  // Relationship graph (bounded — top holders only)
  const sampleHolders = topHolders
    .filter((h) => !h.excludedFromConcentration)
    .slice(0, relationshipSampleSize);

  const [funders, earlyTransfers] = await Promise.all([
    Promise.all(
      sampleHolders.map(async (h) => {
        const f = await fetchNativeFunder(h.address);
        if (!f) return null;
        return { from: f.from, to: h.address, blockNumber: f.blockNumber };
      }),
    ),
    fetchEarlyTokenTransfers(address),
  ]);

  const fundingEdges = funders.filter(
    (x): x is { from: string; to: string; blockNumber: number | null } => x != null,
  );

  // Early buys: group by earliest blocks in transfer page
  const earlyBuys = earlyTransfers.map((t) => ({
    buyer: t.to,
    blockNumber: t.blockNumber,
  }));

  const relationship = buildRelationshipSignals({
    holders: topHolders,
    deployer,
    fundingEdges,
    earlyBuys,
  });

  // Supply & Burn Intelligence (P0+P1) — P2/P3 attached after shared transfer index
  const supplyBurnBase = await analyzeSupplyBurnIntelligence({
    tokenAddress: address,
    totalSupply,
    decimals,
    verified: smart.isVerified || verified,
    abi: (smart.abi as { type?: string; name?: string }[] | null) ?? null,
    sourceCode: smart.sourceCode,
  });

  const contractRisk = analyzeContractRisk({
    verified: smart.isVerified || verified,
    abi: (smart.abi as { type?: string; name?: string }[] | null) ?? null,
    sourceCode: smart.sourceCode,
    goplus,
    privilegedBurn: supplyBurnBase.privilegedBurn,
  });

  // Creator sell/transfer index (Week 2A) — clears provisional −8 when complete
  // Same pages feed P2/P3 burn history (no second Blockscout pagination).
  const transferIndex = await fetchTokenTransfersPaged(address, {
    maxPages: maxTransferPages,
  });
  const creatorBehaviour = analyzeCreatorBehaviour({
    deployer,
    totalSupply,
    transfers: transferIndex.transfers,
    paginationComplete: transferIndex.paginationComplete,
    fetchFailed: transferIndex.fetchFailed,
    pagesFetched: transferIndex.pagesFetched,
  });
  const supplyBurn = await enrichSupplyBurnWithHistory({
    supplyBurn: supplyBurnBase,
    tokenAddress: address,
    transfers: transferIndex.transfers,
    pagesFetched: transferIndex.pagesFetched,
    paginationComplete: transferIndex.paginationComplete,
    fetchFailed: transferIndex.fetchFailed,
    decimals,
  });

  // Multi-version LP intelligence — v2/v3 probes + v4 Titan/PM path
  const hintAddresses = [
    ...transparencyHintAddresses(address),
    ...(deployer ? [deployer] : []),
    // Top non-pool holders may custody Position NFTs (bounded)
    ...topHolders
      .filter((h) => !h.excludedFromConcentration)
      .slice(0, 8)
      .map((h) => h.address),
  ];
  const hint = transparencyLockHint();
  const candidatePositionIds = new Set<bigint>(knownPositionSeeds(address));
  if (isHansome && hint.positionNftId && /^\d+$/.test(hint.positionNftId)) {
    // Seed only — classification still requires ownerOf + locker registry (not a silent Score grant)
    candidatePositionIds.add(BigInt(hint.positionNftId));
  }
  const lp = await detectMultiVersionLpIntelligence({
    tokenAddress: address,
    poolManagerBalance: rpc.poolManagerBalance,
    decimals,
    hintAddresses,
    candidatePositionIds: [...candidatePositionIds],
    knownPoolId: isHansome ? HANSOME_POOL_ID : null,
    // Completeness asserted only when required HANSOME seeds resolve on-chain
    discoveryComplete: undefined,
  });

  // Corroborate lock tx hash from transparency when on-chain position matches (label only)
  if (isHansome && hint.lockTxUrl && hint.positionNftId) {
    for (const p of lp.intelligence.positions) {
      if (p.positionNftId === hint.positionNftId && !p.lockTxHash) {
        p.lockTxHash = hint.lockTxUrl.split("/tx/")[1] ?? null;
      }
    }
  }

  // Economic lock distribution from token amounts × USD (never raw L).
  const tokenDecimals = decimals ?? 18;
  const quoteAsEth =
    gecko.quotePriceUsd != null &&
    ethUsd != null &&
    Math.abs(gecko.quotePriceUsd - ethUsd) / ethUsd < 0.15;
  const pricedPositions = attachPositionUsdValues(lp.intelligence.positions, {
    tokenAddress: address,
    tokenDecimals,
    tokenPriceUsd: gecko.tokenPriceUsd,
    ethUsd: quoteAsEth ? gecko.quotePriceUsd : ethUsd,
    usdgUsd: 1,
  });
  lp.intelligence.positions = pricedPositions;
  // Phase 12A.1 — Class B: never rehydrate Titan lock% after multi clears it.
  if (isHookNativeOwnership(lp.intelligence.ownershipClass)) {
    lp.intelligence.lockDistribution = retainHookNativeLockDistribution(
      lp.intelligence.lockDistribution,
    );
  } else {
    lp.intelligence.lockDistribution = computeEconomicLockDistribution({
      positions: pricedPositions,
      poolLiquidityUsd: gecko.liquidityUsd,
    });
  }

  const score = computeStructuralScore({
    totalSupply,
    topHolders,
    deployer,
    deployerBalance: rpc.deployerBalance,
    contractVerified: smart.isVerified || verified,
    lpLockState: lp.intelligence.aggregateLockState,
    poolManagerBalance: rpc.poolManagerBalance,
    contractRisk,
    relationship,
    creatorBehaviourAvailable: creatorBehaviour.available,
    creatorDumpDetected: creatorBehaviour.dumpDetected,
    creatorTransferThenSellDetected: creatorBehaviour.transferThenSellDetected,
  });

  // Thin liquidity size warning (not Score)
  if (
    (rpc.poolManagerBalance ?? 0n) > 0n &&
    totalSupply &&
    totalSupply > 0n
  ) {
    const poolPct =
      (Number(rpc.poolManagerBalance) / Number(totalSupply)) * 100;
    if (poolPct < 1) {
      lp.intelligence.sizeWarning = true;
      score.flags.push({
        severity: "warning",
        code: "thin_liquidity_size",
        message:
          "Thin liquidity warning (size/slippage) — size alone does not mean unsafe and does not heavily penalize Score.",
      });
    }
  }

  if (
    (bsCounters.holdersCount ?? bsToken?.holdersCount ?? 0) > 0 &&
    (bsCounters.holdersCount ?? bsToken?.holdersCount ?? 0) < 50
  ) {
    score.flags.push({
      severity: "info",
      code: "low_holder_count",
      message:
        "Low holder count is informational / age-aware context — raw count does not directly penalize Score.",
    });
  }

  // Propagate contract findings as flags
  for (const f of contractRisk.findings) {
    if (f.code === "contract_clean" || f.code === "contract_risk_incomplete") continue;
    if (score.flags.some((x) => x.code === f.code)) continue;
    score.flags.push({
      severity: f.severity,
      code: f.code,
      message: `${f.message} (source: ${f.source})`,
    });
  }

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
    poolManagerBalanceFormatted: formatTokenAmount(rpc.poolManagerBalance, decimals),
    poolId: lp.intelligence.poolId,
    lpLockStatus: lp.legacyStatus,
    lpLockDetail: lp.intelligence.detail,
    lpIntelligence: lp.intelligence,
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
      sampleSize: sampleHolders.length,
      fundersResolved: fundingEdges.length,
      earlyBuysCount: earlyBuys.length,
    },
    // Engine has source/ABI honeypot heuristics only — no sell/swap simulation yet
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
    sizeWarning: lp.intelligence.sizeWarning,
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
      usedFor:
        "name, symbol, decimals, totalSupply, allowlisted burn-address balances, Uniswap v2/v3 factory probes, v4 PoolManager balances, PositionManager ownerOf/liquidity, Titan lock data",
      affectsScore: true,
    },
    {
      id: "supply_burn",
      label: "Supply & Burn Intelligence",
      usedFor:
        "Known dead-address inventory (display) + burn mechanism flags; privileged burn feeds Contract Risk only — voluntary burn does not boost Score",
      affectsScore: true,
    },
    {
      id: "blockscout",
      label: "Blockscout",
      usedFor:
        "deployer, holders sample, counters, verification, ABI/source, funding/early-transfer graph, creation age, creator transfer index, PositionManager NFT inventory/transfers",
      affectsScore: true,
    },
    {
      id: "creator_index",
      label: "Creator behaviour index",
      usedFor:
        "Deployer sell/transfer history vs supply — clears provisional creator deduction when fully indexed",
      affectsScore: true,
    },
    {
      id: "locker_registry",
      label: "v4 locker registry (Titan)",
      usedFor:
        "Generic multi-position NFT lock classification — Titan + hint NFT inventory + recent PM transfers",
      affectsScore: true,
    },
    {
      id: "transparency",
      label: "content/transparency.ts",
      usedFor: isHansome
        ? "Official wallet labels + lock tx corroboration (not silent Score grant)"
        : "Not applied (non-HANSOME token)",
      affectsScore: false,
    },
    {
      id: "geckoterminal",
      label: "GeckoTerminal",
      usedFor:
        "Activity volume/txs (Activity axis) + labeled reserve_in_usd for Overall liquidity-depth component — never silent Structural override",
      affectsScore: false,
    },
    {
      id: "goplus",
      label: "GoPlus (labeled supplement)",
      usedFor: "Contract flag cross-check — never silent Structural override",
      affectsScore: false,
    },
    {
      id: "taxonomy_metadata",
      label: "Category + Meme Story metadata",
      usedFor:
        "Context only (tags / What’s the Meme?) — never Score, Activity, Trending, or Confidence",
      affectsScore: false,
    },
  ];

  // Presentation only — must not feed Structural / Overall / Confidence / deductions.
  const hansomeLevel = hansomeLevelFromActivity(activity.level);
  // Week 2B: attach taxonomy + meme story; does not change any score axis.
  const context = getTokenContextMetadata(address, SCAN_CHAIN_ID);

  const nowIso = new Date().toISOString();
  return {
    version: SCORE_SPEC_VERSION,
    scannedAt: nowIso,
    scoreComputedAt: nowIso,
    activityUpdatedAt: nowIso,
    overview,
    overall,
    score,
    structural: score,
    activity,
    hansomeLevel,
    confidence,
    // Presentation wire-up of already-fetched labeled USD — does not change Score/detect.
    liquidityUsd: gecko.liquidityUsd,
    context,
    sources,
    disclaimers: [...SCORE_DISCLAIMERS],
    uiWording: {
      overallSubtitle:
        "Broader token assessment — not a safety guarantee or price prediction.",
      scoreSubtitle: "Structural risk & transparency — not popularity.",
      structuralSubtitle: "Structural risk & transparency — not popularity.",
      confidenceNote:
        "How much reliable data we have to analyze this token. This is not a safety rating or investment recommendation.",
    },
  };
}
