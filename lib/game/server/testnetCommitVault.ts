/**
 * Server-only Testnet commit secret vault.
 * Encrypted salts are stored in Vercel KV / Upstash Redis so gasless reveal
 * survives redeploys and serverless cold starts. Never use the filesystem.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { Redis } from "@upstash/redis";
import { getAddress, isAddress, isHex, type Hex } from "viem";
import { GAME_CHAIN_ID, HANSOME_GAME_ADDRESS } from "@/lib/game/hansomeGame";

export type VaultCommitSecret = {
  tokenId: number;
  day: number;
  locationId: number;
  salt: Hex;
  commitHash: Hex;
  wallet: string;
  chainId: number;
  gameAddress: string;
  updatedAt: number;
};

export type VaultPersistInput = {
  tokenId: number;
  day: number;
  locationId: number;
  salt: Hex;
  commitHash: Hex;
  wallet: string;
  chainId?: number;
  gameAddress?: string;
};

type StoredVaultRecord = {
  v: 1;
  chainId: number;
  gameAddress: string;
  wallet: string;
  day: number;
  tokenId: number;
  locationId: number;
  commitHash: Hex;
  /** AES-256-GCM encrypted salt (hex without 0x). */
  iv: string;
  tag: string;
  ciphertext: string;
  updatedAt: number;
};

export type VaultKv = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  sadd: (key: string, member: string) => Promise<void>;
  smembers: (key: string) => Promise<string[]>;
};

const KEY_PREFIX = "hansome:cv:v1";

/** Process-local memory store for tests / explicit local driver. */
const memoryStrings = new Map<string, string>();
const memorySets = new Map<string, Set<string>>();

let injectedKv: VaultKv | null = null;
let redisClient: Redis | null | undefined;

export function __resetCommitVaultForTests(): void {
  injectedKv = null;
  redisClient = undefined;
  memoryStrings.clear();
  memorySets.clear();
}

export function __setCommitVaultKvForTests(kv: VaultKv | null): void {
  injectedKv = kv;
  redisClient = undefined;
}

export function createMemoryVaultKv(
  strings: Map<string, string> = new Map(),
  sets: Map<string, Set<string>> = new Map(),
): VaultKv {
  return {
    async get(key) {
      return strings.get(key) ?? null;
    },
    async set(key, value) {
      strings.set(key, value);
    },
    async sadd(key, member) {
      let set = sets.get(key);
      if (!set) {
        set = new Set();
        sets.set(key, set);
      }
      set.add(member);
    },
    async smembers(key) {
      return [...(sets.get(key) ?? [])];
    },
  };
}

function memoryVaultKv(): VaultKv {
  return createMemoryVaultKv(memoryStrings, memorySets);
}

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

export function readVaultEncryptionKey(): Buffer | null {
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

function vaultDriver(): "redis" | "memory" | "none" {
  const explicit = process.env.GAME_TESTNET_COMMIT_VAULT_DRIVER?.trim().toLowerCase();
  if (explicit === "memory") {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
      return "none";
    }
    return "memory";
  }
  if (explicit === "redis" || explicit === "kv") {
    return redisUrl() && redisToken() ? "redis" : "none";
  }
  if (redisUrl() && redisToken()) return "redis";
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production" &&
    readVaultEncryptionKey()
  ) {
    // Local/dev convenience when encryption key is set but Redis is not.
    // Never used in Production.
    if (explicit === "auto-memory" || process.env.GAME_TESTNET_COMMIT_VAULT_ALLOW_MEMORY === "1") {
      return "memory";
    }
  }
  return redisUrl() && redisToken() ? "redis" : "none";
}

export function isCommitVaultConfigured(): boolean {
  if (!readVaultEncryptionKey()) return false;
  const driver = vaultDriver();
  return driver === "redis" || driver === "memory";
}

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = redisUrl();
  const token = redisToken();
  if (!url || !token) {
    redisClient = null;
    return null;
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

async function getKv(): Promise<VaultKv | null> {
  if (injectedKv) return injectedKv;
  const driver = vaultDriver();
  if (driver === "memory") return memoryVaultKv();
  if (driver !== "redis") return null;
  const redis = getRedis();
  if (!redis) return null;
  return {
    async get(key) {
      const value = await redis.get<string>(key);
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

function encryptSalt(salt: Hex, key: Buffer): Pick<StoredVaultRecord, "iv" | "tag" | "ciphertext"> {
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

function decryptSalt(
  record: Pick<StoredVaultRecord, "iv" | "tag" | "ciphertext">,
  key: Buffer,
): Hex {
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

/**
 * Persist (or idempotently confirm) an encrypted salt, then read it back and
 * verify the stored salt recomputes the expected commitment.
 */
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
        const salt = decryptSalt(existing, keyMaterial);
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

  const enc = encryptSalt(input.salt, keyMaterial);
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
    salt = decryptSalt(stored, keyMaterial);
  } catch {
    return { ok: false, error: "Vault record decrypt failed after write." };
  }
  if (stored.commitHash.toLowerCase() !== expectedCommitHash.toLowerCase()) {
    return { ok: false, error: "Stored commitHash mismatch." };
  }
  // Lazy import keeps client bundles free of this module's Node crypto path
  // when only types are imported elsewhere.
  const { computeCommitHash } = await import("@/lib/game/commitSecret");
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
    const salt = decryptSalt(stored, keyMaterial);
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
