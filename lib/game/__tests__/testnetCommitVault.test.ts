import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Hex } from "viem";

const GAME = "0x1111111111111111111111111111111111111111";
const WALLET = "0xaaaa000000000000000000000000000000000001";
const VAULT_KEY_HEX = "ab".repeat(32);

async function loadVault() {
  return import("@/lib/game/server/testnetCommitVault");
}

async function loadCommitSecret() {
  return import("@/lib/game/commitSecret");
}

describe("testnetCommitVault (durable encrypted)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("GAME_TESTNET_COMMIT_VAULT_DRIVER", "memory");
    vi.stubEnv("GAME_TESTNET_COMMIT_VAULT_KEY", VAULT_KEY_HEX);
    vi.stubEnv("NEXT_PUBLIC_GAME_CHAIN_ID", "46630");
    vi.stubEnv("NEXT_PUBLIC_HANSOME_GAME_ADDRESS", GAME);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("vault unavailable prevents persistence", async () => {
    vi.stubEnv("GAME_TESTNET_COMMIT_VAULT_KEY", "");
    vi.stubEnv("GAME_TESTNET_COMMIT_VAULT_DRIVER", "redis");
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");

    const vault = await loadVault();
    expect(vault.isCommitVaultConfigured()).toBe(false);

    const { computeCommitHash, generateSalt } = await loadCommitSecret();
    const salt = generateSalt();
    const commitHash = computeCommitHash(1, 10, 2, salt);
    const result = await vault.upsertVaultCommitSecret({
      tokenId: 1,
      day: 10,
      locationId: 2,
      salt,
      commitHash,
      wallet: WALLET,
      chainId: 46630,
      gameAddress: GAME,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VAULT_NOT_CONFIGURED");
    }
  });

  it("persisted salt survives restart (shared durable store)", async () => {
    const strings = new Map<string, string>();
    const sets = new Map<string, Set<string>>();

    const vault1 = await loadVault();
    const kv = vault1.createMemoryVaultKv(strings, sets);
    vault1.__setCommitVaultKvForTests(kv);

    const { computeCommitHash, generateSalt } = await loadCommitSecret();
    const salt = generateSalt();
    const commitHash = computeCommitHash(7, 55, 1, salt);

    const written = await vault1.upsertVaultCommitSecret({
      tokenId: 7,
      day: 55,
      locationId: 1,
      salt,
      commitHash,
      wallet: WALLET,
      chainId: 46630,
      gameAddress: GAME,
    });
    expect(written.ok).toBe(true);

    // Simulate serverless cold start / new module instance with same KV backend.
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("GAME_TESTNET_COMMIT_VAULT_DRIVER", "memory");
    vi.stubEnv("GAME_TESTNET_COMMIT_VAULT_KEY", VAULT_KEY_HEX);
    vi.stubEnv("NEXT_PUBLIC_GAME_CHAIN_ID", "46630");
    vi.stubEnv("NEXT_PUBLIC_HANSOME_GAME_ADDRESS", GAME);

    const vault2 = await loadVault();
    vault2.__setCommitVaultKvForTests(vault2.createMemoryVaultKv(strings, sets));

    const read = await vault2.getVaultCommitSecret({
      tokenId: 7,
      day: 55,
      wallet: WALLET,
      chainId: 46630,
      gameAddress: GAME,
    });
    expect(read).not.toBeNull();
    expect(read!.salt).toBe(salt);
    expect(read!.commitHash.toLowerCase()).toBe(commitHash.toLowerCase());
  });

  it("commitment matches after retrieval", async () => {
    const vault = await loadVault();
    vault.__resetCommitVaultForTests();
    vault.__setCommitVaultKvForTests(vault.createMemoryVaultKv());

    const { computeCommitHash, generateSalt } = await loadCommitSecret();
    const salt = generateSalt();
    const day = 12;
    const tokenId = 3;
    const locationId = 4 as const;
    const commitHash = computeCommitHash(tokenId, day, locationId, salt);

    const result = await vault.upsertVaultCommitSecret({
      tokenId,
      day,
      locationId,
      salt,
      commitHash,
      wallet: WALLET,
      chainId: 46630,
      gameAddress: GAME,
    });
    expect(result.ok).toBe(true);

    const listed = await vault.listVaultSecretsForDay(day, {
      chainId: 46630,
      gameAddress: GAME,
    });
    expect(listed).toHaveLength(1);
    const recomputed = computeCommitHash(
      listed[0]!.tokenId,
      listed[0]!.day,
      listed[0]!.locationId as 0 | 1 | 2 | 3 | 4,
      listed[0]!.salt,
    );
    expect(recomputed.toLowerCase()).toBe(commitHash.toLowerCase());
  });

  it("stores multiple NFTs for the same wallet/day under distinct keys", async () => {
    const vault = await loadVault();
    vault.__resetCommitVaultForTests();
    vault.__setCommitVaultKvForTests(vault.createMemoryVaultKv());

    const { computeCommitHash, generateSalt } = await loadCommitSecret();
    const day = 99;
    const tokenIds = [1, 2, 3, 4, 5, 16];

    for (const tokenId of tokenIds) {
      const salt = generateSalt();
      const locationId = (tokenId % 5) as 0 | 1 | 2 | 3 | 4;
      const commitHash = computeCommitHash(tokenId, day, locationId, salt);
      const result = await vault.upsertVaultCommitSecret({
        tokenId,
        day,
        locationId,
        salt,
        commitHash,
        wallet: WALLET,
        chainId: 46630,
        gameAddress: GAME,
      });
      expect(result.ok).toBe(true);
    }

    const listed = await vault.listVaultSecretsForDay(day, {
      chainId: 46630,
      gameAddress: GAME,
    });
    expect(listed.map((r) => r.tokenId).sort((a, b) => a - b)).toEqual(tokenIds);

    const keyA = vault.buildVaultRecordKey({
      chainId: 46630,
      gameAddress: GAME,
      wallet: WALLET,
      day,
      tokenId: 1,
    });
    const keyB = vault.buildVaultRecordKey({
      chainId: 46630,
      gameAddress: GAME,
      wallet: WALLET,
      day,
      tokenId: 2,
    });
    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain("46630");
    expect(keyA.toLowerCase()).toContain(GAME.toLowerCase());
    expect(keyA.toLowerCase()).toContain(WALLET.toLowerCase());
  });

  it("duplicate commit persist is idempotent for the same commitment", async () => {
    const vault = await loadVault();
    vault.__resetCommitVaultForTests();
    vault.__setCommitVaultKvForTests(vault.createMemoryVaultKv());

    const { computeCommitHash, generateSalt } = await loadCommitSecret();
    const salt = generateSalt();
    const commitHash = computeCommitHash(16, 255, 0, salt);
    const payload = {
      tokenId: 16,
      day: 255,
      locationId: 0,
      salt,
      commitHash,
      wallet: WALLET,
      chainId: 46630,
      gameAddress: GAME,
    };

    const first = await vault.upsertVaultCommitSecret(payload);
    const second = await vault.upsertVaultCommitSecret(payload);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.idempotent).toBe(false);
      expect(second.idempotent).toBe(true);
      expect(second.record.salt).toBe(salt);
    }

    const otherSalt = generateSalt();
    const conflict = await vault.upsertVaultCommitSecret({
      ...payload,
      salt: otherSalt,
      commitHash: computeCommitHash(16, 255, 0, otherSalt),
    });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.code).toBe("VAULT_CONFLICT");
  });

  it("never stores plaintext salt in the durable record payload", async () => {
    const strings = new Map<string, string>();
    const sets = new Map<string, Set<string>>();
    const vault = await loadVault();
    vault.__setCommitVaultKvForTests(vault.createMemoryVaultKv(strings, sets));

    const { computeCommitHash, generateSalt } = await loadCommitSecret();
    const salt = generateSalt();
    const commitHash = computeCommitHash(1, 1, 1, salt);
    await vault.upsertVaultCommitSecret({
      tokenId: 1,
      day: 1,
      locationId: 1,
      salt,
      commitHash,
      wallet: WALLET,
      chainId: 46630,
      gameAddress: GAME,
    });

    const raw = [...strings.values()].join("\n");
    expect(raw.includes(salt)).toBe(false);
    expect(raw.includes((salt as Hex).slice(2))).toBe(false);
  });
});
