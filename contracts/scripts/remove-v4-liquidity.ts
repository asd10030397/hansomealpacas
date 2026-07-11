/**
 * Remove 100% liquidity from a Uniswap v4 Position NFT (BURN + TAKE).
 *
 * POSITION_ID is required — this script no longer assumes any specific
 * pre-known position. Pass it via env var.
 *
 * Run:
 *   POSITION_ID=<id> DRY_RUN=1 npx hardhat run scripts/remove-v4-liquidity.ts --network robinhood
 *   POSITION_ID=<id> npx hardhat run scripts/remove-v4-liquidity.ts --network robinhood
 */
import { AbiCoder, Contract, formatEther, formatUnits, getAddress, solidityPacked, ZeroAddress } from "ethers";
import { ethers, network } from "hardhat";
import { getTreasurySigner } from "./lib/signer";
import { resolveHansomeAddress, resolveLpFee, resolveTickSpacing } from "./lib/pool-config";

const ROBINHOOD_CHAIN_ID = 4663;
const TREASURY = "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A";

const UNISWAP_V4 = {
  positionManager: "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
} as const;

/** Slippage floor for the ETH leg, overridable via AMOUNT0_MIN_WEI. */
const DEFAULT_AMOUNT0_MIN = 0n;
const DEFAULT_AMOUNT1_MIN = 0n;

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

type RawPoolKey = {
  currency0?: string;
  currency1?: string;
  fee?: bigint;
  tickSpacing?: bigint;
  hooks?: string;
  [index: number]: string | bigint;
};

function parsePoolKey(raw: unknown) {
  const row = raw as RawPoolKey;
  return {
    currency0: getAddress(String(row.currency0 ?? row[0])),
    currency1: getAddress(String(row.currency1 ?? row[1])),
    fee: Number(row.fee ?? row[2]),
    tickSpacing: Number(row.tickSpacing ?? row[3]),
    hooks: getAddress(String(row.hooks ?? row[4])),
  };
}

function assertExpectedPool(poolKey: ReturnType<typeof parsePoolKey>, hansomeAddress: string, expectedFee: number, expectedTickSpacing: number) {
  if (poolKey.currency0.toLowerCase() !== ZeroAddress.toLowerCase()) {
    throw new Error(`Unexpected currency0: ${poolKey.currency0}`);
  }
  if (poolKey.currency1.toLowerCase() !== hansomeAddress.toLowerCase()) {
    throw new Error(`Unexpected currency1: ${poolKey.currency1} (expected HANSOME ${hansomeAddress})`);
  }
  if (poolKey.fee !== expectedFee) {
    throw new Error(`Unexpected fee: ${poolKey.fee} (expected ${expectedFee})`);
  }
  if (poolKey.tickSpacing !== expectedTickSpacing) {
    throw new Error(`Unexpected tickSpacing: ${poolKey.tickSpacing} (expected ${expectedTickSpacing})`);
  }
  if (poolKey.hooks.toLowerCase() !== ZeroAddress.toLowerCase()) {
    throw new Error(`Unexpected hooks: ${poolKey.hooks}`);
  }
}

async function verifyPostWithdraw(positionManager: Contract, hansomeToken: Contract, positionId: bigint, recipient: string) {
  const ethBalance = await ethers.provider.getBalance(recipient);
  const hansomeBalance = await hansomeToken.balanceOf(recipient);

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
  console.log(`  Treasury HANSOME:          ${formatUnits(hansomeBalance, 18)}`);
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
  amount0Min: bigint,
  amount1Min: bigint,
) {
  console.log("");
  console.log("DRY_RUN=1 — simulating BURN_POSITION + TAKE_PAIR");
  console.log(`  amount0Min: ${amount0Min.toString()} wei (${formatEther(amount0Min)} ETH)`);
  console.log(`  amount1Min: ${amount1Min.toString()}`);

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

  const positionIdRaw = process.env.POSITION_ID?.trim();
  if (!positionIdRaw) {
    throw new Error("Missing POSITION_ID. Set POSITION_ID=<tokenId> — no default position is assumed.");
  }
  const positionId = BigInt(positionIdRaw);

  const hansomeAddress = resolveHansomeAddress();
  const expectedFee = resolveLpFee();
  const expectedTickSpacing = resolveTickSpacing();
  const amount0Min = process.env.AMOUNT0_MIN_WEI ? BigInt(process.env.AMOUNT0_MIN_WEI) : DEFAULT_AMOUNT0_MIN;
  const amount1Min = process.env.AMOUNT1_MIN_WEI ? BigInt(process.env.AMOUNT1_MIN_WEI) : DEFAULT_AMOUNT1_MIN;

  const positionManager = new Contract(UNISWAP_V4.positionManager, positionManagerAbi, signer);
  const hansomeToken = new Contract(hansomeAddress, erc20Abi, ethers.provider);

  console.log("Remove Uniswap v4 liquidity (BURN_POSITION + TAKE_PAIR)");
  console.log(`  PositionManager: ${UNISWAP_V4.positionManager}`);
  console.log(`  Network:         ${network.name} (${chainId})`);
  console.log(`  Treasury:        ${recipient}`);
  console.log(`  PositionId:      ${positionId.toString()}`);

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
  assertExpectedPool(poolKey, hansomeAddress, expectedFee, expectedTickSpacing);

  const ethBefore = await ethers.provider.getBalance(recipient);
  const hansomeBefore = await hansomeToken.balanceOf(recipient);

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
    amount0Min,
    amount1Min,
  );
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  if (process.env.DRY_RUN === "1") {
    await runDryRunSimulation(positionManager, unlockData, deadline, positionId, amount0Min, amount1Min);
    return;
  }

  const tx = await positionManager.modifyLiquidities(unlockData, deadline);
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction failed — no receipt");
  }

  const ethAfter = await ethers.provider.getBalance(recipient);
  const hansomeAfter = await hansomeToken.balanceOf(recipient);
  // Cast explicitly: `receipt`/`tx` come from an untyped Contract call, so
  // TS otherwise infers `any * bigint` as `number` instead of `bigint`.
  const gasUsed = receipt.gasUsed as bigint;
  const gasPrice = (receipt.gasPrice ?? tx.gasPrice ?? 0n) as bigint;
  const gasPaid = gasUsed * gasPrice;
  const netEth = ethAfter + gasPaid - ethBefore;
  const netHansome = hansomeAfter - hansomeBefore;

  console.log("");
  console.log("Liquidity removed");
  console.log(`  Transaction Hash: ${receipt.hash}`);
  console.log(`  Block Number:     ${receipt.blockNumber}`);
  console.log(`  Gas Used:         ${receipt.gasUsed.toString()}`);
  console.log(`  Gas Price:        ${gasPrice.toString()} wei`);
  console.log(`  Gas Cost:         ${formatEther(gasPaid)} ETH`);
  console.log(`  ETH received:     ${formatEther(netEth)} (${netEth.toString()} wei)`);
  console.log(`  HANSOME received: ${formatUnits(netHansome, 18)} (${netHansome.toString()} wei)`);
  console.log(`  Explorer:         https://robinhoodchain.blockscout.com/tx/${receipt.hash}`);

  await verifyPostWithdraw(positionManager, hansomeToken, positionId, recipient);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
