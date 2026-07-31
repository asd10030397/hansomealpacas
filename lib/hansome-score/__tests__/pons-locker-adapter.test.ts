import { describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import {
  LP_LOCK_STATE_DISPLAY,
  PONS_LAUNCH_LOCKER,
  TITAN_LOCKER_MANAGER,
} from "@/lib/hansome-score/constants";
import {
  discoverV3Liquidity,
  mergeV3LockerPositions,
} from "@/lib/hansome-score/lp/adapters/v3";
import { syntheticUnknownPosition } from "@/lib/hansome-score/lp/adapters/types";
import { RH_QUOTE_TOKENS, UNISWAP_RH_DEPLOYMENTS } from "@/lib/hansome-score/lp/deployments";
import { ponsLaunchLockerAdapter } from "@/lib/hansome-score/lp/lockers/pons";
import { verifiedLockerToPositionInfo } from "@/lib/hansome-score/lp/lockers/types";
import {
  classifyOwnerLockState,
  findLockerByAddress,
  LOCKER_REGISTRY,
} from "@/lib/hansome-score/lp/registry";
import {
  computeMultiVersionAggregate,
  buildUniswapVersionCoverage,
} from "@/lib/hansome-score/lp/multi";
import { userFacingAggregateLock, userFacingPositionLock } from "@/lib/hansome-score/lp/presentation";
import type { VersionDiscoveryResult } from "@/lib/hansome-score/lp/adapters/types";

/** The Doggfather — investigation fixture. */
const DOGGFATHER = getAddress("0xBcbDF667bc853dB297B6ea57ec525817B39F3630");
const DOGG_POOL = getAddress("0xC03fF676EB6c3Bbd96dc725718A35acda60b6b02");
const POSITION_ID = 419712n;
const LIQUIDITY = 36819258015569838458222n;
const TICK_LOWER = -887200;
const TICK_UPPER = 204200;
const FEE = 10000;
const NPM = UNISWAP_RH_DEPLOYMENTS.v3.positionManager;
const EOA = getAddress("0xbE8af7E12B536aB55fbaf92EDbb512972e0504dA");

type Call = {
  address: string;
  functionName: string;
  args?: readonly unknown[];
};

function launchedRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    token: DOGGFATHER,
    deployer: EOA,
    pairedToken: RH_QUOTE_TOKENS.WETH,
    positionManager: NPM,
    positionId: POSITION_ID,
    dexId: 0n,
    launchConfigId: 0n,
    restrictionsEndBlock: 0n,
    supply: 10n ** 27n,
    isToken0: false,
    poolFee: FEE,
    exists: true,
    initialBuyAmount: 0n,
    ...overrides,
  };
}

function positionsRow(overrides?: {
  token0?: string;
  token1?: string;
  fee?: number;
  liquidity?: bigint;
  ownerSide?: "locker" | "eoa";
}) {
  const token0 = overrides?.token0 ?? RH_QUOTE_TOKENS.WETH;
  const token1 = overrides?.token1 ?? DOGGFATHER;
  return [
    0n,
    "0x0000000000000000000000000000000000000000",
    token0,
    token1,
    overrides?.fee ?? FEE,
    TICK_LOWER,
    TICK_UPPER,
    overrides?.liquidity ?? LIQUIDITY,
    0n,
    0n,
    0n,
    0n,
  ] as const;
}

