import { getAddress, type Address, type PublicClient } from "viem";
import {
  PONS_LAUNCH_LOCKER,
  ponsLaunchLockerAbi,
  uniswapV3NpmAbi,
} from "@/lib/hansome-score/constants";
import { UNISWAP_RH_DEPLOYMENTS } from "@/lib/hansome-score/lp/deployments";
import type {
  LockerAdapter,
  LockerDiscoveryContext,
  VerifiedLockerPosition,
} from "@/lib/hansome-score/lp/lockers/types";
import { findLockerByAddress } from "@/lib/hansome-score/lp/registry";

const getPoolAbi = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    outputs: [{ type: "address" }],
  },
] as const;

const ZERO = "0x0000000000000000000000000000000000000000";

type LaunchedTokenRow = {
  token: Address;
  deployer: Address;
  pairedToken: Address;
  positionManager: Address;
  positionId: bigint;
  dexId: bigint;
  launchConfigId: bigint;
  restrictionsEndBlock: bigint;
  supply: bigint;
  isToken0: boolean;
  poolFee: number;
  exists: boolean;
  initialBuyAmount: bigint;
};

function asLaunchedToken(row: unknown): LaunchedTokenRow | null {
  if (row == null || typeof row !== "object") return null;
  const r = row as Record<string, unknown> & { length?: number };
  // viem may return a named struct object or a tuple array
  const token = (r.token ?? (Array.isArray(row) ? row[0] : null)) as Address | null;
  const positionManager = (r.positionManager ??
    (Array.isArray(row) ? row[3] : null)) as Address | null;
  const positionId = (r.positionId ??
    (Array.isArray(row) ? row[4] : null)) as bigint | null;
  const exists = Boolean(r.exists ?? (Array.isArray(row) ? row[11] : false));
  const pairedToken = (r.pairedToken ??
    (Array.isArray(row) ? row[2] : null)) as Address | null;
  const poolFee = Number(r.poolFee ?? (Array.isArray(row) ? row[10] : 0));
  if (!token || !positionManager || positionId == null || !pairedToken) return null;
  return {
    token: getAddress(token) as Address,
    deployer: getAddress(
      ((r.deployer ?? (Array.isArray(row) ? row[1] : token)) as Address) || token,
    ) as Address,
    pairedToken: getAddress(pairedToken) as Address,
    positionManager: getAddress(positionManager) as Address,
    positionId: BigInt(positionId),
    dexId: BigInt((r.dexId as bigint | number | undefined) ?? 0),
    launchConfigId: BigInt((r.launchConfigId as bigint | number | undefined) ?? 0),
    restrictionsEndBlock: BigInt(
      (r.restrictionsEndBlock as bigint | number | undefined) ?? 0,
    ),
    supply: BigInt((r.supply as bigint | number | undefined) ?? 0),
    isToken0: Boolean(r.isToken0),
    poolFee,
    exists,
    initialBuyAmount: BigInt((r.initialBuyAmount as bigint | number | undefined) ?? 0),
  };
}

async function readLaunchedToken(
  c: PublicClient,
  token: Address,
): Promise<LaunchedTokenRow | null> {
  try {
    const row = await c.readContract({
      address: PONS_LAUNCH_LOCKER,
      abi: ponsLaunchLockerAbi,
      functionName: "getLaunchedToken",
      args: [token],
    });
    return asLaunchedToken(row);
  } catch {
    return null;
  }
}

function parsePositionsRow(row: unknown): {
  token0: Address;
  token1: Address;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
} | null {
  const r = row as Record<string, unknown> & {
    [i: number]: unknown;
  };
  const token0 = (r.token0 ?? r[2]) as Address | undefined;
  const token1 = (r.token1 ?? r[3]) as Address | undefined;
  const fee = r.fee ?? r[4];
  const tickLower = r.tickLower ?? r[5];
  const tickUpper = r.tickUpper ?? r[6];
  const liquidity = r.liquidity ?? r[7];
  if (token0 == null || token1 == null || fee == null || liquidity == null) {
    return null;
  }
  return {
    token0: getAddress(token0) as Address,
    token1: getAddress(token1) as Address,
    fee: Number(fee),
    tickLower: Number(tickLower),
    tickUpper: Number(tickUpper),
    liquidity: BigInt(liquidity as bigint | number | string),
  };
}

async function readOwnerOf(
  c: PublicClient,
  npm: Address,
  positionId: bigint,
): Promise<Address | null> {
  try {
    return getAddress(
      (await c.readContract({
        address: npm,
        abi: uniswapV3NpmAbi,
        functionName: "ownerOf",
        args: [positionId],
      })) as Address,
    ) as Address;
  } catch {
    return null;
  }
}

async function readPositions(
  c: PublicClient,
  npm: Address,
  positionId: bigint,
): Promise<{
  token0: Address;
  token1: Address;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
} | null> {
  try {
    const row = await c.readContract({
      address: npm,
      abi: uniswapV3NpmAbi,
      functionName: "positions",
      args: [positionId],
    });
    return parsePositionsRow(row);
  } catch {
    return null;
  }
}

