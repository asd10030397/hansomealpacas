/**
 * Pin a local directory to IPFS via Pinata (JWT) or local Kubo.
 * Never logs secret values.
 *
 *   node scripts-nft/genesis/pin-directory-ipfs.mjs --dir <abs-or-rel> --name <folderName>
 *
 * Prints JSON: { cid, provider, count, name }
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { Blob } from "node:buffer";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(ROOT, "contracts/package.json"));
const FormDataNode = require("form-data");
const axios = require("axios");

function loadEnv() {
  for (const rel of [".env.local", ".env", "contracts/.env"]) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]]) continue;
      let v = m[2];
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (["PINATA_JWT", "PINATA_TOKEN", "IPFS_API"].includes(m[1])) {
        process.env[m[1]] = v;
      }
    }
  }
}

function listFilesRecursive(dir, base = dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) out.push(...listFilesRecursive(abs, base));
    else out.push({ abs, rel: path.relative(base, abs).split(path.sep).join("/") });
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel, undefined, { numeric: true }));
}

async function pinPinata(dir, folderName) {
  const jwt = process.env.PINATA_JWT || process.env.PINATA_TOKEN;
  if (!jwt) return null;

  const files = listFilesRecursive(dir);
  if (!files.length) throw new Error(`No files in ${dir}`);

  const form = new FormDataNode();
  for (const f of files) {
    form.append("file", fs.createReadStream(f.abs), {
      filepath: `${folderName}/${f.rel}`,
    });
  }
  form.append(
    "pinataMetadata",
    JSON.stringify({ name: `hansome-${folderName}` }),
  );
  form.append(
    "pinataOptions",
    JSON.stringify({ cidVersion: 1, wrapWithDirectory: false }),
  );

  try {
    const res = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      form,
      {
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        headers: {
          Authorization: `Bearer ${jwt}`,
          ...form.getHeaders(),
        },
        timeout: 30 * 60 * 1000,
      },
    );
    const hash = res.data?.IpfsHash;
    if (!hash) throw new Error("Pinata missing IpfsHash");
    return { provider: "pinata", cid: hash, count: files.length, name: folderName };
  } catch (e) {
    const msg = e.response?.data
      ? JSON.stringify(e.response.data).slice(0, 300)
      : e.message;
    throw new Error(`Pinata upload failed: ${msg}`);
  }
}

async function pinLocal(dir, folderName) {
  const api = process.env.IPFS_API || "http://127.0.0.1:5001";
  try {
    const ver = await fetch(`${api}/api/v0/version`, { method: "POST" });
    if (!ver.ok) return null;
  } catch {
    return null;
  }

  const files = listFilesRecursive(dir);
  const form = new FormData();
  for (const f of files) {
    form.append("file", new Blob([fs.readFileSync(f.abs)]), `${folderName}/${f.rel}`);
  }
  const url = `${api}/api/v0/add?recursive=true&wrap-with-directory=false&cid-version=1&pin=true`;
  const res = await fetch(url, { method: "POST", body: form });
  const text = await res.text();
  if (!res.ok) throw new Error(`IPFS API ${res.status}: ${text.slice(0, 300)}`);
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const dirEntry =
    lines.find((l) => l.Name === folderName || l.Name === `${folderName}/`) ||
    lines[lines.length - 1];
  if (!dirEntry?.Hash) throw new Error("Local IPFS missing Hash");
  return {
    provider: "ipfs-api",
    cid: dirEntry.Hash,
    count: files.length,
    name: folderName,
  };
}

export async function pinDirectory(dir, folderName) {
  loadEnv();
  const abs = path.isAbsolute(dir) ? dir : path.join(ROOT, dir);
  if (!fs.existsSync(abs)) throw new Error(`Missing dir ${abs}`);
  console.log(`Pinning ${folderName}/ (${listFilesRecursive(abs).length} files)…`);
  let result = await pinPinata(abs, folderName);
  if (!result) result = await pinLocal(abs, folderName);
  if (!result) {
    throw new Error(
      "No IPFS provider. Set PINATA_JWT in .env.local or contracts/.env (never commit).",
    );
  }
  console.log(`  → ${result.provider}: ${result.cid}`);
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const dirIdx = args.indexOf("--dir");
  const nameIdx = args.indexOf("--name");
  if (dirIdx < 0 || nameIdx < 0) {
    console.log(
      "Usage: node scripts-nft/genesis/pin-directory-ipfs.mjs --dir <path> --name <folderName>",
    );
    process.exit(1);
  }
  const result = await pinDirectory(args[dirIdx + 1], args[nameIdx + 1]);
  console.log(JSON.stringify(result));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}
