/**
 * Copy deployments/<network>-game.json addresses into the Next.js .env.local.
 *
 * Usage: npx hardhat run scripts/sync-game-env.ts --network robinhoodTestnet
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { network } from "hardhat";

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

  const lines: Record<string, string> = {
    NEXT_PUBLIC_HANSOME_GAME_ADDRESS: record.address,
    NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS: record.distributor,
    NEXT_PUBLIC_GENESIS_NFT_ADDRESS: record.genesis,
    NEXT_PUBLIC_GAME_CHAIN_ID: String(record.chainId),
    NEXT_PUBLIC_GAME_RPC_URL: "https://rpc.testnet.chain.robinhood.com",
    NEXT_PUBLIC_GAME_EXPLORER: "https://explorer.testnet.chain.robinhood.com",
    // Client flag: use /api/game/testnet-resolve (server key required separately).
    NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE: "1",
  };

  // Server-only relayer key (never NEXT_PUBLIC_*). Hardhat loads contracts/.env.
  const pkFromEnv = (
    process.env.DEPLOYER_PRIVATE_KEY ||
    process.env.TREASURY_PRIVATE_KEY ||
    ""
  ).trim();
  if (pkFromEnv) {
    lines.GAME_TESTNET_RELAYER_PRIVATE_KEY = pkFromEnv.startsWith("0x")
      ? pkFromEnv
      : `0x${pkFromEnv}`;
  } else {
    console.warn(
      "WARN: set GAME_TESTNET_RELAYER_PRIVATE_KEY in .env.local (game owner key)",
    );
  }
  if (thansome) {
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
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(next)) {
      next = next.replace(re, `${key}=${value}`);
    } else {
      next = `${next.trimEnd()}\n${key}=${value}\n`;
    }
  }

  writeFileSync(envPath, next.endsWith("\n") ? next : `${next}\n`);
  console.log("Updated", envPath);
  const publicLines = { ...lines };
  if (publicLines.GAME_TESTNET_RELAYER_PRIVATE_KEY) {
    publicLines.GAME_TESTNET_RELAYER_PRIVATE_KEY = "[set]";
  }
  console.log(JSON.stringify(publicLines, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
