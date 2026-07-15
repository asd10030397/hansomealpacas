/**
 * Uniswap v4 PoolManager — singleton contract that emits Swap/Initialize
 * for every pool it manages (unlike v2/v3 where each pool is its own
 * contract). We only need the two events below; the full PoolManager ABI
 * is large and unnecessary for this bot.
 *
 * Signature verified on-chain against real HANSOME/ETH swaps during the
 * investigation that preceded this bot's design:
 *   Swap(bytes32 indexed id, address indexed sender, int128 amount0,
 *        int128 amount1, uint160 sqrtPriceX96, uint128 liquidity,
 *        int24 tick, uint24 fee)
 *
 * Important: `sender` is the router/contract that called
 * `PoolManager.swap()` (Universal Router in our case), NOT the end-user's
 * wallet. The real trader address must come from the transaction's
 * `from` field — see parser.ts.
 */
export const poolManagerAbi = [
  "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)",
  "event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)",
];
