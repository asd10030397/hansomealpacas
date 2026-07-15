import { Contract, type JsonRpcProvider } from "ethers";
import { config } from "./config";
import { fetchEthUsd } from "./shared/ethUsd";
import { stateViewAbi } from "./chain/stateViewAbi";

const Q96 = 2n ** 96n;

/**
 * Uniswap v3/v4 convention: sqrtPriceX96 encodes sqrt(price), where
 * `price` is defined as raw token1-per-token0. Our pool's currency0 is
 * ETH and currency1 is HANSOME (see lib/chain.ts POOL_KEY on the
 * website), both 18 decimals, so this ratio is directly HANSOME-per-ETH
 * with no extra decimal adjustment needed.
 *
 * Converting the bigint to Number before squaring loses some low-order
 * bits (doubles carry ~15-17 significant digits), which is irrelevant for
 * a human-readable price/market-cap display — it is not used for any
 * on-chain settlement math.
 */
export function hansomePerEthFromSqrtPriceX96(sqrtPriceX96: bigint): number {
  const ratio = Number(sqrtPriceX96) / Number(Q96);
  return ratio * ratio;
}

export function ethPerHansomeFromSqrtPriceX96(sqrtPriceX96: bigint): number {
  const hansomePerEth = hansomePerEthFromSqrtPriceX96(sqrtPriceX96);
  return hansomePerEth > 0 ? 1 / hansomePerEth : 0;
}

export type UsdPricing = {
  priceEth: number; // ETH per 1 HANSOME
  priceUsd: number; // USD per 1 HANSOME
  marketCapUsd: number;
};

export async function computeUsdPricing(sqrtPriceX96: bigint): Promise<UsdPricing> {
  const priceEth = ethPerHansomeFromSqrtPriceX96(sqrtPriceX96);
  const ethUsd = await fetchEthUsd();
  const priceUsd = priceEth * ethUsd;
  const marketCapUsd = priceUsd * config.chain.totalSupply;
  return { priceEth, priceUsd, marketCapUsd };
}

/** Reads the pool's current spot price on demand — used by /price, /status, /liquidity. */
export async function getCurrentSqrtPriceX96(provider: JsonRpcProvider): Promise<bigint> {
  const stateView = new Contract(config.chain.stateViewAddress, stateViewAbi, provider);
  const [sqrtPriceX96] = await stateView.getSlot0(config.chain.poolId);
  return sqrtPriceX96 as bigint;
}
