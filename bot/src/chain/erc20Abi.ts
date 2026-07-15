/**
 * Standard JSON-ABI fragments — the same shape as lib/swap/abis.ts's
 * `erc20Abi` on the website (that file has zero external imports, so this
 * is a straight, unmodified copy of the two fragments the bot needs).
 * Kept here instead of importing across the package boundary for the same
 * build-isolation reason documented in shared/format.ts.
 */
export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;
