/**
 * Server-only vault *configuration* checks (env presence).
 * No node:crypto, no Redis client — safe for status endpoints that must not
 * pull encryption/storage implementations into unintended bundles.
 */

import "server-only";

function redisUrl(): string {
  return (
    process.env.KV_REST_API_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    ""
  );
}

function redisToken(): string {
  return (
    process.env.KV_REST_API_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    ""
  );
}

export function hasRedisEnv(): boolean {
  return Boolean(redisUrl() && redisToken());
}

/** True when GAME_TESTNET_COMMIT_VAULT_KEY looks like a 32-byte key. */
export function hasVaultEncryptionKey(): boolean {
  const raw = process.env.GAME_TESTNET_COMMIT_VAULT_KEY?.trim() || "";
  if (!raw) return false;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return true;
  // Standard base64 for 32 bytes is 44 chars with padding.
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(raw) && raw.length >= 43 && raw.length <= 44) {
    return true;
  }
  return false;
}

export function vaultDriver(): "redis" | "memory" | "none" {
  const explicit = process.env.GAME_TESTNET_COMMIT_VAULT_DRIVER?.trim().toLowerCase();
  if (explicit === "memory") {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.VERCEL_ENV === "production"
    ) {
      return "none";
    }
    return "memory";
  }
  if (explicit === "redis" || explicit === "kv") {
    return hasRedisEnv() ? "redis" : "none";
  }
  if (hasRedisEnv()) return "redis";
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production" &&
    hasVaultEncryptionKey()
  ) {
    if (
      explicit === "auto-memory" ||
      process.env.GAME_TESTNET_COMMIT_VAULT_ALLOW_MEMORY === "1"
    ) {
      return "memory";
    }
  }
  return hasRedisEnv() ? "redis" : "none";
}

export function isCommitVaultConfigured(): boolean {
  if (!hasVaultEncryptionKey()) return false;
  const driver = vaultDriver();
  return driver === "redis" || driver === "memory";
}

export function redisConnectionEnv(): { url: string; token: string } | null {
  const url = redisUrl();
  const token = redisToken();
  if (!url || !token) return null;
  return { url, token };
}
