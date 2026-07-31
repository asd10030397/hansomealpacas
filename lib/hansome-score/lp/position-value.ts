/**
 * Economic value of Uniswap v3/v4 concentrated positions.
 * Uses token amounts from current sqrt price + tick range — NEVER raw L for %.
 */

import JSBI from "jsbi";
import { SqrtPriceMath, TickMath } from "@uniswap/v3-sdk";
import { zeroAddress } from "viem";
import { RH_QUOTE_TOKENS } from "@/lib/hansome-score/lp/deployments";
import {
  isPositionLocked,
  isPositionRemovable,
  isPositionUnknown,
  materialPositions,
} from "@/lib/hansome-score/lp/aggregate";
import type { LockDistributionReport, V4PositionInfo } from "@/lib/hansome-score/types";

/** Relative reconcile band vs labeled pool TVL before showing %. */
const RECONCILE_MIN_RATIO = 0.55;
const RECONCILE_MAX_RATIO = 1.45;

export function amountsForLiquidity(params: {
  liquidity: bigint;
  tickLower: number;
  tickUpper: number;
  sqrtPriceX96: bigint;
}): { amount0: bigint; amount1: bigint } | null {
  const { liquidity, tickLower, tickUpper, sqrtPriceX96 } = params;
  if (liquidity <= 0n) return { amount0: 0n, amount1: 0n };
  if (!Number.isFinite(tickLower) || !Number.isFinite(tickUpper)) return null;
  if (tickLower >= tickUpper) return null;

  try {
    const sqrt = JSBI.BigInt(sqrtPriceX96.toString());
    let sqrtA = TickMath.getSqrtRatioAtTick(tickLower);
    let sqrtB = TickMath.getSqrtRatioAtTick(tickUpper);
    if (JSBI.greaterThan(sqrtA, sqrtB)) {
      const tmp = sqrtA;
      sqrtA = sqrtB;
      sqrtB = tmp;
    }
    const L = JSBI.BigInt(liquidity.toString());

    if (JSBI.lessThanOrEqual(sqrt, sqrtA)) {
      return {
        amount0: BigInt(SqrtPriceMath.getAmount0Delta(sqrtA, sqrtB, L, false).toString()),
        amount1: 0n,
      };
    }
    if (JSBI.lessThan(sqrt, sqrtB)) {
      return {
        amount0: BigInt(SqrtPriceMath.getAmount0Delta(sqrt, sqrtB, L, false).toString()),
        amount1: BigInt(SqrtPriceMath.getAmount1Delta(sqrtA, sqrt, L, false).toString()),
      };
    }
    return {
      amount0: 0n,
      amount1: BigInt(SqrtPriceMath.getAmount1Delta(sqrtA, sqrtB, L, false).toString()),
    };
  } catch {
    return null;
  }
}

function rawToNumber(raw: bigint, decimals: number): number {
  if (decimals < 0 || decimals > 36) return NaN;
  // Split to reduce float overflow for large supplies
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;
  return Number(whole) + Number(frac) / Number(base);
}

export type TokenPriceBook = {
  tokenAddress: string;
  tokenDecimals: number;
  tokenPriceUsd: number | null;
  ethUsd: number | null;
  /** Stablecoin ~$1 when used as quote. */
  usdgUsd?: number;
};

function usdPerToken(address: string | null | undefined, book: TokenPriceBook): number | null {
  if (!address) return null;
  const lc = address.toLowerCase();
  if (lc === zeroAddress || lc === RH_QUOTE_TOKENS.WETH.toLowerCase()) {
    return book.ethUsd != null && book.ethUsd > 0 ? book.ethUsd : null;
  }
  if (lc === RH_QUOTE_TOKENS.USDG.toLowerCase()) {
    return book.usdgUsd ?? 1;
  }
  if (lc === book.tokenAddress.toLowerCase()) {
    return book.tokenPriceUsd != null && book.tokenPriceUsd > 0 ? book.tokenPriceUsd : null;
  }
  return null;
}

function decimalsFor(address: string | null | undefined, book: TokenPriceBook): number | null {
  if (!address) return null;
  const lc = address.toLowerCase();
  if (lc === zeroAddress || lc === RH_QUOTE_TOKENS.WETH.toLowerCase()) return 18;
  if (lc === RH_QUOTE_TOKENS.USDG.toLowerCase()) return 6;
  if (lc === book.tokenAddress.toLowerCase()) return book.tokenDecimals;
  return null;
}

/** Attach amount0/1 from concentrated-liquidity math when inputs exist. */
export function fillPositionTokenAmounts(
  position: V4PositionInfo,
  sqrtPriceX96: bigint | null,
): V4PositionInfo {
  if (
    sqrtPriceX96 == null ||
    position.liquidity == null ||
    position.tickLower == null ||
    position.tickUpper == null
  ) {
    return position;
  }
  let L: bigint;
  try {
    L = BigInt(position.liquidity);
  } catch {
    return position;
  }
  const amounts = amountsForLiquidity({
    liquidity: L,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    sqrtPriceX96,
  });
  if (!amounts) return position;
  return {
    ...position,
    amount0Raw: amounts.amount0.toString(),
    amount1Raw: amounts.amount1.toString(),
  };
}