function doggFixtureClient(opts?: {
  owner?: string;
  exists?: boolean;
  foreignNpm?: boolean;
}) {
  const owner = opts?.owner ?? PONS_LAUNCH_LOCKER;
  const exists = opts?.exists ?? true;
  const npm = opts?.foreignNpm
    ? getAddress("0x1111111111111111111111111111111111111111")
    : NPM;

  return {
    getBytecode: vi.fn(async ({ address }: { address: string }) => {
      const a = String(address).toLowerCase();
      if (a === PONS_LAUNCH_LOCKER.toLowerCase()) return "0x60806040";
      if (a === EOA.toLowerCase()) return "0x";
      return "0x";
    }),
    readContract: vi.fn(async ({ address, functionName, args }: Call) => {
      const addr = String(address).toLowerCase();
      const a0 = args?.[0] != null ? String(args[0]).toLowerCase() : "";
      const a1 = args?.[1] != null ? String(args[1]).toLowerCase() : "";
      const fee = args?.[2];

      if (
        addr === UNISWAP_RH_DEPLOYMENTS.v3.factory.toLowerCase() &&
        functionName === "getPool"
      ) {
        const quotes = new Set([RH_QUOTE_TOKENS.WETH.toLowerCase()]);
        const isDogg =
          (a0 === DOGGFATHER.toLowerCase() && quotes.has(a1)) ||
          (a1 === DOGGFATHER.toLowerCase() && quotes.has(a0));
        if (isDogg && fee === FEE) return DOGG_POOL;
        // Also resolve from NPM token0/token1 ordering
        const isWethDogg =
          (a0 === RH_QUOTE_TOKENS.WETH.toLowerCase() &&
            a1 === DOGGFATHER.toLowerCase()) ||
          (a1 === RH_QUOTE_TOKENS.WETH.toLowerCase() &&
            a0 === DOGGFATHER.toLowerCase());
        if (isWethDogg && fee === FEE) return DOGG_POOL;
        return "0x0000000000000000000000000000000000000000";
      }

      if (functionName === "balanceOf") {
        if (addr === DOGGFATHER.toLowerCase() && a0 === DOGG_POOL.toLowerCase()) {
          return 10n ** 24n;
        }
        if (
          addr === RH_QUOTE_TOKENS.WETH.toLowerCase() &&
          a0 === DOGG_POOL.toLowerCase()
        ) {
          return 10n ** 18n;
        }
        return 0n;
      }

      if (
        addr === PONS_LAUNCH_LOCKER.toLowerCase() &&
        functionName === "getLaunchedToken"
      ) {
        if (!exists) return launchedRow({ exists: false, positionId: 0n });
        return launchedRow({ positionManager: npm });
      }

      if (addr === npm.toLowerCase() && functionName === "ownerOf") {
        if (String(args?.[0]) === POSITION_ID.toString()) return owner;
        throw new Error("unknown tokenId");
      }

      if (addr === npm.toLowerCase() && functionName === "positions") {
        if (String(args?.[0]) === POSITION_ID.toString()) return positionsRow();
        throw new Error("unknown tokenId");
      }

      throw new Error(`unexpected readContract ${functionName} @ ${address}`);
    }),
  };
}

function emptyVersion(version: "v2" | "v3" | "v4"): VersionDiscoveryResult {
  return {
    version,
    protocolSupportStatus: "partial",
    searched: true,
    discoveryComplete: true,
    lockAnalysisComplete: true,
    pools: [],
    positions: [],
    detail: `${version}: none`,
    evidenceLevel: "on_chain_verified",
  };
}

describe("LOCKER_REGISTRY — Pons after Titan", () => {
  it("registers titan_v2 first and pons_launch second", () => {
    expect(LOCKER_REGISTRY.map((l) => l.id)).toEqual(["titan_v2", "pons_launch"]);
    expect(findLockerByAddress(TITAN_LOCKER_MANAGER)?.id).toBe("titan_v2");
    expect(findLockerByAddress(PONS_LAUNCH_LOCKER)?.id).toBe("pons_launch");
    expect(findLockerByAddress(PONS_LAUNCH_LOCKER)?.expiryPolicy).toBe(
      "permanent_null",
    );
  });

  it("permanent_null owner alone → UNABLE (adapter PASS required; no heuristic Locked)", () => {
    expect(
      classifyOwnerLockState({
        owner: PONS_LAUNCH_LOCKER,
        unlockTimestamp: null,
        isContract: true,
      }),
    ).toBe("UNABLE_TO_DETERMINE");
  });

  it("Titan timed policy unchanged — null unlock → LOCK_DETECTED_EXPIRY_UNKNOWN", () => {
    expect(
      classifyOwnerLockState({
        owner: TITAN_LOCKER_MANAGER,
        unlockTimestamp: null,
        isContract: true,
      }),
    ).toBe("LOCK_DETECTED_EXPIRY_UNKNOWN");
  });

  it("unsupported contract owner remains UNSUPPORTED_LOCKER", () => {
    expect(
      classifyOwnerLockState({
        owner: "0x1234567890123456789012345678901234567890",
        unlockTimestamp: null,
        isContract: true,
      }),
    ).toBe("UNSUPPORTED_LOCKER");
  });
});

