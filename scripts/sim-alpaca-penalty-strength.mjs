/**
 * Read-only economic sim of Alpaca hunt-penalty ladders.
 * Mirrors SettlementLib.sol (pi0, prePenalty, trait order, pools 80/10/10).
 * Does not modify contracts.
 */

const RD = 400_000;
const NA = 500;
const NC = 50;
const WEIGHTS = [1, 2, 3, 5, 8]; // Home..River
const FARMER_NUM = 120;
const FARMER_DEN = 100;
const MAX_PRE_BPS = 9000;
const P_RUNNER = 0.3;
const P_LUCKY = 0.2;

const TRAIT_COUNTS = {
  Common: 479,
  Guardian: 5,
  Farmer: 5,
  Lucky: 5,
  Runner: 5,
  King: 1,
};

const LADDERS = {
  /** Live SettlementLib Candidate A (post-approval). */
  Current: [0, 1500, 2500, 3500, 4500],
  Legacy_10_30: [0, 1000, 1500, 2200, 3000],
  A: [0, 1500, 2500, 3500, 4500],
  B: [0, 2000, 3000, 4500, 6000],
  C: [0, 2500, 4000, 6000, 8000],
};

const LOC = { Home: 0, Mountain: 1, Grassland: 2, Forest: 3, River: 4 };
const HUNTABLE = [1, 2, 3, 4];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng, items, weights) {
  let s = 0;
  for (const w of weights) s += w;
  let r = rng() * s;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function buildDeck() {
  const deck = [];
  let id = 1;
  for (const [cls, n] of Object.entries(TRAIT_COUNTS)) {
    for (let i = 0; i < n; i++) deck.push({ id: id++, cls });
  }
  return deck;
}

function prePenaltyBps(pi0, loc, adL, cdL) {
  if (loc === 0 || cdL === 0) return 0;
  const scaled = Math.floor((pi0[loc] * (adL + cdL)) / (adL + 1));
  return Math.min(MAX_PRE_BPS, scaled);
}

function resolvePenaltyBps(pi0, loc, adL, cdL, cls, rng) {
  if (cls === "King") return 0;
  const pre = prePenaltyBps(pi0, loc, adL, cdL);
  if (cls === "Runner") return rng() < P_RUNNER ? 0 : pre;
  if (cls === "Lucky") return rng() < P_LUCKY ? 0 : pre;
  if (cls === "Guardian") return Math.floor(pre / 2);
  return pre; // Common / Farmer
}

function weightNum(loc, cls) {
  const w = WEIGHTS[loc];
  return cls === "Farmer" ? w * FARMER_NUM : w * FARMER_DEN;
}

function settleDay(pi0, alpacas, cougars, rng) {
  const ra = Math.floor((RD * 80) / 100);
  const rc = Math.floor((RD * 10) / 100);
  const rh = Math.floor((RD * 10) / 100);

  const ad = [0, 0, 0, 0, 0];
  const cd = [0, 0, 0, 0, 0];
  for (const a of alpacas) ad[a.loc]++;
  for (const c of cougars) cd[c.loc]++;

  let omega = 0;
  const nums = alpacas.map((a) => {
    const n = weightNum(a.loc, a.cls);
    omega += n;
    return n;
  });

  let penTotal = 0;
  const alpacaRewards = alpacas.map((a, i) => {
    if (omega === 0) return 0;
    const gross = (ra * nums[i]) / omega;
    const piBps = resolvePenaltyBps(pi0, a.loc, ad[a.loc], cd[a.loc], a.cls, rng);
    const pen = (gross * piBps) / 10000;
    penTotal += pen;
    return gross - pen;
  });

  const nC = cougars.length;
  const baseEach = nC > 0 ? rc / nC : 0;
  const success = cougars.map((c) => c.loc !== 0 && ad[c.loc] >= 1);
  const sigma = cougars.map((c, j) => (success[j] ? ad[c.loc] : 0));
  const sigmaSum = sigma.reduce((s, x) => s + x, 0);
  let huntDust = 0;
  let huntDist = 0;
  const cougarRewards = cougars.map((c, j) => {
    let hunt = 0;
    if (sigmaSum === 0) {
      // all fail → dust
    } else if (success[j]) {
      hunt = (rh * sigma[j]) / sigmaSum;
      huntDist += hunt;
    }
    return baseEach + hunt;
  });
  if (sigmaSum === 0) huntDust = rh;
  else huntDust = rh - huntDist;

  return {
    alpacaRewards,
    cougarRewards,
    penTotal,
    huntDust,
    huntDist,
    ad,
    cd,
    successCount: success.filter(Boolean).length,
  };
}

function assignLocations(scenario, deck, rng) {
  const alpacas = deck.map((d) => ({ id: d.id, cls: d.cls, loc: 0 }));
  const cougars = Array.from({ length: NC }, (_, i) => ({
    id: 1000 + i,
    loc: 1,
  }));

  const placeA = (fn) => {
    for (const a of alpacas) a.loc = fn(a, rng);
  };
  const placeC = (fn) => {
    for (const c of cougars) c.loc = fn(c, rng);
  };

  switch (scenario) {
    case "random":
      placeA(() => pickWeighted(rng, [0, 1, 2, 3, 4], [1, 1, 1, 1, 1]));
      placeC(() => pickWeighted(rng, HUNTABLE, [1, 1, 1, 1]));
      break;
    case "rational": {
      // Alpacas lean weight vs mild home; Cougars chase weight
      placeA(() =>
        pickWeighted(rng, [0, 1, 2, 3, 4], [2, 2, 3, 4, 5]),
      );
      placeC(() => pickWeighted(rng, HUNTABLE, [1, 2, 3, 4]));
      break;
    }
    case "cougar_high_risk":
      placeA(() =>
        pickWeighted(rng, [0, 1, 2, 3, 4], [3, 2, 3, 3, 2]),
      );
      placeC(() => pickWeighted(rng, HUNTABLE, [0.5, 1, 2, 4])); // River-heavy
      break;
    case "cougar_even":
      placeA(() =>
        pickWeighted(rng, [0, 1, 2, 3, 4], [2, 2, 3, 3, 3]),
      );
      // exact even 12/13 per huntable
      HUNTABLE.forEach((loc, i) => {
        const start = Math.floor((i * NC) / 4);
        const end = Math.floor(((i + 1) * NC) / 4);
        for (let j = start; j < end; j++) cougars[j].loc = loc;
      });
      break;
    case "alpaca_home":
      placeA(() => (rng() < 0.75 ? 0 : pickWeighted(rng, HUNTABLE, [1, 1, 1, 1])));
      placeC(() => pickWeighted(rng, HUNTABLE, [1, 2, 3, 4]));
      break;
    case "same_owner_split": {
      // Same owner: Alpacas avoid Cougar spots — Home + low overlap
      // Cougars pick high weight; Alpacas mostly Home/Mountain
      placeC(() => pickWeighted(rng, HUNTABLE, [1, 2, 3, 5]));
      const cLocs = new Set(cougars.map((c) => c.loc));
      placeA(() => {
        if (rng() < 0.55) return 0;
        const safe = HUNTABLE.filter((l) => !cLocs.has(l));
        if (safe.length && rng() < 0.7)
          return pickWeighted(rng, safe, safe.map(() => 1));
        return pickWeighted(rng, HUNTABLE, [3, 2, 1, 1]);
      });
      break;
    }
    case "home_flight_mild":
      // Endogenous response to stronger π: more Home, less River
      placeA(() =>
        pickWeighted(rng, [0, 1, 2, 3, 4], [5, 3, 3, 2, 1]),
      );
      placeC(() => pickWeighted(rng, HUNTABLE, [1, 2, 3, 4]));
      break;
    case "home_flight_strong":
      placeA(() =>
        pickWeighted(rng, [0, 1, 2, 3, 4], [8, 3, 2, 1, 0.5]),
      );
      placeC(() => pickWeighted(rng, HUNTABLE, [1, 2, 3, 5]));
      break;
    default:
      throw new Error(scenario);
  }
  return { alpacas, cougars };
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function runScenario(pi0, scenario, days, seed) {
  const rng = mulberry32(seed);
  const deck = buildDeck();
  const byClass = {
    Common: [],
    Guardian: [],
    Farmer: [],
    Lucky: [],
    Runner: [],
    King: [],
  };
  const cougarDaily = [];
  let penSum = 0;
  let huntDistSum = 0;
  let huntDustSum = 0;
  let homeShareSum = 0;
  let riverShareSum = 0;
  let successDay = 0;

  for (let d = 0; d < days; d++) {
    const { alpacas, cougars } = assignLocations(scenario, deck, rng);
    const r = settleDay(pi0, alpacas, cougars, rng);
    penSum += r.penTotal;
    huntDistSum += r.huntDist;
    huntDustSum += r.huntDust;
    if (r.successCount > 0) successDay++;
    homeShareSum += r.ad[0] / NA;
    riverShareSum += r.ad[4] / NA;

    const classBuckets = {
      Common: [],
      Guardian: [],
      Farmer: [],
      Lucky: [],
      Runner: [],
      King: [],
    };
    for (let i = 0; i < alpacas.length; i++) {
      classBuckets[alpacas[i].cls].push(r.alpacaRewards[i]);
    }
    for (const cls of Object.keys(byClass)) {
      byClass[cls].push(mean(classBuckets[cls]));
    }
    cougarDaily.push(mean(r.cougarRewards));
  }

  const common = mean(byClass.Common);
  const cougar = mean(cougarDaily);
  const ratio = common > 0 ? cougar / common : null;

  return {
    scenario,
    days,
    common: +common.toFixed(2),
    traits: Object.fromEntries(
      Object.entries(byClass).map(([k, v]) => [k, +mean(v).toFixed(2)]),
    ),
    traitPremiumVsCommon: Object.fromEntries(
      Object.entries(byClass).map(([k, v]) => {
        const m = mean(v);
        return [k, common > 0 ? +((m / common - 1) * 100).toFixed(1) : null];
      }),
    ),
    cougar: +cougar.toFixed(2),
    ratio: ratio != null ? +ratio.toFixed(3) : null,
    avgTreasuryPen: +(penSum / days).toFixed(1),
    avgHuntDistributed: +(huntDistSum / days).toFixed(1),
    avgHuntDust: +(huntDustSum / days).toFixed(1),
    huntSuccessDayRate: +(successDay / days).toFixed(3),
    avgHomeShare: +(homeShareSum / days).toFixed(3),
    avgRiverShare: +(riverShareSum / days).toFixed(3),
    emissionToCougarsPct: +(((RC_RH_SHARE() * RD) / RD) * 100).toFixed(1),
    rewardConcentration: +(
      (0.2 / (NC / (NA + NC)))
    ).toFixed(2),
  };
}

function RC_RH_SHARE() {
  return 0.2; // fixed pool split
}

function evaluateFlags(row, ladderName) {
  const homeDominant = row.avgHomeShare >= 0.55;
  const riverUnattractive = row.avgRiverShare < 0.05 && row.scenario !== "alpaca_home";
  const ratioOk = row.ratio != null && row.ratio >= 3 && row.ratio <= 5;
  const below3 = row.ratio != null && row.ratio < 3;
  const above5 = row.ratio != null && row.ratio > 5;
  const above6 = row.ratio != null && row.ratio > 6;
  // OP if any special (excl Farmer weight) > +35% vs common on average in mixed play
  const opTraits = Object.entries(row.traitPremiumVsCommon)
    .filter(([k, p]) => k !== "Common" && k !== "Farmer" && p != null && p > 35)
    .map(([k]) => k);
  const weakTraits = Object.entries(row.traitPremiumVsCommon)
    .filter(([k, p]) => ["Guardian", "Runner", "Lucky", "King"].includes(k) && p != null && p < 3)
    .map(([k]) => k);

  return {
    homeDominant,
    riverUnattractive,
    ratioInBand3to5: ratioOk,
    ratioBelow3: below3,
    ratioAbove5: above5,
    ratioAbove6: above6,
    overpoweredTraits: opTraits,
    weakTraits,
    ladder: ladderName,
  };
}

const SCENARIOS = [
  "random",
  "rational",
  "cougar_high_risk",
  "cougar_even",
  "alpaca_home",
  "same_owner_split",
  "home_flight_mild",
  "home_flight_strong",
];

const DAYS = 800;
const results = {};

for (const [name, pi0] of Object.entries(LADDERS)) {
  results[name] = { pi0Bps: pi0, scenarios: {} };
  let seed = 1000 + name.charCodeAt(0);
  for (const sc of SCENARIOS) {
    const row = runScenario(pi0, sc, DAYS, seed++);
    results[name].scenarios[sc] = { ...row, ...evaluateFlags(row, name) };
  }
}

// Aggregate "realistic genesis" = average of rational + cougar_even + random
function summarizeLadder(name) {
  const sc = results[name].scenarios;
  const keys = ["random", "rational", "cougar_even", "cougar_high_risk"];
  const commons = keys.map((k) => sc[k].common);
  const cougars = keys.map((k) => sc[k].cougar);
  const ratios = keys.map((k) => sc[k].ratio);
  const pens = keys.map((k) => sc[k].avgTreasuryPen);
  const homes = keys.map((k) => sc[k].avgHomeShare);
  const rivers = keys.map((k) => sc[k].avgRiverShare);
  const traitAvg = {};
  for (const cls of Object.keys(TRAIT_COUNTS)) {
    traitAvg[cls] = +mean(keys.map((k) => sc[k].traits[cls])).toFixed(2);
  }
  const common = mean(commons);
  const cougar = mean(cougars);
  return {
    ladder: name,
    pi0Bps: LADDERS[name],
    pi0Pct: LADDERS[name].map((b) => b / 100),
    blendScenarios: keys,
    common: +common.toFixed(2),
    cougar: +cougar.toFixed(2),
    ratio: +(cougar / common).toFixed(3),
    traits: traitAvg,
    traitPremiumVsCommon: Object.fromEntries(
      Object.entries(traitAvg).map(([k, v]) => [
        k,
        +((v / common - 1) * 100).toFixed(1),
      ]),
    ),
    avgTreasuryPen: +mean(pens).toFixed(1),
    avgHomeShare: +mean(homes).toFixed(3),
    avgRiverShare: +mean(rivers).toFixed(3),
    ratioMinAcrossAll: +Math.min(
      ...SCENARIOS.map((k) => results[name].scenarios[k].ratio),
    ).toFixed(3),
    ratioMaxAcrossAll: +Math.max(
      ...SCENARIOS.map((k) => results[name].scenarios[k].ratio),
    ).toFixed(3),
  };
}

const summary = Object.keys(LADDERS).map(summarizeLadder);

const out = {
  assumptions: {
    Rd: RD,
    pools: "80/10/10",
    NA,
    NC,
    mintEth: 0.015,
    daysPerScenario: DAYS,
    formulas: "SettlementLib.sol prePenaltyBps + resolvePenaltyBps + splitDailyPool",
    note: "Read-only sim; no contract changes.",
  },
  summary,
  results,
};

import { writeFileSync, mkdirSync } from "fs";
mkdirSync("reports/economics", { recursive: true });
writeFileSync(
  "reports/economics/alpaca-penalty-strength-sim.json",
  JSON.stringify(out, null, 2),
);
console.log(JSON.stringify({ summary }, null, 2));
for (const name of Object.keys(LADDERS)) {
  console.log("\n==", name, "==");
  for (const sc of SCENARIOS) {
    const r = results[name].scenarios[sc];
    console.log(
      sc.padEnd(20),
      "C",
      r.common,
      "Cg",
      r.cougar,
      "x",
      r.ratio,
      "pen",
      r.avgTreasuryPen,
      "home%",
      (r.avgHomeShare * 100).toFixed(1),
      "river%",
      (r.avgRiverShare * 100).toFixed(1),
    );
  }
}
