// PHASE 3 — validation, reports and preview sheets for the generated Genesis collection.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const ROOT = "public/pixel/traits";
const OUTDIR = "public/pixel/genesis";
const METADIR = path.join(OUTDIR, "metadata");
const REPORTS = "reports/genesis/final";
fs.mkdirSync(REPORTS, { recursive: true });

const traits = JSON.parse(fs.readFileSync(path.join(ROOT, "traits.json"), "utf8"));
const rarity = JSON.parse(fs.readFileSync(path.join(ROOT, "rarity.json"), "utf8"));
const compat = JSON.parse(fs.readFileSync(path.join(ROOT, "compatibility.json"), "utf8"));
const gen = JSON.parse(fs.readFileSync(path.join(ROOT, "generation-config.json"), "utf8"));
const D = JSON.parse(fs.readFileSync(path.join(REPORTS, "_picks.json"), "utf8"));
const picks = D.picks, freq = D.freq, N = D.publicN;
const publicIds = Object.keys(picks).map(Number).sort((a, b) => a - b);
const CARD = { r: 255, g: 252, b: 245 };

const cats = traits.categories;
const nameOf = {}, tierOf = {};
for (const [ck, cc] of Object.entries(cats)) for (const it of (cc.items || [])) { nameOf[`${ck}:${it.id}`] = it.name; tierOf[`${ck}:${it.id}`] = it.tier; }
const scoreCats = [["bg", "background", "Background"], ["base", "base", "Archetype"], ["clothing", "clothing", "Clothing"], ["necklace", "necklace", "Neck Accessory"], ["mouth", "mouth", "Mouth"], ["ears", "ears", "Ear Accessory"], ["glasses", "glasses", "Glasses"], ["hat", "hat", "Hat"], ["effect", "effects", "Effect"]];
const valOf = (field, id) => id === "__none__" ? "None" : (nameOf[`${(scoreCats.find(c => c[0] === field))[1]}:${id}`] || id);
const tierFor = (field, id) => id === "__none__" ? "—" : (tierOf[`${(scoreCats.find(c => c[0] === field))[1]}:${id}`] || "—");

// ---------- VALIDATION ----------
const val = { errors: [], checks: [] };
// 1. all 500 metadata + art exist
let missMeta = 0, missArt = 0;
for (let id = 1; id <= 500; id++) { if (!fs.existsSync(path.join(METADIR, `${id}.json`))) missMeta++; if (!fs.existsSync(path.join(OUTDIR, `${id}.png`))) missArt++; }
val.checks.push(["All 500 metadata files present", missMeta === 0, `${500 - missMeta}/500`]);
val.checks.push(["All 500 artwork files present", missArt === 0, `${500 - missArt}/500`]);
// 2. allocation counts
const meta = {}; for (let id = 1; id <= 500; id++) meta[id] = JSON.parse(fs.readFileSync(path.join(METADIR, `${id}.json`), "utf8"));
const typeCount = {}; for (let id = 1; id <= 500; id++) { const t = meta[id].hansome.type; typeCount[t] = (typeCount[t] || 0) + 1; }
val.checks.push(["Public = 470", typeCount.Public === 470, String(typeCount.Public)]);
val.checks.push(["Legendary = 20", typeCount.Legendary === 20, String(typeCount.Legendary)]);
val.checks.push(["Reserved = 10", typeCount.Reserved === 10, String(typeCount.Reserved)]);
val.checks.push(["Total = 500", (typeCount.Public + typeCount.Legendary + typeCount.Reserved) === 500, String(typeCount.Public + typeCount.Legendary + typeCount.Reserved)]);
// 3. Founder #001 uses mascot appearance and is reserved
val.checks.push(["Founder #001 is Reserved + uses mascot appearance", meta[1].hansome.type === "Reserved" && meta[1].hansome.usesMascotAppearance === true, meta[1].name]);
val.checks.push(["No Public token in IDs 1-30", publicIds.every((id) => id >= 31), `min public id = ${Math.min(...publicIds)}`]);
// 4. duplicate detection among public
const combos = new Set(); let dups = 0;
for (const id of publicIds) { const c = picks[id].combo; if (combos.has(c)) dups++; combos.add(c); }
val.checks.push(["No duplicate public trait combinations", dups === 0, `${combos.size} unique / ${N}`]);
// 5. compatibility validation on public
let vBeanieEars = 0, vScarfNeck = 0, vRibbonNeck = 0;
for (const id of publicIds) { const s = picks[id]; if (s.hat === "wool-beanie" && s.ears !== "__none__") vBeanieEars++; if (s.clothing === "wool-scarf" && s.necklace !== "__none__") vScarfNeck++; if (s.clothing === "festival-ribbon" && s.necklace !== "__none__") vRibbonNeck++; }
val.checks.push(["Rule: Wool Beanie suppresses Ears", vBeanieEars === 0, `${vBeanieEars} violations`]);
val.checks.push(["Rule: Cozy Wool Scarf suppresses Neck", vScarfNeck === 0, `${vScarfNeck} violations`]);
val.checks.push(["Rule: Festival Ribbon suppresses Neck", vRibbonNeck === 0, `${vRibbonNeck} violations`]);
// 6. all referenced traits are 'ready'
let badTrait = 0;
for (const id of publicIds) { const s = picks[id]; for (const [field, ck] of scoreCats) { const idv = s[field]; if (idv === "__none__") continue; const it = (cats[ck].items || []).find((x) => x.id === idv); if (!it || (it.status !== "ready" && it.status !== "default")) badTrait++; } }
val.checks.push(["All worn traits are approved/ready", badTrait === 0, `${badTrait} bad refs`]);

