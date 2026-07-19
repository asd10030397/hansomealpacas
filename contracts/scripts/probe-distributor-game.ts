/**
 * Read which HansomeGame RewardDistributor / GameTreasury currently authorize.
 * Usage: npx hardhat run scripts/probe-distributor-game.ts --network robinhoodTestnet
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";

async function main() {
  const recordPath = join(__dirname, "..", "deployments", `${network.name}-game.json`);
  if (!existsSync(recordPath)) throw new Error(`Missing ${recordPath}`);
  const record = JSON.parse(readFileSync(recordPath, "utf8")) as {
    address: string;
    distributor: string;
    treasury: string;
  };

  const oldGame = "0x1F41a223b883520b61743FEF7a2a8541cfABf8D4";
  const dist = await ethers.getContractAt("RewardDistributor", record.distributor);
  const treas = await ethers.getContractAt("GameTreasury", record.treasury);
  const old = await ethers.getContractAt("HansomeGame", oldGame);
  const neu = await ethers.getContractAt("HansomeGame", record.address);

  const distributorGame = await dist.game();
  const treasuryGame = await treas.game();

  console.log(
    JSON.stringify(
      {
        expectedNewGame: record.address,
        distributorGame,
        treasuryGame,
        distributorPointsToNew:
          distributorGame.toLowerCase() === record.address.toLowerCase(),
        treasuryPointsToNew:
          treasuryGame.toLowerCase() === record.address.toLowerCase(),
        oldGameCurrentDay: Number(await old.currentDay()),
        newGameCurrentDay: Number(await neu.currentDay()),
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
