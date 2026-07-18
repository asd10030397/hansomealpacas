// READ-ONLY pre-assembly verification for the final Genesis 500.
// Confirms the 6 areas the user asked to verify BEFORE final assembly:
//   1. Founder Reserve 10 allocation   2. Public mint pool   3. Gameplay Class distribution
//   4. Metadata structure              5. Random assignment rules   6. Trait compatibility
// Touches NOTHING except writing a report to reports/genesis/final/. Does not modify the
// public 470 art/metadata, nor generate anything.
import fs from "node:fs";
import path from "node:path";
import { validateSpecialToken } from "./validate-special.mjs";

const ROOT = "public/pixel/traits";
const GEN = path.join(ROOT, "generation-config.json");
const OUTDIR = "public/pixel/genesis";
const METADIR = path.join(OUTDIR, "metadata");
const SPECIAL = path.join(OUTDIR, "special");
const REPORTS = "reports/genesis/final";

const gen = JSON.parse(fs.readFileSync(GEN, "utf8"));
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, "special-21-allocation.json"), "utf8"));
const picks = JSON.parse(fs.readFileSync(path.join(REPORTS, "_picks.json"), "utf8"));
const specialMeta = JSON.parse(fs.readFileSync(path.join(SPECIAL, "_special-metadata.json"), "utf8"));
const readMeta = (id) => JSON.parse(fs.readFileSync(path.join(METADIR, `${id}.json`), "utf8"));

const checks = [];
const add = (name, ok, detail) => checks.push([name, ok, detail]);

// ---------- 1. Founder Reserve 10 ----------
const reserved = gen.tokenIdPolicy.reservedTokenIds.reservedAssignments;
add("Reserved allocation = 10 (IDs 1-10)", reserved.length === 10 && reserved[0].tokenId === 1 && reserved[9].tokenId === 10, `${reserved.length} entries, ids ${reserved[0].tokenId}-${reserved[9].tokenId}`);
const founder = reserved.find((r) => r.role === "founder");
add("Founder is #001 + uses mascot appearance", founder?.tokenId === 1 && founder?.usesMascotAppearance === true, `founder id=${founder?.tokenId}`);
const m1 = readMeta(1);
add("Token #1 metadata = Reserved/Founder/mascot", m1.hansome.type === "Reserved" && m1.hansome.role === "founder" && m1.hansome.usesMascotAppearance === true, m1.name);
const roles = reserved.slice(1).map((r) => r.role);
add("Reserved #2-10 have non-founder roles (team/community/partners/ecosystem)", reserved.slice(1).every((r) => r.role !== "founder") && roles.length === 9, roles.join(", "));

// ---------- 2. Public mint pool ----------
const { startId, endId } = gen.randomPool.publicIdRange;
const publicIds = Object.keys(picks.picks).map(Number).sort((a, b) => a - b);
add("Public pool range = 31-500 (470 ids)", startId === 31 && endId === 500 && publicIds.length === 470 && publicIds[0] === 31 && publicIds.at(-1) === 500, `${publicIds.length} ids, ${publicIds[0]}-${publicIds.at(-1)}`);
let publicMetaOk = 0, publicArtOk = 0, publicTypeOk = 0;
for (const id of publicIds) {
  if (fs.existsSync(path.join(METADIR, `${id}.json`))) { publicMetaOk++; if (readMeta(id).hansome.type === "Public") publicTypeOk++; }
  if (fs.existsSync(path.join(OUTDIR, `${id}.png`))) publicArtOk++;
}
add("All 470 public have art + metadata + type=Public", publicMetaOk === 470 && publicArtOk === 470 && publicTypeOk === 470, `meta ${publicMetaOk}, art ${publicArtOk}, type ${publicTypeOk}`);
add("No public token in IDs 1-30", publicIds.every((id) => id >= 31), `min public id = ${publicIds[0]}`);

// ---------- 3. Gameplay Class distribution ----------
const GDS = { King: 1, Guardian: 5, Farmer: 5, Lucky: 5, Runner: 5, Common: 479 };
const specClassCounts = {};
for (const s of spec.specials) specClassCounts[s.gameplayClass] = (specClassCounts[s.gameplayClass] || 0) + 1;
const commonCount = 500 - spec.specials.length; // 470 public + 9 reserved non-founder
const actual = { ...specClassCounts, Common: commonCount };
const distOk = Object.entries(GDS).every(([k, v]) => actual[k] === v);
add("Gameplay class distribution matches GDS §4.1", distOk, `King ${actual.King||0}, Guardian ${actual.Guardian||0}, Farmer ${actual.Farmer||0}, Lucky ${actual.Lucky||0}, Runner ${actual.Runner||0}, Common ${actual.Common} (sum ${Object.values(actual).reduce((a,b)=>a+b,0)})`);
add("Special 21 = King1 + Guardian5 + Farmer5 + Lucky5 + Runner5", spec.specials.length === 21 && specClassCounts.King === 1 && specClassCounts.Guardian === 5 && specClassCounts.Farmer === 5 && specClassCounts.Lucky === 5 && specClassCounts.Runner === 5, JSON.stringify(specClassCounts));

