import { Wallet, isAddress, getAddress } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const PLACEHOLDER_KEY =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const PLACEHOLDER_RECIPIENT = "0x0000000000000000000000000000000000000000";

function fail(message: string): never {
  console.error(`Validation failed: ${message}`);
  process.exit(1);
}

function validatePrivateKey(raw: string | undefined): string {
  if (!raw?.trim()) {
    fail("PRIVATE_KEY is missing. Set it in contracts/.env (never commit this file).");
  }

  const key = raw.trim();

  if (!key.startsWith("0x")) {
    fail("PRIVATE_KEY must start with 0x.");
  }

  if (key.length !== 66) {
    fail("PRIVATE_KEY must be 66 characters (0x + 64 hex digits).");
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    fail("PRIVATE_KEY must contain only hexadecimal characters after 0x.");
  }

  if (key.toLowerCase() === PLACEHOLDER_KEY) {
    fail(
      "PRIVATE_KEY is still the placeholder from .env.example. Replace it with your testnet deployer wallet key.",
    );
  }

  return key;
}

function validateRecipient(raw: string | undefined): string {
  if (!raw?.trim()) {
    fail("TOKEN_RECIPIENT is missing. Set it in contracts/.env.");
  }

  const recipient = raw.trim();

  if (!isAddress(recipient)) {
    fail("TOKEN_RECIPIENT is not a valid Ethereum address (expected 0x + 40 hex digits).");
  }

  const normalized = getAddress(recipient);

  if (normalized === PLACEHOLDER_RECIPIENT) {
    fail(
      "TOKEN_RECIPIENT is the zero address. Use the wallet that should receive all 1,000,000,000 UGLY.",
    );
  }

  return normalized;
}

async function main() {
  const privateKey = validatePrivateKey(process.env.PRIVATE_KEY);
  const recipient = validateRecipient(process.env.TOKEN_RECIPIENT);

  const wallet = new Wallet(privateKey);

  console.log("Environment validation passed");
  console.log(`  Deployer address:  ${wallet.address}`);
  console.log(`  Token recipient:   ${recipient}`);
  console.log("  PRIVATE_KEY:       [set, not logged]");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
