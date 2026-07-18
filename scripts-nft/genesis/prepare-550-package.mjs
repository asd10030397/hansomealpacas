/**
 * Track B — prepare off-chain Genesis 550 asset package.
 *
 * - Fix Alpaca class counts to King1 / G5 / F5 / L5 / R5 / Common479
 * - Bind reserved #002–#010 staging art
 * - Add Side=Alpaca to all 500 Alpaca metadata
 * - Merge off-chain layout: 1–500 Alpaca, 501–550 Cougar
 * - Write neutral pre-reveal placeholder
 * - Does NOT change on-chain reveal topology
 * - Does NOT pin to IPFS
 *
 *   node scripts-nft/genesis/prepare-550-package.mjs
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const R = (...p) => path.join(ROOT, ...p);

const MINT_IMG = R("public/pixel/genesis/mint/image");
const MINT_META = R("public/pixel/genesis/mint/metadata");
const OUT_550 = R("public/pixel/genesis/collection-550");
const OUT_IMG = path.join(OUT_550, "image");
const OUT_META = path.join(OUT_550, "metadata");
const PRE_REVEAL = R("public/pixel/genesis/pre-reveal");
const REPORT = R("reports/genesis/collection-550-validation.md");

const DEMOTE_FROM_RESERVED_STAGING = [11, 12, 16, 17, 21, 22, 26, 27, 28];

const traits = JSON.parse(fs.readFileSync(R("public/pixel/traits/traits.json"), "utf8"));
const rarity = JSON.parse(fs.readFileSync(R("public/pixel/traits/rarity.json"), "utf8"));
const compat = JSON.parse(fs.readFileSync(R("public/pixel/traits/compatibility.json"), "utf8"));
const allocation = JSON.parse(
  fs.readFileSync(R("public/pixel/traits/special-21-allocation.json"), "utf8"),
);

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cats = traits.categories;
const nameOf = {};
for (const [ck, cc] of Object.entries(cats)) {
  for (const it of cc.items || []) nameOf[`${ck}:${it.id}`] = it.name;
}
const tierW = (t) => rarity.tiers[t]?.weight ?? 10;
const noneW = rarity.categoryNoneWeight || {};
const defaults = rarity.defaults || {};
const readyItems = (cat) =>
  (cats[cat].items || []).filter((it) => it.status === "ready" || it.status === "default");
function poolFor(cat, optional) {
  const entries = readyItems(cat).map((it) => {
    let w = tierW(it.tier);
    const d = defaults[cat];
    if (d && d.defaultItem === it.id) w = d.defaultWeight;
    return { id: it.id, weight: w };
  });
  if (optional && noneW[cat] != null) entries.unshift({ id: "__none__", weight: noneW[cat] });
  return entries;
}

const TRAIT_ROOT = R("public/pixel/traits");
const W = 1024;
const H = 1024;
const CARD = { r: 255, g: 252, b: 245 };
const PREVDIR = {
  clothing: "clothing/previews",
  necklace: "necklaces/previews",
  mouth: "mouth/previews",
  ears: "ears/previews",
  glasses: "glasses/previews",
  hat: "hats/previews",
};
const hatTags = compat.traitTags.hat || {};
const clothingTags = compat.traitTags.clothing || {};
const BASES = readyItems("base").map((it) => it.id);
const P = {
  bg: poolFor("background", false),
  clothing: poolFor("clothing", true),
  necklace: poolFor("necklace", true),
  mouth: poolFor("mouth", false),
  ears: poolFor("ears", true),
  glasses: poolFor("glasses", true),
  hat: poolFor("hat", true),
  effect: poolFor("effects", true),
};

function pick(rng, entries) {
  const tot = entries.reduce((s, e) => s + e.weight, 0);
  let r = rng() * tot;
  for (const e of entries) {
    if ((r -= e.weight) <= 0) return e.id;
  }
  return entries[entries.length - 1].id;
}

function selectOne(rng) {
  const s = {
    base: BASES[Math.floor(rng() * BASES.length)],
    bg: pick(rng, P.bg),
    fur: "classic",
    clothing: pick(rng, P.clothing),
    necklace: pick(rng, P.necklace),
    mouth: pick(rng, P.mouth),
    ears: pick(rng, P.ears),
    glasses: pick(rng, P.glasses),
    hat: pick(rng, P.hat),
    effect: pick(rng, P.effect),
  };
  if (s.hat !== "__none__" && (hatTags[s.hat] || []).includes("covers-ears")) s.ears = "__none__";
  if (
    s.clothing !== "__none__" &&
    ((clothingTags[s.clothing] || []).includes("covers-neck") ||
      (clothingTags[s.clothing] || []).includes("covers-chest"))
  ) {
    s.necklace = "__none__";
  }
  return s;
}

function comboKey(s) {
  const parts = [`base:${s.base}`, `bg:${s.bg}`, `mouth:${s.mouth}`];
  for (const [c, v] of [
    ["clothing", s.clothing],
    ["necklace", s.necklace],
    ["ears", s.ears],
    ["glasses", s.glasses],
    ["hat", s.hat],
    ["effects", s.effect],
  ]) {
    if (v !== "__none__") parts.push(`${c}:${v}`);
  }
  return crypto.createHash("sha256").update(parts.sort().join("|")).digest("hex");
}

const overlayCache = {};
async function overlay(cat, id, arch) {
  const key = `${cat}:${id}:${arch}`;
  if (overlayCache[key]) return overlayCache[key];
  const p = path.join(TRAIT_ROOT, PREVDIR[cat], `${id}__${arch}.png`);
  if (!fs.existsSync(p)) return null;
  const buf = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  overlayCache[key] = buf;
  return buf;
}

async function renderCommon(s, outPng) {
  const bgPath = path.join(TRAIT_ROOT, "backgrounds", `${s.bg}.png`);
  let img = sharp(bgPath).resize(W, H, { kernel: "nearest" });
  const layers = [{ input: path.join(TRAIT_ROOT, "base/normalized", `${s.base}.png`) }];
  for (const [cat, id] of [
    ["clothing", s.clothing],
    ["necklace", s.necklace],
    ["mouth", s.mouth],
    ["ears", s.ears],
    ["glasses", s.glasses],
    ["hat", s.hat],
  ]) {
    if (id === "__none__") continue;
    const ov = await overlay(cat, id, s.base);
    if (ov) {
      // fall back to preview file composite via sharp input path
      const p = path.join(TRAIT_ROOT, PREVDIR[cat], `${id}__${s.base}.png`);
      if (fs.existsSync(p)) layers.push({ input: p });
    }
  }
  if (s.effect !== "__none__") {
    const ep = path.join(TRAIT_ROOT, "effects/previews", `${s.effect}__${s.base}.png`);
    if (fs.existsSync(ep)) layers.push({ input: ep });
  }
  await img.composite(layers).png().toFile(outPng);
}

function commonMeta(edition, s) {
  const attr = (trait_type, value) => ({ trait_type, value });
  const disp = (cat, id) => (id === "__none__" ? "None" : nameOf[`${cat}:${id}`] || id);
  return {
    name: `HANSOME Genesis #${edition}`,
    description:
      "A HANSOME Genesis alpaca — an original individual of the cozy countryside HANSOME universe. Handcrafted pixel art. Not the mascot.",
    image: `ipfs://__IMAGE_CID__/${edition}.png`,
    edition,
    attributes: [
      attr("Side", "Alpaca"),
      attr("Type", "Public"),
      attr("Gameplay Class", "Common"),
      attr("Background", disp("background", s.bg)),
      attr("Archetype", disp("base", s.base)),
      attr("Wool", "Classic"),
      attr("Clothing", disp("clothing", s.clothing)),
      attr("Neck Accessory", disp("necklace", s.necklace)),
      attr("Mouth", disp("mouth", s.mouth)),
      attr("Ear Accessory", disp("ears", s.ears)),
      attr("Glasses", disp("glasses", s.glasses)),
      attr("Hat", disp("hat", s.hat)),
      attr("Effect", disp("effects", s.effect)),
    ],
    hansome: {
      side: "Alpaca",
      type: "Public",
      gameplayClass: "Common",
      ability: "None",
      baseArchetype: s.base,
      excludedFromRarity: false,
      usesMascotAppearance: false,
    },
  };
}

function upsertSideAlpaca(meta) {
  const attrs = Array.isArray(meta.attributes) ? [...meta.attributes] : [];
  const without = attrs.filter((a) => a.trait_type !== "Side");
  without.unshift({ trait_type: "Side", value: "Alpaca" });
  meta.attributes = without;
  meta.hansome = { ...(meta.hansome || {}), side: "Alpaca" };
  return meta;
}

function loadExistingComboKeys() {
  const keys = new Set();
  for (let i = 31; i <= 500; i++) {
    if (DEMOTE_FROM_RESERVED_STAGING.includes(i)) continue;
    const p = path.join(MINT_META, `${i}.json`);
    if (!fs.existsSync(p)) continue;
    // Approximate uniqueness from image hash instead of trait key when regenerating
    const img = path.join(MINT_IMG, `${i}.png`);
    if (fs.existsSync(img)) {
      keys.add(crypto.createHash("sha256").update(fs.readFileSync(img)).digest("hex"));
    }
  }
  return keys;
}

async function bindReservedArt() {
  const reserved = allocation.specials.filter((s) => s.allocationBucket === "reserved" && s.tokenId >= 2);
  for (const s of reserved) {
    const src = R(s.stagingArt);
    const dst = path.join(MINT_IMG, `${s.tokenId}.png`);
    if (!fs.existsSync(src)) throw new Error(`Missing staging art ${src}`);
    fs.copyFileSync(src, dst);
    console.log(`  reserved #${String(s.tokenId).padStart(3, "0")} ← ${s.stagingArt}`);
  }
}

async function demoteDuplicateSpecials() {
  const imageHashes = loadExistingComboKeys();
  const rng = mulberry32(0x55055a11);
  for (const id of DEMOTE_FROM_RESERVED_STAGING) {
    let s;
    let key;
    let guard = 0;
    do {
      s = selectOne(rng);
      key = comboKey(s);
      guard++;
      if (guard > 5000) throw new Error(`Could not find unique combo for #${id}`);
    } while (imageHashes.has(key));
    imageHashes.add(key);
    const imgOut = path.join(MINT_IMG, `${id}.png`);
    await renderCommon(s, imgOut);
    const meta = commonMeta(id, s);
    fs.writeFileSync(path.join(MINT_META, `${id}.json`), JSON.stringify(meta, null, 2) + "\n");
    // also track rendered image hash
    imageHashes.add(crypto.createHash("sha256").update(fs.readFileSync(imgOut)).digest("hex"));
    console.log(`  demoted #${id} → Common (${s.base}/${s.bg})`);
  }
}

function addSideToAllAlpacas() {
  let updated = 0;
  for (let i = 1; i <= 500; i++) {
    const p = path.join(MINT_META, `${i}.json`);
    const meta = JSON.parse(fs.readFileSync(p, "utf8"));
    const before = JSON.stringify(meta);
    upsertSideAlpaca(meta);
    if (JSON.stringify(meta) !== before) {
      fs.writeFileSync(p, JSON.stringify(meta, null, 2) + "\n");
      updated++;
    }
  }
  console.log(`  Side=Alpaca ensured on 500 files (${updated} rewritten)`);
}

function writePlaceholder() {
  ensureDir(PRE_REVEAL);
  // Neutral dark card with brand mark text band (no side/class leak).
  const svg = `
  <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#121821"/>
        <stop offset="100%" stop-color="#1c2431"/>
      </linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#g)"/>
    <rect x="64" y="64" width="896" height="896" fill="none" stroke="#e9c46a" stroke-width="8"/>
    <text x="512" y="470" fill="#e9c46a" font-family="Arial, sans-serif" font-size="72" text-anchor="middle" font-weight="700">HANSOME</text>
    <text x="512" y="560" fill="#9fb0c3" font-family="Arial, sans-serif" font-size="36" text-anchor="middle">Genesis · Unrevealed</text>
  </svg>`;
  return sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(PRE_REVEAL, "placeholder.png"))
    .then(() => {
      const placeholder = {
        name: "HANSOME Genesis (Unrevealed)",
        description:
          "A HANSOME Genesis NFT awaiting reveal. Side, class, and traits are hidden until the collection reveal.",
        image: "ipfs://__IMAGE_CID__/placeholder.png",
        attributes: [{ trait_type: "Status", value: "Unrevealed" }],
      };
      fs.writeFileSync(
        path.join(PRE_REVEAL, "placeholder.json"),
        JSON.stringify(placeholder, null, 2) + "\n",
      );
      console.log("  wrote pre-reveal placeholder.png + placeholder.json");
    });
}

function merge550() {
  ensureDir(OUT_IMG);
  ensureDir(OUT_META);
  // Alpacas 1–500
  for (let i = 1; i <= 500; i++) {
    fs.copyFileSync(path.join(MINT_IMG, `${i}.png`), path.join(OUT_IMG, `${i}.png`));
    const meta = JSON.parse(fs.readFileSync(path.join(MINT_META, `${i}.json`), "utf8"));
    upsertSideAlpaca(meta);
    meta.edition = i;
    meta.image = `ipfs://__IMAGE_CID__/${i}.png`;
    fs.writeFileSync(path.join(OUT_META, `${i}.json`), JSON.stringify(meta, null, 2) + "\n");
  }
  // Cougars 501–550 (shared art)
  const cougarImg = R("public/pixel/cougar/mint/image/cougar.png");
  if (!fs.existsSync(cougarImg)) throw new Error("Missing cougar.png");
  fs.copyFileSync(cougarImg, path.join(OUT_IMG, "cougar.png"));
  for (let n = 1; n <= 50; n++) {
    const tokenId = 500 + n;
    fs.copyFileSync(cougarImg, path.join(OUT_IMG, `${tokenId}.png`));
    const meta = {
      name: `HANSOME Genesis #${tokenId}`,
      description:
        "One of the 50 HANSOME Cougars inside the Genesis collection. All 50 Cougars are identical: no rarity tiers, no special abilities.",
      image: `ipfs://__IMAGE_CID__/${tokenId}.png`,
      edition: tokenId,
      attributes: [
        { trait_type: "Side", value: "Cougar" },
        { trait_type: "Type", value: "Cougar" },
        { trait_type: "Gameplay Class", value: "None" },
        { trait_type: "Edition Size", value: 50 },
      ],
      hansome: {
        side: "Cougar",
        class: "Cougar",
        identical: true,
        rarity: "none",
        specialAbilities: "none",
        weight: 1,
        gds: "v1.1 §4.2",
        note: "Off-chain package id 501–550. On-chain sale sides are assigned at reveal shuffle — this layout is for IPFS/provenance only.",
      },
    };
    fs.writeFileSync(path.join(OUT_META, `${tokenId}.json`), JSON.stringify(meta, null, 2) + "\n");
  }
  const contract = {
    name: "HANSOME Genesis NFT",
    description: "Single Genesis collection: 550 = 500 Alpaca + 50 Cougar (off-chain package layout).",
    seller_fee_basis_points: 500,
    fee_recipient: "0x<treasury>",
    packageLayout: {
      alpacas: "1-500",
      cougars: "501-550",
      onChainReveal: "unchanged — sale identities shuffled at reveal",
    },
  };
  fs.writeFileSync(path.join(OUT_META, "contract.json"), JSON.stringify(contract, null, 2) + "\n");
  fs.writeFileSync(
    path.join(OUT_550, "README.md"),
    [
      "# Genesis collection-550 (off-chain)",
      "",
      "- Tokens **1–500**: Alpacas",
      "- Tokens **501–550**: Cougars (shared art)",
      "- This package is for asset management, validation, IPFS, and provenance.",
      "- On-chain mint/reveal topology is unchanged (reserved #001–#010; sale #011–#550 shuffled at reveal).",
      "",
    ].join("\n"),
  );
  console.log("  merged collection-550 (550 images + 550 metadata + contract.json)");
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

function validate550() {
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
      if (i <= 500) {
        const cls = classOf(meta);
        classCounts[cls] = (classCounts[cls] || 0) + 1;
        if (side !== "Alpaca") missing.push(`side-mismatch/${i}`);
        if (!meta.image?.includes("__IMAGE_CID__") && !meta.image?.startsWith("ipfs://")) {
          missing.push(`bad-image-uri/${i}`);
        }
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

  ensureDir(path.dirname(REPORT));
  fs.writeFileSync(REPORT, report);
  console.log(report);
  if (!classOk || missing.length || images !== 550 || metadata !== 550) {
    process.exitCode = 1;
  }
}

async function main() {
  console.log("Track B — prepare 550 package");
  console.log("1) Bind reserved art #002–#010");
  await bindReservedArt();
  console.log("2) Demote duplicate specials → Common");
  await demoteDuplicateSpecials();
  console.log("3) Add Side=Alpaca");
  addSideToAllAlpacas();
  console.log("4) Pre-reveal placeholder");
  await writePlaceholder();
  console.log("5) Merge collection-550");
  merge550();
  console.log("6) Validate");
  validate550();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
