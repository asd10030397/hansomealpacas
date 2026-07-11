/**
 * Query Position #39500 withdrawable amounts (read-only + fork simulation).
 * Run: npx hardhat run scripts/query-position-39500.ts --network robinhood
 */
import {
  Contract,
  formatEther,
  formatUnits,
} from "ethers";
import { ethers } from "hardhat";

const POSITION_ID = 39500n;
const POOL_ID = "0x25d3614484fc23f4176097e78158f461f6bb324db9594837e83396a5f3d8e983";
const UGLY = "0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c";
const TREASURY = "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A";
const SALT = "0x0000000000000000000000000000000000000000000000000000000000009a4c";

const ADDR = {
  poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
  positionManager: "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
} as const;

const ACTIONS = {
  BURN_POSITION: 0x03,
  TAKE_PAIR: 0x11,
} as const;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TickMath, SqrtPriceMath } = require("@uniswap/v3-sdk");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JSBI = require("jsbi").default ?? require("jsbi");

function decodePositionInfo(info: bigint) {
  const tickUpperRaw = Number((info >> 32n) & 0xffffffn);
  const tickLowerRaw = Number((info >> 8n) & 0xffffffn);
  const tickLower = tickLowerRaw >= 0x800000 ? tickLowerRaw - 0x1000000 : tickLowerRaw;
  const tickUpper = tickUpperRaw >= 0x800000 ? tickUpperRaw - 0x1000000 : tickUpperRaw;
  return { tickLower, tickUpper };
}

function amountsForLiquidity(liquidity: bigint, sqrtPriceX96: bigint, tickLower: number, tickUpper: number) {
  const sqrtCurrent = JSBI.BigInt(sqrtPriceX96.toString());
  const sqrtLower = TickMath.getSqrtRatioAtTick(tickLower);
  const sqrtUpper = TickMath.getSqrtRatioAtTick(tickUpper);
  const liq = JSBI.BigInt(liquidity.toString());

  let amount0 = JSBI.BigInt(0);
  let amount1 = JSBI.BigInt(0);

  if (JSBI.lessThan(sqrtCurrent, sqrtLower)) {
    amount0 = SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, liq, false);
  } else if (JSBI.lessThan(sqrtCurrent, sqrtUpper)) {
    amount0 = SqrtPriceMath.getAmount0Delta(sqrtCurrent, sqrtUpper, liq, false);
    amount1 = SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtCurrent, liq, false);
  } else {
    amount1 = SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, liq, false);
  }

  return { amount0: BigInt(amount0.toString()), amount1: BigInt(amount1.toString()) };
}

