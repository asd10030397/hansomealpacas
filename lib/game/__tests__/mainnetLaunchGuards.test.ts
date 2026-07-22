import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertProductionGameAddresses,
  isCanonicalTestnetSuiteAddress,
  resolveGenesisNftAddress,
  resolveHansomeGameAddress,
} from "@/lib/game/contractAddresses";
import {
  assertGameNetworkConfig,
  assertMainnetProductionGameChain,
  isGameMainnetRequired,
  resolveGameChainId,
  resolveGameExplorerUrl,
  resolveGameRpcUrl,
} from "@/lib/game/gameNetwork";
import {
  PROD_COMMIT_DURATION_SEC,
  PROD_DAY_LENGTH_SEC,
  PROD_REVEAL_DURATION_SEC,
} from "@/lib/game/genesisIdentity";
import { BATTLE_PRESENTATION_DURATION_MULTIPLIER } from "@/lib/game/presentationTiming";
import { DEFAULT_RPC_URL, ROBINHOOD_CHAIN_ID, ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/chain";

const CANONICAL_GAME = "0x92C8e9CCF67e533438bCCE258D4bEEc6E0559FC5";
const CANONICAL_GENESIS = "0x43c1d6aF194A796EC612F2bAC04085a409A1347C";
const CANONICAL_DISTRIBUTOR = "0x7Fb2437542041AbaC22E0A88dF2e0A9c3346e1d2";
const CANONICAL_RANDOMNESS = "0x45F9FFaC891e06E83a5A315E4fE1B55E5b6b438F";
const SUPERSEDED_GAME = "0x7b2ce5ECD270Ce55Ac94aCe3BF12d83ef113D0a0";
/** Placeholder Mainnet-shaped address (not a live deploy). */
const FAKE_MAINNET_GAME = "0x1111111111111111111111111111111111111111";
const FAKE_MAINNET_GENESIS = "0x2222222222222222222222222222222222222222";
const FAKE_MAINNET_DISTRIBUTOR = "0x3333333333333333333333333333333333333333";
const FAKE_MAINNET_RANDOMNESS = "0x4444444444444444444444444444444444444444";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Mainnet launch guards", () => {
  it("keeps Mainnet and Testnet chainIds distinct", () => {
    expect(ROBINHOOD_CHAIN_ID).toBe(4663);
    expect(ROBINHOOD_TESTNET_CHAIN_ID).toBe(46630);
    expect(ROBINHOOD_CHAIN_ID).not.toBe(ROBINHOOD_TESTNET_CHAIN_ID);
  });

  it("documents GDS Mainnet timing source of truth (not 2-minute Testnet QA)", () => {
    expect(PROD_DAY_LENGTH_SEC).toBe(86_400);
    expect(PROD_COMMIT_DURATION_SEC).toBe(72_000);
    expect(PROD_REVEAL_DURATION_SEC).toBe(14_400);
  });

  it("preserves slowed Battle Result presentation multiplier (visual only)", () => {
    expect(BATTLE_PRESENTATION_DURATION_MULTIPLIER).toBe(2);
  });

  it("Mainnet mode never falls back to Testnet RPC or explorer", () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_CHAIN_ID", "4663");
    vi.stubEnv("NEXT_PUBLIC_GAME_RPC_URL", "");
    vi.stubEnv("NEXT_PUBLIC_GAME_EXPLORER", "");
    expect(resolveGameChainId()).toBe(4663);
    expect(resolveGameRpcUrl()).toBe(DEFAULT_RPC_URL);
    expect(resolveGameRpcUrl()).not.toMatch(/testnet/i);
    expect(resolveGameExplorerUrl()).not.toMatch(/testnet/i);
  });

  it("assertGameNetworkConfig refuses Testnet RPC when Mainnet mode is selected", () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_CHAIN_ID", "4663");
    vi.stubEnv("NEXT_PUBLIC_GAME_REQUIRE_MAINNET", "");
    vi.stubEnv(
      "NEXT_PUBLIC_GAME_RPC_URL",
      "https://rpc.testnet.chain.robinhood.com",
    );
    expect(() => assertGameNetworkConfig()).toThrow(/Testnet RPC/i);
  });

  it("production Mainnet chain guard rejects Testnet chain configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_REQUIRE_MAINNET", "1");
    vi.stubEnv("NEXT_PUBLIC_GAME_CHAIN_ID", "46630");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isGameMainnetRequired()).toBe(true);
    expect(() => assertMainnetProductionGameChain()).toThrow(/4663/);
    expect(() => assertGameNetworkConfig()).toThrow(/Mainnet Production guard/i);
  });

  it("Testnet development configuration still works without Mainnet require flag", () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_REQUIRE_MAINNET", "");
    vi.stubEnv("NEXT_PUBLIC_GAME_CHAIN_ID", "46630");
    vi.stubEnv("VERCEL_ENV", "");
    expect(isGameMainnetRequired()).toBe(false);
    expect(resolveGameChainId()).toBe(ROBINHOOD_TESTNET_CHAIN_ID);
    expect(() => assertMainnetProductionGameChain()).not.toThrow();
    expect(() => assertGameNetworkConfig()).not.toThrow();
  });

  it("Mainnet require flag accepts chainId 4663", () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_REQUIRE_MAINNET", "true");
    vi.stubEnv("NEXT_PUBLIC_GAME_CHAIN_ID", "4663");
    vi.stubEnv("NEXT_PUBLIC_GAME_RPC_URL", DEFAULT_RPC_URL);
    vi.stubEnv(
      "NEXT_PUBLIC_GAME_EXPLORER",
      "https://robinhoodchain.blockscout.com",
    );
    expect(() => assertMainnetProductionGameChain()).not.toThrow();
    expect(() => assertGameNetworkConfig()).not.toThrow();
  });

  it("assertProductionGameAddresses fails closed on Mainnet without Genesis", () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_CHAIN_ID", "4663");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NEXT_PUBLIC_GAME_RPC_URL", DEFAULT_RPC_URL);
    vi.stubEnv("NEXT_PUBLIC_HANSOME_GAME_ADDRESS", FAKE_MAINNET_GAME);
    vi.stubEnv("NEXT_PUBLIC_HANSOME_GENESIS_ADDRESS", "");
    vi.stubEnv("NEXT_PUBLIC_GENESIS_NFT_ADDRESS", "");
    expect(() => assertProductionGameAddresses()).toThrow(/Genesis/i);
  });

  it("assertProductionGameAddresses fails when Mainnet uses Testnet suite addresses", () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_CHAIN_ID", "4663");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NEXT_PUBLIC_GAME_RPC_URL", DEFAULT_RPC_URL);
    vi.stubEnv("NEXT_PUBLIC_HANSOME_GAME_ADDRESS", CANONICAL_GAME);
    vi.stubEnv("NEXT_PUBLIC_HANSOME_GENESIS_ADDRESS", CANONICAL_GENESIS);
    vi.stubEnv("NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS", CANONICAL_DISTRIBUTOR);
    vi.stubEnv("NEXT_PUBLIC_RANDOMNESS_ADDRESS", CANONICAL_RANDOMNESS);
    expect(isCanonicalTestnetSuiteAddress(CANONICAL_GAME)).toBe(true);
    expect(() => assertProductionGameAddresses()).toThrow(/Testnet/i);
  });

  it("assertProductionGameAddresses requires distributor + randomness on Mainnet", () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_CHAIN_ID", "4663");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NEXT_PUBLIC_GAME_RPC_URL", DEFAULT_RPC_URL);
    vi.stubEnv("NEXT_PUBLIC_HANSOME_GAME_ADDRESS", FAKE_MAINNET_GAME);
    vi.stubEnv("NEXT_PUBLIC_HANSOME_GENESIS_ADDRESS", FAKE_MAINNET_GENESIS);
    vi.stubEnv("NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS", "");
    vi.stubEnv("NEXT_PUBLIC_RANDOMNESS_ADDRESS", "");
    expect(() => assertProductionGameAddresses()).toThrow(/RewardDistributor|missing/i);
  });

  it("assertProductionGameAddresses accepts non-Testnet Mainnet suite shape", () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_CHAIN_ID", "4663");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NEXT_PUBLIC_GAME_RPC_URL", DEFAULT_RPC_URL);
    vi.stubEnv(
      "NEXT_PUBLIC_GAME_EXPLORER",
      "https://robinhoodchain.blockscout.com",
    );
    vi.stubEnv("NEXT_PUBLIC_HANSOME_GAME_ADDRESS", FAKE_MAINNET_GAME);
    vi.stubEnv("NEXT_PUBLIC_HANSOME_GENESIS_ADDRESS", FAKE_MAINNET_GENESIS);
    vi.stubEnv(
      "NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS",
      FAKE_MAINNET_DISTRIBUTOR,
    );
    vi.stubEnv("NEXT_PUBLIC_RANDOMNESS_ADDRESS", FAKE_MAINNET_RANDOMNESS);
    expect(() => assertProductionGameAddresses()).not.toThrow();
  });

  it("assertProductionGameAddresses skips local non-Mainnet builds", () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_CHAIN_ID", "46630");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NEXT_PUBLIC_HANSOME_GAME_ADDRESS", "");
    expect(() => assertProductionGameAddresses()).not.toThrow();
  });

  it("rejects superseded Testnet game addresses at resolve time", () => {
    vi.stubEnv("NEXT_PUBLIC_HANSOME_GAME_ADDRESS", SUPERSEDED_GAME);
    const game = resolveHansomeGameAddress();
    expect(game.ok).toBe(false);
    if (!game.ok) expect(game.error).toMatch(/superseded/i);
  });

  it("resolves Genesis via static NEXT_PUBLIC_GENESIS_NFT_ADDRESS alias", () => {
    vi.stubEnv("NEXT_PUBLIC_HANSOME_GENESIS_ADDRESS", "");
    vi.stubEnv("NEXT_PUBLIC_GENESIS_NFT_ADDRESS", CANONICAL_GENESIS);
    const r = resolveGenesisNftAddress();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.address).toBe(CANONICAL_GENESIS);
  });
});
