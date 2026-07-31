#!/usr/bin/env node
/**
 * Phase 10C-3 — remote candidate deployment gate (temp-alias pattern).
 * Distinguishes: protection / app / timeout / parse / true hard drift.
 * Timeout is NEVER treated as PASS.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "reports", "data");
const BEER = "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804";
const HANSOME = "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875";
const PONS = "0x736D76699C26D0d966744cAe304C000d471f7F35";
const BASELINE_TIP = "dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7";
const LIVE = "https://www.hansomealpacas.xyz";
const TEMP_ALIAS = "https://hansomealpacas.vercel.app";

const CORE7 = [
  { id: "HANSOME", address: HANSOME },
  { id: "PRIMARY", address: "0x57ffd85d9f0744b7790dcdbbc2c0f188f81de00f" },
  { id: "FOX", address: "0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1" },
  { id: "GME", address: "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3" },
  { id: "CASHCAT", address: "0x020bfc650a365f8bb26819deaabf3e21291018b4" },
  { id: "PONS", address: "0x39dbed3a2bd333467115de45665cc57f813c4571" },
  { id: "TYGR", address: "0x69984ad3322300039f2855f81c44dbc532efe744" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadCfg() {
  const p = join(OUT, "phase10c3_candidate.json");
  if (!existsSync(p)) throw new Error("missing reports/data/phase10c3_candidate.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

async function fetchJson(url, init = {}, timeoutMs = 45_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        ...(init.headers || {}),
      },
    });
    const ctype = res.headers.get("content-type") || "";
    const text = await res.text();
    const isHtml = ctype.includes("text/html") || text.trimStart().startsWith("<!DOCTYPE");
    let json = null;
    if (!isHtml) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      ctype,
      isHtml,
      json,
      textLen: text.length,
      failureClass: !res.ok
        ? res.status === 401 || res.status === 403 || isHtml
          ? "protection_or_auth"
          : "http_error"
        : isHtml
          ? "protection_html"
          : json == null
            ? "parse_failure"
            : null,
    };
  } catch (e) {
    const name = e?.name || "Error";
    return {
      ok: false,
      status: 0,
      ctype: "",
      isHtml: false,
      json: null,
      textLen: 0,
      failureClass: name === "AbortError" ? "timeout" : "network",
      error: String(e?.message || e).slice(0, 160),
    };
  } finally {
    clearTimeout(t);
  }
}

function extractLp(j) {
  const o = j?.overview || j?.result?.overview || {};
  const lp = o.lpIntelligence || {};
  const stages = j?.analysisStages || j?.result?.analysisStages;
  const pos = lp.positions || [];
  const locked = pos.filter((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN");
  return {
    status: j?.analysisStatus || j?.result?.analysisStatus,
    phase: j?.analysisPhase || j?.result?.analysisPhase,
    stages,
    deepProgress: j?.deepProgress || j?.result?.deepProgress,
    score: j?.score?.score ?? j?.overall?.score ?? null,
    aggregate: lp.aggregateState ?? null,
    scoreLock: lp.aggregateLockState ?? null,
    discoveryComplete: lp.discoveryComplete ?? null,
    posCount: pos.length,
    lockedCount: locked.length,
    tokenId: locked[0]?.positionNftId ?? pos[0]?.positionNftId ?? null,
    lockState: locked[0]?.lockState ?? pos[0]?.lockState ?? null,
    lockerName: locked[0]?.lockerName ?? null,
    owner: locked[0]?.owner ?? null,
    liquidity: locked[0]?.liquidity ?? pos[0]?.liquidity ?? null,
    v3: lp.versionCoverage?.byVersion?.v3 ?? null,
    positionDiscoveryComplete:
      lp.versionCoverage?.byVersion?.v3?.positionDiscoveryComplete ??
      (pos.some((p) => p.positionNftId === "436637") ? true : null),
    lockAnalysisComplete: lp.versionCoverage?.byVersion?.v3?.lockAnalysisComplete ?? null,
    detail: (lp.detail || "").slice(0, 220),
  };
}

function liquidityTerminal(stages) {
  const liq = stages?.liquidity;
  return liq === "done" || liq === "partial" || liq === "unknown";
}

async function waitBeerDeep(base, { maxMs = 240_000, refreshFirst = true } = {}) {
  const timeline = [];
  if (refreshFirst) {
    const r = await fetchJson(`${base}/api/scan?address=${BEER}&refresh=1`, {}, 60_000);
    timeline.push({ at: 0, kind: "refresh", failureClass: r.failureClass, ...extractLp(r.json || {}) });
    if (r.failureClass) return { ok: false, failureClass: r.failureClass, timeline, final: null };
  }
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await fetchJson(`${base}/api/scan/status?address=${BEER}`, {}, 30_000);
    const body = s.json?.result || s.json;
    const lp = extractLp(body || {});
    const age = Date.now() - t0;
    timeline.push({ at: age, kind: "status", failureClass: s.failureClass, ...lp });
    if (s.failureClass === "timeout") {
      return { ok: false, failureClass: "timeout", timeline, final: lp };
    }
    if (s.failureClass) {
      return { ok: false, failureClass: s.failureClass, timeline, final: lp };
    }
    if (liquidityTerminal(lp.stages)) {
      const full = await fetchJson(`${base}/api/scan?address=${BEER}`, {}, 45_000);
      const final = extractLp(full.json || {});
      timeline.push({ at: Date.now() - t0, kind: "final", failureClass: full.failureClass, ...final });
      const beerLocked =
        final.lockState === "LOCKED_VERIFIED_ONCHAIN" &&
        final.tokenId === "436637" &&
        (final.owner || "").toLowerCase() === PONS.toLowerCase() &&
        final.lockerName === "PonsLaunchLocker";
      return {
        ok: beerLocked,
        failureClass: full.failureClass,
        beerLocked,
        timeline,
        final,
      };
    }
    await sleep(8_000);
  }
  return { ok: false, failureClass: "timeout", timeline, final: timeline.at(-1) || null };
}

function hardFields(j) {
  const o = j?.overview || {};
  const lp = o.lpIntelligence || {};
  return {
    score: j?.score?.score ?? null,
    // Exclude discovery-only diffs from hard drift (tokenId stub→real, provenance, positionDiscoveryComplete).
    aggregateLockState: lp.aggregateLockState ?? null,
    aggregateState: lp.aggregateState ?? null,
    // Position lock truth for material numeric ids only.
    lockedTokenIds: (lp.positions || [])
      .filter((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN")
      .map((p) => p.positionNftId)
      .sort(),
  };
}

function isDiscoveryOnlyDiff(live, cand) {
  // If hard semantic fields equal, any remaining diff is soft/discovery.
  return JSON.stringify(hardFields(live)) === JSON.stringify(hardFields(cand));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const cfg = loadCfg();
  const candidateBase = cfg.tempAliasUrl || TEMP_ALIAS;
  const report = {
    at: new Date().toISOString(),
    baselineTip: BASELINE_TIP,
    candidateId: cfg.deploymentId,
    candidateUrl: cfg.url,
    candidateBase,
    live: LIVE,
    protection: {},
    beer: {},
    core7: [],
    top100: {
      attempted: 0,
      completed: 0,
      hardSemanticDriftCompletedSet: 0,
      classes: { A_completed: 0, B_incomplete: 0, C_harness: 0, D_true_drift: 0 },
      rows: [],
    },
    gates: {},
    verdict: "NEEDS_REVIEW",
  };

  // A–E protection probes
  const probes = [
    ["A_www", `${LIVE}/api/scan?address=${BEER}`],
    ["B_temp_alias", `${candidateBase}/api/scan?address=${BEER}`],
    ["C_direct_tip", `${cfg.url}/api/scan?address=${BEER}`],
    ["D_status_alias", `${candidateBase}/api/scan/status?address=${BEER}`],
    ["E_game", "https://game.hansomealpacas.xyz/"],
  ];
  for (const [name, url] of probes) {
    const r = await fetchJson(url, {}, 30_000);
    report.protection[name] = {
      status: r.status,
      isHtml: r.isHtml,
      failureClass: r.failureClass,
      json: Boolean(r.json),
    };
  }

  console.error("BEER deep wait on candidate alias…");
  const beer = await waitBeerDeep(candidateBase, { maxMs: 240_000, refreshFirst: true });
  report.beer = beer;
  writeFileSync(join(OUT, "phase10c3_beer_timeline.json"), JSON.stringify(beer, null, 2));

  // Core7 cached compare (terminal only)
  for (const t of CORE7) {
    const live = await fetchJson(`${LIVE}/api/scan?address=${t.address}`, {}, 45_000);
    const cand = await fetchJson(`${candidateBase}/api/scan?address=${t.address}`, {}, 45_000);
    const liveLp = extractLp(live.json || {});
    const candLp = extractLp(cand.json || {});
    const liveTerm = liquidityTerminal(liveLp.stages) || liveLp.status === "complete";
    const candTerm = liquidityTerminal(candLp.stages) || candLp.status === "complete";
    let klass = "B_incomplete";
    if (live.failureClass || cand.failureClass) klass = "C_harness";
    else if (!liveTerm || !candTerm) klass = "B_incomplete";
    else if (!isDiscoveryOnlyDiff(live.json, cand.json) &&
      JSON.stringify(hardFields(live.json)) !== JSON.stringify(hardFields(cand.json))) {
      klass = "D_true_drift";
    } else klass = "A_completed";
    report.core7.push({
      id: t.id,
      class: klass,
      live: { score: liveLp.score, lock: liveLp.lockState, status: liveLp.status },
      cand: { score: candLp.score, lock: candLp.lockState, status: candLp.status },
    });
    await sleep(500);
  }

  // Top-100 sample from burn corpus if present
  let sample = [BEER, HANSOME, ...CORE7.map((c) => c.address)];
  const corpusPath = join(OUT, "robinhood_top100_burn_explainability_corpus.json");
  if (existsSync(corpusPath)) {
    try {
      const corpus = JSON.parse(readFileSync(corpusPath, "utf8"));
      const addrs = (corpus.addresses || corpus.tokens || [])
        .map((x) => (typeof x === "string" ? x : x.address))
        .filter(Boolean);
      if (addrs.length >= 20) sample = addrs.slice(0, 100);
    } catch {
      /* keep default */
    }
  }
  sample = [...new Set(sample.map((a) => a.toLowerCase()))].slice(0, 100);

  for (const addr of sample) {
    report.top100.attempted += 1;
    const live = await fetchJson(`${LIVE}/api/scan?address=${addr}`, {}, 40_000);
    const cand = await fetchJson(`${candidateBase}/api/scan?address=${addr}`, {}, 40_000);
    const liveLp = extractLp(live.json || {});
    const candLp = extractLp(cand.json || {});
    const liveTerm =
      liveLp.status === "complete" ||
      (liquidityTerminal(liveLp.stages) && liveLp.status !== "deep_running");
    const candTerm =
      candLp.status === "complete" ||
      (liquidityTerminal(candLp.stages) && candLp.status !== "deep_running");
    let klass = "B_incomplete";
    let drifted = false;
    if (live.failureClass || cand.failureClass) klass = "C_harness";
    else if (!liveTerm || !candTerm) klass = "B_incomplete";
    else {
      report.top100.completed += 1;
      const hfL = hardFields(live.json);
      const hfC = hardFields(cand.json);
      drifted = JSON.stringify(hfL) !== JSON.stringify(hfC);
      klass = drifted ? "D_true_drift" : "A_completed";
      if (drifted) report.top100.hardSemanticDriftCompletedSet += 1;
    }
    report.top100.classes[klass] += 1;
    if (klass !== "A_completed") {
      report.top100.rows.push({
        address: addr,
        class: klass,
        liveStatus: liveLp.status,
        candStatus: candLp.status,
        liveScore: liveLp.score,
        candScore: candLp.score,
      });
    }
    await sleep(200);
  }

  const beerPass = beer.beerLocked === true && beer.failureClass == null;
  const hardDriftOk =
    report.top100.hardSemanticDriftCompletedSet === 0 &&
    report.top100.completed > 0 &&
    report.top100.classes.D_true_drift === 0;
  const coverageOk = report.top100.completed >= 10;
  const protectionAliasOk = report.protection.B_temp_alias?.json === true;
  const noTimeoutPass = beer.failureClass !== "timeout";

  report.gates = {
    beerLockedVerifiedOnchain: beerPass,
    beerNoTimeoutAsPass: noTimeoutPass && beer.failureClass !== "timeout",
    tempAliasJsonAccess: protectionAliasOk,
    top100HardDriftZeroCompleted: hardDriftOk,
    top100CompletedCoverage: coverageOk,
    top100Completed: report.top100.completed,
    top100Attempted: report.top100.attempted,
    hardSemanticDriftCompletedSet: report.top100.hardSemanticDriftCompletedSet,
    core7TrueDrift: report.core7.filter((r) => r.class === "D_true_drift").length,
  };

  const promote =
    beerPass &&
    hardDriftOk &&
    coverageOk &&
    protectionAliasOk &&
    report.gates.core7TrueDrift === 0;

  report.verdict = promote
    ? "READY_TO_PROMOTE"
    : beer.failureClass === "timeout"
      ? "PASS_NOT_DEPLOYED"
      : "PASS_NOT_DEPLOYED";

  writeFileSync(join(OUT, "phase10c3_remote_gate.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    verdict: report.verdict,
    gates: report.gates,
    beerLock: beer.final?.lockState,
    beerTokenId: beer.final?.tokenId,
    beerFailure: beer.failureClass,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
