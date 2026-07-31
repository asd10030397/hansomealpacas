import { getAddress, type Address } from "viem";
import { POOL_ID, ROBINHOOD_CHAIN_ID, TOKEN_ADDRESS } from "@/lib/chain";

/**
 * Live engine version.
 * Structural category caps remain v1.1; Data Confidence methodology is v1.2;
 * Overall Token Score is v1.0 (separate composite — does not retune Structural).
 * Week 1 Score 92 frozen.
 */
export const SCORE_SPEC_VERSION = "1.3.0-overall";

/**
 * Data Confidence / Analysis Coverage weights (sum = 1).
 * Justified by how badly missing coverage can hide structural risk —
 * not tuned to any token’s headline percentage.
 */
export const DATA_CONFIDENCE_WEIGHTS = {
  /** Incomplete multi-version (v2/v3/v4) position discovery can hide withdrawal surface. */
  liquidity: 0.25,
  /** Unindexed creator history is a major dump / transfer-then-sell blind spot. */
  creator: 0.22,
  /** Privilege / honeypot surface; missing ABI or no sell simulation leaves unknowns. */
  contract: 0.22,
  /** Concentration math needs supply + adequate holder sample. */
  holders: 0.16,
  /** Relationship graphs are probabilistic and usually sampled. */
  wallet: 0.15,
} as const;

/** Band thresholds for dimension + aggregate Data Confidence (0–100). */
export const DATA_CONFIDENCE_BAND_THRESHOLDS = {
  high: 75,
  medium: 45,
} as const;

/** Frozen Week 1 historical version — do not use for live scans. */
export const SCORE_SPEC_VERSION_WEEK1_FROZEN = "1.0.0-week1";

export const BLOCKSCOUT_BASE =
  process.env.NEXT_PUBLIC_EXPLORER?.trim() || "https://robinhoodchain.blockscout.com";

/** Uniswap v4 PoolManager on Robinhood Chain. */
export const POOL_MANAGER_ADDRESS = getAddress(
  "0x8366a39CC670B4001A1121B8F6A443A643e40951",
) as Address;

/** Uniswap v4 PositionManager on Robinhood Chain. */
export const POSITION_MANAGER_ADDRESS = getAddress(
  "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
) as Address;

/** TitanLockerManagerV2 on Robinhood Chain. */
export const TITAN_LOCKER_MANAGER = getAddress(
  "0x26b0654A0756DCd036D4e7215324f3D2Be34D79e",
) as Address;

/**
 * PonsLaunchLocker on Robinhood Chain — permanent V3 NPM escrow for Pons launches.
 * No unlock/withdraw in ABI; fee collection only. See reports/HANSOME_PONS_LOCKER_ADAPTER.md.
 */
export const PONS_LAUNCH_LOCKER = getAddress(
  "0x736D76699C26D0d966744cAe304C000d471f7F35",
) as Address;

export const BURN_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
]);

export const HANSOME_TOKEN = TOKEN_ADDRESS;
export const HANSOME_POOL_ID = POOL_ID;
export const SCAN_CHAIN_ID = ROBINHOOD_CHAIN_ID;

/** v1.1 category max deductions (sum 100). */
export const CATEGORY_CAPS = {
  contract_risk: 25,
  liquidity_ownership: 20,
  holder_concentration: 20,
  wallet_relationship: 15,
  launch_fairness: 10,
  creator_behaviour: 10,
} as const;

/** When creator + contract analysis both incomplete, cap final Score. */
export const INCOMPLETE_CRITICAL_SCORE_CEILING = 85;

export const SCORE_DISCLAIMERS = [
  "Not financial advice. Overall Token Score and Structural Score are prototype heuristics — not popularity contests, price predictions, or rug/moon oracles.",
  "Overall Token Score is a broader 0–100 composite (structural + market/liquidity health + holder adoption + activity + maturity + data completeness). It is not a safety guarantee.",
  "Structural Score measures on-chain structural risk & transparency only — not popularity. Low volume, few holders, or small liquidity size alone do not mean “unsafe.”",
  "Core Structural Score uses RPC + Blockscout + verified ABI/source + self-calculated metrics. Third-party data may label Activity / Overall market inputs or supplement contract flags but must not silently override on-chain Structural evidence.",
  "Related-wallet flags are probabilistic only — not proof of common ownership.",
  "Missing data is not treated as safe — incomplete categories apply provisional Structural effects and/or ceilings; Data Confidence reflects coverage gaps.",
  "Data Confidence measures analysis coverage and verifiability — not token quality, safety, or the chance that either score is correct.",
  "DYOR. Category / Trending / Explore are separate concepts and do not affect Overall or Structural scores.",
] as const;

