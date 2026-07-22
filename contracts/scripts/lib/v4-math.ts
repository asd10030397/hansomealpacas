import { AbiCoder, keccak256 } from "ethers";

// Hardhat/ts-node resolves the CJS build reliably.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TickMath, encodeSqrtRatioX96: encodeSqrtRatioX96Jsbi } = require("@uniswap/v3-sdk") as typeof import("@uniswap/v3-sdk");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JSBI = require("jsbi").default ?? require("jsbi");

const Q96 = 2n ** 96n;

export function sqrtBigInt(value: bigint): bigint {
  if (value < 0n) {
    throw new Error("sqrt of negative number");
  }
  if (value < 2n) {
    return value;
  }

  let x = value;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + value / x) / 2n;
  }
  return x;
}

export function encodeSqrtRatioX96(amount1: bigint, amount0: bigint): bigint {
  if (amount0 === 0n) {
    throw new Error("amount0 must be non-zero");
  }

  return BigInt(encodeSqrtRatioX96Jsbi(amount1.toString(), amount0.toString()).toString());
}

function mulDiv(a: bigint, b: bigint, denominator: bigint): bigint {
  return (a * b) / denominator;
}

function getLiquidityForAmount0(sqrtPriceAX96: bigint, sqrtPriceBX96: bigint, amount0: bigint): bigint {
  let sqrtA = sqrtPriceAX96;
  let sqrtB = sqrtPriceBX96;
  if (sqrtA > sqrtB) {
    [sqrtA, sqrtB] = [sqrtB, sqrtA];
  }

  // Full-precision form — avoids underflow near MIN_TICK where sqrtA*sqrtB < Q96.
  return (amount0 * sqrtA * sqrtB) / (Q96 * (sqrtB - sqrtA));
}

function getLiquidityForAmount1(sqrtPriceAX96: bigint, sqrtPriceBX96: bigint, amount1: bigint): bigint {
  let sqrtA = sqrtPriceAX96;
  let sqrtB = sqrtPriceBX96;
  if (sqrtA > sqrtB) {
    [sqrtA, sqrtB] = [sqrtB, sqrtA];
  }

  return mulDiv(amount1, Q96, sqrtB - sqrtA);
}

export function getLiquidityForAmounts(
  sqrtPriceX96: bigint,
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  amount0: bigint,
  amount1: bigint,
): bigint {
  let sqrtA = sqrtPriceAX96;
  let sqrtB = sqrtPriceBX96;
  if (sqrtA > sqrtB) {
    [sqrtA, sqrtB] = [sqrtB, sqrtA];
  }

  if (sqrtPriceX96 <= sqrtA) {
    return getLiquidityForAmount0(sqrtA, sqrtB, amount0);
  }

  if (sqrtPriceX96 < sqrtB) {
    const liquidity0 = getLiquidityForAmount0(sqrtPriceX96, sqrtB, amount0);
    const liquidity1 = getLiquidityForAmount1(sqrtA, sqrtPriceX96, amount1);
    return liquidity0 < liquidity1 ? liquidity0 : liquidity1;
  }

  return getLiquidityForAmount1(sqrtA, sqrtB, amount1);
}

export function truncateTickSpacing(tick: number, tickSpacing: number): number {
  return Math.trunc(tick / tickSpacing) * tickSpacing;
}

export function getTickAtSqrtPriceX96(sqrtPriceX96: bigint): number {
  return Number(TickMath.getTickAtSqrtRatio(JSBI.BigInt(sqrtPriceX96.toString())));
}

export function getSqrtPriceAtTick(tick: number): bigint {
  return BigInt(TickMath.getSqrtRatioAtTick(tick).toString());
}

export function computePoolId(poolKey: {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
}): string {
  const encoded = AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint24", "int24", "address"],
    [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks],
  );
  return keccak256(encoded);
}
