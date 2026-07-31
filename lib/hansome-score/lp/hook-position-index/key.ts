import {
  HOOK_POS_INDEX_KEY_PREFIX,
} from "@/lib/hansome-score/lp/hook-position-index/types";

function normPoolId(poolId: string): string {
  const p = poolId.trim().toLowerCase();
  if (!p.startsWith("0x") || p.length !== 66) {
    throw new Error(`v4hook key requires 32-byte poolId (got ${poolId})`);
  }
  return p;
}

/** Canonical: scan:v4hook:{chainId}:{poolId} */
export function buildHookPosIndexKey(params: {
  chainId: number;
  poolId: string;
}): string {
  return [
    HOOK_POS_INDEX_KEY_PREFIX,
    String(params.chainId),
    normPoolId(params.poolId),
  ].join(":");
}

export function assertHookPosNamespace(key: string): void {
  const isXfer =
    key.startsWith("scan:xfer:") ||
    key.includes(":scan:xfer:") ||
    (key.includes(":xfer:") && !key.includes(":v4hook:"));
  const isV3orV4pos =
    key.includes(":scan:v3pos:") ||
    key.includes(":scan:v4pos:") ||
    key.startsWith("scan:v3pos:") ||
    key.startsWith("scan:v4pos:");
  if (isXfer || isV3orV4pos) {
    throw new Error("v4hook must not use transfer / v3pos / v4pos namespaces");
  }
  // Phase 12C: {scope}:scan:v4hook:... or legacy scan:v4hook:...
  const ok =
    key.includes(`:${HOOK_POS_INDEX_KEY_PREFIX}:`) ||
    key.startsWith(`${HOOK_POS_INDEX_KEY_PREFIX}:`);
  if (!ok) {
    throw new Error(
      `v4hook key must include ${HOOK_POS_INDEX_KEY_PREFIX}: (got ${key})`,
    );
  }
}

/**
 * Phase 12C — deployment-scoped wrapper:
 * {scope}:scan:v4hook:{chainId}:{poolId}
 */
export function buildScopedHookPosIndexKey(params: {
  scope: string;
  chainId: number;
  poolId: string;
}): string {
  const scope = params.scope.trim().replace(/[/\\]+/g, "_").slice(0, 120);
  return [
    scope || "local",
    HOOK_POS_INDEX_KEY_PREFIX,
    String(params.chainId),
    normPoolId(params.poolId),
  ].join(":");
}
