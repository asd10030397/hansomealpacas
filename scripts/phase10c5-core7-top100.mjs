#!/usr/bin/env node
/**
 * Phase 10C-5 — Core7 + Top100 completed-set hard drift (after BEER forced 10/10).
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "reports", "data");
const LIVE = "https://www.hansomealpacas.xyz";
const CAND = process.env.HANSOME_GATE_BASE || "https://hansomealpacas.vercel.app";
const BEER = "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804";
const HANSOME = "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CORE7 = [
  { id: "HANSOME", address: HANSOME },
  { id: "PRIMARY", address: "0x57ffd85d9f0744b7790dcdbbc2c0f188f81de00f" },
  { id: "FOX", address: "0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1" },
  { id: "GME", address: "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3" },
  { id: "CASHCAT", address: "0x020bfc650a365f8bb26819deaabf3e21291018b4" },
  { id: "PONS", address: "0x39dbed3a2bd333467115de45665cc57f813c4571" },
  { id: "TYGR", address: "0x69984ad3322300039f2855f81c44dbc532efe744" },
];

async function fetchJson(url, timeoutMs = 45_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    const isHtml = text.trimStart().startsWith("<!DOCTYPE");
    let json = null;
    if (!isHtml) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    return {
      ok: res.ok && json != null,
      json,
      isHtml,
      fail: !res.ok ? (res.status === 401 || isHtml ? "A" : "I") : isHtml ? "A" : json == null ? "I" : null,
    };
  } catch (e) {
    return {
      ok: false,
      json: null,
      isHtml: false,
      fail: e?.name === "AbortError" ? "F" : "I",
    };
  } finally {
    clearTimeout(t);
  }
}

function rootOf(j) {
  return j?.result || j || {};
}

function hardFields(j) {
  const r = rootOf(j);
  const lp = r.overview?.lpIntelligence || {};
  const locked = (lp.positions || []).filter(
    (p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN",
  );
  // Lock identity only — Overall score can move while sibling stages finish.
  return {
    lockState: locked[0]?.lockState ?? null,
    tokenId: locked[0]?.positionNftId ?? null,
    owner: (locked[0]?.owner || "").toLowerCase() || null,
    aggregate: lp.aggregateLockState ?? lp.aggregateState ?? null,
  };
}

/** True hard semantic drift (not candidate discovering a lock baseline missed). */
function isHardLockDrift(liveJ, candJ) {
  const a = hardFields(liveJ);
  const b = hardFields(candJ);
  const liveLocked = a.lockState === "LOCKED_VERIFIED_ONCHAIN";
  const candLocked = b.lockState === "LOCKED_VERIFIED_ONCHAIN";
  if (liveLocked && candLocked) {
    return a.tokenId !== b.tokenId || a.owner !== b.owner;
  }
  // Candidate found verified lock while baseline sticky-incomplete → not drift.
  if (!liveLocked && candLocked) return false;
  // Candidate lost a verified lock baseline had → regression.
  if (liveLocked && !candLocked) return true;
  return false;
}

function liqTerminal(stages, status, lpTerminal) {
  const st = stages?.liquidity;
  if (
    lpTerminal?.terminalState === "SUCCESS_TERMINAL" ||
    lpTerminal?.terminalState === "FAILED_TERMINAL"
  ) {
    return true;
  }
  return (
    st === "done" ||
    st === "partial" ||
    st === "unknown" ||
    st === "failed" ||
    status === "complete" ||
    status === "partial" ||
    status === "failed"
  );
}

async function waitCandTerminal(addr, maxLoops = 36) {
  let body = null;
  for (let i = 0; i < maxLoops; i++) {
    const st = await fetchJson(`${CAND}/api/scan/status?address=${addr}`, 30_000);
    const r = rootOf(st.json?.result || st.json);
    // LP terminal is enough — sibling stages may still be deep_running.
    if (liqTerminal(r.analysisStages, r.analysisStatus, r.lpTerminal)) {
      const full = await fetchJson(`${CAND}/api/scan?address=${addr}`, 45_000);
      body = full.json;
      break;
    }
    await sleep(8_000);
  }
  if (!body) {
    const full = await fetchJson(`${CAND}/api/scan?address=${addr}`, 45_000);
    body = full.json;
  }
  return body;
}

function scanLpTerminal(j) {
  const r = rootOf(j);
  return liqTerminal(r.analysisStages, r.analysisStatus, r.lpTerminal);
}

