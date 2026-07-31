/**
 * PHASE11A — Uniswap V4 ownership class detection (Class A vs Class B).
 *
 * Class A: PositionManager NFT path (existing Titan/ownerOf).
 * Class B: Hook-native (Airlock / Doppler / dynamic-fee) — unsupported for lock
 * verification today. Never invent Locked; never derive lock% from PoolManager
 * inventory alone.
 */

import {
  createPublicClient,
  encodeAbiParameters,
  getAddress,
  http,
  parseAbiParameters,
  keccak256,
  zeroAddress,
  type Address,
  type PublicClient,
} from "viem";
import {
  DEFAULT_RPC_URL,
  robinhoodChain,
  STATE_VIEW_ADDRESS,
} from "@/lib/chain";
import {
  LP_AGGREGATE_STATE_DISPLAY,
  POSITION_MANAGER_ADDRESS,
  stateViewAbi,
} from "@/lib/hansome-score/constants";
import { RH_QUOTE_TOKENS } from "@/lib/hansome-score/lp/deployments";
import { retainHookNativeLockDistribution } from "@/lib/hansome-score/lp/hook-native-lock-dist";
import type {
  LpAggregateState,
  LpLockState,
  V4OwnershipClass,
  V4OwnershipEvidence,
  V4OwnershipEvidenceSource,
  V4PositionInfo,
} from "@/lib/hansome-score/types";

/** Uniswap v4 dynamic fee flag (fee = 0x800000). */
export const V4_DYNAMIC_FEE_FLAG = 8_388_608;

export const AIRLOCK_ADDRESS = getAddress(
  "0xeb7C034704eF8Dcd2D32324c1545f62fB4aD0862",
) as Address;

/** Known Doppler / Rehype Doppler hook initializers on Robinhood Chain. */
export const DOPPLER_HOOK_REGISTRY: ReadonlySet<string> = new Set(
  [
    "0x4e3468951D49f2EEa976eD0D6e75fFCb44a9a544", // DopplerHookInitializer
    "0x6f02324d20CC679d0E585290CAa6b16baCbC0F77", // RehypeDopplerHookInitializer
  ].map((a) => a.toLowerCase()),
);

export const V4_OWNERSHIP_CLASS_DISPLAY: Record<V4OwnershipClass, string> = {
  posm_nft: "Position NFT",
  hook_native: "Hook Native",
  unknown: "Unknown",
};

/** Research-proven Class B pool keys (OKC / GME primary Doppler books). */
export const KNOWN_HOOK_NATIVE_POOLS: ReadonlyArray<{
  token: Address;
  poolId: `0x${string}`;
  poolKey: {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
  };
}> = [
  {
    token: getAddress("0xddEB6C5415c3CCB66295b610a06e8E30155f2bA3") as Address,
    poolId:
      "0xd3073ec423c33dd50ccfdf04687d58cd9043210bcef7aca31f3c48331d8635cf",
    poolKey: {
      currency0: RH_QUOTE_TOKENS.WETH,
      currency1: getAddress(
        "0xddEB6C5415c3CCB66295b610a06e8E30155f2bA3",
      ) as Address,
      fee: V4_DYNAMIC_FEE_FLAG,
      tickSpacing: 200,
      hooks: getAddress(
        "0x4e3468951D49f2EEa976eD0D6e75fFCb44a9a544",
      ) as Address,
    },
  },
  {
    token: getAddress("0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3") as Address,
    poolId:
      "0x3623694d2613d7a543903b93226ed020d2fddbe00ed93ebd21aec098b10211c2",
    poolKey: {
      currency0: getAddress(
        "0x1b0E319c6A659F002271B69dB8A7df2F911c153E",
      ) as Address,
      currency1: getAddress(
        "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3",
      ) as Address,
      fee: V4_DYNAMIC_FEE_FLAG,
      tickSpacing: 200,
      hooks: getAddress(
        "0x4e3468951D49f2EEa976eD0D6e75fFCb44a9a544",
      ) as Address,
    },
  },
];

const erc721BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const ownableAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

const stateViewLiquidityAbi = [
  ...stateViewAbi,
  {
    type: "function",
    name: "getLiquidity",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ type: "uint128" }],
  },
] as const;

export type V4PoolKey = {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
};

