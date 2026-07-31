import type {
  EvidenceLevel,
  LpLockState,
  LpLockStateDisplay,
  ProtocolSupportStatus,
  UniswapVersion,
  V4OwnershipClass,
  V4PositionInfo,
} from "@/lib/hansome-score/types";
import type { PoolInventoryMateriality } from "@/lib/hansome-score/lp/pool-materiality";

export type { UniswapVersion, ProtocolSupportStatus };

export type VersionPoolHit = {
  version: UniswapVersion;
  /** Pair (v2), pool (v3), or poolId/bytes32 hex (v4). */
  poolOrPair: string;
  quoteToken: string | null;
  fee: number | null;
  tokenBalanceRaw: string | null;
  /** Quote/other-side raw balance when read; null = unread/failed. */
  quoteBalanceRaw?: string | null;
  /**
   * Inventory classification for this discovered pool.
   * Presentation stubs are emitted only for `material`.
   */
  materiality?: PoolInventoryMateriality;
};

export type VersionDiscoveryResult = {
  version: UniswapVersion;
  protocolSupportStatus: ProtocolSupportStatus;
  searched: boolean;
  discoveryComplete: boolean;
  lockAnalysisComplete: boolean;
  /** V4 only — Class A PosM NFT vs Class B hook-native. */
  ownershipClass?: V4OwnershipClass | null;
  /**
   * Phase 10C-1: NPM position enumeration for material pools finished exhaustively.
   * Distinct from lockAnalysisComplete (owner lock semantics / adapters).
   */
  positionDiscoveryComplete?: boolean;
  positionDiscoverySource?: string | null;
  positionDiscoveryFromBlock?: number | null;
  positionDiscoveryToBlock?: number | null;
  positionDiscoveryCheckpoint?: string | null;
  /** Honest progress actions from V3 position index (attempt-scoped). */
  v3PositionIndexProgressActions?: string[];
  pools: VersionPoolHit[];
  /** Material ownership slots — may include synthetic unknown rows for undecoded pools. */
  positions: V4PositionInfo[];
  detail: string;
  evidenceLevel: EvidenceLevel;
};

/** Helper to build a synthetic unknown ownership slot for a discovered but undecoded pool. */
export function syntheticUnknownPosition(params: {
  id: string;
  version: UniswapVersion;
  poolOrPair: string;
  currency0?: string | null;
  currency1?: string | null;
  fee?: number | null;
  dataSource: string;
}): V4PositionInfo {
  const lockState: LpLockState = "UNABLE_TO_DETERMINE";
  const lockStateDisplay: LpLockStateDisplay = "UNABLE TO DETERMINE";
  return {
    positionNftId: params.id,
    owner: null,
    ownerLabel: null,
    lockerName: null,
    lockerAddress: null,
    lockState,
    lockStateDisplay,
    unlockTimestamp: null,
    unlockDateUtc: null,
    lockCreatedAt: null,
    lockTxHash: null,
    liquidity: "1",
    amount0Raw: null,
    amount1Raw: null,
    poolId: params.poolOrPair,
    currency0: params.currency0 ?? null,
    currency1: params.currency1 ?? null,
    fee: params.fee ?? null,
    tickSpacing: null,
    tickLower: null,
    tickUpper: null,
    currentTick: null,
    inRange: null,
    removableByEoa: null,
    evidenceLevel: "unavailable",
    dataSource: params.dataSource,
  };
}
