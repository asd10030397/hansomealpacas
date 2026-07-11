/**
 * Verify HANSOME/ETH v4 pool is swappable via Universal Router staticCall.
 * PoolId is computed from the pool key — no pre-known pool id is hardcoded.
 * Run: npx hardhat run scripts/verify-v4-swaps.ts --network robinhood
 */
import {
  AbiCoder,
  Contract,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
  solidityPacked,
  ZeroAddress,
} from "ethers";
import { ethers } from "hardhat";
import { computePoolId } from "./lib/v4-math";
import { getDeployerSigner, getTreasurySigner } from "./lib/signer";
import { resolveHansomeAddress, resolveLpFee, resolveTickSpacing } from "./lib/pool-config";

const ROBINHOOD_CHAIN_ID = 4663;

const ADDR = {
  universalRouter: "0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77",
  poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
  positionManager: "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
  v3Factory: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
} as const;

const urAbi = ["function execute(bytes commands, bytes[] inputs, uint256 deadline) payable"];

function buildEthToHansomeInput(poolKey: readonly unknown[], hansomeAddress: string, amountIn: bigint, amountOutMin = 0n) {
  const actions = solidityPacked(["uint8", "uint8", "uint8"], [0x06, 0x0c, 0x0f]);
  const params = [
    AbiCoder.defaultAbiCoder().encode(
      ["tuple(address,address,uint24,int24,address)", "bool", "uint128", "uint128", "uint256", "bytes"],
      [poolKey, true, amountIn, amountOutMin, 0n, "0x"],
    ),
    AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [ZeroAddress, amountIn]),
    AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [hansomeAddress, amountOutMin]),
  ];
  return AbiCoder.defaultAbiCoder().encode(["bytes", "bytes[]"], [actions, params]);
}

function buildHansomeToEthInput(poolKey: readonly unknown[], hansomeAddress: string, amountIn: bigint, amountOutMin = 0n) {
  const actions = solidityPacked(["uint8", "uint8", "uint8"], [0x06, 0x0b, 0x0f]);
  const params = [
    AbiCoder.defaultAbiCoder().encode(
      ["tuple(address,address,uint24,int24,address)", "bool", "uint128", "uint128", "uint256", "bytes"],
      [poolKey, false, amountIn, amountOutMin, 0n, "0x"],
    ),
    AbiCoder.defaultAbiCoder().encode(["address", "uint256", "bool"], [hansomeAddress, amountIn, true]),
    AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [ZeroAddress, amountOutMin]),
  ];
  return AbiCoder.defaultAbiCoder().encode(["bytes", "bytes[]"], [actions, params]);
}

