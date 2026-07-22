import { describe, expect, it } from "vitest";
import {
  MAINNET_SUITE,
  TESTNET_SUITE,
  assertAllowedFunction,
  assertNoCrossNetworkAddresses,
  assertProfileChain,
  checksum,
} from "../src/safety/guards.js";
import { MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "../src/chain/phase.js";

describe("safety guards", () => {
  it("allowlists only settlement functions", () => {
    expect(() => assertAllowedFunction("finalizeDay")).not.toThrow();
    expect(() => assertAllowedFunction("creditBatch")).not.toThrow();
    expect(() => assertAllowedFunction("fulfillDaySeed")).not.toThrow();
    expect(() => assertAllowedFunction("withdraw")).toThrow(/forbidden/i);
    expect(() => assertAllowedFunction("transferOwnership")).toThrow(/forbidden/i);
  });

  it("rejects wrong profile chain", () => {
    expect(() => assertProfileChain("testnet", TESTNET_CHAIN_ID)).not.toThrow();
    expect(() => assertProfileChain("mainnet", MAINNET_CHAIN_ID)).not.toThrow();
    expect(() => assertProfileChain("mainnet", TESTNET_CHAIN_ID)).toThrow(/REFUSED/);
  });

  it("rejects testnet addresses on mainnet", () => {
    expect(() =>
      assertNoCrossNetworkAddresses({
        profile: "mainnet",
        game: checksum(TESTNET_SUITE.game),
        randomness: checksum(TESTNET_SUITE.randomness),
      }),
    ).toThrow(/Testnet suite/);
  });

  it("rejects mainnet addresses on testnet", () => {
    expect(() =>
      assertNoCrossNetworkAddresses({
        profile: "testnet",
        game: checksum(MAINNET_SUITE.game),
        randomness: checksum(MAINNET_SUITE.randomness),
      }),
    ).toThrow(/Mainnet suite/);
  });

  it("accepts canonical mainnet suite", () => {
    expect(() =>
      assertNoCrossNetworkAddresses({
        profile: "mainnet",
        game: checksum(MAINNET_SUITE.game),
        randomness: checksum(MAINNET_SUITE.randomness),
      }),
    ).not.toThrow();
  });
});
