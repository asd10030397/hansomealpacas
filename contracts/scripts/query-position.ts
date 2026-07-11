/**
 * Query a Uniswap v4 Position NFT's withdrawable amounts (read-only).
 *
 * Fully generic: works for any position id, on any pool — the pool key,
 * token addresses, and salt are all derived on-chain from the position
 * itself, nothing is hardcoded.
 *
 * Run:
 *   npx hardhat run scripts/query-position.ts --network robinhood -- <positionId>
 *   POSITION_ID=<id> npx hardhat run scripts/query-position.ts --network robinhood
 */
import { Contract, formatEther, formatUnits, toBeHex, zeroPadValue } from "ethers";
import { ethers } from "hardhat";

const ADDR = {
  poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
  positionManager: "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
} as const;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TickMath, SqrtPriceMath } = require("@uniswap/v3-sdk");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JSBI = require("jsbi").default ?? require("jsbi");

function resolvePositionId(): bigint {
  const fromArgv = process.argv[process.argv.length - 1];
  const fromEnv = process.env.POSITION_ID?.trim();
  const raw = fromEnv || (fromArgv && /^\d+$/.test(fromArgv) ? fromArgv : undefined);

  if (!raw) {
    throw new Error(
      "Missing position id. Pass it as POSITION_ID env var, or as a trailing CLI arg " +
        "(npx hardhat run scripts/query-position.ts --network <net> -- <positionId>).",
    );
  }
  return BigInt(raw);
}

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
  const positionId = resolvePositionId();
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

  console.log(`=== Position #${positionId} On-Chain Query ===\n`);

  const owner = await positionManager.ownerOf(positionId);
  const poolAndPos = await positionManager.getPoolAndPositionInfo(positionId);
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

  // Derived from the pool key itself — works for any pair, not just HANSOME/ETH.
  const { computePoolId } = await import("./lib/v4-math");
  const poolId = computePoolId(poolKey);
  const token = poolKey.currency1;
  // PositionManager v4 uses the tokenId itself as the salt for its minted positions.
  const salt = zeroPadValue(toBeHex(positionId), 32);

  let pmLiquidity = 0n;
  try {
    pmLiquidity = await positionManager.getPositionLiquidity(positionId);
  } catch {
    // optional method
  }

  const poolLiquidity = await stateView.getLiquidity(poolId);
  const slot0 = await stateView.getSlot0(poolId);
  const posInPool = await stateView.getPositionInfo(
    poolId,
    ADDR.positionManager,
    tickLower,
    tickUpper,
    salt,
  );

  const positionLiquidity = posInPool.liquidity;
  const { amount0, amount1 } = amountsForLiquidity(
    positionLiquidity,
    slot0.sqrtPriceX96,
    tickLower,
    tickUpper,
  );

  const token1Contract = new Contract(token, ["function balanceOf(address) view returns (uint256)"], provider);
  const ownerEthBefore = await provider.getBalance(owner);
  const ownerToken1Before = await token1Contract.balanceOf(owner);

  console.log("Position NFT");
  console.log(`  tokenId:           ${positionId.toString()}`);
  console.log(`  owner:             ${owner}`);

  console.log("\nPoolKey");
  console.log(`  currency0:         ${poolKey.currency0}`);
  console.log(`  currency1:         ${poolKey.currency1}`);
  console.log(`  fee:               ${poolKey.fee.toString()}`);
  console.log(`  tickSpacing:       ${poolKey.tickSpacing.toString()}`);
  console.log(`  poolId (derived):  ${poolId}`);

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
  console.log(`  withdrawable currency0: ${formatEther(amount0)} (${amount0.toString()} wei)`);
  console.log(`  withdrawable currency1: ${formatUnits(amount1, 18)} (${amount1.toString()} wei)`);

  console.log("\nAccrued fees (feeGrowth fields — no separate uncollected balance API)");
  console.log(`  feeGrowthInside0LastX128: ${posInPool.feeGrowthInside0LastX128.toString()}`);
  console.log(`  feeGrowthInside1LastX128: ${posInPool.feeGrowthInside1LastX128.toString()}`);

  console.log("\nOwner balances (before any withdrawal):");
  console.log(`  ETH:      ${formatEther(ownerEthBefore)}`);
  console.log(`  currency1: ${formatUnits(ownerToken1Before, 18)}`);
  console.log(`\nFor exact BURN+TAKE simulation run: POSITION_ID=${positionId} npx hardhat run scripts/simulate-burn.ts`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
