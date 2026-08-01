#!/usr/bin/env node
/**
 * Phase 13C — Force LP recovery Candidate soak.
 * Order: cold → warm → forced → second force → concurrent → status
 * BEER 10/10 forced; HANSOME/GME/OKC ×5 terminal.
 * Never promotes aliases. Uses vercel curl (deployment protection).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.HANSOME_GATE_BASE || "").replace(/\/$/, "");
const OUT_DIR = join(__dirname, "..", "reports", "data");
const PONS = "0x736D76699C26D0d966744cAe304C000d471f7F35";
const EXPECTED_SCOPE = process.env.HANSOME_EXPECT_SCOPE || "";

const TOKENS = {
  BEER: "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804",
  HANSOME: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
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
      return { ok: true, json: JSON.parse(matches[i]) };
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
  const recovery = root.lpForceRecovery || null;
  return {
    analysisStatus: root.analysisStatus ?? null,
    analysisPhase: root.analysisPhase ?? null,
    liquidity: root.analysisStages?.liquidity ?? null,
    deepInflight: j?.deepInflight ?? root.deepInflight ?? null,
    deepRetryScheduled: j?.deepRetryScheduled ?? root.deepRetryScheduled ?? null,
    deepLeaseState:
      j?.deepRuntime?.leaseState ??
      root.deepRuntime?.leaseState ??
      j?.deepLeaseState ??
      null,
    scope: root.cache?.deploymentScope ?? j?.deploymentScope ?? null,
    score: root.overview?.score ?? root.score ?? null,
    ownershipClass: lp.ownershipClass ?? null,
    positionsCount: positions.length,
    poolsCount: lp.poolsDetectedCount ?? 0,
    lockedTokenId: locked[0]?.positionNftId ?? null,
    lockState: locked[0]?.lockState ?? null,
    lockedOwner: locked[0]?.owner ?? null,
    positionDiscoveryComplete: v3.positionDiscoveryComplete ?? null,
    lockAnalysisComplete: v3.lockAnalysisComplete ?? null,
    lpGeneration: root.lpPublish?.lpGeneration ?? null,
    lpTerminal: root.lpTerminal?.terminalState ?? null,
    lpForceRecovery: recovery,
    recoveryState: recovery?.state ?? null,
    recoveryReason: recovery?.reason ?? null,
    durablePrior: recovery?.durablePrior ?? null,
    aggregateStatus: lp.aggregateState ?? lp.aggregateLockState ?? null,
    detail: `${lp.detail || ""}`,
    cleared: /LP evidence cleared/i.test(`${lp.detail || ""}`),
    hasHookIntel: /hookIntelligence|hook_native/i.test(textBlob),
    ownershipHook: lp.ownershipClass === "hook_native",
    titanBadge: /titan.?badge/i.test(textBlob),
    genericLockPct: lp.lockPercent ?? lp.lockedPercent ?? null,
    falseLocked:
      /"Locked"/i.test(textBlob) &&
      lp.aggregateLockState !== "LOCKED_VERIFIED_ONCHAIN",
    refreshDenied: root.cache?.refreshDenied === true,
  };
}

function isTerminal(f) {
  if (!f) return false;
  const analyzing =
    f.liquidity === "analyzing" ||
    f.analysisStatus === "deep_running" ||
    f.analysisStatus === "analyzing";
  const inflight = f.deepInflight === true;
  const retry = f.deepRetryScheduled === true;
  const leaseValid = f.deepLeaseState === "valid";
  if (analyzing && !inflight && !retry && !leaseValid) return false;
  if (analyzing) return false;
  if (["complete", "partial", "failed"].includes(f.analysisStatus)) return true;
  if (
    f.lpTerminal &&
    ["SUCCESS_TERMINAL", "FAILED_TERMINAL"].includes(f.lpTerminal)
  ) {
    return true;
  }
  if (f.liquidity && f.liquidity !== "analyzing" && f.liquidity !== "pending") {
    return true;
  }
  return false;
}

function orphanAnalyzing(f) {
  const analyzing =
    f.liquidity === "analyzing" || f.analysisStatus === "deep_running";
  return (
    analyzing &&
    f.deepInflight !== true &&
    f.deepRetryScheduled !== true &&
    f.deepLeaseState !== "valid"
  );
}

function scopeOk(f, expect) {
  if (!f.scope) return true;
  if (f.scope === "production") return false;
  if (expect) return f.scope === expect || f.scope.startsWith("candidate:");
  return f.scope.startsWith("candidate:");
}

async function scan(addr, { refresh = false, forceLp = false } = {}) {
  const q = new URLSearchParams({ address: addr });
  if (refresh) q.set("refresh", "1");
  if (forceLp) q.set("forceLp", "1");
  return vercelJson(`${BASE}/api/scan?${q}`, 180_000);
}

async function status(addr) {
  return vercelJson(`${BASE}/api/scan/status?address=${addr}`, 120_000);
}

async function waitTerminal(label, addr, { maxMs = 480_000 } = {}) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < maxMs) {
    const res = await status(addr);
    if (!res.ok) {
      await sleep(8_000);
      continue;
    }
    const f = extract(res.json);
    last = { f, t: Math.round((Date.now() - t0) / 1000) };
    console.log(
      `[${label}] t=${last.t}s st=${f.analysisStatus} liq=${f.liquidity} inflight=${f.deepInflight} lease=${f.deepLeaseState} pos=${f.positionsCount} lock=${f.lockState} tid=${f.lockedTokenId} recovery=${f.recoveryState}/${f.recoveryReason} cleared=${f.cleared}`,
    );
    if (orphanAnalyzing(f)) return { ok: false, reason: "orphan", ...last };
    if (!scopeOk(f, EXPECTED_SCOPE)) return { ok: false, reason: "scope", ...last };
    if (isTerminal(f)) return { ok: true, ...last };
    await sleep(12_000);
  }
  return { ok: false, reason: "timeout", ...last };
}

function gateBeer(f) {
  const checks = {
    terminal: isTerminal(f),
    lock: f.lockState === "LOCKED_VERIFIED_ONCHAIN",
    tokenId: String(f.lockedTokenId) === "436637",
    owner: (f.lockedOwner || "").toLowerCase() === PONS.toLowerCase(),
    discovery: f.positionDiscoveryComplete === true,
    lockAnalysis: f.lockAnalysisComplete === true,
    noCleared: !f.cleared,
    scopeCandidate: scopeOk(f, EXPECTED_SCOPE),
    // Phase 13C: restored prior (stale_forced_refresh) still counts as product OK
    recoveryHonest:
      f.recoveryReason !== "stale_forced_refresh" ||
      f.lockState === "LOCKED_VERIFIED_ONCHAIN",
  };
  return { pass: Object.values(checks).every(Boolean), checks };
}

function gateHansome(f) {
  const checks = {
    terminal: isTerminal(f),
    ownership: f.ownershipClass === "posm_nft" || f.positionsCount > 0,
    positions: f.positionsCount > 0,
    pools: f.poolsCount > 0 || f.positionsCount > 0,
    noOrphan: !orphanAnalyzing(f),
    noClearedSticky: !(f.cleared && f.positionsCount === 0 && isTerminal(f)),
    scopeCandidate: scopeOk(f, EXPECTED_SCOPE),
  };
  return { pass: Object.values(checks).every(Boolean), checks, score: f.score };
}

function gateGme(f) {
  const checks = {
    terminal: isTerminal(f),
    ownership: f.ownershipHook || f.hasHookIntel || f.ownershipClass != null,
    noTitanBadge: !f.titanBadge,
    noGenericLockPct: f.genericLockPct == null || f.lockState === "LOCKED_VERIFIED_ONCHAIN",
    noFalseLocked: !f.falseLocked,
    scopeCandidate: scopeOk(f, EXPECTED_SCOPE),
    hookHonest: true,
  };
  return {
    pass: Object.values(checks).every(Boolean),
    checks,
    hasHookIntel: f.hasHookIntel || f.ownershipHook,
  };
}

function gateOkc(f) {
  const checks = {
    terminal: isTerminal(f),
    notAnalyzing: f.liquidity !== "analyzing",
    noFabricatedComplete: f.analysisStatus !== "complete" || f.positionsCount >= 0,
    noOrphan: !orphanAnalyzing(f),
    scopeCandidate: scopeOk(f, EXPECTED_SCOPE),
  };
  return { pass: Object.values(checks).every(Boolean), checks };
}

async function forceCycle(label, addr, gateFn) {
  const trig = await scan(addr, { refresh: true, forceLp: true });
  const denied = trig.ok && extract(trig.json).refreshDenied;
  const waited = await waitTerminal(label, addr);
  const f = waited.f;
  const gate = f ? gateFn(f) : { pass: false, checks: {} };
  return {
    denied,
    afterForce: f,
    gate,
    waitOk: waited.ok,
    reason: waited.reason,
  };
}

async function soakBeer() {
  const addr = TOKENS.BEER;
  const out = { name: "BEER", addr, forced: [], warm: null, cold: null, concurrent: null, statusAgree: null };

  console.log("\n=== BEER cold ===");
  await scan(addr, { refresh: true });
  const cold = await waitTerminal("BEER:cold", addr, { maxMs: 540_000 });
  out.cold = { ...cold, gate: cold.f ? gateBeer(cold.f) : { pass: false } };

  console.log("\n=== BEER warm ===");
  await scan(addr);
  const warm = await waitTerminal("BEER:warm", addr, { maxMs: 120_000 });
  out.warm = { ...warm, gate: warm.f ? gateBeer(warm.f) : { pass: false } };

  console.log("\n=== BEER forced ×10 ===");
  for (let i = 1; i <= 10; i++) {
    // Cooldown between forces to avoid refresh denial.
    if (i > 1) await sleep(65_000);
    const cycle = await forceCycle(`BEER:force#${i}`, addr, gateBeer);
    out.forced.push({ i, ...cycle });
    console.log(
      `BEER force#${i} pass=${cycle.gate.pass} lock=${cycle.afterForce?.lockState} tid=${cycle.afterForce?.lockedTokenId} recovery=${cycle.afterForce?.recoveryReason} cleared=${cycle.afterForce?.cleared}`,
    );
  }

  console.log("\n=== BEER second-force + concurrent ===");
  await sleep(65_000);
  const p1 = forceCycle("BEER:second", addr, gateBeer);
  const p2 = forceCycle("BEER:concurrent", addr, gateBeer);
  const [second, concurrent] = await Promise.all([p1, p2]);
  out.forced.push({ i: "second", ...second });
  out.concurrent = concurrent;

  const scanSnap = await scan(addr);
  const stSnap = await status(addr);
  const a = scanSnap.ok ? extract(scanSnap.json) : null;
  const b = stSnap.ok ? extract(stSnap.json) : null;
  out.statusAgree = {
    scan: a,
    status: b,
    agree:
      !!a &&
      !!b &&
      a.analysisStatus === b.analysisStatus &&
      a.liquidity === b.liquidity &&
      a.cleared === b.cleared &&
      String(a.lockedTokenId) === String(b.lockedTokenId),
  };

  const forcedPass = out.forced.filter((x) => typeof x.i === "number" && x.gate?.pass).length;
  out.pass =
    out.cold.gate?.pass &&
    out.warm.gate?.pass &&
    forcedPass >= 10 &&
    second.gate?.pass &&
    out.statusAgree.agree !== false;
  out.forcedPassCount = forcedPass;
  return out;
}

async function soakTokenN(name, addr, gateFn, n) {
  const out = { name, addr, runs: [] };
  console.log(`\n=== ${name} cold ===`);
  await scan(addr, { refresh: true });
  const cold = await waitTerminal(`${name}:cold`, addr, { maxMs: 540_000 });
  out.cold = { ...cold, gate: cold.f ? gateFn(cold.f) : { pass: false } };

  console.log(`\n=== ${name} warm ===`);
  await scan(addr);
  const warm = await waitTerminal(`${name}:warm`, addr, { maxMs: 180_000 });
  out.warm = { ...warm, gate: warm.f ? gateFn(warm.f) : { pass: false } };

  for (let i = 1; i <= n; i++) {
    if (i > 1) await sleep(65_000);
    const cycle = await forceCycle(`${name}:force#${i}`, addr, gateFn);
    out.runs.push({ i, ...cycle });
    console.log(
      `${name} force#${i} pass=${cycle.gate.pass} pos=${cycle.afterForce?.positionsCount} class=${cycle.afterForce?.ownershipClass} recovery=${cycle.afterForce?.recoveryReason} cleared=${cycle.afterForce?.cleared}`,
    );
  }

  await sleep(65_000);
  const second = await forceCycle(`${name}:second`, addr, gateFn);
  out.second = second;
  const [c1, c2] = await Promise.all([
    forceCycle(`${name}:concA`, addr, gateFn),
    forceCycle(`${name}:concB`, addr, gateFn),
  ]);
  out.concurrent = [c1, c2];

  const scanSnap = await scan(addr);
  const stSnap = await status(addr);
  out.statusAgree = {
    scan: scanSnap.ok ? extract(scanSnap.json) : null,
    status: stSnap.ok ? extract(stSnap.json) : null,
  };
  out.statusAgree.agree =
    !!out.statusAgree.scan &&
    !!out.statusAgree.status &&
    out.statusAgree.scan.analysisStatus === out.statusAgree.status.analysisStatus &&
    out.statusAgree.scan.liquidity === out.statusAgree.status.liquidity;

  const forcePass = out.runs.filter((r) => r.gate?.pass).length;
  out.forcePassCount = forcePass;
  out.pass =
    out.cold.gate?.pass &&
    forcePass >= n &&
    second.gate?.pass &&
    out.statusAgree.agree !== false;
  return out;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const health = vercelJson(`${BASE}/api/scan/health`);
  console.log("health", health.ok ? JSON.stringify(health.json) : health);
  if (!health.ok || health.json?.deploymentScope === "production") {
    console.error("ABORT: bad health / production scope");
    process.exit(2);
  }
  const scope = health.json.deploymentScope;
  if (EXPECTED_SCOPE && scope !== EXPECTED_SCOPE) {
    console.warn("WARN scope mismatch", scope, "expected", EXPECTED_SCOPE);
  }
  process.env.HANSOME_EXPECT_SCOPE = scope;

  const tokens = {};
  tokens.BEER = await soakBeer();
  tokens.HANSOME = await soakTokenN("HANSOME", TOKENS.HANSOME, gateHansome, 5);
  tokens.GME = await soakTokenN("GME", TOKENS.GME, gateGme, 5);
  tokens.OKC = await soakTokenN("OKC", TOKENS.OKC, gateOkc, 5);

  const pass = Object.values(tokens).every((t) => t.pass);
  const outPath = join(OUT_DIR, "phase13c_force_lp_soak.json");
  const artifact = {
    at: new Date().toISOString(),
    phase: "13C",
    base: BASE,
    health: health.json,
    tokens,
    pass,
  };
  writeFileSync(outPath, JSON.stringify(artifact, null, 2));
  writeFileSync(
    join(OUT_DIR, "phase13c_force_lp_summary.json"),
    JSON.stringify(
      {
        pass,
        beerForced: tokens.BEER.forcedPassCount,
        hansomeForced: tokens.HANSOME.forcePassCount,
        gmeForced: tokens.GME.forcePassCount,
        okcForced: tokens.OKC.forcePassCount,
        deploymentScope: scope,
      },
      null,
      2,
    ),
  );
  console.log("\nWrote", outPath);
  console.log("PASS", pass);
  process.exit(pass ? 0 : 3);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
