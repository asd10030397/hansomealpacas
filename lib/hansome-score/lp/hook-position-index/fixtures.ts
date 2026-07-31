/**
 * Allowlisted Doppler Hook Native fixtures (Phase 11D evidence).
 * GME salt 0..7 count is a fixture assertion only — not general protocol.
 */

import { getAddress, type Address, type Hex } from "viem";
import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import {
  DOPPLER_HOOK_INITIALIZER,
  HOOK_POS_POOL_MANAGER,
  HOOK_POS_POSITION_MANAGER,
} from "@/lib/hansome-score/lp/hook-position-index/abis";
import type { HookPositionRecord } from "@/lib/hansome-score/lp/hook-position-index/types";

export const HANSOME_TOKEN = getAddress(
  "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
) as Address;

export const OKC_TOKEN = getAddress(
  "0xddEB6C5415c3CCB66295b610a06e8E30155f2bA3",
) as Address;

export const GME_TOKEN = getAddress(
  "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3",
) as Address;

export type HookPoolFixture = {
  label: "OKC" | "GME";
  token: Address;
  poolId: Hex;
  hookAddress: Address;
  positionManager: Address;
  poolManager: Address;
  createTx: Hex | null;
  createBlock: number | null;
  /** When true, fixture positions may mark hookDiscoveryComplete after tip catch-up. */
  fixtureComplete: boolean;
  /** Phase 11D create-mint set (GME only). */
  fixturePositions?: Omit<
    HookPositionRecord,
    "chainId" | "poolId" | "classification" | "source"
  >[];
};

function saltOf(n: number): Hex {
  return `0x${n.toString(16).padStart(64, "0")}` as Hex;
}

/** GME Phase 11D create-mint positions (salts 0–7). */
export const GME_FIXTURE_POSITIONS: NonNullable<
  HookPoolFixture["fixturePositions"]
> = [
  {
    owner: DOPPLER_HOOK_INITIALIZER,
    tickLower: 189400,
    tickUpper: 196400,
    salt: saltOf(0),
    firstSeenBlock: 16_864_619,
    lastSeenBlock: 16_864_619,
    lastLiquidityDelta: "469589918711015743145182",
    netLiquidityDelta: "469589918711015743145182",
  },
  {
    owner: DOPPLER_HOOK_INITIALIZER,
    tickLower: 182600,
    tickUpper: 189400,
    salt: saltOf(1),
    firstSeenBlock: 16_864_619,
    lastSeenBlock: 16_864_619,
    lastLiquidityDelta: "8113250345187386336430908",
    netLiquidityDelta: "8113250345187386336430908",
  },
  {
    owner: DOPPLER_HOOK_INITIALIZER,
    tickLower: 179200,
    tickUpper: 182600,
    salt: saltOf(2),
    firstSeenBlock: 16_864_619,
    lastSeenBlock: 16_864_619,
    lastLiquidityDelta: "2357934476196910980354122",
    netLiquidityDelta: "2357934476196910980354122",
  },
  {
    owner: DOPPLER_HOOK_INITIALIZER,
    tickLower: 171600,
    tickUpper: 179200,
    salt: saltOf(3),
    firstSeenBlock: 16_864_619,
    lastSeenBlock: 16_864_619,
    lastLiquidityDelta: "13354411456928989518594599",
    netLiquidityDelta: "13354411456928989518594599",
  },
  {
    owner: DOPPLER_HOOK_INITIALIZER,
    tickLower: 157600,
    tickUpper: 171600,
    salt: saltOf(4),
    firstSeenBlock: 16_864_619,
    lastSeenBlock: 16_864_619,
    lastLiquidityDelta: "3172836366808165861563058",
    netLiquidityDelta: "3172836366808165861563058",
  },
  {
    owner: DOPPLER_HOOK_INITIALIZER,
    tickLower: 125400,
    tickUpper: 157600,
    salt: saltOf(5),
    firstSeenBlock: 16_864_619,
    lastSeenBlock: 16_864_619,
    lastLiquidityDelta: "1205947784821233116153572",
    netLiquidityDelta: "1205947784821233116153572",
  },
  {
    owner: DOPPLER_HOOK_INITIALIZER,
    tickLower: 79400,
    tickUpper: 125400,
    salt: saltOf(6),
    firstSeenBlock: 16_864_619,
    lastSeenBlock: 16_864_619,
    lastLiquidityDelta: "8046910275330758103063248",
    netLiquidityDelta: "8046910275330758103063248",
  },
  {
    owner: DOPPLER_HOOK_INITIALIZER,
    tickLower: -887200,
    tickUpper: 79400,
    salt: saltOf(7),
    firstSeenBlock: 16_864_619,
    lastSeenBlock: 16_864_619,
    lastLiquidityDelta: "19254723226365848014880752",
    netLiquidityDelta: "19254723226365848014880752",
  },
];

export const HOOK_POOL_FIXTURES: readonly HookPoolFixture[] = [
  {
    label: "OKC",
    token: OKC_TOKEN,
    poolId:
      "0xd3073ec423c33dd50ccfdf04687d58cd9043210bcef7aca31f3c48331d8635cf",
    hookAddress: DOPPLER_HOOK_INITIALIZER,
    positionManager: HOOK_POS_POSITION_MANAGER,
    poolManager: HOOK_POS_POOL_MANAGER,
    createTx: null,
    createBlock: null,
    fixtureComplete: false,
  },
  {
    label: "GME",
    token: GME_TOKEN,
    poolId:
      "0x3623694d2613d7a543903b93226ed020d2fddbe00ed93ebd21aec098b10211c2",
    hookAddress: DOPPLER_HOOK_INITIALIZER,
    positionManager: HOOK_POS_POSITION_MANAGER,
    poolManager: HOOK_POS_POOL_MANAGER,
    createTx:
      "0xf3dfb544e8ab2ff8041b087c879095eb9c36790fb9c7207ba095a72d240b8c82",
    createBlock: 16_864_619,
    fixtureComplete: true,
    fixturePositions: GME_FIXTURE_POSITIONS,
  },
];

export function findHookPoolFixtureByToken(
  tokenAddress: string,
): HookPoolFixture | null {
  const t = getAddress(tokenAddress).toLowerCase();
  return HOOK_POOL_FIXTURES.find((f) => f.token.toLowerCase() === t) ?? null;
}

export function findHookPoolFixtureByPoolId(
  poolId: string,
): HookPoolFixture | null {
  const p = poolId.trim().toLowerCase();
  return HOOK_POOL_FIXTURES.find((f) => f.poolId.toLowerCase() === p) ?? null;
}

export function isHansomeClassAToken(tokenAddress: string): boolean {
  return getAddress(tokenAddress).toLowerCase() === HANSOME_TOKEN.toLowerCase();
}

export function fixtureRecordsFor(
  fixture: HookPoolFixture,
): HookPositionRecord[] {
  if (!fixture.fixturePositions?.length) return [];
  return fixture.fixturePositions.map((p) => ({
    chainId: SCAN_CHAIN_ID,
    poolId: fixture.poolId.toLowerCase(),
    owner: getAddress(p.owner).toLowerCase(),
    tickLower: p.tickLower,
    tickUpper: p.tickUpper,
    salt: p.salt.toLowerCase(),
    classification: "hook_owned" as const,
    firstSeenBlock: p.firstSeenBlock,
    lastSeenBlock: p.lastSeenBlock,
    lastLiquidityDelta: p.lastLiquidityDelta,
    netLiquidityDelta: p.netLiquidityDelta,
    source: "fixture" as const,
  }));
}