let vr = `# HANSOME Genesis — Phase 3 Validation Report\n\n_Deterministic generation · seed **${D.seed}** · 470 public + 20 legendary + 10 reserved = 500._\n\n`;
vr += `| Check | Result | Detail |\n|---|---|---|\n`;
for (const [name, ok, detail] of val.checks) vr += `| ${name} | ${ok ? "PASS ✅" : "FAIL ❌"} | ${detail} |\n`;
vr += `\n**Overall: ${val.checks.every((c) => c[1]) ? "ALL CHECKS PASSED ✅" : "FAILURES PRESENT ❌"}**\n`;
vr += `\n> Reserved (10, incl. Founder #001) and Legendary (20) are hand-authored one-of-ones: excluded from duplicate/rarity/compatibility validation and carry \`artwork: pending-hand-design\` placeholders.\n`;
fs.writeFileSync(path.join(REPORTS, "validation-report.md"), vr);

// ---------- TRAIT DISTRIBUTION (470 public) ----------
function catRows(label) {
  const rows = Object.entries(freq).filter(([k]) => k.startsWith(label + "::")).map(([k, n]) => { const v = k.split("::")[1]; return { v, n }; }).sort((a, b) => b.n - a.n);
  return rows;
}
let dr = `# HANSOME Genesis — Trait Distribution Report (Final)\n\n_470 Public NFTs (token IDs 31-500). Reserved & Legendary excluded (hand-authored)._\n\n`;
for (const [, , label] of scoreCats) {
  dr += `## ${label}\n\n| Value | Count | Share | Tier |\n|---|---|---|---|\n`;
  for (const { v, n } of catRows(label)) {
    // find tier by matching value name
    let tier = "—";
    if (v !== "None") { const [field, ck] = scoreCats.find((c) => c[2] === label); const it = (cats[ck].items || []).find((x) => x.name === v); tier = it ? (it.tier || "—") : "—"; }
    dr += `| ${v} | ${n} | ${(n / N * 100).toFixed(1)}% | ${tier} |\n`;
  }
  dr += `\n`;
}
fs.writeFileSync(path.join(REPORTS, "trait-distribution-report.md"), dr);

// ---------- RARITY REPORT ----------
const ranked = [...publicIds].sort((a, b) => picks[b].rarityScore - picks[a].rarityScore);
// tier breakdown: count worn traits per rarity tier across public
const tierUnits = {};
for (const id of publicIds) { const s = picks[id]; for (const [field, ck] of scoreCats) { const idv = s[field]; if (idv === "__none__") continue; const it = (cats[ck].items || []).find((x) => x.id === idv); const t = it?.tier || "untiered"; tierUnits[t] = (tierUnits[t] || 0) + 1; } }
let rr = `# HANSOME Genesis — Rarity Report\n\n_470 Public NFTs · rarity score = Σ (1 / trait frequency). Higher score = rarer. Reserved & Legendary are outside this model._\n\n`;
rr += `## Worn-trait count by rarity tier (across all 470 public)\n\n| Tier | Trait instances worn |\n|---|---|\n`;
for (const t of ["common", "uncommon", "rare", "epic", "legendary", "mythic", "untiered"]) if (tierUnits[t]) rr += `| ${rarity.tiers[t]?.label || t} | ${tierUnits[t]} |\n`;
rr += `\n## Rarest single traits (lowest occurrence)\n\n| Trait | Value | Count | Share |\n|---|---|---|---|\n`;
const allTraitRows = Object.entries(freq).map(([k, n]) => { const [label, v] = k.split("::"); return { label, v, n }; }).filter(r => r.v !== "None").sort((a, b) => a.n - b.n).slice(0, 12);
for (const r of allTraitRows) rr += `| ${r.label} | ${r.v} | ${r.n} | ${(r.n / N * 100).toFixed(1)}% |\n`;
rr += `\n## Top 25 rarest tokens\n\n| Rank | Token | Score | Key traits |\n|---|---|---|---|\n`;
for (let i = 0; i < 25; i++) {
  const id = ranked[i]; const s = picks[id];
  const worn = [["Hat", "hat"], ["Glasses", "glasses"], ["Clothing", "clothing"], ["Neck Accessory", "necklace"], ["Ear Accessory", "ears"], ["Effect", "effect"], ["Mouth", "mouth"]].map(([lbl, f]) => s[f] !== "__none__" ? `${valOf(f, s[f])}` : null).filter(Boolean).slice(0, 4).join(", ");
  rr += `| ${i + 1} | #${id} (${valOf("base", s.base)}) | ${s.rarityScore} | ${worn} |\n`;
}
fs.writeFileSync(path.join(REPORTS, "rarity-report.md"), rr);

