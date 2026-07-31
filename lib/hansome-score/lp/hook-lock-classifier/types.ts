/**
 * Phase 11H — Hook Lock Classifier types.
 * Distinct from Titan LOCKED_VERIFIED / aggregate lock states.
 */

export type HookPrincipalLockState =
  | "HOOK_PRINCIPAL_LOCKED_ONCHAIN"
  | "HOOK_TIMED_LOCK"
  | "HOOK_PERMANENT_LOCK"
  | "HOOK_UNLOCKABLE"
  | "HOOK_MIGRATION_PENDING"
  | "HOOK_EXITED"
  | "HOOK_GRADUATED_INCOMPLETE"
  | "UNKNOWN_INCOMPLETE";

export type HookLockClassifierTerminalState =
  | "NEW"
  | "RESOLVING_PROTOCOL"
  | "VERIFYING_PREDICATES"
  | "CLASSIFIED"
  | "UNKNOWN_INCOMPLETE"
  | "FAILED_TERMINAL";

export type HookLockClassification = {
  state: HookPrincipalLockState;
  principalValueUsd?: number;
  principalAmount0?: string;
  principalAmount1?: string;
  unlockTime?: number;
  status?: string;
  poolInitializer?: string;
  liquidityMigrator?: string;
  locker?: string;
  hookDiscoveryComplete: boolean;
  hookValuationComplete: boolean;
  foreignDiscoveryComplete: boolean;
  lockAmountComplete: boolean;
  poolShareAvailable: boolean;
  /** Internal-only metric — not a generic pool lock %. */
  hookPrincipalLockedShare?: number;
  evidence: string[];
  incompleteReasons?: string[];
  terminalState?: HookLockClassifierTerminalState;
};

/** Public Scan summary. */
export type HookLockClassificationPublic = {
  state: HookPrincipalLockState;
  principalValueUsd?: number;
  unlockTime?: number;
  lockAmountComplete: boolean;
  poolShareAvailable: boolean;
  evidence: string[];
  incompleteReasons?: string[];
};

export type AirlockAssetData = {
  numeraire: string;
  timelock: string;
  governance: string;
  liquidityMigrator: string;
  poolInitializer: string;
  pool: string;
  migrationPool: string;
  numTokensToSell: string;
  totalSupply: string;
  integrator: string;
};

export type DopplerHookState = {
  status: number;
  statusName: string;
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
  farTick: number;
  dopplerHook?: string;
};

export type SflStreamSnapshot = {
  exists: boolean;
  recipient?: string;
  startDate?: number;
  lockDuration?: number;
  isUnlocked?: boolean;
  unlockTime?: number;
};
