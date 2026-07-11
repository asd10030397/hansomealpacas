/**
 * Increase liquidity on the existing official HANSOME/ETH Uniswap v4
 * Position NFT — does NOT create a pool and does NOT mint a new position.
 *
 * Uses PositionManager.modifyLiquidities with the INCREASE_LIQUIDITY action
 * against POSITION_ID. The pool key (currencies / fee / tickSpacing / hooks)
 * and tick range are read directly from the existing position on-chain, so
 * this only ever operates on the position you already own — nothing about
 * the pool or position is hardcoded or re-derived independently.
 *
 * Required env (contracts/.env or inline):
 *   POSITION_ID=47299
 *   ADD_ETH_AMOUNT=0.01
 *   ADD_HANSOME_AMOUNT=1000000
 *
 * Run:
 *   POSITION_ID=47299 ADD_ETH_AMOUNT=0.01 ADD_HANSOME_AMOUNT=1000000 DRY_RUN=1 \
 *     npx hardhat run scripts/add-v4-liquidity.ts --network robinhood
 *   POSITION_ID=47299 ADD_ETH_AMOUNT=0.01 ADD_HANSOME_AMOUNT=1000000 \
 *     npx hardhat run scripts/add-v4-liquidity.ts --network robinhood
 */
import { AbiCoder, Contract, formatEther, formatUnits, getAddress, parseEther, parseUnits, solidityPacked, ZeroAddress } from "ethers";
import { ethers, network } from "hardhat";
import { computePoolId, getLiquidityForAmounts, getSqrtPriceAtTick } from "./lib/v4-math";
import { getTreasurySigner } from "./lib/signer";
import { resolveHansomeAddress, resolveLpFee, resolveTickSpacing } from "./lib/pool-config";

const ROBINHOOD_CHAIN_ID = 4663;

const UNISWAP_V4 = {
  positionManager: "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
} as const;

const ACTIONS = {
  INCREASE_LIQUIDITY: 0x00,
  SETTLE_PAIR: 0x0d,
  SWEEP: 0x14,
} as const;