export type V4OwnershipClassResult = {
  ownershipClass: V4OwnershipClass;
  poolId: string | null;
  poolKey: V4PoolKey | null;
  evidence: string[];
  /** Always false for hook_native — Doppler lock adapter not implemented. */
  lockAnalysisComplete: boolean;
  tokenOwnerIsAirlock: boolean;
  hookPosmNftBalance: string | null;
  activeLiquidity: string | null;
  /** Structured UI evidence (Phase 11A.1) — populated by buildV4OwnershipEvidence. */
  v4OwnershipEvidence?: V4OwnershipEvidence | null;
};

/** Note keys consumed by Scan i18n — never lock claims. */
export const V4_OWNERSHIP_NOTE = {
  POSITION_NFT_DETECTED: "position_nft_detected",
  POSITION_NFT_IDS: "position_nft_ids",
  POOL_MATCHED_ONCHAIN: "pool_matched_onchain",
  OWNER_OF_VERIFIED: "owner_of_verified",
  MATERIAL_LIQUIDITY: "material_liquidity",
  DISCOVERY_INCOMPLETE: "discovery_incomplete",
  TITAN_OWNERSHIP: "titan_ownership",
  AIRLOCK_DOPPLER_POOL: "airlock_doppler_pool",
  DYNAMIC_FEE_HOOK_POOL: "dynamic_fee_hook_pool",
  HOOK_NO_POSM_NFT: "hook_no_posm_nft",
  ACTIVE_HOOK_LIQUIDITY: "active_hook_liquidity",
  OWNERSHIP_UNPROVEN: "ownership_unproven",
  LOCK_UNSUPPORTED: "lock_verification_unsupported",
} as const;

function isPosmNftId(id: string): boolean {
  if (!id) return false;
  if (id.startsWith("v2-") || id.startsWith("v3-") || id.startsWith("v4-hook:")) {
    return false;
  }
  return true;
}

function extractPosmNftIds(positions: V4PositionInfo[]): string[] {
  const ids: string[] = [];
  for (const p of positions) {
    const id = p.positionNftId ?? "";
    if (!isPosmNftId(id)) continue;
    if (p.liquidity != null) {
      try {
        if (BigInt(p.liquidity) <= 0n) continue;
      } catch {
        /* keep if unparseable */
      }
    }
    ids.push(id);
  }
  return [...new Set(ids)];
}

function hasTitanEvidence(positions: V4PositionInfo[]): boolean {
  return positions.some((p) => {
    if (!isPosmNftId(p.positionNftId ?? "")) return false;
    const name = (p.lockerName ?? "").toLowerCase();
    const label = (p.ownerLabel ?? "").toLowerCase();
    return (
      name.includes("titan") ||
      label.includes("titan") ||
      p.lockState === "LOCKED_VERIFIED_ONCHAIN"
    );
  });
}

/**
 * Build structured UI evidence from proven Class A/B observations only.
 * Does not invent evidence; does not claim locks or exhaustive discovery.
 */
