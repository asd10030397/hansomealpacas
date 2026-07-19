/**
 * Read-only probe of HansomeGame phase timing on the configured network.
 * Usage: npx hardhat run scripts/probe-game-state.ts --network robinhoodTestnet
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";

const DayState: Record<number, string> = {
  0: "Idle",
  1: "CommitOpen",
  2: "CommitClosed",
  3: "RevealOpen",
  4: "RevealClosed",
  5: "Settlement",
  6: "Claimable",
};

async function main() {
  const recordPath = join(__dirname, "..", "deployments", `${network.name}-game.json`);
  if (!existsSync(recordPath)) throw new Error(`Missing ${recordPath}`);
  const record = JSON.parse(readFileSync(recordPath, "utf8")) as {
    address: string;
    distributor: string;
    dayZero: number;
  };

  const game = await ethers.getContractAt("HansomeGame", record.address);
  const latest = await ethers.provider.getBlock("latest");
  if (!latest) throw new Error("Missing latest block");
  const now = latest.timestamp;
  const dayZero = Number(await game.dayZero());
  const currentDay = Number(await game.currentDay());
  const dayLength = Number(await game.dayLength());
  const commitDuration = Number(await game.commitDuration());
  const revealDuration = Number(await game.revealDuration());

  const days = [currentDay, Math.max(0, currentDay - 1), 0].filter(
    (d, i, arr) => arr.indexOf(d) === i,
  );

  const dayInfo = [];
  for (const day of days) {
    const state = Number(await game.dayState(day));
    const start = dayZero + day * dayLength;
    const commitEnd = start + commitDuration;
    const revealEnd = commitEnd + revealDuration;
    let locationOf1: number | string = "n/a";
    try {
      locationOf1 = Number(await game.locationOf(1, day));
    } catch (e) {
      locationOf1 = e instanceof Error ? e.message.slice(0, 60) : "err";
    }
    dayInfo.push({
      day,
      state: DayState[state] ?? state,
      settled: await game.isSettled(day),
      start,
      commitEnd,
      revealEnd,
      secsToCommitEnd: commitEnd - now,
      secsToRevealEnd: revealEnd - now,
      locationOf1,
    });
  }

  console.log(
    JSON.stringify(
      {
        game: record.address,
        distributor: record.distributor,
        now,
        dayZero,
        currentDay,
        dayLength,
        commitDuration,
        revealDuration,
        dayInfo,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
