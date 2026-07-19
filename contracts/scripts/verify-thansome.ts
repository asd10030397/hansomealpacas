/**
 * Verify tHANSOME metadata + balances after deploy/fund (Robinhood Testnet).
 *
 *   npx hardhat run scripts/verify-thansome.ts --network robinhoodTestnet
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { getDeployerSigner } from "./lib/signer";

async function main() {
  const deployer = await getDeployerSigner(ethers.provider);
  const thPath = join(__dirname, "..", "deployments", `${network.name}-thansome.json`);
  const gamePath = join(__dirname, "..", "deployments", `${network.name}-game.json`);
  if (!existsSync(thPath)) throw new Error(`Missing ${thPath}`);

  const th = JSON.parse(readFileSync(thPath, "utf8")) as { address: string };
  const token = await ethers.getContractAt("TestHANSOME", th.address, deployer);

  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = await token.decimals();
  const deployerBal = await token.balanceOf(deployer.address);

  console.log("tHANSOME", th.address);
  console.log("name", name);
  console.log("symbol", symbol);
  console.log("decimals", decimals.toString());
  console.log("deployer balance", ethers.formatEther(deployerBal));

  if (name !== "Test HANSOME" || symbol !== "tHANSOME" || decimals !== 18n) {
    throw new Error("metadata mismatch");
  }

  // smoke ERC-20 transfer (1 wei to self)
  const tx = await token.transfer(deployer.address, 1n);
  await tx.wait();
  console.log("self-transfer 1 wei ok", tx.hash);

  if (existsSync(gamePath)) {
    const game = JSON.parse(readFileSync(gamePath, "utf8")) as {
      treasury: string;
      distributor: string;
      token: string;
    };
    const treasuryBal = await token.balanceOf(game.treasury);
    const distBal = await token.balanceOf(game.distributor);
    console.log("GameTreasury balance", ethers.formatEther(treasuryBal));
    console.log("RewardDistributor token balance", ethers.formatEther(distBal));
    console.log("game.token matches tHANSOME", ethers.getAddress(game.token) === th.address);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
