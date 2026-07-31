#!/usr/bin/env node
/**
 * Phase 10C-5 — BEER forced-refresh 10/10 terminal + LOCKED_VERIFIED_ONCHAIN gate.
 * Requires temp alias → candidate tip. Never promotes www/game.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "reports", "data");
const BEER = "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804";
const PONS = "0x736D76699C26D0d966744cAe304C000d471f7F35";
const BASELINE_TIP = "dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7";
const BASE = process.env.HANSOME_GATE_BASE || "https://hansomealpacas.vercel.app";
const FORCED_N = Number(process.env.HANSOME_FORCE_N || 10);
const COOLDOWN_MS = Number(process.env.HANSOME_FORCE_COOLDOWN_MS || 65_000);
const MAX_WAIT_MS = Number(process.env.HANSOME_FORCE_WAIT_MS || 360_000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadCfg() {
  const p = join(OUT, "phase10c5_candidate.json");
  if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  const fallback = join(OUT, "phase10c4_candidate.json");
  if (existsSync(fallback)) return JSON.parse(readFileSync(fallback, "utf8"));
  return {};
}

async function fetchJson(url, timeoutMs = 60_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return {
      ok: res.ok && json != null,
      denied: json?.cache?.refreshDenied === true,
      json,
      scopeHdr: res.headers.get("x-scan-deployment-scope"),
      status: res.status,
      isHtml: text.trimStart().startsWith("<!DOCTYPE"),
    };
  } finally {
    clearTimeout(t);
  }
}

function extract(j) {
  const root = j?.result || j || {};
  const lp = root?.overview?.lpIntelligence || {};
  const locked = (lp.positions || []).filter(
    (p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN",
  );
  const term = root.lpTerminal || null;
  return {
    status: root.analysisStatus,
    stages: root.analysisStages,
    lpPublish: root.lpPublish,
    lpTerminal: term,
    scope: root.cache?.deploymentScope,
    tokenId: locked[0]?.positionNftId ?? null,
    lockState: locked[0]?.lockState ?? null,
    owner: locked[0]?.owner ?? null,
    positionDiscoveryComplete:
      lp.uniswapVersions?.byVersion?.v3?.positionDiscoveryComplete ?? null,
    lockAnalysisComplete:
      lp.uniswapVersions?.byVersion?.v3?.lockAnalysisComplete ?? null,
    detail: `${lp.detail || ""}`,
    liquidityStage: root.analysisStages?.liquidity ?? null,
  };
}

function isHardTerminal(f) {
  const ts = f?.lpTerminal?.terminalState;
  if (ts === "SUCCESS_TERMINAL" || ts === "FAILED_TERMINAL") return true;
  // Fallback: published Locked with done liquidity counts as success terminal.
  if (
    f?.lockState === "LOCKED_VERIFIED_ONCHAIN" &&
    f?.lpPublish?.lpGeneration &&
    (f.liquidityStage === "done" || f.status === "complete")
  ) {
    return true;
  }
  return false;
}

function isPartialTerminal(f) {
  if (f?.lpTerminal?.terminalState === "SUCCESS_TERMINAL") return false;
  if (f?.lpTerminal?.terminalState === "FAILED_TERMINAL") return false;
  if (f?.liquidityStage === "partial") return true;
  if (f?.status === "partial" && f?.liquidityStage !== "done") return true;
  return false;
}

function passLocked(f) {
  return (
    f?.lockState === "LOCKED_VERIFIED_ONCHAIN" &&
    String(f.tokenId) === "436637" &&
    (f.owner || "").toLowerCase() === PONS.toLowerCase() &&
    f.positionDiscoveryComplete === true &&
    f.lockAnalysisComplete === true &&
    !!f.lpPublish?.lpGeneration &&
    !/LP evidence cleared/i.test(f.detail || "") &&
    isHardTerminal(f) &&
    !isPartialTerminal(f)
  );
}

async function waitTerminal() {
  const t0 = Date.now();
  while (Date.now() - t0 < MAX_WAIT_MS) {
    const s = await fetchJson(`${BASE}/api/scan/status?address=${BEER}`, 45_000);
    const body = s.json?.result || s.json;
    const f = extract(body);
    const detail = f.detail || "";
    const st = f.liquidityStage;
    const status = f.status;
    const ts = f.lpTerminal?.terminalState;

    // Hard terminals win even while overall analysisStatus remains deep_running.
    if (ts === "SUCCESS_TERMINAL" || ts === "FAILED_TERMINAL") {
      const full = await fetchJson(`${BASE}/api/scan?address=${BEER}`, 60_000);
      const out = extract(full.json);
      if (s.scopeHdr && !out.scope) out.scope = s.scopeHdr;
      return out;
    }

    if (
      /LP evidence cleared/i.test(detail) ||
      st === "analyzing" ||
      status === "deep_running" ||
      ts === "NEW" ||
      ts === "RUNNING" ||
      ts === "PUBLISHING" ||
      body == null
    ) {
      await sleep(8_000);
      continue;
    }
    if (
      st === "unknown" ||
      st === "partial" ||
      status === "partial" ||
      status === "failed"
    ) {
      const full = await fetchJson(`${BASE}/api/scan?address=${BEER}`, 60_000);
      return extract(full.json);
    }
    await sleep(8_000);
  }
  return { fail: "H", status: "timeout" };
}

async function oneForced(i) {
  console.error(`forced ${i}/${FORCED_N}…`);
  const maxRound = 2;
  let row = null;
  for (let round = 1; round <= maxRound; round++) {
    let refresh;
    for (let attempt = 0; attempt < 4; attempt++) {
      refresh = await fetchJson(
        `${BASE}/api/scan?address=${BEER}&refresh=1&forceLp=1`,
        90_000,
      );
      if (refresh.denied) {
        console.error("refresh denied — wait cooldown");
        await sleep(COOLDOWN_MS);
        continue;
      }
      break;
    }
    const final = await waitTerminal();
    const ok = passLocked(final);
    row = {
      i,
      ok,
      hardTerminal: isHardTerminal(final),
      partialTerminal: isPartialTerminal(final),
      terminalState: final.lpTerminal?.terminalState ?? null,
      terminalReason: final.lpTerminal?.terminalReason ?? null,
      lpGeneration: final.lpPublish?.lpGeneration ?? null,
      lockState: final.lockState,
      tokenId: final.tokenId,
      owner: final.owner,
      positionDiscoveryComplete: final.positionDiscoveryComplete,
      lockAnalysisComplete: final.lockAnalysisComplete,
      liquidityStage: final.liquidityStage,
      status: final.status,
      scope: final.scope ?? refresh?.scopeHdr ?? null,
      detail: (final.detail || "").slice(0, 160),
      refreshDenied: refresh?.denied === true,
      retryRound: round,
      fail: final.fail || (!ok ? (isPartialTerminal(final) ? "PARTIAL" : "J") : null),
    };
    console.error(JSON.stringify(row));
    if (ok && row.hardTerminal && !row.partialTerminal) return row;
    if (round < maxRound && (final.fail === "H" || !ok)) {
      console.error(`forced ${i} round ${round} failed — retry after cooldown`);
      await sleep(COOLDOWN_MS);
      continue;
    }
  }
  return row;
}

async function main() {
  const cfg = loadCfg();
  console.error(
    JSON.stringify({
      base: BASE,
      candidate: cfg.deploymentId || null,
      baseline: cfg.baselineTip || BASELINE_TIP,
      n: FORCED_N,
    }),
  );

  // Probe JSON access
  const probe = await fetchJson(`${BASE}/api/scan?address=${BEER}`, 45_000);
  if (!probe.ok || probe.isHtml) {
    console.error("temp alias JSON access failed — abort");
    process.exit(3);
  }

  console.error(`Pre-forced cooldown ${COOLDOWN_MS}ms…`);
  await sleep(COOLDOWN_MS);

  const runs = [];
  for (let i = 1; i <= FORCED_N; i++) {
    if (i > 1) {
      console.error(`cooldown ${COOLDOWN_MS}ms…`);
      await sleep(COOLDOWN_MS);
    }
    const row = await oneForced(i);
    runs.push(row);
    if (!row.ok || row.partialTerminal || !row.hardTerminal) {
      console.error("gate break — non-PASS forced run");
      break;
    }
  }

  const gens = runs.map((r) => r.lpGeneration).filter(Boolean);
  const unique = [...new Set(gens)];
  const pass =
    runs.length === FORCED_N &&
    runs.every((r) => r.ok && r.hardTerminal && !r.partialTerminal) &&
    unique.length === FORCED_N;

  const report = {
    at: new Date().toISOString(),
    phase: "10C-5",
    base: BASE,
    candidateId: cfg.deploymentId || null,
    baselineTip: cfg.baselineTip || BASELINE_TIP,
    forced: {
      n: FORCED_N,
      pass,
      uniqueGenerations: unique,
      uniqueCount: unique.length,
      terminalCount: runs.filter((r) => r.hardTerminal).length,
      lockedCount: runs.filter((r) => r.lockState === "LOCKED_VERIFIED_ONCHAIN")
        .length,
      partialTerminalCount: runs.filter((r) => r.partialTerminal).length,
      runs,
    },
  };

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "phase10c5_beer_forced10.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(pass ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
