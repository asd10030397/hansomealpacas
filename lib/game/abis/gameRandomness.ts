/** Minimal GameRandomness ABI for settlement presentation (view-only). */
export const gameRandomnessAbi = [
  {
    type: "function",
    name: "bernoulli",
    stateMutability: "view",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "tokenId", type: "uint256" },
      { name: "purpose", type: "uint8" },
      { name: "pBps", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "hasDaySeed",
    stateMutability: "view",
    inputs: [{ name: "day", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/** GameTypes PURPOSE_* / P_* — presentation mirrors on-chain rolls. */
export const PURPOSE_RUNNER = 1;
export const PURPOSE_LUCKY = 2;
export const P_RUNNER_BPS = 3_000n;
export const P_LUCKY_BPS = 2_000n;
