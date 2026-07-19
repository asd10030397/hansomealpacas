/**
 * Activate HansomeGame.testnetGameplayUnlock with FY-assigned packed identities
 * matching reports/genesis/reveal-shuffle-manifest.json (same seed as IPFS bake).
 *
 * Usage:
 *   npx hardhat run scripts/activate-testnet-gameplay-identities.ts --network robinhoodTestnet
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { buildTestnetAssignedIdentities } from "./lib/build-testnet-assigned-identities";
import { getDeployerSigner } from "./lib/signer";

async function main() {
  if (network.name === "robinhood" || network.name.toLowerCase().includes("mainnet")) {
    throw new Error("REFUSED: testnet gameplay unlock is not for Mainnet.");
  }

  const gamePath = join(__dirname, "..", "deployments", `${network.name}-game.json`);
  if (!existsSync(gamePath)) throw new Error(`Missing ${gamePath}`);
  const record = JSON.parse(readFileSync(gamePath, "utf8")) as { address: string };

  const { assigned, revealSeed } = buildTestnetAssignedIdentities();
  console.log("revealSeed:", revealSeed);
  for (const tokenId of [22, 23, 24, 25, 26]) {
    const packed = assigned[tokenId - 11];
    console.log(`token #${tokenId} packed=0x${packed.toString(16)}`);
  }

  const deployer = await getDeployerSigner(ethers.provider);
  const game = await ethers.getContractAt("HansomeGame", record.address, deployer);
  const tx = await game.setTestnetGameplayIdentities(assigned);
  console.log("setTestnetGameplayIdentities tx:", tx.hash);
  await tx.wait();
  console.log("testnetGameplayUnlock:", await game.testnetGameplayUnlock());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
