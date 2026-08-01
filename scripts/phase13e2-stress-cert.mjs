#!/usr/bin/env node
/**
 * Phase 13E.2 — Stress Certification & Release Readiness
 *
 * Volumes (defaults):
 *   HANSOME Cold×20 Warm×20 Force×20
 *   BEER / GME / OKC Cold×10 Warm×10 Force×10
 *
 * Also: concurrency pairs, force-recovery honesty, runtime class,
 * Known-First cache retention, product honesty gates.
 * Never promotes aliases.
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
const FORCE_GAP_MS = Number(process.env.HANSOME_STRESS_FORCE_GAP_MS || 45_000);
const CONCURRENCY_PAIRS = Number(process.env.HANSOME_STRESS_CONCURRENCY_PAIRS || 8);

const TOKEN_COUNTS = {
  HANSOME: {
    cold: Number(process.env.HANSOME_STRESS_HANSOME_COLD_N || 20),
    warm: Number(process.env.HANSOME_STRESS_HANSOME_WARM_N || 20),
    force: Number(process.env.HANSOME_STRESS_HANSOME_FORCE_N || 20),
  },
  BEER: {
    cold: Number(process.env.HANSOME_STRESS_BEER_COLD_N || 10),
    warm: Number(process.env.HANSOME_STRESS_BEER_WARM_N || 10),
    force: Number(process.env.HANSOME_STRESS_BEER_FORCE_N || 10),
  },
  GME: {
    cold: Number(process.env.HANSOME_STRESS_GME_COLD_N || 10),
    warm: Number(process.env.HANSOME_STRESS_GME_WARM_N || 10),
    force: Number(process.env.HANSOME_STRESS_GME_FORCE_N || 10),
  },
  OKC: {
    cold: Number(process.env.HANSOME_STRESS_OKC_COLD_N || 10),
    warm: Number(process.env.HANSOME_STRESS_OKC_WARM_N || 10),
    force: Number(process.env.HANSOME_STRESS_OKC_FORCE_N || 10),
  },
};

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
  const locked = positions.filter(
    (p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN",
  );
  const textBlob = JSON.stringify(root);
  const recovery = root.lpForceRecovery || null;
  const deepRuntime = j?.deepRuntime || root.deepRuntime || {};
  return {
    analysisStatus: root.analysisStatus ?? null,
    liquidity: root.analysisStages?.liquidity ?? null,
    deepInflight: j?.deepInflight ?? root.deepInflight ?? null,
    deepInflightLocal: deepRuntime.deepInflightLocal ?? j?.deepInflightLocal ?? null,
    deepRetryScheduled:
      j?.deepRetryScheduled ??
      root.deepRetryScheduled ??
      deepRuntime.retryScheduled ??
      null,
    deepLeaseState:
      deepRuntime.deepLeaseState ??
      deepRuntime.leaseState ??
      j?.deepLeaseState ??
      root.deepLeaseState ??
      null,
    scope: root.cache?.deploymentScope ?? j?.deploymentScope ?? null,
    ownershipClass: lp.ownershipClass ?? null,
    positionsCount: positions.length,
    poolsCount: lp.poolsDetectedCount ?? 0,
    lockedTokenId: locked[0]?.positionNftId ?? null,
    lockState: locked[0]?.lockState ?? null,
    lockedOwner: locked[0]?.owner ?? null,
    lpGeneration: root.lpPublish?.lpGeneration ?? null,
    discoveryGeneration: root.deepGeneration ?? root.deepAttemptId ?? null,
    lpTerminal: root.lpTerminal?.terminalState ?? null,
    recoveryState: recovery?.state ?? null,
    recoveryReason: recovery?.reason ?? null,
    recoverySlot: recovery?.slot ?? recovery?.recoverySlot ?? null,
    cleared: /LP evidence cleared/i.test(`${lp.detail || ""}`),
    hasHookIntel: /hookIntelligence|hook_native/i.test(textBlob),
    ownershipHook: lp.ownershipClass === "hook_native",
    titanBadge: /titan.?badge/i.test(textBlob),
    falseLocked:
      lp.ownershipClass === "hook_native" &&
      (lp.aggregateState === "ALL_LOCKED" ||
        lp.aggregateLockState === "LOCKED_VERIFIED_ONCHAIN" ||
        positions.some((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN") ||
        (lp.lockDistribution?.available === true &&
          typeof lp.lockDistribution?.lockedPct === "number")),
    discoverySources: lp.discoverySources || [],
    bootstrapHit: (lp.discoverySources || []).some((s) =>
      String(s).includes("known_bootstrap"),
    ),
    aggregateState: lp.aggregateState ?? null,
    aggregateLockState: lp.aggregateLockState ?? null,
    hookOwnedCount: lp.hookPositionIndex?.hookOwnedCount ?? 0,
    knownPositionsVerified: lp.knownPositionsVerified === true,
    detail: lp.detail ?? null,
    positionIds: positions.map((p) => String(p.positionNftId)),
  };
}

function isTerminal(f) {
  if (!f) return false;
  if (
    f.lockState === "LOCKED_VERIFIED_ONCHAIN" &&
    f.positionsCount > 0 &&
    !f.cleared &&
    (f.liquidity === "done" || f.liquidity === "partial")
  ) {
    return true;
  }
  if (
    f.lpTerminal &&
    ["SUCCESS_TERMINAL", "FAILED_TERMINAL"].includes(f.lpTerminal)
  ) {
    return true;
  }
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

function zombieLeaseClass(f) {
  const analyzing =
    f.liquidity === "analyzing" || f.analysisStatus === "deep_running";
  return (
    analyzing &&
    (f.deepInflight === true || f.deepInflightLocal === true) &&
    (f.deepLeaseState === "none" || f.deepLeaseState == null) &&
    f.deepRetryScheduled !== true
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

async function waitTerminal(label, addr, { maxMs = 540_000 } = {}) {
  const t0 = Date.now();
  let last = null;
  const samples = [];
  let orphanStreak = 0;
  let zombieStreak = 0;
  let hungDeep = false;
  while (Date.now() - t0 < maxMs) {
    const res = await status(addr);
    if (!res.ok) {
      await sleep(8_000);
      continue;
    }
    const f = extract(res.json);
    last = { f, t: Math.round((Date.now() - t0) / 1000) };
    const orphan = orphanAnalyzing(f);
    const zombie = zombieLeaseClass(f);
    orphanStreak = orphan ? orphanStreak + 1 : 0;
    zombieStreak = zombie ? zombieStreak + 1 : 0;
    if (last.t >= 420 && !isTerminal(f) && f.liquidity === "analyzing") {
      hungDeep = true;
    }
    samples.push({
      t: last.t,
      st: f.analysisStatus,
      liq: f.liquidity,
      lease: f.deepLeaseState,
      retry: f.deepRetryScheduled,
      pos: f.positionsCount,
      lock: f.lockState,
      tid: f.lockedTokenId,
      class: f.ownershipClass,
      cleared: f.cleared,
      zombie,
      orphan,
      gen: f.lpGeneration,
      recovery: f.recoveryState,
    });
    console.log(
      `[${label}] t=${last.t}s st=${f.analysisStatus} liq=${f.liquidity}` +
        ` inflight=${f.deepInflight} lease=${f.deepLeaseState}` +
        ` pos=${f.positionsCount} lock=${f.lockState} class=${f.ownershipClass || "-"}` +
        ` cleared=${f.cleared} zombie=${zombie} orphan=${orphan}`,
    );
    if (
      f.lockState === "LOCKED_VERIFIED_ONCHAIN" &&
      f.positionsCount > 0 &&
      !f.cleared
    ) {
      return { ok: true, ...last, samples, hungDeep };
    }
    if (
      f.ownershipClass === "hook_native" &&
      (f.liquidity === "done" ||
        f.liquidity === "unknown" ||
        f.liquidity === "partial") &&
      !f.cleared &&
      (f.ownershipHook || f.hasHookIntel || f.hookOwnedCount > 0 || f.bootstrapHit)
    ) {
      return { ok: true, ...last, samples, hungDeep };
    }
    if (zombieStreak >= 3) {
      return { ok: false, reason: "zombie_lease", ...last, samples, hungDeep };
    }
    if (orphanStreak >= 4) {
      return { ok: false, reason: "orphan", ...last, samples, hungDeep };
    }
    if (!scopeOk(f, EXPECTED_SCOPE)) {
      return { ok: false, reason: "scope", ...last, samples, hungDeep };
    }
    if (isTerminal(f)) {
      const emptyProduct =
        f.positionsCount === 0 &&
        f.ownershipClass !== "hook_native" &&
        !f.ownershipHook &&
        f.lockState !== "LOCKED_VERIFIED_ONCHAIN";
      if (emptyProduct && f.lpTerminal !== "FAILED_TERMINAL") {
        await sleep(12_000);
        continue;
      }
      return { ok: true, ...last, samples, hungDeep };
    }
    await sleep(12_000);
  }
  return { ok: false, reason: "timeout", ...last, samples, hungDeep };
}

function gateBeer(f) {
  const checks = {
    terminal: isTerminal(f),
    lock: f.lockState === "LOCKED_VERIFIED_ONCHAIN",
    tokenId: String(f.lockedTokenId) === "436637",
    owner: (f.lockedOwner || "").toLowerCase() === PONS.toLowerCase(),
    noCleared: !f.cleared,
    scopeCandidate: scopeOk(f, EXPECTED_SCOPE),
    noZombie: !zombieLeaseClass(f),
    noOrphan: !(
      orphanAnalyzing(f) &&
      f.lockState !== "LOCKED_VERIFIED_ONCHAIN"
    ),
  };
  const failed = Object.entries(checks)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  return { pass: failed.length === 0, checks, failed };
}

function gateHansome(f) {
  const checks = {
    terminal:
      isTerminal(f) ||
      (f.lockState === "LOCKED_VERIFIED_ONCHAIN" &&
        f.positionsCount > 0 &&
        !f.cleared),
    ownership: f.ownershipClass === "posm_nft" || f.positionsCount > 0,
    positions: f.positionsCount > 0,
    lockedOrMixed:
      f.lockState === "LOCKED_VERIFIED_ONCHAIN" || f.positionsCount >= 3,
    noOrphan: !orphanAnalyzing(f),
    noZombie: !zombieLeaseClass(f),
    noClearedSticky: !(f.cleared && f.positionsCount === 0 && isTerminal(f)),
    scopeCandidate: scopeOk(f, EXPECTED_SCOPE),
  };
  const failed = Object.entries(checks)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  return { pass: failed.length === 0, checks, failed };
}

function gateGme(f) {
  const checks = {
    terminal:
      isTerminal(f) ||
      (f.ownershipClass === "hook_native" &&
        f.liquidity !== "analyzing" &&
        f.liquidity !== "pending"),
    ownership: f.ownershipClass === "hook_native",
    hookIntel: f.hasHookIntel || f.hookOwnedCount > 0 || f.bootstrapHit,
    noTitanBadge: !f.titanBadge,
    noFalseLocked: !f.falseLocked,
    notLockedClaim:
      f.lockState !== "LOCKED_VERIFIED_ONCHAIN" &&
      f.aggregateState !== "ALL_LOCKED",
    scopeCandidate: scopeOk(f, EXPECTED_SCOPE),
    noZombie: !zombieLeaseClass(f),
    noOrphan: !orphanAnalyzing(f),
  };
  const failed = Object.entries(checks)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  return { pass: failed.length === 0, checks, failed };
}

function gateOkc(f) {
  const checks = {
    terminal:
      isTerminal(f) ||
      (f.ownershipClass === "hook_native" &&
        f.liquidity !== "analyzing" &&
        f.liquidity !== "pending"),
    notAnalyzing: f.liquidity !== "analyzing",
    honestHookClass: f.ownershipClass === "hook_native",
    honestIncomplete:
      f.aggregateState === "UNKNOWN_INCOMPLETE" ||
      f.lockState == null ||
      f.lockState === "UNABLE_TO_DETERMINE",
    noFalseLocked: !f.falseLocked,
    noOrphan: !orphanAnalyzing(f),
    noZombie: !zombieLeaseClass(f),
    scopeCandidate: scopeOk(f, EXPECTED_SCOPE),
  };
  const failed = Object.entries(checks)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  return { pass: failed.length === 0, checks, failed };
}

const GATES = {
  BEER: gateBeer,
  HANSOME: gateHansome,
  GME: gateGme,
  OKC: gateOkc,
};

function trackGlobals(out, waited, f) {
  if (f?.cleared && f.positionsCount === 0) out.globals.stickyClears += 1;
  if (waited.reason === "orphan") out.globals.orphans += 1;
  if (waited.reason === "zombie_lease") out.globals.zombies += 1;
  if (waited.hungDeep) out.globals.hungDeep += 1;
  if (f?.scope === "production") out.globals.productionScope += 1;
  if (f?.lpGeneration != null) out.generations.push(f.lpGeneration);
  // Known-First body loss: verified/hook body wiped to empty cleared shell
  if (
    f &&
    f.cleared &&
    f.positionsCount === 0 &&
    f.ownershipClass !== "hook_native" &&
    !f.bootstrapHit
  ) {
    out.globals.knownFirstLossHints += 1;
  }
}

async function runToken(name) {
  const addr = TOKENS[name];
  const gateFn = GATES[name];
  const counts = TOKEN_COUNTS[name];
  const out = {
    name,
    addr,
    cold: [],
    warm: [],
    force: [],
    globals: {
      stickyClears: 0,
      orphans: 0,
      zombies: 0,
      hungDeep: 0,
      productionScope: 0,
      knownFirstLossHints: 0,
      genRegressions: 0,
      staleOverwriteHints: 0,
    },
    generations: [],
  };

  console.log(`\n======== ${name} COLD ×${counts.cold} ========`);
  for (let i = 1; i <= counts.cold; i++) {
    await scan(addr, { refresh: true });
    const waited = await waitTerminal(`${name}:cold#${i}`, addr);
    const gate = waited.f ? gateFn(waited.f) : { pass: false, checks: {}, failed: ["no_sample"] };
    out.cold.push({ i, waitOk: waited.ok, reason: waited.reason, gate, f: waited.f });
    trackGlobals(out, waited, waited.f);
    console.log(
      `${name} cold#${i} pass=${gate.pass} reason=${waited.reason} failed=${(gate.failed || []).join(",") || "-"} class=${waited.f?.ownershipClass || "-"}`,
    );
    if (i < counts.cold) await sleep(6_000);
  }

  console.log(`\n======== ${name} WARM ×${counts.warm} ========`);
  for (let i = 1; i <= counts.warm; i++) {
    await scan(addr);
    const waited = await waitTerminal(`${name}:warm#${i}`, addr, {
      maxMs: 180_000,
    });
    const gate = waited.f ? gateFn(waited.f) : { pass: false, checks: {}, failed: ["no_sample"] };
    out.warm.push({ i, waitOk: waited.ok, reason: waited.reason, gate, f: waited.f });
    trackGlobals(out, waited, waited.f);
    console.log(
      `${name} warm#${i} pass=${gate.pass} failed=${(gate.failed || []).join(",") || "-"}`,
    );
  }

  console.log(`\n======== ${name} FORCE ×${counts.force} ========`);
  let prevForceBody = null;
  for (let i = 1; i <= counts.force; i++) {
    if (i > 1) await sleep(FORCE_GAP_MS);
    await scan(addr, { refresh: true, forceLp: true });
    const waited = await waitTerminal(`${name}:force#${i}`, addr);
    const gate = waited.f ? gateFn(waited.f) : { pass: false, checks: {}, failed: ["no_sample"] };
    out.force.push({
      i,
      waitOk: waited.ok,
      reason: waited.reason,
      gate,
      f: waited.f,
      recoveryState: waited.f?.recoveryState ?? null,
      recoveryReason: waited.f?.recoveryReason ?? null,
    });
    trackGlobals(out, waited, waited.f);
    // Stale overwrite: prior verified body replaced by empty after force settle
    if (
      prevForceBody &&
      prevForceBody.positionsCount > 0 &&
      waited.f &&
      waited.f.positionsCount === 0 &&
      waited.f.ownershipClass !== "hook_native" &&
      gate.pass === false
    ) {
      out.globals.staleOverwriteHints += 1;
    }
    if (waited.f && (waited.f.positionsCount > 0 || waited.f.ownershipClass === "hook_native")) {
      prevForceBody = waited.f;
    }
    console.log(
      `${name} force#${i} pass=${gate.pass} lock=${waited.f?.lockState} tid=${waited.f?.lockedTokenId} class=${waited.f?.ownershipClass || "-"} recovery=${waited.f?.recoveryState || waited.f?.recoveryReason || "-"}`,
    );
  }

  // Generation regression: numeric gens must be non-decreasing when present
  const nums = out.generations
    .map((g) => Number(g))
    .filter((n) => Number.isFinite(n));
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] + 0 < nums[i - 1] - 5) {
      // allow small jitter / parallel workers; flag only large regressions
      out.globals.genRegressions += 1;
    }
  }

  const coldPass = out.cold.filter((x) => x.gate.pass).length;
  const warmPass = out.warm.filter((x) => x.gate.pass).length;
  const forcePass = out.force.filter((x) => x.gate.pass).length;
  out.summary = {
    coldPass: `${coldPass}/${counts.cold}`,
    warmPass: `${warmPass}/${counts.warm}`,
    forcePass: `${forcePass}/${counts.force}`,
    coldOk: coldPass === counts.cold,
    warmOk: warmPass === counts.warm,
    forceOk: forcePass === counts.force,
    pass:
      coldPass === counts.cold &&
      warmPass === counts.warm &&
      forcePass === counts.force &&
      out.globals.stickyClears === 0 &&
      out.globals.orphans === 0 &&
      out.globals.zombies === 0 &&
      out.globals.productionScope === 0 &&
      out.globals.hungDeep === 0,
  };
  return out;
}

async function runConcurrency() {
  console.log(`\n======== CONCURRENCY PAIRS ×${CONCURRENCY_PAIRS} ========`);
  const pairs = [];
  const addrs = Object.entries(TOKENS);
  for (let i = 0; i < CONCURRENCY_PAIRS; i++) {
    const [name, addr] = addrs[i % addrs.length];
    const label = `pair#${i + 1}:${name}`;
    // Fire refresh + status without waiting between (sequential CLI, tight)
    const t0 = Date.now();
    const a = scan(addr, { refresh: true });
    const b = status(addr);
    await a;
    await b;
    const waited = await waitTerminal(label, addr, { maxMs: 300_000 });
    const gateFn = GATES[name];
    const gate = waited.f
      ? gateFn(waited.f)
      : { pass: false, failed: ["no_sample"] };
    const raceHints = {
      zombie: waited.samples?.some((s) => s.zombie) ?? false,
      orphan: waited.samples?.some((s) => s.orphan) ?? false,
      productionScope: waited.f?.scope === "production",
      stickyCleared:
        waited.f?.cleared === true && waited.f?.positionsCount === 0,
    };
    const ok =
      gate.pass &&
      !raceHints.zombie &&
      !raceHints.orphan &&
      !raceHints.productionScope &&
      !raceHints.stickyCleared;
    pairs.push({
      i: i + 1,
      name,
      ok,
      gate,
      raceHints,
      ms: Date.now() - t0,
      gen: waited.f?.lpGeneration ?? null,
    });
    console.log(
      `${label} ok=${ok} class=${waited.f?.ownershipClass || "-"} zombie=${raceHints.zombie} orphan=${raceHints.orphan} ms=${Date.now() - t0}`,
    );
    await sleep(8_000);
  }
  const gens = pairs.map((p) => p.gen).filter((g) => g != null);
  const uniq = new Set(gens.map(String));
  return {
    pairs,
    passCount: pairs.filter((p) => p.ok).length,
    total: pairs.length,
    pass: pairs.every((p) => p.ok),
    duplicatePublishHints: Math.max(0, gens.length - uniq.size),
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const health = vercelJson(`${BASE}/api/scan/health`, 60_000);
  const healthRoot = health.ok ? rootOf(health.json) : {};
  console.log(
    "health scope=",
    healthRoot.deploymentScope || healthRoot.cache?.deploymentScope,
    "alias=",
    healthRoot.isProductionAlias,
    "dpl=",
    healthRoot.deploymentId,
  );

  if (healthRoot.isProductionAlias === true) {
    console.error("ABORT: tip resolved as production alias — isolation broken");
    process.exit(3);
  }
  if (
    healthRoot.deploymentScope &&
    !String(healthRoot.deploymentScope).startsWith("candidate:")
  ) {
    console.error("ABORT: expected candidate scope, got", healthRoot.deploymentScope);
    process.exit(3);
  }

  const results = {};
  // Stress order: BEER first (regression), HANSOME volume, then Hook tokens
  for (const name of ["BEER", "HANSOME", "GME", "OKC"]) {
    results[name] = await runToken(name);
  }

  const concurrency = await runConcurrency();

  const globals = {
    stickyClears: 0,
    orphans: 0,
    zombies: 0,
    hungDeep: 0,
    productionScope: 0,
    knownFirstLossHints: 0,
    genRegressions: 0,
    staleOverwriteHints: 0,
  };
  for (const r of Object.values(results)) {
    for (const k of Object.keys(globals)) {
      globals[k] += r.globals[k] || 0;
    }
  }

  const tokenPass = Object.values(results).every((r) => r.summary?.pass);
  const runtimePass =
    globals.zombies === 0 &&
    globals.orphans === 0 &&
    globals.hungDeep === 0 &&
    globals.productionScope === 0 &&
    globals.stickyClears === 0;
  const cachePass =
    globals.knownFirstLossHints === 0 && globals.staleOverwriteHints === 0;
  const concurrencyPass = concurrency.pass === true;
  const allPass =
    tokenPass && runtimePass && cachePass && concurrencyPass;

  const report = {
    phase: "13E.2",
    base: BASE,
    expectedScope: EXPECTED_SCOPE,
    health: healthRoot,
    tokenCounts: TOKEN_COUNTS,
    forceGapMs: FORCE_GAP_MS,
    results,
    concurrency,
    globals,
    gates: {
      tokenMatrix: tokenPass,
      runtime: runtimePass,
      cacheKnownFirst: cachePass,
      concurrency: concurrencyPass,
    },
    verdict: allPass ? "PASS" : "FAIL",
    finishedAt: new Date().toISOString(),
  };

  const outPath = join(OUT_DIR, "phase13e2_stress_cert.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log("\nWrote", outPath);
  console.log("VERDICT", report.verdict);
  console.log(
    "summaries",
    Object.fromEntries(
      Object.entries(results).map(([k, v]) => [k, v.summary]),
    ),
  );
  console.log("globals", globals);
  console.log(
    "concurrency",
    `${concurrency.passCount}/${concurrency.total} dupHints=${concurrency.duplicatePublishHints}`,
  );
  process.exit(allPass ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
