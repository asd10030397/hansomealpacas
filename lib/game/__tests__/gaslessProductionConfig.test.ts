import { afterEach, describe, expect, it, vi } from "vitest";

const FAKE_RELAYER_KEY =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const VAULT_KEY_HEX = "cd".repeat(32);
const GAME = "0x1111111111111111111111111111111111111111";

describe("gaslessProductionConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reports missing relayer key and vault config in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_GAME_CHAIN_ID", "46630");
    vi.stubEnv("NEXT_PUBLIC_HANSOME_GAME_ADDRESS", GAME);
    vi.stubEnv("GAME_TESTNET_RELAYER_PRIVATE_KEY", "");
    vi.stubEnv("GAME_TESTNET_COMMIT_VAULT_KEY", "");
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");

    const mod = await import("@/lib/game/server/gaslessProductionConfig");
    const status = mod.getGaslessConfigStatus();
    expect(status.gaslessEnabled).toBe(true);
    expect(status.ready).toBe(false);
    expect(status.issues).toContain("relayer_key_missing");
    expect(status.issues).toContain("vault_encryption_key_missing");
    expect(status.issues).toContain("vault_storage_missing");
  });

  it("is ready when relayer + encryption key + redis env are set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_GAME_CHAIN_ID", "46630");
    vi.stubEnv("NEXT_PUBLIC_HANSOME_GAME_ADDRESS", GAME);
    vi.stubEnv("GAME_TESTNET_RELAYER_PRIVATE_KEY", FAKE_RELAYER_KEY);
    vi.stubEnv("GAME_TESTNET_COMMIT_VAULT_KEY", VAULT_KEY_HEX);
    vi.stubEnv("KV_REST_API_URL", "https://example.upstash.io");
    vi.stubEnv("KV_REST_API_TOKEN", "test-token");

    const mod = await import("@/lib/game/server/gaslessProductionConfig");
    const status = mod.getGaslessConfigStatus();
    expect(status.relayerConfigured).toBe(true);
    expect(status.vaultConfigured).toBe(true);
    expect(status.issues).toEqual([]);
    expect(status.ready).toBe(true);
  });
});