async function resolvePoolAddress(
  c: PublicClient,
  token0: Address,
  token1: Address,
  fee: number,
): Promise<Address | null> {
  try {
    const pool = (await c.readContract({
      address: UNISWAP_RH_DEPLOYMENTS.v3.factory,
      abi: getPoolAbi,
      functionName: "getPool",
      args: [token0, token1, fee],
    })) as Address;
    if (!pool || pool.toLowerCase() === ZERO) return null;
    return getAddress(pool) as Address;
  } catch {
    return null;
  }
}

/**
 * Parallel ownerOf + positions after getLaunchedToken (same classification gates).
 * Cuts sequential RPC round-trips that starved Candidate liquidity budgets.
 */
async function readOwnerAndPositions(
  c: PublicClient,
  npm: Address,
  positionId: bigint,
): Promise<{
  owner: Address | null;
  pos: ReturnType<typeof parsePositionsRow>;
}> {
  try {
    const results = await c.multicall({
      allowFailure: true,
      contracts: [
        {
          address: npm,
          abi: uniswapV3NpmAbi,
          functionName: "ownerOf",
          args: [positionId],
        },
        {
          address: npm,
          abi: uniswapV3NpmAbi,
          functionName: "positions",
          args: [positionId],
        },
      ],
    });
    const ownerRaw = results[0];
    const posRaw = results[1];
    const owner =
      ownerRaw.status === "success"
        ? (getAddress(ownerRaw.result as Address) as Address)
        : null;
    const pos =
      posRaw.status === "success" ? parsePositionsRow(posRaw.result) : null;
    return { owner, pos };
  } catch {
    const [owner, pos] = await Promise.all([
      readOwnerOf(c, npm, positionId),
      readPositions(c, npm, positionId),
    ]);
    return { owner, pos };
  }
}

/**
 * PonsLaunchLocker adapter (2nd after Titan).
 *
 * Flow: getLaunchedToken(token) → NPM ownerOf must equal locker → positions(tokenId).
 * Permanent escrow: no unlock in ABI → unlockTimestamp=null, LOCKED_VERIFIED_ONCHAIN.
 */
export const ponsLaunchLockerAdapter: LockerAdapter = {
  id: "pons_launch",

  async discoverPositionsForToken(
    ctx: LockerDiscoveryContext,
  ): Promise<VerifiedLockerPosition[]> {
    const token = getAddress(ctx.tokenAddress) as Address;
    const lockerMeta = findLockerByAddress(PONS_LAUNCH_LOCKER);
    if (!lockerMeta || lockerMeta.id !== "pons_launch") return [];

    const launched = await readLaunchedToken(ctx.client, token);
    if (!launched || !launched.exists) return [];
    if (launched.positionId <= 0n) return [];

    const npm = getAddress(launched.positionManager) as Address;
    // Require the canonical RH v3 NPM — do not invent lock from a foreign PM.
    if (npm.toLowerCase() !== UNISWAP_RH_DEPLOYMENTS.v3.positionManager.toLowerCase()) {
      return [];
    }

    // Parallel ownerOf + positions (same gates; fewer RPC round-trips on Candidate).
    const { owner, pos } = await readOwnerAndPositions(
      ctx.client,
      npm,
      launched.positionId,
    );
    if (!owner) return [];
    if (owner.toLowerCase() !== PONS_LAUNCH_LOCKER.toLowerCase()) {
      // Mapping exists but NFT is not held by the locker — do not claim locked.
      return [];
    }
    if (!pos) return [];

    // Token must appear in the position pair (defense against stale mapping).
    const tokenLc = token.toLowerCase();
    if (
      pos.token0.toLowerCase() !== tokenLc &&
      pos.token1.toLowerCase() !== tokenLc
    ) {
      return [];
    }

    // Zero liquidity is not a material verified lock claim.
    if (pos.liquidity <= 0n) return [];

    // Re-read ownerOf immediately before emit — still must equal locker.
    // Overlap with getPool to keep total round-trips low.
    const [ownerRecheck, pool] = await Promise.all([
      readOwnerOf(ctx.client, npm, launched.positionId),
      resolvePoolAddress(ctx.client, pos.token0, pos.token1, pos.fee),
    ]);
    if (
      !ownerRecheck ||
      ownerRecheck.toLowerCase() !== PONS_LAUNCH_LOCKER.toLowerCase()
    ) {
      return [];
    }
    if (!pool) return [];

    // Launched mapping poolFee should match positions fee when present.
    if (launched.poolFee > 0 && launched.poolFee !== pos.fee) return [];

    return [
      {
        adapterId: "pons_launch",
        lockerName: lockerMeta.name,
        lockerAddress: PONS_LAUNCH_LOCKER,
        positionNftId: launched.positionId.toString(),
        owner: ownerRecheck,
        positionManager: npm,
        poolOrPair: pool,
        fee: pos.fee,
        liquidity: pos.liquidity.toString(),
        tickLower: pos.tickLower,
        tickUpper: pos.tickUpper,
        currency0: pos.token0,
        currency1: pos.token1,
        unlockTimestamp: null,
        evidenceLevel: "on_chain_verified",
        dataSource:
          "PonsLaunchLocker.getLaunchedToken + v3 NPM ownerOf/positions (permanent escrow, null expiry)",
      },
    ];
  },
};
