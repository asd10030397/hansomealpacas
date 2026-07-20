/**
 * Smoke-read batched settlement API on the deployed Testnet game.
 * Usage: npx hardhat run scripts/smoke-batched-game.ts --network robinhoodTestnet
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";

async function main() {
  const path = join(__dirname, "..", "deployments", `${network.name}-game.json`);
  if (!existsSync(path)) throw new Error(`Missing ${path}`);
  const rec = JSON.parse(readFileSync(path, "utf8")) as { address: string };
  const g = await ethers.getContractAt("HansomeGame", rec.address);
  console.log({
    game: rec.address,
    maxReveal: (await g.MAX_REVEAL_BATCH()).toString(),
    maxCredit: (await g.MAX_CREDIT_BATCH()).toString(),
    unlock: await g.testnetGameplayUnlock(),
    isFinalized0: await g.isFinalized(0),
    isSettled0: await g.isSettled(0),
    currentDay: (await g.currentDay()).toString(),
  });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
