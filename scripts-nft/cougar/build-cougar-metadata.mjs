// Generate the HANSOME Cougars mint package (NO Solidity):
//   - 50 per-token metadata JSONs (byte-identical except the serial name/edition)
//   - contract.json (collection-level metadata, 0% royalties)
//   - allocation-map.json (off-chain distribution plan; NOT in tokenURI, so Token ID stays rarity-neutral)
//   - shared image (the one official Cougar base, used by all 50)
//   - README with the 2-step IPFS pin + CID freeze instructions
// Rules: 50 identical, no rarity, no traits, no special abilities, single class. GDS v1.1 §4.2/§11/§12.3.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SUPPLY = 50;
// Placeholders replaced at IPFS pin time (see README). Can be baked via env for a real pin.
const IMAGE_CID = process.env.IMAGE_CID || "__IMAGE_CID__";
const META_CID = process.env.META_CID || "__METADATA_CID__";
const ROYALTY_BPS = 500; // 5% — HANSOME Genesis royalty policy (Alpaca + Cougar)
const TREASURY = "0x<treasury>";

const BASE = "public/pixel/cougar/mint";
const IMGDIR = path.join(BASE, "image");
const METADIR = path.join(BASE, "metadata");
for (const d of [IMGDIR, METADIR]) fs.mkdirSync(d, { recursive: true });

// shared image — the single official base for all 50
fs.copyFileSync("public/pixel/cougar/cougar-official-base.png", path.join(IMGDIR, "cougar.png"));

const DESC = "One of the 50 HANSOME Cougars — the predators of Alpacas vs Cougars. All 50 Cougars are identical: no rarity, no special abilities, one shared official design. Strength comes only from where you choose to hunt each day.";
const IMAGE = `ipfs://${IMAGE_CID}/cougar.png`;

// the invariant body shared by ALL tokens (everything except name/edition)
const sharedBody = {
  description: DESC,
  image: IMAGE,
  attributes: [
    { trait_type: "Collection", value: "HANSOME Cougars" },
    { trait_type: "Class", value: "Cougar" },
    { trait_type: "Edition Size", value: SUPPLY },
  ],
  hansome: {
    side: "Cougar",
    class: "Cougar",
    identical: true,
    rarity: "none",
    specialAbilities: "none",
    weight: 1,
    gds: "v1.1 §4.2/§11/§12.3 (uniform w^C=1)",
  },
};

for (let id = 1; id <= SUPPLY; id++) {
  const meta = { name: `HANSOME Cougar #${id}`, ...sharedBody, edition: id };
  fs.writeFileSync(path.join(METADIR, `${id}.json`), JSON.stringify(meta, null, 2));
}

// collection-level metadata
const contract = {
  name: "HANSOME Cougars",
  description: "50 identical predators for HANSOME: Alpacas vs Cougars. No rarity, no traits, no special abilities — a single shared official Cougar design. Rules per HANSOME GDS v1.1.",
  image: IMAGE,
  external_link: "https://hansomealpacas.xyz",
  seller_fee_basis_points: ROYALTY_BPS,
  fee_recipient: TREASURY,
};
fs.writeFileSync(path.join(METADIR, "contract.json"), JSON.stringify(contract, null, 2));

// off-chain allocation map (operational only; identical NFTs => id ranges carry NO rarity/advantage)
const allocation = {
  collection: "HANSOME Cougars",
  supply: SUPPLY,
  note: "All 50 Cougars are identical. These buckets only decide WHO receives a token, never WHAT they receive. Token IDs are serial numbers with no rarity or gameplay meaning.",
  buckets: [
    { name: "Public", count: 40, tokenIds: "1-40" },
    { name: "Team / Founder Reserve", count: 5, tokenIds: "41-45" },
    { name: "Community / Event Reserve", count: 5, tokenIds: "46-50" },
  ],
  total: SUPPLY,
};
fs.writeFileSync(path.join(BASE, "allocation-map.json"), JSON.stringify(allocation, null, 2));

// README with pin + freeze steps
const readme = `# HANSOME Cougars — mint package

- \`image/cougar.png\` — the ONE official base, shared by all 50 (1024x1024).
- \`metadata/1.json..50.json\` — per-token metadata, byte-identical except \`name\`/\`edition\`.
- \`metadata/contract.json\` — collection metadata (royalties ${ROYALTY_BPS} bps).
- \`allocation-map.json\` — off-chain distribution (40 Public / 5 Team+Founder / 5 Community+Event).

## IPFS pin (2 steps) + freeze
1. Pin \`image/cougar.png\` → get IMAGE_CID. Re-run: \`IMAGE_CID=<cid> node scripts-nft/cougar/build-cougar-metadata.mjs\` so every JSON \`image\` = \`ipfs://<cid>/cougar.png\`.
2. Pin the \`metadata/\` folder → get METADATA_CID. Contract \`baseURI = ipfs://<METADATA_CID>/\`, so \`tokenURI(id) = ipfs://<METADATA_CID>/<id>.json\`.
3. **Freeze:** after setting baseURI once, renounce the metadata setter so the identical art can never be swapped.

No reveal (instant metadata). No Solidity in this package.
`;
fs.writeFileSync(path.join(BASE, "README.md"), readme);

// verify all bodies identical except name/edition
const norm = (m) => { const c = JSON.parse(JSON.stringify(m)); delete c.name; delete c.edition; return JSON.stringify(c); };
const ref = norm(JSON.parse(fs.readFileSync(path.join(METADIR, "1.json"), "utf8")));
let identical = 0;
for (let id = 1; id <= SUPPLY; id++) if (norm(JSON.parse(fs.readFileSync(path.join(METADIR, `${id}.json`), "utf8"))) === ref) identical++;
console.log(`wrote ${SUPPLY} token JSONs + contract.json + allocation-map.json + README + shared image`);
console.log(`identical bodies (excl. name/edition): ${identical}/${SUPPLY}`);
console.log(`image ref: ${IMAGE}  |  royalties: ${ROYALTY_BPS} bps`);
if (identical !== SUPPLY) process.exitCode = 1;
