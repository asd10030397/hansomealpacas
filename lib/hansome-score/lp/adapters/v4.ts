import { UNISWAP_RH_DEPLOYMENTS } from "@/lib/hansome-score/lp/deployments";
import {
  detectV4LpIntelligence,
  type DetectLpInput,
  type DetectLpResult,
} from "@/lib/hansome-score/lp/detect";
import type { VersionDiscoveryResult } from "@/lib/hansome-score/lp/adapters/types";
import { resolveHookIntelligence } from "@/lib/hansome-score/lp/hook-intelligence/resolve";
import {
  applyV4OwnershipClassToIntelligence,
  detectV4OwnershipClass,
} from "@/lib/hansome-score/lp/v4-ownership-class";
import { buildHookPositionIndexSummary } from "@/lib/hansome-score/lp/hook-position-index";

/**
 * Uniswap v4 adapter — delegates to existing detectV4LpIntelligence.
 * Protocol + Titan locker path are partial (position enumeration incomplete by design).
 * Phase 11A: ownership class detection (posm_nft vs hook_native) — no Doppler lock adapter.
 * Phase 11E–11H: Hook Position Index + Valuer + Foreign LP + Hook Lock Classifier (Class B).
 * Hook lock NEVER merges into Titan LOCKED_VERIFIED semantics.
 */
export async function discoverV4Liquidity(
  input: DetectLpInput,
): Promise<{ version: VersionDiscoveryResult; detect: DetectLpResult }> {
  const dep = UNISWAP_RH_DEPLOYMENTS.v4;
  const detect = await detectV4LpIntelligence(input);
  const intel = detect.intelligence;

  const ownership = await detectV4OwnershipClass({
    tokenAddress: input.tokenAddress,
    poolManagerBalance: input.poolManagerBalance ?? 0n,
    positions: intel.positions,
  });
  applyV4OwnershipClassToIntelligence(intel, ownership);

  // Phase 11E–11H — Class B only; never override Class A; failures must not block Scan.
  if (ownership.ownershipClass === "hook_native") {
    try {
      const hookIntel = await resolveHookIntelligence({
        tokenAddress: input.tokenAddress,
        ownershipClass: ownership.ownershipClass,
        poolId: ownership.poolId ?? intel.poolId,
        tokenDecimals: input.decimals,
        interactiveBudgetMs: 4_500,
      });
      if (hookIntel.indexState) {
        intel.hookPositionIndex = buildHookPositionIndexSummary(
          hookIntel.indexState,
        );
      }
      intel.hookPositionValuation =
        hookIntel.public.hookPositionValuation ?? null;
      intel.hookForeignLpSeparation =
        hookIntel.public.hookForeignLpSeparation ?? null;
      intel.hookLockClassification =
        hookIntel.public.hookLockClassification ?? null;

      const parts = [intel.detail];
      if (intel.hookPositionIndex) {
        parts.push(
          `hookPositionIndex: owned=${intel.hookPositionIndex.hookOwnedCount}` +
            ` complete=${intel.hookPositionIndex.hookDiscoveryComplete}` +
            ` method=${intel.hookPositionIndex.discoveryMethod}.`,
        );
      }
      if (intel.hookLockClassification) {
        parts.push(
          `hookLockClassification: ${intel.hookLockClassification.state}` +
            ` lockAmountComplete=${intel.hookLockClassification.lockAmountComplete}.`,
        );
      }
      intel.detail = parts.filter(Boolean).join(" ");
    } catch (err) {
      console.warn("[v4] hook intelligence skipped:", err);
    }
  }

  const poolIds = new Set(
    intel.positions.map((p) => p.poolId).filter((id): id is string => !!id),
  );
  if (intel.poolId) poolIds.add(intel.poolId);
  if (ownership.poolId) poolIds.add(ownership.poolId);

  const lockAnalysisComplete =
    ownership.ownershipClass === "hook_native"
      ? false
      : intel.discoveryComplete &&
        intel.aggregateState !== "UNKNOWN_INCOMPLETE" &&
        (intel.positionCounts?.unknown ?? 0) === 0;

  const version: VersionDiscoveryResult = {
    version: "v4",
    protocolSupportStatus: dep.protocolSupportStatus,
    searched: true,
    discoveryComplete: intel.discoveryComplete,
    lockAnalysisComplete,
    ownershipClass: ownership.ownershipClass,
    pools: [...poolIds].map((id) => ({
      version: "v4" as const,
      poolOrPair: id,
      quoteToken: null,
      fee: ownership.poolKey?.fee ?? null,
      tokenBalanceRaw: intel.poolManagerBalanceRaw,
      materiality: "material" as const,
    })),
    positions: intel.positions,
    detail:
      ownership.ownershipClass === "hook_native"
        ? `${intel.detail} ownershipClass=hook_native (Hook lock classifier separate from Titan; aggregate lock analysis incomplete).`
        : intel.detail,
    evidenceLevel: intel.evidenceLevel,
  };

  if (!intel.poolDetected) {
    version.discoveryComplete = true;
    version.lockAnalysisComplete = true;
    version.ownershipClass = "unknown";
    version.detail = "v4: no PoolManager token balance.";
  }

  return { version, detect };
}
