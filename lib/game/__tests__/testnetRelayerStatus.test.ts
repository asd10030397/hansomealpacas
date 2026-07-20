import { afterEach, describe, expect, it, vi } from "vitest";

/** Valid-shaped key for format tests only — never a production secret. */
const FAKE_RELAYER_KEY =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const FAKE_OTHER_KEY =
  "0x2222222222222222222222222222222222222222222222222222222222222222";

describe("testnetRelayerStatus", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reports relayerConfigured false without leaking key names in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GAME_TESTNET_RELAYER_PRIVATE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_GAME_CHAIN_ID", "46630");
    vi.stubEnv(
      "NEXT_PUBLIC_HANSOME_GAME_ADDRESS",
      "0x1111111111111111111111111111111111111111",
    );

    const mod = await import("@/lib/game/server/testnetRelayerStatus");
    const status = mod.buildTestnetResolveStatus();
    expect(status.relayerConfigured).toBe(false);
    expect(status.error).toBe(
      "Battle settlement service is temporarily unavailable.",
    );
    expect(JSON.stringify(status)).not.toMatch(/PRIVATE_KEY/i);
  });

  it("uses compact developer message outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("GAME_TESTNET_RELAYER_PRIVATE_KEY", "");

    const mod = await import("@/lib/game/server/testnetRelayerStatus");
    expect(mod.relayerUnavailableMessage()).toBe(
      "Testnet relayer is not configured on this server.",
    );
  });

  it("does not fall back to DEPLOYER_PRIVATE_KEY, TREASURY_PRIVATE_KEY, or PRIVATE_KEY", async () => {
    vi.stubEnv("GAME_TESTNET_RELAYER_PRIVATE_KEY", "");
    vi.stubEnv("DEPLOYER_PRIVATE_KEY", FAKE_OTHER_KEY);
    vi.stubEnv("TREASURY_PRIVATE_KEY", FAKE_OTHER_KEY);
    vi.stubEnv("PRIVATE_KEY", FAKE_OTHER_KEY);
    vi.stubEnv("NEXT_PUBLIC_GAME_CHAIN_ID", "46630");
    vi.stubEnv(
      "NEXT_PUBLIC_HANSOME_GAME_ADDRESS",
      "0x1111111111111111111111111111111111111111",
    );

    const mod = await import("@/lib/game/server/testnetRelayerStatus");
    expect(mod.readRelayerPrivateKey()).toBeNull();
    expect(mod.isRelayerConfigured()).toBe(false);
    const status = mod.buildTestnetResolveStatus();
    expect(status.relayerConfigured).toBe(false);
    expect(status.canResolve).toBe(false);
  });

  it("accepts only GAME_TESTNET_RELAYER_PRIVATE_KEY when present", async () => {
    vi.stubEnv("GAME_TESTNET_RELAYER_PRIVATE_KEY", FAKE_RELAYER_KEY);
    vi.stubEnv("DEPLOYER_PRIVATE_KEY", FAKE_OTHER_KEY);
    vi.stubEnv("TREASURY_PRIVATE_KEY", FAKE_OTHER_KEY);
    vi.stubEnv("PRIVATE_KEY", FAKE_OTHER_KEY);

    const mod = await import("@/lib/game/server/testnetRelayerStatus");
    expect(mod.readRelayerPrivateKey()).toBe(FAKE_RELAYER_KEY);
    expect(mod.isRelayerConfigured()).toBe(true);
  });

  it("rejects malformed GAME_TESTNET_RELAYER_PRIVATE_KEY", async () => {
    vi.stubEnv("GAME_TESTNET_RELAYER_PRIVATE_KEY", "0xdead");
    vi.stubEnv("TREASURY_PRIVATE_KEY", FAKE_OTHER_KEY);

    const mod = await import("@/lib/game/server/testnetRelayerStatus");
    expect(mod.readRelayerPrivateKey()).toBeNull();
    expect(mod.isRelayerConfigured()).toBe(false);
  });
});