describe("PonsLaunchLocker adapter", () => {
  it("getLaunchedToken → ownerOf → positions → verified real NFT", async () => {
    const hits = await ponsLaunchLockerAdapter.discoverPositionsForToken({
      tokenAddress: DOGGFATHER,
      client: doggFixtureClient() as never,
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].positionNftId).toBe("419712");
    expect(hits[0].owner.toLowerCase()).toBe(PONS_LAUNCH_LOCKER.toLowerCase());
    expect(hits[0].poolOrPair?.toLowerCase()).toBe(DOGG_POOL.toLowerCase());
    expect(hits[0].liquidity).toBe(LIQUIDITY.toString());
    expect(hits[0].unlockTimestamp).toBeNull();
    expect(hits[0].tickLower).toBe(TICK_LOWER);
    expect(hits[0].tickUpper).toBe(TICK_UPPER);

    const pos = verifiedLockerToPositionInfo(hits[0]);
    expect(pos.lockState).toBe("LOCKED_VERIFIED_ONCHAIN");
    expect(pos.lockStateDisplay).toBe(LP_LOCK_STATE_DISPLAY.LOCKED_VERIFIED_ONCHAIN);
    expect(pos.removableByEoa).toBe(false);
    expect(pos.positionNftId).not.toMatch(/^v3-pool:/);
  });

  it("wrong ownerOf → do not claim locked", async () => {
    const hits = await ponsLaunchLockerAdapter.discoverPositionsForToken({
      tokenAddress: DOGGFATHER,
      client: doggFixtureClient({ owner: EOA }) as never,
    });
    expect(hits).toHaveLength(0);
  });

  it("exists=false (non-Pons token) → empty", async () => {
    const hits = await ponsLaunchLockerAdapter.discoverPositionsForToken({
      tokenAddress: DOGGFATHER,
      client: doggFixtureClient({ exists: false }) as never,
    });
    expect(hits).toHaveLength(0);
  });

  it("foreign positionManager → empty (no invent lock)", async () => {
    const hits = await ponsLaunchLockerAdapter.discoverPositionsForToken({
      tokenAddress: DOGGFATHER,
      client: doggFixtureClient({ foreignNpm: true }) as never,
    });
    expect(hits).toHaveLength(0);
  });
});

describe("discoverV3Liquidity — Pons replaces synthetic stub", () => {
  it("material pool stub replaced by real Position #419712", async () => {
    const result = await discoverV3Liquidity({
      tokenAddress: DOGGFATHER,
      client: doggFixtureClient() as never,
    });

    expect(result.pools).toHaveLength(1);
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].positionNftId).toBe("419712");
    expect(result.positions[0].lockState).toBe("LOCKED_VERIFIED_ONCHAIN");
    expect(result.positions.some((p) => p.positionNftId.startsWith("v3-pool:"))).toBe(
      false,
    );
    expect(result.lockAnalysisComplete).toBe(true);
    expect(result.detail).toMatch(/locker-verified=1/);
  });

  it("wrong owner keeps synthetic stub / Unknown", async () => {
    const result = await discoverV3Liquidity({
      tokenAddress: DOGGFATHER,
      client: doggFixtureClient({ owner: EOA }) as never,
    });

    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].positionNftId).toMatch(/^v3-pool:/);
    expect(result.positions[0].lockState).toBe("UNABLE_TO_DETERMINE");
    expect(result.lockAnalysisComplete).toBe(false);
  });

  it("non-Pons exists=false keeps stub Unknown", async () => {
    const result = await discoverV3Liquidity({
      tokenAddress: DOGGFATHER,
      client: doggFixtureClient({ exists: false }) as never,
    });

    expect(result.positions[0].positionNftId).toMatch(/^v3-pool:/);
    expect(result.lockAnalysisComplete).toBe(false);
  });
});

