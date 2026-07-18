// PHASE 2 — Trait System Validation (SIMULATION ONLY).
// Generates N random preview NFTs for visual-quality testing. NO metadata, NO token IDs,
// NO final collection, NO mint assets. Selection = weighted rarity draw + compatibility
// suppression + uniqueness. Compositing = full z-order stack; each fitted trait is pulled
// back out of its per-archetype preview (which was rendered as CARD + base + trait) by
// differencing against CARD + base, giving a clean positioned overlay to stack on the
// real background.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = "public/pixel/traits";
const OUT = path.join(ROOT, "previews", "sim");
fs.mkdirSync(OUT, { recursive: true });
const REPORTS = "reports/genesis";
fs.mkdirSync(REPORTS, { recursive: true });

const traits = JSON.parse(fs.readFileSync(path.join(ROOT, "traits.json"), "utf8"));
const rarity = JSON.parse(fs.readFileSync(path.join(ROOT, "rarity.json"), "utf8"));
const compat = JSON.parse(fs.readFileSync(path.join(ROOT, "compatibility.json"), "utf8"));
const gen = JSON.parse(fs.readFileSync(path.join(ROOT, "generation-config.json"), "utf8"));

const N = 100;
const CARD = { r: 255, g: 252, b: 245 };
const W = 1024, H = 1024;
const cats = traits.categories;

// ---------- seeded RNG ----------
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rng = mulberry32(gen.randomPool?.seed || 20260717);
function pick(entries) { // entries: [{id, weight}]
  const tot = entries.reduce((s, e) => s + e.weight, 0);
  let r = rng() * tot;
  for (const e of entries) { if ((r -= e.weight) <= 0) return e.id; }
  return entries[entries.length - 1].id;
}

// ---------- build weighted pools from READY items ----------
const tierW = (t) => (rarity.tiers[t]?.weight ?? 10);
const noneW = rarity.categoryNoneWeight || {};
const defaults = rarity.defaults || {};
function readyItems(cat) { return (cats[cat].items || []).filter((it) => it.status === "ready" || it.status === "default"); }
function poolFor(cat, { optional }) {
  const entries = readyItems(cat).map((it) => {
    let w = tierW(it.tier);
    const d = defaults[cat];
    if (d && d.defaultItem === it.id) w = d.defaultWeight;
    return { id: it.id, weight: w };
  });
  if (optional && (noneW[cat] != null)) entries.unshift({ id: "__none__", weight: noneW[cat] });
  return entries;
}

// base archetypes (uniform), backgrounds (weighted, required)
const BASES = readyItems("base").map((it) => it.id); // 8
const bgPool = poolFor("background", { optional: false });
const clothingPool = poolFor("clothing", { optional: true });
const necklacePool = poolFor("necklace", { optional: true });
const mouthPool = poolFor("mouth", { optional: false });
const earsPool = poolFor("ears", { optional: true });
const glassesPool = poolFor("glasses", { optional: true });
const hatPool = poolFor("hat", { optional: true });
const effectsPool = poolFor("effects", { optional: true });

const hatTags = compat.traitTags.hat || {};
const clothingTags = compat.traitTags.clothing || {};

function selectOne() {
  const base = BASES[Math.floor(rng() * BASES.length)];
  const bg = pick(bgPool);
  let clothing = pick(clothingPool);
  let necklace = pick(necklacePool);
  const mouth = pick(mouthPool);
  let ears = pick(earsPool);
  const glasses = pick(glassesPool);
  const hat = pick(hatPool);
  const effect = pick(effectsPool);
  // compatibility suppression
  if (hat !== "__none__" && (hatTags[hat] || []).includes("covers-ears")) ears = "__none__";
  if (clothing !== "__none__" && ((clothingTags[clothing] || []).includes("covers-neck") || (clothingTags[clothing] || []).includes("covers-chest"))) necklace = "__none__";
  return { base, bg, clothing, necklace, mouth, ears, glasses, hat, effect };
}
function comboKey(s) {
  const parts = [`base:${s.base}`, `bg:${s.bg}`, `mouth:${s.mouth}`];
  for (const [c, v] of [["clothing", s.clothing], ["necklace", s.necklace], ["ears", s.ears], ["glasses", s.glasses], ["hat", s.hat], ["effects", s.effect]]) if (v !== "__none__") parts.push(`${c}:${v}`);
  return crypto.createHash("sha256").update(parts.sort().join("|")).digest("hex");
}

