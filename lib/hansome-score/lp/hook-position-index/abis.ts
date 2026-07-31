import { getAddress, type Address, type Hex } from "viem";
import {
  POOL_MANAGER_ADDRESS,
  POSITION_MANAGER_ADDRESS,
} from "@/lib/hansome-score/constants";

/** DopplerHookInitializer — position owner for Class B mints. */
export const DOPPLER_HOOK_INITIALIZER = getAddress(
  "0x4e3468951D49f2EEa976eD0D6e75fFCb44a9a544",
) as Address;

export const HOOK_POS_POOL_MANAGER = POOL_MANAGER_ADDRESS;
export const HOOK_POS_POSITION_MANAGER = POSITION_MANAGER_ADDRESS;

/**
 * keccak256("ModifyLiquidity(bytes32,address,int24,int24,int256,bytes32)")
 * Verified against Uniswap v4-core / Phase 11D probes.
 */
export const MODIFY_LIQUIDITY_TOPIC0 =
  "0xf208f4912782fd25c7f114ca3723a2d5dd6f3bcc3ac8db5af63baa85f711d5ec" as Hex;

export const MODIFY_LIQUIDITY_EVENT =
  "event ModifyLiquidity(bytes32 indexed id, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt)" as const;

export const STATE_VIEW_POSITION_ABI = [
  {
    type: "function",
    name: "getPositionInfo",
    stateMutability: "view",
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "owner", type: "address" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [
      { name: "liquidity", type: "uint128" },
      { name: "feeGrowthInside0LastX128", type: "uint256" },
      { name: "feeGrowthInside1LastX128", type: "uint256" },
    ],
  },
] as const;

export const DEFAULT_CONFIRMATION_DEPTH = 64;
export const DEFAULT_INITIAL_LOG_SPAN = 2_000;
export const DEFAULT_MIN_LOG_SPAN = 50;
export const DEFAULT_MAX_RETRIES = 4;
export const DEFAULT_INTERACTIVE_BUDGET_MS = 3_500;
