/**
 * Server-only Testnet commit secret vault.
 * Encrypted salts live in Vercel KV / Upstash Redis.
 * node:crypto and @upstash/redis load only inside server functions.
 */

import "server-only";

import { getAddress, isAddress, isHex, type Hex } from "viem";
import { computeCommitHash } from "@/lib/game/commitHash";
import { GAME_CHAIN_ID, HANSOME_GAME_ADDRESS } from "@/lib/game/hansomeGame";
import {
  isCommitVaultConfigured,
  redisConnectionEnv,
  vaultDriver,
} from "@/lib/game/server/testnetCommitVaultConfig";
import {
  memoryVaultKv,
  resetMemoryVaultForTests,
} from "@/lib/game/server/testnetCommitVaultMemory";
import type {
  StoredVaultRecord,
  VaultCommitSecret,
  VaultKv,
  VaultPersistInput,
} from "@/lib/game/server/testnetCommitVaultTypes";

export type {
  VaultCommitSecret,
  VaultKv,
  VaultPersistInput,
} from "@/lib/game/server/testnetCommitVaultTypes";
export { createMemoryVaultKv } from "@/lib/game/server/testnetCommitVaultMemory";
export { isCommitVaultConfigured };

const KEY_PREFIX = "hansome:cv:v1";

let injectedKv: VaultKv | null = null;
// Cached Upstash client — typed loosely to avoid top-level Redis import.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redisClient: any | null | undefined;

export function __resetCommitVaultForTests(): void {
  injectedKv = null;
  redisClient = undefined;
  resetMemoryVaultForTests();
}

export function __setCommitVaultKvForTests(kv: VaultKv | null): void {
  injectedKv = kv;
  redisClient = undefined;
}

function readVaultEncryptionKey(): Buffer | null {
  const raw = process.env.GAME_TESTNET_COMMIT_VAULT_KEY?.trim() || "";
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  try {
    const b64 = Buffer.from(raw, "base64");
    if (b64.length === 32) return b64;
  } catch {
    /* ignore */
  }
  return null;
}

async function getRedis() {
  if (redisClient !== undefined) return redisClient;
  const env = redisConnectionEnv();
  if (!env) {
    redisClient = null;
    return null;
  }
  const { Redis } = await import("@upstash/redis");
  redisClient = new Redis({ url: env.url, token: env.token });
  return redisClient;
}

async function getKv(): Promise<VaultKv | null> {
  if (injectedKv) return injectedKv;
  const driver = vaultDriver();
  if (driver === "memory") return memoryVaultKv();
  if (driver !== "redis") return null;
  const redis = await getRedis();
  if (!redis) return null;
  return {
    async get(key) {
      const value = await redis.get(key);
      if (value == null) return null;
      return typeof value === "string" ? value : JSON.stringify(value);
    },
    async set(key, value) {
      await redis.set(key, value);
    },
    async sadd(key, member) {
      await redis.sadd(key, member);
    },
    async smembers(key) {
      const members = await redis.smembers(key);
      return members.map(String);
    },
  };
}

function normalizeWallet(wallet: string): string {
  return wallet.trim().toLowerCase();
}

function normalizeGame(gameAddress: string): string {
  return getAddress(gameAddress).toLowerCase();
}

export function buildVaultRecordKey(input: {
  chainId: number;
  gameAddress: string;
  wallet: string;
  day: number;
  tokenId: number;
}): string {
  const game = normalizeGame(input.gameAddress);
  const wallet = normalizeWallet(input.wallet);
  return `${KEY_PREFIX}:${input.chainId}:${game}:${wallet}:${input.day}:${input.tokenId}`;
}

function dayIndexKey(chainId: number, gameAddress: string, day: number): string {
  return `${KEY_PREFIX}:idx:${chainId}:${normalizeGame(gameAddress)}:${day}`;
}

