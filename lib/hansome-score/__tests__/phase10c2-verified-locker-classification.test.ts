import { describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import {
  LP_LOCK_STATE_DISPLAY,
  PONS_LAUNCH_LOCKER,
} from "@/lib/hansome-score/constants";
import { discoverV3Liquidity } from "@/lib/hansome-score/lp/adapters/v3";
import { syntheticUnknownPosition } from "@/lib/hansome-score/lp/adapters/types";
import { RH_QUOTE_TOKENS, UNISWAP_RH_DEPLOYMENTS } from "@/lib/hansome-score/lp/deployments";
import {
  classifyDiscoveredV3Positions,
  classifyV3PositionLock,
  resolveV3OwnerType,
  V3_LOCKER_ADAPTERS,
} from "@/lib/hansome-score/lp/lockers";
import { ponsLaunchLockerAdapter } from "@/lib/hansome-score/lp/lockers/pons";
import type { VerifiedLockerPosition } from "@/lib/hansome-score/lp/lockers/types";
import { computeTokenAggregate } from "@/lib/hansome-score/lp/aggregate";
import type { V4PositionInfo } from "@/lib/hansome-score/types";

const BEER = getAddress("0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804");
const BEER_POOL = getAddress("0xC71E763a0a258f266d1481295115ea4f291D95ED");
const BEER_TOKEN_ID = 436637n;
const DOGG_POOL = getAddress("0xC03fF676EB6c3Bbd96dc725718A35acda60b6b02");
const DOGG_TOKEN_ID = 419712n;
const LIQUIDITY = 36819258015569838458222n;
const FEE = 10000;
const NPM = UNISWAP_RH_DEPLOYMENTS.v3.positionManager;
const EOA = getAddress("0xbE8af7E12B536aB55fbaf92EDbb512972e0504dA");
const UNKNOWN_CONTRACT = getAddress("0x1234567890123456789012345678901234567890");
const ZERO = "0x0000000000000000000000000000000000000000";

type Call = {
  address: string;
  functionName: string;
  args?: readonly unknown[];
};

function launchedRow(token: string, positionId: bigint, overrides?: Record<string, unknown>) {
  return {
    token,
    deployer: EOA,
    pairedToken: RH_QUOTE_TOKENS.WETH,
    positionManager: NPM,
    positionId,
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

function positionsRow(token: string, liquidity: bigint = LIQUIDITY) {
  return [
    0n,
    ZERO,
    RH_QUOTE_TOKENS.WETH,
    token,
    FEE,
    -887200,
    204200,
    liquidity,
    0n,
    0n,
    0n,
    0n,
  ] as const;
}

function beerClient(opts?: {
  owner?: string;
  exists?: boolean;
  liquidity?: bigint;
  poolResolve?: boolean;
}) {
  const owner = opts?.owner ?? PONS_LAUNCH_LOCKER;
  const exists = opts?.exists ?? true;
  const liquidity = opts?.liquidity ?? LIQUIDITY;
  const poolResolve = opts?.poolResolve !== false;

  return {
    getBytecode: vi.fn(async ({ address }: { address: string }) => {
      const a = String(address).toLowerCase();
      if (a === PONS_LAUNCH_LOCKER.toLowerCase()) return "0x60806040";
      if (a === UNKNOWN_CONTRACT.toLowerCase()) return "0x60806040";
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
        const isBeer =
          (a0 === BEER.toLowerCase() && a1 === RH_QUOTE_TOKENS.WETH.toLowerCase()) ||
          (a1 === BEER.toLowerCase() && a0 === RH_QUOTE_TOKENS.WETH.toLowerCase());
        if (isBeer && fee === FEE && poolResolve) return BEER_POOL;
        return ZERO;
      }

      if (functionName === "balanceOf") {
        if (addr === BEER.toLowerCase() && a0 === BEER_POOL.toLowerCase()) {
          return 10n ** 24n;
        }
        if (
          addr === RH_QUOTE_TOKENS.WETH.toLowerCase() &&
          a0 === BEER_POOL.toLowerCase()
        ) {
          return 10n ** 18n;
        }
        return 0n;
      }

      if (
        addr === PONS_LAUNCH_LOCKER.toLowerCase() &&
        functionName === "getLaunchedToken"
      ) {
        if (!exists) {
          return launchedRow(BEER, 0n, { exists: false, positionId: 0n });
        }
        return launchedRow(BEER, BEER_TOKEN_ID);
      }

      if (addr === NPM.toLowerCase() && functionName === "ownerOf") {
        if (String(args?.[0]) === BEER_TOKEN_ID.toString()) return owner;
        throw new Error("ERC721: invalid token ID");
      }

      if (addr === NPM.toLowerCase() && functionName === "positions") {
        if (String(args?.[0]) === BEER_TOKEN_ID.toString()) {
          return positionsRow(BEER, liquidity);
        }
        throw new Error("unknown");
      }

      throw new Error(`unexpected ${functionName} @ ${address}`);
    }),
  };
}

function basePos(overrides: Partial<V4PositionInfo>): V4PositionInfo {
  return {
    positionNftId: "1",
    owner: EOA,
    ownerLabel: null,
    lockerName: null,
    lockerAddress: null,
    lockState: "UNABLE_TO_DETERMINE",
    lockStateDisplay: LP_LOCK_STATE_DISPLAY.UNABLE_TO_DETERMINE,
    unlockTimestamp: null,
    unlockDateUtc: null,
    lockCreatedAt: null,
    lockTxHash: null,
    liquidity: LIQUIDITY.toString(),
    amount0Raw: null,
    amount1Raw: null,
    valueUsd: null,
    poolId: BEER_POOL,
    currency0: RH_QUOTE_TOKENS.WETH,
    currency1: BEER,
    fee: FEE,
    tickSpacing: null,
    tickLower: -887200,
    tickUpper: 204200,
    currentTick: null,
    inRange: null,
    removableByEoa: null,
    evidenceLevel: "on_chain_verified",
    dataSource: "v3_position_index:test",
    ...overrides,
  };
}

function verifiedHit(
  overrides?: Partial<VerifiedLockerPosition>,
): VerifiedLockerPosition {
  return {
    adapterId: "pons_launch",
    lockerName: "PonsLaunchLocker",
    lockerAddress: PONS_LAUNCH_LOCKER,
    positionNftId: BEER_TOKEN_ID.toString(),
    owner: PONS_LAUNCH_LOCKER,
    positionManager: NPM,
    poolOrPair: BEER_POOL,
    fee: FEE,
    liquidity: LIQUIDITY.toString(),
    tickLower: -887200,
    tickUpper: 204200,
    currency0: RH_QUOTE_TOKENS.WETH,
    currency1: BEER,
    unlockTimestamp: null,
    evidenceLevel: "on_chain_verified",
    dataSource: "test",
    ...overrides,
  };
}

describe("Phase 10C-2 — adapter wiring", () => {
  it("wires Pons ONLY into V3_LOCKER_ADAPTERS", () => {
    expect(V3_LOCKER_ADAPTERS.map((a) => a.id)).toEqual(["pons_launch"]);
    expect(V3_LOCKER_ADAPTERS).toHaveLength(1);
  });
});

describe("Phase 10C-2 — classification matrix (pure)", () => {
  it("adapter PASS → LOCKED_VERIFIED", () => {
    expect(
      classifyV3PositionLock({ ownerType: "known_locker", adapterPass: true }),
    ).toBe("LOCKED_VERIFIED");
  });

  it("known locker + adapter FAIL → UNABLE", () => {
    expect(
      classifyV3PositionLock({ ownerType: "known_locker", adapterPass: false }),
    ).toBe("UNABLE_TO_DETERMINE");
  });

  it("unknown contract → UNABLE (never Locked)", () => {
    expect(
      classifyV3PositionLock({
        ownerType: "unknown_contract",
        adapterPass: false,
      }),
    ).toBe("UNABLE_TO_DETERMINE");
  });

  it("EOA → UNLOCKED", () => {
    expect(
      classifyV3PositionLock({ ownerType: "eoa", adapterPass: false }),
    ).toBe("UNLOCKED");
  });

  it("burned → UNABLE (never unlocked)", () => {
    expect(
      classifyV3PositionLock({ ownerType: "burned", adapterPass: false }),
    ).toBe("UNABLE_TO_DETERMINE");
  });

  it("zero liquidity → UNABLE (not material unlocked)", () => {
    expect(
      classifyV3PositionLock({
        ownerType: "eoa",
        adapterPass: false,
        zeroLiquidity: true,
      }),
    ).toBe("UNABLE_TO_DETERMINE");
  });

  it("owner type resolver never invents lock from contract alone", () => {
    expect(
      resolveV3OwnerType({ owner: UNKNOWN_CONTRACT, isContract: true }),
    ).toBe("unknown_contract");
    expect(
      resolveV3OwnerType({ owner: PONS_LAUNCH_LOCKER, isContract: true }),
    ).toBe("known_locker");
    expect(resolveV3OwnerType({ owner: EOA, isContract: false })).toBe("eoa");
  });
});

describe("Phase 10C-2 — BEER via discoverV3Liquidity", () => {
  it("adapter PASS → LOCKED_VERIFIED + lockAnalysisComplete", async () => {
    const result = await discoverV3Liquidity({
      tokenAddress: BEER,
      client: beerClient() as never,
    });
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].positionNftId).toBe("436637");
    expect(result.positions[0].lockState).toBe("LOCKED_VERIFIED_ONCHAIN");
    expect(result.positions[0].lockerName).toBe("PonsLaunchLocker");
    expect(result.positions[0].removableByEoa).toBe(false);
    expect(result.lockAnalysisComplete).toBe(true);
    expect(result.detail).toMatch(/locker-verified=1/);
  });

  it("does not invent Locked when Pons mapping missing", async () => {
    const result = await discoverV3Liquidity({
      tokenAddress: BEER,
      client: beerClient({ exists: false }) as never,
    });
    expect(result.positions[0].lockState).toBe("UNABLE_TO_DETERMINE");
    expect(result.lockAnalysisComplete).toBe(false);
  });
});

