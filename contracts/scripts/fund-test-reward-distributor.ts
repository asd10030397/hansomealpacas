/**
 * Fund the testnet claim path with tHANSOME.
 *
 * Architecture note:
 *   RewardDistributor has NO ERC-20 balance. Claims are paid by GameTreasury.payClaim.
 *   This script transfers tHANSOME into **GameTreasury** (the account that backs
 *   RewardDistributor claims). Labelled "fund distributor" for ops clarity.
 *
 * TESTNET ONLY. Default allocation: 900_000_000 tHANSOME → treasury.
 *
 *   npx hardhat run scripts/fund-test-reward-distributor.ts --network robinhoodTestnet
 *
 * Env:
 *   FUND_AMOUNT_ETH — whole tokens (default 900000000)
 *   THANSOME_ADDRESS / GAME_TOKEN_ADDRESS — override token
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { getDeployerSigner } from "./lib/signer";

async function main() {
  if (network.name === "robinhood" || network.name.toLowerCase().includes("mainnet")) {
    throw new Error("REFUSED: do not fund Mainnet with tHANSOME helpers.");
  }

  const deployer = await getDeployerSigner(ethers.provider);
  const gamePath = join(__dirname, "..", "deployments", `${network.name}-game.json`);
  const thPath = join(__dirname, "..", "deployments", `${network.name}-thansome.json`);
  if (!existsSync(gamePath)) throw new Error(`Missing ${gamePath} — deploy game first`);

  const game = JSON.parse(readFileSync(gamePath, "utf8")) as {
    address: string;
    treasury: string;
    distributor: string;
    token: string;
  };

  let tokenAddr =
    process.env.THANSOME_ADDRESS?.trim() ||
    process.env.GAME_TOKEN_ADDRESS?.trim() ||
    game.token;
  if (existsSync(thPath)) {
    const th = JSON.parse(readFileSync(thPath, "utf8")) as { address: string };
    if (!process.env.THANSOME_ADDRESS && !process.env.GAME_TOKEN_ADDRESS) {
      tokenAddr = th.address;
    }
  }
  tokenAddr = ethers.getAddress(tokenAddr);

  if (ethers.getAddress(game.token) !== tokenAddr) {
    throw new Error(
      `Game treasury token ${game.token} != tHANSOME ${tokenAddr}. Redeploy game with GAME_TOKEN_ADDRESS=${tokenAddr}`,
    );
  }

  const amountWhole = process.env.FUND_AMOUNT_ETH?.trim() ?? "900000000";
  const amount = ethers.parseEther(amountWhole);

  const token = await ethers.getContractAt("TestHANSOME", tokenAddr, deployer);
  const name = await token.name();
  const symbol = await token.symbol();
  if (symbol !== "tHANSOME" || name !== "Test HANSOME") {
    throw new Error(`Expected Test HANSOME/tHANSOME, got ${name}/${symbol}`);
  }

  const balBefore = await token.balanceOf(deployer.address);
  if (balBefore < amount) {
    throw new Error(
      `Deployer balance ${ethers.formatEther(balBefore)} < fund ${amountWhole}`,
    );
  }

  console.log("Network:", network.name);
  console.log("tHANSOME:", tokenAddr);
  console.log("GameTreasury (claim payer):", game.treasury);
  console.log("RewardDistributor:", game.distributor);
  console.log("Funding amount:", amountWhole, "tHANSOME");

  const tx = await token.transfer(game.treasury, amount);
  console.log("fund tx:", tx.hash);
  await tx.wait();

  const deployerAfter = await token.balanceOf(deployer.address);
  const treasuryBal = await token.balanceOf(game.treasury);
  const distributorBal = await token.balanceOf(game.distributor);

  console.log("deployer balance:", ethers.formatEther(deployerAfter));
  console.log("GameTreasury balance:", ethers.formatEther(treasuryBal));
  console.log(
    "RewardDistributor ERC-20 balance:",
    ethers.formatEther(distributorBal),
    "(expected 0 — claims pull from treasury)",
  );

  const out = {
    warning: "TESTNET ONLY — funds GameTreasury for RewardDistributor claims with tHANSOME",
    network: network.name,
    token: tokenAddr,
    treasury: game.treasury,
    distributor: game.distributor,
    fundTx: tx.hash,
    amountWei: amount.toString(),
    deployerBalanceWei: deployerAfter.toString(),
    treasuryBalanceWei: treasuryBal.toString(),
    distributorTokenBalanceWei: distributorBal.toString(),
    fundedAt: new Date().toISOString(),
  };
  const dir = join(__dirname, "..", "deployments");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${network.name}-thansome-fund.json`);
  writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`);
  console.log("Wrote", path);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
