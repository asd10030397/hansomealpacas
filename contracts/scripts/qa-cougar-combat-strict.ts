/**
 * Strict Cougar combat QA — N live Testnet battles (default 5), same Grassland.
 * Alpacas: King#1 Common#11 Guardian#12 Farmer#13 Lucky#14 Runner#15 + Cougar#16
 *
 * Usage:
 *   QA_BATTLES=5 QA_BASE_URL=http://localhost:3002 \
 *   npx hardhat run scripts/qa-cougar-combat-strict.ts --network robinhoodTestnet
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { getDeployerSigner } from "./lib/signer";

const SAMPLES = [
  { tokenId: 1, label: "Alpaca:King", side: "Alpaca", cls: "King" },
  { tokenId: 11, label: "Alpaca:Common", side: "Alpaca", cls: "Common" },
  { tokenId: 12, label: "Alpaca:Guardian", side: "Alpaca", cls: "Guardian" },
  { tokenId: 13, label: "Alpaca:Farmer", side: "Alpaca", cls: "Farmer" },
  { tokenId: 14, label: "Alpaca:Lucky", side: "Alpaca", cls: "Lucky" },
  { tokenId: 15, label: "Alpaca:Runner", side: "Alpaca", cls: "Runner" },
  { tokenId: 16, label: "Cougar", side: "Cougar", cls: "None" },
] as const;

const HUNT_LOC = 2;
const PURPOSE_RUNNER = 1;
const PURPOSE_LUCKY = 2;
const P_RUNNER_BPS = 3000;
const P_LUCKY_BPS = 2000;
const BATTLES = Number(process.env.QA_BATTLES ?? "5");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitUntil(label: string, pred: () => Promise<boolean>, maxSec: number) {
  const t0 = Date.now();
  while (!(await pred())) {
    if ((Date.now() - t0) / 1000 > maxSec) throw new Error(`Timeout ${label}`);
    console.log(`Waiting ${label}…`);
    await sleep(2_500);
  }
}

async function commitSecondsLeft(game: {
  dayZero: () => Promise<bigint>;
  dayLength: () => Promise<bigint>;
  commitDuration: () => Promise<bigint>;
  currentDay: () => Promise<bigint>;
}): Promise<number> {
  const [dayZero, dayLen, commitDur, day, block] = await Promise.all([
    game.dayZero(),
    game.dayLength(),
    game.commitDuration(),
    game.currentDay(),
    ethers.provider.getBlock("latest"),
  ]);
  const now = Number(block!.timestamp);
  const dayStart = Number(dayZero) + Number(day) * Number(dayLen);
  const commitEnd = dayStart + Number(commitDur);
  return commitEnd - now;
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

function prePenaltyBps(locationId: number, adL: number, cdL: number): number {
  if (locationId === 0 || cdL === 0) return 0;
  const pi0 = 2500; // Candidate A Grassland π₀
  return Math.min(Math.floor((pi0 * (adL + cdL)) / (adL + 1)), 9000);
}

async function main() {
  if (network.name === "robinhood" || network.name.toLowerCase().includes("mainnet")) {
    throw new Error("REFUSED: Testnet-only");
  }

  const base = (process.env.QA_BASE_URL ?? "http://localhost:3002").replace(/\/$/, "");
  const maxWait = Number(process.env.QA_WAIT_SEC ?? "180");
  const record = JSON.parse(
    readFileSync(join(__dirname, "..", "deployments", `${network.name}-game.json`), "utf8"),
  ) as {
    address: string;
    distributor: string;
    randomness: string;
    genesis: string;
    dayLengthSec?: number;
    commitDurationSec?: number;
    revealDurationSec?: number;
  };

  const signer = await getDeployerSigner(ethers.provider);
  const game = await ethers.getContractAt("HansomeGame", record.address, signer);
  const genesis = await ethers.getContractAt("HansomeGenesisNFT", record.genesis, signer);
  const distributor = await ethers.getContractAt(
    "RewardDistributor",
    record.distributor,
    signer,
  );
  const randomness = await ethers.getContractAt("GameRandomness", record.randomness, signer);

  for (const s of SAMPLES) {
    const owner = await genesis.ownerOf(s.tokenId);
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
      throw new Error(`#${s.tokenId} not owned by relayer ${signer.address}`);
    }
  }

  const bugs: string[] = [];
  const battles: unknown[] = [];
  let attempts = 0;
  const maxAttempts = BATTLES + 8;

  for (let b = 0; b < BATTLES && attempts < maxAttempts; ) {
    attempts += 1;
    console.log(`\n=== LIVE BATTLE ${b + 1}/${BATTLES} ===`);

    // Wait for a clean CommitOpen with enough time to commit all 7 tokens.
    await waitUntil(
      "CommitOpen with ≥45s left + clean hashes",
      async () => {
        const d = Number(await game.currentDay());
        if (Number(await game.dayState(d)) !== 1) return false;
        if (await game.isSettled(d)) return false;
        const left = await commitSecondsLeft(game);
        if (left < 45) return false;
        for (const s of SAMPLES) {
          if ((await game.commitHashOf(s.tokenId, d)) !== ethers.ZeroHash) {
            return false;
          }
        }
        return true;
      },
      maxWait * 2,
    );

    let day = Number(await game.currentDay());
    console.log("day", day, "commitSecondsLeft", await commitSecondsLeft(game));

    type Secret = {
      tokenId: number;
      label: string;
      side: string;
      cls: string;
      salt: string;
      commitHash: string;
    };
    const secrets: Secret[] = [];

    for (const s of SAMPLES) {
      if (Number(await game.dayState(day)) !== 1) {
        bugs.push(`Battle ${b + 1}: Commit closed mid-loop at #${s.tokenId}`);
        break;
      }
      const salt = ethers.id(`strict-combat-${day}-${s.tokenId}-${Date.now()}-${b}`);
      const commitHash = await game.computeCommitHash(s.tokenId, day, HUNT_LOC, salt);
      try {
        await game.commit.staticCall(s.tokenId, day, commitHash);
      } catch (e) {
        bugs.push(
          `Battle ${b + 1}: commit simulate #${s.tokenId}: ${
            e instanceof Error ? e.message.slice(0, 140) : e
          }`,
        );
        break;
      }
      const tx = await game.commit(s.tokenId, day, commitHash);
      const receipt = await tx.wait();
      if (receipt!.status !== 1) {
        bugs.push(`Battle ${b + 1}: commit revert #${s.tokenId}`);
        break;
      }
      const vault = await post(`${base}/api/game/testnet-commit-secret`, {
        tokenId: s.tokenId,
        day,
        locationId: HUNT_LOC,
        salt,
        commitHash,
        wallet: signer.address,
      });
      if (vault.status >= 300 || vault.json?.ok === false) {
        bugs.push(`Battle ${b + 1}: vault fail #${s.tokenId}`);
      }
      secrets.push({
        tokenId: s.tokenId,
        label: s.label,
        side: s.side,
        cls: s.cls,
        salt,
        commitHash,
      });
      console.log("committed", s.label, "#"+s.tokenId, "day", day);
    }

    if (secrets.length < 7) {
      bugs.push(
        `Attempt ${attempts}: battle slot ${b + 1} only ${secrets.length}/7 committed — waiting next CommitOpen`,
      );
      await sleep(5_000);
      continue; // retry same battle index
    }

    await waitUntil(
      `RevealOpen(${day})`,
      async () => Number(await game.dayState(day)) >= 3,
      maxWait,
    );

    const resolve = await post(`${base}/api/game/testnet-resolve`, {
      day,
      fulfillSeed: true,
      settle: true,
    });
    console.log("resolve", JSON.stringify(resolve.json).slice(0, 240));
    if (!resolve.json?.ok) {
      bugs.push(`Battle ${b + 1}: resolve failed ${JSON.stringify(resolve.json).slice(0, 160)}`);
    }

    const settled = await game.isSettled(day);
    if (!settled) bugs.push(`Battle ${b + 1}: not settled`);

    let adL = 0;
    let cdL = 0;
    const locations: Record<number, number> = {};
    for (const s of secrets) {
      const loc = Number(await game.locationOf(s.tokenId, day));
      locations[s.tokenId] = loc;
      if (loc !== HUNT_LOC) bugs.push(`Battle ${b + 1}: #${s.tokenId} loc=${loc} ≠ Grassland`);
      if (s.side === "Alpaca") adL += 1;
      else cdL += 1;
    }

    const pre = prePenaltyBps(HUNT_LOC, adL, cdL);
    if (cdL < 1) bugs.push(`Battle ${b + 1}: no cougar in cohort`);
    if (adL < 1) bugs.push(`Battle ${b + 1}: no alpacas in cohort`);
    if (pre <= 0) bugs.push(`Battle ${b + 1}: expected hunt pressure > 0`);

    const rows = [];
    for (const s of secrets) {
      let runnerSuccess = false;
      let luckySuccess = false;
      if (s.cls === "Runner") {
        runnerSuccess = await randomness.bernoulli(day, s.tokenId, PURPOSE_RUNNER, P_RUNNER_BPS);
      }
      if (s.cls === "Lucky") {
        luckySuccess = await randomness.bernoulli(day, s.tokenId, PURPOSE_LUCKY, P_LUCKY_BPS);
      }

      let penBps = 0;
      let outcome = "";
      let ability: string | null = null;
      if (s.side === "Cougar") {
        outcome = adL >= 1 ? "Hunt success (Rh eligible)" : "Hunt miss";
      } else if (s.cls === "King") {
        penBps = 0;
        outcome = "Survived under hunt (King immune)";
        ability = "King activated!";
      } else if (s.cls === "Guardian") {
        penBps = Math.floor(pre / 2);
        outcome = "Hunted — penalty applied";
        ability = "Guardian activated!";
      } else if (s.cls === "Runner") {
        penBps = runnerSuccess ? 0 : pre;
        outcome = runnerSuccess ? "Escaped hunt" : "Hunted — penalty applied";
        ability = runnerSuccess ? "Runner activated!" : null;
      } else if (s.cls === "Lucky") {
        penBps = luckySuccess ? 0 : pre;
        outcome = luckySuccess ? "Survived under hunt" : "Hunted — penalty applied";
        ability = luckySuccess ? "Lucky activated!" : null;
      } else if (s.cls === "Farmer") {
        penBps = pre;
        outcome = "Hunted — penalty applied";
        ability = "Farmer · Harvest Boost";
      } else {
        penBps = pre;
        outcome = "Hunted — penalty applied";
      }

      // Read claimable only — claiming mid-suite burns the next 60s Commit window.
      const claimable = await distributor.claimable(s.tokenId);

      rows.push({
        tokenId: s.tokenId,
        label: s.label,
        species: s.side,
        class: s.cls,
        locationId: locations[s.tokenId],
        locationName: "Grassland",
        hunted: s.side === "Alpaca" && pre > 0,
        penaltyBps: penBps,
        runnerSuccess,
        luckySuccess,
        outcome,
        ability,
        rewardWei: claimable.toString(),
        rewardHansome: ethers.formatEther(claimable),
      });
    }

    // Critical: Common with hunt pressure must not get same share as zero-cougar control.
    // Compare King (0 pen) vs Common (full pen) — Common reward should be lower.
    const king = rows.find((r) => r.class === "King");
    const common = rows.find((r) => r.class === "Common");
    const cougar = rows.find((r) => r.species === "Cougar");
    if (king && common) {
      const k = BigInt(king.rewardWei);
      const c = BigInt(common.rewardWei);
      if (!(c < k)) {
        bugs.push(
          `Battle ${b + 1}: Common reward (${common.rewardHansome}) not < King (${king.rewardHansome}) under hunt — penalty may be missing`,
        );
      }
    }
    if (cougar && BigInt(cougar.rewardWei) === 0n) {
      bugs.push(`Battle ${b + 1}: Cougar reward is 0 — expected Rc share (+ Rh)`);
    }

    battles.push({
      battle: b + 1,
      day,
      ok: settled && secrets.length === 7,
      adL,
      cdL,
      prePenaltyBps: pre,
      resolveOk: Boolean(resolve.json?.ok),
      rows,
    });
    b += 1;
  }

  const outDir = join(__dirname, "..", "..", "reports", "testnet");
  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, "cougar-combat-live-5.json");
  const payload = {
    generatedAt: new Date().toISOString(),
    game: record.address,
    timing: {
      dayLengthSec: record.dayLengthSec,
      commitDurationSec: record.commitDurationSec,
      revealDurationSec: record.revealDurationSec,
    },
    location: "Grassland",
    battlesRequested: BATTLES,
    battles,
    bugs,
  };
  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log("\nBugs:", bugs.length ? bugs : "none");
  console.log("Wrote", jsonPath);
  if (!existsSync(jsonPath)) throw new Error("missing report");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