function quoteFromPoolState(sqrtPriceX96: bigint, liquidity: bigint, lpFee: number, zeroForOne: boolean, amountIn: bigint) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SqrtPriceMath } = require("@uniswap/v3-sdk") as typeof import("@uniswap/v3-sdk");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const JSBI = require("jsbi").default ?? require("jsbi");

  const sqrt = JSBI.BigInt(sqrtPriceX96.toString());
  const L = JSBI.BigInt(liquidity.toString());
  const inAmt = JSBI.BigInt(amountIn.toString());
  const inAfterFee = JSBI.divide(JSBI.multiply(inAmt, JSBI.BigInt(1_000_000 - lpFee)), JSBI.BigInt(1_000_000));
  const sqrtNext = SqrtPriceMath.getNextSqrtPriceFromInput(sqrt, L, inAfterFee, zeroForOne);
  const out = zeroForOne
    ? SqrtPriceMath.getAmount1Delta(sqrt, sqrtNext, L, false)
    : SqrtPriceMath.getAmount0Delta(sqrt, sqrtNext, L, false);
  return BigInt(out.toString());
}

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== ROBINHOOD_CHAIN_ID) {
    throw new Error(`Wrong network: expected ${ROBINHOOD_CHAIN_ID}, got ${chainId}`);
  }

  const hansomeAddress = resolveHansomeAddress();
  const lpFee = resolveLpFee();
  const tickSpacing = resolveTickSpacing();
  const poolKey = [ZeroAddress, hansomeAddress, lpFee, tickSpacing, ZeroAddress] as const;
  const poolId = computePoolId({
    currency0: ZeroAddress,
    currency1: hansomeAddress,
    fee: lpFee,
    tickSpacing,
    hooks: ZeroAddress,
  });

  const deployer = await getDeployerSigner(ethers.provider);
  const treasury = await getTreasurySigner(ethers.provider);
  const deployerAddr = await deployer.getAddress();
  const treasuryAddr = await treasury.getAddress();

  const ethIn = process.env.TEST_ETH_AMOUNT ? parseEther(process.env.TEST_ETH_AMOUNT) : parseEther("0.001");
  const hansomeIn = process.env.TEST_HANSOME_AMOUNT ? parseUnits(process.env.TEST_HANSOME_AMOUNT, 18) : parseUnits("100000", 18);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  const stateView = new Contract(ADDR.stateView, [
    "function getSlot0(bytes32) view returns (uint160,int24,uint24,uint24)",
    "function getLiquidity(bytes32) view returns (uint128)",
  ], ethers.provider);
  const positionManager = new Contract(ADDR.positionManager, [
    "function poolKeys(bytes25) view returns (address,address,uint24,int24,address)",
  ], ethers.provider);
  const v3Factory = new Contract(ADDR.v3Factory, [
    "function getPool(address,address,uint24) view returns (address)",
  ], ethers.provider);
  const permit2 = new Contract(ADDR.permit2, [
    "function allowance(address,address,address) view returns (uint160,uint48,uint48)",
  ], ethers.provider);

  const slot0 = await stateView.getSlot0(poolId);
  const liquidity: bigint = await stateView.getLiquidity(poolId);
  const onChainPoolKey = await positionManager.poolKeys(poolId.slice(0, 52));

  console.log("Verify v4 pool swappability (HANSOME/ETH)");
  console.log(`  PoolId:            ${poolId}`);
  console.log(`  Fee:               ${lpFee}`);
  console.log(`  TickSpacing:       ${tickSpacing}`);
  console.log(`  sqrtPriceX96:      ${slot0[0].toString()}`);
  console.log(`  tick:              ${slot0[1].toString()}`);
  console.log(`  liquidity:         ${liquidity.toString()}`);

  // Router discovery (on-chain registry)
  console.log("");
  console.log("Router discovery");
  console.log(`  PositionManager.poolKeys: currency0=${onChainPoolKey[0]} currency1=${onChainPoolKey[1]} fee=${onChainPoolKey[2]} spacing=${onChainPoolKey[3]}`);
  console.log(`  PoolManager initialized:  ${slot0[0] > 0n ? "yes" : "no"}`);
  console.log(`  Pool liquidity > 0:       ${liquidity > 0n ? "yes" : "no"}`);
  const v3Pool = await v3Factory.getPool(ZeroAddress, hansomeAddress, lpFee);
  console.log(`  v3Factory pool (${lpFee}):     ${v3Pool} (none expected — v4 only)`);

  if (slot0[0] === 0n || liquidity === 0n) {
    console.log("");
    console.log("Pool not initialized / has no liquidity yet — skipping quote & swap checks.");
    return;
  }

  const ethQuote = quoteFromPoolState(slot0[0], liquidity, lpFee, true, ethIn);
  const hansomeQuote = quoteFromPoolState(slot0[0], liquidity, lpFee, false, hansomeIn);
  console.log("");
  console.log("Expected quotes (pool state math)");
  console.log(`  ${formatEther(ethIn)} ETH -> HANSOME:     ${formatUnits(ethQuote, 18)}`);
  console.log(`  ${formatUnits(hansomeIn, 18)} HANSOME -> ETH: ${formatEther(hansomeQuote)}`);

  const ur = new Contract(ADDR.universalRouter, urAbi, ethers.provider);
  const commands = solidityPacked(["uint8"], [0x10]);

  // 1. ETH -> HANSOME via Universal Router staticCall
  console.log("");
  console.log(`1. Universal Router staticCall: ETH -> HANSOME (${formatEther(ethIn)} ETH)`);
  const deployerEth = await ethers.provider.getBalance(deployerAddr);
  if (deployerEth < ethIn) {
    throw new Error(`Deployer lacks ETH for simulation: have ${formatEther(deployerEth)}, need ${formatEther(ethIn)}`);
  }
  await ur.execute.staticCall(commands, [buildEthToHansomeInput(poolKey, hansomeAddress, ethIn)], deadline, {
    value: ethIn,
    from: deployerAddr,
  });
  console.log(`  staticCall:          PASS`);
  console.log(`  quote amountOut:     ${formatUnits(ethQuote, 18)} HANSOME`);

  // 2. HANSOME -> ETH via Universal Router staticCall
  console.log("");
  console.log(`2. Universal Router staticCall: HANSOME -> ETH (${formatUnits(hansomeIn, 18)} HANSOME)`);
  const permitAllowance = await permit2.allowance(treasuryAddr, hansomeAddress, ADDR.universalRouter);
  if (permitAllowance[0] < hansomeIn) {
    throw new Error(
      `Treasury Permit2 allowance to Universal Router too low (${permitAllowance[0]}). ` +
        "Approve Permit2 -> Universal Router for HANSOME before running this check.",
    );
  }
  await ur.execute.staticCall(commands, [buildHansomeToEthInput(poolKey, hansomeAddress, hansomeIn)], deadline, {
    from: treasuryAddr,
  });
  console.log(`  staticCall:          PASS`);
  console.log(`  quote amountOut:     ${formatEther(hansomeQuote)} ETH`);

  console.log("");
  console.log("Pool is swappable.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
