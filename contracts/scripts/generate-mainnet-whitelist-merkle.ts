/**
 * Generate Mainnet Genesis Merkle whitelist root + proofs.
 * Offline / no chain txs. Matches HansomeGenesisNFT leaf encoding
 * (OZ StandardMerkleTree of ["address"]).
 *
 * Env:
 *   WHITELIST_ADDRESSES_FILE — path to address list (defaults, in order):
 *     1) ../../data/mainnet/whitelist-addresses.txt  (owner source of truth)
 *     2) deployments/mainnet-whitelist-addresses.txt (legacy ops path)
 *     3) deployments/mainnet-whitelist-addresses.example.txt
 *   OUT_DIR — optional override for output directory
 *
 * Usage:
 *   npx hardhat run scripts/generate-mainnet-whitelist-merkle.ts --network hardhat
 *   npm run genesis:merkle:mainnet
 *
 * Writes (when using a real list, not .example):
 *   deployments/robinhood-genesis-whitelist.mainnet.json
 *   ../../lib/game/mainnet/whitelistProofs.MAINNET.json
 *
 * Does NOT schedule or execute on-chain merkle. See MAINNET_LAUNCH_RUNBOOK §5.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { ethers } from "hardhat";

function resolveAddressesFile(): string {
  const fromEnv = process.env.WHITELIST_ADDRESSES_FILE?.trim();
  if (fromEnv) return fromEnv;

  const ownerCanonical = join(
    __dirname,
    "..",
    "..",
    "data",
    "mainnet",
    "whitelist-addresses.txt",
  );
  if (existsSync(ownerCanonical)) {
    const raw = readFileSync(ownerCanonical, "utf8");
    const hasAddress = raw.split(/\r?\n/).some((line) => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith("#");
    });
    if (hasAddress) return ownerCanonical;
  }

  const legacyOps = join(
    __dirname,
    "..",
    "deployments",
    "mainnet-whitelist-addresses.txt",
  );
  if (existsSync(legacyOps)) {
    const raw = readFileSync(legacyOps, "utf8");
    const hasAddress = raw.split(/\r?\n/).some((line) => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith("#");
    });
    if (hasAddress) return legacyOps;
  }

  // Prefer canonical path in error messages even when still empty (owner edits here).
  if (existsSync(ownerCanonical)) return ownerCanonical;
  if (existsSync(legacyOps)) return legacyOps;

  return join(
    __dirname,
    "..",
    "deployments",
    "mainnet-whitelist-addresses.example.txt",
  );
}

function loadAddresses(path: string): string[] {
  const raw = readFileSync(path, "utf8");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const addr = ethers.getAddress(trimmed);
    const key = addr.toLowerCase();
    if (seen.has(key)) {
      console.warn("Skipping duplicate:", addr);
      continue;
    }
    seen.add(key);
    out.push(addr);
  }
  if (out.length === 0) {
    throw new Error(`No addresses found in ${path}`);
  }
  if (out.length > 100) {
    console.warn(
      `WARNING: ${out.length} addresses > WHITELIST_CAP 100 — on-chain phase still caps at 100 mints.`,
    );
  }
  return out;
}

async function main() {
  const addressesPath = resolveAddressesFile();
  const addresses = loadAddresses(addressesPath);
  console.log("============================================================");
  console.log("SCRIPT:   generate-mainnet-whitelist-merkle.ts");
  console.log("MODE:     OFFLINE (no transactions)");
  console.log("INPUT:   ", addressesPath);
  console.log("COUNT:   ", addresses.length);
  console.log("============================================================");

  const tree = StandardMerkleTree.of(
    addresses.map((a) => [a]),
    ["address"],
  );
  const merkleRoot = tree.root;

  const proofs: Record<string, string[]> = {};
  for (const [i, v] of tree.entries()) {
    const addr = ethers.getAddress(v[0] as string);
    const proof = tree.getProof(i);
    proofs[addr] = proof;
    proofs[addr.toLowerCase()] = proof;
  }

  const payload = {
    warning:
      "MAINNET Genesis whitelist — do not mix with Testnet proofs. " +
      "Leaf encoding matches HansomeGenesisNFT.whitelistMint (OZ StandardMerkleTree address).",
    network: "mainnet",
    chainId: 4663,
    merkleRoot,
    addressCount: addresses.length,
    addresses,
    proofs,
    generatedAt: new Date().toISOString(),
    sourceFile: addressesPath,
  };

  const usingExample = addressesPath.endsWith(
    "mainnet-whitelist-addresses.example.txt",
  );
  const outDir =
    process.env.OUT_DIR?.trim() || join(__dirname, "..", "deployments");
  mkdirSync(outDir, { recursive: true });
  const outName = usingExample
    ? "robinhood-genesis-whitelist.mainnet.EXAMPLE.json"
    : "robinhood-genesis-whitelist.mainnet.json";
  const outPath = join(outDir, outName);
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log("Wrote", outPath);
  console.log("merkleRoot:", merkleRoot);

  if (usingExample) {
    console.warn(
      "WARNING: Used example address list — did NOT overwrite lib/game/mainnet/whitelistProofs.MAINNET.json.",
    );
    console.warn(
      "Edit data/mainnet/whitelist-addresses.txt (owner source of truth), " +
        "then re-run to write production JSON + frontend proofs.",
    );
  } else {
    const feDir = join(__dirname, "..", "..", "lib", "game", "mainnet");
    mkdirSync(feDir, { recursive: true });
    const fePath = join(feDir, "whitelistProofs.MAINNET.json");
    writeFileSync(fePath, `${JSON.stringify(payload, null, 2)}\n`);
    console.log("Wrote", fePath);
  }
  console.log(
    "Next: scheduleWhitelistMerkleRoot / executeWhitelistMerkleRoot with this root.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
