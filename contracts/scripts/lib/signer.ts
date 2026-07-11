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
