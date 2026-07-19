/**
 * Deploy SettlementLibHarness on current network and print π₀ table.
 * Usage: npx hardhat run scripts/verify-pi0-ladder.ts --network robinhoodTestnet
 */
import { ethers, network } from "hardhat";
import { getDeployerSigner } from "./lib/signer";

async function main() {
  const deployer = await getDeployerSigner(ethers.provider);
  const h = await (
    await ethers.getContractFactory("SettlementLibHarness", deployer)
  ).deploy();
  await h.waitForDeployment();
  const vals: number[] = [];
  for (let i = 0; i < 5; i++) vals.push(Number(await h.pi0Bps(i)));
  const joined = vals.join("/");
  console.log("network:", network.name);
  console.log("harness:", await h.getAddress());
  console.log("pi0Bps:", joined);
  if (joined !== "0/1500/2500/3500/4500") {
    throw new Error(`Unexpected π₀ ladder: ${joined}`);
  }
  console.log("PASS Candidate A π₀ ladder");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