export function positionEconomicUsd(
  position: V4PositionInfo,
  book: TokenPriceBook,
): number | null {
  if (position.amount0Raw == null || position.amount1Raw == null) return null;
  const d0 = decimalsFor(position.currency0, book);
  const d1 = decimalsFor(position.currency1, book);
  const p0 = usdPerToken(position.currency0, book);
  const p1 = usdPerToken(position.currency1, book);
  if (d0 == null || d1 == null || p0 == null || p1 == null) return null;
  let a0: bigint;
  let a1: bigint;
  try {
    a0 = BigInt(position.amount0Raw);
    a1 = BigInt(position.amount1Raw);
  } catch {
    return null;
  }
  const usd = rawToNumber(a0, d0) * p0 + rawToNumber(a1, d1) * p1;
  if (!Number.isFinite(usd) || usd < 0) return null;
  return usd;
}

export function attachPositionUsdValues(
  positions: V4PositionInfo[],
  book: TokenPriceBook,
): V4PositionInfo[] {
  return positions.map((p) => {
    const valueUsd = positionEconomicUsd(p, book);
    return { ...p, valueUsd: valueUsd ?? null };
  });
}

/**
 * Locked/unlocked % from USD economic value of discovered positions.
 * Never uses raw L. Requires reconcile vs pool TVL when pool figure exists.
 */
export function computeEconomicLockDistribution(params: {
  positions: V4PositionInfo[];
  poolLiquidityUsd: number | null;
}): LockDistributionReport {
  const material = materialPositions(params.positions);
  const valued = material.filter(
    (p) => p.valueUsd != null && Number.isFinite(p.valueUsd) && (p.valueUsd as number) > 0,
  );

  if (valued.length === 0) {
    return {
      available: false,
      lockedPct: null,
      unlockedPct: null,
      unknownPct: null,
      lockedUsd: null,
      unlockedUsd: null,
      unknownUsd: null,
      totalPositionUsd: null,
      poolLiquidityUsd: params.poolLiquidityUsd,
      reconciledWithPool: false,
      method: null,
      reason:
        "Lock percentage unavailable — could not derive reliable current token amounts / USD value for discovered positions (raw L is never used).",
    };
  }

  if (valued.length < material.length) {
    return {
      available: false,
      lockedPct: null,
      unlockedPct: null,
      unknownPct: null,
      lockedUsd: null,
      unlockedUsd: null,
      unknownUsd: null,
      totalPositionUsd: valued.reduce((s, p) => s + (p.valueUsd ?? 0), 0),
      poolLiquidityUsd: params.poolLiquidityUsd,
      reconciledWithPool: false,
      method: null,
      reason:
        "Lock percentage unavailable — not every material position has a reliable USD value; refusing to mix valued and unvalued positions.",
    };
  }

  let lockedUsd = 0;
  let unlockedUsd = 0;
  let unknownUsd = 0;
  for (const p of valued) {
    const v = p.valueUsd as number;
    if (isPositionLocked(p) && !isPositionRemovable(p)) lockedUsd += v;
    else if (isPositionRemovable(p)) unlockedUsd += v;
    else if (isPositionUnknown(p)) unknownUsd += v;
    else unknownUsd += v;
  }
  const total = lockedUsd + unlockedUsd + unknownUsd;
  if (!(total > 0)) {
    return {
      available: false,
      lockedPct: null,
      unlockedPct: null,
      unknownPct: null,
      lockedUsd: 0,
      unlockedUsd: 0,
      unknownUsd: 0,
      totalPositionUsd: 0,
      poolLiquidityUsd: params.poolLiquidityUsd,
      reconciledWithPool: false,
      method: null,
      reason: "Total discovered position USD is zero.",
    };
  }

  const pool = params.poolLiquidityUsd;
  let reconciled = false;
  if (pool != null && Number.isFinite(pool) && pool > 0) {
    const ratio = total / pool;
    reconciled = ratio >= RECONCILE_MIN_RATIO && ratio <= RECONCILE_MAX_RATIO;
    if (!reconciled) {
      return {
        available: false,
        lockedPct: null,
        unlockedPct: null,
        unknownPct: null,
        lockedUsd,
        unlockedUsd,
        unknownUsd,
        totalPositionUsd: total,
        poolLiquidityUsd: pool,
        reconciledWithPool: false,
        method: null,
        reason: `Lock percentage unavailable — discovered position USD ($${total.toFixed(0)}) does not reconcile with pool liquidity ($${pool.toFixed(0)}). Missing positions or pricing gaps likely.`,
      };
    }
  } else {
    // No pool TVL to reconcile — still allow % among discovered positions when all valued,
    // but mark reason that pool reconcile was skipped.
    reconciled = false;
  }

  // Require pool reconcile when a pool TVL label exists; if absent, still show % of discovered set
  // only when every material position is valued (already enforced) — user asked reconcile when possible.
  const showPct = pool == null || pool <= 0 ? true : reconciled;

  if (!showPct) {
    return {
      available: false,
      lockedPct: null,
      unlockedPct: null,
      unknownPct: null,
      lockedUsd,
      unlockedUsd,
      unknownUsd,
      totalPositionUsd: total,
      poolLiquidityUsd: pool,
      reconciledWithPool: false,
      method: null,
      reason: "Lock percentage unavailable after pool reconciliation check.",
    };
  }

  return {
    available: true,
    lockedPct: (lockedUsd / total) * 100,
    unlockedPct: (unlockedUsd / total) * 100,
    unknownPct: (unknownUsd / total) * 100,
    lockedUsd,
    unlockedUsd,
    unknownUsd,
    totalPositionUsd: total,
    poolLiquidityUsd: pool,
    reconciledWithPool: pool != null && pool > 0 ? reconciled : false,
    method: "token_amounts",
    reason:
      pool == null || pool <= 0
        ? "Percentages are among discovered positions only (no pool TVL available to reconcile)."
        : null,
  };
}
