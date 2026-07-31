/**
 * Phase 10C-1 — Pool-scoped V3 Position Index (Production discovery path).
 * Lock classification remains separate; adapters stay empty unless approved.
 */

export const V3_POS_INDEX_SCHEMA_VERSION = 1 as const;
export const V3_POS_INDEX_SEMANTIC_VERSION = "1.0.0-phase10c1" as const;

/** Isolated namespace — never overload scan:xfer:*. */
export const V3_POS_INDEX_KEY_PREFIX = "scan:v3pos" as const;

export type V3PosOwnerValidationStatus =
  | "ok"
  | "burned_or_nonexistent"
  | "transient_error"
  | "unchecked";

export type V3PosTokenStatus =
  | "active"
  | "inactive_nonzero"
  | "zero_liquidity"
  | "burned"
  | "unknown";

export type V3PosTokenSource =
  | "pool_mint_receipt"
  | "incremental_mint"
  | "reorg_rescan"
  | "fixture";

export type V3PosTokenIdRecord = {
  tokenId: string;
  firstSeenBlock: number;
  firstSeenTx: string;
  lastTransferBlock: number | null;
  lastTransferTx: string | null;
  currentOwner: string | null;
  ownerValidatedAtBlock: number | null;
  ownerValidationStatus: V3PosOwnerValidationStatus;
  token0: string;
  token1: string;
  fee: number;
  tickLower: number | null;
  tickUpper: number | null;
  liquidity: string;
  positionValidatedAtBlock: number | null;
  status: V3PosTokenStatus;
  burned: boolean;
  zeroLiquidity: boolean;
  /** Audit-only owner type — never Production lock classification. */
  ownerTypeAudit: "eoa" | "contract" | "locker_pons" | "unknown" | null;
  /** True when economic amounts may be nonzero (liquidity > 0). */
  materialCandidate: boolean;
  inRange: boolean | null;
  source: V3PosTokenSource;
  lastError: string | null;
};

export type V3PosIndexRecord = {
  schemaVersion: typeof V3_POS_INDEX_SCHEMA_VERSION;
  semanticVersion: typeof V3_POS_INDEX_SEMANTIC_VERSION;
  chainId: number;
  factory: string;
  npm: string;
  poolAddress: string;
  token0: string;
  token1: string;
  fee: number;
  poolCreationBlock: number | null;
  firstMintBlock: number | null;
  lastSyncedBlock: number | null;
  lastSyncedBlockHash: string | null;
  reorgSafeHead: number | null;
  generation: number;
  exhaustiveFromBlock: number | null;
  exhaustiveToBlock: number | null;
  discoveryComplete: boolean;
  completenessErrors: string[];
  tokenIds: V3PosTokenIdRecord[];
  updatedAt: number;
  /** Prototype metrics (observational). */
  metrics?: V3PosSyncMetrics;
};

export type V3PosSyncMetrics = {
  mode: "backfill" | "incremental" | "reorg_rescan";
  fromBlock: number;
  toBlock: number;
  mintEventCount: number;
  receiptCount: number;
  candidateTokenIdCount: number;
  validMatchingTokenIdCount: number;
  rpcCalls: number;
  retries: number;
  wallMs: number;
  eventsProcessed?: number;
  idsRevalidated?: number;
};

export type V3PosPoolKey = {
  chainId: number;
  npm: string;
  token0: string;
  token1: string;
  fee: number;
};

export type DecodedNpmTransfer = {
  tokenId: string;
  from: string;
  to: string;
  logIndex: number;
};

export type DecodedIncreaseLiquidity = {
  tokenId: string;
  liquidity: string;
  logIndex: number;
};

export type DecodedPoolMint = {
  blockNumber: number;
  txHash: string;
  tickLower: number;
  tickUpper: number;
  amountL: string;
  sender: string;
  owner: string;
};

export type ResolveReceiptInput = {
  txHash: string;
  blockNumber: number;
  npm: string;
  poolToken0: string;
  poolToken1: string;
  poolFee: number;
  transfers: DecodedNpmTransfer[];
  increaseLiquidity: DecodedIncreaseLiquidity[];
  /** positions(tokenId) results keyed by tokenId decimal string. */
  positionsById: Record<
    string,
    | {
        token0: string;
        token1: string;
        fee: number;
        tickLower: number;
        tickUpper: number;
        liquidity: string;
      }
    | null
    | "error"
  >;
};

export type ResolveReceiptResult = {
  matchingTokenIds: string[];
  ignoredUnrelated: string[];
  ignoredWrongPool: string[];
  errors: string[];
};
