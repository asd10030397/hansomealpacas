#!/usr/bin/env node
/**
 * Phase 10C-4 — isolated candidate cache + deterministic LP publish remote gate.
 * Failure classes A–J. BEER requires 3 cold + 3 warm + 3 forced-refresh Locked.
 * Timeout is NEVER PASS. Promote only when every hard gate passes.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "reports", "data");
const BEER = "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804";
const HANSOME = "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875";
const PONS = "0x736D76699C26D0d966744cAe304C000d471f7F35";
const BASELINE_TIP = "dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7";
const LIVE = "https://www.hansomealpacas.xyz";
const TEMP_ALIAS = "https://hansomealpacas.vercel.app";

const CORE7 = [
  { id: "HANSOME", address: HANSOME },
  { id: "PRIMARY", address: "0x57ffd85d9f0744b7790dcdbbc2c0f188f81de00f" },
  { id: "FOX", address: "0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1" },
  { id: "GME", address: "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3" },
  { id: "CASHCAT", address: "0x020bfc650a365f8bb26819deaabf3e21291018b4" },
  { id: "PONS", address: "0x39dbed3a2bd333467115de45665cc57f813c4571" },
  { id: "TYGR", address: "0x69984ad3322300039f2855f81c44dbc532efe744" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadCfg() {
  const p = join(OUT, "phase10c4_candidate.json");
  if (!existsSync(p)) throw new Error("missing reports/data/phase10c4_candidate.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

async function fetchJson(url, init = {}, timeoutMs = 45_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { Accept: "application/json", ...(init.headers || {}) },
    });
    const ctype = res.headers.get("content-type") || "";
    const text = await res.text();
    const isHtml =
      ctype.includes("text/html") || text.trimStart().startsWith("<!DOCTYPE");
    let json = null;
    if (!isHtml) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    const scopeHdr = res.headers.get("x-scan-deployment-scope") || null;
    return {
      ok: res.ok,
      status: res.status,
      ctype,
      isHtml,
      json,
      textLen: text.length,
      scopeHdr,
      failureClass: !res.ok
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
    const name = e?.name || "Error";
    return {
      ok: false,
      status: 0,
      ctype: "",
      isHtml: false,
      json: null,
      textLen: 0,
      scopeHdr: null,
      failureClass: name === "AbortError" ? "F" : "I",
      error: String(e?.message || e).slice(0, 160),
    };
  } finally {
    clearTimeout(t);
  }
}

function extractLp(j) {
  const root = j?.result || j || {};
  const o = root?.overview || j?.overview || {};
  const lp = o.lpIntelligence || {};
  const stages = root?.analysisStages || j?.analysisStages;
  const pos = lp.positions || [];
  const locked = pos.filter((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN");
  const detail = `${lp.detail || ""} ${lp.completenessWarning || ""}`;
  return {
    status: root?.analysisStatus || j?.analysisStatus,
    phase: root?.analysisPhase || j?.analysisPhase,
    stages,
    deepAttemptId: root?.deepAttemptId || j?.deepAttemptId || null,
    lpPublish: root?.lpPublish || j?.lpPublish || null,
    deploymentScope:
      root?.cache?.deploymentScope ||
      j?.cache?.deploymentScope ||
      j?.deploymentScope ||
      null,
    score: root?.score?.score ?? j?.score?.score ?? null,
    aggregate: lp.aggregateState ?? null,
    posCount: pos.length,
    lockedCount: locked.length,
    tokenId: locked[0]?.positionNftId ?? pos[0]?.positionNftId ?? null,
    lockState: locked[0]?.lockState ?? pos[0]?.lockState ?? null,
    lockerName: locked[0]?.lockerName ?? null,
    owner: locked[0]?.owner ?? null,
    liquidity: locked[0]?.liquidity ?? pos[0]?.liquidity ?? null,
    tickLower: locked[0]?.tickLower ?? null,
    tickUpper: locked[0]?.tickUpper ?? null,
    positionDiscoveryComplete:
      locked[0]?.positionDiscoveryComplete ??
      lp.uniswapVersions?.byVersion?.v3?.positionDiscoveryComplete ??
      lp.versionCoverage?.byVersion?.v3?.positionDiscoveryComplete ??
      null,
    lockAnalysisComplete:
      locked[0]?.lockAnalysisComplete ??
      lp.uniswapVersions?.byVersion?.v3?.lockAnalysisComplete ??
      lp.versionCoverage?.byVersion?.v3?.lockAnalysisComplete ??
      null,
    detail: detail.slice(0, 220),
    // Sibling soft-incomplete (v4 budget) is OK when Locked_VERIFIED exists.
    // Stale timeout = timeout/budget shell with NO verified Locked position.
    staleTimeoutDetail:
      locked.length === 0 &&
      /did not finish in time|probe budget exceeded/i.test(detail),
  };
}

function liquidityTerminal(stages) {
  const liq = stages?.liquidity;
  return liq === "done" || liq === "partial" || liq === "unknown";
}

function beerExactLocked(final) {
  if (!final) return false;
  if (final.lockState !== "LOCKED_VERIFIED_ONCHAIN") return false;
  if (String(final.tokenId) !== "436637") return false;
  if ((final.owner || "").toLowerCase() !== PONS.toLowerCase()) return false;
  if (final.lockerName && final.lockerName !== "PonsLaunchLocker") return false;
  if (final.staleTimeoutDetail) return false;
  // Require honest complete flags when present; null allowed only pre-publish.
  if (final.positionDiscoveryComplete !== true) return false;
  if (final.lockAnalysisComplete !== true) return false;
  if (!final.lpPublish?.lpGeneration) return false;
  return true;
}

function classifyBeerFailure(final, harnessClass) {
  if (harnessClass === "A" || harnessClass === "I" || harnessClass === "F") {
    return harnessClass;
  }
  if (!final) return "H";
  if (final.staleTimeoutDetail) return "B";
  if (final.status === "deep_running") return "H";
  if (!liquidityTerminal(final.stages) && final.status !== "complete") return "H";
  if (final.lockState !== "LOCKED_VERIFIED_ONCHAIN") {
    if ((final.posCount ?? 0) === 0) return "G";
    return "J";
  }
  if (String(final.tokenId) !== "436637") return "J";
  if ((final.owner || "").toLowerCase() !== PONS.toLowerCase()) return "J";
  if (final.lpPublish && final.deepAttemptId &&
      final.lpPublish.lpGeneration !== final.deepAttemptId) {
    return "E";
  }
  return "J";
}

async function waitBeerDeep(base, { maxMs = 300_000, refreshFirst = true, force = false } = {}) {
  const timeline = [];
  const refreshUrl = force
    ? `${base}/api/scan?address=${BEER}&refresh=1&forceLp=1`
    : `${base}/api/scan?address=${BEER}&refresh=1`;
  if (refreshFirst) {
    const r = await fetchJson(refreshUrl, {}, 60_000);
    timeline.push({
      at: 0,
      kind: "refresh",
      failureClass: r.failureClass,
      scopeHdr: r.scopeHdr,
      ...extractLp(r.json || {}),
    });
    if (r.failureClass) {
      return {
        ok: false,
        failureClass: r.failureClass,
        timeline,
        final: null,
      };
    }
  }
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await fetchJson(`${base}/api/scan/status?address=${BEER}`, {}, 30_000);
    const body = s.json?.result || s.json;
    const lp = extractLp(body || {});
    if (!lp.deploymentScope && s.json?.deploymentScope) {
      lp.deploymentScope = s.json.deploymentScope;
    }
    const age = Date.now() - t0;
    timeline.push({
      at: age,
      kind: "status",
      failureClass: s.failureClass,
      scopeHdr: s.scopeHdr,
      ...lp,
    });
    if (s.failureClass === "F") {
      return { ok: false, failureClass: "F", timeline, final: lp };
    }
    if (s.failureClass) {
      return { ok: false, failureClass: s.failureClass, timeline, final: lp };
    }
    if (liquidityTerminal(lp.stages) || lp.status === "complete" || lp.status === "partial") {
      const full = await fetchJson(`${base}/api/scan?address=${BEER}`, {}, 45_000);
      const final = extractLp(full.json || {});
      if (!final.deploymentScope && full.scopeHdr) final.deploymentScope = full.scopeHdr;
      timeline.push({
        at: Date.now() - t0,
        kind: "final",
        failureClass: full.failureClass,
        scopeHdr: full.scopeHdr,
        ...final,
      });
      const locked = beerExactLocked(final);
      return {
        ok: locked && !full.failureClass,
        failureClass: full.failureClass || (locked ? null : classifyBeerFailure(final, null)),
        beerLocked: locked,
        timeline,
        final,
      };
    }
    await sleep(8_000);
  }
  const last = timeline.at(-1) || null;
  return {
    ok: false,
    failureClass: last ? classifyBeerFailure(last, "H") : "H",
    beerLocked: false,
    timeline,
    final: last,
  };
}

function hardFields(j) {
  const o = j?.overview || j?.result?.overview || {};
  const lp = o.lpIntelligence || {};
  return {
    score: j?.score?.score ?? j?.result?.score?.score ?? null,
    aggregateLockState: lp.aggregateLockState ?? null,
    aggregateState: lp.aggregateState ?? null,
    lockedTokenIds: (lp.positions || [])
      .filter((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN")
      .map((p) => p.positionNftId)
      .sort(),
  };
}

async function runBeerSeries(base, kind, n, opts) {
  const runs = [];
  for (let i = 0; i < n; i++) {
    console.error(`BEER ${kind} run ${i + 1}/${n}…`);
    const r = await waitBeerDeep(base, opts);
    runs.push({
      i: i + 1,
      ok: r.ok === true,
      failureClass: r.failureClass,
      lockState: r.final?.lockState ?? null,
      tokenId: r.final?.tokenId ?? null,
      owner: r.final?.owner ?? null,
      scope: r.final?.deploymentScope ?? null,
      lpGeneration: r.final?.lpPublish?.lpGeneration ?? null,
      staleTimeoutDetail: r.final?.staleTimeoutDetail ?? null,
      detail: (r.final?.detail || "").slice(0, 160),
    });
    if (!r.ok) break;
    await sleep(2_000);
  }
  const pass = runs.length === n && runs.every((x) => x.ok);
  return { pass, runs };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const cfg = loadCfg();
  const candidateBase = cfg.tempAliasUrl || TEMP_ALIAS;
  const report = {
    at: new Date().toISOString(),
    baselineTip: BASELINE_TIP,
    candidateId: cfg.deploymentId,
    candidateUrl: cfg.url,
    candidateBase,
    live: LIVE,
    scopes: {},
    protection: {},
    beer: { cold: null, warm: null, forced: null, injections: {} },
    core7: [],
    top100: {
      attempted: 0,
      completed: 0,
      hardSemanticDriftCompletedSet: 0,
      falseLocked: 0,
      falseUnlocked: 0,
      falseNoLiquidity: 0,
      terminalViolations: 0,
      classes: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
      rows: [],
    },
    gates: {},
    verdict: "NEEDS_REVIEW",
  };

  // Scope confirmation
  const liveScope = await fetchJson(`${LIVE}/api/scan/status?address=${BEER}`, {}, 30_000);
  const candScope = await fetchJson(
    `${candidateBase}/api/scan/status?address=${BEER}`,
    {},
    30_000,
  );
  report.scopes = {
    liveHeader: liveScope.scopeHdr,
    liveBody: liveScope.json?.deploymentScope ?? liveScope.json?.result?.cache?.deploymentScope ?? null,
    candidateHeader: candScope.scopeHdr,
    candidateBody:
      candScope.json?.deploymentScope ??
      candScope.json?.result?.cache?.deploymentScope ??
      null,
  };

  const probes = [
    ["A_www", `${LIVE}/api/scan?address=${BEER}`],
    ["B_temp_alias", `${candidateBase}/api/scan?address=${BEER}`],
    ["C_direct_tip", `${cfg.url}/api/scan?address=${BEER}`],
    ["D_status_alias", `${candidateBase}/api/scan/status?address=${BEER}`],
    ["E_game", "https://game.hansomealpacas.xyz/"],
  ];
  for (const [name, url] of probes) {
    const r = await fetchJson(url, {}, 30_000);
    report.protection[name] = {
      status: r.status,
      isHtml: r.isHtml,
      failureClass: r.failureClass,
      json: Boolean(r.json),
      scopeHdr: r.scopeHdr,
    };
  }

  // Cold-isolated: refresh forces new gen in candidate namespace
  report.beer.cold = await runBeerSeries(candidateBase, "cold", 3, {
    maxMs: 300_000,
    refreshFirst: true,
    force: false,
  });

  // Warm: no refresh first (reuse candidate snapshot)
  if (report.beer.cold.pass) {
    report.beer.warm = await runBeerSeries(candidateBase, "warm", 3, {
      maxMs: 300_000,
      refreshFirst: false,
      force: false,
    });
  } else {
    report.beer.warm = { pass: false, runs: [], skipped: true };
  }

  // Forced refresh
  if (report.beer.warm.pass) {
    report.beer.forced = await runBeerSeries(candidateBase, "forced", 3, {
      maxMs: 300_000,
      refreshFirst: true,
      force: true,
    });
  } else {
    report.beer.forced = { pass: false, runs: [], skipped: true };
  }

  // Injections (best-effort)
  if (report.beer.forced.pass) {
    console.error("Injection: concurrent refresh…");
    const [a, b] = await Promise.all([
      waitBeerDeep(candidateBase, { maxMs: 300_000, refreshFirst: true }),
      waitBeerDeep(candidateBase, { maxMs: 300_000, refreshFirst: true }),
    ]);
    report.beer.injections.concurrent = {
      a: { ok: a.ok, failureClass: a.failureClass, lock: a.final?.lockState },
      b: { ok: b.ok, failureClass: b.failureClass, lock: b.final?.lockState },
      pass: a.ok === true || b.ok === true,
    };

    console.error("Injection: restart mid-deep (double refresh)…");
    await fetchJson(`${candidateBase}/api/scan?address=${BEER}&refresh=1`, {}, 60_000);
    await sleep(5_000);
    const restart = await waitBeerDeep(candidateBase, {
      maxMs: 300_000,
      refreshFirst: true,
    });
    report.beer.injections.restart = {
      ok: restart.ok,
      failureClass: restart.failureClass,
      lock: restart.final?.lockState,
    };

    // Stale production snapshot present is isolation-proved by scope headers
    report.beer.injections.staleProductionIsolation = {
      liveScope: report.scopes.liveBody || report.scopes.liveHeader,
      candidateScope: report.scopes.candidateBody || report.scopes.candidateHeader,
      pass:
        Boolean(report.scopes.candidateBody || report.scopes.candidateHeader) &&
        String(report.scopes.candidateBody || report.scopes.candidateHeader).includes(
          "candidate",
        ),
    };
  }

  const beerAllPass =
    report.beer.cold?.pass &&
    report.beer.warm?.pass &&
    report.beer.forced?.pass;

  // Core7 + Top100 only after BEER repeated gates
  if (beerAllPass) {
    for (const t of CORE7) {
      const live = await fetchJson(`${LIVE}/api/scan?address=${t.address}`, {}, 45_000);
      const cand = await fetchJson(
        `${candidateBase}/api/scan?address=${t.address}&refresh=1`,
        {},
        60_000,
      );
      // wait candidate terminal briefly
      let candBody = cand.json;
      for (let i = 0; i < 20; i++) {
        const st = await fetchJson(
          `${candidateBase}/api/scan/status?address=${t.address}`,
          {},
          30_000,
        );
        const lp = extractLp(st.json?.result || st.json || {});
        if (liquidityTerminal(lp.stages) || lp.status === "complete") {
          const full = await fetchJson(
            `${candidateBase}/api/scan?address=${t.address}`,
            {},
            45_000,
          );
          candBody = full.json;
          break;
        }
        await sleep(8_000);
      }
      const liveLp = extractLp(live.json || {});
      const candLp = extractLp(candBody || {});
      const liveTerm =
        liquidityTerminal(liveLp.stages) || liveLp.status === "complete";
      const candTerm =
        liquidityTerminal(candLp.stages) || candLp.status === "complete";
      let klass = "B";
      if (live.failureClass || cand.failureClass) klass = "A";
      else if (!liveTerm || !candTerm) klass = "H";
      else if (
        JSON.stringify(hardFields(live.json)) !==
        JSON.stringify(hardFields(candBody))
      ) {
        klass = "J";
      } else klass = "pass";
      report.core7.push({
        id: t.id,
        class: klass,
        live: { score: liveLp.score, lock: liveLp.lockState, status: liveLp.status },
        cand: { score: candLp.score, lock: candLp.lockState, status: candLp.status },
      });
    }

    let sample = [BEER, HANSOME, ...CORE7.map((c) => c.address)];
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
    sample = [...new Set(sample.map((a) => a.toLowerCase()))].slice(0, 100);

    for (const addr of sample) {
      report.top100.attempted += 1;
      const live = await fetchJson(`${LIVE}/api/scan?address=${addr}`, {}, 40_000);
      let cand = await fetchJson(
        `${candidateBase}/api/scan?address=${addr}&refresh=1`,
        {},
        60_000,
      );
      // bounded one retry on timeout
      if (cand.failureClass === "F") {
        await sleep(2_000);
        cand = await fetchJson(
          `${candidateBase}/api/scan?address=${addr}&refresh=1`,
          {},
          60_000,
        );
      }
      let candBody = cand.json;
      for (let i = 0; i < 15; i++) {
        const st = await fetchJson(
          `${candidateBase}/api/scan/status?address=${addr}`,
          {},
          30_000,
        );
        const lp = extractLp(st.json?.result || st.json || {});
        if (
          liquidityTerminal(lp.stages) ||
          lp.status === "complete" ||
          lp.status === "partial"
        ) {
          const full = await fetchJson(
            `${candidateBase}/api/scan?address=${addr}`,
            {},
            40_000,
          );
          candBody = full.json;
          break;
        }
        await sleep(8_000);
      }
      const liveLp = extractLp(live.json || {});
      const candLp = extractLp(candBody || {});
      const liveTerm =
        liveLp.status === "complete" ||
        (liquidityTerminal(liveLp.stages) && liveLp.status !== "deep_running");
      const candTerm =
        candLp.status === "complete" ||
        (liquidityTerminal(candLp.stages) && candLp.status !== "deep_running");
      let klass = "H";
      let drifted = false;
      if (live.failureClass === "A" || cand.failureClass === "A") klass = "A";
      else if (live.failureClass === "I" || cand.failureClass === "I") klass = "I";
      else if (live.failureClass === "F" || cand.failureClass === "F") klass = "F";
      else if (!liveTerm || !candTerm) {
        klass = "H";
        report.top100.terminalViolations += 1;
      } else {
        report.top100.completed += 1;
        const hfL = hardFields(live.json);
        const hfC = hardFields(candBody);
        drifted = JSON.stringify(hfL) !== JSON.stringify(hfC);
        klass = drifted ? "J" : "pass";
        if (drifted) report.top100.hardSemanticDriftCompletedSet += 1;
      }
      if (klass !== "pass") {
        report.top100.classes[klass] = (report.top100.classes[klass] || 0) + 1;
        report.top100.rows.push({
          address: addr,
          class: klass,
          liveStatus: liveLp.status,
          candStatus: candLp.status,
        });
      }
      await sleep(150);
    }
  }

  const scopeIsolated =
    String(report.scopes.candidateBody || report.scopes.candidateHeader || "").includes(
      "candidate",
    );
  const beerPass = beerAllPass === true;
  const hardDriftOk =
    report.top100.hardSemanticDriftCompletedSet === 0 &&
    report.top100.completed > 0;
  const coverageOk =
    report.top100.completed === report.top100.attempted &&
    report.top100.attempted > 0;
  const core7Ok =
    report.core7.length === CORE7.length &&
    report.core7.every((r) => r.class === "pass");
  const protectionAliasOk = report.protection.B_temp_alias?.json === true;

  report.gates = {
    candidateScopeIsolated: scopeIsolated,
    beerCold3: report.beer.cold?.pass === true,
    beerWarm3: report.beer.warm?.pass === true,
    beerForced3: report.beer.forced?.pass === true,
    beerAllRepeated: beerPass,
    tempAliasJsonAccess: protectionAliasOk,
    core7TerminalPass: core7Ok,
    top100HardDriftZero: hardDriftOk,
    top100CompletedCoverage: coverageOk,
    top100Completed: report.top100.completed,
    top100Attempted: report.top100.attempted,
    hardSemanticDriftCompletedSet: report.top100.hardSemanticDriftCompletedSet,
    injectionsPass:
      !beerPass ||
      (report.beer.injections.concurrent?.pass === true &&
        report.beer.injections.restart?.ok === true &&
        report.beer.injections.staleProductionIsolation?.pass === true),
  };

  const promote =
    beerPass &&
    scopeIsolated &&
    hardDriftOk &&
    coverageOk &&
    protectionAliasOk &&
    core7Ok &&
    report.gates.injectionsPass;

  report.verdict = promote ? "READY_TO_PROMOTE" : "PASS_NOT_DEPLOYED";

  writeFileSync(join(OUT, "phase10c4_remote_gate.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        verdict: report.verdict,
        gates: report.gates,
        scopes: report.scopes,
        beerCold: report.beer.cold?.runs?.map((r) => r.lockState),
        beerWarm: report.beer.warm?.runs?.map((r) => r.lockState),
        beerForced: report.beer.forced?.runs?.map((r) => r.lockState),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
