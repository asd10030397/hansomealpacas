import {
  createPublicClient,
  encodeAbiParameters,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseAbiParameters,
  type Address,
  type PublicClient,
} from "viem";
import {
  DEFAULT_RPC_URL,
  POOL_ID as HANSOME_POOL_ID,
  robinhoodChain,
  STATE_VIEW_ADDRESS,
  TOKEN_ADDRESS,
} from "@/lib/chain";
import {
  LP_AGGREGATE_STATE_DISPLAY,
  LP_LOCK_STATE_DISPLAY,
  POSITION_MANAGER_ADDRESS,
  positionManagerAbi,
  POOL_MANAGER_ADDRESS,
  stateViewAbi,
} from "@/lib/hansome-score/constants";
import {
  fetchAddressPositionNftIds,
  fetchRecentPositionManagerTokenIds,
} from "@/lib/hansome-score/blockscout";
import {
  computeLockDistribution,
  computeTokenAggregate,
  countPositionLocks,
  materialPositions,
} from "@/lib/hansome-score/lp/aggregate";
import {
  loadLpDiscoveryCheckpoint,
  persistLpDiscoveryCheckpoint,
} from "@/lib/hansome-score/lp/discovery-checkpoint";
import { fillPositionTokenAmounts } from "@/lib/hansome-score/lp/position-value";
import { emptyUniswapVersionCoverage } from "@/lib/hansome-score/lp/coverage";
import {
  classifyOwnerLockState,
  findLockerByAddress,
  isKnownLockerAddress,
} from "@/lib/hansome-score/lp/registry";
import {
  loadLpDiscoveryCache,
  persistLpDiscoveryCache,
  type LpDiscoveryCache,
} from "@/lib/hansome-score/lp/position-cache";
import {
  boundQuickLpCandidates,
  classifyLpHonestyReason,
  EXHAUSTIVE_LP_MAX_HINT_OWNERS,
  EXHAUSTIVE_LP_PM_MAX_PAGES,
  honestyReasonDetail,
  QUICK_LP_MAX_CANDIDATES,
  QUICK_LP_MAX_HINT_OWNERS,
  QUICK_LP_MAX_WALL_MS,
  QUICK_LP_PM_MAX_PAGES,
  quickLpEvidenceSufficient,
  type QuickLpProgressEvent,
} from "@/lib/hansome-score/lp/quick-discovery";
import {
  discoverTitanLocksForToken,
  lookupTitanLocksByPositionIds,
  type TitanLockMatch,
} from "@/lib/hansome-score/lp/titan";
import { formatTokenAmount } from "@/lib/hansome-score/rpc";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chain";
import type {
  EvidenceLevel,
  LpIntelligence,
  V4PositionInfo,
} from "@/lib/hansome-score/types";

const POSITION_EVAL_BATCH = 8;

function client(): PublicClient {
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL?.trim() || DEFAULT_RPC_URL, {
      timeout: 20_000,
    }),
  });
}

function poolIdFromKey(key: {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters("address, address, uint24, int24, address"),
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
    ),
  );
}

function ticksFromPositionInfo(info: bigint): { tickLower: number; tickUpper: number } {
  const tickLower = Number(BigInt.asIntN(24, (info >> 8n) & 0xffffffn));
  const tickUpper = Number(BigInt.asIntN(24, (info >> 32n) & 0xffffffn));
  return { tickLower, tickUpper };
}

async function isContractAddress(c: PublicClient, address: string): Promise<boolean | null> {
  try {
    const code = await c.getBytecode({ address: getAddress(address) as Address });
    if (code == null) return null;
    return code !== "0x" && code.length > 2;
  } catch {
    return null;
  }
}

type ReadPositionResult =
  | {
      status: "ok";
      owner: Address;
      liquidity: bigint | null;
      poolKey: {
        currency0: Address;
        currency1: Address;
        fee: number;
        tickSpacing: number;
        hooks: Address;
      } | null;
      tickLower: number | null;
      tickUpper: number | null;
      poolId: `0x${string}` | null;
      involvesToken: boolean;
    }
  | { status: "stale" }
  | { status: "error" };

