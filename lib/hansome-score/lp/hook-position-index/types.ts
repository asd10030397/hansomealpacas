/**
 * Phase 11E — Hook Position Index (discovery / indexing / completeness only).
 * No USD / token amounts / lock% / LOCKED_VERIFIED.
 */

export const HOOK_POS_INDEX_SCHEMA_VERSION = 1 as const;
export const HOOK_POS_INDEX_SEMANTIC_VERSION = "1.0.0-phase11e" as const;

/** Isolated namespace — never overload v3pos / v4pos / xfer / titan. */
export const HOOK_POS_INDEX_KEY_PREFIX = "scan:v4hook" as const;

export type HookPositionClassification =
  | "hook_owned"
  | "foreign_posm"
  | "foreign_other"
  | "unknown";

export type HookPositionSource =
  | "modify_liquidity_log"
  | "create_tx_receipt"
  | "init_data"
  | "fixture";

export type HookDiscoveryMethod =
  | "create_receipt"
  | "full_log_replay"
  | "partial_log_replay"
  | "init_data"
  | "fixture"
  | "unknown";

export type HookIndexTerminalState =
  | "NEW"
  | "BOOTSTRAPPING"
  | "REPLAYING"
  | "PUBLISHING"
  | "SUCCESS_COMPLETE"
  | "SUCCESS_PARTIAL"
  | "FAILED_TERMINAL";

/** Machine keys for incompleteReasons. */
export type HookIncompleteReason =
  | "create_block_unknown"
  | "create_tx_unknown"
  | "rpc_range_limited"
  | "replay_partial"
  | "safe_head_not_reached"
  | "init_data_unavailable"
  | "topic_filter_untrusted"
  | "fixture_only"
  | "foreign_backfill_skipped"
  | "state_view_failed"
  | "budget_exceeded"
  | "reorg_detected"
  | "failed_terminal";

export type HookPositionKey = {
  chainId: number;
  poolId: string;
  owner: string;
  tickLower: number;
  tickUpper: number;
  salt: string;
};

export type HookPositionRecord = HookPositionKey & {
  classification: HookPositionClassification;
  firstSeenBlock: number;
  lastSeenBlock: number;
  lastLiquidityDelta?: string;
  netLiquidityDelta?: string;
  source: HookPositionSource;
  /** Optional tip validation — not valuation. */
  liveLiquidity?: string;
  stateViewValidated?: boolean;
  active?: boolean;
  lastError?: string | null;
};

export type HookPositionIndexState = {
  schemaVersion: typeof HOOK_POS_INDEX_SCHEMA_VERSION;
  semanticVersion: typeof HOOK_POS_INDEX_SEMANTIC_VERSION;
  chainId: number;
  poolId: string;
  hookAddress?: string;
  positionManager?: string;
  poolManager?: string;
  createTx?: string | null;
  createBlock?: number | null;
  lastSyncedBlock?: number | null;
  lastSyncedBlockHash?: string | null;
  safeHeadBlock?: number | null;
  confirmationDepth: number;
  positions: HookPositionRecord[];
  hookDiscoveryComplete: boolean;
  foreignDiscoveryComplete: boolean;
  discoveryMethod: HookDiscoveryMethod;
  incompleteReasons: HookIncompleteReason[];
  /** Monotonic fence — stringified integer. */
  generation: string;
  terminalState: HookIndexTerminalState;
  failedReason?: string | null;
  lastSuccessfulBlock?: number | null;
  updatedAt: string;
  metrics?: HookPosSyncMetrics;
};

export type HookPosSyncMetrics = {
  mode: "bootstrap" | "incremental" | "reorg_rescan" | "fixture";
  fromBlock: number | null;
  toBlock: number | null;
  logCount: number;
  acceptedLogCount: number;
  rejectedLogCount: number;
  rpcCalls: number;
  retries: number;
  wallMs: number;
  chunkShrinks: number;
};

/** Public Scan summary — no full keys in payload. */
export type HookPositionIndexSummary = {
  poolId: string;
  hookAddress?: string;
  indexedPositionCount: number;
  hookOwnedCount: number;
  foreignPosmCount: number;
  foreignOtherCount: number;
  activeHookOwnedCount?: number;
  hookDiscoveryComplete: boolean;
  foreignDiscoveryComplete: boolean;
  discoveryMethod: string;
  lastSyncedBlock?: number;
  safeHeadBlock?: number;
  incompleteReasons?: string[];
  terminalState?: HookIndexTerminalState;
};

export type DecodedModifyLiquidity = {
  poolId: string;
  sender: string;
  tickLower: number;
  tickUpper: number;
  liquidityDelta: string;
  salt: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
};

export type RawLogLike = {
  address?: string;
  topics?: readonly string[] | string[];
  data?: string;
  blockNumber?: bigint | number | string;
  transactionHash?: string;
  logIndex?: number | string;
};
