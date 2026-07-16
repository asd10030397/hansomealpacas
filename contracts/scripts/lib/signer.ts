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
  const privateKey = resolvePrivateKey(
    process.env.DEPLOYER_PRIVATE_KEY,
    process.env.PRIVATE_KEY,
    "DEPLOYER_PRIVATE_KEY",
  );

  const signer = new Wallet(privateKey, provider);
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
