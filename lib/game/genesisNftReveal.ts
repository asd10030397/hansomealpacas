/**
 * Genesis NFT Reveal policy (collection identity), distinct from gameplay Reveal Move.
 *
 * Testnet: immediate NFT Reveal for faster QA (metadata-backed identity).
 * Mainnet: production schedule — wait for on-chain collection reveal.
 */

import { ROBINHOOD_CHAIN_ID, ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/chain";
import { GENESIS_CHAIN_ID } from "@/lib/game/genesis";
import type { GameplayClass, NftSide } from "@/types/game";

/**
 * Env override:
 * - NEXT_PUBLIC_GENESIS_IMMEDIATE_NFT_REVEAL=1 → force on
 * - NEXT_PUBLIC_GENESIS_IMMEDIATE_NFT_REVEAL=0 → force off
 * Default: enabled only on Robinhood Testnet (46630).
 */
export function isImmediateGenesisNftRevealEnabled(
  chainId: number = GENESIS_CHAIN_ID,
): boolean {
  const raw = process.env.NEXT_PUBLIC_GENESIS_IMMEDIATE_NFT_REVEAL?.trim();
  if (raw === "1" || raw?.toLowerCase() === "true") return true;
  if (raw === "0" || raw?.toLowerCase() === "false") return false;
  // Never default-on for mainnet.
  if (chainId === ROBINHOOD_CHAIN_ID) return false;
  return chainId === ROBINHOOD_TESTNET_CHAIN_ID;
}

export type GenesisMetadataIdentity = {
  side: NftSide;
  gameplayClass: GameplayClass;
};

type Attr = { trait_type?: string; value?: string | number };

export function parseGenesisMetadataIdentity(json: unknown): GenesisMetadataIdentity | null {
  if (!json || typeof json !== "object") return null;
  const attrs = (json as { attributes?: Attr[] }).attributes;
  if (!Array.isArray(attrs)) return null;

  let side: NftSide = "Unknown";
  let gameplayClass: GameplayClass = "None";

  for (const a of attrs) {
    const key = String(a.trait_type ?? "").toLowerCase();
    const value = String(a.value ?? "");
    if (key === "side") {
      if (/alpaca/i.test(value)) side = "Alpaca";
      else if (/cougar/i.test(value)) side = "Cougar";
    }
    if (key === "gameplay class" || key === "class") {
      const v = value.trim();
      if (/^common$/i.test(v)) gameplayClass = "Common";
      else if (/^guardian$/i.test(v)) gameplayClass = "Guardian";
      else if (/^farmer$/i.test(v)) gameplayClass = "Farmer";
      else if (/^lucky$/i.test(v)) gameplayClass = "Lucky";
      else if (/^runner$/i.test(v)) gameplayClass = "Runner";
      else if (/^king$/i.test(v)) gameplayClass = "King";
      else if (/^none$/i.test(v) || !v) gameplayClass = "None";
    }
  }

  if (side === "Unknown") return null;
  if (side === "Cougar") gameplayClass = "None";
  return { side, gameplayClass };
}

/**
 * Shared reveal flag used by My NFTs and Commit (via useOwnedGenesisNfts).
 * On Testnet immediate NFT Reveal, metadata identity counts as revealed even
 * when on-chain `isRevealed` is still false.
 */
export function resolveOwnedGenesisRevealFlags(input: {
  onChainRevealed: boolean;
  metaIdentity: GenesisMetadataIdentity | null | undefined;
  immediateNftReveal: boolean;
}): { revealed: boolean; useMetaReveal: boolean } {
  const useMetaReveal =
    input.immediateNftReveal &&
    !input.onChainRevealed &&
    input.metaIdentity != null;
  return {
    useMetaReveal,
    revealed: input.onChainRevealed || useMetaReveal,
  };
}

/** Inventory must stay loading until every owned token has a meta cache entry. */
export function isOwnedGenesisMetaIncomplete(
  ownedIds: readonly number[],
  hasMeta: (tokenId: number) => boolean,
): boolean {
  return ownedIds.length > 0 && ownedIds.some((tokenId) => !hasMeta(tokenId));
}
