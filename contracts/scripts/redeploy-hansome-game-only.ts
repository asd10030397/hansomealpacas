/**
 * Redeploy HansomeGame only (reuse treasury / emission / distributor / randomness),
 * rewire setGame, write deployments/<network>-game.json, keep fast Testnet timings.
 *
 * Usage: npx hardhat run scripts/redeploy-hansome-game-only.ts --network robinhoodTestnet
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { resolveGameTiming } from "./lib/game-timing";
import { getDeployerSigner } from "./lib/signer";

async function main() {
  const prevPath = join(__dirname, "..", "deployments", `${network.name}-game.json`);
  if (!existsSync(prevPath)) throw new Error(`Missing ${prevPath}`);
  const prev = JSON.parse(readFileSync(prevPath, "utf8")) as {
    genesis: string;
    token: string;
    tokenDeployed?: boolean;
    treasury: string;
    emission: string;
    distributor: string;
    randomness: string;
    sinks: string;
    treasuryFundedWei?: string;
  };

  const deployer = await getDeployerSigner(ethers.provider);
  const timing = resolveGameTiming(network.name);
  const latest = await ethers.provider.getBlock("latest");
  if (!latest) throw new Error("no block");
  const dayZero = timing.fast ? latest.timestamp : latest.timestamp - (timing.commitDurationSec - 600);

  console.log("Redeploying HansomeGame with", timing);
  const game = await (
    await ethers.getContractFactory("HansomeGame", deployer)
  ).deploy(
    prev.genesis,
    prev.treasury,
    prev.emission,
    prev.distributor,
    prev.randomness,
    dayZero,
    timing.dayLengthSec,
    timing.commitDurationSec,
    timing.revealDurationSec,
    deployer.address,
  );
  await game.waitForDeployment();
  const deployTx = game.deploymentTransaction();
  const receipt = await deployTx!.wait();
  const address = await game.getAddress();
  console.log("HansomeGame:", address);

  const treasury = await ethers.getContractAt("GameTreasury", prev.treasury, deployer);
  const distributor = await ethers.getContractAt(
    "RewardDistributor",
    prev.distributor,
    deployer,
  );
  await (await treasury.setGame(address)).wait();
  await (await distributor.setGame(address)).wait();
  console.log("Rewired treasury + distributor → new game");

  const record = {
    ...prev,
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    contract: "HansomeGame",
    address,
    dayZero,
    dayLengthSec: timing.dayLengthSec,
    commitDurationSec: timing.commitDurationSec,
    revealDurationSec: timing.revealDurationSec,
    fastTiming: timing.fast,
    deployTxHash: receipt!.hash,
    deployBlockNumber: receipt!.blockNumber,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    previousGameNote: "redeploy-hansome-game-only (testnetRelayerRevealBatch)",
  };
  writeFileSync(prevPath, `${JSON.stringify(record, null, 2)}\n`);
  console.log("Wrote", prevPath);
  console.log("dayState(0):", Number(await game.dayState(0)));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
