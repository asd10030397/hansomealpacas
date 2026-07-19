/**
 * Server-only Testnet commit secret vault.
 * Salts are stored at Commit so the gasless relayer can reveal without localStorage.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Hex } from "viem";

export type VaultCommitSecret = {
  tokenId: number;
  day: number;
  locationId: number;
  salt: Hex;
  commitHash: Hex;
  wallet: string;
  updatedAt: number;
};

type VaultFile = {
  version: 1;
  secrets: VaultCommitSecret[];
};

const VAULT_DIR = join(process.cwd(), ".data");
const VAULT_PATH = join(VAULT_DIR, "testnet-commit-vault.json");

function readVault(): VaultFile {
  try {
    if (!existsSync(VAULT_PATH)) return { version: 1, secrets: [] };
    const parsed = JSON.parse(readFileSync(VAULT_PATH, "utf8")) as VaultFile;
    if (!parsed || !Array.isArray(parsed.secrets)) {
      return { version: 1, secrets: [] };
    }
    return { version: 1, secrets: parsed.secrets };
  } catch {
    return { version: 1, secrets: [] };
  }
}

function writeVault(file: VaultFile): void {
  if (!existsSync(VAULT_DIR)) mkdirSync(VAULT_DIR, { recursive: true });
  writeFileSync(VAULT_PATH, `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

export function upsertVaultCommitSecret(
  input: Omit<VaultCommitSecret, "updatedAt">,
): VaultCommitSecret {
  const wallet = input.wallet.trim().toLowerCase();
  const next: VaultCommitSecret = {
    ...input,
    wallet,
    updatedAt: Date.now(),
  };
  const file = readVault();
  const others = file.secrets.filter(
    (s) => !(s.day === next.day && s.tokenId === next.tokenId),
  );
  writeVault({ version: 1, secrets: [...others, next] });
  return next;
}

export function listVaultSecretsForDay(day: number): VaultCommitSecret[] {
  return readVault().secrets.filter((s) => s.day === day);
}

export function vaultSecretCountForDay(day: number): number {
  return listVaultSecretsForDay(day).length;
}
