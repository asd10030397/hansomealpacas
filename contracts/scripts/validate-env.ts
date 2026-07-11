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

function validatePrivateKey(
  raw: string | undefined,
  label: string,
  allowFallback?: string | undefined,
): string {
  const value = raw?.trim() || allowFallback?.trim();

  if (!value) {
    fail(`${label} is missing. Set it in contracts/.env (never commit this file).`);
  }

  if (!value.startsWith("0x")) {
    fail(`${label} must start with 0x.`);
  }

  if (value.length !== 66) {
    fail(`${label} must be 66 characters (0x + 64 hex digits).`);
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    fail(`${label} must contain only hexadecimal characters after 0x.`);
  }

  if (value.toLowerCase() === PLACEHOLDER_KEY) {
    fail(`${label} is still the placeholder from .env.example. Replace it with a real wallet key.`);
  }

  return value;
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
  const legacyKey = process.env.PRIVATE_KEY?.trim() || undefined;

  const deployerKey = validatePrivateKey(
    process.env.DEPLOYER_PRIVATE_KEY,
    "DEPLOYER_PRIVATE_KEY",
    legacyKey,
  );
  const treasuryKey = validatePrivateKey(
    process.env.TREASURY_PRIVATE_KEY,
    "TREASURY_PRIVATE_KEY",
    legacyKey,
  );

  const recipient = validateRecipient(process.env.TOKEN_RECIPIENT);

  const deployer = new Wallet(deployerKey);
  const treasury = new Wallet(treasuryKey);

  console.log("Environment validation passed");
  console.log(`  Deployer address:  ${deployer.address}`);
  console.log(`  Treasury address:  ${treasury.address}`);
  console.log(`  Token recipient:   ${recipient}`);
  console.log("  DEPLOYER_PRIVATE_KEY: [set, not logged]");
  console.log("  TREASURY_PRIVATE_KEY: [set, not logged]");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
