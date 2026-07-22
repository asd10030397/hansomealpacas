import { getAddress, isAddress, type Address } from "viem";
import { MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "../chain/phase.js";
import { FORBIDDEN_FUNCTION_NAMES } from "../chain/abis.js";

/** Canonical suite addresses — used for allowlist + cross-network rejection. */
export const TESTNET_SUITE = {
  game: "0x92C8e9CCF67e533438bCCE258D4bEEc6E0559FC5",
  randomness: "0x45F9FFaC891e06E83a5A315E4fE1B55E5b6b438F",
  distributor: "0x7Fb2437542041AbaC22E0A88dF2e0A9c3346e1d2",
  genesis: "0x43c1d6aF194A796EC612F2bAC04085a409A1347C",
} as const;

export const MAINNET_SUITE = {
  game: "0xb8dad421881171f4485523d109C94dc650ecB7Eb",
  randomness: "0x134f3CE4006a04C2C5DaD0E654d1C4228dd15791",
  distributor: "0x0f9683287F91698B84Da4A3A90366a75EaF93520",
  genesis: "0x6eBb78FDB40CF6f6b8B33a235eF321AD15107cb0",
} as const;

export function checksum(addr: string): Address {
  if (!isAddress(addr)) {
    throw new Error(`Invalid address: ${addr}`);
  }
  return getAddress(addr);
}

export function assertAllowedFunction(functionName: string): void {
  const lower = functionName.toLowerCase();
  for (const banned of FORBIDDEN_FUNCTION_NAMES) {
    if (lower === banned.toLowerCase()) {
      throw new Error(`REFUSED: forbidden function ${functionName}`);
    }
  }
  const allowed = new Set([
    "fulfilldayseed",
    "finalizeday",
    "creditbatch",
  ]);
  if (!allowed.has(lower)) {
    throw new Error(`REFUSED: function not on allowlist: ${functionName}`);
  }
}

export function assertChainId(expected: number, actual: number): void {
  if (expected !== actual) {
    throw new Error(
      `REFUSED: wrong chainId — expected ${expected}, got ${actual}`,
    );
  }
}

export function assertNoCrossNetworkAddresses(input: {
  profile: "testnet" | "mainnet";
  game: Address;
  randomness: Address;
}): void {
  const g = input.game.toLowerCase();
  const r = input.randomness.toLowerCase();

  if (input.profile === "mainnet") {
    for (const a of Object.values(TESTNET_SUITE)) {
      if (g === a.toLowerCase() || r === a.toLowerCase()) {
        throw new Error(
          `REFUSED: Testnet suite address configured on Mainnet worker (${a})`,
        );
      }
    }
    if (g !== MAINNET_SUITE.game.toLowerCase()) {
      throw new Error(
        `REFUSED: Mainnet game address must be ${MAINNET_SUITE.game} (got ${input.game})`,
      );
    }
    if (r !== MAINNET_SUITE.randomness.toLowerCase()) {
      throw new Error(
        `REFUSED: Mainnet randomness address must be ${MAINNET_SUITE.randomness} (got ${input.randomness})`,
      );
    }
  }

  if (input.profile === "testnet") {
    for (const a of Object.values(MAINNET_SUITE)) {
      if (g === a.toLowerCase() || r === a.toLowerCase()) {
        throw new Error(
          `REFUSED: Mainnet suite address configured on Testnet worker (${a})`,
        );
      }
    }
  }
}

export function assertProfileChain(
  profile: "testnet" | "mainnet",
  chainId: number,
): void {
  if (profile === "testnet" && chainId !== TESTNET_CHAIN_ID) {
    throw new Error(
      `REFUSED: testnet profile requires chainId ${TESTNET_CHAIN_ID}, got ${chainId}`,
    );
  }
  if (profile === "mainnet" && chainId !== MAINNET_CHAIN_ID) {
    throw new Error(
      `REFUSED: mainnet profile requires chainId ${MAINNET_CHAIN_ID}, got ${chainId}`,
    );
  }
}

export function assertFeeCap(input: {
  maxFeePerGasWei: bigint | null;
  quoteMaxFeePerGas: bigint | null;
}): void {
  if (input.maxFeePerGasWei == null || input.quoteMaxFeePerGas == null) return;
  if (input.quoteMaxFeePerGas > input.maxFeePerGasWei) {
    throw new Error(
      `REFUSED: maxFeePerGas ${input.quoteMaxFeePerGas} exceeds cap ${input.maxFeePerGasWei}`,
    );
  }
}