async function readPosition(
  c: PublicClient,
  tokenId: bigint,
  tokenAddress: string,
): Promise<ReadPositionResult> {
  const tokenLc = getAddress(tokenAddress).toLowerCase();
  try {
    const [ownerResult, liquidityResult, poolAndPosResult] = await Promise.all([
      c
        .readContract({
          address: POSITION_MANAGER_ADDRESS,
          abi: positionManagerAbi,
          functionName: "ownerOf",
          args: [tokenId],
        })
        .then((owner) => ({ ok: true as const, owner }))
        .catch((err: unknown) => ({ ok: false as const, err })),
      c
        .readContract({
          address: POSITION_MANAGER_ADDRESS,
          abi: positionManagerAbi,
          functionName: "getPositionLiquidity",
          args: [tokenId],
        })
        .then((liquidity) => ({ ok: true as const, liquidity }))
        .catch(() => ({ ok: false as const, liquidity: null })),
      c
        .readContract({
          address: POSITION_MANAGER_ADDRESS,
          abi: positionManagerAbi,
          functionName: "getPoolAndPositionInfo",
          args: [tokenId],
        })
        .then((poolAndPos) => ({ ok: true as const, poolAndPos }))
        .catch(() => ({ ok: false as const, poolAndPos: null })),
    ]);

    if (!ownerResult.ok) {
      const msg = String(
        (ownerResult.err as { shortMessage?: string; message?: string })
          ?.shortMessage ||
          (ownerResult.err as { message?: string })?.message ||
          ownerResult.err ||
          "",
      ).toLowerCase();
      // Transport / rate-limit → uncertain (keep prior cache). Contract revert
      // (including nonexistent ERC-721) → definitive stale.
      if (
        msg.includes("timeout") ||
        msg.includes("timed out") ||
        msg.includes("rate limit") ||
        msg.includes("429") ||
        msg.includes("econn") ||
        msg.includes("fetch failed") ||
        msg.includes("network") ||
        msg.includes("503") ||
        msg.includes("502")
      ) {
        return { status: "error" };
      }
      return { status: "stale" };
    }

    const owner = ownerResult.owner;
    const liquidity = liquidityResult.ok ? liquidityResult.liquidity : null;
    const poolAndPos = poolAndPosResult.ok ? poolAndPosResult.poolAndPos : null;

    let poolKey = null as null | {
      currency0: Address;
      currency1: Address;
      fee: number;
      tickSpacing: number;
      hooks: Address;
    };
    let tickLower: number | null = null;
    let tickUpper: number | null = null;
    let poolId: `0x${string}` | null = null;

    if (poolAndPos) {
      const key = poolAndPos[0];
      poolKey = {
        currency0: getAddress(key.currency0) as Address,
        currency1: getAddress(key.currency1) as Address,
        fee: Number(key.fee),
        tickSpacing: Number(key.tickSpacing),
        hooks: getAddress(key.hooks) as Address,
      };
      const ticks = ticksFromPositionInfo(poolAndPos[1] as bigint);
      tickLower = ticks.tickLower;
      tickUpper = ticks.tickUpper;
      poolId = poolIdFromKey(poolKey);
    }

    const involvesToken = poolKey
      ? poolKey.currency0.toLowerCase() === tokenLc ||
        poolKey.currency1.toLowerCase() === tokenLc
      : false;

    return {
      status: "ok",
      owner: getAddress(owner) as Address,
      liquidity: typeof liquidity === "bigint" ? liquidity : null,
      poolKey,
      tickLower,
      tickUpper,
      poolId,
      involvesToken,
    };
  } catch {
    return { status: "error" };
  }
}

async function readSlot0(
  c: PublicClient,
  poolId: `0x${string}` | null,
): Promise<{ tick: number; sqrtPriceX96: bigint } | null> {
  if (!poolId) return null;
  try {
    const slot0 = await c.readContract({
      address: STATE_VIEW_ADDRESS as Address,
      abi: stateViewAbi,
      functionName: "getSlot0",
      args: [poolId],
    });
    const sqrtPriceX96 = slot0[0] as bigint;
    const tick = Number(slot0[1]);
    if (!Number.isFinite(tick)) return null;
    return { tick, sqrtPriceX96 };
  } catch {
    return null;
  }
}

/** @deprecated use computeTokenAggregate — kept for unit tests of MIXED pairing */
export function aggregateLockStates(positions: V4PositionInfo[]) {
  const { scoreLockState } = computeTokenAggregate({
    positions,
    poolDetected: true,
    // Tests that pass both locked+unlocked expect MIXED regardless of completeness
    discoveryComplete: true,
  });
  return scoreLockState;
}

function legacyStatus(
  aggregate: ReturnType<typeof computeTokenAggregate>["aggregate"],
): "locked" | "unlocked" | "unknown" | "none" | "mixed" {
  switch (aggregate) {
    case "ALL_LOCKED":
      return "locked";
    case "ALL_UNLOCKED":
      return "unlocked";
    case "NONE":
      return "none";
    case "MIXED":
      return "mixed";
    default:
      return "unknown";
  }
}

export type DetectLpInput = {
  tokenAddress: string;
  poolManagerBalance: bigint | null;
  decimals: number | null;
  hintAddresses?: string[];
  candidatePositionIds?: bigint[];
  knownPoolId?: string | null;
  /**
   * When true, ALL_LOCKED is allowed if every material position is verified locked.
   * Default false — PositionManager has no full enumeration; prefer UNKNOWN over false certainty.
   * Set true only when required known seeds + hint inventory are satisfied.
   */
  discoveryComplete?: boolean;
  /**
   * When true, always run hint inventory + PositionManager transfer pagination.
   * Default false: after known/cached seeds revalidate with usable lock evidence,
   * skip historical PM rediscovery (dominant ~190s cold cost).
   */
  exhaustiveDiscovery?: boolean;
  /**
   * When true (default), run bounded Quick LP (hints + PM ≤3 pages) if known-first
   * is insufficient. Never marks discoveryComplete. Exhaustive stays separate.
   */
  quickDiscovery?: boolean;
  /** Soft wall for Quick LP expansion (ms). Default QUICK_LP_MAX_WALL_MS. */
  quickDiscoveryMaxWallMs?: number;
  /** Fired after known/cached positions are revalidated (before optional exhaustive). */
  onKnownPositions?: (partial: DetectLpResult) => void | Promise<void>;
  /** Progress-only Quick LP phases (orchestration; no semantic change). */
  onQuickDiscoveryProgress?: (
    event: QuickLpProgressEvent,
  ) => void | Promise<void>;
  /**
   * Progress-only: fired when a Uniswap version probe finishes (v2/v3/v4).
   * Does not alter discovery merge or lock semantics.
   */
  onVersionProbeProgress?: (event: {
    version: "v2" | "v3" | "v4";
    completedProbes: number;
    totalProbes: number;
    poolsFound: number;
    positionsFound: number;
  }) => void | Promise<void>;
  /**
   * Phase 7.1 Smart LP: when set, only these Position NFT IDs are revalidated
   * (ownerOf / readPosition / targeted Titan). Empty array = evaluate none.
   * Undefined = existing behavior (all priority / discovery candidates).
   */
  revalidatePositionIds?: bigint[];
  /**
   * Phase 7.1: skip Quick LP PM/hints expansion (selective owner/lock refresh).
   * Does not change classification rules for IDs that are evaluated.
   */
  skipQuickDiscoveryExpansion?: boolean;
  /**
   * Phase 7.1: skip broad Titan token sweep; only targeted lookup by ID.
   */
  skipBroadTitanSweep?: boolean;
};

