import {
  DATA_CONFIDENCE_BAND_THRESHOLDS,
  DATA_CONFIDENCE_WEIGHTS,
} from "@/lib/hansome-score/constants";
import type {
  ConfidenceBand,
  ConfidenceDimension,
  ConfidenceDimensionId,
  ConfidenceResult,
  TokenOverview,
} from "@/lib/hansome-score/types";

export type WalletGraphCoverageInput = {
  /** True when production scan bounds the graph to a top-holder sample. */
  sampled: boolean;
  sampleSize: number;
  fundersResolved: number;
  earlyBuysCount: number;
};

export type ConfidenceInput = {
  overview: TokenOverview;
  hasActivityVolume: boolean;
  walletGraph: WalletGraphCoverageInput;
  /**
   * Whether a sell/swap simulation was run for honeypot detection.
   * Engine currently has no swap simulation — pass false in production.
   */
  honeypotSwapSimulated?: boolean;
};

const DIMENSION_ORDER: ConfidenceDimensionId[] = [
  "contract",
  "liquidity",
  "holders",
  "wallet",
  "creator",
];

const DIMENSION_LABELS: Record<ConfidenceDimensionId, string> = {
  contract: "Contract",
  liquidity: "Liquidity",
  holders: "Holders",
  wallet: "Wallet Analysis",
  creator: "Creator History",
};

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= DATA_CONFIDENCE_BAND_THRESHOLDS.high) return "High";
  if (score >= DATA_CONFIDENCE_BAND_THRESHOLDS.medium) return "Medium";
  return "Low";
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function dim(
  id: ConfidenceDimensionId,
  score: number,
  opts: {
    evidence: string[];
    notes?: string[];
    incomplete?: boolean;
  },
): ConfidenceDimension {
  const s = clampScore(score);
  return {
    id,
    label: DIMENSION_LABELS[id],
    score: s,
    band: confidenceBand(s),
    weight: DATA_CONFIDENCE_WEIGHTS[id],
    evidence: opts.evidence,
    notes: opts.notes ?? [],
    incomplete: opts.incomplete ?? false,
  };
}

/** Contract analysis coverage — verified ABI/source + known simulation gaps. */
export function scoreContractCoverage(
  overview: TokenOverview,
  honeypotSwapSimulated: boolean,
): ConfidenceDimension {
  const cr = overview.contractRisk;
  const evidence: string[] = [];
  const notes: string[] = [];
  let score = 100;
  let incomplete = false;

  if (!overview.totalSupplyRaw || overview.decimals == null || !overview.symbol) {
    score -= 20;
    incomplete = true;
    evidence.push("missing_token_meta");
    notes.push("Missing totalSupply, decimals, or symbol.");
  } else {
    evidence.push("token_meta_present");
  }

  if (overview.contractVerified === false) {
    score -= 18;
    incomplete = true;
    evidence.push("contract_unverified");
    notes.push("Contract unverified — ABI/source coverage limited.");
  } else if (overview.contractVerified === true) {
    evidence.push("contract_verified");
  } else {
    score -= 10;
    evidence.push("verification_unknown");
  }

  if (cr.status === "incomplete") {
    // Critical: cannot analyze privilege surface
    score = Math.min(score, 35);
    incomplete = true;
    evidence.push("contract_risk_incomplete");
    notes.push("Contract risk analysis incomplete — unknown ≠ verified safe.");
  } else {
    evidence.push("contract_risk_analyzed");
    evidence.push(`abi_source_findings=${cr.findings.length}`);
  }

  if (!honeypotSwapSimulated) {
    // Soft but material: heuristic/source scan ≠ sell simulation
    score -= 15;
    incomplete = true;
    evidence.push("no_honeypot_swap_simulation");
    notes.push(
      "No honeypot sell/swap simulation — honeypot status is not fully verifiable.",
    );
  } else {
    evidence.push("honeypot_swap_simulated");
  }

  return dim("contract", score, { evidence, notes, incomplete });
}

/**
 * True multi-version discovery gap (unsearched version or non-v4 pools without
 * lock analysis). Distinct from known-first skipping exhaustive PM history —
 * that residual must not hard-cap at 45% when economic LP evidence is complete.
 */
