import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  assertNoCrossNetworkAddresses,
  assertProfileChain,
  checksum,
} from "./safety/guards.js";
import { MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "./chain/phase.js";
import type { Address, Hex } from "viem";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

export type WorkerProfile = "testnet" | "mainnet";

export type WorkerConfig = {
  profile: WorkerProfile;
  workerName: string;
  chainId: number;
  rpcUrl: string;
  gameAddress: Address;
  randomnessAddress: Address;
  /** Permissionless settler (finalize + credit). */
  settlerPrivateKey: Hex;
  /** Must be on-chain randomnessProvider for fulfillDaySeed. */
  seedPrivateKey: Hex;
  pollIntervalMs: number;
  creditBatchLimit: number;
  maxCreditsPerTick: number;
  minEthWei: bigint;
  gasLimit: bigint;
  maxFeePerGasWei: bigint | null;
  dryRun: boolean;
  healthHost: string;
  healthPort: number;
  redisUrl: string | null;
  redisNamespace: string;
  allowMemoryState: boolean;
  alertWebhookUrl: string | null;
  logDir: string;
  lookbackDays: number;
};

function loadDotenv(): void {
  const profile = (process.env.WORKER_PROFILE || "").trim().toLowerCase();
  const candidates = [
    process.env.DOTENV_PATH?.trim(),
    profile === "mainnet" ? path.join(root, ".env.mainnet") : null,
    profile === "testnet" ? path.join(root, ".env.testnet") : null,
    path.join(root, ".env"),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (existsSync(p)) {
      // Profile file wins over leftover shell exports (e.g. DRY_RUN=0 from Hardhat).
      dotenv.config({ path: p, override: true });
    }
  }
  dotenv.config({ override: false });
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function optionalEnv(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Invalid number env ${name}=${raw}`);
  return n;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  throw new Error(`Invalid bool env ${name}=${raw}`);
}

function parsePrivateKey(name: string): Hex {
  const raw = requireEnv(name);
  const hex = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`Invalid private key format: ${name}`);
  }
  return hex as Hex;
}

export function loadConfig(): WorkerConfig {
  loadDotenv();

  const profileRaw = requireEnv("WORKER_PROFILE").toLowerCase();
  if (profileRaw !== "testnet" && profileRaw !== "mainnet") {
    throw new Error('WORKER_PROFILE must be "testnet" or "mainnet"');
  }
  const profile = profileRaw as WorkerProfile;

  const chainId = numEnv(
    "CHAIN_ID",
    profile === "mainnet" ? MAINNET_CHAIN_ID : TESTNET_CHAIN_ID,
  );
  assertProfileChain(profile, chainId);

  const gameAddress = checksum(requireEnv("GAME_ADDRESS"));
  const randomnessAddress = checksum(requireEnv("RANDOMNESS_ADDRESS"));
  assertNoCrossNetworkAddresses({
    profile,
    game: gameAddress,
    randomness: randomnessAddress,
  });

  const dryRunDefault = profile === "mainnet";
  const dryRun = boolEnv("DRY_RUN", dryRunDefault);
  if (profile === "mainnet" && !dryRun) {
    const ack = optionalEnv("MAINNET_LIVE_ACK");
    if (ack !== "I_UNDERSTAND_MAINNET_SETTLEMENT") {
      throw new Error(
        "Mainnet live mode requires DRY_RUN=0 and MAINNET_LIVE_ACK=I_UNDERSTAND_MAINNET_SETTLEMENT",
      );
    }
  }

  const workerName =
    optionalEnv("WORKER_NAME") ||
    (profile === "mainnet"
      ? "settlement-worker-mainnet"
      : "settlement-worker-testnet");

  const redisNamespace =
    optionalEnv("REDIS_NAMESPACE") ||
    `hansome:settle:v1:${profile}:${chainId}`;

  const maxFeeGwei = optionalEnv("MAX_FEE_PER_GAS_GWEI");
  const maxFeePerGasWei = maxFeeGwei
    ? BigInt(Math.floor(Number(maxFeeGwei) * 1e9))
    : null;

  const minEth = optionalEnv("MIN_ETH_BALANCE", "0.005");
  const minEthWei = BigInt(Math.floor(Number(minEth) * 1e18));

  const settlerPrivateKey = parsePrivateKey("SETTLER_PRIVATE_KEY");
  const seedPrivateKey = process.env.SEED_PRIVATE_KEY?.trim()
    ? parsePrivateKey("SEED_PRIVATE_KEY")
    : settlerPrivateKey;

  return {
    profile,
    workerName,
    chainId,
    rpcUrl: requireEnv("RPC_URL"),
    gameAddress,
    randomnessAddress,
    settlerPrivateKey,
    seedPrivateKey,
    pollIntervalMs: numEnv("POLL_INTERVAL_MS", profile === "testnet" ? 5000 : 15000),
    creditBatchLimit: Math.min(50, numEnv("CREDIT_BATCH_LIMIT", 50)),
    maxCreditsPerTick: numEnv("MAX_CREDITS_PER_TICK", 8),
    minEthWei,
    gasLimit: BigInt(numEnv("GAS_LIMIT", 2_500_000)),
    maxFeePerGasWei,
    dryRun,
    healthHost: optionalEnv("HEALTH_HOST", "0.0.0.0"),
    // Railway injects PORT; prefer HEALTH_PORT, then PORT, then 8080.
    healthPort: numEnv(
      "HEALTH_PORT",
      numEnv("PORT", profile === "mainnet" ? 8081 : 8080),
    ),
    redisUrl: optionalEnv("REDIS_URL") || null,
    redisNamespace,
    allowMemoryState: boolEnv("ALLOW_MEMORY_STATE", profile === "testnet"),
    alertWebhookUrl: optionalEnv("ALERT_WEBHOOK_URL") || null,
    logDir: optionalEnv("LOG_DIR", path.join(root, "logs", profile)),
    lookbackDays: numEnv("LOOKBACK_DAYS", 2),
  };
}
