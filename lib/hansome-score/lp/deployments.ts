import { getAddress, type Address } from "viem";
import {
  POOL_MANAGER_ADDRESS,
  POSITION_MANAGER_ADDRESS,
} from "@/lib/hansome-score/constants";
import { STATE_VIEW_ADDRESS } from "@/lib/chain";
import type { ProtocolSupportStatus, UniswapVersion } from "@/lib/hansome-score/types";

/** Canonical quote tokens for RH pair/pool discovery probes. */
export const RH_QUOTE_TOKENS = {
  WETH: getAddress("0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73") as Address,
  USDG: getAddress("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168") as Address,
} as const;

export const RH_QUOTE_TOKEN_LIST: Address[] = [
  RH_QUOTE_TOKENS.WETH,
  RH_QUOTE_TOKENS.USDG,
];

/** Common Uniswap v3 fee tiers on RH. */
export const V3_FEE_TIERS = [100, 500, 3000, 10000] as const;

/**
 * Robinhood Chain Uniswap deployments (audit 2026-07-27).
 * See reports/ROBINHOOD_UNISWAP_AND_LOCKER_AUDIT.md.
 */
export const UNISWAP_RH_DEPLOYMENTS = {
  v2: {
    version: "v2" as const,
    active: true,
    protocolSupportStatus: "partial" as ProtocolSupportStatus,
    factory: getAddress("0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f") as Address,
    router: getAddress("0x89e5DB8B5aA49aA85AC63f691524311AEB649eba") as Address,
    note: "Factory active (allPairsLength ≫ 0). Pair discovery via getPair; LP ownership/locker decode not reliable yet.",
  },
  v3: {
    version: "v3" as const,
    active: true,
    protocolSupportStatus: "partial" as ProtocolSupportStatus,
    factory: getAddress("0x1f7d7550B1b028f7571E69A784071F0205FD2EfA") as Address,
    positionManager: getAddress(
      "0x73991a25c818bf1f1128deaab1492d45638de0d3",
    ) as Address,
    swapRouter02: getAddress("0xCaf681a66D020601342297493863E78C959E5cb2") as Address,
    note: "Factory + NPM verified/active. Pool probes via getPool; NPM position/lock enumeration not complete.",
  },
  v4: {
    version: "v4" as const,
    active: true,
    protocolSupportStatus: "partial" as ProtocolSupportStatus,
    poolManager: POOL_MANAGER_ADDRESS,
    positionManager: POSITION_MANAGER_ADDRESS,
    stateView: STATE_VIEW_ADDRESS,
    note: "PoolManager/PositionManager path live. Position discovery partial; Titan locker decode only.",
  },
} as const;

export const LOCKER_SUPPORT_PUBLIC_NOTE =
  "Locker support is separate from Uniswap version support. Reliably decoded today: TitanLockerManagerV2 (v4 timed locks) and PonsLaunchLocker (v3 NPM permanent escrow, adapter-verified). Other V3 lockers remain Unknown until an approved adapter ships. Unknown contracts holding LP/positions are not treated as verified locks.";

export function protocolSupportFor(version: UniswapVersion): ProtocolSupportStatus {
  return UNISWAP_RH_DEPLOYMENTS[version].protocolSupportStatus;
}
