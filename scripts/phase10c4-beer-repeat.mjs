#!/usr/bin/env node
/**
 * Phase 10C-4 — BEER repeated gate only (3 cold / 3 warm / 3 forced).
 * Writes progress after each run (unbuffered).
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "reports", "data");
const BEER = "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804";
const PONS = "0x736D76699C26D0d966744cAe304C000d471f7F35";
const BASE = "https://hansomealpacas.vercel.app";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(...a) {
  console.error(...a);
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
      ok: res.ok,
      status: res.status,
      isHtml,
      json,
      scope: res.headers.get("x-scan-deployment-scope"),
      fail: !res.ok
        ? res.status === 401 || res.status === 403 || isHtml
          ? "A"
          : "I"
        : isHtml
          ? "A"
          : json == null
            ? "I"
            : null,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      isHtml: false,
      json: null,
      scope: null,
      fail: e?.name === "AbortError" ? "F" : "I",
      error: String(e?.message || e).slice(0, 120),
    };
  } finally {
    clearTimeout(t);
  }
}

function extract(j) {
  const root = j?.result || j || {};
  const lp = root?.overview?.lpIntelligence || {};
  const pos = lp.positions || [];
  const locked = pos.filter((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN");
  const detail = `${lp.detail || ""} ${lp.completenessWarning || ""}`;
  return {
    status: root.analysisStatus,
    stages: root.analysisStages,
    deepAttemptId: root.deepAttemptId,
    lpPublish: root.lpPublish,
    scope: root.cache?.deploymentScope || j?.deploymentScope,
    tokenId: locked[0]?.positionNftId ?? null,
    lockState: locked[0]?.lockState ?? null,
    owner: locked[0]?.owner ?? null,
    lockerName: locked[0]?.lockerName ?? null,
    liquidity: locked[0]?.liquidity ?? null,
    tickLower: locked[0]?.tickLower ?? null,
    tickUpper: locked[0]?.tickUpper ?? null,
    positionDiscoveryComplete:
      lp.uniswapVersions?.byVersion?.v3?.positionDiscoveryComplete ?? null,
    lockAnalysisComplete:
      lp.uniswapVersions?.byVersion?.v3?.lockAnalysisComplete ?? null,
    staleTimeoutDetail:
      locked.length === 0 &&
      /did not finish in time|probe budget exceeded/i.test(detail),
    detail: detail.slice(0, 200),
  };
}

function passExact(f) {
  return (
    f &&
    f.lockState === "LOCKED_VERIFIED_ONCHAIN" &&
    String(f.tokenId) === "436637" &&
    (f.owner || "").toLowerCase() === PONS.toLowerCase() &&
    (!f.lockerName || f.lockerName === "PonsLaunchLocker") &&
    !f.staleTimeoutDetail &&
    f.positionDiscoveryComplete === true &&
    f.lockAnalysisComplete === true &&
    !!f.lpPublish?.lpGeneration
  );
}

async function waitTerminal({ refresh, force, maxMs = 300_000 }) {
  if (refresh) {
    const q = force
      ? `${BASE}/api/scan?address=${BEER}&refresh=1&forceLp=1`
      : `${BASE}/api/scan?address=${BEER}&refresh=1`;
    const r = await fetchJson(q, 90_000);
    if (r.fail) return { ok: false, fail: r.fail, final: null };
  }
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await fetchJson(`${BASE}/api/scan/status?address=${BEER}`, 45_000);
    if (s.fail) return { ok: false, fail: s.fail, final: extract(s.json) };
    const st = s.json?.analysisStages?.liquidity;
    const status = s.json?.analysisStatus;
    const clearedPending =
      typeof (s.json?.result?.overview?.lpIntelligence?.detail ||
        s.json?.overview?.lpIntelligence?.detail) === "string" &&
      /LP evidence cleared/i.test(
        s.json?.result?.overview?.lpIntelligence?.detail ||
          s.json?.overview?.lpIntelligence?.detail ||
          "",
      );
    const liqRunning = st === "analyzing" || st === "pending";
    const deepRunning = status === "deep_running" || status === "fast_ready";
    // Keep polling while force-refresh cleared body is still pending republish.
    if (clearedPending || liqRunning || deepRunning) {
      await sleep(8_000);
      continue;
    }
    if (
      st === "done" ||
      st === "partial" ||
      st === "unknown" ||
      status === "complete" ||
      status === "partial"
    ) {
      const full = await fetchJson(`${BASE}/api/scan?address=${BEER}`, 60_000);
      const final = extract(full.json);
      const ok = passExact(final) && !full.fail;
      if (!ok && Date.now() - t0 < maxMs - 15_000) {
        await sleep(8_000);
        continue;
      }
      return {
        ok,
        fail: full.fail || (ok ? null : final?.staleTimeoutDetail ? "B" : "J"),
        final,
      };
    }
    await sleep(8_000);
  }
  return { ok: false, fail: "H", final: null };
}

function save(report) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "phase10c4_beer_repeat.json"), JSON.stringify(report, null, 2));
}

async function series(name, n, opts) {
  const runs = [];
  // SCAN_REFRESH_ADDR_COOLDOWN_MS = 60s — wait so refresh is not denied.
  const gapMs = opts.refresh ? 65_000 : 1_500;
  for (let i = 1; i <= n; i++) {
    if (i > 1 && gapMs > 2_000) log(`${name}: waiting ${gapMs}ms for refresh cooldown…`);
    if (i > 1) await sleep(gapMs);
    log(`${name} ${i}/${n}…`);
    const r = await waitTerminal(opts);
    const row = {
      i,
      ok: r.ok,
      fail: r.fail,
      lockState: r.final?.lockState,
      tokenId: r.final?.tokenId,
      owner: r.final?.owner,
      positionDiscoveryComplete: r.final?.positionDiscoveryComplete,
      lockAnalysisComplete: r.final?.lockAnalysisComplete,
      lpGeneration: r.final?.lpPublish?.lpGeneration,
      scope: r.final?.scope,
      staleTimeoutDetail: r.final?.staleTimeoutDetail,
      detail: r.final?.detail,
    };
    runs.push(row);
    log(JSON.stringify(row));
    if (!r.ok) break;
  }
  const gens = runs.map((r) => r.lpGeneration).filter(Boolean);
  const uniqueGens = new Set(gens);
  // Forced / cold refresh series should mint new generations when forceLp clears.
  const genOk =
    !opts.force || uniqueGens.size === runs.length || runs.length <= 1;
  return {
    pass: runs.length === n && runs.every((x) => x.ok) && genOk,
    uniqueGenerations: [...uniqueGens],
    runs,
  };
}

async function main() {
  const cfgPath = join(OUT, "phase10c4_candidate.json");
  const cfg = existsSync(cfgPath)
    ? JSON.parse(readFileSync(cfgPath, "utf8"))
    : {};
  const report = {
    at: new Date().toISOString(),
    candidateId: cfg.deploymentId,
    base: BASE,
    cold: null,
    warm: null,
    forced: null,
  };
  save(report);

  // Cold-isolated: forceLp clears published body + re-arms multi-version in
  // candidate namespace (empty of Production sticky LP).
  report.cold = await series("cold", 3, { refresh: true, force: true });
  save(report);
  if (!report.cold.pass) {
    log("COLD FAIL — stop");
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }

  report.warm = await series("warm", 3, { refresh: false, force: false });
  save(report);
  if (!report.warm.pass) {
    log("WARM FAIL — stop");
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }

  log("Pre-forced cooldown 65s (avoid refresh denial after cold)…");
  await sleep(65_000);
  report.forced = await series("forced", 3, { refresh: true, force: true });
  save(report);

  report.pass =
    report.cold.pass && report.warm.pass && report.forced.pass;
  save(report);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
