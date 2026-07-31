import { getAddress } from "viem";
import { OFFICIAL_WALLETS } from "@/content/transparency";
import {
  BURN_ADDRESSES,
  HANSOME_TOKEN,
  POOL_MANAGER_ADDRESS,
  TITAN_LOCKER_MANAGER,
} from "@/lib/hansome-score/constants";

const EXTRA_KNOWN: Record<string, string> = {
  [POOL_MANAGER_ADDRESS.toLowerCase()]: "Uniswap v4 PoolManager (AMM liquidity)",
  [TITAN_LOCKER_MANAGER.toLowerCase()]: "TitanLockerManagerV2",
  "0x4a50761042e321f214b6b6c2920f9ea1c5533828": "Titan child locker (Position NFT escrow)",
  "0x96eb6d545ce877115e83273293ec22bc8d2336cf": "GameTreasury",
};

export function knownWalletLabel(address: string, tokenAddress: string): string | undefined {
  const lc = address.toLowerCase();
  if (BURN_ADDRESSES.has(lc)) return "Burn address";

  if (lc === POOL_MANAGER_ADDRESS.toLowerCase()) {
    return EXTRA_KNOWN[lc];
  }

  // Only apply project official wallet labels when scanning HANSOME itself.
  try {
    if (getAddress(tokenAddress) === HANSOME_TOKEN) {
      const official = OFFICIAL_WALLETS.find((w) => w.address.toLowerCase() === lc);
      if (official) return `${official.title} (official)`;
      if (EXTRA_KNOWN[lc]) return EXTRA_KNOWN[lc];
    }
  } catch {
    /* ignore bad address */
  }

  return EXTRA_KNOWN[lc];
}

export function shouldExcludeFromConcentration(address: string, label?: string): boolean {
  const lc = address.toLowerCase();
  if (BURN_ADDRESSES.has(lc)) return true;
  if (lc === POOL_MANAGER_ADDRESS.toLowerCase()) return true;
  if (label?.toLowerCase().includes("amm liquidity")) return true;
  return false;
}

/**
 * Transparency lock metadata — labels / corroboration only.
 * Must NOT grant LOCKED Score credit without generic on-chain ownerOf + locker registry check.
 */
export function transparencyLockHint(): {
  positionNftId: string | null;
  lockerAddress: string | null;
  unlockDate: string | null;
  lockTxUrl: string | null;
} {
  const liquidity = OFFICIAL_WALLETS.find((w) => w.id === "liquidity");
  const nft = liquidity?.positionNft?.replace("#", "") ?? null;
  return {
    positionNftId: nft,
    lockerAddress: liquidity?.lock?.lockerAddress ?? null,
    unlockDate: liquidity?.lock?.unlockDate ?? null,
    lockTxUrl: liquidity?.lock?.lockTxUrl ?? null,
  };
}

/** Hint addresses for Titan discovery (official wallets) — discovery still uses generic adapter. */
export function transparencyHintAddresses(tokenAddress: string): string[] {
  try {
    if (getAddress(tokenAddress) !== HANSOME_TOKEN) return [];
  } catch {
    return [];
  }
  return OFFICIAL_WALLETS.map((w) => w.address);
}

/**
 * Discovery seeds for known Position NFTs (HANSOME ops inventory).
 * Seeds enable completeness checks — they do NOT grant LOCKED Score credit.
 */
export function knownPositionSeeds(tokenAddress: string): bigint[] {
  try {
    if (getAddress(tokenAddress) !== HANSOME_TOKEN) return [];
  } catch {
    return [];
  }
  // Imported lazily-shaped constants to avoid circular deps in labels
  return [47299n, 357867n, 142938n];
}
