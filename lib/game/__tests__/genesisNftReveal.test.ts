import { describe, expect, it } from "vitest";
import { ROBINHOOD_CHAIN_ID, ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/chain";
import {
  isImmediateGenesisNftRevealEnabled,
  isOwnedGenesisMetaIncomplete,
  parseGenesisMetadataIdentity,
  resolveOwnedGenesisRevealFlags,
} from "@/lib/game/genesisNftReveal";

describe("genesis NFT Reveal policy", () => {
  it("defaults on for Robinhood Testnet and off for Mainnet", () => {
    const prev = process.env.NEXT_PUBLIC_GENESIS_IMMEDIATE_NFT_REVEAL;
    delete process.env.NEXT_PUBLIC_GENESIS_IMMEDIATE_NFT_REVEAL;
    expect(isImmediateGenesisNftRevealEnabled(ROBINHOOD_TESTNET_CHAIN_ID)).toBe(true);
    expect(isImmediateGenesisNftRevealEnabled(ROBINHOOD_CHAIN_ID)).toBe(false);
    process.env.NEXT_PUBLIC_GENESIS_IMMEDIATE_NFT_REVEAL = prev;
  });

  it("respects explicit env override", () => {
    const prev = process.env.NEXT_PUBLIC_GENESIS_IMMEDIATE_NFT_REVEAL;
    process.env.NEXT_PUBLIC_GENESIS_IMMEDIATE_NFT_REVEAL = "0";
    expect(isImmediateGenesisNftRevealEnabled(ROBINHOOD_TESTNET_CHAIN_ID)).toBe(false);
    process.env.NEXT_PUBLIC_GENESIS_IMMEDIATE_NFT_REVEAL = "1";
    expect(isImmediateGenesisNftRevealEnabled(ROBINHOOD_CHAIN_ID)).toBe(true);
    process.env.NEXT_PUBLIC_GENESIS_IMMEDIATE_NFT_REVEAL = prev;
  });

  it("parses Side and Gameplay Class from metadata", () => {
    expect(
      parseGenesisMetadataIdentity({
        attributes: [
          { trait_type: "Side", value: "Alpaca" },
          { trait_type: "Gameplay Class", value: "Guardian" },
        ],
      }),
    ).toEqual({ side: "Alpaca", gameplayClass: "Guardian" });

    expect(
      parseGenesisMetadataIdentity({
        attributes: [{ trait_type: "Side", value: "Cougar" }],
      }),
    ).toEqual({ side: "Cougar", gameplayClass: "None" });
  });

  it("does not mark sale NFTs revealed until metadata identity exists (Commit empty-state bug)", () => {
    expect(
      resolveOwnedGenesisRevealFlags({
        onChainRevealed: false,
        metaIdentity: null,
        immediateNftReveal: true,
      }),
    ).toEqual({ revealed: false, useMetaReveal: false });

    expect(
      resolveOwnedGenesisRevealFlags({
        onChainRevealed: false,
        metaIdentity: { side: "Alpaca", gameplayClass: "Guardian" },
        immediateNftReveal: true,
      }),
    ).toEqual({ revealed: true, useMetaReveal: true });
  });

  it("keeps inventory loading while any owned token lacks meta cache", () => {
    const cache = new Map<number, true>([[1, true], [2, true]]);
    expect(isOwnedGenesisMetaIncomplete([1, 2, 3], (id) => cache.has(id))).toBe(true);
    cache.set(3, true);
    expect(isOwnedGenesisMetaIncomplete([1, 2, 3], (id) => cache.has(id))).toBe(false);
    expect(isOwnedGenesisMetaIncomplete([], (id) => cache.has(id))).toBe(false);
  });
});