export function buildV4OwnershipEvidence(params: {
  classResult: V4OwnershipClassResult;
  positions: V4PositionInfo[];
  /** When false, Class A notes include discovery-incomplete caution. */
  discoveryComplete?: boolean;
}): V4OwnershipEvidence | null {
  const { classResult, positions } = params;
  const tags = new Set(classResult.evidence);
  const notes: string[] = [];
  const positionIds = extractPosmNftIds(positions);
  const poolIds: string[] = [];
  if (classResult.poolId) poolIds.push(classResult.poolId);
  for (const p of positions) {
    if (p.poolId && isPosmNftId(p.positionNftId ?? "")) {
      if (!poolIds.some((x) => x.toLowerCase() === p.poolId!.toLowerCase())) {
        poolIds.push(p.poolId);
      }
    }
  }

  if (tags.has("no_pool_manager_inventory")) {
    return null;
  }

  if (classResult.ownershipClass === "posm_nft") {
    const titan = hasTitanEvidence(positions);
    const source: V4OwnershipEvidenceSource = titan
      ? "titan_lock"
      : "position_nft";
    if (positionIds.length > 0) {
      notes.push(V4_OWNERSHIP_NOTE.POSITION_NFT_DETECTED);
      notes.push(V4_OWNERSHIP_NOTE.POSITION_NFT_IDS);
    }
    if (poolIds.length > 0) notes.push(V4_OWNERSHIP_NOTE.POOL_MATCHED_ONCHAIN);
    if (positionIds.length > 0) notes.push(V4_OWNERSHIP_NOTE.OWNER_OF_VERIFIED);
    if (hasMaterialPosmPositions(positions)) {
      notes.push(V4_OWNERSHIP_NOTE.MATERIAL_LIQUIDITY);
    }
    if (titan) notes.push(V4_OWNERSHIP_NOTE.TITAN_OWNERSHIP);
    if (params.discoveryComplete !== true) {
      notes.push(V4_OWNERSHIP_NOTE.DISCOVERY_INCOMPLETE);
    }
    return {
      source,
      positionIds: positionIds.length > 0 ? positionIds : undefined,
      poolIds: poolIds.length > 0 ? poolIds : undefined,
      notes,
    };
  }

  if (classResult.ownershipClass === "hook_native") {
    let source: V4OwnershipEvidenceSource = "doppler_hook";
    if (tags.has("hooks_doppler_registry") || classResult.poolKey) {
      source = "doppler_hook";
    } else if (classResult.tokenOwnerIsAirlock) {
      source = "airlock_owner";
    } else if (tags.has("dynamic_fee_flag")) {
      source = "dynamic_fee_pool";
    } else if (classResult.hookPosmNftBalance === "0") {
      source = "hook_posm_zero_balance";
    } else if (
      classResult.activeLiquidity != null &&
      classResult.activeLiquidity !== "0"
    ) {
      source = "active_hook_liquidity";
    }

    if (
      classResult.tokenOwnerIsAirlock ||
      tags.has("token_owner_airlock") ||
      tags.has("hooks_doppler_registry")
    ) {
      notes.push(V4_OWNERSHIP_NOTE.AIRLOCK_DOPPLER_POOL);
    }
    if (
      tags.has("dynamic_fee_flag") ||
      (classResult.poolKey != null && isDynamicFee(classResult.poolKey.fee))
    ) {
      notes.push(V4_OWNERSHIP_NOTE.DYNAMIC_FEE_HOOK_POOL);
    }
    if (
      classResult.hookPosmNftBalance === "0" ||
      tags.has("hook_posm_nft_balance=0")
    ) {
      notes.push(V4_OWNERSHIP_NOTE.HOOK_NO_POSM_NFT);
    }
    if (
      classResult.activeLiquidity != null &&
      classResult.activeLiquidity !== "0"
    ) {
      notes.push(V4_OWNERSHIP_NOTE.ACTIVE_HOOK_LIQUIDITY);
    }
    notes.push(V4_OWNERSHIP_NOTE.LOCK_UNSUPPORTED);

    return {
      source,
      poolIds: poolIds.length > 0 ? poolIds : undefined,
      hookAddress: classResult.poolKey?.hooks ?? undefined,
      airlockAddress: classResult.tokenOwnerIsAirlock
        ? AIRLOCK_ADDRESS
        : undefined,
      notes,
    };
  }

  // unknown — inventory without proven Class A/B path
  return {
    source: "unknown",
    poolIds: poolIds.length > 0 ? poolIds : undefined,
    hookAddress: classResult.poolKey?.hooks ?? undefined,
    airlockAddress: classResult.tokenOwnerIsAirlock
      ? AIRLOCK_ADDRESS
      : undefined,
    notes: [V4_OWNERSHIP_NOTE.OWNERSHIP_UNPROVEN],
  };
}

function defaultClient(): PublicClient {
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL?.trim() || DEFAULT_RPC_URL, {
      timeout: 12_000,
    }),
  });
}

export function poolIdFromKey(key: V4PoolKey): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters("address, address, uint24, int24, address"),
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
    ),
  );
}

export function isDopplerHook(hooks: string | null | undefined): boolean {
  if (!hooks) return false;
  try {
    return DOPPLER_HOOK_REGISTRY.has(getAddress(hooks).toLowerCase());
  } catch {
    return false;
  }
}

export function isDynamicFee(fee: number | null | undefined): boolean {
  return fee === V4_DYNAMIC_FEE_FLAG;
}

export function hasMaterialPosmPositions(positions: V4PositionInfo[]): boolean {
  return positions.some((p) => {
    const id = p.positionNftId ?? "";
    if (id.startsWith("v2-") || id.startsWith("v3-")) return false;
    if (id.startsWith("v4-hook:")) return false;
    if (p.liquidity == null) return true;
    try {
      return BigInt(p.liquidity) > 0n;
    } catch {
      return true;
    }
  });
}

