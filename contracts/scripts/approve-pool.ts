/**
 * Send the 2 approvals Treasury needs before create-v4-pool.ts can mint a
 * position: HANSOME -> Permit2, then Permit2 -> PositionManager.
 *
 * Does NOT create a pool and does NOT mint a position — approvals only.
 * Run: npx hardhat run scripts/approve-pool.ts --network robinhood
 */
import { Contract, MaxUint256, formatUnits } from "ethers";
import { ethers } from "hardhat";
import { getTreasurySigner } from "./lib/signer";
import { resolveHansomeAddress } from "./lib/pool-config";

const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const POSITION_MANAGER = "0x58daec3116aae6D93017bAAea7749052E8a04fA7";

const erc20Abi = [
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const permit2Abi = [
  "function approve(address token, address spender, uint160 amount, uint48 expiration)",
  "function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
];

async function main() {
  const signer = await getTreasurySigner(ethers.provider);
  const treasury = await signer.getAddress();
  const hansomeAddress = resolveHansomeAddress();

  const token = new Contract(hansomeAddress, erc20Abi, signer);
  const permit2 = new Contract(PERMIT2, permit2Abi, signer);

  console.log(`Treasury: ${treasury}`);
  console.log(`Token:    ${hansomeAddress}`);
  console.log("");

  // 1. HANSOME -> Permit2
  const erc20Allowance: bigint = await token.allowance(treasury, PERMIT2);
  if (erc20Allowance >= MaxUint256 / 2n) {
    console.log("1. HANSOME -> Permit2 allowance already sufficient, skipping.");
    console.log(`   allowance: ${formatUnits(erc20Allowance, 18)}`);
  } else {
    console.log("1. Approving HANSOME -> Permit2 (unlimited)...");
    const tx1 = await token.approve(PERMIT2, MaxUint256);
    console.log(`   tx: ${tx1.hash}`);
    const receipt1 = await tx1.wait();
    console.log(`   confirmed in block ${receipt1?.blockNumber}, status=${receipt1?.status === 1 ? "SUCCESS" : "FAILED"}`);
  }

  // 2. Permit2 -> PositionManager
  const permit2Allowance = await permit2.allowance(treasury, hansomeAddress, POSITION_MANAGER);
  if (permit2Allowance[0] >= (2n ** 160n - 1n) / 2n) {
    console.log("2. Permit2 -> PositionManager allowance already sufficient, skipping.");
    console.log(`   allowance: ${permit2Allowance[0].toString()} expiration=${permit2Allowance[1].toString()}`);
  } else {
    console.log("2. Approving Permit2 -> PositionManager (unlimited, 1 day expiration)...");
    const expiration = Math.floor(Date.now() / 1000) + 86_400;
    const tx2 = await permit2.approve(hansomeAddress, POSITION_MANAGER, 2n ** 160n - 1n, expiration);
    console.log(`   tx: ${tx2.hash}`);
    const receipt2 = await tx2.wait();
    console.log(`   confirmed in block ${receipt2?.blockNumber}, status=${receipt2?.status === 1 ? "SUCCESS" : "FAILED"}`);
  }

  console.log("");
  console.log("Final allowances:");
  const finalErc20 = await token.allowance(treasury, PERMIT2);
  const finalPermit2 = await permit2.allowance(treasury, hansomeAddress, POSITION_MANAGER);
  console.log(`  HANSOME -> Permit2:         ${finalErc20.toString()}`);
  console.log(`  Permit2 -> PositionManager: amount=${finalPermit2[0].toString()} expiration=${finalPermit2[1].toString()}`);
  console.log("");
  console.log("No pool created, no position minted — approvals only.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