export function hasTrueMultiVersionCoverageGap(
  versions: TokenOverview["lpIntelligence"]["uniswapVersions"] | null | undefined,
): boolean {
  if (!versions?.byVersion) return false;
  for (const v of ["v2", "v3", "v4"] as const) {
    const slice = versions.byVersion[v];
    if (!slice?.searched) return true;
  }
  for (const v of ["v2", "v3"] as const) {
    const slice = versions.byVersion[v];
    if (slice.poolsFound > 0 && !slice.lockAnalysisComplete) return true;
  }
  return false;
}

/**
 * Core economic LP evidence is complete enough that known-first / non-exhaustive
 * history must not be treated as the same failure class as undecoded multi-version
 * discovery. Does NOT set discoveryComplete — exhaustive may still be unfinished.
 *
 * PARTIALLY LOCKED / MIXED is a liquidity RESULT and does not block this.
 */
export function isCoreEconomicLpEvidenceComplete(
  overview: TokenOverview,
): boolean {
  const lp = overview.lpIntelligence;
  if (!lp.poolDetected || lp.positions.length === 0) return false;
  if (lp.knownPositionsVerified !== true) return false;
  if (
    lp.aggregateState !== "MIXED" &&
    lp.aggregateState !== "ALL_LOCKED" &&
    lp.aggregateState !== "ALL_UNLOCKED"
  ) {
    return false;
  }
  if ((lp.positionCounts?.unknown ?? 0) > 0) return false;
  if (!lp.lockDistribution?.available) return false;
  if (
    lp.aggregateLockState === "UNABLE_TO_DETERMINE" ||
    overview.lpLockStatus === "unknown"
  ) {
    return false;
  }
  if (hasTrueMultiVersionCoverageGap(lp.uniswapVersions)) return false;

  const valued = lp.positions.filter(
    (p) => p.valueUsd != null && Number.isFinite(p.valueUsd) && (p.valueUsd as number) > 0,
  );
  // Prefer full valuation; allow when lock distribution already proved economics.
  if (valued.length === 0 && (lp.lockDistribution.totalPositionUsd ?? 0) <= 0) {
    return false;
  }
  return true;
}

/**
 * Liquidity / position discovery coverage.
 * Incomplete Uniswap v4 position enumeration must NOT score near 100%.
 * True multi-version (v2/v3/v4) gaps still hard-cap; exhaustive history residual
 * is a soft completeness factor when core economic LP evidence is already complete.
 */
