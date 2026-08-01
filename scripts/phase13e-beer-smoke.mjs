#!/usr/bin/env node
/**
 * Phase 13E — BEER Locked smoke (Candidate)
 * Polls /api/scan until LOCKED #436637 or terminal/timeout.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.HANSOME_GATE_BASE || "").replace(/\/$/, "");
const BEER = "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804";
const PONS = "0x736D76699C26D0d966744cAe304C000d471f7F35";
const OUT = join(__dirname, "..", "reports", "data", "phase13e_beer_smoke.json");
const MAX_MS = Number(process.env.HANSOME_SMOKE_MAX_MS || 420_000);
const INTERVAL = 8_000;

if (!BASE) {
  console.error("Set HANSOME_GATE_BASE");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function vercelJson(url, timeoutMs = 180_000) {
  const r = spawnSync("npx", ["vercel", "curl", url, "--yes"], {
    encoding: "utf8",
    shell: true,
    timeout: timeoutMs,
    maxBuffer: 30 * 1024 * 1024,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  const matches = out.match(/\{[\s\S]*\}/g);
  if (!matches?.length) return { ok: false, error: "no_json", raw: out.slice(-1500) };
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      return { ok: true, json: JSON.parse(matches[i]) };
    } catch {
      /* continue */
    }
  }
  return { ok: false, error: "parse_fail" };
}

function extract(j) {
  const root = j?.result || j || {};
  const lp = root?.overview?.lpIntelligence || {};
  const positions = lp.positions || [];
  const locked = positions.find((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN");
  const deepRuntime = j?.deepRuntime || root.deepRuntime || {};
  return {
    analysisStatus: root.analysisStatus ?? null,
    liquidity: root.analysisStages?.liquidity ?? null,
    lease:
      deepRuntime.deepLeaseState ??
      deepRuntime.leaseState ??
      root.deepLeaseState ??
      null,
    retryScheduled:
      deepRuntime.retryScheduled ?? root.deepRetryScheduled ?? null,
    deepInflightLocal: deepRuntime.deepInflightLocal ?? null,
    deepLeaseOwned: deepRuntime.deepLeaseOwned ?? null,
    positions: positions.length,
    lock: locked?.lockState ?? null,
    tid: locked?.positionNftId ?? null,
    owner: locked?.owner ?? null,
    sources: lp.discoverySources || [],
    detail: String(lp.detail || "").slice(0, 120),
    cleared: /LP evidence cleared/i.test(String(lp.detail || "")),
    lpTerminal: root.lpTerminal?.terminalState ?? null,
    scope: root.cache?.deploymentScope ?? null,
    lastTransition: deepRuntime.lastTransition ?? null,
  };
}

const samples = [];
const t0 = Date.now();
console.log(`BASE=${BASE}`);
console.log("trigger refresh=1");
vercelJson(`${BASE}/api/scan?address=${BEER}&refresh=1`, 180_000);

let verdict = "RUNNING";
while (Date.now() - t0 < MAX_MS) {
  await sleep(INTERVAL);
  const t = Math.round((Date.now() - t0) / 1000);
  const res = vercelJson(`${BASE}/api/scan?address=${BEER}&refresh=0`, 120_000);
  if (!res.ok) {
    console.log(`t=${t} fetch_fail=${res.error}`);
    continue;
  }
  const f = extract(res.json);
  samples.push({ t, ...f });
  console.log(
    `t=${t} st=${f.analysisStatus} liq=${f.liquidity} lease=${f.lease} retry=${f.retryScheduled} pos=${f.positions} lock=${f.lock} tid=${f.tid} term=${f.lpTerminal} src=${(f.sources || []).slice(0, 3).join("|")}`,
  );
  if (
    f.lock === "LOCKED_VERIFIED_ONCHAIN" &&
    String(f.tid) === "436637" &&
    (f.owner || "").toLowerCase() === PONS.toLowerCase()
  ) {
    verdict = "LOCKED_OK";
    break;
  }
  if (f.lpTerminal === "FAILED_TERMINAL" && f.liquidity !== "analyzing") {
    verdict = "FAILED_TERMINAL";
    break;
  }
  if (
    f.liquidity &&
    f.liquidity !== "analyzing" &&
    f.liquidity !== "pending" &&
    f.positions > 0 &&
    f.lock === "LOCKED_VERIFIED_ONCHAIN"
  ) {
    verdict = "LOCKED_OK";
    break;
  }
}

mkdirSync(join(__dirname, "..", "reports", "data"), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify({ base: BASE, verdict, samples }, null, 2),
  "utf8",
);
console.log(`verdict=${verdict} samples=${samples.length} -> ${OUT}`);
process.exit(verdict === "LOCKED_OK" ? 0 : 2);
