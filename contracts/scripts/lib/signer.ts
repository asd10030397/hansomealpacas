import { Wallet } from "ethers";
import type { Provider } from "ethers";

function resolvePrivateKey(
  primary: string | undefined,
  fallback: string | undefined,
  envName: string,
): string {
  const privateKey = primary ?? fallback;

  if (!privateKey?.trim()) {
    throw new Error(`Missing ${envName}`);
  }

  return privateKey.trim();
}

export async function getDeployerSigner(provider: Provider): Promise<Wallet> {
  let privateKey: string;
  try {
    privateKey = resolvePrivateKey(
      process.env.DEPLOYER_PRIVATE_KEY,
      process.env.PRIVATE_KEY,
      "DEPLOYER_PRIVATE_KEY",
    );
  } catch (err) {
    // Testnet/dev convenience: allow TREASURY when DEPLOYER is unset (common local .env gap).
    if (process.env.TREASURY_PRIVATE_KEY?.trim()) {
      console.warn(
        "WARNING: DEPLOYER_PRIVATE_KEY missing — using TREASURY_PRIVATE_KEY as deployer signer.",
      );
      privateKey = process.env.TREASURY_PRIVATE_KEY.trim();
    } else {
      throw err;
    }
  }

  const normalized = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const signer = new Wallet(normalized, provider);
  console.log("Signer:", await signer.getAddress());
  return signer;
}

export async function getTreasurySigner(provider: Provider): Promise<Wallet> {
  const privateKey = resolvePrivateKey(
    process.env.TREASURY_PRIVATE_KEY,
    process.env.PRIVATE_KEY,
    "TREASURY_PRIVATE_KEY",
  );

  const signer = new Wallet(privateKey, provider);
  console.log("Signer:", await signer.getAddress());
  return signer;
}

/**
 * Deliberately separate from the Treasury/Deployer signers, with NO fallback
 * to the generic PRIVATE_KEY — this must be a genuinely independent personal
 * wallet (e.g. for an external "organic" market buy), never the project's
 * own Treasury, so it never silently reuses a project-controlled key.
 *
 * Only ever used by market-buy-external.ts. Never logs the key itself — only
 * the derived public address — and if the key is malformed, the underlying
 * ethers error (which can otherwise embed the offending raw value in its
 * `value`/`shortMessage` fields) is deliberately swallowed and replaced with
 * a generic message so a mistyped key can never leak into console output.
 */
export async function getExternalBuyerSigner(provider: Provider): Promise<Wallet> {
  const privateKey = resolvePrivateKey(
    process.env.EXTERNAL_BUYER_PRIVATE_KEY,
    undefined,
    "EXTERNAL_BUYER_PRIVATE_KEY",
  );

  let signer: Wallet;
  try {
    signer = new Wallet(privateKey, provider);
  } catch {
    throw new Error(
      "EXTERNAL_BUYER_PRIVATE_KEY is not a valid private key — check the value in contracts/.env " +
        "(details withheld deliberately so the key can never end up in logs).",
    );
  }

  console.log("Signer:", await signer.getAddress());
  return signer;
}

/**
 * Official Liquidity Wallet ops (batched market buys / mint new v4 LP).
 * Uses LIQUIDITY_PRIVATE_KEY only — no Treasury/Deployer fallback.
 * If LIQUIDITY_EXPECTED_ADDRESS is set, the derived address must match
 * (checksum-insensitive) or the script aborts before any tx.
 */
export async function getLiquidityWalletSigner(provider: Provider): Promise<Wallet> {
  const privateKey = resolvePrivateKey(
    process.env.LIQUIDITY_PRIVATE_KEY,
    undefined,
    "LIQUIDITY_PRIVATE_KEY",
  );

  let signer: Wallet;
  try {
    const normalized = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
    signer = new Wallet(normalized, provider);
  } catch {
    throw new Error(
      "LIQUIDITY_PRIVATE_KEY is not a valid private key — check the value in contracts/.env " +
        "(details withheld deliberately so the key can never end up in logs).",
    );
  }

  const address = await signer.getAddress();
  const expected = process.env.LIQUIDITY_EXPECTED_ADDRESS?.trim();
  if (expected && address.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(
      `LIQUIDITY_PRIVATE_KEY derives ${address}, but LIQUIDITY_EXPECTED_ADDRESS is ${expected}. Aborting.`,
    );
  }

  console.log("Signer:", address);
  return signer;
}
