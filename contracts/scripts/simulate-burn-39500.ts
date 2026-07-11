/**
 * Fork-only: simulate BURN + TAKE for position 39500 and measure exact receipts.
 * Run: npx hardhat run scripts/simulate-burn-39500.ts
 */
import { AbiCoder, Contract, formatEther, formatUnits, solidityPacked } from "ethers";
import { ethers, network } from "hardhat";

const POSITION_ID = 39500n;
const TREASURY = "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A";
const UGLY = "0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c";
const PM = "0x58daec3116aae6D93017bAAea7749052E8a04fA7";

const ACTIONS = { BURN_POSITION: 0x03, TAKE_PAIR: 0x11 } as const;

async function main() {
  await network.provider.request({
    method: "hardhat_reset",
    params: [{ forking: { jsonRpcUrl: process.env.RH_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com" } }],
  });

  await network.provider.request({ method: "hardhat_impersonateAccount", params: [TREASURY] });
  const signer = await ethers.getImpersonatedSigner(TREASURY);

  const pm = new Contract(PM, [
    "function getPoolAndPositionInfo(uint256) view returns (tuple(address,address,uint24,int24,address), uint256)",
    "function modifyLiquidities(bytes,uint256) payable",
    "function ownerOf(uint256) view returns (address)",
  ], signer);

  const ugly = new Contract(UGLY, ["function balanceOf(address) view returns (uint256)"], signer);

  const poolAndPos = await pm.getPoolAndPositionInfo(POSITION_ID);
  const pk = poolAndPos[0];
  const currency0 = pk[0];
  const currency1 = pk[1];

  const actions = solidityPacked(["uint8", "uint8"], [ACTIONS.BURN_POSITION, ACTIONS.TAKE_PAIR]);
  const params = [
    AbiCoder.defaultAbiCoder().encode(["uint256", "uint128", "uint128", "bytes"], [POSITION_ID, 0, 0, "0x"]),
    AbiCoder.defaultAbiCoder().encode(["address", "address", "address"], [currency0, currency1, TREASURY]),
  ];
  const unlockData = AbiCoder.defaultAbiCoder().encode(["bytes", "bytes[]"], [actions, params]);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  const ethBefore = await ethers.provider.getBalance(TREASURY);
  const uglyBefore = await ugly.balanceOf(TREASURY);

  await pm.modifyLiquidities.staticCall(unlockData, deadline);
  console.log("staticCall: PASSED");

  const tx = await pm.modifyLiquidities(unlockData, deadline);
  const receipt = await tx.wait();
  const gasPaid = (receipt?.gasUsed ?? 0n) * (receipt?.gasPrice ?? 0n);

  const ethAfter = await ethers.provider.getBalance(TREASURY);
  const uglyAfter = await ugly.balanceOf(TREASURY);

  const netEth = ethAfter + gasPaid - ethBefore;
  const netUgly = uglyAfter - uglyBefore;

  console.log("100% BURN + TAKE (fork simulation):");
  console.log(`  ETH received:  ${formatEther(netEth)} (${netEth.toString()} wei)`);
  console.log(`  UGLY received: ${formatUnits(netUgly, 18)} (${netUgly.toString()} wei)`);
  console.log(`  gas:           ${formatEther(gasPaid)} ETH`);

  try {
    await pm.ownerOf(POSITION_ID);
    console.log("  NFT burned:    NO");
  } catch {
    console.log("  NFT burned:    YES");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