describe("mergeV3LockerPositions", () => {
  it("replaces matching pool stub and keeps unrelated stubs", () => {
    const stubA = syntheticUnknownPosition({
      id: `v3-pool:${DOGG_POOL}:${FEE}`,
      version: "v3",
      poolOrPair: DOGG_POOL,
      fee: FEE,
      dataSource: "stub",
    });
    const stubB = syntheticUnknownPosition({
      id: "v3-pool:0x9999999999999999999999999999999999999999:3000",
      version: "v3",
      poolOrPair: "0x9999999999999999999999999999999999999999",
      fee: 3000,
      dataSource: "stub",
    });
    const verified = verifiedLockerToPositionInfo({
      adapterId: "pons_launch",
      lockerName: "PonsLaunchLocker",
      lockerAddress: PONS_LAUNCH_LOCKER,
      positionNftId: "419712",
      owner: PONS_LAUNCH_LOCKER,
      positionManager: NPM,
      poolOrPair: DOGG_POOL,
      fee: FEE,
      liquidity: LIQUIDITY.toString(),
      tickLower: TICK_LOWER,
      tickUpper: TICK_UPPER,
      currency0: RH_QUOTE_TOKENS.WETH,
      currency1: DOGGFATHER,
      unlockTimestamp: null,
      evidenceLevel: "on_chain_verified",
      dataSource: "test",
    });

    const merged = mergeV3LockerPositions({
      stubs: [stubA, stubB],
      verified: [verified],
    });
    expect(merged.map((p) => p.positionNftId)).toEqual([
      "419712",
      stubB.positionNftId,
    ]);
  });
});

describe("Pons multi-version presentation honesty", () => {
  it("verified Pons-only v3 can complete coverage without inventing ALL_LOCKED from stubs", async () => {
    const v3 = await discoverV3Liquidity({
      tokenAddress: DOGGFATHER,
      client: doggFixtureClient() as never,
    });
    const coverage = buildUniswapVersionCoverage([
      emptyVersion("v2"),
      v3,
      emptyVersion("v4"),
    ]);
    expect(coverage.coverageComplete).toBe(true);

    const r = computeMultiVersionAggregate({
      positions: v3.positions,
      poolDetected: true,
      versionCoverage: coverage,
      v4DiscoveryComplete: true,
    });
    expect(r.aggregate).toBe("ALL_LOCKED");
    expect(userFacingAggregateLock(r.aggregate)).toBe("LOCKED");
    expect(userFacingPositionLock(v3.positions[0].lockState)).toBe("LOCKED");
  });

  it("unresolved stub still UNKNOWN_INCOMPLETE", async () => {
    const v3 = await discoverV3Liquidity({
      tokenAddress: DOGGFATHER,
      client: doggFixtureClient({ owner: EOA }) as never,
    });
    const coverage = buildUniswapVersionCoverage([
      emptyVersion("v2"),
      v3,
      emptyVersion("v4"),
    ]);
    expect(coverage.coverageComplete).toBe(false);

    const r = computeMultiVersionAggregate({
      positions: v3.positions,
      poolDetected: true,
      versionCoverage: coverage,
      v4DiscoveryComplete: true,
    });
    expect(r.aggregate).toBe("UNKNOWN_INCOMPLETE");
    expect(userFacingAggregateLock(r.aggregate)).toBe("UNKNOWN");
  });
});
