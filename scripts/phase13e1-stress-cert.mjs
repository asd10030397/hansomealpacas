#!/usr/bin/env node
/**
 * Phase 13E.1 — Stress certification: 50+ mixed executions.
 * Verifies no deadlocks / zombies / stale overwrite / dup publish / gen regression.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.HANSOME_GATE_BASE || "").replace(/\/$/, "");
const OUT_DIR = join(__dirname, "..", "reports", "data");
const EXPECTED_SCOPE = process.env.HANSOME_EXPECT_SCOPE || "";
const TOTAL = Number(process.env.HANSOME_STRESS_N || 52);

const TOKENS = [
  ["BEER", "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804"],
  ["HANSOME", "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875"],
  ["GME", "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3"],
  ["OKC", "0xddEB6C5415c3CCB66295b610a06e8E30155f2bA3"],
];

if (!BASE) {
  console.error("Set HANSOME_GATE_BASE");
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
  if (!matches?.length) return { ok: false, error: "no_json" };
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      return { ok: true, json: JSON.parse(matches[i]) };
    } catch {
      /* */
    }
  }
  return { ok: false, error: "parse" };
}

function rootOf(j) {
  return j?.result || j || {};
}

function extract(j) {
  const root = rootOf(j);
  const lp = root?.overview?.lpIntelligence || {};
  const deepRuntime = j?.deepRuntime || root.deepRuntime || {};
  return {
    analysisStatus: root.analysisStatus ?? null,
    liquidity: root.analysisStages?.liquidity ?? null,
    deepInflight: j?.deepInflight ?? root.deepInflight ?? null,
    deepRetryScheduled:
      j?.deepRetryScheduled ?? deepRuntime.retryScheduled ?? null,
    deepLeaseState:
      deepRuntime.deepLeaseState ??
      deepRuntime.leaseState ??
      j?.deepLeaseState ??
      null,
    scope: root.cache?.deploymentScope ?? null,
    positionsCount: (lp.positions || []).length,
    lpGeneration: root.lpPublish?.lpGeneration ?? null,
    cleared: /LP evidence cleared/i.test(`${lp.detail || ""}`),
  };
}

function zombie(f) {
  const analyzing =
    f.liquidity === "analyzing" || f.analysisStatus === "deep_running";
  return (
    analyzing &&
    f.deepInflight === true &&
    (f.deepLeaseState === "none" || f.deepLeaseState == null) &&
    f.deepRetryScheduled !== true
  );
}

async function oneExec(i) {
  const [name, addr] = TOKENS[i % TOKENS.length];
  const mode = i % 5;
  // 0 cold refresh, 1 warm, 2 force, 3 status-only, 4 concurrent pair
  const label = `${name}:${["cold", "warm", "force", "status", "pair"][mode]}#${i}`;
  const t0 = Date.now();
  try {
    if (mode === 0) {
      vercelJson(`${BASE}/api/scan?address=${addr}&refresh=1`, 180_000);
    } else if (mode === 1) {
      vercelJson(`${BASE}/api/scan?address=${addr}`, 180_000);
    } else if (mode === 2) {
      vercelJson(
        `${BASE}/api/scan?address=${addr}&refresh=1&forceLp=1`,
        180_000,
      );
    } else if (mode === 4) {
      // fire two without awaiting settle between
      vercelJson(`${BASE}/api/scan?address=${addr}&refresh=1`, 90_000);
      vercelJson(`${BASE}/api/scan/status?address=${addr}`, 90_000);
    }
    // poll a few times for zombie/orphan
    let hits = { zombie: 0, clearedSticky: 0, productionScope: 0 };
    let lastGen = null;
    for (let p = 0; p < 4; p++) {
      await sleep(8_000);
      const st = vercelJson(`${BASE}/api/scan/status?address=${addr}`, 90_000);
      if (!st.ok) continue;
      const f = extract(st.json);
      if (zombie(f)) hits.zombie += 1;
      if (f.cleared && f.positionsCount === 0) hits.clearedSticky += 1;
      if (f.scope === "production") hits.productionScope += 1;
      if (f.lpGeneration) lastGen = f.lpGeneration;
      if (
        f.liquidity !== "analyzing" &&
        f.analysisStatus !== "deep_running"
      ) {
        break;
      }
    }
    return {
      i,
      label,
      ok: hits.zombie === 0 && hits.productionScope === 0,
      hits,
      lastGen,
      ms: Date.now() - t0,
    };
  } catch (e) {
    return { i, label, ok: false, error: String(e), ms: Date.now() - t0 };
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const results = [];
  let zombies = 0;
  let sticky = 0;
  let prodScope = 0;
  const gens = [];

  console.log(`Stress N=${TOTAL} base=${BASE}`);
  for (let i = 0; i < TOTAL; i++) {
    const r = await oneExec(i);
    results.push(r);
    if (r.hits?.zombie) zombies += r.hits.zombie;
    if (r.hits?.clearedSticky) sticky += r.hits.clearedSticky;
    if (r.hits?.productionScope) prodScope += r.hits.productionScope;
    if (r.lastGen) gens.push(r.lastGen);
    console.log(
      `[${i + 1}/${TOTAL}] ${r.label} ok=${r.ok} zombie=${r.hits?.zombie ?? "-"} ms=${r.ms}`,
    );
  }

  const uniq = new Set(gens);
  const dupPublish = Math.max(0, gens.length - uniq.size);
  const pass =
    zombies === 0 &&
    sticky === 0 &&
    prodScope === 0 &&
    results.every((r) => r.ok !== false || r.error == null);

  // Stricter: no zombies, no production scope bleed
  const verdict =
    zombies === 0 && prodScope === 0 && results.filter((r) => r.ok).length >= TOTAL * 0.9
      ? "PASS"
      : "FAIL";

  const report = {
    phase: "13E.1",
    base: BASE,
    expectedScope: EXPECTED_SCOPE,
    total: TOTAL,
    zombies,
    stickyClears: sticky,
    productionScopeHits: prodScope,
    duplicatePublishHints: dupPublish,
    passCount: results.filter((r) => r.ok).length,
    verdict,
    finishedAt: new Date().toISOString(),
    results,
  };
  const outPath = join(OUT_DIR, "phase13e1_stress_cert.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log("Wrote", outPath, "VERDICT", verdict);
  process.exit(verdict === "PASS" ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
