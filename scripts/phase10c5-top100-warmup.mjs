#!/usr/bin/env node
/** Fire-and-poll Top100 onto candidate tip so warm compare can complete. */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "reports", "data");
const CAND = process.env.HANSOME_GATE_BASE || "https://hansomealpacas.vercel.app";
const BEER = "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804";
const HANSOME = "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CORE7 = [
  HANSOME,
  "0x57ffd85d9f0744b7790dcdbbc2c0f188f81de00f",
  "0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1",
  "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3",
  "0x020bfc650a365f8bb26819deaabf3e21291018b4",
  "0x39dbed3a2bd333467115de45665cc57f813c4571",
  "0x69984ad3322300039f2855f81c44dbc532efe744",
];

async function fetchJson(url, timeoutMs = 45_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function sampleAddrs() {
  let sample = [BEER, ...CORE7];
  const corpusPath = join(OUT, "robinhood_top100_burn_explainability_corpus.json");
  if (existsSync(corpusPath)) {
    try {
      const corpus = JSON.parse(readFileSync(corpusPath, "utf8"));
      const addrs = (corpus.addresses || corpus.tokens || [])
        .map((x) => (typeof x === "string" ? x : x.address))
        .filter(Boolean);
      if (addrs.length >= 20) sample = addrs.slice(0, 100);
    } catch {
      /* keep */
    }
  }
  return [...new Set(sample.map((a) => a.toLowerCase()))].slice(0, 100);
}

function isTerm(j) {
  const r = j?.result || j || {};
  const st = r.analysisStages?.liquidity;
  const ts = r.lpTerminal?.terminalState;
  if (ts === "SUCCESS_TERMINAL" || ts === "FAILED_TERMINAL") return true;
  return (
    st === "done" ||
    st === "partial" ||
    st === "unknown" ||
    st === "failed" ||
    r.analysisStatus === "complete" ||
    r.analysisStatus === "partial" ||
    r.analysisStatus === "failed"
  );
}

async function main() {
  const addrs = sampleAddrs();
  console.error(`warmup ${addrs.length} addresses on ${CAND}`);
  // Wave 1: kick scans (no forceLp — cheaper; still fills candidate scope).
  for (let i = 0; i < addrs.length; i++) {
    const addr = addrs[i];
    process.stderr.write(`kick ${i + 1}/${addrs.length}\r`);
    void fetchJson(`${CAND}/api/scan?address=${addr}&refresh=1`, 20_000);
    await sleep(400);
  }
  console.error("\nkicked — polling terminals…");
  const t0 = Date.now();
  const maxMs = 25 * 60_000;
  let terminal = 0;
  while (Date.now() - t0 < maxMs) {
    terminal = 0;
    for (const addr of addrs) {
      const j = await fetchJson(`${CAND}/api/scan/status?address=${addr}`, 20_000);
      if (isTerm(j?.result || j)) terminal += 1;
      await sleep(50);
    }
    console.error(`terminal ${terminal}/${addrs.length}`);
    if (terminal >= Math.min(90, addrs.length)) break;
    await sleep(20_000);
  }
  const report = {
    at: new Date().toISOString(),
    terminal,
    attempted: addrs.length,
  };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "phase10c5_top100_warmup.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  process.exit(terminal >= 50 ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
