/**
 * Validate off-chain Genesis collection-550 package.
 *
 *   node scripts-nft/genesis/validate-550-package.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_550 = path.join(ROOT, "public/pixel/genesis/collection-550");
const OUT_IMG = path.join(OUT_550, "image");
const OUT_META = path.join(OUT_550, "metadata");
const PRE_REVEAL = path.join(ROOT, "public/pixel/genesis/pre-reveal");
const REPORT = path.join(ROOT, "reports/genesis/collection-550-validation.md");

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

function main() {
  if (!fs.existsSync(OUT_META)) {
    console.error("Missing collection-550 — run prepare-550-package.mjs first");
    process.exit(1);
  }

  const classCounts = {};
  const sideCounts = {};
  const missing = [];
  let images = 0;
  let metadata = 0;

  for (let i = 1; i <= 550; i++) {
    const ip = path.join(OUT_IMG, `${i}.png`);
    const mp = path.join(OUT_META, `${i}.json`);
    if (!fs.existsSync(ip)) missing.push(`image/${i}.png`);
    else images++;
    if (!fs.existsSync(mp)) missing.push(`metadata/${i}.json`);
    else {
      metadata++;
      const meta = JSON.parse(fs.readFileSync(mp, "utf8"));
      const side = sideOf(meta);
      sideCounts[side] = (sideCounts[side] || 0) + 1;
      const uri = meta.image || "";
      if (!uri.includes("__IMAGE_CID__") && !uri.startsWith("ipfs://")) {
        missing.push(`bad-image-uri/${i}`);
      }
      if (i <= 500) {
        const cls = classOf(meta);
        classCounts[cls] = (classCounts[cls] || 0) + 1;
        if (side !== "Alpaca") missing.push(`side-mismatch/${i}`);
      } else if (side !== "Cougar") {
        missing.push(`side-mismatch/${i}`);
      }
    }
  }

  const reservedMap = {};
  for (let i = 1; i <= 10; i++) {
    const meta = JSON.parse(fs.readFileSync(path.join(OUT_META, `${i}.json`), "utf8"));
    reservedMap[i] = classOf(meta);
  }

  const expectedReserved = {
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
  for (const [id, cls] of Object.entries(expectedReserved)) {
    if (reservedMap[id] !== cls) missing.push(`reserved-class/${id}: got ${reservedMap[id]} want ${cls}`);
  }

  const expected = { King: 1, Guardian: 5, Farmer: 5, Lucky: 5, Runner: 5, Common: 479 };
  const classOk = Object.entries(expected).every(([k, v]) => classCounts[k] === v);

  const report = [
    "# Genesis collection-550 validation report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Coverage",
    "",
    `- Total images (1–550): **${images}**`,
    `- Total metadata (1–550): **${metadata}**`,
    `- Shared cougar.png present: **${fs.existsSync(path.join(OUT_IMG, "cougar.png"))}**`,
    `- Pre-reveal placeholder: **${fs.existsSync(path.join(PRE_REVEAL, "placeholder.json"))}**`,
    "",
    "## Class distribution (Alpacas 1–500)",
    "",
    ...Object.entries(expected).map(
      ([k, v]) => `- ${k}: ${classCounts[k] ?? 0} (expected ${v})`,
    ),
    "",
    `Class check: **${classOk ? "PASS" : "FAIL"}**`,
    "",
    "## Side distribution",
    "",
    ...Object.entries(sideCounts).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Reserved mapping (#001–#010)",
    "",
    ...Object.entries(reservedMap).map(
      ([id, cls]) => `- #${String(id).padStart(3, "0")}: ${cls}`,
    ),
    "",
    "## Missing / issues",
    "",
    missing.length ? missing.map((m) => `- ${m}`).join("\n") : "- none",
    "",
    "## Notes",
    "",
    "- Off-chain layout only. On-chain reveal/randomization unchanged.",
    "- Image URIs still use `ipfs://__IMAGE_CID__/` placeholders (not pinned).",
    "",
  ].join("\n");

  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, report);
  console.log(report);
  if (!classOk || missing.length || images !== 550 || metadata !== 550) process.exit(1);
}

main();