describe("Phase 10C-2 — classify discovered positions", () => {
  it("EOA material position → UNLOCKED_EOA_CONTROLLED", async () => {
    const r = await classifyDiscoveredV3Positions({
      discovered: [basePos({ positionNftId: "99", owner: EOA })],
      verifiedHits: [],
      client: beerClient() as never,
    });
    expect(r.positions[0].lockState).toBe("UNLOCKED_EOA_CONTROLLED");
    expect(r.positions[0].removableByEoa).toBe(true);
    expect(r.lockAnalysisComplete).toBe(true);
  });

  it("unknown contract → UNABLE (not removable)", async () => {
    const r = await classifyDiscoveredV3Positions({
      discovered: [
        basePos({ positionNftId: "88", owner: UNKNOWN_CONTRACT }),
      ],
      verifiedHits: [],
      client: beerClient() as never,
    });
    expect(r.positions[0].lockState).toBe("UNABLE_TO_DETERMINE");
    expect(r.positions[0].removableByEoa).toBeNull();
  });

  it("known locker + adapter FAIL → UNABLE", async () => {
    const r = await classifyDiscoveredV3Positions({
      discovered: [
        basePos({
          positionNftId: BEER_TOKEN_ID.toString(),
          owner: PONS_LAUNCH_LOCKER,
        }),
      ],
      verifiedHits: [],
      client: beerClient() as never,
    });
    expect(r.positions[0].lockState).toBe("UNABLE_TO_DETERMINE");
    expect(r.positions[0].lockState).not.toBe("LOCKED_VERIFIED_ONCHAIN");
  });

  it("burned / missing owner → never UNLOCKED", async () => {
    const r = await classifyDiscoveredV3Positions({
      discovered: [
        basePos({
          positionNftId: "7",
          owner: null,
          liquidity: "0",
          dataSource: "v3_position_index:burned",
        }),
      ],
      verifiedHits: [],
    });
    expect(r.positions[0].lockState).toBe("UNABLE_TO_DETERMINE");
    expect(r.positions[0].removableByEoa).not.toBe(true);
  });

  it("zero liquidity not classified Unlocked", async () => {
    const r = await classifyDiscoveredV3Positions({
      discovered: [
        basePos({ positionNftId: "5", owner: EOA, liquidity: "0" }),
      ],
      verifiedHits: [],
      client: beerClient() as never,
    });
    expect(r.positions[0].lockState).toBe("UNABLE_TO_DETERMINE");
  });

  it("multi-position: classify independently; ALL_LOCKED only if all verified", async () => {
    const locked = verifiedHit({ positionNftId: "10" });
    const r = await classifyDiscoveredV3Positions({
      discovered: [
        basePos({
          positionNftId: "10",
          owner: PONS_LAUNCH_LOCKER,
          poolId: BEER_POOL,
        }),
        basePos({
          positionNftId: "11",
          owner: EOA,
          poolId: BEER_POOL,
        }),
      ],
      verifiedHits: [locked],
      client: beerClient() as never,
    });
    expect(r.positions).toHaveLength(2);
    expect(r.positions.find((p) => p.positionNftId === "10")?.lockState).toBe(
      "LOCKED_VERIFIED_ONCHAIN",
    );
    expect(r.positions.find((p) => p.positionNftId === "11")?.lockState).toBe(
      "UNLOCKED_EOA_CONTROLLED",
    );
    const agg = computeTokenAggregate({
      positions: r.positions,
      poolDetected: true,
      discoveryComplete: true,
    });
    expect(agg.aggregate).toBe("MIXED");
  });

  it("multi-position all adapter-verified → ALL_LOCKED", async () => {
    const hits = [
      verifiedHit({ positionNftId: "20" }),
      verifiedHit({ positionNftId: "21", liquidity: "1000" }),
    ];
    const r = await classifyDiscoveredV3Positions({
      discovered: [
        basePos({
          positionNftId: "20",
          owner: PONS_LAUNCH_LOCKER,
        }),
        basePos({
          positionNftId: "21",
          owner: PONS_LAUNCH_LOCKER,
          liquidity: "1000",
        }),
      ],
      verifiedHits: hits,
    });
    const agg = computeTokenAggregate({
      positions: r.positions,
      poolDetected: true,
      discoveryComplete: true,
    });
    expect(agg.aggregate).toBe("ALL_LOCKED");
  });

  it("future multi-locker compat: only matching adapter id PASS locks", async () => {
    const r = await classifyDiscoveredV3Positions({
      discovered: [
        basePos({
          positionNftId: "30",
          owner: PONS_LAUNCH_LOCKER,
        }),
      ],
      verifiedHits: [
        verifiedHit({
          positionNftId: "30",
          adapterId: "pons_launch",
        }),
      ],
    });
    expect(r.verifiedLocked).toBe(1);
    expect(r.positions[0].lockState).toBe("LOCKED_VERIFIED_ONCHAIN");
  });
});

