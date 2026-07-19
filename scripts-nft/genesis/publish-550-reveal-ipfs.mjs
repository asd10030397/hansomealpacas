/**
 * Full Robinhood Testnet IPFS publish (images → shuffle bake → metadata → verify).
 *
 * Requires PINATA_JWT in .env.local or contracts/.env (never committed).
 *
 *   node scripts-nft/genesis/publish-550-reveal-ipfs.mjs
 *
 * Optional:
 *   REVEAL_SEED=0x...   (reuse a prior seed; otherwise generated)
 *   SKIP_PIN_IMAGES=1   (reuse IMAGE_CID from reports/genesis/ipfs-cids.json)
 *   SKIP_PIN_METADATA=1
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pinDirectory } from "./pin-directory-ipfs.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PKG = path.join(ROOT, "public/pixel/genesis/collection-550");
const IMG = path.join(PKG, "image");
const PRE = path.join(ROOT, "public/pixel/genesis/pre-reveal");
const CID_FILE = path.join(ROOT, "reports/genesis/ipfs-cids.json");
const REPORT = path.join(ROOT, "reports/genesis/ipfs-publish-report.md");

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

function saveCids(patch) {
  const prev = fs.existsSync(CID_FILE)
    ? JSON.parse(fs.readFileSync(CID_FILE, "utf8"))
    : {};
  const next = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
    package: "public/pixel/genesis/collection-550",
  };
  fs.mkdirSync(path.dirname(CID_FILE), { recursive: true });
  fs.writeFileSync(CID_FILE, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

function ensurePlaceholderInImages() {
  const src = path.join(PRE, "placeholder.png");
  const dest = path.join(IMG, "placeholder.png");
  if (!fs.existsSync(src)) throw new Error("Missing pre-reveal/placeholder.png");
  fs.copyFileSync(src, dest);
  console.log("Copied placeholder.png into image/");
}

async function main() {
  // 0) Validate production package
  run("node scripts-nft/genesis/validate-550-production.mjs");

  ensurePlaceholderInImages();

  let cids = fs.existsSync(CID_FILE)
    ? JSON.parse(fs.readFileSync(CID_FILE, "utf8"))
    : {};

  // 1–2) Pin images
  if (process.env.SKIP_PIN_IMAGES === "1" && cids.imageCid) {
    console.log("SKIP_PIN_IMAGES — using", cids.imageCid);
  } else {
    const img = await pinDirectory(IMG, "image");
    cids = saveCids({
      imageCid: img.cid,
      imageProvider: img.provider,
      imageCount: img.count,
    });
  }
  const imageCid = cids.imageCid;
  if (!imageCid) throw new Error("Missing imageCid");

  // 3–5) Reveal shuffle + bake metadata
  run("node scripts-nft/genesis/bake-550-reveal-metadata.mjs", {
    IMAGE_CID: imageCid,
    REVEAL_SEED: process.env.REVEAL_SEED || "",
  });

  // 6) Validate baked reveal metadata
  run("node scripts-nft/genesis/validate-550-reveal-metadata.mjs", {
    IMAGE_CID: imageCid,
  });

  // 7–8) Pin reveal metadata
  const metaDir = path.join(PKG, "reveal-metadata");
  if (process.env.SKIP_PIN_METADATA === "1" && cids.metadataCid) {
    console.log("SKIP_PIN_METADATA — using", cids.metadataCid);
  } else {
    const meta = await pinDirectory(metaDir, "metadata");
    cids = saveCids({
      metadataCid: meta.cid,
      metadataProvider: meta.provider,
      metadataCount: meta.count,
    });
  }

  // Placeholder JSON pin (real URI)
  const phDir = path.join(PKG, "placeholder-pin");
  fs.rmSync(phDir, { recursive: true, force: true });
  fs.mkdirSync(phDir, { recursive: true });
  const ph = {
    name: "HANSOME Genesis (Unrevealed)",
    description:
      "A HANSOME Genesis NFT awaiting reveal. Side, class, and traits are hidden until the collection reveal.",
    image: `ipfs://${imageCid}/placeholder.png`,
    attributes: [{ trait_type: "Status", value: "Unrevealed" }],
  };
  fs.writeFileSync(path.join(phDir, "placeholder.json"), `${JSON.stringify(ph, null, 2)}\n`);
  const phPin = await pinDirectory(phDir, "placeholder");
  const placeholderURI = `ipfs://${phPin.cid}/placeholder.json`;
  cids = saveCids({
    placeholderCid: phPin.cid,
    placeholderURI,
  });

  // 9) Gateway verify
  run("node scripts-nft/genesis/verify-550-reveal-ipfs.mjs", {
    IMAGE_CID: imageCid,
    METADATA_CID: cids.metadataCid,
  });

  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, "reports/genesis/reveal-shuffle-manifest.json"), "utf8"),
  );

  const md = [
    "# IPFS Publish Report — Robinhood Testnet",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Deliverables",
    "",
    `- **Image CID:** \`${imageCid}\``,
    `- **Metadata CID:** \`${cids.metadataCid}\``,
    `- **Placeholder URI:** \`${placeholderURI}\``,
    `- **Reveal seed:** \`${manifest.revealSeed}\``,
    `- **Sale identity commitment:** \`${manifest.saleIdentityCommitment}\``,
    "",
    "## Next (on-chain, owner)",
    "",
    "```bash",
    "cd contracts",
    `METADATA_CID=${cids.metadataCid} npx hardhat run scripts/set-genesis-base-uri.ts --network robinhoodTestnet`,
    `# Placeholder (timelocked): schedule then execute PLACEHOLDER_URI=${placeholderURI}`,
    "```",
    "",
    "## Reveal note",
    "",
    "`requestReveal` requires sale sell-out (540). Current smoke deploy may have fewer mints.",
    "Mock fulfill must use the recorded reveal seed. Metadata is baked for that seed.",
    "",
    "See `reports/genesis/reveal-shuffle-manifest.md` and `ipfs-verify-reveal.md`.",
    "",
  ].join("\n");
  fs.writeFileSync(REPORT, md);
  console.log("\n" + md);
  console.log("Saved", path.relative(ROOT, REPORT));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
