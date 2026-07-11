/**
 * Remove 100% liquidity from Uniswap v4 Position NFT (BURN + TAKE).
 *
 * Default: Position #39500 on Robinhood Mainnet.
 *
 * Run:
 *   DRY_RUN=1 npx hardhat run scripts/remove-v4-liquidity.ts --network robinhood
 *   npx hardhat run scripts/remove-v4-liquidity.ts --network robinhood
 */
import { AbiCoder, Contract, formatEther, formatUnits, getAddress, solidityPacked, ZeroAddress } from "ethers";
import { ethers, network } from "hardhat";
import { getTreasurySigner } from "./lib/signer";

const ROBINHOOD_CHAIN_ID = 4663;
const TREASURY = "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A";

const UNISWAP_V4 = {
  positionManager: "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
} as const;

const DEFAULT_POSITION_ID = 39500n;
const DEFAULT_UGLY = "0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c";

/** Slippage floor: 0.079 ETH — revert if principal returned is below this. */
const AMOUNT0_MIN = 79_000_000_000_000_000n;
const AMOUNT1_MIN = 0n;

const EXPECTED_POOL = {
  currency0: ZeroAddress,
  currency1: getAddress(DEFAULT_UGLY),
  fee: 3000,
  tickSpacing: 60,
  hooks: ZeroAddress,
} as const;

const ACTIONS = {
  BURN_POSITION: 0x03,
  TAKE_PAIR: 0x11,
} as const;

const positionManagerAbi = [
  "function modifyLiquidities(bytes unlockData, uint256 deadline) payable",
  "function getPoolAndPositionInfo(uint256 tokenId) view returns ((address,address,uint24,int24,address), uint256)",
  "function getPositionLiquidity(uint256 tokenId) view returns (uint128)",
  "function ownerOf(uint256 tokenId) view returns (address)",
];

const erc20Abi = ["function balanceOf(address account) view returns (uint256)"];

function buildBurnTakeUnlockData(
  tokenId: bigint,
  currency0: string,
  currency1: string,
  recipient: string,
  amount0Min: bigint,
  amount1Min: bigint,
) {
  const actions = solidityPacked(
    ["uint8", "uint8"],
    [ACTIONS.BURN_POSITION, ACTIONS.TAKE_PAIR],
  );

  const params = [
    AbiCoder.defaultAbiCoder().encode(
      ["uint256", "uint128", "uint128", "bytes"],
      [tokenId, amount0Min, amount1Min, "0x"],
    ),
    AbiCoder.defaultAbiCoder().encode(["address", "address", "address"], [currency0, currency1, recipient]),
  ];

  return AbiCoder.defaultAbiCoder().encode(["bytes", "bytes[]"], [actions, params]);
}

function parsePoolKey(raw: unknown) {
  const row = raw as { currency0?: string; currency1?: string; fee?: bigint; tickSpacing?: bigint; hooks?: string } | string[];
  return {
    currency0: getAddress(String(row.currency0 ?? row[0])),
    currency1: getAddress(String(row.currency1 ?? row[1])),
    fee: Number(row.fee ?? row[2]),
    tickSpacing: Number(row.tickSpacing ?? row[3]),
    hooks: getAddress(String(row.hooks ?? row[4])),
  };
}

function assertExpectedPool(poolKey: ReturnType<typeof parsePoolKey>, positionId: bigint) {
  if (positionId !== DEFAULT_POSITION_ID) {
    throw new Error(`Refusing to operate on position ${positionId} — only ${DEFAULT_POSITION_ID} is allowed`);
  }

  if (poolKey.currency0.toLowerCase() !== EXPECTED_POOL.currency0.toLowerCase()) {
    throw new Error(`Unexpected currency0: ${poolKey.currency0}`);
  }
  if (poolKey.currency1.toLowerCase() !== EXPECTED_POOL.currency1.toLowerCase()) {
    throw new Error(`Unexpected currency1: ${poolKey.currency1}`);
  }
  if (poolKey.fee !== EXPECTED_POOL.fee) {
    throw new Error(`Unexpected fee: ${poolKey.fee}`);
  }
  if (poolKey.tickSpacing !== EXPECTED_POOL.tickSpacing) {
    throw new Error(`Unexpected tickSpacing: ${poolKey.tickSpacing}`);
  }
  if (poolKey.hooks.toLowerCase() !== EXPECTED_POOL.hooks.toLowerCase()) {
    throw new Error(`Unexpected hooks: ${poolKey.hooks}`);
  }
}

async function verifyPostWithdraw(positionManager: Contract, uglyToken: Contract, positionId: bigint, recipient: string) {
  const ethBalance = await ethers.provider.getBalance(recipient);
  const uglyBalance = await uglyToken.balanceOf(recipient);

  let nftExists = true;
  try {
    await positionManager.ownerOf(positionId);
  } catch {
    nftExists = false;
  }

  let remainingLiquidity = 0n;
  try {
    remainingLiquidity = await positionManager.getPositionLiquidity(positionId);
  } catch {
    remainingLiquidity = 0n;
  }

  console.log("");
  console.log("Post-withdraw verification");
  console.log(`  Treasury ETH:              ${formatEther(ethBalance)}`);
  console.log(`  Treasury UGLY:             ${formatUnits(uglyBalance, 18)}`);
  console.log(`  ownerOf(${positionId}):    ${nftExists ? "EXISTS (unexpected)" : "revert / burned OK"}`);
  console.log(`  getPositionLiquidity:      ${remainingLiquidity.toString()}`);

  if (nftExists) {
    throw new Error(`Position NFT ${positionId} still exists after BURN`);
  }
  if (remainingLiquidity !== 0n) {
    throw new Error(`Position ${positionId} still has liquidity ${remainingLiquidity}`);
  }

  console.log("  Verification:              PASS");
}