// ---------- layer extraction ----------
const PREVDIR = {
  clothing: path.join(ROOT, "clothing/previews"),
  necklace: path.join(ROOT, "necklaces/previews"),
  mouth: path.join(ROOT, "mouth/previews"),
  ears: path.join(ROOT, "ears/previews"),
  glasses: path.join(ROOT, "glasses/previews"),
  hat: path.join(ROOT, "hats/previews"),
};
const baseCardCache = {};
async function baseCardRaw(arch) {
  if (baseCardCache[arch]) return baseCardCache[arch];
  const card = { create: { width: W, height: H, channels: 4, background: { ...CARD, alpha: 1 } } };
  const buf = await sharp(card).composite([{ input: path.join(ROOT, `base/normalized/${arch}.png`) }]).ensureAlpha().raw().toBuffer();
  baseCardCache[arch] = buf; return buf;
}
const overlayCache = {};
async function overlay(cat, id, arch) {
  const key = `${cat}/${id}/${arch}`;
  if (overlayCache[key]) return overlayCache[key];
  const pv = await sharp(path.join(PREVDIR[cat], `${id}__${arch}.png`)).ensureAlpha().raw().toBuffer();
  const bc = await baseCardRaw(arch);
  const out = Buffer.alloc(W * H * 4, 0);
  for (let i = 0; i < pv.length; i += 4) {
    if (Math.abs(pv[i] - bc[i]) > 10 || Math.abs(pv[i + 1] - bc[i + 1]) > 10 || Math.abs(pv[i + 2] - bc[i + 2]) > 10) {
      out[i] = pv[i]; out[i + 1] = pv[i + 1]; out[i + 2] = pv[i + 2]; out[i + 3] = 255;
    }
  }
  const png = await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  overlayCache[key] = png; return png;
}

async function compose(s) {
  const layers = [];
  layers.push({ input: path.join(ROOT, `backgrounds/${s.bg}.png`) });
  layers.push({ input: path.join(ROOT, `base/normalized/${s.base}.png`) });
  const order = [["clothing", s.clothing], ["necklace", s.necklace], ["mouth", s.mouth], ["ears", s.ears], ["glasses", s.glasses], ["hat", s.hat]];
  for (const [cat, id] of order) if (id !== "__none__") layers.push({ input: await overlay(cat, id, s.base) });
  if (s.effect !== "__none__") layers.push({ input: path.join(ROOT, `effects/${s.effect}.png`) });
  return await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).png().toBuffer();
}

// ---------- run ----------
const picks = [];
const seen = new Set();
let attempts = 0, retries = 0;
while (picks.length < N && attempts < N * 50) {
  attempts++;
  const s = selectOne();
  const k = comboKey(s);
  if (seen.has(k)) { retries++; continue; }
  seen.add(k);
  picks.push(s);
}
console.log(`selected ${picks.length} unique (attempts=${attempts}, dup-retries=${retries})`);

const files = [];
for (let i = 0; i < picks.length; i++) {
  const buf = await compose(picks[i]);
  const idx = String(i + 1).padStart(3, "0");
  const f = path.join(OUT, `${idx}.png`);
  await sharp(buf).png().toFile(f);
  files.push(f);
  if ((i + 1) % 20 === 0) console.log(`  composed ${i + 1}/${N}`);
}

