#!/usr/bin/env node
/**
 * Phase 13E.1 — HANSOME Cold + GME Hook Native + OKC Honest Terminal Recovery Cert
 * Matrix (defaults): HANSOME cold10/warm5/force5; GME 5×3; OKC 5×3; BEER regression 3×3
 * Global: no sticky clears, orphan runtime, zombie lease
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
const TOKEN_COUNTS = {
  BEER: {
    cold: Number(process.env.HANSOME_CERT_BEER_COLD_N || 3),
    warm: Number(process.env.HANSOME_CERT_BEER_WARM_N || 3),
    force: Number(process.env.HANSOME_CERT_BEER_FORCE_N || 3),
  },
  HANSOME: {
    cold: Number(process.env.HANSOME_CERT_HANSOME_COLD_N || 10),
    warm: Number(process.env.HANSOME_CERT_HANSOME_WARM_N || 5),
    force: Number(process.env.HANSOME_CERT_HANSOME_FORCE_N || 5),
  },
  GME: {
    cold: Number(process.env.HANSOME_CERT_GME_COLD_N || 5),
    warm: Number(process.env.HANSOME_CERT_GME_WARM_N || 5),
    force: Number(process.env.HANSOME_CERT_GME_FORCE_N || 5),
  },
  OKC: {
    cold: Number(process.env.HANSOME_CERT_OKC_COLD_N || 5),
    warm: Number(process.env.HANSOME_CERT_OKC_WARM_N || 5),
    force: Number(process.env.HANSOME_CERT_OKC_FORCE_N || 5),
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
  const locked = positions.filter((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN");
  const v3 = lp.uniswapVersions?.byVersion?.v3 || {};
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
    deepLeaseOwned: deepRuntime.deepLeaseOwned ?? null,
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
    discoveryGeneration: root.deepGeneration ?? root.deepAttemptId ?? null,
    lpTerminal: root.lpTerminal?.terminalState ?? null,
    recoveryState: recovery?.state ?? null,
    recoveryReason: recovery?.reason ?? null,
    cleared: /LP evidence cleared/i.test(`${lp.detail || ""}`),
    hasHookIntel: /hookIntelligence|hook_native/i.test(textBlob),
    ownershipHook: lp.ownershipClass === "hook_native",
    titanBadge: /titan.?badge/i.test(textBlob),
    genericLockPct: lp.lockPercent ?? lp.lockedPercent ?? null,
    // Product false-lock only — Doppler PoolStatus name "Locked" is lifecycle,
    // not Titan LOCKED_VERIFIED_ONCHAIN. Do not treat PoolStatus as false lock.
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
    hookOwnedCount: lp.hookPositionIndex?.hookOwnedCount ?? 0,
  };
}

function isTerminal(f) {
  if (!f) return false;
  // Durable Locked publish is a product terminal for LP cert (siblings may still run).
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

/** 13C.1 invalid class: analyzing + local inflight + lease none + !retryScheduled */
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
    // Allow brief lease/retry flicker; fail only on persistent invalid class.
    orphanStreak = orphan ? orphanStreak + 1 : 0;
    zombieStreak = zombie ? zombieStreak + 1 : 0;
    samples.push({
      t: last.t,
      st: f.analysisStatus,
      liq: f.liquidity,
      lease: f.deepLeaseState,
      retry: f.deepRetryScheduled,
      pos: f.positionsCount,
      lock: f.lockState,
      tid: f.lockedTokenId,
      cleared: f.cleared,
      zombie,
      orphan,
      gen: f.lpGeneration,
    });
    console.log(
      `[${label}] t=${last.t}s st=${f.analysisStatus} liq=${f.liquidity} inflight=${f.deepInflight} lease=${f.deepLeaseState} retry=${f.deepRetryScheduled} pos=${f.positionsCount} lock=${f.lockState} tid=${f.lockedTokenId} cleared=${f.cleared} zombie=${zombie} orphan=${orphan}`,
    );
    // Product gate: Locked Titan/Pons accepted mid-deep if durable.
    if (
      f.lockState === "LOCKED_VERIFIED_ONCHAIN" &&
      f.positionsCount > 0 &&
      !f.cleared
    ) {
      return { ok: true, ...last, samples };
    }
    // Product gate: Known-Hook Class B durable ownership evidence.
    if (
      f.ownershipClass === "hook_native" &&
      (f.liquidity === "done" || f.liquidity === "unknown" || f.liquidity === "partial") &&
      !f.cleared &&
      (f.ownershipHook || f.hasHookIntel || f.hookOwnedCount > 0 || f.bootstrapHit)
    ) {
      return { ok: true, ...last, samples };
    }
    if (zombieStreak >= 3) return { ok: false, reason: "zombie_lease", ...last, samples };
    if (orphanStreak >= 4) return { ok: false, reason: "orphan", ...last, samples };
    if (!scopeOk(f, EXPECTED_SCOPE)) return { ok: false, reason: "scope", ...last, samples };
    if (isTerminal(f)) {
      // Do not accept empty soft-partial as product terminal for Titan/Pons tokens.
      // Keep waiting for Known-First Locked / Hook evidence within budget.
      const emptyProduct =
        f.positionsCount === 0 &&
        f.ownershipClass !== "hook_native" &&
        !f.ownershipHook &&
        f.lockState !== "LOCKED_VERIFIED_ONCHAIN";
      if (emptyProduct && f.lpTerminal !== "FAILED_TERMINAL") {
        await sleep(12_000);
        continue;
      }
      return { ok: true, ...last, samples };
    }
    await sleep(12_000);
  }
  return { ok: false, reason: "timeout", ...last, samples };
}