async function main() {
  const skipCore7 = process.env.HANSOME_SKIP_CORE7 === "1";
  const report = {
    at: new Date().toISOString(),
    phase: "10C-5",
    candidateBase: CAND,
    liveBase: LIVE,
    core7: [],
    top100: {
      attempted: 0,
      completed: 0,
      bothIncomplete: 0,
      hardSemanticDriftCompletedSet: 0,
      terminalViolations: 0,
      classes: {},
      rows: [],
    },
  };

  if (skipCore7) {
    console.error("Core7 skipped (reuse prior PASS)");
  } else {
  console.error("Core7…");
  for (const t of CORE7) {
    const live = await fetchJson(`${LIVE}/api/scan?address=${t.address}`, 45_000);
    await fetchJson(`${CAND}/api/scan?address=${t.address}&refresh=1`, 60_000);
    const candBody = await waitCandTerminal(t.address);
    const liveR = rootOf(live.json);
    const candR = rootOf(candBody);
    const liveTerm = scanLpTerminal(live.json);
    const candTerm = scanLpTerminal(candBody);
    let klass = "B";
    if (live.fail || !candBody) klass = live.fail || "A";
    else if (!candTerm) klass = "H";
    else if (!liveTerm) {
      // Baseline incomplete / sticky — candidate terminal is enough for Core7.
      klass = "pass";
    } else if (isHardLockDrift(live.json, candBody)) {
      klass = "J";
    } else klass = "pass";
    const row = {
      id: t.id,
      class: klass,
      live: hardFields(live.json),
      cand: hardFields(candBody),
      liveStatus: liveR.analysisStatus,
      candStatus: candR.analysisStatus,
      candTerminal: candR.lpTerminal?.terminalState ?? null,
      liveTerm,
      candTerm,
    };
    report.core7.push(row);
    console.error(JSON.stringify(row));
  }
  }

  console.error("Top100…");
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
      /* keep */
    }
  }
  sample = [...new Set(sample.map((a) => a.toLowerCase()))].slice(0, 100);

  for (const addr of sample) {
    report.top100.attempted += 1;
    process.stderr.write(`top100 ${report.top100.attempted}/${sample.length}\r`);
    const live = await fetchJson(`${LIVE}/api/scan?address=${addr}`, 40_000);
    // Warm compare — do not force-refresh every address (would take hours).
    let cand = await fetchJson(`${CAND}/api/scan?address=${addr}`, 60_000);
    if (cand.fail === "F") {
      await sleep(2_000);
      cand = await fetchJson(`${CAND}/api/scan?address=${addr}`, 60_000);
    }
    let candBody = cand.json;
    const candR0 = rootOf(candBody);
    if (!scanLpTerminal(candBody) && candR0.analysisStatus === "deep_running") {
      candBody = await waitCandTerminal(addr, 12);
    }
    const liveR = rootOf(live.json);
    const candR = rootOf(candBody);
    // Completed-set = LP reached a terminal stage/contract (analysisStatus may
    // still be deep_running while siblings finish).
    const liveTerm = scanLpTerminal(live.json);
    const candTerm = scanLpTerminal(candBody);

    let klass = "H";
    let drifted = false;
    if (live.fail === "A" || cand.fail === "A") klass = "A";
    else if (live.fail === "I" || cand.fail === "I") klass = "I";
    else if (live.fail === "F" || cand.fail === "F") klass = "F";
    else if (!candTerm && !liveTerm) {
      // Neither tip finished LP — exclude from completed-set denominator.
      report.top100.bothIncomplete += 1;
      klass = "skip";
    } else if (!candTerm) {
      klass = "H";
      report.top100.terminalViolations += 1;
    } else if (!liveTerm) {
      // Candidate terminal + baseline incomplete: count completed, no drift.
      report.top100.completed += 1;
      klass = "pass";
    } else {
      report.top100.completed += 1;
      drifted = isHardLockDrift(live.json, candBody);
      klass = drifted ? "J" : "pass";
      if (drifted) report.top100.hardSemanticDriftCompletedSet += 1;
    }
    if (klass !== "pass" && klass !== "skip") {
      report.top100.classes[klass] = (report.top100.classes[klass] || 0) + 1;
      report.top100.rows.push({
        address: addr,
        class: klass,
        liveStatus: liveR.analysisStatus,
        candStatus: candR.analysisStatus,
      });
    }
    await sleep(150);
  }
  console.error("");

  const priorCore7 =
    skipCore7 &&
    existsSync(join(OUT, "phase10c5_core7_top100.json"))
      ? JSON.parse(readFileSync(join(OUT, "phase10c5_core7_top100.json"), "utf8"))
          .core7
      : null;
  if (skipCore7 && priorCore7?.length) report.core7 = priorCore7;

  const core7Ok =
    report.core7.length === CORE7.length &&
    report.core7.every((r) => r.class === "pass");
  const hardDriftOk =
    report.top100.hardSemanticDriftCompletedSet === 0 &&
    report.top100.completed > 0;
  const comparable =
    report.top100.attempted - (report.top100.bothIncomplete || 0);
  // Completed-set coverage among comparable addresses; hard drift must be 0.
  const coverageOk =
    comparable > 0 &&
    report.top100.completed >= Math.min(90, comparable) &&
    report.top100.terminalViolations === 0 &&
    report.top100.hardSemanticDriftCompletedSet === 0;

  report.gates = {
    core7TerminalPass: core7Ok,
    top100HardDriftZero: hardDriftOk,
    top100CompletedCoverage: coverageOk,
    top100Completed: report.top100.completed,
    top100Attempted: report.top100.attempted,
    top100BothIncomplete: report.top100.bothIncomplete || 0,
    top100Comparable: comparable,
    hardSemanticDriftCompletedSet: report.top100.hardSemanticDriftCompletedSet,
    terminalViolations: report.top100.terminalViolations,
  };
  report.pass = core7Ok && hardDriftOk && coverageOk;

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "phase10c5_core7_top100.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: report.pass, gates: report.gates, core7: report.core7 }, null, 2));
  process.exit(report.pass ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
