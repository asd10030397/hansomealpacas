/**
 * Copy deployments/<network>-genesis.json address into the Next.js .env.local.
 *
 * Usage: npx hardhat run scripts/sync-genesis-env.ts --network robinhoodTestnet
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { network } from "hardhat";

async function main() {
  const deploymentsDir = join(__dirname, "..", "deployments");
  const recordPath = join(deploymentsDir, `${network.name}-genesis.json`);
  if (!existsSync(recordPath)) {
    throw new Error(`Missing ${recordPath} — deploy first`);
  }

  const record = JSON.parse(readFileSync(recordPath, "utf8")) as {
    address: string;
    chainId: number;
  };

  const envPath = join(__dirname, "..", "..", ".env.local");
  const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

  const lines: Record<string, string> = {
    NEXT_PUBLIC_GENESIS_NFT_ADDRESS: record.address,
    NEXT_PUBLIC_GAME_CHAIN_ID: String(record.chainId),
    NEXT_PUBLIC_GAME_RPC_URL: "https://rpc.testnet.chain.robinhood.com",
    NEXT_PUBLIC_GAME_EXPLORER: "https://explorer.testnet.chain.robinhood.com",
  };

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
  console.log(JSON.stringify(lines, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
