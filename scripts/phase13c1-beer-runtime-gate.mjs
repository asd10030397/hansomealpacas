#!/usr/bin/env node
/**
 * Phase 13C.1 — targeted BEER runtime gate (NOT full 13C soak).
 * Proves invalid-state is gone: no analyzing/deep_running with
 * deepInflightLocal=true AND lease=none AND !retryScheduled.
 * Force/clear paths recover or terminalize honestly.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.HANSOME_GATE_BASE || "").replace(/\/$/, "");
const OUT_DIR = join(__dirname, "..", "reports", "data");
const BEER = "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804";
const EXPECTED_SCOPE = process.env.HANSOME_EXPECT_SCOPE || "";
const MAX_POLLS = Number(process.env.HANSOME_GATE_POLLS || 24);
const POLL_MS = Number(process.env.HANSOME_GATE_POLL_MS || 5_000);

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

function extract(j) {
  const root = j?.result || j || {};
  const lp = root?.overview?.lpIntelligence || {};
  const rt = j?.deepRuntime || root?.deepRuntime || {};
  const leaseState =
    rt.deepLeaseState ??
    j?.deepLeaseState ??
    (rt.lease ? "valid" : rt.deepLeaseState) ??
    null;
  const retryScheduled =
    j?.deepRetryScheduled === true ||
    rt.deepRetryScheduled === true ||
    root?.deepRuntime?.retryScheduled === true;
  const inflightLocal =
    rt.deepInflightLocal === true ||
    j?.deepInflight === true ||
    root?.deepInflight === true;
  const detail = `${lp.detail || ""}`;
  const cleared = /LP evidence cleared/i.test(detail);
  const liq = root.analysisStages?.liquidity ?? j?.analysisStages?.liquidity;
  const st = j?.analysisStatus ?? root.analysisStatus;
  const analyzing =
    liq === "analyzing" ||
    st === "deep_running" ||
    st === "analyzing";
  return {
    analysisStatus: st ?? null,
    liquidity: liq ?? null,
    deepInflight: j?.deepInflight ?? null,
    deepInflightLocal: rt.deepInflightLocal ?? j?.deepInflight ?? null,
    deepLeaseState: leaseState,
    deepLeaseOwned: rt.deepLeaseOwned === true,
    deepRetryScheduled: retryScheduled,
    deepRetryRequired:
      j?.deepRetryRequired === true || rt.deepRetryRequired === true,
    deepLastTransition: rt.deepLastTransition ?? root?.deepRuntime?.lastTransition,
    deepLastErrorCode: rt.deepLastErrorCode ?? root?.deepRuntime?.lastErrorCode,
    deepGeneration: rt.deepGeneration ?? root?.deepAttemptId ?? null,
    scope: root.cache?.deploymentScope ?? j?.deploymentScope ?? null,
    cleared,
    positionsCount: (lp.positions || []).length,
    detail: detail.slice(0, 160),
    recoveryState: root.lpForceRecovery?.state ?? null,
    durablePrior: root.lpForceRecovery?.durablePrior ?? null,
    analyzing,
    /** Invalid: analyzing + local inflight + no lease + no retryScheduled */
    invalidState:
      analyzing &&
      inflightLocal === true &&
      (leaseState === "none" || leaseState == null) &&
      !retryScheduled &&
      rt.deepLeaseOwned !== true,
  };
}

function isTerminal(f) {
  if (!f) return false;
  if (f.analyzing) return false;
  if (["complete", "partial", "failed"].includes(f.analysisStatus)) return true;
  if (f.liquidity === "done" || f.liquidity === "partial" || f.liquidity === "unknown") {
    return true;
  }
  return false;
}

async function pollStatus(label) {
  const url = `${BASE}/api/scan/status?address=${BEER}`;
  const samples = [];
  let invalidHits = 0;
  for (let i = 0; i < MAX_POLLS; i++) {
    const res = vercelJson(url);
    const f = res.ok ? extract(res.json) : { error: res.error, invalidState: false };
    samples.push({ t: i * POLL_MS, ...f });
    const line = `[${label}] t=${i * POLL_MS}ms st=${f.analysisStatus} liq=${f.liquidity} inflight=${f.deepInflight} inflightLocal=${f.deepInflightLocal} lease=${f.deepLeaseState} owned=${f.deepLeaseOwned} retry=${f.deepRetryScheduled} cleared=${f.cleared} invalid=${f.invalidState} transition=${f.deepLastTransition}`;
    console.log(line);
    if (f.invalidState) invalidHits++;
    if (isTerminal(f) && i >= 2) break;
    await sleep(POLL_MS);
  }
  return { samples, invalidHits };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Phase 13C.1 BEER runtime gate BASE=${BASE}`);
  if (EXPECTED_SCOPE) console.log(`expect scope=${EXPECTED_SCOPE}`);

  // Cold status path (triggers reconcile / orphan / schedule)
  const cold = await pollStatus("cold");

  // Force LP refresh
  console.log("--- forceLp=1 ---");
  const forceUrl = `${BASE}/api/scan?address=${BEER}&refresh=1&forceLp=1`;
  const forceRes = vercelJson(forceUrl, 180_000);
  const forceExtract = forceRes.ok ? extract(forceRes.json) : { error: forceRes.error };
  console.log("[force]", JSON.stringify({
    ok: forceRes.ok,
    st: forceExtract.analysisStatus,
    liq: forceExtract.liquidity,
    cleared: forceExtract.cleared,
    recovery: forceExtract.recoveryState,
    durablePrior: forceExtract.durablePrior,
    invalid: forceExtract.invalidState,
  }));

  const afterForce = await pollStatus("afterForce");

  const allSamples = [...cold.samples, ...afterForce.samples];
  const invalidTotal = cold.invalidHits + afterForce.invalidHits;
  const stickyUncleared =
    allSamples.some(
      (s) =>
        s.cleared === true &&
        isTerminal(s) &&
        !s.durablePrior &&
        s.recoveryState !== "open" &&
        s.recoveryState !== "rolled_back" &&
        s.recoveryState !== "committed" &&
        (s.positionsCount ?? 0) === 0 &&
        !s.deepRetryScheduled &&
        s.deepLeaseState !== "valid",
    );

  const scopeOk =
    !EXPECTED_SCOPE ||
    allSamples.every((s) => !s.scope || s.scope === EXPECTED_SCOPE);

  const pass =
    invalidTotal === 0 &&
    !stickyUncleared &&
    scopeOk &&
    forceRes.ok !== false;

  const summary = {
    phase: "13C.1",
    base: BASE,
    expectedScope: EXPECTED_SCOPE || null,
    token: BEER,
    invalidStateHits: invalidTotal,
    stickyUnclearedWithoutMetadata: stickyUncleared,
    scopeOk,
    coldInvalidHits: cold.invalidHits,
    afterForceInvalidHits: afterForce.invalidHits,
    forceOk: forceRes.ok,
    lastCold: cold.samples[cold.samples.length - 1] ?? null,
    lastAfterForce: afterForce.samples[afterForce.samples.length - 1] ?? null,
    pass,
    verdict: pass ? "PASS" : "FAIL",
  };

  writeFileSync(
    join(OUT_DIR, "phase13c1_beer_runtime_gate.json"),
    JSON.stringify({ summary, cold, afterForce, forceExtract }, null, 2),
  );
  console.log("--- summary ---");
  console.log(JSON.stringify(summary, null, 2));
  process.exit(pass ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
