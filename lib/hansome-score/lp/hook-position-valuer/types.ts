/**
 * Phase 11F — Hook Position Valuer types.
 * Separate from Titan lock / Score / PoolManager inventory.
 */

import type { HookPositionClassification } from "@/lib/hansome-score/lp/hook-position-index/types";

export const HOOK_VALUE_SCHEMA_VERSION = 1 as const;
export const HOOK_VALUE_SEMANTIC_VERSION = "1.0.0-phase11f" as const;
export const HOOK_VALUE_KEY_PREFIX = "scan:v4hook-value" as const;

export type HookValuationTerminalState =
  | "NEW"
  | "READING_POSITIONS"
  | "CALCULATING"
  | "PRICING"
  | "SUCCESS_COMPLETE"
  | "SUCCESS_PARTIAL"
  | "FAILED_TERMINAL";

export type HookValuationIncompleteReason =
  | "token0_price_unavailable"
  | "token1_price_unavailable"
  | "decimals_unavailable"
  | "slot0_unavailable"
  | "stateview_position_read_failed"
  | "clmm_math_failed"
  | "index_incomplete"
  | "stale_tip"
  | "pool_key_unavailable"
  | "no_positions"
  | "budget_exceeded"
  | "failed_terminal";

export type HookPositionValuation = {
  poolId: string;
  owner: string;
  tickLower: number;
  tickUpper: number;
  salt: string;
  classification: HookPositionClassification;
  liquidity: string;
  active: boolean;
  amount0Raw: string;
  amount1Raw: string;
  amount0?: string;
  amount1?: string;
  token0UsdPrice?: number;
  token1UsdPrice?: number;
  value0Usd?: number;
  value1Usd?: number;
  totalValueUsd?: number;
  valuationComplete: boolean;
  incompleteReasons?: string[];
  stateViewValidated: boolean;
};

export type HookPositionValuationSummary = {
  poolId: string;
  indexedPositionCount: number;
  activePositionCount: number;
  hookOwnedPositionCount: number;
  activeHookOwnedPositionCount: number;
  hookOwnedAmount0Raw?: string;
  hookOwnedAmount1Raw?: string;
  hookOwnedAmount0?: string;
  hookOwnedAmount1?: string;
  hookOwnedValueUsd?: number;
  foreignPosmValueUsd?: number;
  foreignOtherValueUsd?: number;
  foreignTotalValueUsd?: number;
  reconstructedPoolValueUsd?: number;
  hookValuationComplete: boolean;
  foreignValuationComplete: boolean;
  priceDataComplete: boolean;
  valuedAtBlock?: number;
  pricedAt?: string;
  stale?: boolean;
  incompleteReasons?: string[];
  terminalState?: HookValuationTerminalState;
};

/** Public Scan payload — summary only. */
export type HookPositionValuationPublic = {
  hookOwnedPositionCount: number;
  activeHookOwnedPositionCount: number;
  hookOwnedAmount0?: string;
  hookOwnedAmount1?: string;
  hookOwnedValueUsd?: number;
  hookValuationComplete: boolean;
  valuedAtBlock?: number;
  incompleteReasons?: string[];
};

export type HookValuationResult = {
  summary: HookPositionValuationSummary;
  publicSummary: HookPositionValuationPublic;
  positions: HookPositionValuation[];
  currency0: string | null;
  currency1: string | null;
  decimals0: number | null;
  decimals1: number | null;
  sqrtPriceX96: string | null;
  tick: number | null;
  valuedAtBlock: number | null;
  pricedAt: string | null;
  stale: boolean;
  generation: string;
  terminalState: HookValuationTerminalState;
};