async function encryptSalt(
  salt: Hex,
  key: Buffer,
): Promise<Pick<StoredVaultRecord, "iv" | "tag" | "ciphertext">> {
  const { createCipheriv, randomBytes } = await import("node:crypto");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plain = Buffer.from(salt.slice(2), "hex");
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

async function decryptSalt(
  record: Pick<StoredVaultRecord, "iv" | "tag" | "ciphertext">,
  key: Buffer,
): Promise<Hex> {
  const { createDecipheriv } = await import("node:crypto");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(record.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(record.tag, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, "base64")),
    decipher.final(),
  ]);
  const hex = `0x${plain.toString("hex")}` as Hex;
  if (!isHex(hex) || hex.length !== 66) {
    throw new Error("Decrypted salt has invalid shape.");
  }
  return hex;
}

function resolveScope(input: {
  chainId?: number;
  gameAddress?: string;
  wallet: string;
}): { chainId: number; gameAddress: string; wallet: string } {
  const chainId = input.chainId ?? GAME_CHAIN_ID;
  const gameAddress = input.gameAddress ?? HANSOME_GAME_ADDRESS ?? "";
  if (!gameAddress || !isAddress(gameAddress, { strict: false })) {
    throw new Error("Game address is required for the commit vault.");
  }
  const walletLower = normalizeWallet(input.wallet);
  if (!isAddress(walletLower, { strict: false })) {
    throw new Error("Invalid wallet for the commit vault.");
  }
  return {
    chainId,
    gameAddress: normalizeGame(gameAddress),
    wallet: walletLower,
  };
}

function toPublicSecret(stored: StoredVaultRecord, salt: Hex): VaultCommitSecret {
  return {
    tokenId: stored.tokenId,
    day: stored.day,
    locationId: stored.locationId,
    salt,
    commitHash: stored.commitHash,
    wallet: stored.wallet,
    chainId: stored.chainId,
    gameAddress: stored.gameAddress,
    updatedAt: stored.updatedAt,
  };
}

async function readStored(
  kv: VaultKv,
  key: string,
): Promise<StoredVaultRecord | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredVaultRecord;
    if (!parsed || parsed.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function upsertVaultCommitSecret(
  input: VaultPersistInput,
): Promise<
  | { ok: true; record: VaultCommitSecret; idempotent: boolean }
  | { ok: false; error: string; code: string }
> {
  const keyMaterial = readVaultEncryptionKey();
  if (!keyMaterial) {
    return {
      ok: false,
      error: "Commit vault encryption key is not configured.",
      code: "VAULT_NOT_CONFIGURED",
    };
  }
  const kv = await getKv();
  if (!kv) {
    return {
      ok: false,
      error: "Commit vault storage is not configured.",
      code: "VAULT_NOT_CONFIGURED",
    };
  }

  let scope: { chainId: number; gameAddress: string; wallet: string };
  try {
    scope = resolveScope(input);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Invalid vault scope.",
      code: "VAULT_INVALID_INPUT",
    };
  }

  if (!isHex(input.salt) || input.salt.length !== 66) {
    return { ok: false, error: "Invalid salt.", code: "VAULT_INVALID_INPUT" };
  }
  if (!isHex(input.commitHash) || input.commitHash.length !== 66) {
    return {
      ok: false,
      error: "Invalid commitHash.",
      code: "VAULT_INVALID_INPUT",
    };
  }

  const recordKey = buildVaultRecordKey({
    ...scope,
    day: input.day,
    tokenId: input.tokenId,
  });

  const existing = await readStored(kv, recordKey);
  if (existing) {
    if (existing.commitHash.toLowerCase() === input.commitHash.toLowerCase()) {
      try {
        const salt = await decryptSalt(existing, keyMaterial);
        const verified = await verifyStoredRecord(kv, recordKey, input.commitHash);
        if (!verified.ok) {
          return {
            ok: false,
            error: verified.error,
            code: "VAULT_VERIFY_FAILED",
          };
        }
        return {
          ok: true,
          record: toPublicSecret(existing, salt),
          idempotent: true,
        };
      } catch {
        return {
          ok: false,
          error: "Existing vault record could not be decrypted.",
          code: "VAULT_DECRYPT_FAILED",
        };
      }
    }
    return {
      ok: false,
      error: "A different commit secret already exists for this NFT and day.",
      code: "VAULT_CONFLICT",
    };
  }

  const enc = await encryptSalt(input.salt, keyMaterial);
  const stored: StoredVaultRecord = {
    v: 1,
    chainId: scope.chainId,
    gameAddress: scope.gameAddress,
    wallet: scope.wallet,
    day: input.day,
    tokenId: input.tokenId,
    locationId: input.locationId,
    commitHash: input.commitHash,
    ...enc,
    updatedAt: Date.now(),
  };

  await kv.set(recordKey, JSON.stringify(stored));
  await kv.sadd(
    dayIndexKey(scope.chainId, scope.gameAddress, input.day),
    `${scope.wallet}:${input.tokenId}`,
  );

  const verified = await verifyStoredRecord(kv, recordKey, input.commitHash);
  if (!verified.ok) {
    return {
      ok: false,
      error: verified.error,
      code: "VAULT_VERIFY_FAILED",
    };
  }

  return {
    ok: true,
    record: toPublicSecret(stored, input.salt),
    idempotent: false,
  };
}

