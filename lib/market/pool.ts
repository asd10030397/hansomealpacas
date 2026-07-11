import { createPublicClient, formatEther, formatUnits, http } from "viem";
import {
  DEFAULT_RPC_URL,
  POOL_ID,
  ROBINHOOD_CHAIN_ID,
  STATE_VIEW_ADDRESS,
  TOKEN_DECIMALS,
  robinhoodChain,
} from "@/lib/chain";
import { stateViewAbi } from "@/lib/swap/abis";
import { TOTAL_SUPPLY } from "@/lib/market/constants";

const Q96 = 1n << 96n;

export type PoolMarketData = {
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
  tokenPerEth: number;
  priceEth: number;
  ethInPool: number;
  tokenInPool: number;
};

export function sqrtPriceX96ToTokenPerEth(sqrtPriceX96: bigint): number {
  if (sqrtPriceX96 <= 0n) return 0;
  const ratio = Number(sqrtPriceX96) / Number(Q96);
  return ratio * ratio;
}

export function sqrtPriceX96ToEthPerToken(sqrtPriceX96: bigint): number {
  const tokenPerEth = sqrtPriceX96ToTokenPerEth(sqrtPriceX96);
  if (tokenPerEth <= 0) return 0;
  return 1 / tokenPerEth;
}

export function liquidityToReserves(liquidity: bigint, sqrtPriceX96: bigint) {
  if (liquidity <= 0n || sqrtPriceX96 <= 0n) {
    return { amount0Wei: 0n, amount1Wei: 0n };
  }

  const amount0Wei = (liquidity * Q96) / sqrtPriceX96;
  const amount1Wei = (liquidity * sqrtPriceX96) / Q96;
  return { amount0Wei, amount1Wei };
}

export function buildMarketMetrics(pool: PoolMarketData, ethUsd: number) {
  const priceUsd = pool.priceEth * ethUsd;
  const marketCapUsd = TOTAL_SUPPLY * priceUsd;
  const ethValueUsd = pool.ethInPool * ethUsd;
  const tokenValueUsd = pool.tokenInPool * priceUsd;
  const tvlUsd = ethValueUsd + tokenValueUsd;

  return {
    priceEth: pool.priceEth,
    priceUsd,
    tokenPerEth: pool.tokenPerEth,
    marketCapUsd,
    tvlUsd,
    ethValueUsd,
    tokenValueUsd,
    liquidity: {
      eth: pool.ethInPool,
      token: pool.tokenInPool,
      raw: pool.liquidity.toString(),
    },
    tick: pool.tick,
  };
}

export async function readPoolMarketData(): Promise<PoolMarketData> {
  const client = createPublicClient({
    chain: robinhoodChain,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL?.trim() || DEFAULT_RPC_URL),
  });

  const [slot0, liquidity] = await Promise.all([
    client.readContract({
      address: STATE_VIEW_ADDRESS,
      abi: stateViewAbi,
      functionName: "getSlot0",
      args: [POOL_ID],
    }),
    client.readContract({
      address: STATE_VIEW_ADDRESS,
      abi: stateViewAbi,
      functionName: "getLiquidity",
      args: [POOL_ID],
    }),
  ]);

  const [sqrtPriceX96, tick] = slot0;
  const tokenPerEth = sqrtPriceX96ToTokenPerEth(sqrtPriceX96);
  const priceEth = sqrtPriceX96ToEthPerToken(sqrtPriceX96);
  const { amount0Wei, amount1Wei } = liquidityToReserves(liquidity, sqrtPriceX96);

  return {
    sqrtPriceX96,
    tick: Number(tick),
    liquidity,
    tokenPerEth,
    priceEth,
    ethInPool: Number(formatEther(amount0Wei)),
    tokenInPool: Number(formatUnits(amount1Wei, TOKEN_DECIMALS)),
  };
}

export { ROBINHOOD_CHAIN_ID };
