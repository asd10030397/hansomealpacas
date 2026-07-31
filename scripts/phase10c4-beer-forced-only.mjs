#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "reports", "data");
const BEER = "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804";
const PONS = "0x736D76699C26D0d966744cAe304C000d471f7F35";
const BASE = "https://hansomealpacas.vercel.app";
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
      fail: !res.ok || json == null ? "I" : null,
      json,
      denied: json?.cache?.refreshDenied === true,
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
    status: root.analysisStatus,
    stages: root.analysisStages,
    lpPublish: root.lpPublish,
    scope: root.cache?.deploymentScope,
    tokenId: locked[0]?.positionNftId ?? null,
    lockState: locked[0]?.lockState ?? null,
    owner: locked[0]?.owner ?? null,
    lockerName: locked[0]?.lockerName ?? null,
    positionDiscoveryComplete:
      lp.uniswapVersions?.byVersion?.v3?.positionDiscoveryComplete ?? null,
    lockAnalysisComplete:
      lp.uniswapVersions?.byVersion?.v3?.lockAnalysisComplete ?? null,
    detail: `${lp.detail || ""}`,
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

async function oneForced(i) {
  console.error(`forced ${i}/3…`);
  let refresh;
  for (let attempt = 0; attempt < 3; attempt++) {
    refresh = await fetchJson(
      `${BASE}/api/scan?address=${BEER}&refresh=1&forceLp=1`,
      90_000,
    );
    if (refresh.denied) {
      console.error("refresh denied — wait 65s");
      await sleep(65_000);
      continue;
    }
    break;
  }
  const t0 = Date.now();
  const maxMs = 300_000;
  while (Date.now() - t0 < maxMs) {
    const s = await fetchJson(`${BASE}/api/scan/status?address=${BEER}`, 45_000);
    const body = s.json?.result || s.json;
    const st = body?.analysisStages?.liquidity;
    const status = body?.analysisStatus;
    const detail = body?.overview?.lpIntelligence?.detail || "";
    if (
      /LP evidence cleared/i.test(detail) ||
      st === "analyzing" ||
      status === "deep_running"
    ) {
      await sleep(8_000);
      continue;
    }
    if (
      st === "done" ||
      st === "partial" ||
      status === "complete" ||
      status === "partial"
    ) {
      const full = await fetchJson(`${BASE}/api/scan?address=${BEER}`, 60_000);
      const final = extract(full.json);
      if (!passExact(final) && Date.now() - t0 < maxMs - 15_000) {
        await sleep(8_000);
        continue;
      }
      return {
        i,
        ok: passExact(final),
        lpGeneration: final.lpPublish?.lpGeneration ?? null,
        lockState: final.lockState,
        tokenId: final.tokenId,
        owner: final.owner,
        positionDiscoveryComplete: final.positionDiscoveryComplete,
        lockAnalysisComplete: final.lockAnalysisComplete,
        scope: final.scope,
        detail: (final.detail || "").slice(0, 160),
        refreshDenied: refresh?.denied === true,
      };
    }
    await sleep(8_000);
  }
  return { i, ok: false, fail: "H" };
}

async function main() {
  console.error("Pre-forced cooldown 65s…");
  await sleep(65_000);
  const runs = [];
  for (let i = 1; i <= 3; i++) {
    if (i > 1) {
      console.error("cooldown 65s…");
      await sleep(65_000);
    }
    const row = await oneForced(i);
    runs.push(row);
    console.error(JSON.stringify(row));
    if (!row.ok) break;
  }
  const gens = runs.map((r) => r.lpGeneration).filter(Boolean);
  const unique = [...new Set(gens)];
  const report = {
    at: new Date().toISOString(),
    forced: {
      pass: runs.length === 3 && runs.every((r) => r.ok) && unique.length === 3,
      uniqueGenerations: unique,
      runs,
    },
  };
  mkdirSync(OUT, { recursive: true });
  const prevPath = join(OUT, "phase10c4_beer_repeat.json");
  const prev = existsSync(prevPath)
    ? JSON.parse(readFileSync(prevPath, "utf8"))
    : {};
  const merged = {
    ...prev,
    forced: report.forced,
    pass: prev.cold?.pass && prev.warm?.pass && report.forced.pass,
    forcedOnlyAt: report.at,
  };
  writeFileSync(prevPath, JSON.stringify(merged, null, 2));
  writeFileSync(join(OUT, "phase10c4_beer_forced.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(merged, null, 2));
  process.exit(merged.pass ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