async function verifyStoredRecord(
  kv: VaultKv,
  recordKey: string,
  expectedCommitHash: Hex,
): Promise<{ ok: true; salt: Hex } | { ok: false; error: string }> {
  const keyMaterial = readVaultEncryptionKey();
  if (!keyMaterial) {
    return { ok: false, error: "Commit vault encryption key is not configured." };
  }
  const stored = await readStored(kv, recordKey);
  if (!stored) {
    return { ok: false, error: "Vault record missing after write." };
  }
  let salt: Hex;
  try {
    salt = await decryptSalt(stored, keyMaterial);
  } catch {
    return { ok: false, error: "Vault record decrypt failed after write." };
  }
  if (stored.commitHash.toLowerCase() !== expectedCommitHash.toLowerCase()) {
    return { ok: false, error: "Stored commitHash mismatch." };
  }
  const recomputed = computeCommitHash(
    stored.tokenId,
    stored.day,
    stored.locationId as 0 | 1 | 2 | 3 | 4,
    salt,
  );
  if (recomputed.toLowerCase() !== expectedCommitHash.toLowerCase()) {
    return {
      ok: false,
      error: "Retrieved salt does not recompute the commitment.",
    };
  }
  return { ok: true, salt };
}

export async function getVaultCommitSecret(input: {
  tokenId: number;
  day: number;
  wallet: string;
  chainId?: number;
  gameAddress?: string;
}): Promise<VaultCommitSecret | null> {
  const keyMaterial = readVaultEncryptionKey();
  const kv = await getKv();
  if (!keyMaterial || !kv) return null;
  let scope: { chainId: number; gameAddress: string; wallet: string };
  try {
    scope = resolveScope(input);
  } catch {
    return null;
  }
  const recordKey = buildVaultRecordKey({
    ...scope,
    day: input.day,
    tokenId: input.tokenId,
  });
  const stored = await readStored(kv, recordKey);
  if (!stored) return null;
  try {
    const salt = await decryptSalt(stored, keyMaterial);
    return toPublicSecret(stored, salt);
  } catch {
    return null;
  }
}

export async function listVaultSecretsForDay(
  day: number,
  opts?: { chainId?: number; gameAddress?: string },
): Promise<VaultCommitSecret[]> {
  const keyMaterial = readVaultEncryptionKey();
  const kv = await getKv();
  if (!keyMaterial || !kv) return [];

  const chainId = opts?.chainId ?? GAME_CHAIN_ID;
  const gameAddress = opts?.gameAddress ?? HANSOME_GAME_ADDRESS;
  if (!gameAddress || !isAddress(gameAddress)) return [];

  const members = await kv.smembers(dayIndexKey(chainId, gameAddress, day));
  const out: VaultCommitSecret[] = [];
  for (const member of members) {
    const [wallet, tokenRaw] = member.split(":");
    const tokenId = Number(tokenRaw);
    if (!wallet || !Number.isInteger(tokenId)) continue;
    const secret = await getVaultCommitSecret({
      tokenId,
      day,
      wallet,
      chainId,
      gameAddress,
    });
    if (secret) out.push(secret);
  }
  return out;
}

export async function vaultSecretCountForDay(day: number): Promise<number> {
  return (await listVaultSecretsForDay(day)).length;
}
