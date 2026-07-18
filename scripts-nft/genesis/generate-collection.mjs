// PHASE 3 — Genesis Collection Generation.
// Emits the FINAL 500-slot Genesis collection:
//   - 470 Public (token IDs 31-500): procedurally generated from the approved trait system
//     (weighted rarity draw + compatibility suppression + uniqueness), full artwork + metadata.
//   - 10 Reserved (IDs 1-10, incl. Founder #001) and 20 Legendary (IDs 11-30): hand-authored
//     one-of-ones. Their artwork is authored later; here we emit reserved metadata + clearly
//     labelled placeholder tiles (NEVER procedurally-drawn alpacas).
// Deterministic (seed from config). NO minting, NO blockchain assets.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = "public/pixel/traits";
const OUTDIR = "public/pixel/genesis";
const METADIR = path.join(OUTDIR, "metadata");
const REPORTS = "reports/genesis/final";
for (const d of [OUTDIR, METADIR, REPORTS]) fs.mkdirSync(d, { recursive: true });

const traits = JSON.parse(fs.readFileSync(path.join(ROOT, "traits.json"), "utf8"));
const rarity = JSON.parse(fs.readFileSync(path.join(ROOT, "rarity.json"), "utf8"));
const compat = JSON.parse(fs.readFileSync(path.join(ROOT, "compatibility.json"), "utf8"));
const gen = JSON.parse(fs.readFileSync(path.join(ROOT, "generation-config.json"), "utf8"));

const W = 1024, H = 1024;
const CARD = { r: 255, g: 252, b: 245 };
const cats = traits.categories;
const nameOf = {};
for (const [ck, cc] of Object.entries(cats)) for (const it of (cc.items || [])) nameOf[`${ck}:${it.id}`] = it.name;
const tierOf = {};
for (const [ck, cc] of Object.entries(cats)) for (const it of (cc.items || [])) tierOf[`${ck}:${it.id}`] = it.tier;

// ---------- seeded RNG ----------
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rng = mulberry32(gen.randomPool.seed);
function pick(entries) { const tot = entries.reduce((s, e) => s + e.weight, 0); let r = rng() * tot; for (const e of entries) { if ((r -= e.weight) <= 0) return e.id; } return entries[entries.length - 1].id; }

// ---------- pools ----------
const tierW = (t) => (rarity.tiers[t]?.weight ?? 10);
const noneW = rarity.categoryNoneWeight || {};
const defaults = rarity.defaults || {};
const readyItems = (cat) => (cats[cat].items || []).filter((it) => it.status === "ready" || it.status === "default");
function poolFor(cat, optional) {
  const entries = readyItems(cat).map((it) => { let w = tierW(it.tier); const d = defaults[cat]; if (d && d.defaultItem === it.id) w = d.defaultWeight; return { id: it.id, weight: w }; });
  if (optional && noneW[cat] != null) entries.unshift({ id: "__none__", weight: noneW[cat] });
  return entries;
}
const BASES = readyItems("base").map((it) => it.id);
const P = {
  bg: poolFor("background", false), clothing: poolFor("clothing", true), necklace: poolFor("necklace", true),
  mouth: poolFor("mouth", false), ears: poolFor("ears", true), glasses: poolFor("glasses", true),
  hat: poolFor("hat", true), effect: poolFor("effects", true),
};
const hatTags = compat.traitTags.hat || {}, clothingTags = compat.traitTags.clothing || {};

function selectOne() {
  const s = {
    base: BASES[Math.floor(rng() * BASES.length)], bg: pick(P.bg), fur: "classic",
    clothing: pick(P.clothing), necklace: pick(P.necklace), mouth: pick(P.mouth),
    ears: pick(P.ears), glasses: pick(P.glasses), hat: pick(P.hat), effect: pick(P.effect),
  };
  if (s.hat !== "__none__" && (hatTags[s.hat] || []).includes("covers-ears")) s.ears = "__none__";
  if (s.clothing !== "__none__" && ((clothingTags[s.clothing] || []).includes("covers-neck") || (clothingTags[s.clothing] || []).includes("covers-chest"))) s.necklace = "__none__";
  return s;
}
function comboKey(s) {
  const parts = [`base:${s.base}`, `bg:${s.bg}`, `mouth:${s.mouth}`];
  for (const [c, v] of [["clothing", s.clothing], ["necklace", s.necklace], ["ears", s.ears], ["glasses", s.glasses], ["hat", s.hat], ["effects", s.effect]]) if (v !== "__none__") parts.push(`${c}:${v}`);
  return crypto.createHash("sha256").update(parts.sort().join("|")).digest("hex");
}

