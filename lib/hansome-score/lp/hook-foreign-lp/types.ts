/**
 * Phase 11G — Foreign LP Separator types.
 */

export type HookForeignLpTerminalState =
  | "NEW"
  | "CLASSIFYING"
  | "AGGREGATING"
  | "SUCCESS_COMPLETE"
  | "SUCCESS_PARTIAL"
  | "FAILED_TERMINAL";

export type HookForeignLpBucket = {
  positionCount: number;
  activeCount: number;
  valueUsd?: number;
  amount0?: string;
  amount1?: string;
};

export type HookForeignLpSeparation = {
  poolId: string;
  hookOwned: HookForeignLpBucket;
  foreignPosm: HookForeignLpBucket;
  foreignOther: HookForeignLpBucket;
  foreignTotalValueUsd?: number;
  reconstructedPoolValueUsd?: number;
  hookShareOfReconstructedPool?: number;
  hookDiscoveryComplete: boolean;
  foreignDiscoveryComplete: boolean;
  hookValuationComplete: boolean;
  foreignValuationComplete: boolean;
  poolReconstructionComplete: boolean;
  hookOwnedAmountsComplete: boolean;
  incompleteReasons?: string[];
  terminalState?: HookForeignLpTerminalState;
};

/** Public Scan summary. */
export type HookForeignLpSeparationPublic = {
  hookOwnedValueUsd?: number;
  foreignPosmValueUsd?: number;
  foreignOtherValueUsd?: number;
  reconstructedPoolValueUsd?: number;
  hookShareOfReconstructedPool?: number;
  poolReconstructionComplete: boolean;
  incompleteReasons?: string[];
};
