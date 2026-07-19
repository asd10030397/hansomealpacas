import { SqrtPriceMath } from "@uniswap/v3-sdk";
import JSBI from "jsbi";
import { POOL_FEE } from "@/lib/chain";

export function quoteFromPoolState(
  sqrtPriceX96: bigint,
  liquidity: bigint,
  zeroForOne: boolean,
  amountIn: bigint,
): bigint {
  if (amountIn <= 0n || liquidity <= 0n) return 0n;

  const sqrt = JSBI.BigInt(sqrtPriceX96.toString());
  const L = JSBI.BigInt(liquidity.toString());
  const inAmt = JSBI.BigInt(amountIn.toString());
  const inAfterFee = JSBI.divide(
    JSBI.multiply(inAmt, JSBI.BigInt(1_000_000 - POOL_FEE)),
    JSBI.BigInt(1_000_000),
  );
  const sqrtNext = SqrtPriceMath.getNextSqrtPriceFromInput(sqrt, L, inAfterFee, zeroForOne);
  const out = zeroForOne
    ? SqrtPriceMath.getAmount1Delta(sqrt, sqrtNext, L, false)
    : SqrtPriceMath.getAmount0Delta(sqrt, sqrtNext, L, false);

  return BigInt(out.toString());
}

export function applySlippage(amountOut: bigint, slippageBps: number): bigint {
  if (amountOut <= 0n) return 0n;
  const bps = BigInt(Math.max(0, Math.min(slippageBps, 5000)));
  return (amountOut * (10_000n - bps)) / 10_000n;
}

export const DEFAULT_SLIPPAGE_BPS = 50;

/** Compact display so long HANSOME amounts don't overflow the receive row. */
export function formatSwapAmountDisplay(raw: string, maxFrac = 4): string {
  if (!raw || raw === "—") return raw;
  const neg = raw.startsWith("-");
  const body = neg ? raw.slice(1) : raw;
  const [intPart, fracPart = ""] = body.split(".");
  if (!fracPart) return raw;
  const trimmed = fracPart.replace(/0+$/, "").slice(0, maxFrac);
  const joined = trimmed ? `${intPart}.${trimmed}` : intPart;
  return neg ? `-${joined}` : joined;
}