export type DetectLpResult = {
  intelligence: LpIntelligence;
  legacyStatus: "locked" | "unlocked" | "unknown" | "none" | "mixed";
};

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    out.push(...(await Promise.all(chunk.map(fn))));
  }
  return out;
}

function knownFirstSufficient(params: {
  seeds: bigint[];
  positions: V4PositionInfo[];
}): boolean {
  const { seeds, positions } = params;
  if (positions.length === 0) return false;
  const foundIds = new Set(positions.map((p) => p.positionNftId));
  const seedsSatisfied =
    seeds.length > 0 && seeds.every((id) => foundIds.has(id.toString()));
  const mat = materialPositions(positions);
  const hasLocked = mat.some(
    (p) =>
      p.lockState === "LOCKED_VERIFIED_ONCHAIN" ||
      p.lockState === "LOCK_DETECTED_EXPIRY_UNKNOWN",
  );
  const hasRemovable = mat.some(
    (p) =>
      p.removableByEoa === true || p.lockState === "UNLOCKED_EOA_CONTROLLED",
  );
  // Prefer returning lock distribution when seeds verify, or when MIXED evidence exists.
  return seedsSatisfied || (hasLocked && hasRemovable);
}

function emptyIntelligence(
  poolDetected: boolean,
  poolId: string | null,
  poolBal: bigint,
  formattedBal: string | null,
): LpIntelligence {
  return {
    poolDetected,
    poolsDetectedCount: 0,
    poolId,
    poolManagerBalanceRaw: poolBal.toString(),
    poolManagerBalanceFormatted: formattedBal,
    aggregateLockState: poolDetected ? "UNABLE_TO_DETERMINE" : "NONE",
    aggregateLockStateDisplay: poolDetected
      ? LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE
      : LP_AGGREGATE_STATE_DISPLAY.NONE,
    aggregateState: poolDetected ? "UNKNOWN_INCOMPLETE" : "NONE",
    aggregateStateDisplay: poolDetected
      ? LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE
      : LP_AGGREGATE_STATE_DISPLAY.NONE,
    positionCounts: { detected: 0, material: 0, locked: 0, unlocked: 0, unknown: 0 },
    lockDistribution: {
      available: false,
      lockedPct: null,
      unlockedPct: null,
      unknownPct: null,
      lockedUsd: null,
      unlockedUsd: null,
      unknownUsd: null,
      totalPositionUsd: null,
      poolLiquidityUsd: null,
      reconciledWithPool: false,
      method: null,
      reason: poolDetected
        ? "No positions evaluated yet."
        : "No pool balance.",
    },
    discoveryComplete: false,
    knownPositionsVerified: false,
    exhaustiveDiscoveryComplete: false,
    completenessWarning: poolDetected
      ? "Liquidity position discovery may be incomplete."
      : null,
    ownershipRiskNote: poolDetected
      ? "LP lock ownership could not be determined — not assumed safe or unlocked."
      : "No detectable PoolManager token balance.",
    sizeWarning: !poolDetected,
    positions: [],
    evidenceLevel: poolDetected ? "unavailable" : "on_chain_verified",
    detail: poolDetected
      ? "PoolManager holds tokens but no Position NFTs evaluated."
      : "PoolManager balance is zero — no LP ownership path to evaluate.",
    discoverySources: [],
    uniswapVersions: emptyUniswapVersionCoverage({
      v4Searched: true,
      v4Pools: poolDetected ? 1 : 0,
      v4Detail: poolDetected
        ? "v4 PoolManager inventory detected; positions not evaluated."
        : "v4: no PoolManager balance.",
    }),
  };
}

/**
 * Generic Uniswap v4 LP ownership / lock detection.
 * Principle: one locked position does not mean locked liquidity.
 */
