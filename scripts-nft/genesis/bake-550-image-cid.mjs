/**
 * Rewrite collection-550 metadata image fields to a real Image CID.
 *
 *   IMAGE_CID=<cid> node scripts-nft/genesis/bake-550-image-cid.mjs
 *
 * Does not pin. Idempotent.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const META = path.join(ROOT, "public/pixel/genesis/collection-550/metadata");
const CID = process.env.IMAGE_CID;

if (!CID || CID === "__IMAGE_CID__" || /[^a-zA-Z0-9]/.test(CID)) {
  console.error("Set IMAGE_CID to a valid CIDv0/v1 string (letters/numbers only).");
  process.exit(1);
}

let n = 0;
for (let i = 1; i <= 550; i++) {
  const p = path.join(META, `${i}.json`);
  const meta = JSON.parse(fs.readFileSync(p, "utf8"));
  meta.image = `ipfs://${CID}/${i}.png`;
  fs.writeFileSync(p, `${JSON.stringify(meta, null, 2)}\n`);
  n++;
}

const contractPath = path.join(META, "contract.json");
if (fs.existsSync(contractPath)) {
  const c = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  c.imageCid = CID;
  c.imageScheme = `ipfs://${CID}/<tokenId>.png`;
  c.updatedAt = new Date().toISOString();
  fs.writeFileSync(contractPath, `${JSON.stringify(c, null, 2)}\n`);
}

console.log(`Baked IMAGE_CID=${CID} into ${n} metadata files.`);