async function main() {
  const provider = ethers.provider;
  const stateView = new Contract(ADDR.stateView, [
    "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
    "function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)",
    "function getPositionInfo(bytes32 poolId, address owner, int24 tickLower, int24 tickUpper, bytes32 salt) view returns (uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128)",
    "function getPositionLiquidity(bytes32 poolId, bytes32 salt) view returns (uint128 liquidity)",
  ], provider);

  const positionManager = new Contract(ADDR.positionManager, [
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function getPoolAndPositionInfo(uint256 tokenId) view returns ((address,address,uint24,int24,address), uint256)",
    "function modifyLiquidities(bytes unlockData, uint256 deadline) payable",
    "function getPositionLiquidity(uint256 tokenId) view returns (uint128 liquidity)",
  ], provider);

  const uglyToken = new Contract(UGLY, ["function balanceOf(address) view returns (uint256)"], provider);

  console.log("=== Position #39500 On-Chain Query ===\n");

  const owner = await positionManager.ownerOf(POSITION_ID);
  const poolAndPos = await positionManager.getPoolAndPositionInfo(POSITION_ID);
  const poolKeyRaw = poolAndPos[0] ?? poolAndPos.poolKey;
  const posInfoRaw = poolAndPos[1] ?? poolAndPos.info;
  const poolKey = {
    currency0: poolKeyRaw.currency0 ?? poolKeyRaw[0],
    currency1: poolKeyRaw.currency1 ?? poolKeyRaw[1],
    fee: Number(poolKeyRaw.fee ?? poolKeyRaw[2]),
    tickSpacing: Number(poolKeyRaw.tickSpacing ?? poolKeyRaw[3]),
    hooks: poolKeyRaw.hooks ?? poolKeyRaw[4],
  };
  const { tickLower, tickUpper } = decodePositionInfo(posInfoRaw);

  let pmLiquidity = 0n;
  try {
    pmLiquidity = await positionManager.getPositionLiquidity(POSITION_ID);
  } catch {
    // optional method
  }

  const poolLiquidity = await stateView.getLiquidity(POOL_ID);
  const slot0 = await stateView.getSlot0(POOL_ID);
  const posInPool = await stateView.getPositionInfo(
    POOL_ID,
    ADDR.positionManager,
    tickLower,
    tickUpper,
    SALT,
  );

  const positionLiquidity = posInPool.liquidity;
  const { amount0, amount1 } = amountsForLiquidity(
    positionLiquidity,
    slot0.sqrtPriceX96,
    tickLower,
    tickUpper,
  );

  const treasuryEthBefore = await provider.getBalance(TREASURY);
  const treasuryUglyBefore = await uglyToken.balanceOf(TREASURY);

  console.log("Position NFT");
  console.log(`  tokenId:           ${POSITION_ID.toString()}`);
  console.log(`  owner:             ${owner}`);
  console.log(`  treasury match:    ${owner.toLowerCase() === TREASURY.toLowerCase()}`);

  console.log("\nPoolKey");
  console.log(`  currency0 (ETH):   ${poolKey.currency0}`);
  console.log(`  currency1 (UGLY):  ${poolKey.currency1}`);
  console.log(`  fee:               ${poolKey.fee.toString()}`);
  console.log(`  tickSpacing:       ${poolKey.tickSpacing.toString()}`);

  console.log("\nPosition range & liquidity");
  console.log(`  tickLower:         ${tickLower}`);
  console.log(`  tickUpper:         ${tickUpper}`);
  console.log(`  current tick:      ${slot0.tick.toString()}`);
  console.log(`  sqrtPriceX96:      ${slot0.sqrtPriceX96.toString()}`);
  console.log(`  in range:          ${Number(slot0.tick) >= tickLower && Number(slot0.tick) < tickUpper}`);
  console.log(`  position liquidity (StateView, PM owner): ${positionLiquidity.toString()}`);
  console.log(`  position liquidity (PM.getPositionLiquidity): ${pmLiquidity.toString()}`);
  console.log(`  pool total liquidity: ${poolLiquidity.toString()}`);

  console.log("\nPrincipal at current price (math from on-chain liquidity + slot0)");
  console.log(`  withdrawable ETH:  ${formatEther(amount0)} (${amount0.toString()} wei)`);
  console.log(`  withdrawable UGLY: ${formatUnits(amount1, 18)} (${amount1.toString()} wei)`);

  console.log("\nAccrued fees (feeGrowth fields — no separate uncollected balance API)");
  console.log(`  feeGrowthInside0LastX128: ${posInPool.feeGrowthInside0LastX128.toString()}`);
  console.log(`  feeGrowthInside1LastX128: ${posInPool.feeGrowthInside1LastX128.toString()}`);

  const pmUglyBalance = await uglyToken.balanceOf(ADDR.poolManager);
  console.log("\nPoolManager UGLY balance (chain-wide):", formatUnits(pmUglyBalance, 18));

  console.log("\nTreasury balances (mainnet, before any withdrawal):");
  console.log(`  ETH:  ${formatEther(treasuryEthBefore)}`);
  console.log(`  UGLY: ${formatUnits(treasuryUglyBefore, 18)}`);
  console.log("\nFor exact BURN+TAKE simulation run: npx hardhat run scripts/simulate-burn-39500.ts");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
