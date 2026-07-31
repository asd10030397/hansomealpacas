/**
 * Phase 11H — Airlock / Doppler / SFL protocol reads (allowlisted addresses only).
 */

import {
  decodeAbiParameters,
  encodeFunctionData,
  getAddress,
  parseAbi,
  parseAbiParameters,
  type Address,
  type PublicClient,
} from "viem";
import { POSITION_MANAGER_ADDRESS } from "@/lib/hansome-score/constants";
import {
  DOPPLER_AIRLOCK,
  DOPPLER_HOOK_INITIALIZER,
  hookPoolStatusName,
  STREAMABLE_FEES_LOCKER_V2,
} from "@/lib/hansome-score/lp/hook-doppler-registry";
import { normalizeBytes32 } from "@/lib/hansome-score/lp/hook-position-index/decode";
import type {
  AirlockAssetData,
  DopplerHookState,
  SflStreamSnapshot,
} from "@/lib/hansome-score/lp/hook-lock-classifier/types";

const AIRLOCK_ASSET_ABI = parseAbi([
  "function getAssetData(address asset) view returns (address numeraire, address timelock, address governance, address liquidityMigrator, address poolInitializer, address pool, address migrationPool, uint256 numTokensToSell, uint256 totalSupply, address integrator)",
  "function getModuleState(address module) view returns (uint8)",
]);

const OWNABLE_ABI = parseAbi(["function owner() view returns (address)"]);

const ERC721_BAL_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
]);

const SFL_ABI = parseAbi([
  "function streams(bytes32) view returns (address,address,uint24,int24,address,address,uint32,uint32,bool)",
]);

/** Working decode for DopplerHookInitializer.getState (Phase 11C). */
const GET_STATE_DECODE =
  "address,uint256,address,bytes,uint8,address,address,uint24,int24,address,int24";

export type HookProtocolSnapshot = {
  tokenOwner: string | null;
  tokenOwnerIsAirlock: boolean;
  assetData: AirlockAssetData | null;
  hookState: DopplerHookState | null;
  hookPosmNftBalance: bigint | null;
  sfl: SflStreamSnapshot | null;
  initializerModuleState: number | null;
  migratorModuleState: number | null;
  errors: string[];
};

export async function readAirlockAssetData(
  client: PublicClient,
  token: string,
  airlock: Address = DOPPLER_AIRLOCK,
): Promise<AirlockAssetData | null> {
  try {
    const r = await client.readContract({
      address: airlock,
      abi: AIRLOCK_ASSET_ABI,
      functionName: "getAssetData",
      args: [getAddress(token) as Address],
    });
    const [
      numeraire,
      timelock,
      governance,
      liquidityMigrator,
      poolInitializer,
      pool,
      migrationPool,
      numTokensToSell,
      totalSupply,
      integrator,
    ] = r as readonly [
      Address,
      Address,
      Address,
      Address,
      Address,
      Address,
      Address,
      bigint,
      bigint,
      Address,
    ];
    return {
      numeraire,
      timelock,
      governance,
      liquidityMigrator,
      poolInitializer,
      pool,
      migrationPool,
      numTokensToSell: numTokensToSell.toString(),
      totalSupply: totalSupply.toString(),
      integrator,
    };
  } catch {
    return null;
  }
}

export async function readDopplerHookState(
  client: PublicClient,
  token: string,
  hook: Address = DOPPLER_HOOK_INITIALIZER,
): Promise<DopplerHookState | null> {
  try {
    const data = encodeFunctionData({
      abi: parseAbi(["function getState(address)"]),
      functionName: "getState",
      args: [getAddress(token) as Address],
    });
    const raw = await client.call({ to: hook, data });
    if (!raw.data) return null;
    const decoded = decodeAbiParameters(
      parseAbiParameters(GET_STATE_DECODE),
      raw.data,
    );
    const status = Number(decoded[4]);
    return {
      status,
      statusName: hookPoolStatusName(status),
      dopplerHook: String(decoded[2]),
      currency0: String(decoded[5]),
      currency1: String(decoded[6]),
      fee: Number(decoded[7]),
      tickSpacing: Number(decoded[8]),
      hooks: String(decoded[9]),
      farTick: Number(decoded[10]),
    };
  } catch {
    return null;
  }
}

export async function readSflStream(
  client: PublicClient,
  poolId: string,
  sfl: Address = STREAMABLE_FEES_LOCKER_V2,
): Promise<SflStreamSnapshot> {
  try {
    const r = await client.readContract({
      address: sfl,
      abi: SFL_ABI,
      functionName: "streams",
      args: [normalizeBytes32(poolId)],
    });
    const recipient = r[4] as Address;
    const startDate = Number(r[6]);
    const lockDuration = Number(r[7]);
    const isUnlocked = Boolean(r[8]);
    const exists = startDate > 0;
    return {
      exists,
      recipient,
      startDate,
      lockDuration,
      isUnlocked,
      unlockTime: exists ? startDate + lockDuration : undefined,
    };
  } catch {
    return { exists: false };
  }
}

export async function readHookProtocolSnapshot(params: {
  client: PublicClient;
  tokenAddress: string;
  poolId: string;
  hookAddress?: Address;
}): Promise<HookProtocolSnapshot> {
  const errors: string[] = [];
  const hook = params.hookAddress ?? DOPPLER_HOOK_INITIALIZER;
  const token = getAddress(params.tokenAddress) as Address;

  let tokenOwner: string | null = null;
  try {
    tokenOwner = (await params.client.readContract({
      address: token,
      abi: OWNABLE_ABI,
      functionName: "owner",
    })) as string;
  } catch {
    errors.push("token_owner_read_failed");
  }

  const assetData = await readAirlockAssetData(params.client, token);
  if (!assetData) errors.push("airlock_asset_data_unavailable");

  const hookState = await readDopplerHookState(params.client, token, hook);
  if (!hookState) errors.push("hook_state_unavailable");

  let hookPosmNftBalance: bigint | null = null;
  try {
    hookPosmNftBalance = (await params.client.readContract({
      address: POSITION_MANAGER_ADDRESS,
      abi: ERC721_BAL_ABI,
      functionName: "balanceOf",
      args: [hook],
    })) as bigint;
  } catch {
    errors.push("hook_posm_balance_failed");
  }

  const sfl = await readSflStream(params.client, params.poolId);

  let initializerModuleState: number | null = null;
  let migratorModuleState: number | null = null;
  if (assetData) {
    try {
      initializerModuleState = Number(
        await params.client.readContract({
          address: DOPPLER_AIRLOCK,
          abi: AIRLOCK_ASSET_ABI,
          functionName: "getModuleState",
          args: [getAddress(assetData.poolInitializer) as Address],
        }),
      );
    } catch {
      /* optional */
    }
    try {
      migratorModuleState = Number(
        await params.client.readContract({
          address: DOPPLER_AIRLOCK,
          abi: AIRLOCK_ASSET_ABI,
          functionName: "getModuleState",
          args: [getAddress(assetData.liquidityMigrator) as Address],
        }),
      );
    } catch {
      /* optional */
    }
  }

  return {
    tokenOwner,
    tokenOwnerIsAirlock:
      tokenOwner != null &&
      getAddress(tokenOwner).toLowerCase() === DOPPLER_AIRLOCK.toLowerCase(),
    assetData,
    hookState,
    hookPosmNftBalance,
    sfl,
    initializerModuleState,
    migratorModuleState,
    errors,
  };
}
