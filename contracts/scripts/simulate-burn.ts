/**
 * Fork-only: simulate BURN + TAKE for a Uniswap v4 position and measure
 * exact receipts. Fully generic — the pool key / token addresses are read
 * from the position itself, nothing is hardcoded.
 *
 * Run:
 *   POSITION_ID=<id> npx hardhat run scripts/simulate-burn.ts
 *   POSITION_ID=<id> POSITION_OWNER=<address> npx hardhat run scripts/simulate-burn.ts
 */
import { AbiCoder, Contract, formatEther, formatUnits, solidityPacked } from "ethers";
import { ethers, network } from "hardhat";

const DEFAULT_OWNER = "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A"; // Treasury Wallet
const PM = "0x58daec3116aae6D93017bAAea7749052E8a04fA7";

const ACTIONS = { BURN_POSITION: 0x03, TAKE_PAIR: 0x11 } as const;

async function main() {
  const positionIdRaw = process.env.POSITION_ID?.trim();
  if (!positionIdRaw) {
    throw new Error("Missing POSITION_ID env var — no default position is assumed.");
  }
  const positionId = BigInt(positionIdRaw);
  const owner = process.env.POSITION_OWNER?.trim() || DEFAULT_OWNER;

  await network.provider.request({
    method: "hardhat_reset",
    params: [{ forking: { jsonRpcUrl: process.env.RH_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com" } }],
  });

  await network.provider.request({ method: "hardhat_impersonateAccount", params: [owner] });
  const signer = await ethers.getImpersonatedSigner(owner);

  const pm = new Contract(PM, [
    "function getPoolAndPositionInfo(uint256) view returns (tuple(address,address,uint24,int24,address), uint256)",
    "function modifyLiquidities(bytes,uint256) payable",
    "function ownerOf(uint256) view returns (address)",
  ], signer);

  const poolAndPos = await pm.getPoolAndPositionInfo(positionId);
  const pk = poolAndPos[0];
  const currency0 = pk[0];
  const currency1 = pk[1];

  const token1 = new Contract(currency1, ["function balanceOf(address) view returns (uint256)"], signer);

  const actions = solidityPacked(["uint8", "uint8"], [ACTIONS.BURN_POSITION, ACTIONS.TAKE_PAIR]);
  const params = [
    AbiCoder.defaultAbiCoder().encode(["uint256", "uint128", "uint128", "bytes"], [positionId, 0, 0, "0x"]),
    AbiCoder.defaultAbiCoder().encode(["address", "address", "address"], [currency0, currency1, owner]),
  ];
  const unlockData = AbiCoder.defaultAbiCoder().encode(["bytes", "bytes[]"], [actions, params]);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  const ethBefore = await ethers.provider.getBalance(owner);
  const token1Before = await token1.balanceOf(owner);

  await pm.modifyLiquidities.staticCall(unlockData, deadline);
  console.log("staticCall: PASSED");

  const tx = await pm.modifyLiquidities(unlockData, deadline);
  const receipt = await tx.wait();
  // Cast explicitly: `pm` is an untyped Contract, so TS otherwise infers
  // `any * bigint` as `number` instead of `bigint`.
  const gasUsed = (receipt?.gasUsed ?? 0n) as bigint;
  const gasPriceUsed = (receipt?.gasPrice ?? 0n) as bigint;
  const gasPaid = gasUsed * gasPriceUsed;

  const ethAfter = await ethers.provider.getBalance(owner);
  const token1After = await token1.balanceOf(owner);

  const netEth = ethAfter + gasPaid - ethBefore;
  const netToken1 = token1After - token1Before;

  console.log(`100% BURN + TAKE (fork simulation) for position #${positionId}:`);
  console.log(`  currency0 (${currency0}) received: ${formatEther(netEth)} (${netEth.toString()} wei)`);
  console.log(`  currency1 (${currency1}) received: ${formatUnits(netToken1, 18)} (${netToken1.toString()} wei)`);
  console.log(`  gas:           ${formatEther(gasPaid)} ETH`);

  try {
    await pm.ownerOf(positionId);
    console.log("  NFT burned:    NO");
  } catch {
    console.log("  NFT burned:    YES");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
