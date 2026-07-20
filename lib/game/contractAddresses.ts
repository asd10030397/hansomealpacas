/**
 * Canonical on-chain address resolution for the game suite.
 * No superseded deployment addresses as silent runtime fallbacks.
 */

import { getAddress, type Address, isAddress, zeroAddress } from "viem";
import {
  assertGameNetworkConfig,
  isGameMainnetMode,
} from "@/lib/game/gameNetwork";

/** Known superseded Testnet deployments — must not appear as active runtime fallbacks. */
export const SUPERSEDED_TESTNET_ADDRESSES = [
  "0x7b2ce5ECD270Ce55Ac94aCe3BF12d83ef113D0a0", // old HansomeGame default
  "0xa807b2E830B6ED9Fb2ECc215eC995C4dD0F736B5", // pre-batch Production game
  "0xa67f13E39647b680FDa816c011a313f979F89212", // old RewardDistributor
  "0x0C7ADF857687b3034C1f88cA2b357A4461D1BbbD", // older game suite
  "0x20B85Dbb124EA69119dDe3D467e92a6a244A51C0",
  "0x1F41a223b883520b61743FEF7a2a8541cfABf8D4",
  "0x4752E3c8D885A14CEfF0b30aE10a243eCC05b450",
  "0x00ba30dFf570367136471aF8F9EF910BB0C81B60",
] as const;

/**
 * Live canonical Robinhood Testnet suite — forbidden when Mainnet mode (4663).
 * Source: docs/GAME_RUNTIME_ADDRESSES.md / robinhoodTestnet-game.json
 */
export const CANONICAL_TESTNET_SUITE_ADDRESSES = [
  "0x92C8e9CCF67e533438bCCE258D4bEEc6E0559FC5", // HansomeGame
  "0x43c1d6aF194A796EC612F2bAC04085a409A1347C", // Genesis NFT
  "0x7Fb2437542041AbaC22E0A88dF2e0A9c3346e1d2", // RewardDistributor
  "0x45F9FFaC891e06E83a5A315E4fE1B55E5b6b438F", // GameRandomness
] as const;

export const SUPERSEDED_ADDRESS_SET = new Set(
  SUPERSEDED_TESTNET_ADDRESSES.map((a) => a.toLowerCase()),
);

export const CANONICAL_TESTNET_SUITE_SET = new Set(
  CANONICAL_TESTNET_SUITE_ADDRESSES.map((a) => a.toLowerCase()),
);

export function isSupersededContractAddress(
  value: string | null | undefined,
): boolean {
  if (!value || !isAddress(value)) return false;
  return SUPERSEDED_ADDRESS_SET.has(value.toLowerCase());
}

export function isCanonicalTestnetSuiteAddress(
  value: string | null | undefined,
): boolean {
  if (!value || !isAddress(value)) return false;
  return CANONICAL_TESTNET_SUITE_SET.has(value.toLowerCase());
}

export type AddressResolveResult =
  | { ok: true; address: Address }
  | { ok: false; error: string };

/**
 * Read NEXT_PUBLIC_* via static property access so Next.js can inline them
 * into the client bundle. Dynamic `process.env[key]` is undefined in the browser.
 */
function readPublicEnv(key: string): string {
  switch (key) {
    case "NEXT_PUBLIC_HANSOME_GAME_ADDRESS":
      return process.env.NEXT_PUBLIC_HANSOME_GAME_ADDRESS?.trim() || "";
    case "NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS":
      return process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS?.trim() || "";
    case "NEXT_PUBLIC_HANSOME_GENESIS_ADDRESS":
      return process.env.NEXT_PUBLIC_HANSOME_GENESIS_ADDRESS?.trim() || "";
    case "NEXT_PUBLIC_GENESIS_NFT_ADDRESS":
      return process.env.NEXT_PUBLIC_GENESIS_NFT_ADDRESS?.trim() || "";
    case "NEXT_PUBLIC_RANDOMNESS_ADDRESS":
      return process.env.NEXT_PUBLIC_RANDOMNESS_ADDRESS?.trim() || "";
    default:
      return "";
  }
}

/**
 * Resolve a contract address from env candidates (first non-empty wins).
 * Fail closed: missing, invalid, zero, or superseded → error (no silent fallback).
 */
