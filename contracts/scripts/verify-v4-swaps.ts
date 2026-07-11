/**
 * Verify UGLY/ETH v4 pool (fee 500) is swappable via Universal Router staticCall.
 * Run: npx hardhat run scripts/verify-v4-swaps.ts --network robinhood
 */
import {
  AbiCoder,
  Contract,
  formatEther,
  formatUnits,
  getAddress,
  parseEther,
  parseUnits,
  solidityPacked,
  ZeroAddress,
} from "ethers";
import { ethers } from "hardhat";
import { computePoolId } from "./lib/v4-math";
import { getDeployerSigner, getTreasurySigner } from "./lib/signer";

const ROBINHOOD_CHAIN_ID = 4663;

const ADDR = {
  universalRouter: "0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77",
  poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
  positionManager: "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
  v3Factory: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
} as const;

const UGLY = getAddress("0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c");
const POOL_FEE = 500;
const POOL_ID = "0x7b0294d1917fb2b47417582f84b57850266c43bf77bcdc80ad39da0d94045056";

const POOL_KEY = [ZeroAddress, UGLY, POOL_FEE, 60, ZeroAddress] as const;

const urAbi = ["function execute(bytes commands, bytes[] inputs, uint256 deadline) payable"];

function buildEthToUglyInput(amountIn: bigint, amountOutMin = 0n) {
  const actions = solidityPacked(["uint8", "uint8", "uint8"], [0x06, 0x0c, 0x0f]);
  const params = [
    AbiCoder.defaultAbiCoder().encode(
      ["tuple(address,address,uint24,int24,address)", "bool", "uint128", "uint128", "uint256", "bytes"],
      [POOL_KEY, true, amountIn, amountOutMin, 0n, "0x"],
    ),
    AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [ZeroAddress, amountIn]),
    AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [UGLY, amountOutMin]),
  ];
  return AbiCoder.defaultAbiCoder().encode(["bytes", "bytes[]"], [actions, params]);
}

function buildUglyToEthInput(amountIn: bigint, amountOutMin = 0n) {
  const actions = solidityPacked(["uint8", "uint8", "uint8"], [0x06, 0x0b, 0x0f]);
  const params = [
    AbiCoder.defaultAbiCoder().encode(
      ["tuple(address,address,uint24,int24,address)", "bool", "uint128", "uint128", "uint256", "bytes"],
      [POOL_KEY, false, amountIn, amountOutMin, 0n, "0x"],
    ),
    AbiCoder.defaultAbiCoder().encode(["address", "uint256", "bool"], [UGLY, amountIn, true]),
    AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [ZeroAddress, amountOutMin]),
  ];
  return AbiCoder.defaultAbiCoder().encode(["bytes", "bytes[]"], [actions, params]);
}

function quoteFromPoolState(sqrtPriceX96: bigint, liquidity: bigint, zeroForOne: boolean, amountIn: bigint) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SqrtPriceMath } = require("@uniswap/v3-sdk") as typeof import("@uniswap/v3-sdk");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const JSBI = require("jsbi").default ?? require("jsbi");

  const sqrt = JSBI.BigInt(sqrtPriceX96.toString());
  const L = JSBI.BigInt(liquidity.toString());
  const inAmt = JSBI.BigInt(amountIn.toString());
  const inAfterFee = JSBI.divide(JSBI.multiply(inAmt, JSBI.BigInt(1_000_000 - POOL_FEE)), JSBI.BigInt(1_000_000));
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

  const deployer = await getDeployerSigner(ethers.provider);
  const treasury = await getTreasurySigner(ethers.provider);
  const deployerAddr = await deployer.getAddress();
  const treasuryAddr = await treasury.getAddress();

  const ethIn = parseEther("0.001");
  const uglyIn = parseUnits("100000", 18);
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

  const slot0 = await stateView.getSlot0(POOL_ID);
  const liquidity: bigint = await stateView.getLiquidity(POOL_ID);
  const onChainPoolKey = await positionManager.poolKeys(POOL_ID.slice(0, 52));
  const expectedPoolId = computePoolId({
    currency0: ZeroAddress,
    currency1: UGLY,
    fee: POOL_FEE,
    tickSpacing: 60,
    hooks: ZeroAddress,
  });

  console.log("Verify v4 pool swappability (fee 500 ETH/UGLY)");
  console.log(`  PoolId:            ${POOL_ID}`);
  console.log(`  sqrtPriceX96:      ${slot0[0].toString()}`);
  console.log(`  tick:              ${slot0[1].toString()}`);
  console.log(`  liquidity:         ${liquidity.toString()}`);
  console.log(`  PoolId matches:    ${expectedPoolId.toLowerCase() === POOL_ID.toLowerCase() ? "yes" : "no"}`);

  // Router discovery (on-chain registry)
  console.log("");
  console.log("Router discovery");
  console.log(`  PositionManager.poolKeys: currency0=${onChainPoolKey[0]} currency1=${onChainPoolKey[1]} fee=${onChainPoolKey[2]} spacing=${onChainPoolKey[3]}`);
  console.log(`  PoolManager initialized:  ${slot0[0] > 0n ? "yes" : "no"}`);
  console.log(`  Pool liquidity > 0:       ${liquidity > 0n ? "yes" : "no"}`);
  const v3Pool = await v3Factory.getPool(ZeroAddress, UGLY, POOL_FEE);
  console.log(`  v3Factory pool (500):     ${v3Pool} (none expected — v4 only)`);

  const ethQuote = quoteFromPoolState(slot0[0], liquidity, true, ethIn);
  const uglyQuote = quoteFromPoolState(slot0[0], liquidity, false, uglyIn);
  console.log("");
  console.log("Expected quotes (pool state math)");
  console.log(`  0.001 ETH -> UGLY:        ${formatUnits(ethQuote, 18)}`);
  console.log(`  100000 UGLY -> ETH:       ${formatEther(uglyQuote)}`);

  const ur = new Contract(ADDR.universalRouter, urAbi, ethers.provider);
  const commands = solidityPacked(["uint8"], [0x10]);

  // 1. ETH -> UGLY via Universal Router staticCall
  console.log("");
  console.log("1. Universal Router staticCall: ETH -> UGLY (0.001 ETH)");
  const deployerEth = await ethers.provider.getBalance(deployerAddr);
  if (deployerEth < ethIn) {
    throw new Error(`Deployer lacks ETH for simulation: have ${formatEther(deployerEth)}, need ${formatEther(ethIn)}`);
  }
  await ur.execute.staticCall(commands, [buildEthToUglyInput(ethIn)], deadline, {
    value: ethIn,
    from: deployerAddr,
  });
  console.log(`  staticCall:          PASS`);
  console.log(`  quote amountOut:     ${formatUnits(ethQuote, 18)} UGLY`);

  // 2. UGLY -> ETH via Universal Router staticCall
  console.log("");
  console.log("2. Universal Router staticCall: UGLY -> ETH (100000 UGLY)");
  const permitAllowance = await permit2.allowance(treasuryAddr, UGLY, ADDR.universalRouter);
  if (permitAllowance[0] < uglyIn) {
    throw new Error(
      `Treasury Permit2 allowance to Universal Router too low (${permitAllowance[0]}). ` +
        "Approve Permit2 -> Universal Router for UGLY before running this check.",
    );
  }
  await ur.execute.staticCall(commands, [buildUglyToEthInput(uglyIn)], deadline, {
    from: treasuryAddr,
  });
  console.log(`  staticCall:          PASS`);
  console.log(`  quote amountOut:     ${formatEther(uglyQuote)} ETH`);

  console.log("");
  console.log("Pool is swappable.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