// ---------- METADATA SUMMARY ----------
let ms = `# HANSOME Genesis — Metadata Summary\n\n`;
ms += `- Collection: **${gen.collection.name}** (${gen.collection.symbol})\n- Total supply: **500** — 470 Public · 20 Legendary · 10 Reserved (incl. Founder #001)\n- Seed: **${D.seed}** (deterministic)\n- Artwork: \`public/pixel/genesis/{tokenId}.png\` (1024×1024, pixel-perfect / nearest-neighbor)\n- Metadata: \`public/pixel/genesis/metadata/{tokenId}.json\`\n\n`;
ms += `## Allocation & generation status\n\n| Type | Token IDs | Count | Generation | Artwork |\n|---|---|---|---|---|\n`;
ms += `| Reserved | 1–10 | 10 | manual (hand-designed) | placeholder — pending |\n`;
ms += `| Legendary | 11–30 | 20 | manual (hand-designed) | placeholder — pending |\n`;
ms += `| Public | 31–500 | 470 | procedural (approved trait system) | generated ✅ |\n\n`;
ms += `## Metadata schema (Public example)\n\n\`\`\`json\n${JSON.stringify(meta[ranked[0]], null, 2)}\n\`\`\`\n\n`;
ms += `## Trait slots per token\n\nEach Public token carries these \`trait_type\`s: Background, Archetype, Wool, Clothing, Neck Accessory, Mouth, Ear Accessory, Glasses, Hat, Effect (empty optional slots = "None"). Reserved/Legendary carry Type (+ Role) only.\n\n`;
ms += `> No minting performed. No blockchain assets created. Metadata \`image\` fields are relative repo paths, ready to be re-pointed to IPFS/hosting at mint time.\n`;
fs.writeFileSync(path.join(REPORTS, "metadata-summary.md"), ms);
console.log("reports written");

// ---------- PREVIEW SHEETS ----------
async function sheet(ids, cols, cell, title, outfile, labelFn) {
  const rows = Math.ceil(ids.length / cols), PAD = 4, LBL = 14, CW = cell + PAD, CH = cell + LBL;
  const SW = cols * CW + PAD, SH = 44 + rows * CH + PAD;
  const comps = [{ input: Buffer.from(`<svg width="${SW}" height="38"><text x="${SW / 2}" y="26" font-family="Verdana" font-size="22" font-weight="bold" fill="#5b4636" text-anchor="middle">${title}</text></svg>`), top: 6, left: 0 }];
  for (let i = 0; i < ids.length; i++) {
    const c = i % cols, r = Math.floor(i / cols), x0 = PAD + c * CW, y0 = 44 + r * CH;
    const cellBuf = await sharp(path.join(OUTDIR, `${ids[i]}.png`)).resize(cell, cell, { fit: "contain", background: { ...CARD, alpha: 1 }, kernel: "nearest" }).png().toBuffer();
    comps.push({ input: cellBuf, top: y0, left: x0 });
    comps.push({ input: Buffer.from(`<svg width="${cell}" height="${LBL}"><text x="3" y="11" font-family="Verdana" font-size="10" fill="#5b4636">${labelFn(ids[i])}</text></svg>`), top: y0 + cell, left: x0 });
  }
  await sharp({ create: { width: SW, height: SH, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } }).composite(comps).png().toFile(path.join(OUTDIR, outfile));
  console.log("wrote", outfile);
}
const allIds = []; for (let id = 1; id <= 500; id++) allIds.push(id);
await sheet(allIds, 25, 116, `HANSOME Genesis — full 500 collection preview (IDs 1-30 = hand-designed placeholders)`, "_COLLECTION-PREVIEW.png", (id) => `#${id}`);
// 100-sample evenly spaced across public for close QA
const step = N / 100, sample = []; for (let i = 0; i < 100; i++) sample.push(publicIds[Math.floor(i * step)]);
await sheet(sample, 10, 200, `HANSOME Genesis — 100 public sample (evenly spaced)`, "_SAMPLE-100.png", (id) => `#${id} ${valOf("base", picks[id].base)}`);
// top rarest 50
await sheet(ranked.slice(0, 50), 10, 200, `HANSOME Genesis — 50 rarest public tokens`, "_RAREST-50.png", (id) => `#${id} r${picks[id].rarityRank}`);
console.log("all preview sheets done");
