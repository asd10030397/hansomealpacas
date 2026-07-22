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

/** Known burn / dummy addresses that must never be used as live Mainnet role keys. */
export const FORBIDDEN_PLACEHOLDER_ADDRESSES = [
  "0x0000000000000000000000000000000000000001",
  "0x0000000000000000000000000000000000000000",
  "0x1111111111111111111111111111111111111111",
  "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead",
] as const;

const PLACEHOLDER_SET = new Set(
  FORBIDDEN_PLACEHOLDER_ADDRESSES.map((a) => a.toLowerCase()),
);

export function isForbiddenPlaceholderAddress(
  value: string | null | undefined,
): boolean {
  if (!value || !isAddress(value)) return false;
  return PLACEHOLDER_SET.has(value.toLowerCase());
}

/** Abort if address is a known placeholder / burn dummy. */
export function assertNotPlaceholderAddress(label: string, value: string): string {
  const addr = getAddress(value);
  if (isForbiddenPlaceholderAddress(addr)) {
    throw new Error(
      `REFUSED: ${label} ${addr} is a forbidden placeholder. ` +
        `Set a real Mainnet operator / owner address (see docs/MAINNET_ROLES_AND_RUNBOOK.md).`,
    );
  }
  return addr;
}

/**
 * Ceremony hot-wallet EOA currently used as deployer/Treasury fallback.
 * May be a *candidate* for VRF_OPERATOR / temporary RANDOMNESS_PROVIDER only after
 * explicit project-owner acknowledgment — never auto-approved as production owner.
 */
export const CEREMONY_CANDIDATE_EOA =
  "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A";

function envFlagTrue(name: string): boolean {
  const v = process.env[name]?.trim();
  return v === "1" || v === "true" || v === "yes" || v === "YES";
}

/**
 * Parse + EIP-55 normalize a Mainnet role address.
 * Fail-closed on empty, invalid format, bad checksum, placeholder, zero address.
 */
export function requireValidatedRoleAddress(label: string, raw: string | undefined | null): string {
  const trimmed = raw?.trim() || "";
  if (!trimmed) {
    throw new Error(
      `REFUSED: ${label} is empty. Set a checksummed Mainnet address ` +
        `(see docs/MAINNET_ROLES_AND_RUNBOOK.md).`,
    );
  }
  if (!isAddress(trimmed)) {
    throw new Error(
      `REFUSED: ${label} is not a valid Ethereum address format: "${trimmed}".`,
    );
  }
  let addr: string;
  try {
    addr = getAddress(trimmed);
  } catch {
    throw new Error(
      `REFUSED: ${label} failed EIP-55 checksum validation: "${trimmed}". ` +
        `Use a correctly checksummed address.`,
    );
  }
  assertNotPlaceholderAddress(label, addr);
  return addr;
}

/**
 * Mainnet VRF_OPERATOR — required for Genesis VRFRevealAdapter (no mock).
 * If set to the ceremony candidate EOA, requires VRF_OPERATOR_OWNER_ACK=1.
 */
export function requireMainnetVrfOperator(): string {
  const addr = requireValidatedRoleAddress(
    "VRF_OPERATOR",
    process.env.VRF_OPERATOR,
  );
  if (addr.toLowerCase() === CEREMONY_CANDIDATE_EOA.toLowerCase()) {
    if (!envFlagTrue("VRF_OPERATOR_OWNER_ACK")) {
      throw new Error(
        `REFUSED: VRF_OPERATOR=${addr} is the ceremony candidate EOA and is NOT auto-approved. ` +
          `Project owner must set VRF_OPERATOR_OWNER_ACK=1 after explicit written approval, ` +
          `or set a dedicated operator address.`,
      );
    }
  }
  return addr;
}

/**
 * Mainnet MAINNET_OWNER — prefer multisig/timelock.
 * Rejects empty/placeholder. Rejects deployer/ceremony EOA unless
 * MAINNET_OWNER_ALLOW_CEREMONY_EOA=1 and MAINNET_OWNER_OWNER_ACK=1.
 */
export function requireMainnetOwner(deployerAddress: string): string {
  const addr = requireValidatedRoleAddress(
    "MAINNET_OWNER",
    process.env.MAINNET_OWNER,
  );
  const deployer = getAddress(deployerAddress);
  const isCeremonyOrDeployer =
    addr.toLowerCase() === deployer.toLowerCase() ||
    addr.toLowerCase() === CEREMONY_CANDIDATE_EOA.toLowerCase();
  if (isCeremonyOrDeployer) {
    if (
      !envFlagTrue("MAINNET_OWNER_ALLOW_CEREMONY_EOA") ||
      !envFlagTrue("MAINNET_OWNER_OWNER_ACK")
    ) {
      throw new Error(
        `REFUSED: MAINNET_OWNER=${addr} equals deployer/ceremony EOA. ` +
          `Production owner should be a multisig or timelock. ` +
          `To override (discouraged), set MAINNET_OWNER_ALLOW_CEREMONY_EOA=1 and MAINNET_OWNER_OWNER_ACK=1 ` +
          `after explicit project-owner approval.`,
      );
    }
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
  assertNotPlaceholderAddress("RANDOMNESS_PROVIDER", provider);
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
