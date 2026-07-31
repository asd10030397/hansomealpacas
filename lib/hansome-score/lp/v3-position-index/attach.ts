/**
 * Phase 10C-1 — Attach indexed NPM positions as Production V4PositionInfo slots.
 * Lock classification is Phase 10C-2 (adapters/v3 after attach) — attach stays Unknown.
 */

import { LP_LOCK_STATE_DISPLAY } from "@/lib/hansome-score/constants";
import { fillPositionTokenAmounts } from "@/lib/hansome-score/lp/position-value";
import type {
  V3PosIndexRecord,
  V3PosTokenIdRecord,
} from "@/lib/hansome-score/lp/v3-position-index/types";
import type { V4PositionInfo } from "@/lib/hansome-score/types";

export type V3PosAttachOptions = {
  poolAddress: string;
  /** Include L=0 rows in output (still non-material for aggregate). Default false. */
  includeZeroLiquidity?: boolean;
  /** Include burned/nonexistent rows. Default false. */
  includeBurned?: boolean;
  sqrtPriceX96?: bigint | null;
  currentTick?: number | null;
};

/**
 * Map a revalidated index tokenId → presentation slot.
 * NEVER emits LOCKED_VERIFIED / UNLOCKED from owner type alone.
 */
export function indexedTokenToPositionInfo(
  tok: V3PosTokenIdRecord,
  opts: V3PosAttachOptions,
): V4PositionInfo {
  const lockState = "UNABLE_TO_DETERMINE" as const;
  let pos: V4PositionInfo = {
    positionNftId: tok.tokenId,
    owner: tok.currentOwner,
    ownerLabel: null,
    lockerName: null,
    lockerAddress: null,
    lockState,
    lockStateDisplay: LP_LOCK_STATE_DISPLAY.UNABLE_TO_DETERMINE,
    unlockTimestamp: null,
    unlockDateUtc: null,
    lockCreatedAt: null,
    lockTxHash: tok.firstSeenTx,
    liquidity: tok.liquidity,
    amount0Raw: null,
    amount1Raw: null,
    valueUsd: null,
    poolId: opts.poolAddress,
    currency0: tok.token0,
    currency1: tok.token1,
    fee: tok.fee,
    tickSpacing: null,
    tickLower: tok.tickLower,
    tickUpper: tok.tickUpper,
    currentTick: opts.currentTick ?? null,
    inRange: tok.inRange,
    // Do not invent removable/unlocked from EOA without approved semantics.
    removableByEoa: null,
    evidenceLevel:
      tok.ownerValidationStatus === "ok" && !tok.burned
        ? "on_chain_verified"
        : tok.ownerValidationStatus === "transient_error"
          ? "on_chain_partial"
          : "unavailable",
    dataSource: `v3_position_index:${tok.source}:npm_tokenId=${tok.tokenId}`,
  };

  if (
    opts.sqrtPriceX96 != null &&
    tok.tickLower != null &&
    tok.tickUpper != null &&
    !tok.burned &&
    !tok.zeroLiquidity
  ) {
    pos = fillPositionTokenAmounts(pos, opts.sqrtPriceX96);
  }

  return pos;
}

export function attachIndexedV3Positions(
  record: V3PosIndexRecord,
  opts: V3PosAttachOptions,
): V4PositionInfo[] {
  const includeZero = opts.includeZeroLiquidity === true;
  const includeBurned = opts.includeBurned === true;
  const out: V4PositionInfo[] = [];
  // Stable order: ascending tokenId (store already sorts; re-sort for safety).
  const sorted = [...record.tokenIds].sort((a, b) =>
    BigInt(a.tokenId) < BigInt(b.tokenId)
      ? -1
      : BigInt(a.tokenId) > BigInt(b.tokenId)
        ? 1
        : 0,
  );
  const seen = new Set<string>();
  for (const tok of sorted) {
    if (seen.has(tok.tokenId)) continue;
    seen.add(tok.tokenId);
    if (tok.burned) {
      if (!includeBurned) continue;
    } else if (tok.zeroLiquidity && !includeZero) {
      continue;
    } else if (tok.ownerValidationStatus === "transient_error") {
      continue;
    }
    // Wrong-pool drift safety
    if (
      tok.token0.toLowerCase() !== record.token0.toLowerCase() ||
      tok.token1.toLowerCase() !== record.token1.toLowerCase() ||
      tok.fee !== record.fee
    ) {
      continue;
    }
    out.push(indexedTokenToPositionInfo(tok, opts));
  }
  return out;
}

/**
 * Merge real indexed/locker positions over synthetic stubs for the same pool.
 * Never counts stub liquidity "1" when real positions exist for that pool.
 */
export function mergeRealV3PositionsOverStubs(params: {
  stubs: V4PositionInfo[];
  real: V4PositionInfo[];
  /** When true, keep one incomplete stub alongside partial real discovery. */
  keepIncompleteStubWhenPartial?: boolean;
  poolsWithIncompleteDiscovery?: Set<string>;
}): V4PositionInfo[] {
  const { stubs, real } = params;
  if (real.length === 0) return stubs;

  const resolvedPools = new Set<string>();
  for (const v of real) {
    if (v.poolId) resolvedPools.add(v.poolId.toLowerCase());
  }

  const remainingStubs = stubs.filter((s) => {
    if (!s.poolId) return true;
    const key = s.poolId.toLowerCase();
    if (!resolvedPools.has(key)) return true;
    if (
      params.keepIncompleteStubWhenPartial &&
      params.poolsWithIncompleteDiscovery?.has(key)
    ) {
      // Keep a clearly marked incomplete signal — but never as economic L="1" twin.
      // Prefer dropping stub when at least one real numeric id exists for the pool.
      return false;
    }
    return false;
  });

  // Deduplicate real by positionNftId
  const seen = new Set<string>();
  const uniqueReal: V4PositionInfo[] = [];
  for (const r of real) {
    const id = r.positionNftId;
    if (seen.has(id)) continue;
    seen.add(id);
    uniqueReal.push(r);
  }

  return [...uniqueReal, ...remainingStubs];
}
