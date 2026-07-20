/**
 * Production / gasless readiness checks for Testnet relayer + commit vault.
 * Safe to call from Node instrumentation — never logs secrets.
 */

import "server-only";

import {
  hasRedisEnv,
  hasVaultEncryptionKey,
  isCommitVaultConfigured,
} from "@/lib/game/server/testnetCommitVaultConfig";
import {
  isRelayerConfigured,
  isTestnetGaslessFeatureEnabled,
} from "@/lib/game/server/testnetRelayerStatus";

export type GaslessConfigIssue =
  | "relayer_key_missing"
  | "vault_encryption_key_missing"
  | "vault_storage_missing";

export type GaslessConfigStatus = {
  gaslessEnabled: boolean;
  relayerConfigured: boolean;
  vaultConfigured: boolean;
  issues: GaslessConfigIssue[];
  ready: boolean;
};

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

export function getGaslessConfigStatus(): GaslessConfigStatus {
  const gaslessEnabled = isTestnetGaslessFeatureEnabled();
  const relayerConfigured = isRelayerConfigured();
  const vaultConfigured = isCommitVaultConfigured();
  const issues: GaslessConfigIssue[] = [];

  if (gaslessEnabled) {
    if (!relayerConfigured) issues.push("relayer_key_missing");
    if (!hasVaultEncryptionKey()) {
      issues.push("vault_encryption_key_missing");
    }
    if (isProductionRuntime()) {
      if (!hasRedisEnv()) issues.push("vault_storage_missing");
    } else if (!vaultConfigured) {
      issues.push("vault_storage_missing");
    }
  }

  return {
    gaslessEnabled,
    relayerConfigured,
    vaultConfigured,
    issues,
    ready: !gaslessEnabled || issues.length === 0,
  };
}

/** Log loud, safe warnings when Production gasless is misconfigured. */
export function reportGaslessProductionConfig(): GaslessConfigStatus {
  const status = getGaslessConfigStatus();
  if (!isProductionRuntime() || !status.gaslessEnabled) return status;

  if (status.issues.includes("relayer_key_missing")) {
    console.error(
      "[hansome-gasless] PRODUCTION MISCONFIG: relayer private key missing for active game chain " +
        "(GAME_TESTNET_RELAYER_PRIVATE_KEY on 46630, GAME_MAINNET_RELAYER_PRIVATE_KEY on 4663). Gasless resolve is disabled.",
    );
  }
  if (status.issues.includes("vault_encryption_key_missing")) {
    console.error(
      "[hansome-gasless] PRODUCTION MISCONFIG: commit vault key missing for active game chain " +
        "(GAME_TESTNET_COMMIT_VAULT_KEY on 46630, GAME_MAINNET_COMMIT_VAULT_KEY on 4663). Commit vault cannot encrypt salts.",
    );
  }
  if (status.issues.includes("vault_storage_missing")) {
    console.error(
      "[hansome-gasless] PRODUCTION MISCONFIG: Vercel KV / Upstash Redis is not configured (KV_REST_API_URL + KV_REST_API_TOKEN). Filesystem vault is not supported.",
    );
  }
  return status;
}
