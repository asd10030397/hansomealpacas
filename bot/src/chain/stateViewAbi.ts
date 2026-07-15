/**
 * Mirrors lib/swap/abis.ts's `stateViewAbi` on the website (that file has
 * zero external imports, so this is a direct, unmodified copy).
 * `getSlot0` is used today (commands.ts, for live spot price on
 * /price /status /liquidity). `getLiquidity` isn't called by anything yet
 * — it's included so a future LP-health-monitoring job (see README
 * "Future Expansion") can read total in-range liquidity without touching
 * this file again.
 */
export const stateViewAbi = [
  {
    type: "function",
    name: "getSlot0",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "protocolFee", type: "uint24" },
      { name: "lpFee", type: "uint24" },
    ],
  },
  {
    type: "function",
    name: "getLiquidity",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "liquidity", type: "uint128" }],
  },
] as const;
