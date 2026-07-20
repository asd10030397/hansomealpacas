/**
 * Client-safe helpers for gasless Commit ordering:
 * generate salt → persist vault → verify → on-chain commit.
 */

export const VAULT_PERSIST_FAILED_MESSAGE =
  "Commit secret could not be saved to the battle vault. On-chain commit was not submitted. Check your connection and try again — if this keeps happening, the battle vault is temporarily unavailable.";

export type GaslessPersistGateInput = {
  gaslessEnabled: boolean;
  persistOk: boolean;
  persistError?: string;
};

/**
 * When gasless resolve is enabled, vault persistence must succeed before
 * any on-chain commit is submitted.
 */
export function shouldBlockCommitForVault(
  input: GaslessPersistGateInput,
): { block: true; error: string } | { block: false } {
  if (!input.gaslessEnabled) return { block: false };
  if (input.persistOk) return { block: false };
  return {
    block: true,
    error: input.persistError?.trim() || VAULT_PERSIST_FAILED_MESSAGE,
  };
}
