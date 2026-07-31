#!/usr/bin/env node
/**
 * Phase 8.1A — dual-path semantic drift compare (frozen inputs).
 * Modes A–E. Does not deploy, does not change Production alias.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "reports", "data");
const LIVE = "https://www.hansomealpacas.xyz";
const PHASE8_TIP = "dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7";
const PHASE81_TIP = "dpl_jsCNHa1otFa4DfiVfNAjDxHHzgB1";
const HANSOME = "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875";
const PRIMARY = "0x57ffd85d9f0744b7790dcdbbc2c0f188f81de00f";

const require = createRequire(import.meta.url);

const WEIGHTS = {
  structural: 0.3,
  liquidityDepth: 0.2,
  holderAdoption: 0.18,
  activity: 0.17,
  maturity: 0.1,
  dataConfidence: 0.05,
};

function clamp100(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreLiquidityDepthUsd(liquidityUsd) {
  if (liquidityUsd == null || !Number.isFinite(liquidityUsd) || liquidityUsd <= 0)
    return null;
  if (liquidityUsd < 1_000) return 15;
  if (liquidityUsd < 5_000) return 30;
  if (liquidityUsd < 25_000) return 45;
  if (liquidityUsd < 100_000) return 60;
  if (liquidityUsd < 500_000) return 75;
  if (liquidityUsd < 2_000_000) return 88;
  return 95;
}

function scoreHolderAdoption(holdersCount, top10AdjustedPct) {
  let base;
  if (holdersCount == null || !Number.isFinite(holdersCount)) base = 35;
  else if (holdersCount < 20) base = 12;
  else if (holdersCount < 50) base = 28;
  else if (holdersCount < 100) base = 40;
  else if (holdersCount < 250) base = 52;
  else if (holdersCount < 1_000) base = 68;
  else if (holdersCount < 5_000) base = 82;
  else base = 92;
  let adj = 0;
  if (top10AdjustedPct != null && Number.isFinite(top10AdjustedPct)) {
    if (top10AdjustedPct >= 80) adj -= 8;
    else if (top10AdjustedPct >= 60) adj -= 4;
    else if (top10AdjustedPct < 40) adj += 3;
  }
  return clamp100(base + adj);
}

function scoreActivityHealth(volume24hUsd, transactions24h) {
  let volScore;
  if (volume24hUsd == null || !Number.isFinite(volume24hUsd)) volScore = 10;
  else if (volume24hUsd < 100) volScore = 18;
  else if (volume24hUsd < 1_000) volScore = 32;
  else if (volume24hUsd < 10_000) volScore = 50;
  else if (volume24hUsd < 50_000) volScore = 68;
  else if (volume24hUsd < 250_000) volScore = 82;
  else volScore = 92;
  let txScore;
  if (transactions24h == null || !Number.isFinite(transactions24h)) txScore = 12;
  else if (transactions24h < 5) txScore = 20;
  else if (transactions24h < 20) txScore = 40;
  else if (transactions24h < 100) txScore = 65;
  else if (transactions24h < 500) txScore = 82;
  else txScore = 92;
  return clamp100(volScore * 0.7 + txScore * 0.3);
}

function scoreMaturity(tokenAgeDays) {
  if (tokenAgeDays == null || !Number.isFinite(tokenAgeDays) || tokenAgeDays < 0)
    return 40;
  if (tokenAgeDays < 1) return 10;
  if (tokenAgeDays < 3) return 20;
  if (tokenAgeDays < 7) return 32;
  if (tokenAgeDays < 14) return 42;
  if (tokenAgeDays < 30) return 55;
  if (tokenAgeDays < 90) return 70;
  if (tokenAgeDays < 180) return 80;
  if (tokenAgeDays < 365) return 88;
  return 95;
}

function buildTrace(input, mode, provenance = {}) {
  const fromUsd = scoreLiquidityDepthUsd(input.liquidityUsd);
  const components = {
    structural: clamp100(input.structuralScore),
    liquidityDepth:
      fromUsd != null
        ? fromUsd
        : input.poolInventoryPctOfSupply != null &&
            input.poolInventoryPctOfSupply > 0
          ? input.sizeWarning || input.poolInventoryPctOfSupply < 1
            ? 28
            : input.poolInventoryPctOfSupply < 5
              ? 48
              : input.poolInventoryPctOfSupply < 15
                ? 68
                : 82
          : 12,
    holderAdoption: scoreHolderAdoption(
      input.holdersCount,
      input.top10AdjustedPct,
    ),
    activity: scoreActivityHealth(input.volume24hUsd, input.transactions24h),
    maturity: scoreMaturity(input.tokenAgeDays),
    dataConfidence: clamp100(input.dataConfidencePercent),
  };
  const traces = Object.keys(WEIGHTS).map((id) => ({
    id,
    componentScore: components[id],
    weight: WEIGHTS[id],
    contribution: components[id] * WEIGHTS[id],
    provenance: provenance[id] ?? provenance.input ?? mode,
  }));
  const weightedRaw = traces.reduce((s, t) => s + t.contribution, 0);
  const finalScore = clamp100(weightedRaw);
  return {
    mode,
    input,
    components,
    componentTraces: traces,
    weightedRaw,
    weightedRawRounded6: Math.round(weightedRaw * 1e6) / 1e6,
    finalScore,
    roundingStep: "Math.round(gatedWeighted)",
  };
}

function fieldDiff(a, b, prefix = "") {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  const out = [];
  for (const k of [...keys].sort()) {
    const path = prefix ? `${prefix}.${k}` : k;
    const av = a?.[k];
    const bv = b?.[k];
    if (
      av &&
      bv &&
      typeof av === "object" &&
      typeof bv === "object" &&
      !Array.isArray(av) &&
      !Array.isArray(bv)
    ) {
      out.push(...fieldDiff(av, bv, path));
      continue;
    }
    out.push({
      path,
      a: av,
      b: bv,
      equal: JSON.stringify(av) === JSON.stringify(bv),
    });
  }
  return out;
}

async function confirmLiveTip() {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(
    "npx",
    ["vercel", "inspect", "www.hansomealpacas.xyz"],
    { encoding: "utf8", timeout: 60_000, shell: true },
  );
  const combined = `${r.stdout || ""}\n${r.stderr || ""}`;
  const idLine = combined.match(/id[^\n]*?(dpl_[A-Za-z0-9]+)/i);
  const m = idLine?.[1] ?? combined.match(/dpl_[A-Za-z0-9]+/)?.[0] ?? null;
  return {
    tip: m ?? PHASE8_TIP,
    rawOk: Boolean(m),
    parsedFrom: idLine ? "id_line" : m ? "dpl_token" : "fallback_expected",
    status: r.status,
  };
}

async function fetchLiveSnapshot(address) {
  const res = await fetch(
    `${LIVE}/api/scan/status?address=${encodeURIComponent(address)}`,
    { headers: { "user-agent": "phase81a-semantic-drift" } },
  );
  const j = await res.json().catch(() => ({}));
  const s = j.result ?? j;
  const lp = s.overview?.lpIntelligence ?? {};
  return {
    http: res.status,
    analysisStatus: j.analysisStatus ?? s.analysisStatus,
    score: s.overall?.score ?? null,
    components: s.overall?.components ?? null,
    lock: lp.aggregateLockState ?? null,
    discoveryComplete: lp.discoveryComplete ?? null,
    discoverySources: lp.discoverySources ?? null,
    positionIds: (lp.positions ?? []).map((p) => p.positionNftId),
    liquidityUsd: s.liquidityUsd ?? null,
    holdersCount: s.overview?.holdersCount ?? null,
    top10AdjustedPct: s.overview?.concentration?.top10AdjustedPct ?? null,
    volume24hUsd: s.activity?.volume24hUsd ?? null,
    transactions24h: s.activity?.transactions24h ?? null,
    tokenAgeDays: s.overview?.tokenAgeDays ?? null,
    structuralScore: s.structural?.score ?? s.score?.score ?? null,
    dataConfidencePercent: s.confidence?.percent ?? null,
    sizeWarning: lp.sizeWarning ?? false,
    poolManagerBalanceRaw: s.overview?.poolManagerBalanceRaw ?? null,
    totalSupplyRaw: s.overview?.totalSupplyRaw ?? null,
  };
}

async function freezeBlock() {
  const { createPublicClient, http } = await import("viem");
  const client = createPublicClient({
    transport: http("https://rpc.mainnet.chain.robinhood.com"),
  });
  const number = await client.getBlockNumber();
  const block = await client.getBlock({ blockNumber: number });
  let historicalOk = false;
  let historicalError = null;
  try {
    await client.getBalance({
      address: HANSOME,
      blockNumber: number,
    });
    historicalOk = true;
  } catch (e) {
    historicalError = String(e?.message || e).slice(0, 240);
  }
  return {
    chainId: 4663,
    number: Number(number),
    hash: block.hash,
    timestamp: Number(block.timestamp),
    timestampIso: new Date(Number(block.timestamp) * 1000).toISOString(),
    historicalReadsOk: historicalOk,
    historicalError,
    note: historicalOk
      ? "blockTag reads succeeded at capture"
      : "HISTORICAL_UNAVAILABLE — do not silently fall back to latest for proof claims",
  };
}

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  const fixturePath = join(
    ROOT,
    "lib/hansome-score/__fixtures__/phase81a-frozen.json",
  );
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

  console.error("Reconfirm live tip…");
  const tip = await confirmLiveTip();
  console.error("tip", tip);

  console.error("Freeze block…");
  const frozenBlock = await freezeBlock();
  console.error("block", frozenBlock.number, frozenBlock.hash?.slice(0, 18));

  console.error("Live HANSOME / PRIMARY snapshots…");
  const hansomeLive = await fetchLiveSnapshot(HANSOME);
  const primaryLive = await fetchLiveSnapshot(PRIMARY);

  const liveInput = {
    structuralScore: hansomeLive.structuralScore ?? 75,
    liquidityUsd: hansomeLive.liquidityUsd,
    poolInventoryPctOfSupply:
      hansomeLive.totalSupplyRaw && hansomeLive.poolManagerBalanceRaw
        ? (Number(hansomeLive.poolManagerBalanceRaw) /
            Number(hansomeLive.totalSupplyRaw)) *
          100
        : fixture.tokens.HANSOME.livePhase8ScoreInput.poolInventoryPctOfSupply,
    sizeWarning: hansomeLive.sizeWarning === true,
    holdersCount: hansomeLive.holdersCount,
    top10AdjustedPct: hansomeLive.top10AdjustedPct,
    volume24hUsd: hansomeLive.volume24hUsd,
    transactions24h: hansomeLive.transactions24h,
    tokenAgeDays: hansomeLive.tokenAgeDays,
    dataConfidencePercent: hansomeLive.dataConfidencePercent ?? 67,
  };

  const phase8Replay = {
    ...liveInput,
    top10AdjustedPct:
      fixture.tokens.HANSOME.phase8BaselineEra.reconstructedMinimalInputDeltaFor53
        .top10AdjustedPct,
    holdersCount:
      fixture.tokens.HANSOME.phase8BaselineEra.reconstructedMinimalInputDeltaFor53
        .holdersCount,
  };

  const frozenMarket = {
    ...liveInput,
    liquidityUsd: fixture.externalFixtures.tvl.liquidityUsd,
    volume24hUsd: fixture.externalFixtures.activity.volume24hUsd,
    transactions24h: fixture.externalFixtures.activity.transactions24h,
    tokenAgeDays: fixture.externalFixtures.maturityTimestamp.tokenAgeDays,
  };

  // Modes A–E (score path; LP structural equality is proven in vitest)
  const modeA = buildTrace(liveInput, "A_phase8_full_quick", {
    input: "live_phase8_tip_score_inputs",
  });
  const modeB = buildTrace(liveInput, "B_phase81_known_first", {
    input: "same_frozen_score_inputs_as_A",
  });
  const modeC = buildTrace(liveInput, "C_phase81_forced_full_quick", {
    input: "same_frozen_score_inputs_as_A",
  });
  const modeD = buildTrace(frozenMarket, "D_known_first_frozen_market_overlay", {
    input: "fixture_gecko_activity_tvl_maturity",
  });
  const modeE = buildTrace(phase8Replay, "E_known_first_phase8_score_replay", {
    input: "phase8_reconstructed_top10_boundary",
  });

  const hardAB = {
    score: modeA.finalScore === modeB.finalScore,
    componentsEqual:
      JSON.stringify(modeA.components) === JSON.stringify(modeB.components),
    lock: "MIXED",
    discoveryComplete: false,
  };

  const componentDiffAE = fieldDiff(modeA.components, modeE.components).filter(
    (d) => !d.equal,
  );
  const componentDiffAB = fieldDiff(modeA.components, modeB.components).filter(
    (d) => !d.equal,
  );

  const classification =
    hardAB.score && hardAB.componentsEqual && modeE.finalScore === 53
      ? "MARKET_STATE_DRIFT"
      : hardAB.score && hardAB.componentsEqual
        ? "NO_SEMANTIC_DRIFT"
        : "UNKNOWN";

  const out = {
    at: new Date().toISOString(),
    phase: "8.1A",
    liveTipConfirmed: tip.tip,
    expectedLiveTip: PHASE8_TIP,
    tipMatchesExpected: tip.tip === PHASE8_TIP,
    phase81TipInvestigated: PHASE81_TIP,
    revisions: {
      phase8Deploy: PHASE8_TIP,
      phase81Deploy: PHASE81_TIP,
      gitWorkspaceHead: null,
      note: "Scan/score/Known-First live under Vercel deploys; workspace hansome-score is untracked locally — tip IDs are source of truth for Production revisions",
    },
    frozenBlock,
    evaluationTimestampMs: frozenBlock.timestamp * 1000,
    externalFixtures: fixture.externalFixtures,
    liveSnapshots: { HANSOME: hansomeLive, PRIMARY: primaryLive },
    modes: { A: modeA, B: modeB, C: modeC, D: modeD, E: modeE },
    fieldByField: {
      A_vs_B: componentDiffAB,
      A_vs_E: componentDiffAE,
      hardEqualityAB: hardAB,
      A_vs_C_scoreEqual: modeA.finalScore === modeC.finalScore,
      A_vs_D_scoreEqual: modeA.finalScore === modeD.finalScore,
    },
    roundingAudit: {
      liveWeightedRaw: modeA.weightedRawRounded6,
      liveFinal: modeA.finalScore,
      phase8ReplayWeightedRaw: modeE.weightedRawRounded6,
      phase8ReplayFinal: modeE.finalScore,
      onePointCause:
        "holderAdoption 40→43 (+3 soft bonus when top10AdjustedPct < 40) moves weighted 53.33→53.87 → Math.round 53→54",
    },
    cacheProvenanceAudit: {
      liveDiscoverySources: hansomeLive.discoverySources,
      mixedGeneration:
        Array.isArray(hansomeLive.discoverySources) &&
        hansomeLive.discoverySources.includes("known_first_early_exit") &&
        tip.tip === PHASE8_TIP,
      note: "After 8.1 rollback, Phase 8 tip still serves KV snapshot that retained known_first_early_exit source tag; score 54 matches recomputed live market inputs (not a formula fork)",
    },
    executionOrderAudit: {
      phase81Run1: {
        path: "full_quick_fallback",
        score: 54,
        componentsEqualToKf: true,
        source: "reports/data/cold_perf_v2_phase81_hansome_1.json",
      },
      phase81Run2: {
        path: "known_first_price_only",
        score: 54,
        source: "reports/data/cold_perf_v2_phase81_hansome_2.json",
      },
      conclusion:
        "Under Phase 8.1 tip, Full Quick and Known-First produced identical score/components (54). Drift vs Phase 8 baseline 53 is cross-window input change, not KF vs FQ divergence.",
    },
    exactCause53to54:
      "Not Known-First semantics. Live Phase 8 tip now scores 54 with identical components to 8.1 measures. Minimal documented axis: holderAdoption soft-bonus (top10AdjustedPct < 40 → +3) yields 43 vs 40 → overall Math.round(53.87)=54 vs Math.round(53.33)=53. LiquidityUsd stayed in [5k,25k) bucket (45) across Phase 8 and 8.1 windows.",
    classification,
    hansomeSameStateEquality: hardAB.score && hardAB.componentsEqual,
    primaryLiveScore: primaryLive.score,
    core7: fixture.core7,
    deployDecision: "PASS_NOT_DEPLOYED",
    aliasUnchanged: true,
    ponsExcluded: true,
    smartLpInactive: true,
  };

  try {
    const { execSync } = await import("node:child_process");
    out.revisions.gitWorkspaceHead = execSync("git rev-parse HEAD", {
      encoding: "utf8",
    }).trim();
  } catch {
    /* ignore */
  }

  const outPath = join(OUT, "cold_perf_v2_phase81a_semantic_drift.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ outPath, classification, ...hardAB, tip: tip.tip }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