export function scoreLiquidityCoverage(overview: TokenOverview): ConfidenceDimension {
  const lp = overview.lpIntelligence;
  const evidence: string[] = [];
  const notes: string[] = [];
  let score = 100;
  let incomplete = false;
  const versions = lp.uniswapVersions;
  const economicComplete = isCoreEconomicLpEvidenceComplete(overview);
  const trueMultiGap = hasTrueMultiVersionCoverageGap(versions);

  if (!lp.poolDetected || lp.aggregateState === "NONE") {
    evidence.push("no_pool_detected");
    notes.push(
      "No Uniswap v2/v3/v4 liquidity detected in probe set — LP coverage N/A for lock claims.",
    );
    if (versions && !versions.coverageComplete) {
      evidence.push("multi_version_coverage_incomplete_no_pool");
      notes.push(
        versions.incompleteReason ??
          "Multi-version Uniswap coverage incomplete even with no pool detected.",
      );
      return dim("liquidity", 58, { evidence, notes, incomplete: true });
    }
    // Moderate: probes ran and found nothing
    return dim("liquidity", 72, { evidence, notes, incomplete: false });
  }

  evidence.push("pool_detected");
  evidence.push(`positions_detected=${lp.positions.length}`);
  evidence.push(`discovery_complete=${lp.discoveryComplete}`);
  evidence.push(`exhaustive_complete=${lp.exhaustiveDiscoveryComplete === true}`);
  evidence.push(`known_positions_verified=${lp.knownPositionsVerified === true}`);
  evidence.push(`aggregate_state=${lp.aggregateState}`);
  if (versions) {
    evidence.push(
      `uniswap_versions=${versions.versionsDetected.join("+") || "none"}`,
    );
    evidence.push(`multi_version_coverage_complete=${versions.coverageComplete}`);
  }
  if (lp.discoverySources?.length) {
    evidence.push(`discovery_sources=${lp.discoverySources.join("+")}`);
  }
  if (economicComplete) {
    evidence.push("core_economic_lp_evidence_complete");
  }

  if (lp.positions.length === 0) {
    score = 28;
    incomplete = true;
    evidence.push("zero_positions_with_pool");
    notes.push(
      "Pool has inventory but no Position NFTs / ownership slots were enumerated — material discovery gap.",
    );
    return dim("liquidity", score, { evidence, notes, incomplete });
  }

  // True multi-version gap (unsearched / undecoded non-v4 pools): keep hard floor.
  // When economic evidence is complete and the only residual is non-exhaustive PM
  // history, do NOT apply the 45% hard-cap — use soft residual below instead.
  if (versions && !versions.coverageComplete && (!economicComplete || trueMultiGap)) {
    score = Math.min(score, 45);
    incomplete = true;
    evidence.push("multi_version_coverage_incomplete");
    notes.push(
      versions.incompleteReason ??
        "INCOMPLETE COVERAGE across Uniswap versions. Protocol support ≠ locker support.",
    );
  } else if (versions && !versions.coverageComplete && economicComplete) {
    evidence.push("multi_version_flag_softened_by_economic_evidence");
    notes.push(
      "Multi-version coverageComplete=false reflects non-exhaustive history residual — core economic LP evidence is complete.",
    );
  }

  if (!lp.discoveryComplete) {
    if (economicComplete) {
      // Soft residual only — do not hard-cap at 52 when economics are complete.
      evidence.push("position_discovery_incomplete_soft");
      notes.push(
        lp.completenessWarning ??
          "Known positions verified; full PositionManager history discovery not finished.",
      );
    } else {
      score = Math.min(score, 52);
      incomplete = true;
      evidence.push("position_discovery_incomplete");
      notes.push(
        lp.completenessWarning ??
          "Liquidity position discovery incomplete. One locked Position NFT does not mean all liquidity is locked.",
      );
    }
  } else {
    evidence.push("position_discovery_marked_complete");
  }

  if (lp.aggregateState === "UNKNOWN_INCOMPLETE") {
    score = Math.min(score, 42);
    incomplete = true;
    evidence.push("aggregate_unknown_incomplete");
    notes.push("Token-level LP aggregate is UNKNOWN/INCOMPLETE.");
  }

  if (
    lp.aggregateLockState === "UNABLE_TO_DETERMINE" ||
    overview.lpLockStatus === "unknown"
  ) {
    score = Math.min(score, 48);
    incomplete = true;
    evidence.push("lock_unable_to_determine");
    notes.push("LP lock ownership path incomplete — not treated as verified.");
  }

  const unknownCount = lp.positionCounts?.unknown ?? 0;
  if (unknownCount > 0) {
    score -= Math.min(20, unknownCount * 8);
    incomplete = true;
    evidence.push(`unknown_positions=${unknownCount}`);
    notes.push("One or more detected positions have undetermined lock ownership.");
  }

  // MIXED / PARTIALLY LOCKED is a result — only couple to incomplete discovery
  // when core economic evidence is still missing.
  if (lp.aggregateState === "MIXED" && !lp.discoveryComplete && !economicComplete) {
    score = Math.min(score, 50);
    incomplete = true;
    evidence.push("mixed_with_incomplete_discovery");
  } else if (lp.aggregateState === "MIXED") {
    evidence.push("mixed_partially_locked_result_not_coverage_penalty");
  }

  if (lp.evidenceLevel === "unavailable" || lp.evidenceLevel === "registry_inferred") {
    score -= 10;
    evidence.push(`evidence_level=${lp.evidenceLevel}`);
  } else if (lp.evidenceLevel === "on_chain_verified") {
    evidence.push("evidence_on_chain_verified");
  }

  if (lp.lockDistribution && !lp.lockDistribution.available) {
    score -= 5;
    evidence.push("lock_pct_unavailable");
    if (lp.lockDistribution.reason) notes.push(lp.lockDistribution.reason);
  } else if (
    lp.lockDistribution?.available &&
    lp.lockDistribution.poolLiquidityUsd != null &&
    lp.lockDistribution.poolLiquidityUsd > 0 &&
    !lp.lockDistribution.reconciledWithPool
  ) {
    score -= 8;
    incomplete = true;
    evidence.push("position_economics_unreconciled");
    notes.push("Position USD does not reconcile with labeled pool liquidity.");
  }

  // Soft residual: exhaustive PM history unfinished (never forces 100%).
  if (lp.exhaustiveDiscoveryComplete !== true) {
    if (economicComplete) {
      score -= 8;
      evidence.push("exhaustive_discovery_soft_residual");
      notes.push(
        "Exhaustive PositionManager history not finished — soft residual only; economic LP evidence is complete.",
      );
    } else if (lp.discoveryComplete) {
      // discoveryComplete without exhaustive is unexpected; keep mild headroom.
      score -= 5;
      evidence.push("exhaustive_incomplete_with_discovery_complete");
    }
  }

  // Valuation coverage soft factor when some positions lack USD.
  const valuedCount = lp.positions.filter(
    (p) => p.valueUsd != null && Number.isFinite(p.valueUsd) && (p.valueUsd as number) > 0,
  ).length;
  if (lp.positions.length > 0 && valuedCount < lp.positions.length && !lp.lockDistribution?.available) {
    score -= Math.min(12, (lp.positions.length - valuedCount) * 4);
    incomplete = true;
    evidence.push(`unvalued_positions=${lp.positions.length - valuedCount}`);
  }

  return dim("liquidity", score, { evidence, notes, incomplete });
}

