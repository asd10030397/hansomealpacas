#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "reports", "data");
const BEER = "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804";
const PONS = "0x736D76699C26D0d966744cAe304C000d471f7F35";
const BASE = process.env.HANSOME_GATE_BASE || "https://hansomealpacas.vercel.app";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
      scope: res.headers.get("x-scan-deployment-scope"),
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
  return {
    lpPublish: root.lpPublish,
    lpTerminal: root.lpTerminal,
    tokenId: locked[0]?.positionNftId ?? null,
    lockState: locked[0]?.lockState ?? null,
    owner: locked[0]?.owner ?? null,
    positionDiscoveryComplete:
      lp.uniswapVersions?.byVersion?.v3?.positionDiscoveryComplete ?? null,
    lockAnalysisComplete:
      lp.uniswapVersions?.byVersion?.v3?.lockAnalysisComplete ?? null,
    detail: `${lp.detail || ""}`,
    scope: root.cache?.deploymentScope,
  };
}

function passExact(f) {
  return (
    f?.lockState === "LOCKED_VERIFIED_ONCHAIN" &&
    String(f.tokenId) === "436637" &&
    (f.owner || "").toLowerCase() === PONS.toLowerCase() &&
    f.positionDiscoveryComplete === true &&
    f.lockAnalysisComplete === true &&
    !!f.lpPublish?.lpGeneration &&
    !/LP evidence cleared/i.test(f.detail || "")
  );
}

async function waitLocked(opts = {}) {
  const maxMs = opts.maxMs ?? 300_000;
  const rejectGeneration = opts.rejectGeneration ?? null;
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const full = await fetchJson(`${BASE}/api/scan?address=${BEER}`, 60_000);
    const root = full.json?.result || full.json || {};
    const f = extract(full.json);
    const st =
      root.analysisStages?.liquidity || full.json?.analysisStages?.liquidity;
    const gen = f.lpPublish?.lpGeneration ?? null;
    const term = f.lpTerminal?.terminalState;
    const cleared = /LP evidence cleared/i.test(f.detail || "");
    const staleReuse =
      rejectGeneration && gen && gen === rejectGeneration;

    // Force/cold must mint a new published generation — ignore sticky prior Locked.
    // Require SUCCESS_TERMINAL (do not early-return on gen match while still RUNNING).
    if (passExact(f) && !staleReuse && term === "SUCCESS_TERMINAL") {
      return f;
    }
    if (
      cleared ||
      st === "analyzing" ||
      term === "NEW" ||
      term === "RUNNING" ||
      term === "PUBLISHING" ||
      staleReuse
    ) {
      await sleep(8_000);
      continue;
    }
    if (term === "FAILED_TERMINAL" || st === "unknown" || st === "partial") {
      return f;
    }
    if (st === "done" && passExact(f) && !staleReuse) return f;
    await sleep(8_000);
  }
  return { fail: "H" };
}

async function main() {
  const cold = [];
  let priorGen = null;
  {
    const peek = await fetchJson(`${BASE}/api/scan?address=${BEER}`, 45_000);
    priorGen = extract(peek.json).lpPublish?.lpGeneration ?? null;
  }
  for (let i = 1; i <= 3; i++) {
    console.error(`cold ${i}/3…`);
    if (i > 1) await sleep(65_000);
    let denied = false;
    let refreshBody = null;
    for (let a = 0; a < 3; a++) {
      const r = await fetchJson(
        `${BASE}/api/scan?address=${BEER}&refresh=1&forceLp=1`,
        90_000,
      );
      denied = r.denied;
      refreshBody = r.json;
      if (!denied) break;
      await sleep(65_000);
    }
    const armedGen =
      refreshBody?.result?.deepAttemptId ||
      refreshBody?.deepAttemptId ||
      null;
    const f = await waitLocked({
      rejectGeneration: priorGen,
      maxMs: 360_000,
    });
    const row = {
      i,
      ok:
        passExact(f) &&
        f.lpPublish?.lpGeneration &&
        f.lpPublish.lpGeneration !== priorGen &&
        (f.lpTerminal?.terminalState === "SUCCESS_TERMINAL" ||
          f.lpPublish.lpGeneration === armedGen ||
          true),
      lpGeneration: f.lpPublish?.lpGeneration ?? null,
      lockState: f.lockState,
      terminalState: f.lpTerminal?.terminalState ?? null,
      armedGen,
      scope: f.scope,
      denied,
    };
    // Require SUCCESS_TERMINAL for cold reconfirm on 10C-5 tip.
    row.ok =
      passExact(f) &&
      !!row.lpGeneration &&
      row.lpGeneration !== priorGen &&
      f.lpTerminal?.terminalState === "SUCCESS_TERMINAL";
    if (row.ok) priorGen = row.lpGeneration;
    cold.push(row);
    console.error(JSON.stringify(row));
    if (!row.ok) break;
  }

  const warm = [];
  for (let i = 1; i <= 3; i++) {
    console.error(`warm ${i}/3…`);
    const full = await fetchJson(`${BASE}/api/scan?address=${BEER}`, 60_000);
    const f = extract(full.json);
    const row = {
      i,
      ok: passExact(f),
      lpGeneration: f.lpPublish?.lpGeneration ?? null,
      lockState: f.lockState,
      terminalState: f.lpTerminal?.terminalState ?? null,
      scope: f.scope,
    };
    warm.push(row);
    console.error(JSON.stringify(row));
    await sleep(2_000);
  }

  const coldGens = [...new Set(cold.map((r) => r.lpGeneration).filter(Boolean))];
  const report = {
    at: new Date().toISOString(),
    phase: "10C-5",
    base: BASE,
    cold: {
      pass: cold.length === 3 && cold.every((r) => r.ok) && coldGens.length === 3,
      uniqueGenerations: coldGens,
      runs: cold,
    },
    warm: {
      pass: warm.length === 3 && warm.every((r) => r.ok),
      runs: warm,
    },
  };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "phase10c5_beer_cold_warm.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.cold.pass && report.warm.pass ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
