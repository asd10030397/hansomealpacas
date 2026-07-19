/**
 * Offline SettlementLib combat statistics (no chain txs).
 *
 * Usage: npx hardhat run scripts/sim-cougar-combat-offline.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers } from "hardhat";
import { SettlementLibHarness } from "../typechain-types";

const Class = {
  Common: 1,
  Guardian: 2,
  Farmer: 3,
  Lucky: 4,
  Runner: 5,
  King: 6,
} as const;

const LOC = 2; // Grassland
const PI0_GRASS = 2500; // Candidate A Grassland π₀
const N = Number(process.env.COMBAT_SIM_N ?? "1000");
const RD = ethers.parseEther("100000");

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function prePenaltyBps(adL: number, cdL: number): number {
  if (cdL === 0) return 0;
  return Math.min(Math.floor((PI0_GRASS * (adL + cdL)) / (adL + 1)), 9000);
}

async function main() {
  const lib = (await (
    await ethers.getContractFactory("SettlementLibHarness")
  ).deploy()) as SettlementLibHarness;
  await lib.waitForDeployment();

  const rng = mulberry32(0xc0ffee);
  const cases: Array<{
    name: string;
    alpacaCount: number;
    cougarCount: number;
  }> = [
    { name: "1_cougar_vs_many_alpacas", alpacaCount: 6, cougarCount: 1 },
    { name: "multi_cougar_vs_multi_alpaca", alpacaCount: 6, cougarCount: 3 },
  ];

  const summary: Record<string, unknown> = {
    nPerCase: N,
    location: "Grassland",
    locationId: LOC,
    rd: "100000",
    note:
      "GDS: hunt applies location penalty π to Alpaca Ra share (not kill-to-zero). Cougars earn Rc + Rh when Ad≥1 at huntable loc.",
  };

  for (const c of cases) {
    let huntedCount = 0;
    let escapedCount = 0; // penalty zeroed by skill (King always / Runner Lucky success)
    let alpacaRewardSum = 0n;
    let cougarRewardSum = 0n;
    let penSum = 0n;
    let huntRhAssigned = 0;
    let huntRhDust = 0;
    const classPen: Record<string, { n: number; penBpsSum: number; netSum: bigint }> =
      {};

    for (let i = 0; i < N; i++) {
      const alpacas = [
        { tokenId: 1n, locationId: LOC, gameplayClass: Class.Common, runnerSuccess: false, luckySuccess: false },
        { tokenId: 2n, locationId: LOC, gameplayClass: Class.King, runnerSuccess: false, luckySuccess: false },
        { tokenId: 3n, locationId: LOC, gameplayClass: Class.Guardian, runnerSuccess: false, luckySuccess: false },
        { tokenId: 4n, locationId: LOC, gameplayClass: Class.Runner, runnerSuccess: rng() < 0.3, luckySuccess: false },
        { tokenId: 5n, locationId: LOC, gameplayClass: Class.Lucky, runnerSuccess: false, luckySuccess: rng() < 0.2 },
        { tokenId: 6n, locationId: LOC, gameplayClass: Class.Farmer, runnerSuccess: false, luckySuccess: false },
      ].slice(0, c.alpacaCount);

      const cougars = Array.from({ length: c.cougarCount }, (_, j) => ({
        tokenId: BigInt(100 + j),
        locationId: LOC,
      }));

      const r = await lib.settle(RD, alpacas, cougars);
      const adL = c.alpacaCount;
      const cdL = c.cougarCount;
      const pre = prePenaltyBps(adL, cdL);
      if (pre > 0) huntedCount += alpacas.length;

      for (let a = 0; a < alpacas.length; a++) {
        const cls = alpacas[a]!.gameplayClass;
        const name =
          cls === Class.Common
            ? "Common"
            : cls === Class.King
              ? "King"
              : cls === Class.Guardian
                ? "Guardian"
                : cls === Class.Runner
                  ? "Runner"
                  : cls === Class.Lucky
                    ? "Lucky"
                    : "Farmer";
        const net = r.alpacaNets[a]!;
        alpacaRewardSum += net;
        // Approximate pen from pre tables for stats (exact pen is in r.pen)
        let penBps = 0;
        if (cls === Class.King) penBps = 0;
        else if (cls === Class.Guardian) penBps = Math.floor(pre / 2);
        else if (cls === Class.Runner)
          penBps = alpacas[a]!.runnerSuccess ? 0 : pre;
        else if (cls === Class.Lucky)
          penBps = alpacas[a]!.luckySuccess ? 0 : pre;
        else penBps = pre;
        if (pre > 0 && penBps === 0) escapedCount += 1;
        if (!classPen[name]) classPen[name] = { n: 0, penBpsSum: 0, netSum: 0n };
        classPen[name]!.n += 1;
        classPen[name]!.penBpsSum += penBps;
        classPen[name]!.netSum += net;
      }

      for (const t of r.cougarTotals) cougarRewardSum += t;
      penSum += r.pen;
      if (r.huntDust > 0n) huntRhDust += 1;
      else huntRhAssigned += 1;
    }

    const alpacaN = BigInt(N * c.alpacaCount);
    const cougarN = BigInt(N * c.cougarCount);
    summary[c.name] = {
      battles: N,
      alpacaCount: c.alpacaCount,
      cougarCount: c.cougarCount,
      prePenaltyBps: prePenaltyBps(c.alpacaCount, c.cougarCount),
      huntPressureRate:
        "100% when Cd≥1 at Grassland (deterministic GDS — no separate hunt RNG)",
      alpacaEscapeOrImmuneRate: escapedCount / (N * c.alpacaCount),
      avgAlpacaReward: ethers.formatEther(alpacaRewardSum / alpacaN),
      avgCougarReward: ethers.formatEther(cougarRewardSum / cougarN),
      avgPenPerBattle: ethers.formatEther(penSum / BigInt(N)),
      huntRhAssignedBattles: huntRhAssigned,
      huntRhDustBattles: huntRhDust,
      byClass: Object.fromEntries(
        Object.entries(classPen).map(([k, v]) => [
          k,
          {
            avgPenBps: v.penBpsSum / v.n,
            avgNet: ethers.formatEther(v.netSum / BigInt(v.n)),
          },
        ]),
      ),
    };
  }

  // Control: same alpacas, zero cougars
  let controlAlpaca = 0n;
  {
    const alpacas = [
      { tokenId: 1n, locationId: LOC, gameplayClass: Class.Common, runnerSuccess: false, luckySuccess: false },
      { tokenId: 2n, locationId: LOC, gameplayClass: Class.King, runnerSuccess: false, luckySuccess: false },
      { tokenId: 3n, locationId: LOC, gameplayClass: Class.Guardian, runnerSuccess: false, luckySuccess: false },
      { tokenId: 4n, locationId: LOC, gameplayClass: Class.Runner, runnerSuccess: false, luckySuccess: false },
      { tokenId: 5n, locationId: LOC, gameplayClass: Class.Lucky, runnerSuccess: false, luckySuccess: false },
      { tokenId: 6n, locationId: LOC, gameplayClass: Class.Farmer, runnerSuccess: false, luckySuccess: false },
    ];
    const r = await lib.settle(RD, alpacas, []);
    for (const n of r.alpacaNets) controlAlpaca += n;
    summary.controlNoCougar = {
      totalAlpacaNet: ethers.formatEther(controlAlpaca),
      pen: ethers.formatEther(r.pen),
      note: "pen must be 0; Rc+Rh unallocated",
    };
  }

  const outDir = join(__dirname, "..", "..", "reports", "testnet");
  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, "cougar-combat-offline-1000.json");
  writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  console.log("Wrote", jsonPath);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
