/**
 * Full IPFS production publish for collection-550:
 *   validate → pin images → bake CID → pin metadata → verify samples
 *
 *   node scripts-nft/genesis/publish-550-ipfs.mjs
 *
 * Requires PINATA_JWT or local Kubo (IPFS_API).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CID_FILE = path.join(ROOT, "reports/genesis/ipfs-cids.json");

function run(cmd, env = {}) {
  console.log(`\n> ${cmd}`);
  const r = spawnSync(cmd, {
    cwd: ROOT,
    shell: true,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("node scripts-nft/genesis/validate-550-production.mjs");
run("node scripts-nft/genesis/pin-550-ipfs.mjs --images");

const cids = JSON.parse(fs.readFileSync(CID_FILE, "utf8"));
if (!cids.imageCid) {
  console.error("Missing imageCid after pin");
  process.exit(1);
}

run(`node scripts-nft/genesis/bake-550-image-cid.mjs`, { IMAGE_CID: cids.imageCid });
run("node scripts-nft/genesis/pin-550-ipfs.mjs --metadata");

const cids2 = JSON.parse(fs.readFileSync(CID_FILE, "utf8"));
run("node scripts-nft/genesis/verify-550-ipfs.mjs", {
  IMAGE_CID: cids2.imageCid,
  METADATA_CID: cids2.metadataCid,
});

console.log(`
════════════════════════════════════════
IPFS publish complete
  Image CID:    ${cids2.imageCid}
  Metadata CID: ${cids2.metadataCid}
  baseURI:      ipfs://${cids2.metadataCid}/

Testnet (owner):
  cd contracts
  METADATA_CID=${cids2.metadataCid} npx hardhat run scripts/set-genesis-base-uri.ts --network robinhoodTestnet
════════════════════════════════════════
`);
