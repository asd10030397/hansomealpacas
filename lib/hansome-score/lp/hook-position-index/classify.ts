import { getAddress } from "viem";
import type { HookPositionClassification } from "@/lib/hansome-score/lp/hook-position-index/types";

/**
 * Event sender is the PoolManager position owner.
 * Never infer from ERC-20 balances.
 */
export function classifyHookPositionOwner(params: {
  sender: string;
  hookAddress: string;
  positionManager: string;
}): HookPositionClassification {
  const sender = getAddress(params.sender).toLowerCase();
  const hook = getAddress(params.hookAddress).toLowerCase();
  const posm = getAddress(params.positionManager).toLowerCase();
  if (sender === hook) return "hook_owned";
  if (sender === posm) return "foreign_posm";
  return "foreign_other";
}

/** Zero-delta fee / poke — not an ownership change; still may create key if unseen. */
export function isZeroLiquidityDelta(delta: string | bigint): boolean {
  try {
    return BigInt(delta) === 0n;
  } catch {
    return false;
  }
}

export function addNetDelta(
  prev: string | undefined,
  delta: string,
): string {
  const a = prev ? BigInt(prev) : 0n;
  return (a + BigInt(delta)).toString();
}
