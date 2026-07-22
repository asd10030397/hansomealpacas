/**
 * Copy deployments/<network>-game.json public addresses into the Next.js .env.local.
 *
 * Never copies or infers private keys. GAME_TESTNET_RELAYER_PRIVATE_KEY must be
 * set manually to a dedicated relayer — this script only preserves an existing value.
 *
 * Usage: npx hardhat run scripts/sync-game-env.ts --network robinhoodTestnet
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { network } from "hardhat";

function readEnvValue(fileContents: string, key: string): string | null {
  const re = new RegExp(`^${key}=(.*)$`, "m");
  const m = fileContents.match(re);
  if (!m) return null;
  return (m[1] ?? "").trim();
}

function upsertEnvLine(fileContents: string, key: string, value: string): string {
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(fileContents)) {
    return fileContents.replace(re, `${key}=${value}`);
  }
  return `${fileContents.trimEnd()}\n${key}=${value}\n`;
}

async function main() {
  const deploymentsDir = join(__dirname, "..", "deployments");
  const recordPath = join(deploymentsDir, `${network.name}-game.json`);
  if (!existsSync(recordPath)) {
    throw new Error(`Missing ${recordPath} — deploy first`);
  }

  const record = JSON.parse(readFileSync(recordPath, "utf8")) as {
    address: string;
    distributor: string;
    genesis: string;
    chainId: number;
    token?: string;
    dayLengthSec?: number;
    commitDurationSec?: number;
    revealDurationSec?: number;
  };

  let thansome = record.token?.trim() || "";
  const thPath = join(deploymentsDir, `${network.name}-thansome.json`);
  if (existsSync(thPath)) {
    const th = JSON.parse(readFileSync(thPath, "utf8")) as { address: string };
    thansome = th.address;
  }

  const envPath = join(__dirname, "..", "..", ".env.local");
  const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

  const isMainnet = Number(record.chainId) === 4663;
  const lines: Record<string, string> = {
    NEXT_PUBLIC_HANSOME_GAME_ADDRESS: record.address,
    NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS: record.distributor,
    NEXT_PUBLIC_GENESIS_NFT_ADDRESS: record.genesis,
    NEXT_PUBLIC_GAME_CHAIN_ID: String(record.chainId),
    NEXT_PUBLIC_GAME_RPC_URL: isMainnet
      ? "https://rpc.mainnet.chain.robinhood.com"
      : "https://rpc.testnet.chain.robinhood.com",
    NEXT_PUBLIC_GAME_EXPLORER: isMainnet
      ? "https://robinhoodchain.blockscout.com"
      : "https://explorer.testnet.chain.robinhood.com",
    // Client flag: use /api/game/testnet-resolve (server key required separately).
    // Off on Mainnet until gasless Mainnet is explicitly approved.
    NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE: isMainnet ? "0" : "1",
    // Client: treat sale NFTs as playable via Testnet trait deck (pre-collection reveal).
    NEXT_PUBLIC_TESTNET_GAMEPLAY_TRAITS: isMainnet ? "0" : "1",
  };

  if (isMainnet) {
    lines.NEXT_PUBLIC_GAME_REQUIRE_MAINNET = "1";
    lines.NEXT_PUBLIC_HANSOME_GENESIS_ADDRESS = record.genesis;
    if (record.token?.trim()) {
      lines.NEXT_PUBLIC_CONTRACT = record.token.trim();
    }
  }

  // Randomness is required in Mainnet mode; optional on Testnet.
  const randomness =
    (record as { randomness?: string }).randomness?.trim() || "";
  if (randomness) {
    lines.NEXT_PUBLIC_RANDOMNESS_ADDRESS = randomness;
  }

  if (thansome && !isMainnet) {
    lines.NEXT_PUBLIC_THANSOME_ADDRESS = thansome;
  }
  if (record.dayLengthSec != null) {
    lines.NEXT_PUBLIC_GAME_DAY_LENGTH_SEC = String(record.dayLengthSec);
  }
  if (record.commitDurationSec != null) {
    lines.NEXT_PUBLIC_GAME_COMMIT_DURATION_SEC = String(record.commitDurationSec);
  }
  if (record.revealDurationSec != null) {
    lines.NEXT_PUBLIC_GAME_REVEAL_DURATION_SEC = String(record.revealDurationSec);
  }

  let next = existing;
  for (const [key, value] of Object.entries(lines)) {
    next = upsertEnvLine(next, key, value);
  }

  // Relayer: preserve existing dedicated value only. Never copy deployer/treasury keys.
  const existingRelayer = readEnvValue(existing, "GAME_TESTNET_RELAYER_PRIVATE_KEY");
  const relayerPresent = Boolean(existingRelayer);
  if (!relayerPresent) {
    // Ensure the key exists as an empty placeholder so operators see the slot.
    if (!/^GAME_TESTNET_RELAYER_PRIVATE_KEY=/m.test(next)) {
      next = upsertEnvLine(next, "GAME_TESTNET_RELAYER_PRIVATE_KEY", "");
    }
    console.warn(
      "WARN: GAME_TESTNET_RELAYER_PRIVATE_KEY is not set in .env.local. " +
        "Set a dedicated Testnet gasless relayer key (never reuse deployer/treasury/owner). " +
        "See docs/HANSOME_Role_Split_and_Ownership_Transfer_Checklist.md",
    );
  }

  writeFileSync(envPath, next.endsWith("\n") ? next : `${next}\n`);
  console.log("Updated", envPath);
  console.log(
    JSON.stringify(
      {
        ...lines,
        GAME_TESTNET_RELAYER_PRIVATE_KEY: relayerPresent ? "[preserved]" : "[unset]",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