/**
 * Pure classifier — used by unit tests and the RPC detector.
 * Does not invent Locked; Class B always incomplete for lock analysis.
 *
 * Class B requires a resolved Doppler/dynamic-fee pool — never PoolManager
 * balance alone. Prefer Class B when Airlock/Doppler book is proven even if
 * stray PosM dust exists (OKC/GME).
 */
export function classifyV4OwnershipClass(input: {
  poolManagerBalance: bigint;
  hasMaterialPosmPositions: boolean;
  tokenOwnerIsAirlock: boolean;
  resolvedHookNativePool: boolean;
  hooks: string | null;
  fee: number | null;
  hookPosmNftBalance: bigint | null;
  activeLiquidity: bigint | null;
}): V4OwnershipClass {
  const {
    poolManagerBalance,
    hasMaterialPosmPositions: hasPosm,
    tokenOwnerIsAirlock,
    resolvedHookNativePool,
    hooks,
    fee,
    hookPosmNftBalance,
    activeLiquidity,
  } = input;

  if (poolManagerBalance <= 0n) return "unknown";

  const doppler = isDopplerHook(hooks);
  const dynamic = isDynamicFee(fee);
  const hookNftZero = hookPosmNftBalance === 0n;
  const poolAlive =
    activeLiquidity == null || activeLiquidity > 0n;

  // Class B: resolved Doppler/dynamic-fee pool + hook holds no PosM NFT.
  // Airlock owner strengthens the signal but is not sufficient alone.
  if (
    resolvedHookNativePool &&
    doppler &&
    dynamic &&
    hookNftZero &&
    poolAlive &&
    (tokenOwnerIsAirlock || doppler)
  ) {
    return "hook_native";
  }

  if (hasPosm) return "posm_nft";
  return "unknown";
}

async function readTokenOwner(
  c: PublicClient,
  token: Address,
): Promise<Address | null> {
  try {
    const owner = await c.readContract({
      address: token,
      abi: ownableAbi,
      functionName: "owner",
    });
    return getAddress(owner) as Address;
  } catch {
    return null;
  }
}

async function readHookPosmBalance(
  c: PublicClient,
  hooks: Address,
): Promise<bigint | null> {
  if (hooks === zeroAddress) return null;
  try {
    return await c.readContract({
      address: POSITION_MANAGER_ADDRESS,
      abi: erc721BalanceAbi,
      functionName: "balanceOf",
      args: [hooks],
    });
  } catch {
    return null;
  }
}

async function readPoolActiveLiquidity(
  c: PublicClient,
  poolId: `0x${string}`,
): Promise<{ active: bigint | null; initialized: boolean }> {
  try {
    const [slot0, liq] = await Promise.all([
      c
        .readContract({
          address: STATE_VIEW_ADDRESS as Address,
          abi: stateViewLiquidityAbi,
          functionName: "getSlot0",
          args: [poolId],
        })
        .then((s) => ({ ok: true as const, s }))
        .catch(() => ({ ok: false as const, s: null })),
      c
        .readContract({
          address: STATE_VIEW_ADDRESS as Address,
          abi: stateViewLiquidityAbi,
          functionName: "getLiquidity",
          args: [poolId],
        })
        .then((l) => ({ ok: true as const, l }))
        .catch(() => ({ ok: false as const, l: null })),
    ]);
    if (!slot0.ok) return { active: null, initialized: false };
    const sqrt = slot0.s[0] as bigint;
    if (sqrt === 0n) return { active: null, initialized: false };
    return {
      active: liq.ok && typeof liq.l === "bigint" ? liq.l : null,
      initialized: true,
    };
  } catch {
    return { active: null, initialized: false };
  }
}

function knownPoolForToken(token: Address): (typeof KNOWN_HOOK_NATIVE_POOLS)[number] | null {
  const lc = token.toLowerCase();
  return KNOWN_HOOK_NATIVE_POOLS.find((p) => p.token.toLowerCase() === lc) ?? null;
}

/** Brute common Doppler launch templates when not in the known seed table. */
function candidateDopplerKeys(token: Address): V4PoolKey[] {
  const tokenAddr = getAddress(token) as Address;
  const quotes: Address[] = [
    RH_QUOTE_TOKENS.WETH,
    zeroAddress as Address,
    RH_QUOTE_TOKENS.USDG,
  ];
  const hooksList = [...DOPPLER_HOOK_REGISTRY].map(
    (h) => getAddress(h) as Address,
  );
  const keys: V4PoolKey[] = [];
  for (const quote of quotes) {
    if (quote.toLowerCase() === tokenAddr.toLowerCase()) continue;
    const [c0, c1] =
      quote.toLowerCase() < tokenAddr.toLowerCase()
        ? [quote, tokenAddr]
        : [tokenAddr, quote];
    for (const hooks of hooksList) {
      keys.push({
        currency0: c0,
        currency1: c1,
        fee: V4_DYNAMIC_FEE_FLAG,
        tickSpacing: 200,
        hooks,
      });
    }
  }
  return keys;
}

