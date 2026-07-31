import { LOCKER_SUPPORT_PUBLIC_NOTE, UNISWAP_RH_DEPLOYMENTS } from "@/lib/hansome-score/lp/deployments";
import type { UniswapVersion, UniswapVersionCoverage } from "@/lib/hansome-score/types";

/** Default coverage when only the v4 path ran (or tests). Marks v2/v3 unsearched. */
export function emptyUniswapVersionCoverage(partial?: {
  v4Searched?: boolean;
  v4Pools?: number;
  v4Positions?: number;
  v4DiscoveryComplete?: boolean;
  v4LockComplete?: boolean;
  v4Detail?: string;
}): UniswapVersionCoverage {
  const v4Searched = partial?.v4Searched ?? false;
  return {
    versionsDetected: (partial?.v4Pools ?? 0) > 0 ? (["v4"] as UniswapVersion[]) : [],
    coverageComplete: false,
    incompleteReason:
      "INCOMPLETE COVERAGE — Uniswap v2/v3 not searched in this path. A single Uniswap version cannot prove all-chain liquidity is locked.",
    byVersion: {
      v2: {
        version: "v2",
        protocolSupportStatus: UNISWAP_RH_DEPLOYMENTS.v2.protocolSupportStatus,
        searched: false,
        poolsFound: 0,
        positionsFound: 0,
        discoveryComplete: false,
        lockAnalysisComplete: false,
        detail: "v2 not searched.",
      },
      v3: {
        version: "v3",
        protocolSupportStatus: UNISWAP_RH_DEPLOYMENTS.v3.protocolSupportStatus,
        searched: false,
        poolsFound: 0,
        positionsFound: 0,
        discoveryComplete: false,
        lockAnalysisComplete: false,
        detail: "v3 not searched.",
      },
      v4: {
        version: "v4",
        protocolSupportStatus: UNISWAP_RH_DEPLOYMENTS.v4.protocolSupportStatus,
        searched: v4Searched,
        poolsFound: partial?.v4Pools ?? 0,
        positionsFound: partial?.v4Positions ?? 0,
        discoveryComplete: partial?.v4DiscoveryComplete ?? false,
        lockAnalysisComplete: partial?.v4LockComplete ?? false,
        detail: partial?.v4Detail ?? "v4 not searched.",
      },
    },
    protocolSupportNote:
      "Uniswap v2/v3/v4 deployments are active on Robinhood Chain. Prefer detectMultiVersionLpIntelligence for cross-version coverage.",
    lockerSupportNote: LOCKER_SUPPORT_PUBLIC_NOTE,
  };
}

/** Complete-enough coverage fixture for unit tests (all versions searched, no extra pools). */
export function testCompleteVersionCoverage(
  versionsDetected: UniswapVersion[] = ["v4"],
): UniswapVersionCoverage {
  const base = emptyUniswapVersionCoverage({
    v4Searched: true,
    v4Pools: versionsDetected.includes("v4") ? 1 : 0,
    v4Positions: 1,
    v4DiscoveryComplete: true,
    v4LockComplete: true,
    v4Detail: "test v4",
  });
  return {
    ...base,
    versionsDetected,
    coverageComplete: true,
    incompleteReason: null,
    byVersion: {
      v2: {
        ...base.byVersion.v2,
        searched: true,
        discoveryComplete: true,
        lockAnalysisComplete: true,
        detail: "v2 probed — none (test)",
      },
      v3: {
        ...base.byVersion.v3,
        searched: true,
        discoveryComplete: true,
        lockAnalysisComplete: true,
        detail: "v3 probed — none (test)",
      },
      v4: base.byVersion.v4,
    },
  };
}
