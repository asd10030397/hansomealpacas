/**
 * Phase 10B — position status classification (prototype / audit only).
 * Never emits Production Locked/Unlocked conclusions.
 */

import { PONS_LAUNCH_LOCKER_AUDIT, ZERO_ADDRESS } from "@/lib/hansome-score/lp/v3-position-index/abis";
import type {
  V3PosOwnerValidationStatus,
  V3PosTokenStatus,
} from "@/lib/hansome-score/lp/v3-position-index/types";

function norm(a: string): string {
  return a.trim().toLowerCase();
}

export function classifyLiquidityState(liquidity: bigint | string): {
  zeroLiquidity: boolean;
  materialCandidate: boolean;
} {
  const L = typeof liquidity === "bigint" ? liquidity : BigInt(liquidity || "0");
  const zero = L === 0n;
  return {
    zeroLiquidity: zero,
    // liquidity == 0 is NEVER material LP ownership
    materialCandidate: !zero,
  };
}

export function classifyInRange(params: {
  tickLower: number | null;
  tickUpper: number | null;
  currentTick: number | null;
}): boolean | null {
  const { tickLower, tickUpper, currentTick } = params;
  if (
    tickLower == null ||
    tickUpper == null ||
    currentTick == null ||
    !Number.isFinite(tickLower) ||
    !Number.isFinite(tickUpper) ||
    !Number.isFinite(currentTick)
  ) {
    return null;
  }
  return currentTick >= tickLower && currentTick < tickUpper;
}

export function classifyTokenStatus(params: {
  burned: boolean;
  zeroLiquidity: boolean;
  inRange: boolean | null;
  liquidity: bigint | string;
}): V3PosTokenStatus {
  if (params.burned) return "burned";
  const { zeroLiquidity } = classifyLiquidityState(params.liquidity);
  if (zeroLiquidity) return "zero_liquidity";
  if (params.inRange === false) return "inactive_nonzero";
  if (params.inRange === true) return "active";
  return "unknown";
}

/**
 * ownerOf revert → burned/nonexistent. NEVER means unlocked.
 */
export function classifyOwnerValidation(
  ownerOfResult: { ok: true; owner: string } | { ok: false; revert: boolean; error?: string },
): {
  currentOwner: string | null;
  ownerValidationStatus: V3PosOwnerValidationStatus;
  burned: boolean;
  lastError: string | null;
} {
  if (ownerOfResult.ok) {
    return {
      currentOwner: ownerOfResult.owner,
      ownerValidationStatus: "ok",
      burned: false,
      lastError: null,
    };
  }
  if (ownerOfResult.revert) {
    return {
      currentOwner: null,
      ownerValidationStatus: "burned_or_nonexistent",
      burned: true,
      lastError: ownerOfResult.error ?? "ownerOf reverted",
    };
  }
  return {
    currentOwner: null,
    ownerValidationStatus: "transient_error",
    burned: false,
    lastError: ownerOfResult.error ?? "ownerOf transient failure",
  };
}

/** Audit-only owner type. Does NOT imply Production lock. */
export function classifyOwnerTypeAudit(params: {
  owner: string | null;
  codeSize: number | null;
}): "eoa" | "contract" | "locker_pons" | "unknown" | null {
  if (!params.owner) return null;
  if (norm(params.owner) === norm(PONS_LAUNCH_LOCKER_AUDIT)) return "locker_pons";
  if (params.codeSize == null) return "unknown";
  if (params.codeSize === 0) return "eoa";
  return "contract";
}

export function isZeroAddress(a: string): boolean {
  return norm(a) === norm(ZERO_ADDRESS);
}
