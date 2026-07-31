import type {
  LockerAdapter,
  LockerDiscoveryContext,
  VerifiedLockerPosition,
} from "@/lib/hansome-score/lp/lockers/types";
import { ponsLaunchLockerAdapter } from "@/lib/hansome-score/lp/lockers/pons";

export type {
  LockerAdapter,
  LockerDiscoveryContext,
  VerifiedLockerPosition,
} from "@/lib/hansome-score/lp/lockers/types";
export { verifiedLockerToPositionInfo } from "@/lib/hansome-score/lp/lockers/types";
export {
  classifyDiscoveredV3Positions,
  classifyV3PositionLock,
  resolveV3OwnerType,
  isSyntheticV3StubId,
  isMaterialLiquidity,
  v3LockClassToLpLockState,
  type V3LockClass,
  type V3OwnerType,
} from "@/lib/hansome-score/lp/lockers/classify-v3";

/**
 * Token-scoped locker adapters that participate in v3 NPM lock classification.
 * Titan remains on the v4 PositionManager path (detect.ts + titan.ts).
 *
 * Phase 10C-2: PonsLaunchLocker ONLY — approved verified classification adapter.
 * Discovery (V3 Position Index) stays separate; adapters verify locks after attach.
 */
export const V3_LOCKER_ADAPTERS: LockerAdapter[] = [ponsLaunchLockerAdapter];

/**
 * Run all registered v3 locker adapters for a token.
 * Failures in one adapter never poison others; empty results stay Unknown.
 */
export async function discoverV3LockerPositions(
  ctx: LockerDiscoveryContext,
): Promise<VerifiedLockerPosition[]> {
  const out: VerifiedLockerPosition[] = [];
  const seen = new Set<string>();

  for (const adapter of V3_LOCKER_ADAPTERS) {
    let hits: VerifiedLockerPosition[] = [];
    try {
      hits = await adapter.discoverPositionsForToken(ctx);
    } catch {
      hits = [];
    }
    for (const hit of hits) {
      const key = `${hit.adapterId}:${hit.positionNftId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(hit);
    }
  }

  return out;
}
