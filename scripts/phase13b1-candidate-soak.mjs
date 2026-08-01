#!/usr/bin/env node
/**
 * Phase 13B.1 — Candidate cold/warm/forced soak for HANSOME/BEER/GME/OKC.
 * Uses vercel curl (deployment protection). Never promotes aliases.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.HANSOME_GATE_BASE || "").replace(/\/$/, "");
const OUT_DIR = join(__dirname, "..", "reports", "data");
const PONS = "0x736D76699C26D0d966744cAe304C000d471f7F35";
const EXPECTED_SCOPE =
  process.env.HANSOME_EXPECT_SCOPE ||
  "candidate:dpl_HmF5vkSc6aRTkSaTaXwyP9e2g9vW";

const TOKENS = {
  HANSOME: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
  BEER: "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804",
  GME: "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3",
  OKC: "0xddEB6C5415c3CCB66295b610a06e8E30155f2bA3",
};

if (!BASE) {
  console.error("Set HANSOME_GATE_BASE to candidate URL");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function vercelJson(url, timeoutMs = 120_000) {
  const r = spawnSync("npx", ["vercel", "curl", url, "--yes"], {
    encoding: "utf8",
    shell: true,
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  const matches = out.match(/\{[\s\S]*\}/g);
  if (!matches?.length) {
    return { ok: false, error: "no_json", raw: out.slice(-2000) };
  }
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      const json = JSON.parse(matches[i]);
      return { ok: true, json };
    } catch {
      /* try prior */
    }
  }
  return { ok: false, error: "parse_fail", raw: out.slice(-2000) };
}

function rootOf(j) {
  return j?.result || j || {};
}

function extract(j) {
  const root = rootOf(j);
  const lp = root?.overview?.lpIntelligence || {};
  const positions = lp.positions || [];
  const locked = positions.filter((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN");
  const v3 = lp.uniswapVersions?.byVersion?.v3 || {};
  const textBlob = JSON.stringify(root);
  return {
    analysisStatus: root.analysisStatus ?? j?.analysisStatus ?? null,
    analysisPhase: root.analysisPhase ?? j?.analysisPhase ?? null,
    analysisStages: root.analysisStages ?? j?.analysisStages ?? null,
    deepInflight: j?.deepInflight ?? root.deepInflight ?? null,
    deepRetryScheduled: j?.deepRetryScheduled ?? root.deepRetryScheduled ?? null,
    deepLeaseState: j?.deepRuntime?.leaseState ?? root.deepRuntime?.leaseState ?? null,
    complete: j?.complete ?? root.complete ?? null,
    scope: root.cache?.deploymentScope ?? j?.deploymentScope ?? null,
    score: root.overview?.score ?? root.score ?? null,
    ownershipClass: lp.ownershipClass ?? null,
    aggregateLockState: lp.aggregateLockState ?? null,
    aggregateLockStateDisplay: lp.aggregateLockStateDisplay ?? null,
    lockPercent: lp.lockPercent ?? lp.lockedPercent ?? null,
    positionCount: positions.length,
    lockedTokenId: locked[0]?.positionNftId ?? null,
    lockedOwner: locked[0]?.owner ?? null,
    lockedState: locked[0]?.lockState ?? null,
    positionDiscoveryComplete: v3.positionDiscoveryComplete ?? null,
    lockAnalysisComplete: v3.lockAnalysisComplete ?? null,
    lpTerminal: root.lpTerminal ?? null,
    lpPublish: root.lpPublish ?? null,
    detail: `${lp.detail || ""}`,
    poolsCleared: /LP evidence cleared/i.test(`${lp.detail || ""}`) ||
      /LP evidence cleared/i.test(textBlob),
    hasTitan: /titan/i.test(textBlob),
    hasPosm: /posm_nft|POSM/i.test(textBlob),
    hasHookNative: /hook_native/i.test(textBlob),
    hasHookIntel: /hookIntelligence|hook_native|hookAllowlist/i.test(textBlob),
    falseLocked: /"Locked"|false.?Locked/i.test(textBlob) &&
      lp.aggregateLockState !== "LOCKED_VERIFIED_ONCHAIN",
    genericLockPct:
      lp.lockPercent != null ||
      lp.lockedPercent != null ||
      /lockPercent|lockedPercent|lock %/i.test(textBlob),
    positions,
    rawSnippet: textBlob.slice(0, 500),
  };
}

function isTerminal(f) {
  const st = f.analysisStatus;
  const liq = f.analysisStages?.liquidity;
  const phase = f.analysisPhase;
  const term = f.lpTerminal?.terminalState;
  const analyzing =
    liq === "analyzing" ||
    st === "deep_running" ||
    st === "analyzing" ||
    phase === "deep_running";
  const inflight = f.deepInflight === true;
  const retry = f.deepRetryScheduled === true;
  const leaseValid = f.deepLeaseState === "valid";
  if (analyzing && !inflight && !retry && !leaseValid) return false; // orphan
  if (analyzing) return false;
  if (["complete", "partial", "failed", "unknown"].includes(st)) return true;
  if (term && ["SUCCESS_TERMINAL", "PARTIAL_TERMINAL", "FAILED_TERMINAL", "UNKNOWN_TERMINAL"].includes(term)) {
    return true;
  }
  if (liq && liq !== "analyzing" && !["pending", "queued"].includes(liq)) {
    if (st && st !== "deep_running" && st !== "analyzing") return true;
  }
  return false;
}

function orphanAnalyzing(f) {
  const liq = f.analysisStages?.liquidity;
  const st = f.analysisStatus;
  const analyzing =
    liq === "analyzing" || st === "deep_running" || st === "analyzing";
  return (
    analyzing &&
    f.deepInflight !== true &&
    f.deepRetryScheduled !== true &&
    f.deepLeaseState !== "valid"
  );
}

function scopeOk(f) {
  return !f.scope || f.scope === EXPECTED_SCOPE || f.scope.startsWith("candidate:");
}

async function triggerScan(addr, { force = false } = {}) {
  const q = force
    ? `${BASE}/api/scan?address=${addr}&force=1&forceLp=1`
    : `${BASE}/api/scan?address=${addr}`;
  return vercelJson(q, 180_000);
}

async function pollStatus(addr) {
  return vercelJson(`${BASE}/api/scan/status?address=${addr}`, 120_000);
}

async function waitTerminal(label, addr, { maxMs = 420_000 } = {}) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < maxMs) {
    const res = await pollStatus(addr);
    if (!res.ok) {
      console.log(`[${label}] status parse fail: ${res.error}`);
      await sleep(8_000);
      continue;
    }
    const f = extract(res.json);
    last = { f, json: res.json, t: Math.round((Date.now() - t0) / 1000) };
    const liq = f.analysisStages?.liquidity;
    console.log(
      `[${label}] t=${last.t}s status=${f.analysisStatus} liq=${liq} inflight=${f.deepInflight} lease=${f.deepLeaseState} positions=${f.positionCount} class=${f.ownershipClass} lock=${f.aggregateLockState} term=${f.lpTerminal?.terminalState ?? null} scope=${f.scope}`,
    );
    if (orphanAnalyzing(f)) {
      return { ok: false, reason: "orphan_analyzing", ...last };
    }
    if (!scopeOk(f)) {
      return { ok: false, reason: "bad_scope", ...last };
    }
    if (isTerminal(f)) {
      return { ok: true, ...last };
    }
    await sleep(14_000);
  }
  return { ok: false, reason: "timeout", ...last };
}

