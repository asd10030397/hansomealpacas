/**
 * Mainnet Game ceremony address / token / dayZero guards.
 * Never logs private keys.
 */

import { getAddress, isAddress } from "ethers";

export const CANONICAL_MAINNET_HANSOME =
  "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875";

/**
 * Known Robinhood Testnet suite + superseded Testnet deployments.
 * Must never be used as Mainnet Genesis / game / distributor / randomness / token.
 */
export const FORBIDDEN_TESTNET_CONTRACT_ADDRESSES = [
  // Canonical live Testnet suite (docs/GAME_RUNTIME_ADDRESSES.md)
  "0x92C8e9CCF67e533438bCCE258D4bEEc6E0559FC5", // HansomeGame
  "0x43c1d6aF194A796EC612F2bAC04085a409A1347C", // Genesis NFT
  "0x7Fb2437542041AbaC22E0A88dF2e0A9c3346e1d2", // RewardDistributor
  "0x45F9FFaC891e06E83a5A315E4fE1B55E5b6b438F", // GameRandomness
  // Superseded Testnet deployments
  "0x7b2ce5ECD270Ce55Ac94aCe3BF12d83ef113D0a0",
  "0xa807b2E830B6ED9Fb2ECc215eC995C4dD0F736B5",
  "0xa67f13E39647b680FDa816c011a313f979F89212",
  "0x0C7ADF857687b3034C1f88cA2b357A4461D1BbbD",
  "0x20B85Dbb124EA69119dDe3D467e92a6a244A51C0",
  "0x1F41a223b883520b61743FEF7a2a8541cfABf8D4",
  "0x4752E3c8D885A14CEfF0b30aE10a243eCC05b450",
  "0x00ba30dFf570367136471aF8F9EF910BB0C81B60",
] as const;

const FORBIDDEN_SET = new Set(
  FORBIDDEN_TESTNET_CONTRACT_ADDRESSES.map((a) => a.toLowerCase()),
);

export function isForbiddenTestnetContractAddress(
  value: string | null | undefined,
): boolean {
  if (!value || !isAddress(value)) return false;
  return FORBIDDEN_SET.has(value.toLowerCase());
}

/** Abort if address is a known Testnet / superseded deployment. */
export function assertNotTestnetContractAddress(
  label: string,
  value: string,
): string {
  const addr = getAddress(value);
  if (isForbiddenTestnetContractAddress(addr)) {
    throw new Error(
      `REFUSED: ${label} ${addr} is a known Robinhood Testnet / superseded address. ` +
        `Mainnet Game ceremony must use freshly deployed Mainnet contracts (or Mainnet Genesis JSON).`,
    );
  }
  return addr;
}

/** Abort unless token is canonical Mainnet $HANSOME. */
export function assertCanonicalMainnetHansome(tokenAddress: string): string {
  const addr = getAddress(tokenAddress);
  const canonical = getAddress(CANONICAL_MAINNET_HANSOME);
  if (addr !== canonical) {
    throw new Error(
      `REFUSED: GAME_TOKEN_ADDRESS must be canonical Mainnet $HANSOME ${canonical}. Got ${addr}.`,
    );
  }
  assertNotTestnetContractAddress("GAME_TOKEN_ADDRESS", addr);
  return addr;
}

/**
 * Mainnet requires explicit GAME_DAY_ZERO (unix seconds).
 * Never default to "now" / computed commit window.
 */
export function requireMainnetGameDayZero(): number {
  const raw = process.env.GAME_DAY_ZERO?.trim();
  if (!raw) {
    throw new Error(
      "REFUSED: Mainnet requires explicit GAME_DAY_ZERO (unix seconds). " +
        "Do not default to current time — set the intended Day 0 start before deploy.",
    );
  }
  const dayZero = Number(raw);
  if (!Number.isFinite(dayZero) || !Number.isInteger(dayZero) || dayZero <= 0) {
    throw new Error(
      `REFUSED: GAME_DAY_ZERO must be a positive unix integer. Got "${raw}".`,
    );
  }
  return dayZero;
}

/**
 * Resolve GameRandomness provider for Mainnet.
 * Requires explicit RANDOMNESS_PROVIDER (may equal deployer).
 */
export function requireMainnetRandomnessProvider(
  deployerAddress: string,
): string {
  const raw = process.env.RANDOMNESS_PROVIDER?.trim();
  if (!raw) {
    throw new Error(
      "REFUSED: Mainnet requires explicit RANDOMNESS_PROVIDER " +
        `(address that calls GameRandomness.fulfillDaySeed; may equal deployer ${deployerAddress}).`,
    );
  }
  const provider = getAddress(raw);
  assertNotTestnetContractAddress("RANDOMNESS_PROVIDER", provider);
  return provider;
}

export type GameDeploymentJson = {
  network?: string;
  chainId?: number;
  contract?: string;
  address: string;
  genesis: string;
  token: string;
  tokenDeployed?: boolean;
  treasury: string;
  emission: string;
  distributor: string;
  randomness: string;
  sinks: string;
  randomnessProvider?: string;
  dayZero: number;
  dayLengthSec: number;
  commitDurationSec: number;
  revealDurationSec: number;
  fastTiming?: boolean;
  treasuryFundedWei?: string;
  deployTxHash?: string;
  deployBlockNumber?: number;
  deployedAt?: string;
  deployer?: string;
};
