/**
 * Quick on-chain check for Testnet gasless resolve prerequisites.
 * Usage: npx hardhat run scripts/verify-testnet-gasless.ts --network robinhoodTestnet
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { getDeployerSigner } from "./lib/signer";

async function main() {
  const path = join(__dirname, "..", "deployments", `${network.name}-game.json`);
  const record = JSON.parse(readFileSync(path, "utf8")) as {
    address: string;
    randomness: string;
  };
  const deployer = await getDeployerSigner(ethers.provider);
  const game = await ethers.getContractAt("HansomeGame", record.address, deployer);
  const randomness = await ethers.getContractAt(
    "GameRandomness",
    record.randomness,
    deployer,
  );

  const owner = await game.owner();
  const provider = await randomness.randomnessProvider();
  console.log({
    game: record.address,
    owner,
    signer: deployer.address,
    ownerMatchesSigner: owner.toLowerCase() === deployer.address.toLowerCase(),
    randomnessProvider: provider,
    providerMatchesSigner:
      provider.toLowerCase() === deployer.address.toLowerCase(),
    dayLength: Number(await game.dayLength()),
    commitDuration: Number(await game.commitDuration()),
    revealDuration: Number(await game.revealDuration()),
    dayState0: Number(await game.dayState(0)),
    hasRelayerFn:
      typeof (game as { testnetRelayerRevealBatch?: unknown })
        .testnetRelayerRevealBatch === "function",
  });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