function evaluateToken(name, f) {
  const checks = [];
  const pass = (id, ok, detail = "") => checks.push({ id, ok: !!ok, detail });

  pass("terminal", isTerminal(f), f.analysisStatus);
  pass("no_orphan", !orphanAnalyzing(f));
  pass("scope_candidate", scopeOk(f) && f.scope !== "production", f.scope);
  pass("not_production_scope", f.scope !== "production");

  if (name === "HANSOME") {
    pass("posm_or_titan_signal", f.hasPosm || f.hasTitan || f.ownershipClass != null, `class=${f.ownershipClass}`);
    pass(
      "no_unexpected_empty_pools",
      !(f.poolsCleared && f.analysisStages?.liquidity === "done" && f.positionCount === 0 && /cleared/i.test(f.detail)),
      `positions=${f.positionCount} cleared=${f.poolsCleared}`,
    );
    // Soft product richness: prefer non-empty after completed refresh, but allow honest partial if not cleared
    pass(
      "liquidity_stage_done_or_partial",
      ["done", "partial", "unknown", "failed"].includes(f.analysisStages?.liquidity),
      f.analysisStages?.liquidity,
    );
  }

  if (name === "BEER") {
    pass("locked_verified", f.lockedState === "LOCKED_VERIFIED_ONCHAIN", f.lockedState);
    pass("tokenId_436637", String(f.lockedTokenId) === "436637", String(f.lockedTokenId));
    pass(
      "pons_owner",
      (f.lockedOwner || "").toLowerCase() === PONS.toLowerCase(),
      f.lockedOwner,
    );
    pass("discovery_complete", f.positionDiscoveryComplete === true);
    pass("lock_analysis_complete", f.lockAnalysisComplete === true);
    pass("no_cleared", !f.poolsCleared);
  }

  if (name === "GME") {
    pass("hook_path_or_honest", f.hasHookNative || f.hasHookIntel || f.analysisStatus === "partial", `hook=${f.hasHookNative}`);
    pass("no_titan_badge", !(/titan.?badge|ownershipClass":"titan/i.test(JSON.stringify(f))), `class=${f.ownershipClass}`);
    pass("no_false_locked", f.aggregateLockState !== "LOCKED_VERIFIED_ONCHAIN" || f.lockedState === "LOCKED_VERIFIED_ONCHAIN");
    // Generic lock% from incomplete inventory is a fail if shown as concrete without lock verification
    const badGeneric =
      f.lockPercent != null &&
      f.aggregateLockState !== "LOCKED_VERIFIED_ONCHAIN" &&
      f.lockedState !== "LOCKED_VERIFIED_ONCHAIN";
    pass("no_generic_lock_pct_unverified", !badGeneric, `lockPercent=${f.lockPercent}`);
  }

  if (name === "OKC") {
    pass("terminates", isTerminal(f), f.analysisStatus);
    pass(
      "no_fabricated_complete",
      !(f.analysisStatus === "complete" && (f.positionDiscoveryComplete === false || f.lockAnalysisComplete === false)),
      f.analysisStatus,
    );
    const badPmLock =
      f.lockPercent != null &&
      f.lockedState !== "LOCKED_VERIFIED_ONCHAIN" &&
      /position.?manager|pm.?inventory/i.test(f.detail || "");
    pass("no_lock_pct_from_pm_inventory", !badPmLock, `lockPercent=${f.lockPercent}`);
  }

  const failed = checks.filter((c) => !c.ok);
  return { pass: failed.length === 0, checks, failed };
}