// ---------- overlay extraction ----------
const PREVDIR = { clothing: "clothing/previews", necklace: "necklaces/previews", mouth: "mouth/previews", ears: "ears/previews", glasses: "glasses/previews", hat: "hats/previews" };
const baseCardCache = {}, overlayCache = {};
async function baseCardRaw(arch) {
  if (baseCardCache[arch]) return baseCardCache[arch];
  const buf = await sharp({ create: { width: W, height: H, channels: 4, background: { ...CARD, alpha: 1 } } }).composite([{ input: path.join(ROOT, `base/normalized/${arch}.png`) }]).ensureAlpha().raw().toBuffer();
  baseCardCache[arch] = buf; return buf;
}
async function overlay(cat, id, arch) {
  const key = `${cat}/${id}/${arch}`;
  if (overlayCache[key]) return overlayCache[key];
  const pv = await sharp(path.join(ROOT, PREVDIR[cat], `${id}__${arch}.png`)).ensureAlpha().raw().toBuffer();
  const bc = await baseCardRaw(arch);
  const out = Buffer.alloc(W * H * 4, 0);
  for (let i = 0; i < pv.length; i += 4) if (Math.abs(pv[i] - bc[i]) > 10 || Math.abs(pv[i + 1] - bc[i + 1]) > 10 || Math.abs(pv[i + 2] - bc[i + 2]) > 10) { out[i] = pv[i]; out[i + 1] = pv[i + 1]; out[i + 2] = pv[i + 2]; out[i + 3] = 255; }
  const png = await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  overlayCache[key] = png; return png;
}
async function compose(s) {
  const layers = [{ input: path.join(ROOT, `backgrounds/${s.bg}.png`) }, { input: path.join(ROOT, `base/normalized/${s.base}.png`) }];
  for (const [cat, id] of [["clothing", s.clothing], ["necklace", s.necklace], ["mouth", s.mouth], ["ears", s.ears], ["glasses", s.glasses], ["hat", s.hat]]) if (id !== "__none__") layers.push({ input: await overlay(cat, id, s.base) });
  if (s.effect !== "__none__") layers.push({ input: path.join(ROOT, `effects/${s.effect}.png`) });
  return await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).png().toBuffer();
}

// ---------- allocation ----------
const reserved = gen.tokenIdPolicy.reservedTokenIds.reservedAssignments; // ids 1-10
const legendary = gen.tokenIdPolicy.legendaryTokenIds.legendaryAssignments; // ids 11-30
const { startId, endId } = gen.randomPool.publicIdRange; // 31-500
const publicIds = []; for (let i = startId; i <= endId; i++) publicIds.push(i);

// ---------- select 470 unique public ----------
const seen = new Set(); const picks = {}; let attempts = 0, retries = 0;
for (const id of publicIds) {
  let s, k, tries = 0;
  do { s = selectOne(); k = comboKey(s); attempts++; tries++; if (seen.has(k)) retries++; } while (seen.has(k) && tries < gen.uniqueness.maxAttemptsPerToken);
  seen.add(k); picks[id] = { ...s, combo: k };
}
console.log(`selected ${Object.keys(picks).length} unique public (attempts=${attempts}, dup-retries=${retries})`);

// ---------- rarity model (470 public) ----------
const scoreCats = [["bg", "background", "Background"], ["base", "base", "Archetype"], ["clothing", "clothing", "Clothing"], ["necklace", "necklace", "Neck Accessory"], ["mouth", "mouth", "Mouth"], ["ears", "ears", "Ear Accessory"], ["glasses", "glasses", "Glasses"], ["hat", "hat", "Hat"], ["effect", "effects", "Effect"]];
const valOf = (field) => (id) => id === "__none__" ? "None" : (nameOf[`${(scoreCats.find(c => c[0] === field))[1]}:${id}`] || id);
const freq = {}; // "AttrLabel::Value" -> count
for (const id of publicIds) { const s = picks[id]; for (const [field, , label] of scoreCats) { const v = valOf(field)(s[field]); const key = `${label}::${v}`; freq[key] = (freq[key] || 0) + 1; } }
const N = publicIds.length;
for (const id of publicIds) {
  const s = picks[id]; let score = 0;
  for (const [field, , label] of scoreCats) { const v = valOf(field)(s[field]); score += 1 / (freq[`${label}::${v}`] / N); }
  s.rarityScore = +score.toFixed(3);
}
const ranked = [...publicIds].sort((a, b) => picks[b].rarityScore - picks[a].rarityScore);
ranked.forEach((id, i) => { picks[id].rarityRank = i + 1; });