/** Holder data coverage — counters + concentration sample. */
export function scoreHolderCoverage(overview: TokenOverview): ConfidenceDimension {
  const evidence: string[] = [];
  const notes: string[] = [];
  let score = 100;
  let incomplete = false;

  if (overview.holdersCount == null) {
    score -= 30;
    incomplete = true;
    evidence.push("holders_count_unknown");
    notes.push("Holders count unavailable.");
  } else {
    evidence.push(`holders_count=${overview.holdersCount}`);
    if (overview.holdersCount < 10) {
      score -= 15;
      notes.push("Very few holders — sample thin by nature.");
    }
  }

  const sample = overview.topHolders.length;
  evidence.push(`top_holders_sample=${sample}`);
  if (sample < 5) {
    score -= 35;
    incomplete = true;
    notes.push("Top-holder sample under 5 — concentration coverage weak.");
  } else if (sample < 10) {
    score -= 20;
    incomplete = true;
    notes.push("Top-holder sample under 10.");
  } else if (sample < 20) {
    score -= 8;
    notes.push("Top-holder sample under 20 — partial concentration view.");
  } else {
    evidence.push("top_holders_sample_adequate");
  }

  if (!overview.totalSupplyRaw) {
    score -= 15;
    incomplete = true;
    evidence.push("supply_missing_for_concentration");
  }

  return dim("holders", score, { evidence, notes, incomplete });
}

/** Wallet relationship graph coverage — sampled ≠ full holder graph. */
export function scoreWalletCoverage(
  overview: TokenOverview,
  walletGraph: WalletGraphCoverageInput,
): ConfidenceDimension {
  const evidence: string[] = [];
  const notes: string[] = [];
  let score = 100;
  let incomplete = false;

  if (!overview.deployer) {
    score -= 15;
    incomplete = true;
    evidence.push("deployer_missing");
    notes.push("Deployer unavailable — deployer-linked relationship signals limited.");
  } else {
    evidence.push("deployer_present");
  }

  if (walletGraph.sampled) {
    // Hard soft-cap: production graphs are top-holder samples, not full graphs
    score = Math.min(score, 68);
    incomplete = true;
    evidence.push(`wallet_graph_sampled_n=${walletGraph.sampleSize}`);
    notes.push(
      `Wallet relationship graph sampled to top ${walletGraph.sampleSize} non-excluded holders — not a full holder graph.`,
    );
  } else {
    evidence.push("wallet_graph_unbounded_or_fixture");
  }

  if (walletGraph.sampleSize <= 0) {
    score = Math.min(score, 25);
    incomplete = true;
    evidence.push("wallet_sample_empty");
    notes.push("No holders available for relationship graph.");
  } else {
    const resolveRate =
      walletGraph.fundersResolved / Math.max(1, walletGraph.sampleSize);
    evidence.push(
      `funders_resolved=${walletGraph.fundersResolved}/${walletGraph.sampleSize}`,
    );
    if (resolveRate < 0.35) {
      score -= 22;
      incomplete = true;
      notes.push("Native funding edges resolved for under 35% of sampled holders.");
    } else if (resolveRate < 0.7) {
      score -= 10;
      notes.push("Partial funding-edge resolution on sampled holders.");
    }
  }

  if (walletGraph.earlyBuysCount <= 0) {
    score -= 12;
    evidence.push("early_buys_unavailable");
    notes.push("Early buy / transfer window not available for same-block signals.");
  } else {
    evidence.push(`early_buys=${walletGraph.earlyBuysCount}`);
  }

  return dim("wallet", score, { evidence, notes, incomplete });
}

