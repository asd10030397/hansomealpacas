/**
 * Allowlisted Doppler / Airlock module addresses — Robinhood Chain 4663.
 * Do not trust arbitrary contracts that implement the same ABI.
 */

import { getAddress, type Address } from "viem";
import { AIRLOCK_ADDRESS } from "@/lib/hansome-score/lp/v4-ownership-class";

export const DOPPLER_HOOK_INITIALIZER = getAddress(
  "0x4e3468951D49f2EEa976eD0D6e75fFCb44a9a544",
) as Address;

export const REHYPE_DOPPLER_HOOK = getAddress(
  "0x6f02324d20CC679d0E585290CAa6b16baCbC0F77",
) as Address;

export const NOOP_MIGRATOR = getAddress(
  "0xba2F330EDb16cD8056f5988d8CE19BbC63475A0e",
) as Address;

export const DOPPLER_HOOK_MIGRATOR = getAddress(
  "0x7bf319d8e969f7596b1bc171da9ce322f67ae0c4",
) as Address;

export const STREAMABLE_FEES_LOCKER_V2 = getAddress(
  "0x7b6147ac3f615bdb764e7ebd5f517dac1ad163b8",
) as Address;

export const DEAD_ADDRESS = getAddress(
  "0x000000000000000000000000000000000000dEaD",
) as Address;

export const DOPPLER_AIRLOCK = AIRLOCK_ADDRESS;

/** Allowlisted PoolInitializer modules for Hook principal lock claims. */
export const DOPPLER_POOL_INITIALIZER_REGISTRY: ReadonlySet<string> = new Set(
  [DOPPLER_HOOK_INITIALIZER].map((a) => a.toLowerCase()),
);

export const DOPPLER_NOOP_MIGRATOR_REGISTRY: ReadonlySet<string> = new Set(
  [NOOP_MIGRATOR].map((a) => a.toLowerCase()),
);

export const DOPPLER_HOOK_MIGRATOR_REGISTRY: ReadonlySet<string> = new Set(
  [DOPPLER_HOOK_MIGRATOR].map((a) => a.toLowerCase()),
);

export const DOPPLER_SFL_REGISTRY: ReadonlySet<string> = new Set(
  [STREAMABLE_FEES_LOCKER_V2].map((a) => a.toLowerCase()),
);

export function isAllowlistedPoolInitializer(addr: string | null | undefined): boolean {
  if (!addr) return false;
  try {
    return DOPPLER_POOL_INITIALIZER_REGISTRY.has(getAddress(addr).toLowerCase());
  } catch {
    return false;
  }
}

export function isAllowlistedNoOpMigrator(addr: string | null | undefined): boolean {
  if (!addr) return false;
  try {
    return DOPPLER_NOOP_MIGRATOR_REGISTRY.has(getAddress(addr).toLowerCase());
  } catch {
    return false;
  }
}

export function isAllowlistedHookMigrator(addr: string | null | undefined): boolean {
  if (!addr) return false;
  try {
    return DOPPLER_HOOK_MIGRATOR_REGISTRY.has(getAddress(addr).toLowerCase());
  } catch {
    return false;
  }
}

export function isDeadAddress(addr: string | null | undefined): boolean {
  if (!addr) return false;
  try {
    return getAddress(addr).toLowerCase() === DEAD_ADDRESS.toLowerCase();
  } catch {
    return false;
  }
}

/** PoolStatus on DopplerHookInitializer. */
export const HOOK_POOL_STATUS = {
  Uninitialized: 0,
  Initialized: 1,
  Locked: 2,
  Graduated: 3,
  Exited: 4,
} as const;

export type HookPoolStatusName =
  | "Uninitialized"
  | "Initialized"
  | "Locked"
  | "Graduated"
  | "Exited"
  | "Unknown";

export function hookPoolStatusName(status: number | null | undefined): HookPoolStatusName {
  switch (status) {
    case 0:
      return "Uninitialized";
    case 1:
      return "Initialized";
    case 2:
      return "Locked";
    case 3:
      return "Graduated";
    case 4:
      return "Exited";
    default:
      return "Unknown";
  }
}