async function runDryRunSimulation(
  positionManager: Contract,
  unlockData: string,
  deadline: bigint,
  positionId: bigint,
) {
  console.log("");
  console.log("DRY_RUN=1 — simulating BURN_POSITION + TAKE_PAIR");
  console.log(`  amount0Min: ${AMOUNT0_MIN.toString()} wei (${formatEther(AMOUNT0_MIN)} ETH)`);
  console.log(`  amount1Min: ${AMOUNT1_MIN.toString()}`);

  // eth_call simulates the full atomic tx: burn liquidity, burn NFT, take pair to treasury.
  await positionManager.modifyLiquidities.staticCall(unlockData, deadline);
  console.log("  staticCall:                PASSED (burn + take + NFT burn path)");

  const ownerBefore = await positionManager.ownerOf(positionId);
  console.log(`  ownerOf(${positionId}) before: ${ownerBefore} (unchanged — no broadcast)`);

  console.log("  DRY_RUN:                   ALL CHECKS PASSED");
}

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== ROBINHOOD_CHAIN_ID) {
    throw new Error(`Wrong network: expected Robinhood Mainnet (${ROBINHOOD_CHAIN_ID}), got ${chainId}`);
  }

  const signer = await getTreasurySigner(ethers.provider);
  const recipient = await signer.getAddress();

  if (recipient.toLowerCase() !== TREASURY.toLowerCase()) {
    throw new Error(`Treasury signer mismatch: ${recipient} !== ${TREASURY}`);
  }

  const positionId = process.env.POSITION_ID ? BigInt(process.env.POSITION_ID) : DEFAULT_POSITION_ID;
  const uglyAddress = (process.env.UGLY_DEER_ADDRESS?.trim() || DEFAULT_UGLY);

  const positionManager = new Contract(UNISWAP_V4.positionManager, positionManagerAbi, signer);
  const uglyToken = new Contract(uglyAddress, erc20Abi, ethers.provider);

  console.log("Remove Uniswap v4 liquidity (BURN_POSITION + TAKE_PAIR)");
  console.log(`  PositionManager: ${UNISWAP_V4.positionManager}`);
  console.log(`  Network:         ${network.name} (${chainId})`);
  console.log(`  Treasury:        ${recipient}`);

  const owner = await positionManager.ownerOf(positionId);
  if (owner.toLowerCase() !== recipient.toLowerCase()) {
    throw new Error(`Position ${positionId} owner is ${owner}, not treasury ${recipient}`);
  }

  const liquidity = await positionManager.getPositionLiquidity(positionId);
  if (liquidity === 0n) {
    throw new Error(`Position ${positionId} has zero liquidity — nothing to remove`);
  }

  const poolAndPos = await positionManager.getPoolAndPositionInfo(positionId);
  const poolKey = parsePoolKey(poolAndPos[0]);
  assertExpectedPool(poolKey, positionId);

  const ethBefore = await ethers.provider.getBalance(recipient);
  const uglyBefore = await uglyToken.balanceOf(recipient);

  console.log(`  PositionId:      ${positionId.toString()}`);
  console.log(`  Liquidity:       ${liquidity.toString()}`);
  console.log(`  PoolKey currency0: ${poolKey.currency0}`);
  console.log(`  PoolKey currency1: ${poolKey.currency1}`);
  console.log(`  PoolKey fee:       ${poolKey.fee}`);
  console.log(`  PoolKey spacing:   ${poolKey.tickSpacing}`);
  console.log(`  PoolKey hooks:     ${poolKey.hooks}`);

  const unlockData = buildBurnTakeUnlockData(
    positionId,
    poolKey.currency0,
    poolKey.currency1,
    recipient,
    AMOUNT0_MIN,
    AMOUNT1_MIN,
  );
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  if (process.env.DRY_RUN === "1") {
    await runDryRunSimulation(positionManager, unlockData, deadline, positionId);
    return;
  }

  const tx = await positionManager.modifyLiquidities(unlockData, deadline);
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction failed — no receipt");
  }

  const ethAfter = await ethers.provider.getBalance(recipient);
  const uglyAfter = await uglyToken.balanceOf(recipient);
  const gasPrice = receipt.gasPrice ?? tx.gasPrice ?? 0n;
  const gasPaid = receipt.gasUsed * gasPrice;
  const netEth = ethAfter + gasPaid - ethBefore;
  const netUgly = uglyAfter - uglyBefore;

  console.log("");
  console.log("Liquidity removed");
  console.log(`  Transaction Hash: ${receipt.hash}`);
  console.log(`  Block Number:     ${receipt.blockNumber}`);
  console.log(`  Gas Used:         ${receipt.gasUsed.toString()}`);
  console.log(`  Gas Price:        ${gasPrice.toString()} wei`);
  console.log(`  Gas Cost:         ${formatEther(gasPaid)} ETH`);
  console.log(`  ETH received:     ${formatEther(netEth)} (${netEth.toString()} wei)`);
  console.log(`  UGLY received:    ${formatUnits(netUgly, 18)} (${netUgly.toString()} wei)`);
  console.log(`  Explorer:         https://robinhoodchain.blockscout.com/tx/${receipt.hash}`);

  await verifyPostWithdraw(positionManager, uglyToken, positionId, recipient);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
