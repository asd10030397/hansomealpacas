/**
 * Testnet-only gameplay trait deck (mirrors HansomeGame._testnetAssigned).
 * Used so the UI can show Species/Class/Abilities before Genesis collection reveal.
 * Mainnet never reads this file for identity.
 */

import { GAME_CHAIN_ID } from "@/lib/game/hansomeGame";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/chain";
import { abilityLabelFor } from "@/lib/game/genesisIdentity";
import type { GameplayClass, NftSide } from "@/types/game";
import assignedJson from "@/lib/game/data/testnetAssigned540.json";

const FIRST_SALE_ID = 11;
const LAST_TOKEN_ID = 550;

const CLASS_BY_NIBBLE: GameplayClass[] = [
  "None",
  "Common",
  "Guardian",
  "Farmer",
  "Lucky",
  "Runner",
  "King",
];

export function isTestnetGameplayTraitsEnabled(
  chainId: number = GAME_CHAIN_ID,
): boolean {
  if (chainId !== ROBINHOOD_TESTNET_CHAIN_ID) return false;
  const flag = process.env.NEXT_PUBLIC_TESTNET_GAMEPLAY_TRAITS?.trim();
  if (flag === "0" || flag === "false") return false;
  return true;
}

export type TestnetGameplayIdentity = {
  side: NftSide;
  gameplayClass: GameplayClass;
  ability: string;
  source: "testnet-deck";
};

function unpack(packed: number): { side: NftSide; gameplayClass: GameplayClass } {
  const isCougar = (packed & 0x80) !== 0;
  const cls = packed & 0x0f;
  if (isCougar) return { side: "Cougar", gameplayClass: "None" };
  return {
    side: "Alpaca",
    gameplayClass: CLASS_BY_NIBBLE[cls] ?? "Common",
  };
}

/** Sale tokens #11..#550 — same FY deck as on-chain testnetGameplayUnlock. */
export function getTestnetGameplayIdentity(
  tokenId: number,
): TestnetGameplayIdentity | null {
  if (tokenId < FIRST_SALE_ID || tokenId > LAST_TOKEN_ID) return null;
  const assigned = assignedJson.assigned as number[];
  const packed = assigned[tokenId - FIRST_SALE_ID];
  if (packed == null) return null;
  const { side, gameplayClass } = unpack(packed);
  return {
    side,
    gameplayClass,
    ability: abilityLabelFor(side, gameplayClass),
    source: "testnet-deck",
  };
}

/** True when Testnet UI should treat the NFT as playable (Commit / Battle). */
export function isTestnetGameplayReady(input: {
  tokenId: number;
  onChainRevealed: boolean;
}): boolean {
  if (!isTestnetGameplayTraitsEnabled()) return input.onChainRevealed;
  if (input.onChainRevealed) return true;
  // Sale NFTs unlocked via HansomeGame.testnetGameplayUnlock + trait deck.
  if (input.tokenId >= FIRST_SALE_ID && input.tokenId <= LAST_TOKEN_ID) {
    return getTestnetGameplayIdentity(input.tokenId) != null;
  }
  // Reserved #1..#10: playable only once Genesis has revealed them on-chain.
  return false;
}

export const TESTNET_TRAIT_DECK_SAMPLES = {
  revealSeed: assignedJson.revealSeed as string,
  /**
   * QA-densified sale samples (minted range on Testnet).
   * King remains reserved #1 (on-chain Genesis reveal).
   */
  samples: (assignedJson as { samples?: Record<string, number> }).samples ?? {
    "Alpaca:Common": 11,
    "Alpaca:Guardian": 12,
    "Alpaca:Farmer": 13,
    "Alpaca:Lucky": 14,
    "Alpaca:Runner": 15,
    Cougar: 16,
    "Alpaca:King": 1,
  },
} as const;
