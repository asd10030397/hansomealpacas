/**
 * Pin collection-550 folders to IPFS and print CIDs.
 *
 * Providers (first match wins):
 *   1. PINATA_JWT — Pinata pinFileToIPFS (directory)
 *   2. IPFS_API   — local Kubo HTTP API (default http://127.0.0.1:5001)
 *
 * Usage:
 *   node scripts-nft/genesis/pin-550-ipfs.mjs --images
 *   node scripts-nft/genesis/pin-550-ipfs.mjs --metadata
 *   node scripts-nft/genesis/pin-550-ipfs.mjs --all
 *
 * Loads optional dotenv from repo root / contracts without printing secrets:
 *   PINATA_JWT, IPFS_API
 *
 * Writes CIDs to reports/genesis/ipfs-cids.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Blob } from "node:buffer";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PKG = path.join(ROOT, "public/pixel/genesis/collection-550");
const OUT_CID = path.join(ROOT, "reports/genesis/ipfs-cids.json");

function loadEnvFiles() {
  for (const rel of [".env.local", ".env", "contracts/.env"]) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      if (process.env[key]) continue;
      let val = m[2];
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (["PINATA_JWT", "IPFS_API", "IMAGE_CID", "METADATA_CID"].includes(key)) {
        process.env[key] = val;
      }
    }
  }
}

function listFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => !f.startsWith("."))
    .map((f) => ({ name: f, abs: path.join(dir, f) }))
    .filter((f) => fs.statSync(f.abs).isFile())
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

async function pinPinata(dir, name) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return null;

  const form = new FormData();
  const files = listFiles(dir);
  if (!files.length) throw new Error(`No files in ${dir}`);

  for (const f of files) {
    const buf = fs.readFileSync(f.abs);
    const blob = new Blob([buf]);
    // Nested path → directory CID with filenames at root of folder
    form.append("file", blob, `${name}/${f.name}`);
  }
  form.append(
    "pinataMetadata",
    JSON.stringify({ name: `hansome-genesis-550-${name}` }),
  );
  form.append(
    "pinataOptions",
    JSON.stringify({ cidVersion: 1, wrapWithDirectory: false }),
  );

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Pinata ${res.status}: ${body.slice(0, 400)}`);
  const json = JSON.parse(body);
  const cid = json.IpfsHash;
  if (!cid) throw new Error(`Pinata response missing IpfsHash: ${body.slice(0, 200)}`);
  return { provider: "pinata", cid, count: files.length };
}

async function pinLocalIpfs(dir, name) {
  const api = process.env.IPFS_API || "http://127.0.0.1:5001";
  // Probe
  try {
    const ver = await fetch(`${api}/api/v0/version`, { method: "POST" });
    if (!ver.ok) return null;
  } catch {
    return null;
  }

  const form = new FormData();
  const files = listFiles(dir);
  for (const f of files) {
    const buf = fs.readFileSync(f.abs);
    form.append("file", new Blob([buf]), `${name}/${f.name}`);
  }

  const url = `${api}/api/v0/add?recursive=true&wrap-with-directory=false&cid-version=1&pin=true`;
  const res = await fetch(url, { method: "POST", body: form });
  const text = await res.text();
  if (!res.ok) throw new Error(`IPFS API ${res.status}: ${text.slice(0, 400)}`);

  // Last JSON line is typically the directory
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const dirEntry =
    lines.find((l) => l.Name === name || l.Name === `${name}/`) || lines[lines.length - 1];
  const cid = dirEntry?.Hash;
  if (!cid) throw new Error(`Local IPFS add missing Hash: ${text.slice(0, 200)}`);
  return { provider: "ipfs-api", cid, count: files.length, api };
}

async function pinFolder(rel, label) {
  const dir = path.join(PKG, rel);
  if (!fs.existsSync(dir)) throw new Error(`Missing ${dir}`);

  console.log(`Pinning ${rel}/ (${listFiles(dir).length} files)…`);
  let result = await pinPinata(dir, label);
  if (!result) result = await pinLocalIpfs(dir, label);
  if (!result) {
    throw new Error(
      "No IPFS provider available. Set PINATA_JWT (recommended) or run a local Kubo node and set IPFS_API.",
    );
  }
  console.log(`  → ${result.provider}: ${result.cid}`);
  return result;
}

function saveCids(patch) {
  const prev = fs.existsSync(OUT_CID)
    ? JSON.parse(fs.readFileSync(OUT_CID, "utf8"))
    : {};
  const next = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
    package: "public/pixel/genesis/collection-550",
  };
  fs.mkdirSync(path.dirname(OUT_CID), { recursive: true });
  fs.writeFileSync(OUT_CID, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

async function main() {
  loadEnvFiles();
  const args = new Set(process.argv.slice(2));
  const doImages = args.has("--images") || args.has("--all");
  const doMeta = args.has("--metadata") || args.has("--all");
  if (!doImages && !doMeta) {
    console.log(`Usage:
  node scripts-nft/genesis/pin-550-ipfs.mjs --images
  node scripts-nft/genesis/pin-550-ipfs.mjs --metadata
  node scripts-nft/genesis/pin-550-ipfs.mjs --all

Env: PINATA_JWT or IPFS_API`);
    process.exit(1);
  }

  const hasPinata = Boolean(process.env.PINATA_JWT);
  console.log(`Provider probe: PINATA_JWT=${hasPinata ? "set" : "missing"} IPFS_API=${process.env.IPFS_API || "http://127.0.0.1:5001 (default)"}`);

  const patch = {};
  if (doImages) {
    const r = await pinFolder("image", "image");
    patch.imageCid = r.cid;
    patch.imageProvider = r.provider;
    patch.imageCount = r.count;
  }
  if (doMeta) {
    const r = await pinFolder("metadata", "metadata");
    patch.metadataCid = r.cid;
    patch.metadataProvider = r.provider;
    patch.metadataCount = r.count;
  }

  const all = saveCids(patch);
  console.log("\nSaved", OUT_CID);
  console.log(JSON.stringify(all, null, 2));

  if (all.imageCid) {
    console.log(`\nNext: IMAGE_CID=${all.imageCid} node scripts-nft/genesis/bake-550-image-cid.mjs`);
  }
  if (all.metadataCid) {
    console.log(`Then set baseURI = ipfs://${all.metadataCid}/`);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