const positionManagerAbi = [
  "function modifyLiquidities(bytes unlockData, uint256 deadline) payable",
  "function getPoolAndPositionInfo(uint256 tokenId) view returns ((address,address,uint24,int24,address), uint256)",
  "function getPositionLiquidity(uint256 tokenId) view returns (uint128)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

const erc20Abi = [
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const permit2Abi = [
  "function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
];

const stateViewAbi = [
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
];

function requireEnv(name: string): string {
  const raw = process.env[name]?.trim();
  if (!raw) {
    throw new Error(
      `Missing ${name}. This script assumes no pre-known values — set it explicitly ` +
        `(contracts/.env or inline) before running.`,
    );
  }
  return raw;
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

function assertExpectedPool(
  poolKey: ReturnType<typeof parsePoolKey>,
  hansomeAddress: string,
  expectedFee: number,
  expectedTickSpacing: number,
) {
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

/** Position info packs tickLower/tickUpper into a single uint256 (see PositionInfoLibrary). */
function decodePositionInfo(info: bigint) {
  const tickUpperRaw = Number((info >> 32n) & 0xffffffn);
  const tickLowerRaw = Number((info >> 8n) & 0xffffffn);
  const tickLower = tickLowerRaw >= 0x800000 ? tickLowerRaw - 0x1000000 : tickLowerRaw;
  const tickUpper = tickUpperRaw >= 0x800000 ? tickUpperRaw - 0x1000000 : tickUpperRaw;
  return { tickLower, tickUpper };
}

function buildIncreaseLiquidityParams(
  positionId: bigint,
  liquidity: bigint,
  amount0Max: bigint,
  amount1Max: bigint,
  currency0: string,
  currency1: string,
  recipient: string,
) {
  const actions = solidityPacked(
    ["uint8", "uint8", "uint8", "uint8"],
    [ACTIONS.INCREASE_LIQUIDITY, ACTIONS.SETTLE_PAIR, ACTIONS.SWEEP, ACTIONS.SWEEP],
  );

  const params = [
    AbiCoder.defaultAbiCoder().encode(
      ["uint256", "uint256", "uint128", "uint128", "bytes"],
      [positionId, liquidity, amount0Max, amount1Max, "0x"],
    ),
    AbiCoder.defaultAbiCoder().encode(["address", "address"], [currency0, currency1]),
    AbiCoder.defaultAbiCoder().encode(["address", "address"], [currency0, recipient]),
    AbiCoder.defaultAbiCoder().encode(["address", "address"], [currency1, recipient]),
  ];

  return AbiCoder.defaultAbiCoder().encode(["bytes", "bytes[]"], [actions, params]);
}

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== ROBINHOOD_CHAIN_ID) {
    throw new Error(`Wrong network: expected Robinhood Mainnet (${ROBINHOOD_CHAIN_ID}), got ${chainId}`);
  }

  const signer = await getTreasurySigner(ethers.provider);
  const recipient = await signer.getAddress();

  const positionId = BigInt(requireEnv("POSITION_ID"));
  const ethAmount = parseEther(requireEnv("ADD_ETH_AMOUNT"));
  const hansomeAmount = parseUnits(requireEnv("ADD_HANSOME_AMOUNT"), 18);

  const hansomeAddress = resolveHansomeAddress();
  const expectedFee = resolveLpFee();
  const expectedTickSpacing = resolveTickSpacing();

  const hansomeToken = new Contract(hansomeAddress, erc20Abi, ethers.provider);
  const positionManager = new Contract(UNISWAP_V4.positionManager, positionManagerAbi, signer);
  const permit2 = new Contract(UNISWAP_V4.permit2, permit2Abi, ethers.provider);
  const stateView = new Contract(UNISWAP_V4.stateView, stateViewAbi, ethers.provider);

  console.log("Increase Uniswap v4 liquidity (INCREASE_LIQUIDITY, existing Position NFT)");
  console.log(`  Network:          ${network.name} (${chainId})`);
  console.log(`  Treasury:         ${recipient}`);
  console.log(`  PositionManager:  ${UNISWAP_V4.positionManager}`);
  console.log(`  PositionId:       ${positionId.toString()}`);
  console.log(`  Add ETH:          ${formatEther(ethAmount)}`);
  console.log(`  Add HANSOME:      ${formatUnits(hansomeAmount, 18)}`);

  // --- Load the existing position — everything below is derived from it, nothing hardcoded ---
  const owner = await positionManager.ownerOf(positionId);
  if (owner.toLowerCase() !== recipient.toLowerCase()) {
    throw new Error(`Position ${positionId} owner is ${owner}, not treasury signer ${recipient} — refusing to proceed`);
  }

  const liquidityBefore: bigint = await positionManager.getPositionLiquidity(positionId);
  if (liquidityBefore === 0n) {
    throw new Error(`Position ${positionId} has zero liquidity — this script only increases an existing active position`);
  }

  const poolAndPos = await positionManager.getPoolAndPositionInfo(positionId);
  const poolKey = parsePoolKey(poolAndPos[0]);
  assertExpectedPool(poolKey, hansomeAddress, expectedFee, expectedTickSpacing);
  const { tickLower, tickUpper } = decodePositionInfo(poolAndPos[1]);
  const poolId = computePoolId(poolKey);

  console.log("");
  console.log("Existing position (read-only, unchanged by this check)");
  console.log(`  PoolId:           ${poolId}`);
  console.log(`  currency0:        ${poolKey.currency0}`);
  console.log(`  currency1:        ${poolKey.currency1}`);
  console.log(`  fee:              ${poolKey.fee}`);
  console.log(`  tickSpacing:      ${poolKey.tickSpacing}`);
  console.log(`  tickLower:        ${tickLower}`);
  console.log(`  tickUpper:        ${tickUpper}`);
  console.log(`  liquidity before: ${liquidityBefore.toString()}`);

  const slot0 = await stateView.getSlot0(poolId);
  if (slot0.sqrtPriceX96 === 0n) {
    throw new Error(`Pool ${poolId} is not initialized — cannot increase liquidity on a nonexistent pool`);
  }

  const sqrtPriceLower = getSqrtPriceAtTick(tickLower);
  const sqrtPriceUpper = getSqrtPriceAtTick(tickUpper);
  const liquidityToAdd = getLiquidityForAmounts(slot0.sqrtPriceX96, sqrtPriceLower, sqrtPriceUpper, ethAmount, hansomeAmount);

  if (liquidityToAdd === 0n) {
    throw new Error("Computed liquidity delta is zero — check ADD_ETH_AMOUNT / ADD_HANSOME_AMOUNT against the position's current range and price");
  }

  console.log("");
  console.log("Current pool price");
  console.log(`  sqrtPriceX96:     ${slot0.sqrtPriceX96.toString()}`);
  console.log(`  tick:             ${slot0.tick.toString()}`);
  console.log(`  in range:         ${Number(slot0.tick) >= tickLower && Number(slot0.tick) < tickUpper}`);
  console.log(`  liquidity to add: ${liquidityToAdd.toString()}`);

  // --- Pre-flight checks: balances + allowances. Any shortfall aborts before any transaction. ---
  const [ethBalance, hansomeBalance, decimals, erc20Allowance, permit2Allowance] = await Promise.all([
    ethers.provider.getBalance(recipient),
    hansomeToken.balanceOf(recipient),
    hansomeToken.decimals(),
    hansomeToken.allowance(recipient, UNISWAP_V4.permit2),
    permit2.allowance(recipient, hansomeAddress, UNISWAP_V4.positionManager),
  ]);

  const nowSec = Math.floor(Date.now() / 1000);
  const permit2AllowanceAmount: bigint = permit2Allowance[0];
  const permit2AllowanceExpiration: bigint = permit2Allowance[1];
  const permit2AllowanceValid = permit2AllowanceAmount >= hansomeAmount && Number(permit2AllowanceExpiration) > nowSec;

  console.log("");
  console.log("Pre-flight checks");
  console.log(`  Treasury ETH:               ${formatEther(ethBalance)} (need ${formatEther(ethAmount)})`);
  console.log(`  Treasury HANSOME:           ${formatUnits(hansomeBalance, decimals)} (need ${formatUnits(hansomeAmount, decimals)})`);
  console.log(`  HANSOME -> Permit2:         ${erc20Allowance.toString()} (need >= ${hansomeAmount.toString()})`);
  console.log(`  Permit2 -> PositionManager: amount=${permit2AllowanceAmount.toString()} expiration=${permit2AllowanceExpiration.toString()} (need >= ${hansomeAmount.toString()}, unexpired)`);

  const failures: string[] = [];
  if (ethBalance < ethAmount) {
    failures.push(`Insufficient Treasury ETH: have ${formatEther(ethBalance)}, need ${formatEther(ethAmount)}`);
  }
  if (hansomeBalance < hansomeAmount) {
    failures.push(`Insufficient Treasury HANSOME: have ${formatUnits(hansomeBalance, decimals)}, need ${formatUnits(hansomeAmount, decimals)}`);
  }
  if (erc20Allowance < hansomeAmount) {
    failures.push(
      `Insufficient HANSOME -> Permit2 allowance: have ${erc20Allowance.toString()}, need >= ${hansomeAmount.toString()}. Run approve-pool.ts first.`,
    );
  }
  if (!permit2AllowanceValid) {
    failures.push(
      `Insufficient or expired Permit2 -> PositionManager allowance: amount=${permit2AllowanceAmount.toString()} expiration=${permit2AllowanceExpiration.toString()}. Run approve-pool.ts first.`,
    );
  }

  if (failures.length > 0) {
    console.log("");
    console.log("Pre-flight checks: FAIL — no transaction will be sent");
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
    throw new Error("Pre-flight checks failed — aborting before sending any transaction");
  }

  console.log("");
  console.log("Pre-flight checks: PASS");

  // amount0Max/amount1Max are the slippage ceiling for spending against the *requested*
  // liquidity delta — +1 wei tolerates rounding when converting amounts <-> liquidity.
  const amount0Max = ethAmount + 1n;
  const amount1Max = hansomeAmount + 1n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  const unlockData = buildIncreaseLiquidityParams(
    positionId,
    liquidityToAdd,
    amount0Max,
    amount1Max,
    poolKey.currency0,
    poolKey.currency1,
    recipient,
  );

  if (process.env.DRY_RUN === "1") {
    console.log("");
    console.log("DRY_RUN=1 — simulating INCREASE_LIQUIDITY (no transaction sent, no liquidity added)");

    await positionManager.modifyLiquidities.staticCall(unlockData, deadline, { value: amount0Max });
    console.log("  staticCall:       PASSED (increase + settle pair + sweep)");
    console.log(`  PositionId:       ${positionId.toString()} (unchanged)`);
    console.log(`  PoolId:           ${poolId} (unchanged)`);
    console.log(`  Liquidity to add: ${liquidityToAdd.toString()}`);
    console.log(`  Would spend ETH:      up to ${formatEther(amount0Max)}`);
    console.log(`  Would spend HANSOME:  up to ${formatUnits(amount1Max, 18)}`);
    console.log("  DRY_RUN:          ALL CHECKS PASSED — no pool created, no new Position NFT, no liquidity added");
    return;
  }

  console.log("");
  console.log("Submitting PositionManager.modifyLiquidities (INCREASE_LIQUIDITY)...");

  const ethBefore = await ethers.provider.getBalance(recipient);
  const hansomeBefore = await hansomeToken.balanceOf(recipient);

  const tx = await positionManager.modifyLiquidities(unlockData, deadline, { value: amount0Max });
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction failed — no receipt returned");
  }

  // Defensive check: confirm no new Position NFT was minted (no Transfer with from=0x0).
  let mintedNewNft = false;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== UNISWAP_V4.positionManager.toLowerCase()) {
      continue;
    }
    try {
      const parsed = positionManager.interface.parseLog(log);
      if (parsed?.name === "Transfer" && parsed.args.from === ZeroAddress) {
        mintedNewNft = true;
      }
    } catch {
      // ignore unrelated logs
    }
  }
  if (mintedNewNft) {
    throw new Error("Unexpected: a new Position NFT was minted by this transaction — expected only an increase on the existing position");
  }

  const ownerAfter = await positionManager.ownerOf(positionId);
  if (ownerAfter.toLowerCase() !== recipient.toLowerCase()) {
    throw new Error(`Post-tx check failed: Position ${positionId} owner is now ${ownerAfter}, expected treasury ${recipient}`);
  }

  const poolAndPosAfter = await positionManager.getPoolAndPositionInfo(positionId);
  const poolKeyAfter = parsePoolKey(poolAndPosAfter[0]);
  const poolIdAfter = computePoolId(poolKeyAfter);
  if (poolIdAfter !== poolId) {
    throw new Error(`Post-tx check failed: PoolId changed from ${poolId} to ${poolIdAfter}`);
  }

  const liquidityAfter: bigint = await positionManager.getPositionLiquidity(positionId);
  const liquidityAdded = liquidityAfter - liquidityBefore;

  const ethAfter = await ethers.provider.getBalance(recipient);
  const hansomeAfter = await hansomeToken.balanceOf(recipient);
  // Cast explicitly: `receipt`/`tx` come from an untyped Contract call, so
  // TS otherwise infers `any * bigint` as `number` instead of `bigint`.
  const gasUsed = receipt.gasUsed as bigint;
  const gasPrice = (receipt.gasPrice ?? tx.gasPrice ?? 0n) as bigint;
  const gasPaid = gasUsed * gasPrice;
  const ethSpent = ethBefore - ethAfter - gasPaid;
  const hansomeSpent = hansomeBefore - hansomeAfter;

  console.log("");
  console.log("Liquidity increased");
  console.log(`  Transaction Hash:    ${receipt.hash}`);
  console.log(`  Block Number:        ${receipt.blockNumber}`);
  console.log(`  PositionId:          ${positionId.toString()} (unchanged — no new Position NFT minted)`);
  console.log(`  PoolId:              ${poolIdAfter} (unchanged — same pool, verified)`);
  console.log(`  Gas Used:            ${gasUsed.toString()}`);
  console.log(`  Gas Price:           ${gasPrice.toString()} wei`);
  console.log(`  Gas Cost:            ${formatEther(gasPaid)} ETH`);
  console.log(`  ETH added:           ${formatEther(ethSpent)} (${ethSpent.toString()} wei)`);
  console.log(`  HANSOME added:       ${formatUnits(hansomeSpent, 18)} (${hansomeSpent.toString()} wei)`);
  console.log(`  Liquidity before:    ${liquidityBefore.toString()}`);
  console.log(`  Liquidity after:     ${liquidityAfter.toString()}`);
  console.log(`  Liquidity added:     ${liquidityAdded.toString()}`);
  console.log(`  Explorer:            https://robinhoodchain.blockscout.com/tx/${receipt.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