/**
 * Detect V4 ownership class for a token with PoolManager inventory.
 * Class B never claims Locked and never computes lock%.
 */
export async function detectV4OwnershipClass(params: {
  tokenAddress: string;
  poolManagerBalance: bigint;
  positions: V4PositionInfo[];
  client?: PublicClient;
}): Promise<V4OwnershipClassResult> {
  const evidence: string[] = [];
  const token = getAddress(params.tokenAddress) as Address;
  const poolBal = params.poolManagerBalance;
  const hasPosm = hasMaterialPosmPositions(params.positions);

  if (poolBal <= 0n) {
    return {
      ownershipClass: "unknown",
      poolId: null,
      poolKey: null,
      evidence: ["no_pool_manager_inventory"],
      lockAnalysisComplete: true,
      tokenOwnerIsAirlock: false,
      hookPosmNftBalance: null,
      activeLiquidity: null,
    };
  }

  const c = params.client ?? defaultClient();
  const owner = await readTokenOwner(c, token);
  const tokenOwnerIsAirlock =
    owner != null && owner.toLowerCase() === AIRLOCK_ADDRESS.toLowerCase();
  if (tokenOwnerIsAirlock) evidence.push("token_owner_airlock");
  if (owner) evidence.push(`token_owner=${owner}`);

  let resolvedKey: V4PoolKey | null = null;
  let resolvedPoolId: `0x${string}` | null = null;
  let hookNftBal: bigint | null = null;
  let activeLiq: bigint | null = null;

  const known = knownPoolForToken(token);
  const tryKeys: V4PoolKey[] = [];
  if (known) tryKeys.push(known.poolKey);
  // Always attempt Doppler templates when Airlock or no PosM — cheap slot0 checks.
  if (tokenOwnerIsAirlock || !hasPosm) {
    for (const k of candidateDopplerKeys(token)) {
      if (
        !tryKeys.some(
          (x) =>
            x.hooks.toLowerCase() === k.hooks.toLowerCase() &&
            x.currency0.toLowerCase() === k.currency0.toLowerCase() &&
            x.currency1.toLowerCase() === k.currency1.toLowerCase() &&
            x.fee === k.fee &&
            x.tickSpacing === k.tickSpacing,
        )
      ) {
        tryKeys.push(k);
      }
    }
  }

  for (const key of tryKeys.slice(0, 12)) {
    const poolId = poolIdFromKey(key);
    const { active, initialized } = await readPoolActiveLiquidity(c, poolId);
    if (!initialized) continue;
    resolvedKey = key;
    resolvedPoolId = poolId;
    activeLiq = active;
    evidence.push(`resolved_pool=${poolId}`);
    if (isDopplerHook(key.hooks)) evidence.push("hooks_doppler_registry");
    if (isDynamicFee(key.fee)) evidence.push("dynamic_fee_flag");
    hookNftBal = await readHookPosmBalance(c, key.hooks);
    if (hookNftBal != null) {
      evidence.push(`hook_posm_nft_balance=${hookNftBal.toString()}`);
    }
    if (active != null) evidence.push(`active_liquidity=${active.toString()}`);
    break;
  }

  // Also treat position-derived Doppler hooks (if any PosM somehow references them).
  if (!resolvedKey) {
    for (const p of params.positions) {
      if (p.fee != null && isDynamicFee(p.fee) && p.poolId) {
        // Without hooks field on V4PositionInfo we cannot mark Class B from PosM alone.
        evidence.push("dynamic_fee_position_seen");
      }
    }
  }

  const ownershipClass = classifyV4OwnershipClass({
    poolManagerBalance: poolBal,
    hasMaterialPosmPositions: hasPosm,
    tokenOwnerIsAirlock,
    resolvedHookNativePool: resolvedKey != null && isDopplerHook(resolvedKey.hooks),
    hooks: resolvedKey?.hooks ?? null,
    fee: resolvedKey?.fee ?? null,
    hookPosmNftBalance: hookNftBal,
    activeLiquidity: activeLiq,
  });

  if (ownershipClass === "hook_native") {
    evidence.push("ownership_class=hook_native");
    evidence.push("lock_verification_unsupported");
  } else if (ownershipClass === "posm_nft") {
    evidence.push("ownership_class=posm_nft");
  } else {
    evidence.push("ownership_class=unknown");
  }

  const classResult: V4OwnershipClassResult = {
    ownershipClass,
    poolId: resolvedPoolId,
    poolKey: resolvedKey,
    evidence,
    lockAnalysisComplete: ownershipClass !== "hook_native",
    tokenOwnerIsAirlock,
    hookPosmNftBalance: hookNftBal != null ? hookNftBal.toString() : null,
    activeLiquidity: activeLiq != null ? activeLiq.toString() : null,
  };
  classResult.v4OwnershipEvidence = buildV4OwnershipEvidence({
    classResult,
    positions: params.positions,
  });
  return classResult;
}

