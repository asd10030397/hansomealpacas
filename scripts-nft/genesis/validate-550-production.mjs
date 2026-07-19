/**
 * Deep production validation for collection-550 (artwork + metadata).
 *
 *   node scripts-nft/genesis/validate-550-production.mjs
 *
 * Checks: coverage, dimensions/format, duplicate hashes, token IDs/names,
 * traits, rarity fields, Founder/Reserved/Legendary/Alpaca/Cougar assignments.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PKG = path.join(ROOT, "public/pixel/genesis/collection-550");
const IMG = path.join(PKG, "image");
const META = path.join(PKG, "metadata");
const REPORT = path.join(ROOT, "reports/genesis/ipfs-production-validation.md");

const EXPECTED_CLASSES = {
  King: 1,
  Guardian: 5,
  Farmer: 5,
  Lucky: 5,
  Runner: 5,
  Common: 479,
};

const EXPECTED_RESERVED = {
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

function attr(meta, trait) {
  return meta.attributes?.find((a) => a.trait_type === trait)?.value ?? null;
}

function classOf(meta) {
  return meta.hansome?.gameplayClass || attr(meta, "Gameplay Class") || "UNKNOWN";
}

function sideOf(meta) {
  return meta.hansome?.side || attr(meta, "Side") || "MISSING";
}

function typeOf(meta) {
  return meta.hansome?.type || attr(meta, "Type") || "MISSING";
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function main() {
  const issues = [];
  const warnings = [];
  const dims = new Map();
  const formats = new Map();
  const hashToIds = new Map();
  const classCounts = {};
  const sideCounts = {};
  const typeCounts = {};
  let images = 0;
  let metadata = 0;
  let expectedW = null;
  let expectedH = null;

  for (let i = 1; i <= 550; i++) {
    const ip = path.join(IMG, `${i}.png`);
    const mp = path.join(META, `${i}.json`);

    if (!fs.existsSync(ip)) {
      issues.push(`missing image/${i}.png`);
    } else {
      images++;
      const buf = fs.readFileSync(ip);
      const hash = sha256(buf);
      if (!hashToIds.has(hash)) hashToIds.set(hash, []);
      hashToIds.get(hash).push(i);

      try {
        const info = await sharp(buf).metadata();
        const key = `${info.width}x${info.height}`;
        dims.set(key, (dims.get(key) || 0) + 1);
        formats.set(info.format, (formats.get(info.format) || 0) + 1);
        if (info.format !== "png") issues.push(`non-png format token ${i}: ${info.format}`);
        if (expectedW == null) {
          expectedW = info.width;
          expectedH = info.height;
        } else if (info.width !== expectedW || info.height !== expectedH) {
          issues.push(
            `dimension mismatch #${i}: ${info.width}x${info.height} (expected ${expectedW}x${expectedH})`,
          );
        }
      } catch (e) {
        issues.push(`unreadable image #${i}: ${e.message}`);
      }
    }

    if (!fs.existsSync(mp)) {
      issues.push(`missing metadata/${i}.json`);
      continue;
    }

    metadata++;
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(mp, "utf8"));
    } catch (e) {
      issues.push(`invalid JSON metadata/${i}.json: ${e.message}`);
      continue;
    }

    if (meta.edition !== i) issues.push(`edition mismatch #${i}: got ${meta.edition}`);
    if (!meta.name || typeof meta.name !== "string") issues.push(`missing name #${i}`);
    else if (!meta.name.includes(`#${i}`) && !meta.name.includes(`#${String(i).padStart(3, "0")}`)) {
      // Allow "#1" or "#001" style
      if (!new RegExp(`#0*${i}\\b`).test(meta.name)) {
        issues.push(`name missing token id #${i}: ${meta.name}`);
      }
    }
    if (!meta.description || String(meta.description).length < 8) {
      issues.push(`weak/missing description #${i}`);
    }

    const imageUri = meta.image || "";
    if (!imageUri.includes("__IMAGE_CID__") && !/^ipfs:\/\/[a-zA-Z0-9]+\/\d+\.png$/.test(imageUri)) {
      issues.push(`bad image URI #${i}: ${imageUri}`);
    } else if (imageUri.endsWith(".png") && !imageUri.endsWith(`/${i}.png`)) {
      issues.push(`image URI file mismatch #${i}: ${imageUri}`);
    }

    const side = sideOf(meta);
    const type = typeOf(meta);
    sideCounts[side] = (sideCounts[side] || 0) + 1;
    typeCounts[type] = (typeCounts[type] || 0) + 1;

    if (i <= 500) {
      if (side !== "Alpaca") issues.push(`side mismatch #${i}: ${side}`);
      const cls = classOf(meta);
      classCounts[cls] = (classCounts[cls] || 0) + 1;
      if (attr(meta, "Side") !== "Alpaca") issues.push(`attr Side mismatch #${i}`);
      if (attr(meta, "Gameplay Class") !== cls && meta.hansome?.gameplayClass !== cls) {
        warnings.push(`class attr drift #${i}`);
      }
      if (i <= 10) {
        if (type !== "Reserved") issues.push(`reserved type #${i}: got ${type}`);
        if (EXPECTED_RESERVED[i] !== cls) {
          issues.push(`reserved class #${i}: got ${cls} want ${EXPECTED_RESERVED[i]}`);
        }
        if (i === 1) {
          const arch = attr(meta, "Archetype") || "";
          if (!/Founder/i.test(arch) && !meta.name.includes("Founder")) {
            issues.push(`#1 missing Founder marker (Archetype/name)`);
          }
        }
      }
    } else {
      if (side !== "Cougar") issues.push(`side mismatch #${i}: ${side}`);
      if (type !== "Cougar") issues.push(`cougar type #${i}: got ${type}`);
      if (classOf(meta) !== "None" && attr(meta, "Gameplay Class") !== "None") {
        // accept hansome.class === Cougar with Gameplay Class None
        if (attr(meta, "Gameplay Class") !== "None") {
          issues.push(`cougar gameplay class #${i}: ${attr(meta, "Gameplay Class")}`);
        }
      }
    }

    // Public rarity: only Public Commons should carry rarity model fields if present
    if (type === "Public") {
      const rarity = attr(meta, "Rarity") ?? meta.hansome?.rarity;
      // rarity optional on package; if present must be a string
      if (rarity != null && typeof rarity !== "string" && typeof rarity !== "number") {
        issues.push(`bad rarity #${i}`);
      }
    }
    if (type === "Legendary" || type === "Reserved") {
      if (meta.hansome?.excludedFromRarity === false) {
        warnings.push(`special #${i} not marked excludedFromRarity`);
      }
    }
  }

  // Duplicate hashes
  const dupAlpaca = [];
  const cougarHashes = new Set();
  for (const [hash, ids] of hashToIds) {
    const alpacas = ids.filter((id) => id <= 500);
    const cougars = ids.filter((id) => id >= 501);
    if (alpacas.length > 1) dupAlpaca.push(`alpaca duplicate art: ${alpacas.join(", ")}`);
    if (cougars.length) cougarHashes.add(hash);
    // Cougars may share art with each other (expected)
    if (cougars.length && cougars.length < 50 && alpacas.length === 0) {
      // partial cougar group sharing is ok if not all 50 — still warn if mixed with alpaca
    }
    if (alpacas.length && cougars.length) {
      issues.push(`alpaca/cougar shared hash across ${ids.slice(0, 8).join(",")}…`);
    }
  }
  issues.push(...dupAlpaca);

  const cougarIds = [];
  for (let i = 501; i <= 550; i++) {
    if (fs.existsSync(path.join(IMG, `${i}.png`))) cougarIds.push(i);
  }
  if (cougarIds.length === 50) {
    const hashes = cougarIds.map((id) => sha256(fs.readFileSync(path.join(IMG, `${id}.png`))));
    const unique = new Set(hashes);
    if (unique.size !== 1) {
      warnings.push(`cougars not byte-identical (${unique.size} unique hashes; expected 1)`);
    }
  }

  const classOk = Object.entries(EXPECTED_CLASSES).every(([k, v]) => classCounts[k] === v);
  if (!classOk) issues.push("class distribution mismatch");

  if (sideCounts.Alpaca !== 500) issues.push(`Alpaca count ${sideCounts.Alpaca ?? 0} ≠ 500`);
  if (sideCounts.Cougar !== 50) issues.push(`Cougar count ${sideCounts.Cougar ?? 0} ≠ 50`);
  if ((typeCounts.Reserved ?? 0) !== 10) issues.push(`Reserved count ${typeCounts.Reserved ?? 0} ≠ 10`);
  if ((typeCounts.Cougar ?? 0) !== 50) issues.push(`Type=Cougar count ${typeCounts.Cougar ?? 0} ≠ 50`);

  const legendary = typeCounts.Legendary ?? 0;
  const publicN = typeCounts.Public ?? 0;
  if (legendary + publicN + (typeCounts.Reserved ?? 0) !== 500) {
    warnings.push(
      `Alpaca type sum Legendary(${legendary})+Public(${publicN})+Reserved(${typeCounts.Reserved ?? 0}) ≠ 500`,
    );
  }

  const pass =
    issues.length === 0 && images === 550 && metadata === 550 && classOk;

  const report = [
    "# IPFS Production Package — Validation Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `## Result: **${pass ? "PASS" : "FAIL"}**`,
    "",
    "## Artwork",
    "",
    `- Images present (1–550): **${images}/550**`,
    `- Dimensions: ${[...dims.entries()].map(([k, v]) => `${k} × ${v}`).join(", ") || "n/a"}`,
    `- Formats: ${[...formats.entries()].map(([k, v]) => `${k} × ${v}`).join(", ") || "n/a"}`,
    `- Canonical size: **${expectedW ?? "?"}×${expectedH ?? "?"}**`,
    `- Shared cougar.png: **${fs.existsSync(path.join(IMG, "cougar.png"))}**`,
    `- Unique image hashes: **${hashToIds.size}**`,
    `- Alpaca duplicate art issues: **${dupAlpaca.length}**`,
    `- Cougar identical art: **${cougarHashes.size === 1 ? "yes (expected)" : `unique hashes=${cougarHashes.size}`}**`,
    "",
    "## Metadata",
    "",
    `- JSON present (1–550): **${metadata}/550**`,
    `- contract.json: **${fs.existsSync(path.join(META, "contract.json"))}**`,
    "",
    "### Class distribution (Alpacas 1–500)",
    "",
    ...Object.entries(EXPECTED_CLASSES).map(
      ([k, v]) => `- ${k}: ${classCounts[k] ?? 0} (expected ${v})`,
    ),
    "",
    `Class check: **${classOk ? "PASS" : "FAIL"}**`,
    "",
    "### Side / Type",
    "",
    ...Object.entries(sideCounts).map(([k, v]) => `- Side ${k}: ${v}`),
    ...Object.entries(typeCounts).map(([k, v]) => `- Type ${k}: ${v}`),
    "",
    "### Reserved #001–#010",
    "",
    ...Object.entries(EXPECTED_RESERVED).map(([id, cls]) => {
      const meta = JSON.parse(fs.readFileSync(path.join(META, `${id}.json`), "utf8"));
      const got = classOf(meta);
      const ok = got === cls ? "OK" : "FAIL";
      return `- #${String(id).padStart(3, "0")}: ${got} (expected ${cls}) — ${ok}`;
    }),
    "",
    "### Founder",
    "",
    (() => {
      const m = JSON.parse(fs.readFileSync(path.join(META, "1.json"), "utf8"));
      return `- #001 name: ${m.name}\n- Archetype: ${attr(m, "Archetype")}\n- Type: ${typeOf(m)} / Class: ${classOf(m)}`;
    })(),
    "",
    "## Issues",
    "",
    issues.length ? issues.map((x) => `- ${x}`).join("\n") : "- none",
    "",
    "## Warnings",
    "",
    warnings.length ? warnings.map((x) => `- ${x}`).join("\n") : "- none",
    "",
    "## Notes",
    "",
    "- Off-chain package IDs 1–500 Alpaca / 501–550 Cougar are for IPFS provenance.",
    "- On-chain sale side assignment is shuffled at reveal (unchanged).",
    "- Image URIs may still use `__IMAGE_CID__` until bake + pin.",
    "",
  ].join("\n");

  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, report);
  console.log(report);
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