function gateBeer(f) {
  const checks = {
    terminal: isTerminal(f),
    lock: f.lockState === "LOCKED_VERIFIED_ONCHAIN",
    tokenId: String(f.lockedTokenId) === "436637",
    owner: (f.lockedOwner || "").toLowerCase() === PONS.toLowerCase(),
    noCleared: !f.cleared,
    scopeCandidate: scopeOk(f, EXPECTED_SCOPE),
    // Runtime class evaluated at durable Locked sample (not mid-clear flicker).
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
    pools: f.poolsCount > 0 || f.positionsCount > 0,
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
  return { pass: failed.length === 0, checks, failed, score: f.score };
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
    // UNKNOWN_INCOMPLETE is an acceptable honest terminal for OKC.
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

async function runToken(name) {
  const addr = TOKENS[name];
  const gateFn = GATES[name];
  const counts = TOKEN_COUNTS[name];
  const COLD_N = counts.cold;
  const WARM_N = counts.warm;
  const FORCE_N = counts.force;
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
      genRegressions: 0,
      duplicatePublishes: 0,
    },
    generations: [],
  };

  console.log(`\n======== ${name} COLD ×${COLD_N} ========`);
  for (let i = 1; i <= COLD_N; i++) {
    await scan(addr, { refresh: true });
    const waited = await waitTerminal(`${name}:cold#${i}`, addr);
    const gate = waited.f ? gateFn(waited.f) : { pass: false, checks: {} };
    out.cold.push({ i, waitOk: waited.ok, reason: waited.reason, gate, f: waited.f });
    if (waited.f?.cleared && waited.f.positionsCount === 0) out.globals.stickyClears += 1;
    if (waited.reason === "orphan") out.globals.orphans += 1;
    if (waited.reason === "zombie_lease") out.globals.zombies += 1;
    if (waited.f?.lpGeneration) out.generations.push(waited.f.lpGeneration);
    console.log(
      `${name} cold#${i} pass=${gate.pass} reason=${waited.reason} failed=${(gate.failed || []).join(",") || "-"} owner=${waited.f?.lockedOwner || "-"} class=${waited.f?.ownershipClass || "-"}`,
    );
    if (i < COLD_N) await sleep(8_000);
  }

  console.log(`\n======== ${name} WARM ×${WARM_N} ========`);
  for (let i = 1; i <= WARM_N; i++) {
    await scan(addr);
    const waited = await waitTerminal(`${name}:warm#${i}`, addr, { maxMs: 180_000 });
    const gate = waited.f ? gateFn(waited.f) : { pass: false, checks: {} };
    out.warm.push({ i, waitOk: waited.ok, reason: waited.reason, gate, f: waited.f });
    if (waited.reason === "orphan") out.globals.orphans += 1;
    if (waited.reason === "zombie_lease") out.globals.zombies += 1;
    if (waited.f?.lpGeneration) out.generations.push(waited.f.lpGeneration);
    console.log(
      `${name} warm#${i} pass=${gate.pass} failed=${(gate.failed || []).join(",") || "-"}`,
    );
  }

  console.log(`\n======== ${name} FORCE ×${FORCE_N} ========`);
  for (let i = 1; i <= FORCE_N; i++) {
    if (i > 1) await sleep(50_000);
    await scan(addr, { refresh: true, forceLp: true });
    const waited = await waitTerminal(`${name}:force#${i}`, addr);
    const gate = waited.f ? gateFn(waited.f) : { pass: false, checks: {} };
    out.force.push({ i, waitOk: waited.ok, reason: waited.reason, gate, f: waited.f });
    if (waited.f?.cleared && waited.f.positionsCount === 0 && isTerminal(waited.f)) {
      out.globals.stickyClears += 1;
    }
    if (waited.reason === "orphan") out.globals.orphans += 1;
    if (waited.reason === "zombie_lease") out.globals.zombies += 1;
    if (waited.f?.lpGeneration) out.generations.push(waited.f.lpGeneration);
    console.log(
      `${name} force#${i} pass=${gate.pass} lock=${waited.f?.lockState} tid=${waited.f?.lockedTokenId} class=${waited.f?.ownershipClass || "-"} recovery=${waited.f?.recoveryReason}`,
    );
  }

  const gens = out.generations.filter(Boolean);
  const uniq = new Set(gens);
  if (gens.length !== uniq.size) out.globals.duplicatePublishes = gens.length - uniq.size;

  const coldPass = out.cold.filter((x) => x.gate.pass).length;
  const warmPass = out.warm.filter((x) => x.gate.pass).length;
  const forcePass = out.force.filter((x) => x.gate.pass).length;
  out.summary = {
    coldPass: `${coldPass}/${COLD_N}`,
    warmPass: `${warmPass}/${WARM_N}`,
    forcePass: `${forcePass}/${FORCE_N}`,
    pass:
      coldPass === COLD_N &&
      warmPass === WARM_N &&
      forcePass === FORCE_N &&
      out.globals.stickyClears === 0 &&
      out.globals.orphans === 0 &&
      out.globals.zombies === 0,
  };
  return out;
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
  );

  const results = {};
  for (const name of ["BEER", "HANSOME", "GME", "OKC"]) {
    results[name] = await runToken(name);
  }

  const allPass = Object.values(results).every((r) => r.summary?.pass);
  const report = {
    phase: "13E.1",
    base: BASE,
    expectedScope: EXPECTED_SCOPE,
    health: healthRoot,
    tokenCounts: TOKEN_COUNTS,
    results,
    verdict: allPass ? "PASS" : "FAIL",
    finishedAt: new Date().toISOString(),
  };
  const outPath = join(OUT_DIR, "phase13e1_product_cert.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log("\nWrote", outPath);
  console.log("VERDICT", report.verdict);
  process.exit(allPass ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