/** Creator behaviour index coverage — missing history is a major blind spot. */
export function scoreCreatorCoverage(overview: TokenOverview): ConfidenceDimension {
  const cb = overview.creatorBehaviour;
  const evidence: string[] = [
    `status=${cb.status}`,
    `available=${cb.available}`,
    `pagination_complete=${cb.paginationComplete}`,
    `pages_fetched=${cb.pagesFetched}`,
    `transfers_indexed=${cb.transfersIndexed}`,
  ];
  const notes: string[] = [];

  if (cb.available && cb.status === "indexed" && cb.paginationComplete) {
    return dim("creator", 94, {
      evidence: [...evidence, "creator_fully_indexed"],
      notes: ["Creator sell/transfer index fully available."],
      incomplete: false,
    });
  }

  if (cb.available && cb.status === "indexed" && !cb.paginationComplete) {
    return dim("creator", 55, {
      evidence: [...evidence, "creator_indexed_partial_pages"],
      notes: [
        "Creator index partially complete — pagination did not finish; dump patterns may be under-counted.",
      ],
      incomplete: true,
    });
  }

  // Critical missing information — substantially low, not a cosmetic −10 on aggregate
  notes.push(
    cb.detail ||
      "Creator behaviour not fully indexed — analysis cannot verify dump / transfer-then-sell history.",
  );
  evidence.push("creator_behaviour_missing");
  return dim("creator", 18, { evidence, notes, incomplete: true });
}

/**
 * Data Confidence / Analysis Coverage (v1.2).
 * Weighted average of dimension scores — not `100 − flat penalties`.
 */
export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  const honeypotSwapSimulated = input.honeypotSwapSimulated === true;

  const dimensions: ConfidenceDimension[] = [
    scoreContractCoverage(input.overview, honeypotSwapSimulated),
    scoreLiquidityCoverage(input.overview),
    scoreHolderCoverage(input.overview),
    scoreWalletCoverage(input.overview, input.walletGraph),
    scoreCreatorCoverage(input.overview),
  ];

  // Optional soft note when activity volume missing (does not own a dimension)
  if (!input.hasActivityVolume) {
    const holders = dimensions.find((d) => d.id === "holders");
    holders?.notes.push("No labeled Activity volume source (Activity axis only).");
  }

  let weighted = 0;
  for (const d of dimensions) {
    weighted += d.score * DATA_CONFIDENCE_WEIGHTS[d.id];
  }
  const percent = clampScore(Math.max(5, weighted));

  const penalties: ConfidenceResult["penalties"] = [];
  for (const d of dimensions) {
    if (!d.incomplete) continue;
    const gap = Math.max(0, 100 - d.score);
    penalties.push({
      code: `coverage_${d.id}`,
      points: Math.round(gap * DATA_CONFIDENCE_WEIGHTS[d.id]),
      reason: d.notes[0] ?? `${d.label} coverage incomplete.`,
      dimension: d.id,
    });
  }

  // Stable order for API/UI
  dimensions.sort(
    (a, b) => DIMENSION_ORDER.indexOf(a.id) - DIMENSION_ORDER.indexOf(b.id),
  );

  return {
    percent,
    band: confidenceBand(percent),
    dimensions,
    weights: { ...DATA_CONFIDENCE_WEIGHTS },
    penalties,
  };
}
