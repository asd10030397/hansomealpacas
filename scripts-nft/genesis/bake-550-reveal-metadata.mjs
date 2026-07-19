/**
 * Bake post-reveal metadata for tokenURI(id) = baseURI + id + ".json"
 *
 * - Reserved #001–#010: fixed (package identities 1–10)
 * - Sale #011–#550: Fisher–Yates shuffle matching on-chain processReveal
 *
 * Requires IMAGE_CID (already pinned image folder).
 * Optional REVEAL_SEED (uint256 hex/decimal). If unset, generates and records one.
 *
 *   IMAGE_CID=<cid> node scripts-nft/genesis/bake-550-reveal-metadata.mjs
 *
 * Outputs:
 *   public/pixel/genesis/collection-550/reveal-metadata/<tokenId>.json
 *   reports/genesis/reveal-shuffle-manifest.json
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { keccak256 } from "./lib/ethers-local.mjs";
import {
  buildSaleIdentityBytes,
  packedClassLabel,
  simulateSaleRevealShuffle,
} from "./lib/reveal-fy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PKG = path.join(ROOT, "public/pixel/genesis/collection-550");
const SRC_META = path.join(PKG, "metadata");
const OUT_META = path.join(PKG, "reveal-metadata");
const REPORT = path.join(ROOT, "reports/genesis/reveal-shuffle-manifest.json");
const REPORT_MD = path.join(ROOT, "reports/genesis/reveal-shuffle-manifest.md");

const IMAGE_CID = process.env.IMAGE_CID;
if (!IMAGE_CID || IMAGE_CID.includes("__") || /[^a-zA-Z0-9]/.test(IMAGE_CID)) {
  console.error("Set IMAGE_CID to the pinned image directory CID.");
  process.exit(1);
}

function classOf(meta) {
  return (
    meta.hansome?.gameplayClass ||
    meta.attributes?.find((a) => a.trait_type === "Gameplay Class")?.value ||
    "UNKNOWN"
  );
}

function sideOf(meta) {
  return (
    meta.hansome?.side ||
    meta.attributes?.find((a) => a.trait_type === "Side")?.value ||
    "MISSING"
  );
}

function typeOf(meta) {
  return meta.hansome?.type || meta.attributes?.find((a) => a.trait_type === "Type")?.value;
}

/** Sale deck package IDs aligned with buildSaleIdentities() byte order. */
function buildPackageSaleDeck() {
  const legendary = { Guardian: [], Farmer: [], Lucky: [], Runner: [] };
  const commons = [];
  const cougars = [];

  for (let i = 1; i <= 550; i++) {
    const meta = JSON.parse(fs.readFileSync(path.join(SRC_META, `${i}.json`), "utf8"));
    const side = sideOf(meta);
    const type = typeOf(meta);
    const cls = classOf(meta);
    if (side === "Cougar") cougars.push(i);
    else if (type === "Public" && cls === "Common") commons.push(i);
    else if (type === "Legendary" && legendary[cls]) legendary[cls].push(i);
  }

  cougars.sort((a, b) => a - b);
  commons.sort((a, b) => a - b);
  for (const k of Object.keys(legendary)) legendary[k].sort((a, b) => a - b);

  if (cougars.length !== 50) throw new Error(`cougars ${cougars.length}`);
  if (commons.length !== 479) throw new Error(`commons ${commons.length}`);
  if (legendary.Guardian.length !== 3) throw new Error("legendary guardian");
  if (legendary.Farmer.length !== 3) throw new Error("legendary farmer");
  if (legendary.Lucky.length !== 3) throw new Error("legendary lucky");
  if (legendary.Runner.length !== 2) throw new Error("legendary runner");

  return [
    ...cougars,
    ...commons,
    ...legendary.Guardian,
    ...legendary.Farmer,
    ...legendary.Lucky,
    ...legendary.Runner,
  ];
}

