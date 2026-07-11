import { AbiCoder, Contract, formatEther, formatUnits, parseEther, parseUnits, solidityPacked, ZeroAddress, MaxUint256 } from "ethers";
import { ethers, network } from "hardhat";
import {
  computePoolId,
  encodeSqrtRatioX96,
  getLiquidityForAmounts,
  getSqrtPriceAtTick,
  getTickAtSqrtPriceX96,
  truncateTickSpacing,
} from "./lib/v4-math";
import { getTreasurySigner } from "./lib/signer";
import { resolveHansomeAddress, resolveLpFee, resolveTickSpacing } from "./lib/pool-config";

const ROBINHOOD_CHAIN_ID = 4663;

const UNISWAP_V4 = {
  poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
  positionManager: "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
} as const;

/** Default one-sided tick range width, in multiples of tickSpacing either side of the target tick. */
const DEFAULT_TICK_RANGE_MULTIPLIER = 750;

const ACTIONS = {
  MINT_POSITION: 0x02,
  SETTLE_PAIR: 0x0d,
  SWEEP: 0x14,
} as const;

const positionManagerAbi = [
  "function multicall(bytes[] data) payable returns (bytes[])",
  "function initializePool((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key, uint160 sqrtPriceX96) payable returns (int24)",
  "function modifyLiquidities(bytes unlockData, uint256 deadline) payable",
  "function nextTokenId() view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getPositionLiquidity(uint256 tokenId) view returns (uint128)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

const erc20Abi = [
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

const permit2Abi = [
  "function approve(address token, address spender, uint160 amount, uint48 expiration)",
  "function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
];

const stateViewAbi = ["function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"];

function requireEnvAmount(name: string, parse: (raw: string) => bigint): bigint {
  const raw = process.env[name]?.trim();
  if (!raw) {
    throw new Error(
      `Missing ${name}. This script no longer assumes any pre-known deposit amounts — ` +
        `set it explicitly in contracts/.env before creating the pool.`,
    );
  }
  return parse(raw);
}

async function verifyPostCreate(
  positionManager: Contract,
  stateView: Contract,
  hansomeToken: Contract,
  poolId: string,
  positionId: bigint,
  recipient: string,
  sqrtPriceX96: bigint,
  ethAmount: bigint,
  hansomeAmount: bigint,
  receipt: { blockNumber: number; hash: string },
) {
  const poolManager = UNISWAP_V4.poolManager;
  const beforeBlock = receipt.blockNumber - 1;
  const afterBlock = receipt.blockNumber;

  const slot0 = await stateView.getSlot0(poolId);
  if (slot0.sqrtPriceX96 === 0n) {
    throw new Error("Post-verify failed: pool not initialized (sqrtPriceX96 = 0)");
  }
  if (slot0.sqrtPriceX96 !== sqrtPriceX96) {
    throw new Error(
      `Post-verify failed: on-chain sqrtPriceX96 ${slot0.sqrtPriceX96} !== expected ${sqrtPriceX96}`,
    );
  }

  const owner = await positionManager.ownerOf(positionId);
  if (owner.toLowerCase() !== recipient.toLowerCase()) {
    throw new Error(`Post-verify failed: Position ${positionId} owner is ${owner}, not treasury`);
  }

  const positionLiquidity: bigint = await positionManager.getPositionLiquidity(positionId);
  if (positionLiquidity === 0n) {
    throw new Error("Post-verify failed: position liquidity is 0");
  }

  const ethBefore = await ethers.provider.getBalance(recipient, beforeBlock);
  const ethAfter = await ethers.provider.getBalance(recipient, afterBlock);
  const hansomeBefore = await hansomeToken.balanceOf(recipient, { blockTag: beforeBlock });
  const hansomeAfter = await hansomeToken.balanceOf(recipient, { blockTag: afterBlock });
  const poolManagerEthBefore = await ethers.provider.getBalance(poolManager, beforeBlock);
  const poolManagerEthAfter = await ethers.provider.getBalance(poolManager, afterBlock);
  const poolManagerHansomeBefore = await hansomeToken.balanceOf(poolManager, { blockTag: beforeBlock });
  const poolManagerHansomeAfter = await hansomeToken.balanceOf(poolManager, { blockTag: afterBlock });

  const treasuryEthDelta = ethBefore - ethAfter;
  const treasuryHansomeDelta = hansomeBefore - hansomeAfter;
  const poolManagerEthDelta = poolManagerEthAfter - poolManagerEthBefore;
  const poolManagerHansomeDelta = poolManagerHansomeAfter - poolManagerHansomeBefore;

  const ethTolerance = parseEther("0.001");
  const hansomeTolerance = parseUnits("1000", 18);

  console.log("");
  console.log("Post-create verification");
  console.log(`  Pool initialized:          yes (sqrtPriceX96=${slot0.sqrtPriceX96.toString()}, tick=${slot0.tick})`);
  console.log(`  Position NFT owner:        ${owner}`);
  console.log(`  Position liquidity:        ${positionLiquidity.toString()}`);
  console.log(`  PoolManager ETH delta:     +${formatEther(poolManagerEthDelta)} (${poolManagerEthDelta.toString()} wei)`);
  console.log(`  PoolManager HANSOME delta: +${formatUnits(poolManagerHansomeDelta, 18)} (${poolManagerHansomeDelta.toString()} wei)`);
  console.log(`  Treasury ETH delta:        -${formatEther(treasuryEthDelta)} (${treasuryEthDelta.toString()} wei)`);
  console.log(`  Treasury HANSOME delta:    -${formatUnits(treasuryHansomeDelta, 18)} (${treasuryHansomeDelta.toString()} wei)`);

  if (poolManagerEthDelta < ethAmount - ethTolerance) {
    throw new Error(`PoolManager ETH deposit too low: ${formatEther(poolManagerEthDelta)}`);
  }
  if (poolManagerHansomeDelta < hansomeAmount - hansomeTolerance) {
    throw new Error(`PoolManager HANSOME deposit too low: ${formatUnits(poolManagerHansomeDelta, 18)}`);
  }
  if (treasuryEthDelta < ethAmount - ethTolerance) {
    throw new Error(`Treasury ETH spend too low: ${formatEther(treasuryEthDelta)}`);
  }
  if (treasuryHansomeDelta < hansomeAmount - hansomeTolerance) {
    throw new Error(`Treasury HANSOME spend too low: ${formatUnits(treasuryHansomeDelta, 18)}`);
  }
  if (poolManagerHansomeDelta <= 1n) {
    throw new Error(`PoolManager HANSOME received only ${poolManagerHansomeDelta.toString()} wei — must not be 1 wei`);
  }

  console.log("  Verification:              PASS");

  return {
    poolManagerEthDelta,
    poolManagerHansomeDelta,
    treasuryEthDelta,
    treasuryHansomeDelta,
    positionLiquidity,
  };
}

type PoolKey = {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
};

function buildMintLiquidityParams(
  poolKey: PoolKey,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
  amount0Max: bigint,
  amount1Max: bigint,
  recipient: string,
) {
  const actions = solidityPacked(
    ["uint8", "uint8", "uint8", "uint8"],
    [ACTIONS.MINT_POSITION, ACTIONS.SETTLE_PAIR, ACTIONS.SWEEP, ACTIONS.SWEEP],
  );

  const poolKeyTuple = [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks];

  const params = [
    AbiCoder.defaultAbiCoder().encode(
      [
        "tuple(address,address,uint24,int24,address)",
        "int24",
        "int24",
        "uint256",
        "uint128",
        "uint128",
        "address",
        "bytes",
      ],
      [poolKeyTuple, tickLower, tickUpper, liquidity, amount0Max, amount1Max, recipient, "0x"],
    ),
    AbiCoder.defaultAbiCoder().encode(["address", "address"], [poolKey.currency0, poolKey.currency1]),
    AbiCoder.defaultAbiCoder().encode(["address", "address"], [poolKey.currency0, recipient]),
    AbiCoder.defaultAbiCoder().encode(["address", "address"], [poolKey.currency1, recipient]),
  ];

  const unlockData = AbiCoder.defaultAbiCoder().encode(["bytes", "bytes[]"], [actions, params]);
  return unlockData;
}

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== ROBINHOOD_CHAIN_ID) {
    throw new Error(`Wrong network: expected Robinhood Mainnet (${ROBINHOOD_CHAIN_ID}), got ${chainId}`);
  }

  const signer = await getTreasurySigner(ethers.provider);
  const recipient = await signer.getAddress();

  const hansomeAddress = resolveHansomeAddress();
  const ethAmount = requireEnvAmount("POOL_ETH_AMOUNT", (raw) => parseEther(raw));
  const hansomeAmount = requireEnvAmount("POOL_HANSOME_AMOUNT", (raw) => parseUnits(raw, 18));
  const lpFee = resolveLpFee();
  const tickSpacing = resolveTickSpacing();
  const tickRangeMultiplier = process.env.POOL_TICK_RANGE_MULTIPLIER
    ? Number(process.env.POOL_TICK_RANGE_MULTIPLIER)
    : DEFAULT_TICK_RANGE_MULTIPLIER;

  const hansomeToken = new Contract(hansomeAddress, erc20Abi, signer);
  const positionManager = new Contract(UNISWAP_V4.positionManager, positionManagerAbi, signer);
  const permit2 = new Contract(UNISWAP_V4.permit2, permit2Abi, signer);
  const stateView = new Contract(UNISWAP_V4.stateView, stateViewAbi, ethers.provider);

  const [symbol, decimals, ethBalance, hansomeBalance] = await Promise.all([
    hansomeToken.symbol(),
    hansomeToken.decimals(),
    ethers.provider.getBalance(recipient),
    hansomeToken.balanceOf(recipient),
  ]);

  console.log("Robinhood Chain Mainnet — Uniswap v4 ETH/HANSOME pool");
  console.log(`  Network:          ${network.name} (${chainId})`);
  console.log(`  Treasury:         ${recipient}`);
  console.log(`  Token:            ${hansomeAddress} (${symbol}, decimals=${decimals})`);
  console.log(`  PositionManager:  ${UNISWAP_V4.positionManager}`);
  console.log(`  PoolManager:      ${UNISWAP_V4.poolManager}`);
  console.log(`  LP fee:           ${lpFee} (${lpFee / 10_000}%)`);
  console.log(`  Tick spacing:     ${tickSpacing}`);
  console.log(`  Deposit ETH:      ${formatEther(ethAmount)}`);
  console.log(`  Deposit HANSOME:  ${formatUnits(hansomeAmount, decimals)}`);
  console.log(`  Implied price:    1 ETH = ${formatUnits(hansomeAmount * 10n ** 18n / ethAmount, 18)} HANSOME`);

  if (ethBalance < ethAmount) {
    throw new Error(
      `Insufficient ETH on ${recipient}: have ${formatEther(ethBalance)}, need ${formatEther(ethAmount)}. ` +
        "Set TREASURY_PRIVATE_KEY in contracts/.env to the wallet that holds LP funds.",
    );
  }

  if (hansomeBalance < hansomeAmount) {
    throw new Error(
      `Insufficient HANSOME on ${recipient}: have ${formatUnits(hansomeBalance, decimals)}, need ${formatUnits(hansomeAmount, decimals)}. ` +
        "Set TREASURY_PRIVATE_KEY in contracts/.env to the wallet that holds LP funds.",
    );
  }

  const poolKey: PoolKey = {
    currency0: ZeroAddress,
    currency1: hansomeAddress,
    fee: lpFee,
    tickSpacing,
    hooks: ZeroAddress,
  };

  if (poolKey.currency0.toLowerCase() >= poolKey.currency1.toLowerCase()) {
    throw new Error("PoolKey currencies must be sorted: currency0 < currency1");
  }

  const poolId = computePoolId(poolKey);
  // Target price is derived directly from the deposit ratio requested above —
  // no separately hardcoded "expected" price.
  const sqrtPriceX96 = encodeSqrtRatioX96(hansomeAmount, ethAmount);
  const currentTick = getTickAtSqrtPriceX96(sqrtPriceX96);
  const tickLower = truncateTickSpacing(currentTick - tickRangeMultiplier * tickSpacing, tickSpacing);
  const tickUpper = truncateTickSpacing(currentTick + tickRangeMultiplier * tickSpacing, tickSpacing);

  const sqrtPriceLower = getSqrtPriceAtTick(tickLower);
  const sqrtPriceUpper = getSqrtPriceAtTick(tickUpper);
  const liquidity = getLiquidityForAmounts(sqrtPriceX96, sqrtPriceLower, sqrtPriceUpper, ethAmount, hansomeAmount);

  if (liquidity === 0n) {
    throw new Error("Computed liquidity is zero — check amounts, price, and tick range");
  }

  console.log(`  sqrtPriceX96:     ${sqrtPriceX96.toString()}`);
  console.log(`  Current tick:     ${currentTick}`);
  console.log(`  Tick range:       [${tickLower}, ${tickUpper}]`);
  console.log(`  Liquidity:        ${liquidity.toString()}`);
  console.log(`  PoolId:           ${poolId}`);

  let onChainSqrtPriceX96 = 0n;
  let poolExists = false;
  try {
    const slot0 = await stateView.getSlot0(poolId);
    onChainSqrtPriceX96 = slot0.sqrtPriceX96;
    poolExists = slot0.sqrtPriceX96 !== 0n;
    if (poolExists) {
      console.log(`  Existing pool:    yes (sqrtPriceX96=${slot0.sqrtPriceX96.toString()}, tick=${slot0.tick})`);
    }
  } catch {
    console.log("  Existing pool:    unknown (StateView read failed, continuing)");
  }

  const poolPriceMismatch = poolExists && onChainSqrtPriceX96 !== sqrtPriceX96;
  if (poolPriceMismatch) {
    console.log(`  WARNING:          on-chain sqrtPriceX96 differs from target — pool cannot be re-initialized`);
  }

  if (poolExists) {
    throw new Error(`Pool fee ${lpFee} already initialized — aborting to avoid wrong-pool mint`);
  }

  const amount0Max = ethAmount + 1n;
  const amount1Max = hansomeAmount + 1n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const unlockData = buildMintLiquidityParams(
    poolKey,
    tickLower,
    tickUpper,
    liquidity,
    amount0Max,
    amount1Max,
    recipient,
  );

  const allowance: bigint = await hansomeToken.allowance(recipient, UNISWAP_V4.permit2);
  if (process.env.DRY_RUN !== "1" && allowance < hansomeAmount) {
    console.log("Approving HANSOME → Permit2...");
    const approveTx = await hansomeToken.approve(UNISWAP_V4.permit2, MaxUint256);
    await approveTx.wait();
  }

  const permitAllowance = await permit2.allowance(recipient, hansomeAddress, UNISWAP_V4.positionManager);
  if (process.env.DRY_RUN !== "1" && permitAllowance.amount < hansomeAmount) {
    console.log("Approving Permit2 → PositionManager for HANSOME...");
    const expiration = Math.floor(Date.now() / 1000) + 86_400;
    const permitTx = await permit2.approve(hansomeAddress, UNISWAP_V4.positionManager, 2n ** 160n - 1n, expiration);
    await permitTx.wait();
  }

  const positionIdBefore: bigint = await positionManager.nextTokenId();

  const poolKeyTuple = [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks];
  const multicallData: string[] = [];

  multicallData.push(positionManager.interface.encodeFunctionData("initializePool", [poolKeyTuple, sqrtPriceX96]));
  multicallData.push(
    positionManager.interface.encodeFunctionData("modifyLiquidities", [unlockData, deadline]),
  );

  console.log("Submitting PositionManager.multicall...");

  if (process.env.DRY_RUN === "1") {
    console.log("");
    console.log("DRY_RUN=1 — validating pool math and simulating multicall");

    console.log("  Pre-flight checks: PASS");
    console.log(`    POOL_FEE:       ${lpFee}`);
    console.log(`    pool init:      no (sqrtPriceX96=0)`);
    console.log(`    sqrtPriceX96:   ${sqrtPriceX96.toString()}`);
    console.log(`    tick:           ${currentTick}`);
    console.log(`    deposit ETH:    ${formatEther(ethAmount)}`);
    console.log(`    deposit HANSOME: ${formatUnits(hansomeAmount, 18)}`);

    await positionManager.multicall.staticCall(multicallData, { value: amount0Max });
    console.log("  staticCall:       PASSED (initializePool + modifyLiquidities)");
    console.log(`  PoolId:           ${poolId}`);
    console.log(`  Expected PositionId: ${positionIdBefore.toString()}`);
    console.log("  DRY_RUN:          ALL CHECKS PASSED");
    return;
  }

  console.log("");
  console.log("Pre-flight checks: PASS");
  console.log(`  POOL_FEE:         ${lpFee}`);
  console.log(`  pool init:        no`);
  console.log(`  sqrtPriceX96:     ${sqrtPriceX96.toString()}`);
  console.log(`  tick:             ${currentTick}`);
  console.log(`  deposit ETH:      ${formatEther(ethAmount)}`);
  console.log(`  deposit HANSOME:  ${formatUnits(hansomeAmount, 18)}`);

  const tx = await positionManager.multicall(multicallData, { value: amount0Max });
  const receipt = await tx.wait();

  if (!receipt) {
    throw new Error("Transaction failed — no receipt returned");
  }

  let positionId = positionIdBefore;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== UNISWAP_V4.positionManager.toLowerCase()) {
      continue;
    }

    try {
      const parsed = positionManager.interface.parseLog(log);
      if (parsed?.name === "Transfer" && parsed.args.from === ZeroAddress) {
        positionId = parsed.args.tokenId;
      }
    } catch {
      // ignore unrelated logs
    }
  }

  const verified = await verifyPostCreate(
    positionManager,
    stateView,
    hansomeToken,
    poolId,
    positionId,
    recipient,
    sqrtPriceX96,
    ethAmount,
    hansomeAmount,
    receipt,
  );

  // Cast explicitly: `receipt`/`tx` come from an untyped Contract call, so
  // TS otherwise infers `any * bigint` as `number` instead of `bigint`.
  const gasUsed = receipt.gasUsed as bigint;
  const gasPrice = (receipt.gasPrice ?? tx.gasPrice ?? 0n) as bigint;
  const cost = gasUsed * gasPrice;

  console.log("");
  console.log("HANSOME/ETH v4 pool created");
  console.log(`  PoolId:           ${poolId}`);
  console.log(`  PositionId:       ${positionId.toString()} (persist this — needed for remove/simulate scripts)`);
  console.log(`  Transaction Hash: ${receipt.hash}`);
  console.log(`  Block Number:     ${receipt.blockNumber}`);
  console.log(`  Gas Used:         ${gasUsed.toString()}`);
  console.log(`  Gas Price:        ${gasPrice.toString()} wei`);
  console.log(`  Cost:             ${formatEther(cost)} ETH`);
  console.log(`  ETH deposited:    ${formatEther(verified.poolManagerEthDelta)} (${verified.poolManagerEthDelta.toString()} wei)`);
  console.log(`  HANSOME deposited: ${formatUnits(verified.poolManagerHansomeDelta, 18)} (${verified.poolManagerHansomeDelta.toString()} wei)`);
  console.log(`  Explorer:         https://robinhoodchain.blockscout.com/tx/${receipt.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
