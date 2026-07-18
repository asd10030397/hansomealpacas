import { formatEther, type Address } from "viem";
import {
  GENESIS_COLLECTION_NAME,
  GENESIS_SUPPLY,
} from "@/lib/game/genesis";
import type { MintSaleState } from "@/types/game";

export type GenesisOnchainSnapshot = {
  name?: string;
  totalMinted: bigint;
  saleMinted: bigint;
  mintPrice: bigint;
  publicStart: bigint;
  isWhitelistOpen: boolean;
  isPublicOpen: boolean;
  reservedMinted: boolean;
  royaltyBps: number;
  /** Wallet-specific; null when disconnected. */
  whitelistMintCount: number | null;
  publicMintCount: number | null;
  /** null = unknown (no proof source / disconnected). */
  whitelistEligible: boolean | null;
};

export function deriveMintPhase(snapshot: {
  saleMinted: bigint;
  isWhitelistOpen: boolean;
  isPublicOpen: boolean;
}): MintSaleState["phase"] {
  if (snapshot.saleMinted >= BigInt(GENESIS_SUPPLY.whitelist + GENESIS_SUPPLY.public)) {
    return "SoldOut";
  }
  if (snapshot.isPublicOpen) return "Public";
  if (snapshot.isWhitelistOpen) return "Whitelist";
  return "Upcoming";
}

export function buildMintSaleState(snapshot: GenesisOnchainSnapshot): MintSaleState {
  const phase = deriveMintPhase(snapshot);
  const price = formatEther(snapshot.mintPrice);
  const mintPriceLabel =
    snapshot.mintPrice === 0n ? `${price} ETH` : `${trimEther(price)} ETH`;

  return {
    collectionName: snapshot.name?.trim() || GENESIS_COLLECTION_NAME,
    totalSupply: GENESIS_SUPPLY.total,
    alpacaCount: GENESIS_SUPPLY.alpaca,
    cougarCount: GENESIS_SUPPLY.cougar,
    reservedCount: GENESIS_SUPPLY.reserved,
    whitelistCap: GENESIS_SUPPLY.whitelist,
    publicCap: GENESIS_SUPPLY.public,
    minted: Number(snapshot.totalMinted),
    phase,
    mintPriceLabel,
    whitelistEligible: snapshot.whitelistEligible,
    royaltyBps: snapshot.royaltyBps,
    wlWalletMax: GENESIS_SUPPLY.wlWalletMax,
    publicWalletMax: GENESIS_SUPPLY.publicWalletMax,
    combinedWalletMax: GENESIS_SUPPLY.combinedWalletMax,
  };
}

function trimEther(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
}

/** Optional local WL proofs keyed by checksum/lowercase address. */
export type WhitelistProofMap = Record<string, `0x${string}`[]>;

export function lookupWhitelistProof(
  address: Address | undefined,
  proofs: WhitelistProofMap | null | undefined,
): `0x${string}`[] | null {
  if (!address || !proofs) return null;
  const direct = proofs[address] ?? proofs[address.toLowerCase()];
  return direct ?? null;
}