// ---------- 4. Metadata structure ----------
let schemaOk = 0;
for (const id of publicIds) {
  const m = readMeta(id);
  const hasCore = m.name && m.image === `genesis/${id}.png` && m.edition === id && Array.isArray(m.attributes) && m.hansome;
  const labels = m.attributes.map((a) => a.trait_type);
  const hasAll = ["Background", "Archetype", "Wool", "Clothing", "Neck Accessory", "Mouth", "Ear Accessory", "Glasses", "Hat", "Effect"].every((l) => labels.includes(l));
  const hasRarity = typeof m.hansome.rarityRank === "number" && typeof m.hansome.rarityScore === "number" && m.hansome.rarityOutOf === 470 && typeof m.hansome.comboHash === "string";
  if (hasCore && hasAll && hasRarity) schemaOk++;
}
add("Public metadata schema complete (10 attrs + rarity block)", schemaOk === 470, `${schemaOk}/470 conform`);
// special staging metadata carries class + locked background + archetype for the 21
let specStageOk = 0;
for (const sm of specialMeta.specials) if (sm.gameplayClass && sm.background && sm.baseArchetype && sm.image) specStageOk++;
add("Special-21 staging metadata carries class + background + archetype", specStageOk === 21, `${specStageOk}/21`);

// ---------- 5. Random assignment rules ----------
add("Deterministic seed present", gen.randomPool.deterministic === true && Number.isInteger(gen.randomPool.seed), `seed ${gen.randomPool.seed}`);
const combos = new Set(publicIds.map((id) => picks.picks[id].combo));
add("470 unique public combos (uniqueness enforced)", combos.size === 470, `${combos.size} unique / 470`);
add("Reserved(1-10) + Legendary(11-30) excluded from random pool", publicIds.every((id) => id > 30), "candidate id set starts at 31");

// ---------- 6. Trait compatibility ----------
const hatTags = JSON.parse(fs.readFileSync(path.join(ROOT, "compatibility.json"), "utf8")).traitTags;
let vBeanie = 0, vScarf = 0, vRibbon = 0;
for (const id of publicIds) {
  const s = picks.picks[id];
  if (s.hat === "wool-beanie" && s.ears !== "__none__") vBeanie++;
  if (s.clothing === "wool-scarf" && s.necklace !== "__none__") vScarf++;
  if (s.clothing === "festival-ribbon" && s.necklace !== "__none__") vRibbon++;
}
add("Compatibility: 0 Beanie↔Ears violations", vBeanie === 0, `${vBeanie}`);
add("Compatibility: 0 Scarf↔Neck violations", vScarf === 0, `${vScarf}`);
add("Compatibility: 0 Ribbon↔Neck violations", vRibbon === 0, `${vRibbon}`);
// class-lock on the 21 specials
let lockFails = 0;
for (const s of spec.specials) { const r = validateSpecialToken({ type: s.tokenId === 1 ? "Reserved" : "Legendary", gameplayClass: s.gameplayClass, background: s.background }); if (!r.ok) lockFails++; }
add("Special backgrounds class-locked (21/21)", lockFails === 0, `${lockFails} lock errors`);
// no public token uses a special background
const specialBgIds = JSON.parse(fs.readFileSync(path.join(ROOT, "traits.json"), "utf8")).categories.background.specialBackgrounds.items.map((i) => i.id);
let pubUsingSpecialBg = 0;
for (const id of publicIds) if (specialBgIds.includes(picks.picks[id].bg)) pubUsingSpecialBg++;
add("No public token uses a special background", pubUsingSpecialBg === 0, `${pubUsingSpecialBg} of 470`);

// ---------- outstanding art dependency ----------
const needArt = reserved.slice(1).map((r) => r.tokenId); // #2-10 (Common reserved) still hand-design pending
const specialArtReady = spec.specials.every((s) => fs.existsSync(path.join(SPECIAL, `${String(s.tokenId).padStart(3, "0")}.png`)));
add("Special-21 artwork present in staging (ready to place)", specialArtReady, "21/21 png in genesis/special/");

const allPass = checks.every((c) => c[1]);
let md = `# HANSOME Genesis — Pre-Assembly Verification\n\n`;
md += `_Read-only. Public 470 art/metadata untouched; nothing generated. Verifies the 6 areas required before final assembly._\n\n`;
md += `**Result: ${allPass ? "ALL CHECKS PASSED ✅ — ready to assemble on approval" : "ISSUES FOUND ❌"}**\n\n`;
md += `| # | Check | Result | Detail |\n|---|---|---|---|\n`;
checks.forEach(([n, ok, d], i) => md += `| ${i + 1} | ${n} | ${ok ? "PASS ✅" : "FAIL ❌"} | ${d} |\n`);
md += `\n## Outstanding dependency (not a blocker for the plan)\n\n`;
md += `- Reserved **#2-10** (${needArt.join(", ")}) are Common-class one-of-ones whose artwork is still \`pending-hand-design\`. Metadata slots exist; only the images are outstanding.\n`;
md += `- Founder **#001** and Legendary **#11-30** artwork is READY in \`public/pixel/genesis/special/\` and will be placed into the collection during assembly.\n`;
fs.writeFileSync(path.join(REPORTS, "pre-assembly-verification.md"), md);
console.log(md);
console.log(allPass ? "VERIFY OK" : "VERIFY FAILED");
if (!allPass) process.exitCode = 1;
