import { resolveDeploymentScope } from "@/lib/hansome-score/deployment-scope";
import type { V3PosPoolKey } from "@/lib/hansome-score/lp/v3-position-index/types";
import { V3_POS_INDEX_KEY_PREFIX } from "@/lib/hansome-score/lp/v3-position-index/types";

function normAddr(a: string): string {
  return a.trim().toLowerCase();
}

/**
 * Canonical pool key (Phase 12C):
 * {scope}:scan:v3pos:{chainId}:{npm}:{token0}:{token1}:{fee}
 */
export function buildV3PosIndexKey(key: V3PosPoolKey): string {
  const t0 = normAddr(key.token0);
  const t1 = normAddr(key.token1);
  if (t0 >= t1) {
    throw new Error(
      `v3pos key requires token0 < token1 (got ${key.token0}, ${key.token1})`,
    );
  }
  const scope = resolveDeploymentScope();
  return [
    scope,
    V3_POS_INDEX_KEY_PREFIX,
    String(key.chainId),
    normAddr(key.npm),
    t0,
    t1,
    String(key.fee),
  ].join(":");
}

export function assertNotTransferIndexNamespace(key: string): void {
  if (
    key.startsWith("scan:xfer:") ||
    key.includes(":scan:xfer:") ||
    (key.includes(":xfer:") && !key.includes(":v3pos:"))
  ) {
    throw new Error("v3pos must not use ERC-20 transfer-index namespace");
  }
  const ok =
    key.includes(`:${V3_POS_INDEX_KEY_PREFIX}:`) ||
    key.startsWith(`${V3_POS_INDEX_KEY_PREFIX}:`);
  if (!ok) {
    throw new Error(
      `v3pos key must include ${V3_POS_INDEX_KEY_PREFIX}: (got ${key})`,
    );
  }
}
