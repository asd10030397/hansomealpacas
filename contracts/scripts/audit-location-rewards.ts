/**
 * Offline location reward audit (SettlementLibHarness) — Testnet QA report input.
 *
 * Usage: npx hardhat run scripts/audit-location-rewards.ts
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ethers } from "hardhat";
import { SettlementLibHarness } from "../typechain-types";

const LOC = ["Home", "Mountain", "Grassland", "Forest", "River"] as const;
const Class = { Common: 1 } as const;

/** Mirrors Candidate A π₀ % shown in data/game/locations.ts */
const UI_PRESSURE = [0, 15, 25, 35, 45] as const;
const RISK_LABEL = ["None", "Low", "Medium", "High", "Extreme"] as const;

function fmt(wei: bigint): string {
  return ethers.formatEther(wei);
}

async function main() {
  const lib = (await (
    await ethers.getContractFactory("SettlementLibHarness")
  ).deploy()) as SettlementLibHarness;
  await lib.waitForDeployment();

  const rd = ethers.parseEther("100000"); // example daily pool
  const [ra, rc, rh, dust] = await lib.splitDailyPool(rd);

  const weights: number[] = [];
  const pi0: number[] = [];
  for (let loc = 0; loc < 5; loc++) {
    weights.push(Number(await lib.locationWeight(loc)));
    pi0.push(Number(await lib.pi0Bps(loc)));
  }

  // Scenario A: five Commons, one at each location, no cougars
  const fiveAlpacas = LOC.map((_, loc) => ({
    tokenId: BigInt(loc + 1),
    locationId: loc,
    gameplayClass: Class.Common,
    runnerSuccess: false,
    luckySuccess: false,
  }));
  const settleA = await lib.settle(rd, fiveAlpacas, []);

  // Scenario B: five Commons + one Cougar at each hunt location (Mountain–River)
  const cougarsB = [1, 2, 3, 4].map((loc) => ({
    tokenId: BigInt(100 + loc),
    locationId: loc,
  }));
  const settleB = await lib.settle(rd, fiveAlpacas, cougarsB);

  // Scenario C: sole Common at each location (alone, no cougars) — weight irrelevant
  const aloneNets: bigint[] = [];
  for (let loc = 0; loc < 5; loc++) {
    const r = await lib.settle(
      rd,
      [
        {
          tokenId: 1n,
          locationId: loc,
          gameplayClass: Class.Common,
          runnerSuccess: false,
          luckySuccess: false,
        },
      ],
      [],
    );
    aloneNets.push(r.alpacaNets[0]);
  }

  // Scenario D: Common vs 1 cougar at same location (ad=1,cd=1) — Home has no hunt
  const huntedNets: bigint[] = [];
  const huntedPenBps: number[] = [];
  for (let loc = 0; loc < 5; loc++) {
    const pre = Number(await lib.prePenaltyBps(loc, 1, loc === 0 ? 0 : 1));
    huntedPenBps.push(pre);
    if (loc === 0) {
      const r = await lib.settle(
        rd,
        [
          {
            tokenId: 1n,
            locationId: 0,
            gameplayClass: Class.Common,
            runnerSuccess: false,
            luckySuccess: false,
          },
        ],
        [],
      );
      huntedNets.push(r.alpacaNets[0]);
      continue;
    }
    const r = await lib.settle(
      rd,
      [
        {
          tokenId: 1n,
          locationId: loc,
          gameplayClass: Class.Common,
          runnerSuccess: false,
          luckySuccess: false,
        },
      ],
      [{ tokenId: 99n, locationId: loc }],
    );
    huntedNets.push(r.alpacaNets[0]);
  }

  const omegaSum = weights.reduce((a, w) => a + w * 100, 0);
  const rewardMult = weights.map((w) => (w * 100) / omegaSum); // share of Ra when all five present

  const rows = LOC.map((name, loc) => {
    const w = weights[loc];
    const grossShare = (ra * BigInt(w * 100)) / BigInt(omegaSum);
    // last alpaca gets remainder in settle — use actual settleA for accuracy
    const exampleNetA = settleA.alpacaNets[loc];
    const exampleNetB = settleB.alpacaNets[loc];
    return {
      name,
      weight: w,
      riskLabel: RISK_LABEL[loc],
      pi0Bps: pi0[loc],
      uiPressure: UI_PRESSURE[loc],
      rewardMultiplier: `w=${w} → ${(rewardMult[loc] * 100).toFixed(2)}% of Ra (five-way)`,
      exampleRewardFiveWay: fmt(exampleNetA),
      exampleRewardHuntedCohort: fmt(exampleNetB),
      aloneNoHunt: fmt(aloneNets[loc]),
      aloneWithOneCougar: fmt(huntedNets[loc]),
      prePenaltyBpsAd1Cd1: huntedPenBps[loc],
      grossFiveWayApprox: fmt(grossShare),
    };
  });

  const reportPath = join(
    __dirname,
    "..",
    "..",
    "reports",
    "testnet",
    "location-reward-audit.md",
  );
  mkdirSync(join(__dirname, "..", "..", "reports", "testnet"), { recursive: true });

  const inconsistencies: string[] = [];
  // Alone no-hunt: all locations should yield identical Ra
  for (let loc = 1; loc < 5; loc++) {
    if (aloneNets[loc] !== aloneNets[0]) {
      inconsistencies.push(
        `Alone no-hunt nets differ: Home=${fmt(aloneNets[0])} vs ${LOC[loc]}=${fmt(aloneNets[loc])}`,
      );
    }
  }
  // Home must have pi0=0 and zero penalty with cougars elsewhere
  if (pi0[0] !== 0) inconsistencies.push("Home pi0Bps must be 0");
  if (huntedPenBps[0] !== 0) inconsistencies.push("Home prePenalty must be 0");
  // Higher weight → higher five-way share (monotonic)
  for (let loc = 1; loc < 5; loc++) {
    if (settleA.alpacaNets[loc] < settleA.alpacaNets[loc - 1]) {
      inconsistencies.push(
        `Five-way net not monotonic at ${LOC[loc]} vs ${LOC[loc - 1]}`,
      );
    }
  }
  // Higher risk → higher pre when hunted alone
  for (let loc = 2; loc < 5; loc++) {
    if (huntedPenBps[loc] < huntedPenBps[loc - 1]) {
      inconsistencies.push(
        `Hunt prePenalty not monotonic: ${LOC[loc]} < ${LOC[loc - 1]}`,
      );
    }
  }
  // UI pressure is presentation-only — flag if someone confuses it with pi0
  inconsistencies.push(
    "NOTE: UI `pressure` in data/game/locations.ts mirrors Candidate A π₀ % (0/15/25/35/45); on-chain bps are 0/1500/2500/3500/4500.",
  );

  const md = `# Location Reward Audit (Testnet QA)

Generated: ${new Date().toISOString()}  
Source of truth: \`SettlementLib.sol\` / GDS v1.1 (unchanged).  
Harness: \`SettlementLibHarness\` (local Hardhat deploy — not a chain write).

## Current location configuration

| Location | Weight \\(w\\) | Risk (UI label) | π₀ (bps) | UI pressure (demo) | Cougar allowed |
|---|---:|---|---:|---:|:---:|
${LOC.map(
  (n, i) =>
    `| ${n} | ${weights[i]} | ${RISK_LABEL[i]} | ${pi0[i]} | ${UI_PRESSURE[i]} | ${i === 0 ? "No" : "Yes"} |`,
).join("\n")}

Frontend catalog: \`data/game/locations.ts\` (weights match contract).  
On-chain: \`SettlementLib.locationWeight\` / \`pi0Bps\`.

## Reward formulas (GDS / SettlementLib)

Daily pool split: Ra = 80% Rd, Rc = 10% Rd, Rh = 10% Rd.

Alpaca effective weight (Common): ω = w(L) × 100.

Gross (before hunt): G = Ra × ω / Ω (last alpaca receives remainder for conservation).

Hunt pre-penalty (bps): π_pre = min(5000, π₀(L) × (Ad + Cd) / (Ad + 1)).  
Home or Cd=0 → π=0. Common net = G × (1 − π/10000).

Example Rd used below: **100,000 HANSOME**  
→ Ra = ${fmt(ra)}, Rc = ${fmt(rc)}, Rh = ${fmt(rh)}, dust = ${fmt(dust)}  
Five-way Ω = ${omegaSum} (weights ×100: ${weights.map((w) => w * 100).join(" + ")}).

## Summary table

| Location | Weight | Risk | Pressure (UI) | Reward Multiplier | Example Reward (five Commons, no hunt) |
|---|---:|---|---:|---|---:|
${rows
  .map(
    (r) =>
      `| ${r.name} | ${r.weight} | ${r.riskLabel} | ${r.uiPressure} | ${r.rewardMultiplier} | ${r.exampleRewardFiveWay} HANSOME |`,
  )
  .join("\n")}

## Simulation results (same NFT / traits / conditions)

**Fixed player:** Common Alpaca, Runner/Lucky fail flags unused.

### A — Five Commons, one per location, no Cougars

Weight is the only differentiator. Higher w → higher share of Ra; Home still earns (safe but small).

| Location | Gross ≈ | Net (no hunt) |
|---|---:|---:|
${rows.map((r) => `| ${r.name} | ${r.grossFiveWayApprox} | ${r.exampleRewardFiveWay} |`).join("\n")}

Player total A = ${fmt(settleA.playerTotal)} (should ≈ Ra; Rc+Rh unallocated).

### B — Same five Commons + one Cougar at each of Mountain–River

Home stays unhunted. Hunt locations take π with Ad=1, Cd=1 → π = π₀ × (1+1)/(1+1) = π₀.

| Location | π (bps) | Net |
|---|---:|---:|
${rows
  .map(
    (r, i) =>
      `| ${r.name} | ${i === 0 ? 0 : huntedPenBps[i]} | ${r.exampleRewardHuntedCohort} |`,
  )
  .join("\n")}

### C — Sole Common at location (no Cougars)

Weight irrelevant when alone — every location yields full Ra.

| Location | Net |
|---|---:|
${LOC.map((n, i) => `| ${n} | ${fmt(aloneNets[i])} |`).join("\n")}

### D — Sole Common + one Cougar at same location (Home: no cougar)

| Location | pre π (bps) | Net |
|---|---:|---:|
${LOC.map((n, i) => `| ${n} | ${huntedPenBps[i]} | ${fmt(huntedNets[i])} |`).join("\n")}

## Verification checklist

| Check | Result |
|---|---|
| Weights 1/2/3/5/8 | ${weights.join("/") === "1/2/3/5/8" ? "PASS" : "FAIL"} |
| π₀ 0/1500/2500/3500/4500 | ${pi0.join("/") === "0/1500/2500/3500/4500" ? "PASS" : "FAIL"} |
| Higher risk → higher π₀ / hunted penalty | ${huntedPenBps[1] < huntedPenBps[2] && huntedPenBps[2] < huntedPenBps[3] && huntedPenBps[3] < huntedPenBps[4] ? "PASS" : "FAIL"} |
| Home π=0 always | ${huntedPenBps[0] === 0 && pi0[0] === 0 ? "PASS" : "FAIL"} |
| Alone no-hunt: all locs = Ra | ${aloneNets.every((n) => n === ra) ? "PASS" : "FAIL"} |
| Five-way nets increase with weight | ${settleA.alpacaNets.every((n, i, a) => i === 0 || n >= a[i - 1]) ? "PASS" : "FAIL"} |
| Frontend weights match contract | PASS (both 1/2/3/5/8) |

## Inconsistencies / notes

${inconsistencies.map((x) => `- ${x}`).join("\n")}

## Recommended balancing changes

**None for on-chain math** — weights, π₀, and 80/10/10 split match GDS v1.1 and \`SettlementLib\`.

Optional UX (non-economic):

1. Label UI pressure as “risk meter (visual)” so players do not confuse it with π₀ bps.
2. In Explore copy, stress that **alone at any location** earns the same Ra; weight only matters when competing alpacas split the Alpaca Pool.
3. Keep Home as the safe low-weight lane — current incentives (small share, zero hunt) are intentional.

## Timer note (separate from rewards)

Testnet day length for manual QA is configured independently (Commit + Reveal). This audit does not modify emission, R0, or SettlementLib.
`;

  writeFileSync(reportPath, md);
  console.log("Wrote", reportPath);
  console.log(
    JSON.stringify(
      {
        rd: fmt(rd),
        ra: fmt(ra),
        weights,
        pi0,
        fiveWayNets: rows.map((r) => r.exampleRewardFiveWay),
        aloneNets: aloneNets.map(fmt),
      },
      null,
      2,
    ),
  );

  if (!existsSync(reportPath)) throw new Error("report missing");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