/** Position-level display labels. */
export const LP_LOCK_STATE_DISPLAY = {
  LOCKED_VERIFIED_ONCHAIN: "LOCKED — VERIFIED ON-CHAIN",
  UNLOCKED_EOA_CONTROLLED: "UNLOCKED / EOA-CONTROLLED",
  LOCK_DETECTED_EXPIRY_UNKNOWN: "LOCK DETECTED — EXPIRY UNKNOWN",
  UNSUPPORTED_LOCKER: "UNSUPPORTED LOCKER",
  UNABLE_TO_DETERMINE: "UNABLE TO DETERMINE",
  NONE: "NO POOL / NO LP DETECTED",
  MIXED: "MIXED — LOCKED + REMOVABLE",
} as const;

/**
 * Token-level aggregate display.
 * Principle: one locked position does not mean locked liquidity.
 */
export const LP_AGGREGATE_STATE_DISPLAY = {
  ALL_LOCKED: "ALL LOCKED — VERIFIED ON-CHAIN",
  MIXED: "⚠️ MIXED — LOCKED + REMOVABLE",
  ALL_UNLOCKED: "ALL UNLOCKED / EOA-CONTROLLED",
  UNKNOWN_INCOMPLETE: "UNKNOWN / INCOMPLETE",
  NONE: "NO POOL / NO LP DETECTED",
} as const;

/**
 * Known HANSOME Position NFT seeds for discovery completeness (not Score hardcodes).
 * Classification still requires PositionManager.ownerOf + locker registry.
 * #47299 Titan-locked; #357867 liquidity-wallet EOA; #142938 treasury EOA.
 */
export const HANSOME_KNOWN_POSITION_SEEDS = [47299n, 357867n, 142938n] as const;

export const tokenMetaAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const positionManagerAbi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "getPositionLiquidity",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "uint128" }],
  },
  {
    type: "function",
    name: "getPoolAndPositionInfo",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "poolKey",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "info", type: "uint256" },
    ],
  },
] as const;

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
] as const;

export const titanLockerAbi = [
  {
    type: "function",
    name: "tokenLockerCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint40" }],
  },
  {
    type: "function",
    name: "getTokenLockData",
    stateMutability: "view",
    inputs: [{ name: "id_", type: "uint40" }],
    outputs: [
      { name: "kind", type: "uint8" },
      { name: "id", type: "uint40" },
      { name: "contractAddress", type: "address" },
      { name: "lockOwner", type: "address" },
      { name: "asset", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "createdBy", type: "address" },
      { name: "createdAt", type: "uint40" },
      { name: "unlockTime", type: "uint40" },
      { name: "balance", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getTokenLockersForAddress",
    stateMutability: "view",
    inputs: [{ name: "address_", type: "address" }],
    outputs: [{ type: "uint40[]" }],
  },
  {
    type: "function",
    name: "positionManagerKind",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "kind", type: "uint8" },
      { name: "allowed", type: "bool" },
    ],
  },
] as const;

/** PonsLaunchLocker — token → launched position mapping (permanent escrow). */
export const ponsLaunchLockerAbi = [
  {
    type: "function",
    name: "getLaunchedToken",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "deployer", type: "address" },
          { name: "pairedToken", type: "address" },
          { name: "positionManager", type: "address" },
          { name: "positionId", type: "uint256" },
          { name: "dexId", type: "uint256" },
          { name: "launchConfigId", type: "uint256" },
          { name: "restrictionsEndBlock", type: "uint256" },
          { name: "supply", type: "uint256" },
          { name: "isToken0", type: "bool" },
          { name: "poolFee", type: "uint24" },
          { name: "exists", type: "bool" },
          { name: "initialBuyAmount", type: "uint256" },
        ],
      },
    ],
  },
] as const;

/** Uniswap V3 NonfungiblePositionManager — ownerOf + positions. */
export const uniswapV3NpmAbi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "nonce", type: "uint96" },
      { name: "operator", type: "address" },
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "liquidity", type: "uint128" },
      { name: "feeGrowthInside0LastX128", type: "uint256" },
      { name: "feeGrowthInside1LastX128", type: "uint256" },
      { name: "tokensOwed0", type: "uint128" },
      { name: "tokensOwed1", type: "uint128" },
    ],
  },
] as const;