function rewriteName(name, identityId, tokenId) {
  if (typeof name !== "string") return `HANSOME Genesis #${tokenId}`;
  // Replace first #identity occurrence with #tokenId
  const re = new RegExp(`#0*${identityId}\\b`);
  if (re.test(name)) return name.replace(re, `#${tokenId}`);
  if (name.includes(`#${identityId}`)) {
    return name.replace(`#${identityId}`, `#${tokenId}`);
  }
  return name.replace(/^HANSOME Genesis #\d+/, `HANSOME Genesis #${tokenId}`);
}

function bakeToken(tokenId, identityId) {
  const src = JSON.parse(
    fs.readFileSync(path.join(SRC_META, `${identityId}.json`), "utf8"),
  );
  const out = structuredClone(src);
  out.edition = tokenId;
  out.name = rewriteName(src.name, identityId, tokenId);
  out.image = `ipfs://${IMAGE_CID}/${identityId}.png`;
  out.hansome = {
    ...(out.hansome || {}),
    tokenId,
    packageIdentityId: identityId,
    revealMapped: tokenId !== identityId,
  };
  return out;
}

function main() {
  const packed = buildSaleIdentityBytes();
  const deck = buildPackageSaleDeck();
  if (deck.length !== 540) throw new Error("deck length");

  // Verify deck packed classes match committed identity bytes
  for (let i = 0; i < 540; i++) {
    const meta = JSON.parse(
      fs.readFileSync(path.join(SRC_META, `${deck[i]}.json`), "utf8"),
    );
    const expect = packedClassLabel(packed[i]);
    const side = sideOf(meta);
    const cls = classOf(meta);
    if (side !== expect.side || cls !== expect.class) {
      throw new Error(
        `deck[${i}] package ${deck[i]} is ${side}/${cls}, expected ${expect.side}/${expect.class}`,
      );
    }
  }

  let seed = process.env.REVEAL_SEED?.trim();
  if (!seed) {
    seed = `0x${crypto.randomBytes(32).toString("hex")}`;
  }
  if (!seed.startsWith("0x")) seed = `0x${seed}`;

  const indices = simulateSaleRevealShuffle(seed, 540);
  const assignments = {};
  for (let t = 0; t < 540; t++) {
    const tokenId = 11 + t;
    const identityId = deck[indices[t]];
    assignments[String(tokenId)] = identityId;
  }

  fs.rmSync(OUT_META, { recursive: true, force: true });
  fs.mkdirSync(OUT_META, { recursive: true });

  // Reserved 1–10 fixed
  for (let id = 1; id <= 10; id++) {
    const meta = bakeToken(id, id);
    meta.hansome.revealMapped = false;
    meta.hansome.reservedFixed = true;
    fs.writeFileSync(path.join(OUT_META, `${id}.json`), `${JSON.stringify(meta, null, 2)}\n`);
  }

  for (let tokenId = 11; tokenId <= 550; tokenId++) {
    const identityId = assignments[String(tokenId)];
    const meta = bakeToken(tokenId, identityId);
    fs.writeFileSync(
      path.join(OUT_META, `${tokenId}.json`),
      `${JSON.stringify(meta, null, 2)}\n`,
    );
  }

  // contract.json for marketplace (testnet treasury; confirm before mainnet)
  const treasury =
    process.env.FEE_RECIPIENT ||
    process.env.ROYALTY_RECEIVER ||
    "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A";
  const contractJson = {
    name: "HANSOME Genesis NFT",
    description:
      "Single Genesis collection: 550 = 500 Alpaca + 50 Cougar. Revealed metadata uses shuffled sale assignments for #011–#550; reserved #001–#010 are fixed.",
    seller_fee_basis_points: 500,
    fee_recipient: treasury,
    imageCid: IMAGE_CID,
    imageScheme: `ipfs://${IMAGE_CID}/<packageIdentityId>.png`,
    updatedAt: new Date().toISOString(),
    networkNote: "fee_recipient set for Robinhood Testnet treasury — confirm before Mainnet",
  };
  fs.writeFileSync(
    path.join(OUT_META, "contract.json"),
    `${JSON.stringify(contractJson, null, 2)}\n`,
  );

  const commitment = keccak256(packed);
  const manifest = {
    network: "robinhoodTestnet",
    generatedAt: new Date().toISOString(),
    imageCid: IMAGE_CID,
    revealSeed: seed,
    saleIdentityCommitment: commitment,
    reservedFixed: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    saleCap: 540,
    firstSaleId: 11,
    packageSaleDeck: deck,
    identityIndexBySaleSlot: indices,
    tokenIdToPackageIdentityId: assignments,
    notes: [
      "Images remain identity-indexed: ipfs://IMAGE_CID/<packageIdentityId>.png",
      "tokenURI(N) resolves reveal-metadata/N.json after setBaseURI(ipfs://METADATA_CID/)",
      "On-chain requestReveal must use the same packed identities (buildSaleIdentities)",
      "Mock fulfill must use the same revealSeed recorded here",
    ],
  };

  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, `${JSON.stringify(manifest, null, 2)}\n`);

  const sample = [1, 2, 10, 11, 12, 100, 250, 500, 501, 550].map((id) => {
    const m = JSON.parse(fs.readFileSync(path.join(OUT_META, `${id}.json`), "utf8"));
    return `- #${id}: packageIdentity=${m.hansome.packageIdentityId} · ${sideOf(m)}/${classOf(m)} · ${m.name}`;
  });

  fs.writeFileSync(
    REPORT_MD,
    [
      "# Reveal shuffle manifest",
      "",
      `Generated: ${manifest.generatedAt}`,
      "",
      `- Image CID: \`${IMAGE_CID}\``,
      `- Reveal seed: \`${seed}\``,
      `- Sale identity commitment: \`${commitment}\``,
      `- Output: \`public/pixel/genesis/collection-550/reveal-metadata/\``,
      "",
      "## Samples",
      "",
      ...sample,
      "",
      "## Ops",
      "",
      "1. Pin `reveal-metadata/` → METADATA_CID",
      "2. `setBaseURI(ipfs://METADATA_CID/)` before requestReveal",
      "3. Mock `fulfill(requestId, revealSeed)` with the seed above",
      "4. `processReveal` until collectionRevealed",
      "",
    ].join("\n"),
  );

  console.log(`Baked 550 reveal metadata → ${path.relative(ROOT, OUT_META)}`);
  console.log(`Manifest → ${path.relative(ROOT, REPORT)}`);
  console.log(`Seed ${seed}`);
  console.log(`Commitment ${commitment}`);
}

main();
