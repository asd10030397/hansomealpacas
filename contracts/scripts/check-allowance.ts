/**
 * Read-only allowance check — no transactions.
 * Run: npx hardhat run scripts/check-allowance.ts --network robinhood
 */
import { Contract } from "ethers";
import { ethers } from "hardhat";
import { resolveHansomeAddress } from "./lib/pool-config";

const TREASURY = "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A";
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const POSITION_MANAGER = "0x58daec3116aae6D93017bAAea7749052E8a04fA7";

async function main() {
  const hansomeAddress = resolveHansomeAddress();
  const token = new Contract(
    hansomeAddress,
    ["function allowance(address,address) view returns (uint256)"],
    ethers.provider,
  );
  const permit2 = new Contract(
    PERMIT2,
    ["function allowance(address,address,address) view returns (uint160,uint48,uint48)"],
    ethers.provider,
  );

  const erc20ToPermit2 = await token.allowance(TREASURY, PERMIT2);
  const permit2ToPM = await permit2.allowance(TREASURY, hansomeAddress, POSITION_MANAGER);

  console.log(`HANSOME allowance: Treasury -> Permit2:          ${erc20ToPermit2.toString()}`);
  console.log(`Permit2 allowance: Treasury -> PositionManager:  amount=${permit2ToPM[0].toString()} expiration=${permit2ToPM[1].toString()}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
