// READ-ONLY validation of the final Genesis 500 metadata package (public/pixel/genesis/mint/).
// Verifies tokenId coverage, type/class distribution vs GDS, schema completeness, image presence,
// public rarity block, special class-lock, and Founder mascot flag. Writes a report; changes nothing.
import fs from "node:fs";
import path from "node:path";
import { validateSpecialToken } from "./validate-special.mjs";

const PKG = "public/pixel/genesis/mint";
const METADIR = path.join(PKG, "metadata");
const IMGDIR = path.join(PKG, "image");
const REPORTS = "reports/genesis/final";
const rd = (id) => JSON.parse(fs.readFileSync(path.join(METADIR, `${id}.json`), "utf8"));

const checks = [];
const add = (n, ok, d) => checks.push([n, ok, d]);

// coverage 1-500
let missing = [], badEdition = 0, badImage = 0, noImgFile = 0;
const type = {}, cls = {};
for (let id = 1; id <= 500; id++) {
  const p = path.join(METADIR, `${id}.json`);
  if (!fs.existsSync(p)) { missing.push(id); continue; }
  const m = rd(id);
  if (m.edition !== id) badEdition++;
  if (m.image !== `ipfs://__IMAGE_CID__/${id}.png`) badImage++;
  if (!fs.existsSync(path.join(IMGDIR, `${id}.png`))) noImgFile++;
  const t = m.hansome?.type; type[t] = (type[t] || 0) + 1;
  const c = m.hansome?.gameplayClass; cls[c] = (cls[c] || 0) + 1;
}
add("Token coverage 1-500 complete (no gaps)", missing.length === 0, missing.length ? `missing ${missing.slice(0,5)}...` : "500/500");
add("edition === tokenId for all", badEdition === 0, `${badEdition} mismatches`);
add("image ref scheme ipfs://<CID>/<id>.png for all", badImage === 0, `${badImage} bad`);
add("image file present for all 500", noImgFile === 0, `${500 - noImgFile}/500 present`);

// type distribution
add("Type: Public 470", type.Public === 470, `${type.Public}`);
add("Type: Legendary 20", type.Legendary === 20, `${type.Legendary}`);
add("Type: Reserved 10", type.Reserved === 10, `${type.Reserved}`);

// gameplay class distribution vs GDS §4.1
const GDS = { King: 1, Guardian: 5, Farmer: 5, Lucky: 5, Runner: 5, Common: 479 };
const distOk = Object.entries(GDS).every(([k, v]) => cls[k] === v);
add("Gameplay class distribution == GDS §4.1", distOk, `King ${cls.King} Guardian ${cls.Guardian} Farmer ${cls.Farmer} Lucky ${cls.Lucky} Runner ${cls.Runner} Common ${cls.Common}`);

// every token has Type + Gameplay Class + ability
let missAttr = 0;
for (let id = 1; id <= 500; id++) {
  const m = rd(id); const labels = m.attributes.map((a) => a.trait_type);
  if (!labels.includes("Type") || !labels.includes("Gameplay Class") || !m.hansome?.ability) missAttr++;
}
add("All tokens carry Type + Gameplay Class + ability", missAttr === 0, `${missAttr} missing`);

// public schema: 12 attributes + rarity block
let pubOk = 0;
for (let id = 31; id <= 500; id++) {
  const m = rd(id); const labels = m.attributes.map((a) => a.trait_type);
  const need = ["Type", "Gameplay Class", "Background", "Archetype", "Wool", "Clothing", "Neck Accessory", "Mouth", "Ear Accessory", "Glasses", "Hat", "Effect"];
  const hasAll = need.every((l) => labels.includes(l));
  const r = m.hansome;
  if (hasAll && r.type === "Public" && typeof r.rarityRank === "number" && typeof r.rarityScore === "number" && r.rarityOutOf === 470 && r.comboHash) pubOk++;
}
add("Public (470) schema complete + rarity block", pubOk === 470, `${pubOk}/470`);

// special class-lock (1, 11-30)
let specOk = 0, lockFail = 0;
const specialIds = [1, ...Array.from({ length: 20 }, (_, i) => 11 + i)];
for (const id of specialIds) {
  const m = rd(id); const h = m.hansome;
  const r = validateSpecialToken({ type: h.type, gameplayClass: h.gameplayClass, background: h.specialBackground });
  if (!r.ok) lockFail++;
  if (h.excludedFromRarity === true && h.specialBackground && h.gameplayClass && h.role) specOk++;
}
add("Special 21 class-lock valid (bg matches class)", lockFail === 0, `${lockFail} lock errors`);
add("Special 21 carry class + background + role + excludedFromRarity", specOk === 21, `${specOk}/21`);
add("Founder #001 uses mascot appearance + King", rd(1).hansome.usesMascotAppearance === true && rd(1).hansome.gameplayClass === "King", `${rd(1).name}`);

// reserved commons 2-10
let resOk = 0;
for (let id = 2; id <= 10; id++) { const h = rd(id).hansome; if (h.type === "Reserved" && h.gameplayClass === "Common" && h.artwork === "pending-hand-design" && h.role) resOk++; }
add("Reserved commons #2-10 = Common, artwork pending", resOk === 9, `${resOk}/9`);

// contract + schema files
add("contract.json present (royalties 5% = 500 bps)", fs.existsSync(path.join(METADIR, "contract.json")) && JSON.parse(fs.readFileSync(path.join(METADIR, "contract.json"), "utf8")).seller_fee_basis_points === 500, "ok");
add("attribute-schema.json present", fs.existsSync(path.join(PKG, "attribute-schema.json")), "ok");

const allPass = checks.every((c) => c[1]);
let md = `# HANSOME Genesis 500 — Metadata Package Validation\n\n`;
md += `_Read-only. Package at \`public/pixel/genesis/mint/\`. Artwork unchanged (approved images copied). No Solidity, not pinned._\n\n`;
md += `**Result: ${allPass ? "ALL CHECKS PASSED ✅" : "ISSUES FOUND ❌"}**\n\n`;
md += `| # | Check | Result | Detail |\n|---|---|---|---|\n`;
checks.forEach(([n, ok, d], i) => md += `| ${i + 1} | ${n} | ${ok ? "PASS ✅" : "FAIL ❌"} | ${d} |\n`);
md += `\n## Distribution\n\n| Type | Count |\n|---|---|\n| Public | ${type.Public} |\n| Legendary | ${type.Legendary} |\n| Reserved | ${type.Reserved} |\n\n`;
md += `| Gameplay Class | Count |\n|---|---|\n`;
for (const k of ["King", "Guardian", "Farmer", "Lucky", "Runner", "Common"]) md += `| ${k} | ${cls[k]} |\n`;
md += `\n## Outstanding (documented, not a blocker)\n\n- Reserved commons **#2–10** artwork is \`pending-hand-design\` (labelled placeholder tiles in the package); metadata is final.\n- Image refs use placeholder \`ipfs://__IMAGE_CID__/<id>.png\`; bake real CID with \`IMAGE_CID=<cid> node scripts-nft/genesis/build-metadata-package.mjs\` at pin time.\n`;
fs.writeFileSync(path.join(REPORTS, "metadata-package-validation.md"), md);
console.log(md);
console.log(allPass ? "PACKAGE OK" : "PACKAGE FAILED");
if (!allPass) process.exitCode = 1;