// ---------- render public art + metadata ----------
const DESC = "A HANSOME Genesis alpaca — an original individual of the cozy countryside HANSOME universe. Handcrafted pixel art. Not the mascot.";
function attrs(s) {
  const a = [];
  a.push({ trait_type: "Background", value: nameOf[`background:${s.bg}`] });
  a.push({ trait_type: "Archetype", value: nameOf[`base:${s.base}`] });
  a.push({ trait_type: "Wool", value: nameOf[`fur:classic`] });
  const opt = [["Clothing", "clothing", s.clothing], ["Neck Accessory", "necklace", s.necklace], ["Mouth", "mouth", s.mouth], ["Ear Accessory", "ears", s.ears], ["Glasses", "glasses", s.glasses], ["Hat", "hat", s.hat], ["Effect", "effects", s.effect]];
  for (const [label, ck, id] of opt) a.push({ trait_type: label, value: id === "__none__" ? "None" : nameOf[`${ck}:${id}`] });
  return a;
}
let done = 0;
for (const id of publicIds) {
  const s = picks[id];
  const buf = await compose(s);
  await sharp(buf).png().toFile(path.join(OUTDIR, `${id}.png`));
  const meta = {
    name: `HANSOME Genesis #${id}`, description: DESC, image: `genesis/${id}.png`, edition: id,
    attributes: attrs(s),
    hansome: { type: "Public", archetype: nameOf[`base:${s.base}`], comboHash: s.combo, rarityRank: s.rarityRank, rarityScore: s.rarityScore, rarityOutOf: N },
  };
  fs.writeFileSync(path.join(METADIR, `${id}.json`), JSON.stringify(meta, null, 2));
  if (++done % 50 === 0) console.log(`  rendered ${done}/${N} public`);
}
console.log("public art + metadata done");

// ---------- placeholders + metadata for reserved / legendary ----------
async function placeholderTile(id, kind, sub) {
  const bg = kind === "Legendary" ? { r: 60, g: 46, b: 22, alpha: 1 } : { r: 244, g: 234, b: 216, alpha: 1 };
  const fg = kind === "Legendary" ? "#f3d27a" : "#7a5c3a";
  const accent = kind === "Legendary" ? "#f3d27a" : "#b07a3a";
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="28" fill="none" stroke="${accent}" stroke-width="8" stroke-dasharray="24 18"/>
    <text x="${W / 2}" y="${H / 2 - 70}" font-family="Verdana" font-size="64" font-weight="bold" fill="${fg}" text-anchor="middle">HANSOME Genesis</text>
    <text x="${W / 2}" y="${H / 2 + 20}" font-family="Verdana" font-size="88" font-weight="bold" fill="${fg}" text-anchor="middle">${kind} #${id}</text>
    <text x="${W / 2}" y="${H / 2 + 90}" font-family="Verdana" font-size="40" fill="${fg}" text-anchor="middle">${sub}</text>
    <text x="${W / 2}" y="${H / 2 + 150}" font-family="Verdana" font-size="30" fill="${fg}" text-anchor="middle">one-of-one · artwork pending hand-design</text>
  </svg>`;
  return await sharp({ create: { width: W, height: H, channels: 4, background: bg } }).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
}
for (const r of reserved) {
  const isFounder = r.role === "founder";
  const sub = isFounder ? "FOUNDER — uses the iconic mascot appearance" : `Reserved · ${r.role}`;
  await sharp(await placeholderTile(r.tokenId, "Reserved", sub)).png().toFile(path.join(OUTDIR, `${r.tokenId}.png`));
  const meta = {
    name: `HANSOME Genesis #${r.tokenId}${isFounder ? " — Founder" : ""}`,
    description: isFounder ? "Founder NFT #001 — the one Genesis alpaca that uses the iconic HANSOME mascot appearance. Hand-designed one-of-one. Owning it does not transfer the mascot/brand/IP, which remain with the HANSOME project." : `Reserved HANSOME Genesis NFT (${r.role}). Hand-designed one-of-one, held back from the public pool.`,
    image: `genesis/${r.tokenId}.png`, edition: r.tokenId,
    attributes: [{ trait_type: "Type", value: "Reserved" }, { trait_type: "Role", value: isFounder ? "Founder" : r.role }],
    hansome: { type: "Reserved", role: isFounder ? "founder" : r.role, generation: "manual", artwork: "pending-hand-design", excludedFromRarity: true, usesMascotAppearance: !!r.usesMascotAppearance },
  };
  fs.writeFileSync(path.join(METADIR, `${r.tokenId}.json`), JSON.stringify(meta, null, 2));
}
for (const l of legendary) {
  await sharp(await placeholderTile(l.tokenId, "Legendary", l.label)).png().toFile(path.join(OUTDIR, `${l.tokenId}.png`));
  const meta = {
    name: `HANSOME Genesis #${l.tokenId} — ${l.label}`,
    description: `Legendary HANSOME Genesis NFT — an individually hand-designed one-of-one, not a random trait combination.`,
    image: `genesis/${l.tokenId}.png`, edition: l.tokenId,
    attributes: [{ trait_type: "Type", value: "Legendary" }],
    hansome: { type: "Legendary", label: l.label, generation: "manual", artwork: "pending-hand-design", excludedFromRarity: true },
  };
  fs.writeFileSync(path.join(METADIR, `${l.tokenId}.json`), JSON.stringify(meta, null, 2));
}
console.log("reserved + legendary placeholders + metadata done");

// ---------- dump picks for reporting ----------
fs.writeFileSync(path.join(REPORTS, "_picks.json"), JSON.stringify({ seed: gen.randomPool.seed, publicN: N, freq, picks, reserved: reserved.map(r => r.tokenId), legendary: legendary.map(l => l.tokenId) }, null, 2));
console.log("wrote _picks.json — run report/preview steps next");