// ---------- contact sheet 10x10 ----------
{
  const COLS = 10, ROWS = Math.ceil(N / COLS), CELL = 200, PAD = 6, LBL = 16;
  const CW = CELL + PAD, CH = CELL + LBL;
  const SW = COLS * CW + PAD, SH = 46 + ROWS * CH + PAD;
  const comps = [{ input: Buffer.from(`<svg width="${SW}" height="40"><text x="${SW / 2}" y="28" font-family="Verdana" font-size="24" font-weight="bold" fill="#5b4636" text-anchor="middle">HANSOME Genesis — 100 simulated previews (validation only)</text></svg>`), top: 6, left: 0 }];
  for (let i = 0; i < files.length; i++) {
    const c = i % COLS, r = Math.floor(i / COLS);
    const x0 = PAD + c * CW, y0 = 46 + r * CH;
    const cell = await sharp(files[i]).resize(CELL, CELL, { fit: "contain", background: { ...CARD, alpha: 1 }, kernel: "nearest" }).png().toBuffer();
    comps.push({ input: cell, top: y0, left: x0 });
    comps.push({ input: Buffer.from(`<svg width="${CELL}" height="${LBL}"><text x="4" y="12" font-family="Verdana" font-size="11" fill="#5b4636">#${String(i + 1).padStart(3, "0")} ${picks[i].base}</text></svg>`), top: y0 + CELL, left: x0 });
  }
  await sharp({ create: { width: SW, height: SH, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } }).composite(comps).png().toFile(path.join(OUT, "_CONTACT-SHEET.png"));
  console.log("wrote _CONTACT-SHEET.png");
}

// ---------- distribution + quality data ----------
const CATS = ["base", "bg", "clothing", "necklace", "mouth", "ears", "glasses", "hat", "effect"];
const nameOf = {};
for (const [ck, cc] of Object.entries(cats)) for (const it of (cc.items || [])) nameOf[`${ck}:${it.id}`] = it.name;
function tally(field, catKey) {
  const m = {};
  for (const p of picks) { const v = p[field]; m[v] = (m[v] || 0) + 1; }
  return m;
}
const dist = {
  base: tally("base"), bg: tally("bg"), clothing: tally("clothing"), necklace: tally("necklace"),
  mouth: tally("mouth"), ears: tally("ears"), glasses: tally("glasses"), hat: tally("hat"), effect: tally("effect"),
};
// traits per NFT
const perNft = picks.map((p) => ["clothing", "necklace", "ears", "glasses", "hat", "effect"].filter((c) => p[c === "effect" ? "effect" : c] !== "__none__").length);
const avgTraits = (perNft.reduce((a, b) => a + b, 0) / N).toFixed(2);
// compatibility violations
let vBeanieEars = 0, vScarfNeck = 0, vRibbonNeck = 0;
for (const p of picks) {
  if (p.hat === "wool-beanie" && p.ears !== "__none__") vBeanieEars++;
  if (p.clothing === "wool-scarf" && p.necklace !== "__none__") vScarfNeck++;
  if (p.clothing === "festival-ribbon" && p.necklace !== "__none__") vRibbonNeck++;
}

const catLabelMap = { base: "Base", bg: "Background", clothing: "Clothing", necklace: "Neck Accessories", mouth: "Mouth", ears: "Ear Accessories", glasses: "Glasses", hat: "Hat", effect: "Effects" };
const catKeyMap = { bg: "background", effect: "effects" };
function fmtRows(field) {
  const m = dist[field];
  const rows = Object.entries(m).sort((a, b) => b[1] - a[1]).map(([id, n]) => {
    const label = id === "__none__" ? "(none)" : (nameOf[`${catKeyMap[field] || field}:${id}`] || id);
    return `| ${label} | ${id} | ${n} | ${(n / N * 100).toFixed(0)}% |`;
  });
  return rows.join("\n");
}

