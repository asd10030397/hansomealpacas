/** Minimal ABIs — settlement worker only (no treasury withdraw). */

export const hansomeGameAbi = [
  {
    type: "function",
    name: "dayZero",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "dayLength",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "commitDuration",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "revealDuration",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "currentDay",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "dayState",
    stateMutability: "view",
    inputs: [{ name: "day", type: "uint256" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "randomness",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "isFinalized",
    stateMutability: "view",
    inputs: [{ name: "day", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isSettled",
    stateMutability: "view",
    inputs: [{ name: "day", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "creditProgress",
    stateMutability: "view",
    inputs: [{ name: "day", type: "uint256" }],
    outputs: [
      { name: "cursor", type: "uint256" },
      { name: "total", type: "uint256" },
      { name: "finalized", type: "bool" },
      { name: "settled", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "finalizeDay",
    stateMutability: "nonpayable",
    inputs: [{ name: "day", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "creditBatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [{ name: "credited", type: "uint256" }],
  },
] as const;

export const gameRandomnessAbi = [
  {
    type: "function",
    name: "hasDaySeed",
    stateMutability: "view",
    inputs: [{ name: "day", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "randomnessProvider",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "fulfillDaySeed",
    stateMutability: "nonpayable",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "seed", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

/** Forbidden selectors — worker must never call these. */
export const FORBIDDEN_FUNCTION_NAMES = [
  "withdraw",
  "scheduleWithdraw",
  "executeWithdraw",
  "transferOwnership",
  "renounceOwnership",
  "setRandomnessProvider",
  "reserveForClaims",
] as const;
