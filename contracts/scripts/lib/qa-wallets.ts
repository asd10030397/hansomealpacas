/**
 * Load Testnet QA player wallets from repo-root `.qa-wallets.local.json`.
 * Never logs or returns private keys in report helpers.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Wallet, type Provider } from "ethers";

export type QaWalletFile = {
  wallets: Array<{ name?: string; privateKey?: string }>;
};

export type QaPlayer = {
  name: string;
  address: string;
  wallet: Wallet;
};

function normalizePk(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return t.startsWith("0x") ? t : `0x${t}`;
}

function isHexPk(pk: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(pk);
}

/** Absolute path to gitignored QA wallet file (repo root). */
export function qaWalletsPath(): string {
  return join(__dirname, "..", "..", "..", ".qa-wallets.local.json");
}

export function loadQaPlayers(provider: Provider): QaPlayer[] {
  const path = qaWalletsPath();
  if (!existsSync(path)) {
    throw new Error(
      `Missing ${path}. Copy .qa-wallets.example.json → .qa-wallets.local.json and fill private keys.`,
    );
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as QaWalletFile;
  const rows = Array.isArray(parsed.wallets) ? parsed.wallets : [];
  const players: QaPlayer[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const name = (row.name ?? `player${i + 1}`).trim() || `player${i + 1}`;
    const pk = normalizePk(row.privateKey ?? "");
    if (!pk) {
      throw new Error(
        `QA wallet "${name}" has empty privateKey in .qa-wallets.local.json`,
      );
    }
    if (!isHexPk(pk)) {
      throw new Error(
        `QA wallet "${name}" has invalid privateKey format (expected 32-byte hex).`,
      );
    }
    const wallet = new Wallet(pk, provider);
    players.push({ name, address: wallet.address, wallet });
  }
  if (players.length < 1) {
    throw new Error("No QA wallets configured.");
  }
  // Detect duplicate addresses (misconfigured file)
  const seen = new Set<string>();
  for (const p of players) {
    const key = p.address.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`Duplicate QA wallet address: ${p.address}`);
    }
    seen.add(key);
  }
  return players;
}

/** Safe summary for reports — addresses only. */
export function qaPlayersPublic(players: QaPlayer[]): Array<{
  name: string;
  address: string;
}> {
  return players.map((p) => ({ name: p.name, address: p.address }));
}