export function resolveConfiguredAddress(
  envKeys: readonly string[],
  label: string,
): AddressResolveResult {
  let raw = "";
  for (const key of envKeys) {
    const v = readPublicEnv(key);
    if (v) {
      raw = v;
      break;
    }
  }
  if (!raw) {
    return {
      ok: false,
      error: `${label} address missing. Set ${envKeys[0]}.`,
    };
  }
  if (!isAddress(raw)) {
    return {
      ok: false,
      error: `${label} address invalid: ${raw}`,
    };
  }
  const address = getAddress(raw);
  if (address === zeroAddress) {
    return {
      ok: false,
      error: `${label} address must not be the zero address.`,
    };
  }
  if (isSupersededContractAddress(address)) {
    return {
      ok: false,
      error: `${label} address ${address} is a superseded deployment. Use the canonical suite address.`,
    };
  }
  return { ok: true, address };
}

export function resolveOptionalConfiguredAddress(
  envKeys: readonly string[],
  label: string,
): Address | null {
  const hasAny = envKeys.some((k) => Boolean(readPublicEnv(k)));
  if (!hasAny) return null;
  const resolved = resolveConfiguredAddress(envKeys, label);
  if (!resolved.ok) return null;
  return resolved.address;
}

/** Canonical env keys for HansomeGame. */
export const GAME_ADDRESS_ENV_KEYS = [
  "NEXT_PUBLIC_HANSOME_GAME_ADDRESS",
] as const;

/** Canonical env keys for RewardDistributor. */
export const DISTRIBUTOR_ADDRESS_ENV_KEYS = [
  "NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS",
] as const;

/** Canonical env keys for Genesis NFT (prefer HANSOME_GENESIS, accept legacy GENESIS_NFT). */
export const GENESIS_ADDRESS_ENV_KEYS = [
  "NEXT_PUBLIC_HANSOME_GENESIS_ADDRESS",
  "NEXT_PUBLIC_GENESIS_NFT_ADDRESS",
] as const;

/** Optional randomness address when runtime needs it. */
export const RANDOMNESS_ADDRESS_ENV_KEYS = [
  "NEXT_PUBLIC_RANDOMNESS_ADDRESS",
] as const;

export function resolveHansomeGameAddress(): AddressResolveResult {
  return resolveConfiguredAddress(GAME_ADDRESS_ENV_KEYS, "HansomeGame");
}

export function resolveRewardDistributorAddress(): AddressResolveResult {
  return resolveConfiguredAddress(
    DISTRIBUTOR_ADDRESS_ENV_KEYS,
    "RewardDistributor",
  );
}

export function resolveGenesisNftAddress(): AddressResolveResult {
  return resolveConfiguredAddress(GENESIS_ADDRESS_ENV_KEYS, "Genesis NFT");
}

export function resolveRandomnessAddress(): Address | null {
  return resolveOptionalConfiguredAddress(
    RANDOMNESS_ADDRESS_ENV_KEYS,
    "GameRandomness",
  );
}

function rejectTestnetSuiteOnMainnet(
  label: string,
  address: Address,
): void {
  if (isCanonicalTestnetSuiteAddress(address)) {
    throw new Error(
      `[hansome] Mainnet mode must not use Testnet ${label} address ${address}.`,
    );
  }
}

/**
 * Production fail-closed check for Vercel Production and Mainnet cutover.
 * Skips local `next build` / Preview unless chain is Mainnet (4663).
 */
export function assertProductionGameAddresses(): void {
  const isVercelProduction = process.env.VERCEL_ENV === "production";
  const isMainnetGame = isGameMainnetMode();
  if (!isVercelProduction && !isMainnetGame) return;

  assertGameNetworkConfig();

  const game = resolveHansomeGameAddress();
  if (!game.ok) {
    throw new Error(`[hansome] ${game.error}`);
  }
  const genesis = resolveGenesisNftAddress();
  if (!genesis.ok) {
    throw new Error(`[hansome] ${genesis.error}`);
  }

  if (isMainnetGame) {
    rejectTestnetSuiteOnMainnet("HansomeGame", game.address);
    rejectTestnetSuiteOnMainnet("Genesis NFT", genesis.address);

    const distributor = resolveRewardDistributorAddress();
    if (!distributor.ok) {
      throw new Error(`[hansome] ${distributor.error}`);
    }
    rejectTestnetSuiteOnMainnet("RewardDistributor", distributor.address);

    const randomness = resolveRandomnessAddress();
    if (!randomness) {
      throw new Error(
        "[hansome] Mainnet mode requires NEXT_PUBLIC_RANDOMNESS_ADDRESS.",
      );
    }
    rejectTestnetSuiteOnMainnet("GameRandomness", randomness);

    if (isSupersededContractAddress(game.address)) {
      throw new Error(
        `[hansome] Mainnet game address must not be a superseded Testnet deployment.`,
      );
    }
  }
}