/**
 * Apply ownership class onto LpIntelligence without changing Class A lock scores.
 * Class B → UNKNOWN_INCOMPLETE + lockAnalysisComplete false; never Locked.
 */
export function applyV4OwnershipClassToIntelligence<
  T extends {
    poolDetected: boolean;
    poolId: string | null;
    aggregateState: string;
    aggregateStateDisplay: string;
    aggregateLockState: string;
    aggregateLockStateDisplay: string;
    discoveryComplete: boolean;
    ownershipRiskNote: string;
    detail: string;
    ownershipClass?: V4OwnershipClass | null;
    ownershipClassEvidence?: string[] | null;
    v4OwnershipEvidence?: V4OwnershipEvidence | null;
    lockDistribution: { available: boolean; reason: string | null };
    uniswapVersions: {
      byVersion: {
        v4: { lockAnalysisComplete: boolean; detail: string; poolsFound: number };
      };
    };
    positions: V4PositionInfo[];
  },
>(
  intelligence: T,
  classResult: V4OwnershipClassResult,
): T {
  intelligence.ownershipClass = classResult.ownershipClass;
  intelligence.ownershipClassEvidence = classResult.evidence;

  if (classResult.ownershipClass === "hook_native") {
    // Never claim Locked / lock% for Class B.
    const incomplete: LpAggregateState = "UNKNOWN_INCOMPLETE";
    const unable: LpLockState = "UNABLE_TO_DETERMINE";
    intelligence.aggregateState = incomplete as T["aggregateState"];
    intelligence.aggregateStateDisplay = LP_AGGREGATE_STATE_DISPLAY[
      incomplete
    ] as T["aggregateStateDisplay"];
    intelligence.aggregateLockState = unable as T["aggregateLockState"];
    intelligence.aggregateLockStateDisplay = LP_AGGREGATE_STATE_DISPLAY[
      incomplete
    ] as T["aggregateLockStateDisplay"];
    intelligence.discoveryComplete = false;
    intelligence.uniswapVersions.byVersion.v4.lockAnalysisComplete = false;
    if (classResult.poolId && !intelligence.poolId) {
      intelligence.poolId = classResult.poolId;
    }
    if (
      classResult.poolId &&
      intelligence.uniswapVersions.byVersion.v4.poolsFound === 0
    ) {
      intelligence.uniswapVersions.byVersion.v4.poolsFound = 1;
    }
    intelligence.ownershipRiskNote =
      "V4 ownership class: Hook Native (Airlock/Doppler). Lock verification unsupported — not assumed locked. PoolManager inventory alone is not ownership proof.";
    intelligence.detail = [
      intelligence.detail,
      `V4 ownershipClass=hook_native; evidence=${classResult.evidence.join(",")}.`,
      "Class B: no lock verification, no lock%.",
    ].join(" ");
    intelligence.lockDistribution = retainHookNativeLockDistribution(
      intelligence.lockDistribution,
    ) as T["lockDistribution"];
  } else if (classResult.ownershipClass === "posm_nft") {
    intelligence.detail = [
      intelligence.detail,
      "V4 ownershipClass=posm_nft (PositionManager NFT path).",
    ].join(" ");
  }

  // Rebuild structured evidence after Class B may flip discoveryComplete.
  intelligence.v4OwnershipEvidence = buildV4OwnershipEvidence({
    classResult,
    positions: intelligence.positions,
    discoveryComplete: intelligence.discoveryComplete,
  });

  return intelligence;
}