describe("Phase 10C-2 — Pons adapter verification gates", () => {
  it("liquidity=0 → adapter FAIL (empty)", async () => {
    const hits = await ponsLaunchLockerAdapter.discoverPositionsForToken({
      tokenAddress: BEER,
      client: beerClient({ liquidity: 0n }) as never,
    });
    expect(hits).toHaveLength(0);
  });

  it("ownerOf ≠ locker → empty", async () => {
    const hits = await ponsLaunchLockerAdapter.discoverPositionsForToken({
      tokenAddress: BEER,
      client: beerClient({ owner: EOA }) as never,
    });
    expect(hits).toHaveLength(0);
  });

  it("pool unresolved → empty", async () => {
    const hits = await ponsLaunchLockerAdapter.discoverPositionsForToken({
      tokenAddress: BEER,
      client: beerClient({ poolResolve: false }) as never,
    });
    expect(hits).toHaveLength(0);
  });
});

describe("Phase 10C-2 — semantic honesty", () => {
  it("never Locked because owner name/contract alone", async () => {
    const stub = syntheticUnknownPosition({
      id: `v3-pool:${DOGG_POOL}:${FEE}`,
      version: "v3",
      poolOrPair: DOGG_POOL,
      fee: FEE,
      dataSource: "stub",
    });
    // Discovered Unknown with Pons owner but no adapter hit
    const r = await classifyDiscoveredV3Positions({
      discovered: [
        {
          ...stub,
          positionNftId: DOGG_TOKEN_ID.toString(),
          owner: PONS_LAUNCH_LOCKER,
          liquidity: LIQUIDITY.toString(),
        },
      ],
      verifiedHits: [],
      client: {
        getBytecode: async () => "0x60806040",
      } as never,
    });
    expect(r.positions[0].lockState).toBe("UNABLE_TO_DETERMINE");
  });

  it("Burned never implies Unlocked in aggregate", () => {
    const burned = basePos({
      positionNftId: "1",
      owner: null,
      liquidity: "0",
      removableByEoa: null,
    });
    const eoa = basePos({
      positionNftId: "2",
      owner: EOA,
      lockState: "UNLOCKED_EOA_CONTROLLED",
      removableByEoa: true,
    });
    const agg = computeTokenAggregate({
      positions: [burned, eoa],
      poolDetected: true,
      discoveryComplete: true,
    });
    // material filters zero-L burned away; remaining EOA unlocked → ALL_UNLOCKED
    expect(agg.aggregate).toBe("ALL_UNLOCKED");
    // burned alone must not become ALL_UNLOCKED via inventing unlocked
    const onlyBurned = computeTokenAggregate({
      positions: [burned],
      poolDetected: true,
      discoveryComplete: true,
    });
    expect(onlyBurned.aggregate).toBe("UNKNOWN_INCOMPLETE");
  });
});