export async function detectV4LpIntelligence(
  input: DetectLpInput,
): Promise<DetectLpResult> {
  const poolBal = input.poolManagerBalance ?? 0n;
  const poolDetected = poolBal > 0n;
  const formattedBal = formatTokenAmount(poolBal, input.decimals);

  if (!poolDetected) {
    return {
      intelligence: emptyIntelligence(false, input.knownPoolId ?? null, poolBal, formattedBal),
      legacyStatus: "none",
    };
  }

  const c = client();
  const tokenAddress = getAddress(input.tokenAddress);
  const discoverySources: string[] = [];
  const seeds = input.candidatePositionIds ?? [];

  // Persistent discovery cache (KV + memory). Seeds remain bootstrap only.
  const cached: LpDiscoveryCache | null = await loadLpDiscoveryCache(
    ROBINHOOD_CHAIN_ID,
    tokenAddress,
  );
  const hintAddresses = [
    ...(input.hintAddresses ?? []),
    POOL_MANAGER_ADDRESS,
    ...(cached?.lockerCandidates ?? []),
  ];

  const priorityIds = new Set<bigint>();
  for (const id of seeds) priorityIds.add(id);
  if (seeds.length > 0) discoverySources.push("seeded_candidates");
  if (cached?.positionIds.length) {
    for (const id of cached.positionIds) {
      try {
        priorityIds.add(BigInt(id));
      } catch {
        /* skip */
      }
    }
    discoverySources.push("cached_position_ids");
  }
  if (cached?.poolIds.length && !input.knownPoolId) {
    discoverySources.push("cached_pool_ids");
  }

  // Phase 7.1: optional selective ID set (undefined = all priority candidates).
  if (input.revalidatePositionIds !== undefined) {
    priorityIds.clear();
    for (const id of input.revalidatePositionIds) priorityIds.add(id);
    if (!discoverySources.includes("smart_lp_selective_ids")) {
      discoverySources.push("smart_lp_selective_ids");
    }
  }

  // —— Phase 1: revalidate known/cached IDs + Titan lock data (no PM history) ——
  const titanLocks = new Map<string, TitanLockMatch>();
  if (priorityIds.size > 0) {
    // Targeted Titan lookup for known NFTs — avoids a second full locker sweep.
    const byId = await lookupTitanLocksByPositionIds([...priorityIds]);
    for (const [k, m] of byId) titanLocks.set(k, m);
  } else if (input.skipBroadTitanSweep !== true) {
    for (const m of await discoverTitanLocksForToken(tokenAddress, hintAddresses)) {
      titanLocks.set(m.positionNftId.toString(), m);
      priorityIds.add(m.positionNftId);
    }
  }
  if (titanLocks.size > 0) discoverySources.push("titan_locker");

  let matchedPoolId: string | null = input.knownPoolId ?? null;
  const poolIds = new Set<string>();
  if (cached?.poolIds.length) {
    for (const id of cached.poolIds) poolIds.add(id.toLowerCase());
  }
  const lockerCandidates = new Set<string>();
  for (const a of cached?.lockerCandidates ?? []) lockerCandidates.add(a);
  const positionsById = new Map<string, V4PositionInfo>();

  /** IDs proven irrelevant (wrong token / burned) — safe to drop from cache. */
  const stalePositionIds = new Set<string>();
  /** IDs that failed RPC without a definitive stale verdict — keep in cache. */
  const uncertainPositionIds = new Set<string>();

  /** Persist proven discovery inputs only — never lock classification. */
  async function persistProvenDiscovery(opts: {
    positions: V4PositionInfo[];
    exhaustiveComplete: boolean;
    knownVerified: boolean;
  }): Promise<void> {
    const provenIds = opts.positions.map((p) => p.positionNftId);
    for (const p of opts.positions) {
      if (p.poolId) poolIds.add(p.poolId.toLowerCase());
      if (p.lockerAddress) lockerCandidates.add(p.lockerAddress);
      if (p.owner && isKnownLockerAddress(p.owner)) {
        lockerCandidates.add(p.owner);
      }
    }
    for (const m of titanLocks.values()) {
      if (m.childLocker) lockerCandidates.add(m.childLocker);
    }

    // Discovery inputs only: never persist unproven PM-history candidates.
    // - proven: involves this token on-chain
    // - prior cached minus definitive stale (incl. prior IDs that RPC-flaked)
    // - exhaustive: replace with proven only (do not keep unrelated candidates)
    const retained = new Set<string>(provenIds);
    for (const id of cached?.positionIds ?? []) {
      if (stalePositionIds.has(id)) continue;
      retained.add(id);
    }
    const finalIds = opts.exhaustiveComplete
      ? sortRetainIds(provenIds)
      : sortRetainIds(retained);

    await persistLpDiscoveryCache(ROBINHOOD_CHAIN_ID, tokenAddress, {
      positionIds: finalIds,
      poolIds,
      versions: ["v4"],
      lockerCandidates,
      // Only set true after exhaustive; known-first must not clear a prior complete flag.
      ...(opts.exhaustiveComplete ? { exhaustiveComplete: true as const } : {}),
      knownVerifiedAt: opts.knownVerified ? Date.now() : null,
      replacePositionIds: true,
    });
  }

  function sortRetainIds(ids: Iterable<string>): string[] {
    return [...new Set(ids)].filter((id) => /^\d+$/.test(id)).sort((a, b) => {
      try {
        return BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0;
      } catch {
        return a.localeCompare(b);
      }
    });
  }

  async function evaluateOne(tokenId: bigint): Promise<V4PositionInfo | null> {
    const idStr = tokenId.toString();
    const pos = await readPosition(c, tokenId, tokenAddress);
    if (pos.status === "error") {
      // Only retain uncertainty for IDs we already trusted (cache/seeds).
      // Never promote brand-new PM candidates into the persistent cache on RPC flake.
      const wasKnown =
        (cached?.positionIds.includes(idStr) ?? false) ||
        seeds.some((s) => s.toString() === idStr);
      if (wasKnown) uncertainPositionIds.add(idStr);
      return null;
    }
    if (pos.status === "stale") {
      stalePositionIds.add(idStr);
      return null;
    }
    if (!pos.involvesToken) {
      stalePositionIds.add(idStr);
      return null;
    }

    if (pos.poolId) {
      matchedPoolId = pos.poolId;
      poolIds.add(pos.poolId.toLowerCase());
    }

    const titan = titanLocks.get(tokenId.toString()) ?? null;
    const owner = pos.owner;
    const contractFlag = owner ? await isContractAddress(c, owner) : null;
    const unlockTimestamp = titan?.unlockTime ?? null;

    let lockState = classifyOwnerLockState({
      owner,
      unlockTimestamp,
      isContract: contractFlag,
    });

    if (
      titan &&
      owner &&
      (owner.toLowerCase() === titan.childLocker.toLowerCase() ||
        isKnownLockerAddress(owner)) &&
      unlockTimestamp != null &&
      unlockTimestamp > Math.floor(Date.now() / 1000)
    ) {
      lockState = "LOCKED_VERIFIED_ONCHAIN";
    }

    if (contractFlag === true && !isKnownLockerAddress(owner) && !titan) {
      lockState = "UNSUPPORTED_LOCKER";
    }

    const slot0 = await readSlot0(c, pos.poolId);
    const currentTick = slot0?.tick ?? null;
    const inRange =
      currentTick != null && pos.tickLower != null && pos.tickUpper != null
        ? currentTick >= pos.tickLower && currentTick < pos.tickUpper
        : null;

    const locker = owner ? findLockerByAddress(owner) : null;
    const removableByEoa =
      lockState === "UNLOCKED_EOA_CONTROLLED"
        ? true
        : lockState === "LOCKED_VERIFIED_ONCHAIN" ||
            lockState === "LOCK_DETECTED_EXPIRY_UNKNOWN"
          ? false
          : null;

    let evidenceLevel: EvidenceLevel = "unavailable";
    if (
      lockState === "LOCKED_VERIFIED_ONCHAIN" &&
      (unlockTimestamp != null || locker?.expiryPolicy === "permanent_null")
    ) {
      evidenceLevel = "on_chain_verified";
    } else if (owner) {
      evidenceLevel = titan ? "on_chain_partial" : "registry_inferred";
    }

    const basePosition: V4PositionInfo = {
      positionNftId: tokenId.toString(),
      owner,
      ownerLabel: locker?.name ?? (contractFlag ? "contract" : "EOA"),
      lockerName: locker?.name ?? (titan ? "TitanLockerManagerV2" : null),
      lockerAddress: locker?.managerAddress ?? (titan ? titan.childLocker : null),
      lockState,
      lockStateDisplay: LP_LOCK_STATE_DISPLAY[lockState],
      unlockTimestamp,
      unlockDateUtc:
        unlockTimestamp != null
          ? new Date(unlockTimestamp * 1000).toISOString()
          : null,
      lockCreatedAt: titan?.createdAt ?? null,
      lockTxHash: null,
      liquidity: pos.liquidity?.toString() ?? null,
      amount0Raw: null,
      amount1Raw: null,
      valueUsd: null,
      poolId: pos.poolId,
      currency0: pos.poolKey?.currency0 ?? null,
      currency1: pos.poolKey?.currency1 ?? null,
      fee: pos.poolKey?.fee ?? null,
      tickSpacing: pos.poolKey?.tickSpacing ?? null,
      tickLower: pos.tickLower,
      tickUpper: pos.tickUpper,
      currentTick,
      inRange,
      removableByEoa,
      evidenceLevel,
      dataSource: titan
        ? "positionManager.ownerOf + TitanLockerManagerV2.getTokenLockData"
        : "positionManager.ownerOf + known/seed revalidation",
    };
    return fillPositionTokenAmounts(basePosition, slot0?.sqrtPriceX96 ?? null);
  }

  async function evaluateMany(ids: Iterable<bigint>): Promise<void> {
    const list = [...ids].filter((id) => !positionsById.has(id.toString()));
    const rows = await mapInBatches(list, POSITION_EVAL_BATCH, evaluateOne);
    for (const row of rows) {
      if (row) positionsById.set(row.positionNftId, row);
    }
  }

  await evaluateMany(priorityIds);

  if (
    getAddress(tokenAddress).toLowerCase() === TOKEN_ADDRESS.toLowerCase() &&
    matchedPoolId &&
    matchedPoolId.toLowerCase() === HANSOME_POOL_ID.toLowerCase()
  ) {
    matchedPoolId = HANSOME_POOL_ID;
  } else if (
    getAddress(tokenAddress).toLowerCase() === TOKEN_ADDRESS.toLowerCase() &&
    !matchedPoolId
  ) {
    matchedPoolId = HANSOME_POOL_ID;
  }

  const buildResult = (opts: {
    exhaustiveComplete: boolean;
    knownVerified: boolean;
  }): DetectLpResult => {
    const positions = [...positionsById.values()];
    // Never claim full discovery completeness unless exhaustive finished
    // (or caller asserts). Known-first MIXED is honest with discoveryComplete=false.
    const discoveryComplete =
      input.discoveryComplete === true ||
      (opts.exhaustiveComplete &&
        positions.length > 0 &&
        (() => {
          const foundIds = new Set(positions.map((p) => p.positionNftId));
          const seedsSatisfied =
            seeds.length === 0 ||
            seeds.every((id) => foundIds.has(id.toString()));
          const hasRemovableFound = materialPositions(positions).some(
            (p) =>
              p.removableByEoa === true ||
              p.lockState === "UNLOCKED_EOA_CONTROLLED",
          );
          const hasLockedFound = materialPositions(positions).some(
            (p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN",
          );
          return (
            seedsSatisfied &&
            (hasLockedFound && hasRemovableFound
              ? true
              : seeds.length > 0 &&
                seedsSatisfied &&
                discoverySources.includes("hint_address_nft_inventory"))
          );
        })());

    const { aggregate, display, scoreLockState } = computeTokenAggregate({
      positions,
      poolDetected: true,
      discoveryComplete,
    });

    const positionCounts = countPositionLocks(positions);
    const lockDistribution = computeLockDistribution(positions);

    const evidenceLevel: EvidenceLevel =
      positions.some((p) => p.evidenceLevel === "on_chain_verified")
        ? "on_chain_verified"
        : positions.length > 0
          ? "on_chain_partial"
          : "unavailable";

    const unsupportedLockerCount = positions.filter(
      (p) => p.lockState === "UNSUPPORTED_LOCKER",
    ).length;
    const honesty = classifyLpHonestyReason({
      poolDetected: true,
      positionsFound: positions.length,
      materialCount: positionCounts.material,
      lockedCount: positionCounts.locked,
      unlockedCount: positionCounts.unlocked,
      unknownCount: positionCounts.unknown,
      unsupportedLockerCount,
      discoveryComplete,
      aggregateState: aggregate,
    });

    const completenessWarning = discoveryComplete
      ? null
      : opts.knownVerified
        ? "Verified known positions shown — full PositionManager history discovery not finished. One locked Position NFT does not mean all liquidity is locked."
        : honesty === "unsupported_locker"
          ? "Unsupported Locker — contract owner is not a recognized locker; lock status not claimed. Discovery may still be incomplete."
          : honesty === "lock_status_unknown"
            ? "Detected—Lock Status Unknown — positions found but lock ownership not fully verified. One locked Position NFT does not mean all liquidity is locked."
            : honesty === "ownership_unresolved"
              ? "Detected—Ownership Unresolved — positions found; Quick/exhaustive discovery still incomplete. One locked Position NFT does not mean all liquidity is locked."
              : "Discovery Incomplete — Liquidity position discovery may be incomplete. One locked Position NFT does not mean all liquidity is locked.";

    const detailParts: string[] = [
      `Pool ≠ position: ${poolIds.size || (matchedPoolId ? 1 : 0)} pool(s), ${positions.length} position NFT(s).`,
      `Discovery: ${discoverySources.join(", ") || "none"}; knownVerified=${opts.knownVerified}; exhaustive=${opts.exhaustiveComplete}; complete=${discoveryComplete}.`,
      `Counts — locked=${positionCounts.locked} unlocked=${positionCounts.unlocked} unknown=${positionCounts.unknown}.`,
      honestyReasonDetail(honesty),
    ];
    if (aggregate === "MIXED") {
      detailParts.push(
        "Aggregate MIXED: verified lock(s) coexist with removable/unlocked position(s) — never reported as fully locked.",
      );
    } else if (aggregate === "UNKNOWN_INCOMPLETE") {
      detailParts.push(
        "Aggregate UNKNOWN/INCOMPLETE — not assuming all liquidity is locked from a single Titan/locker hit.",
      );
    }
    if (!lockDistribution.available && lockDistribution.reason) {
      detailParts.push(lockDistribution.reason);
    }

    const intelligence: LpIntelligence = {
      poolDetected: true,
      poolsDetectedCount: poolIds.size || (matchedPoolId ? 1 : 0),
      poolId: matchedPoolId,
      poolManagerBalanceRaw: poolBal.toString(),
      poolManagerBalanceFormatted: formattedBal,
      aggregateLockState: scoreLockState,
      aggregateLockStateDisplay: display,
      aggregateState: aggregate,
      aggregateStateDisplay: LP_AGGREGATE_STATE_DISPLAY[aggregate],
      positionCounts,
      lockDistribution,
      discoveryComplete,
      knownPositionsVerified: opts.knownVerified,
      exhaustiveDiscoveryComplete: opts.exhaustiveComplete,
      completenessWarning,
      ownershipRiskNote:
        aggregate === "ALL_LOCKED"
          ? "All material detected positions verified locked — discovery marked complete."
          : aggregate === "MIXED"
            ? "Mixed: at least one verified lock and at least one EOA-removable position. One locked NFT ≠ locked liquidity."
            : aggregate === "ALL_UNLOCKED"
              ? "All material detected positions appear EOA-controlled — withdrawal risk."
              : aggregate === "UNKNOWN_INCOMPLETE"
                ? "LP enumeration/lock ownership incomplete — not assumed fully locked or unlocked."
                : "No detectable PoolManager token balance.",
      sizeWarning: false,
      positions,
      evidenceLevel,
      detail: detailParts.join(" "),
      discoverySources: [...discoverySources],
      uniswapVersions: emptyUniswapVersionCoverage({
        v4Searched: true,
        v4Pools: poolIds.size || (matchedPoolId ? 1 : 0),
        v4Positions: positions.length,
        v4DiscoveryComplete: discoveryComplete,
        v4LockComplete:
          discoveryComplete &&
          aggregate !== "UNKNOWN_INCOMPLETE" &&
          positionCounts.unknown === 0,
        v4Detail: detailParts.join(" "),
      }),
    };

    return { intelligence, legacyStatus: legacyStatus(aggregate) };
  };

  const checkpoint = await loadLpDiscoveryCheckpoint(
    ROBINHOOD_CHAIN_ID,
    tokenAddress,
  );
  const previouslyChecked = new Set<string>(
    checkpoint?.checkedPositionIds ?? [],
  );

  const notifyQuick = async (
    partial: Omit<QuickLpProgressEvent, "positionsFound"> & {
      positionsFound?: number;
    },
  ) => {
    if (!input.onQuickDiscoveryProgress) return;
    await input.onQuickDiscoveryProgress({
      phase: partial.phase,
      candidatesQueued: partial.candidatesQueued,
      candidatesEvaluated: partial.candidatesEvaluated,
      positionsFound: partial.positionsFound ?? positionsById.size,
      pmPages: partial.pmPages,
      completedUnits: partial.completedUnits,
      totalUnits: partial.totalUnits,
    });
  };

  await notifyQuick({
    phase: "cache_revalidate",
    candidatesQueued: priorityIds.size,
    candidatesEvaluated: priorityIds.size,
    completedUnits: 1,
    totalUnits: 6,
  });
  if (titanLocks.size > 0) {
    await notifyQuick({
      phase: "titan",
      candidatesQueued: priorityIds.size,
      candidatesEvaluated: priorityIds.size,
      completedUnits: 2,
      totalUnits: 6,
    });
  }

  const knownPositions = [...positionsById.values()];
  const knownVerified = knownFirstSufficient({ seeds, positions: knownPositions });
  if (knownVerified) {
    // Drop stale cached IDs that failed revalidation; persist proven IDs only.
    await persistProvenDiscovery({
      positions: knownPositions,
      exhaustiveComplete: false,
      knownVerified: true,
    });
    await persistLpDiscoveryCheckpoint(ROBINHOOD_CHAIN_ID, tokenAddress, {
      checkedPositionIds: [
        ...knownPositions.map((p) => p.positionNftId),
        ...stalePositionIds,
      ],
      quickComplete: true,
      exhaustiveComplete: false,
    });
    const partial = buildResult({
      exhaustiveComplete: false,
      knownVerified: true,
    });
    if (input.onKnownPositions) {
      await input.onKnownPositions(partial);
    }
    await notifyQuick({
      phase: "publish",
      candidatesQueued: priorityIds.size,
      candidatesEvaluated: priorityIds.size,
      completedUnits: 5,
      totalUnits: 6,
    });
    // Known-first sufficient: skip Quick PM expansion + exhaustive unless asked.
    if (input.exhaustiveDiscovery !== true) {
      await notifyQuick({
        phase: "complete",
        candidatesQueued: priorityIds.size,
        candidatesEvaluated: priorityIds.size,
        completedUnits: 6,
        totalUnits: 6,
      });
      return partial;
    }
  } else if (knownPositions.length > 0 || stalePositionIds.size > 0) {
    // Partial prove-out / stale drop: keep validated IDs, remove definitive stale.
    await persistProvenDiscovery({
      positions: knownPositions,
      exhaustiveComplete: false,
      knownVerified: false,
    });
    if (input.onKnownPositions && knownPositions.length > 0) {
      await input.onKnownPositions(
        buildResult({ exhaustiveComplete: false, knownVerified: false }),
      );
    }
  }

  const allowQuick =
    input.quickDiscovery !== false && input.skipQuickDiscoveryExpansion !== true;
  const quickWallMs = input.quickDiscoveryMaxWallMs ?? QUICK_LP_MAX_WALL_MS;

  // —— Phase 1.5: Quick LP (bounded hints + PM ≤3 pages) before exhaustive ——
  // Deep soft budget is 180s (<200s exhaustive gate). Quick fills FOX-class
  // Lock Dist without scanning hundreds of unrelated Position NFT IDs.
  if (!knownVerified && allowQuick) {
    // Second-scan / retry reuse: prior Quick already paid PM+hints — do not rescan.
    if (
      checkpoint?.quickComplete === true &&
      input.exhaustiveDiscovery !== true
    ) {
      await persistLpDiscoveryCheckpoint(ROBINHOOD_CHAIN_ID, tokenAddress, {
        checkedPositionIds: [
          ...knownPositions.map((p) => p.positionNftId),
          ...stalePositionIds,
        ],
        quickComplete: true,
        exhaustiveComplete: false,
      });
      await notifyQuick({
        phase: "complete",
        candidatesQueued: 0,
        candidatesEvaluated: 0,
        completedUnits: 6,
        totalUnits: 6,
      });
      if (!discoverySources.includes("quick_lp_checkpoint_reuse")) {
        discoverySources.push("quick_lp_checkpoint_reuse");
      }
      return buildResult({
        exhaustiveComplete: false,
        knownVerified: false,
      });
    }

    const quickStarted = Date.now();
    const quickIds = new Set<bigint>();

    // Titan already harvested when priorityIds was empty; widen once for hints.
    if (priorityIds.size > 0 && titanLocks.size === 0) {
      for (const m of await discoverTitanLocksForToken(tokenAddress, hintAddresses)) {
        titanLocks.set(m.positionNftId.toString(), m);
        quickIds.add(m.positionNftId);
      }
      if (titanLocks.size > 0 && !discoverySources.includes("titan_locker")) {
        discoverySources.push("titan_locker");
      }
    } else {
      for (const m of titanLocks.values()) {
        quickIds.add(m.positionNftId);
      }
    }
    await notifyQuick({
      phase: "titan",
      candidatesQueued: quickIds.size,
      candidatesEvaluated: 0,
      completedUnits: 2,
      totalUnits: 6,
    });

    if (Date.now() - quickStarted < quickWallMs) {
      const hintOwners = [
        ...new Set(hintAddresses.map((a) => a.toLowerCase())),
      ].slice(0, QUICK_LP_MAX_HINT_OWNERS);
      const hintNftLists = await Promise.all(
        hintOwners.map((a) =>
          fetchAddressPositionNftIds(a, POSITION_MANAGER_ADDRESS),
        ),
      );
      let hintNftCount = 0;
      for (const list of hintNftLists) {
        for (const id of list) {
          if (previouslyChecked.has(id.toString())) continue;
          quickIds.add(id);
          hintNftCount++;
        }
      }
      if (hintNftCount > 0) discoverySources.push("hint_address_nft_inventory");
      await notifyQuick({
        phase: "hint_inventory",
        candidatesQueued: quickIds.size,
        candidatesEvaluated: 0,
        completedUnits: 3,
        totalUnits: 6,
      });
    }

    let pmPages = 0;
    if (Date.now() - quickStarted < quickWallMs) {
      const recentIds = await fetchRecentPositionManagerTokenIds(
        POSITION_MANAGER_ADDRESS,
        { maxPages: QUICK_LP_PM_MAX_PAGES },
      );
      pmPages = QUICK_LP_PM_MAX_PAGES;
      for (const id of recentIds) {
        if (previouslyChecked.has(id.toString())) continue;
        quickIds.add(id);
      }
      if (recentIds.length > 0) {
        discoverySources.push("position_manager_transfers_quick");
      }
      await notifyQuick({
        phase: "pm_recent",
        candidatesQueued: quickIds.size,
        candidatesEvaluated: 0,
        pmPages,
        completedUnits: 4,
        totalUnits: 6,
      });
    }

    // Skip IDs already evaluated in known-first; bound brand-new RPC work.
    const unevaluated = [...quickIds].filter(
      (id) =>
        !positionsById.has(id.toString()) &&
        !previouslyChecked.has(id.toString()),
    );
    const bounded = boundQuickLpCandidates(unevaluated, QUICK_LP_MAX_CANDIDATES);
    await notifyQuick({
      phase: "evaluate",
      candidatesQueued: bounded.length,
      candidatesEvaluated: 0,
      pmPages,
      completedUnits: 4,
      totalUnits: 6,
    });

    // Evaluate in batches; stop early when Quick evidence is sufficient.
    for (let i = 0; i < bounded.length; i += POSITION_EVAL_BATCH) {
      if (Date.now() - quickStarted >= quickWallMs) break;
      const chunk = bounded.slice(i, i + POSITION_EVAL_BATCH);
      await evaluateMany(chunk);
      const snap = [...positionsById.values()];
      if (
        quickLpEvidenceSufficient({ seeds, positions: snap }) ||
        knownFirstSufficient({ seeds, positions: snap })
      ) {
        break;
      }
    }

    const quickPositions = [...positionsById.values()];
    const quickVerified = knownFirstSufficient({
      seeds,
      positions: quickPositions,
    });
    await persistProvenDiscovery({
      positions: quickPositions,
      exhaustiveComplete: false,
      knownVerified: quickVerified,
    });
    await persistLpDiscoveryCheckpoint(ROBINHOOD_CHAIN_ID, tokenAddress, {
      checkedPositionIds: [
        ...quickPositions.map((p) => p.positionNftId),
        ...stalePositionIds,
        ...bounded.map((id) => id.toString()),
      ],
      pmPagesFetched: Math.max(checkpoint?.pmPagesFetched ?? 0, pmPages),
      quickComplete: true,
      exhaustiveComplete: false,
    });

    if (input.onKnownPositions && quickPositions.length > 0) {
      await input.onKnownPositions(
        buildResult({
          exhaustiveComplete: false,
          knownVerified: quickVerified,
        }),
      );
    }
    await notifyQuick({
      phase: "publish",
      candidatesQueued: bounded.length,
      candidatesEvaluated: bounded.length,
      pmPages,
      completedUnits: 5,
      totalUnits: 6,
    });

    if (input.exhaustiveDiscovery !== true) {
      await notifyQuick({
        phase: "complete",
        candidatesQueued: bounded.length,
        candidatesEvaluated: bounded.length,
        pmPages,
        completedUnits: 6,
        totalUnits: 6,
      });
      return buildResult({
        exhaustiveComplete: false,
        knownVerified: quickVerified,
      });
    }
  }

  // Budget gate: Deep soft liquidity budget is 180s (<200s). Without explicit
  // exhaustiveDiscovery, do not fall into ~190s PM rediscovery.
  if (input.exhaustiveDiscovery !== true) {
    return buildResult({
      exhaustiveComplete: false,
      knownVerified: false,
    });
  }

  // —— Phase 2: exhaustive candidate expansion (hints + PM transfers) ——
  const extraIds = new Set<bigint>();
  // Widen Titan harvest once when entering exhaustive (may find non-seeded locks).
  for (const m of await discoverTitanLocksForToken(tokenAddress, hintAddresses)) {
    titanLocks.set(m.positionNftId.toString(), m);
    extraIds.add(m.positionNftId);
  }
  if (titanLocks.size > 0 && !discoverySources.includes("titan_locker")) {
    discoverySources.push("titan_locker");
  }

  const hintOwners = [...new Set(hintAddresses.map((a) => a.toLowerCase()))].slice(
    0,
    EXHAUSTIVE_LP_MAX_HINT_OWNERS,
  );
  const hintNftLists = await Promise.all(
    hintOwners.map((a) => fetchAddressPositionNftIds(a, POSITION_MANAGER_ADDRESS)),
  );
  let hintNftCount = 0;
  for (const list of hintNftLists) {
    for (const id of list) {
      if (previouslyChecked.has(id.toString()) && positionsById.has(id.toString())) {
        continue;
      }
      extraIds.add(id);
      hintNftCount++;
    }
  }
  if (
    hintNftCount > 0 &&
    !discoverySources.includes("hint_address_nft_inventory")
  ) {
    discoverySources.push("hint_address_nft_inventory");
  }

  const recentIds = await fetchRecentPositionManagerTokenIds(POSITION_MANAGER_ADDRESS, {
    maxPages: EXHAUSTIVE_LP_PM_MAX_PAGES,
  });
  for (const id of recentIds) {
    if (previouslyChecked.has(id.toString()) && positionsById.has(id.toString())) {
      continue;
    }
    extraIds.add(id);
  }
  if (
    recentIds.length > 0 &&
    !discoverySources.includes("position_manager_transfers") &&
    !discoverySources.includes("position_manager_transfers_quick")
  ) {
    discoverySources.push("position_manager_transfers");
  } else if (
    recentIds.length > 0 &&
    !discoverySources.includes("position_manager_transfers")
  ) {
    discoverySources.push("position_manager_transfers");
  }

  // Prefer unevaluated candidates; still re-check uncertain cache IDs.
  const exhaustiveList = [...extraIds].filter(
    (id) => !positionsById.has(id.toString()),
  );
  await evaluateMany(exhaustiveList);

  const finalPositions = [...positionsById.values()];
  const finalKnownVerified = knownFirstSufficient({
    seeds,
    positions: finalPositions,
  });
  await persistProvenDiscovery({
    positions: finalPositions,
    exhaustiveComplete: true,
    knownVerified: finalKnownVerified,
  });
  await persistLpDiscoveryCheckpoint(ROBINHOOD_CHAIN_ID, tokenAddress, {
    checkedPositionIds: [
      ...finalPositions.map((p) => p.positionNftId),
      ...stalePositionIds,
      ...exhaustiveList.map((id) => id.toString()),
    ],
    pmPagesFetched: EXHAUSTIVE_LP_PM_MAX_PAGES,
    quickComplete: true,
    exhaustiveComplete: true,
    replaceChecked: true,
  });

  return buildResult({
    exhaustiveComplete: true,
    knownVerified: finalKnownVerified,
  });
}

export function isValidAddress(value: string): boolean {
  return isAddress(value);
}

export {
  computeTokenAggregate,
  computeLockDistribution,
  countPositionLocks,
} from "@/lib/hansome-score/lp/aggregate";
