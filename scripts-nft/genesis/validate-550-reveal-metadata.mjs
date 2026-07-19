/**
 * Validate baked reveal-metadata package (post-shuffle).
 *
 *   IMAGE_CID=<cid> node scripts-nft/genesis/validate-550-reveal-metadata.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "public/pixel/genesis/collection-550/reveal-metadata");
const MANIFEST = path.join(ROOT, "reports/genesis/reveal-shuffle-manifest.json");
const REPORT = path.join(ROOT, "reports/genesis/reveal-metadata-validation.md");
const IMAGE_CID = process.env.IMAGE_CID;

const issues = [];

function classOf(meta) {
  return (
    meta.hansome?.gameplayClass ||
    meta.attributes?.find((a) => a.trait_type === "Gameplay Class")?.value
  );
}
function sideOf(meta) {
  return meta.hansome?.side || meta.attributes?.find((a) => a.trait_type === "Side")?.value;
}

function main() {
  if (!fs.existsSync(OUT)) {
    console.error("Missing reveal-metadata — run bake-550-reveal-metadata.mjs");
    process.exit(1);
  }
  if (!fs.existsSync(MANIFEST)) {
    console.error("Missing reveal-shuffle-manifest.json");
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const cid = IMAGE_CID || manifest.imageCid;

  let count = 0;
  for (let id = 1; id <= 550; id++) {
    const p = path.join(OUT, `${id}.json`);
    if (!fs.existsSync(p)) {
      issues.push(`missing ${id}.json`);
      continue;
    }
    count++;
    const meta = JSON.parse(fs.readFileSync(p, "utf8"));
    if (meta.edition !== id) issues.push(`edition ${id}`);
    const identity = meta.hansome?.packageIdentityId;
    if (!identity) issues.push(`no packageIdentityId ${id}`);
    const expectImg = `ipfs://${cid}/${identity}.png`;
    if (meta.image !== expectImg) issues.push(`image ${id}: ${meta.image}`);
    if (!new RegExp(`#0*${id}\\b`).test(meta.name || "")) {
      issues.push(`name missing #${id}: ${meta.name}`);
    }
    if (id <= 10) {
      if (identity !== id) issues.push(`reserved not fixed ${id}→${identity}`);
      if (sideOf(meta) !== "Alpaca") issues.push(`reserved side ${id}`);
    } else {
      const mapped = manifest.tokenIdToPackageIdentityId[String(id)];
      if (mapped !== identity) issues.push(`manifest mismatch ${id}`);
    }
  }

  // Reserved class check
  const expectRes = {
    1: "King",
    2: "Guardian",
    3: "Guardian",
    4: "Farmer",
    5: "Farmer",
    6: "Lucky",
    7: "Lucky",
    8: "Runner",
    9: "Runner",
    10: "Runner",
  };
  for (const [id, cls] of Object.entries(expectRes)) {
    const meta = JSON.parse(fs.readFileSync(path.join(OUT, `${id}.json`), "utf8"));
    if (classOf(meta) !== cls) issues.push(`reserved class ${id}`);
  }

  // Side counts
  let alpaca = 0;
  let cougar = 0;
  for (let id = 1; id <= 550; id++) {
    const meta = JSON.parse(fs.readFileSync(path.join(OUT, `${id}.json`), "utf8"));
    if (sideOf(meta) === "Alpaca") alpaca++;
    if (sideOf(meta) === "Cougar") cougar++;
  }
  if (alpaca !== 500) issues.push(`alpaca count ${alpaca}`);
  if (cougar !== 50) issues.push(`cougar count ${cougar}`);

  const pass = issues.length === 0 && count === 550;
  const md = [
    "# Reveal metadata validation",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `## Result: **${pass ? "PASS" : "FAIL"}**`,
    "",
    `- Files: ${count}/550`,
    `- Image CID: \`${cid}\``,
    `- Alpaca: ${alpaca} · Cougar: ${cougar}`,
    "",
    "## Issues",
    "",
    issues.length ? issues.map((i) => `- ${i}`).join("\n") : "- none",
    "",
  ].join("\n");
  fs.writeFileSync(REPORT, md);
  console.log(md);
  if (!pass) process.exit(1);
}

main();
