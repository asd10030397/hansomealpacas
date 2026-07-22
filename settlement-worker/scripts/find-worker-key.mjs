import { privateKeyToAccount } from "viem/accounts";
import fs from "node:fs";
import path from "node:path";

const target = "0x4d68639a5e3ad8fd268f801862d464259656fd6c";
const root = path.resolve(import.meta.dirname, "../..");
const hits = [];

function tryKey(label, raw) {
  if (!raw) return;
  const m = String(raw).trim().match(/^(0x)?([0-9a-fA-F]{64})$/);
  if (!m) return;
  try {
    const addr = privateKeyToAccount(`0x${m[2]}`).address.toLowerCase();
    if (addr === target) hits.push(label);
  } catch {
    /* ignore */
  }
}

function scanFile(fp) {
  let t;
  try {
    t = fs.readFileSync(fp, "utf8");
  } catch {
    return;
  }
  for (const line of t.split(/\r?\n/)) {
    const kv = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
    if (kv) tryKey(`${fp}:${kv[1]}`, kv[2].replace(/^["']|["']$/g, ""));
  }
  const re = /(0x)?([0-9a-fA-F]{64})/g;
  let m;
  while ((m = re.exec(t))) {
    tryKey(`${fp}:raw`, m[0]);
  }
}

for (const rel of [
  "contracts/.env",
  "settlement-worker/.env",
  "settlement-worker/.env.mainnet",
  "settlement-worker/.env.testnet",
  "bot/.env",
  ".env",
  ".env.local",
]) {
  const fp = path.join(root, rel);
  if (fs.existsSync(fp)) scanFile(fp);
}

for (const [k, v] of Object.entries(process.env)) {
  tryKey(`process.env:${k}`, v);
}

console.log(JSON.stringify({ keyFound: hits.length > 0, locations: [...new Set(hits)] }, null, 2));
