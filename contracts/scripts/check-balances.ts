/**
 * Read-only balance check for Founder / Treasury wallets — no transactions.
 * Run: npx hardhat run scripts/check-balances.ts --network robinhood
 */
import { Contract, formatEther, formatUnits } from "ethers";
import { ethers } from "hardhat";
import { resolveHansomeAddress } from "./lib/pool-config";

const FOUNDER = "0x2006CF012842e757f1f79938cD646e8a19d5c389";
const TREASURY = "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A";

async function main() {
  const hansomeAddress = resolveHansomeAddress();
  const token = new Contract(
    hansomeAddress,
    ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
    ethers.provider,
  );

  const [founderEth, founderHansome, treasuryEth, treasuryHansome, decimals] = await Promise.all([
    ethers.provider.getBalance(FOUNDER),
    token.balanceOf(FOUNDER),
    ethers.provider.getBalance(TREASURY),
    token.balanceOf(TREASURY),
    token.decimals(),
  ]);

  console.log(`Token: ${hansomeAddress}`);
  console.log("");
  console.log(`Founder  (${FOUNDER})`);
  console.log(`  ETH:     ${formatEther(founderEth)}`);
  console.log(`  HANSOME: ${formatUnits(founderHansome, decimals)}`);
  console.log("");
  console.log(`Treasury (${TREASURY})`);
  console.log(`  ETH:     ${formatEther(treasuryEth)}`);
  console.log(`  HANSOME: ${formatUnits(treasuryHansome, decimals)}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