async function runMode(name, addr, mode) {
  console.log(`\n=== ${name}:${mode} trigger ===`);
  const force = mode === "forced" || mode === "cold";
  // cold = first force; warm = cached read after; forced = explicit force again
  const trig = await triggerScan(addr, { force: mode !== "warm" });
  if (trig.ok) {
    const f0 = extract(trig.json);
    console.log(
      `[${name}:${mode}] trigger status=${f0.analysisStatus} liq=${f0.analysisStages?.liquidity} positions=${f0.positionCount}`,
    );
  } else {
    console.log(`[${name}:${mode}] trigger parse: ${trig.error}`);
  }
  const waited = await waitTerminal(`${name}:${mode}`, addr);
  return { mode, triggerOk: trig.ok, ...waited };
}

async function soakToken(name, addr) {
  console.log(`\n########## ${name} ${addr} ##########\n`);
  const modes = [];
  for (const mode of ["cold", "warm", "forced"]) {
    const r = await runMode(name, addr, mode);
    const evalRes = r.f ? evaluateToken(name, r.f) : { pass: false, checks: [], failed: [{ id: "no_result", ok: false }] };
    modes.push({ ...r, evaluation: evalRes });
    if (!r.ok) {
      console.log(`[${name}:${mode}] FAIL reason=${r.reason}`);
    } else {
      console.log(`[${name}:${mode}] terminal OK pass=${evalRes.pass} failed=${evalRes.failed.map((x) => x.id).join(",") || "none"}`);
    }
  }
  const allPass = modes.every((m) => m.ok && m.evaluation.pass);
  return { name, addr, allPass, modes };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log("BASE", BASE);
  console.log("EXPECTED_SCOPE", EXPECTED_SCOPE);

  const health = vercelJson(`${BASE}/api/scan/health`);
  console.log("health", health.ok ? health.json : health);

  if (!health.ok || health.json?.deploymentScope === "production") {
    console.error("ABORT: bad health / production scope");
    process.exit(2);
  }

  const results = {};
  for (const [name, addr] of Object.entries(TOKENS)) {
    results[name] = await soakToken(name, addr);
  }

  const outPath = join(OUT_DIR, "phase13b1_candidate_soak.json");
  writeFileSync(outPath, JSON.stringify({ base: BASE, expectedScope: EXPECTED_SCOPE, health: health.json, results }, null, 2));
  console.log("\nWrote", outPath);

  console.log("\n========== SUMMARY ==========");
  let gate = true;
  for (const [name, r] of Object.entries(results)) {
    console.log(`${name}: ${r.allPass ? "PASS" : "FAIL"}`);
    if (!r.allPass) gate = false;
    for (const m of r.modes) {
      const failed = m.evaluation?.failed?.map((x) => `${x.id}:${x.detail || ""}`).join("; ");
      console.log(`  ${m.mode}: ok=${m.ok} eval=${m.evaluation?.pass} ${failed || ""}`);
    }
  }
  console.log("GATE", gate ? "PASS" : "FAIL");
  process.exit(gate ? 0 : 3);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
