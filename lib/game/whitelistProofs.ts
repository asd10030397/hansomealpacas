/**
 * Genesis whitelist proof loading by game chain.
 *
 * Plan:
 * - 46630 → Testnet-only JSON (never use on Mainnet)
 * - 4663  → Mainnet JSON from generate-mainnet-whitelist-merkle.ts
 * - other → null (WL mint unavailable)
 *
 * MintPanel must call resolveWhitelistProofs(GENESIS_CHAIN_ID) instead of
 * hard-coding Testnet imports for all networks.
 */

import type { WhitelistProofMap } from "@/lib/game/mintService";
import {
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
} from "@/lib/chain";
import mainnetWhitelist from "@/lib/game/mainnet/whitelistProofs.MAINNET.json";
import testnetWhitelist from "@/lib/game/testnet/whitelistProofs.TESTNET-ONLY.json";

type WhitelistFile = {
  chainId?: number;
  merkleRoot?: string;
  addressCount?: number;
  proofs?: WhitelistProofMap;
};

function asProofMap(file: WhitelistFile): WhitelistProofMap | null {
  const proofs = file.proofs;
  if (!proofs || typeof proofs !== "object") return null;
  if (Object.keys(proofs).length === 0) return null;
  return proofs;
}

/**
 * Resolve client-side WL proofs for the active Genesis chain.
 * Returns null when unavailable (public mint still works when open).
 */
export function resolveWhitelistProofs(
  chainId: number,
): WhitelistProofMap | null {
  if (chainId === ROBINHOOD_TESTNET_CHAIN_ID) {
    return asProofMap(testnetWhitelist as WhitelistFile);
  }
  if (chainId === ROBINHOOD_CHAIN_ID) {
    const file = mainnetWhitelist as WhitelistFile;
    if (file.chainId != null && file.chainId !== ROBINHOOD_CHAIN_ID) {
      console.error(
        "[hansome-mint] Mainnet whitelist JSON chainId mismatch — refusing proofs",
      );
      return null;
    }
    if (
      !file.merkleRoot ||
      file.merkleRoot ===
        "0x0000000000000000000000000000000000000000000000000000000000000000"
    ) {
      return null;
    }
    return asProofMap(file);
  }
  return null;
}

export function mainnetWhitelistMerkleRoot(): string | null {
  const file = mainnetWhitelist as WhitelistFile;
  if (!file.merkleRoot || file.merkleRoot.startsWith("0x0000")) return null;
  return file.merkleRoot;
}
