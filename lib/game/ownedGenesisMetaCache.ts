/**
 * Module-level Genesis NFT metadata cache shared by every useOwnedGenesisNfts()
 * instance (Commit, My NFTs, rewards, etc.).
 *
 * Entries are keyed by tokenId and fingerprinted by on-chain URI + reveal flag
 * so NFT Reveal / baseURI changes cannot leave stale identity in memory.
 */

import type { GenesisMetadataIdentity } from "@/lib/game/genesisNftReveal";

export type OwnedGenesisMetaEntry = {
  image: string;
  name?: string;
  identity?: GenesisMetadataIdentity | null;
  /** Fingerprint of sources used when this entry was fetched. */
  sourceKey: string;
};

const cache = new Map<number, OwnedGenesisMetaEntry>();
let metaEpoch = 0;
const metaListeners = new Set<() => void>();

/** Bumped when ownership/inventory must be re-queried (mint, wallet, focus…). */
let inventoryRevision = 0;
const inventoryListeners = new Set<() => void>();

function publishMeta(): void {
  metaEpoch += 1;
  for (const listener of metaListeners) listener();
}

function publishInventory(): void {
  inventoryRevision += 1;
  for (const listener of inventoryListeners) listener();
}

/** Stable key so placeholder → revealed URI (or isRevealed flip) invalidates. */
export function ownedGenesisMetaSourceKey(
  tokenUri: string,
  onChainRevealed: boolean,
): string {
  return `${tokenUri}\0${onChainRevealed ? "1" : "0"}`;
}

export function subscribeOwnedGenesisMeta(onChange: () => void): () => void {
  metaListeners.add(onChange);
  return () => {
    metaListeners.delete(onChange);
  };
}

export function getOwnedGenesisMetaEpoch(): number {
  return metaEpoch;
}

export function getServerOwnedGenesisMetaEpoch(): number {
  return 0;
}

export function subscribeOwnedGenesisInventory(onChange: () => void): () => void {
  inventoryListeners.add(onChange);
  return () => {
    inventoryListeners.delete(onChange);
  };
}

export function getOwnedGenesisInventoryRevision(): number {
  return inventoryRevision;
}

export function getServerOwnedGenesisInventoryRevision(): number {
  return 0;
}

export function getOwnedGenesisMeta(
  tokenId: number,
): OwnedGenesisMetaEntry | undefined {
  return cache.get(tokenId);
}

export function hasFreshOwnedGenesisMeta(
  tokenId: number,
  sourceKey: string,
): boolean {
  const entry = cache.get(tokenId);
  return entry != null && entry.sourceKey === sourceKey;
}

export function setOwnedGenesisMeta(
  tokenId: number,
  entry: OwnedGenesisMetaEntry,
): void {
  cache.set(tokenId, entry);
}

export function publishOwnedGenesisMeta(): void {
  publishMeta();
}

/** Drop cached metadata (all tokens, or a subset). */
export function invalidateOwnedGenesisMeta(tokenIds?: readonly number[]): void {
  if (tokenIds == null) {
    cache.clear();
  } else {
    for (const tokenId of tokenIds) cache.delete(tokenId);
  }
  publishMeta();
}

/**
 * Clear metadata and notify mounted hooks to refetch chain ownership/details.
 * Use after mint, wallet/account/chain changes, or returning to the tab.
 */
export function refreshOwnedGenesisInventory(tokenIds?: readonly number[]): void {
  invalidateOwnedGenesisMeta(tokenIds);
  publishInventory();
}

/** @internal vitest */
export function __resetOwnedGenesisMetaCacheForTests(): void {
  cache.clear();
  metaEpoch = 0;
  inventoryRevision = 0;
}