const readyCount = (c) => readyItems(c).length;
let dr = `# HANSOME Genesis — Trait Distribution Report\n\n`;
dr += `_Simulation batch: **${N}** random previews · seed **${gen.randomPool?.seed}** · deterministic. Validation only — not the final collection._\n\n`;
dr += `## Ready trait inventory (used by the generator)\n\n`;
dr += `| Category | Layer | Required | Ready items | \`none\` weight |\n|---|---|---|---|---|\n`;
for (const [k, label] of Object.entries(catLabelMap)) {
  const realKey = catKeyMap[k] || k;
  const cc = cats[realKey];
  dr += `| ${label} | ${cc.layer} | ${cc.required ? "yes" : "no"} | ${readyCount(realKey)} | ${noneW[realKey] ?? "—"} |\n`;
}
dr += `\n> Note: **fur** currently has only \`classic\` (no-op overlay) ready and **face** has no ready art, so every simulated alpaca uses Classic wool and no face mark. These categories are registered but not yet drawn.\n\n`;
for (const [k, label] of Object.entries(catLabelMap)) {
  dr += `## ${label}\n\n| Trait | id | Count | Share |\n|---|---|---|---|\n${fmtRows(k)}\n\n`;
}
fs.writeFileSync(path.join(REPORTS, "trait-distribution-report.md"), dr);

// quality report (data portion; qualitative notes appended after visual review)
let qr = `# HANSOME Genesis — Generation Quality Report\n\n`;
qr += `_Simulation batch: **${N}** previews · seed **${gen.randomPool?.seed}**._\n\n`;
qr += `## Uniqueness\n\n`;
qr += `- Unique combinations: **${picks.length}/${N}** (0 duplicates).\n`;
qr += `- Draw attempts: ${attempts}, duplicate re-rolls: ${retries}.\n\n`;
qr += `## Compatibility rule enforcement\n\n`;
qr += `| Rule | Violations in batch |\n|---|---|\n`;
qr += `| Wool Beanie (covers-ears) suppresses Ear Accessories | ${vBeanieEars} |\n`;
qr += `| Cozy Wool Scarf (covers-neck) suppresses Neck Accessories | ${vScarfNeck} |\n`;
qr += `| Festival Ribbon (covers-chest) suppresses Neck Accessories | ${vRibbonNeck} |\n\n`;
qr += `## Trait load per NFT (worn optional slots: clothing/neck/ears/glasses/hat/effects)\n\n`;
const loadHist = {};
for (const v of perNft) loadHist[v] = (loadHist[v] || 0) + 1;
qr += `- Average worn optional traits: **${avgTraits}** of 6.\n`;
qr += `| worn traits | count |\n|---|---|\n`;
for (const k of Object.keys(loadHist).sort()) qr += `| ${k} | ${loadHist[k]} |\n`;
qr += `\n## Rarest / most frequent (optional slots)\n\n`;
// most frequent non-none trait overall
const freq = {};
for (const p of picks) for (const c of ["clothing", "necklace", "ears", "glasses", "hat", "effect"]) { const v = p[c]; if (v !== "__none__") { const key = `${catLabelMap[c]}: ${nameOf[`${catKeyMap[c] || c}:${v}`] || v}`; freq[key] = (freq[key] || 0) + 1; } }
const sortedFreq = Object.entries(freq).sort((a, b) => b[1] - a[1]);
qr += `- Most frequent worn trait: **${sortedFreq[0]?.[0]}** (${sortedFreq[0]?.[1]}x)\n`;
qr += `- Least frequent worn trait: **${sortedFreq[sortedFreq.length - 1]?.[0]}** (${sortedFreq[sortedFreq.length - 1]?.[1]}x)\n\n`;
fs.writeFileSync(path.join(REPORTS, "generation-quality-report.md"), qr);

// machine-readable dump for reference
fs.writeFileSync(path.join(OUT, "_picks.json"), JSON.stringify({ seed: gen.randomPool?.seed, n: N, picks, dist, perNft }, null, 2));
console.log("wrote reports + _picks.json");
console.log("DIST base:", dist.base);
console.log("DIST hat:", dist.hat);
console.log("DIST effect:", dist.effect);
console.log("compat violations beanie+ears:", vBeanieEars, "scarf+neck:", vScarfNeck, "avgTraits:", avgTraits);
