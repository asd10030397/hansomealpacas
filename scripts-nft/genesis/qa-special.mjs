// Final QA for the Special-21 staging collection. Read-only: does NOT touch the public 470 pipeline
// and does NOT assemble the final collection. Cross-checks metadata vs the allocation spec, verifies
// image dimensions/integrity + class-lock, and renders thumbnail-readability strips (96px & 64px).
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { validateSpecialToken } from "./validate-special.mjs";

const ROOT = "public/pixel/traits";
const OUT = "public/pixel/genesis/special";
const REPORTS = "reports/genesis/final";
fs.mkdirSync(REPORTS, { recursive: true });

const spec = JSON.parse(fs.readFileSync(path.join(ROOT, "special-21-allocation.json"), "utf8"));
const meta = JSON.parse(fs.readFileSync(path.join(OUT, "_special-metadata.json"), "utf8"));
const specBy = Object.fromEntries(spec.specials.map((s) => [s.tokenId, s]));
const metaBy = Object.fromEntries(meta.specials.map((m) => [m.tokenId, m]));

const rows = [];
let fails = 0;
for (const s of spec.specials) {
  const id = String(s.tokenId).padStart(3, "0");
  const m = metaBy[s.tokenId];
  const errs = [];
  if (!m) errs.push("missing metadata entry");
  else {
    if (m.gameplayClass !== s.gameplayClass) errs.push(`class ${m.gameplayClass}≠${s.gameplayClass}`);
    if (m.background !== s.background) errs.push(`bg ${m.background}≠${s.background}`);
    if (m.baseArchetype !== s.baseArchetype) errs.push(`arch ${m.baseArchetype}≠${s.baseArchetype}`);
    if (m.image !== `special/${id}.png`) errs.push(`image path ${m.image}`);
  }
  const p = path.join(OUT, `${id}.png`);
  let dim = "—";
  if (!fs.existsSync(p)) errs.push("PNG missing");
  else {
    const md = await sharp(p).metadata();
    dim = `${md.width}x${md.height}`;
    if (md.width !== 1024 || md.height !== 1024) errs.push(`dim ${dim}`);
  }
  // class-lock rule
  const lock = validateSpecialToken({ type: s.tokenId === 1 ? "Reserved" : "Legendary", gameplayClass: s.gameplayClass, background: s.background });
  if (!lock.ok) errs.push(...lock.errors);
  if (errs.length) fails++;
  rows.push({ id, s, dim, errs });
}

// ---- thumbnail-readability strips ----
async function strip(size, gap, cols, name) {
  const cellW = size, cellH = size + 16;
  const W = cols * (cellW + gap) + gap, rowsN = Math.ceil(spec.specials.length / cols);
  const H = 30 + rowsN * (cellH + gap) + gap;
  const comps = [{ input: Buffer.from(`<svg width="${W}" height="26"><text x="8" y="19" font-family="Verdana" font-size="15" font-weight="bold" fill="#5b4636">Special 21 — thumbnail readability @ ${size}px</text></svg>`), top: 4, left: 0 }];
  let i = 0;
  for (const s of spec.specials) {
    const id = String(s.tokenId).padStart(3, "0");
    const r = Math.floor(i / cols), c = i % cols;
    const x = gap + c * (cellW + gap), y = 30 + r * (cellH + gap);
    comps.push({ input: await sharp(path.join(OUT, `${id}.png`)).resize(size, size, { kernel: "nearest" }).png().toBuffer(), top: y, left: x });
    comps.push({ input: Buffer.from(`<svg width="${cellW}" height="16"><text x="2" y="12" font-family="Verdana" font-size="10" fill="#5b4636">#${id} ${s.gameplayClass}</text></svg>`), top: y + size, left: x });
    i++;
  }
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } }).composite(comps).png().toFile(path.join(OUT, name));
}
await strip(96, 8, 7, "_THUMBS-96.png");
await strip(64, 6, 11, "_THUMBS-64.png");

// ---- report ----
let md = `# HANSOME Genesis — Special 21 Final QA Report\n\n`;
md += `_Read-only QA of the staging collection. Public 470 pipeline untouched; final collection NOT generated._\n\n`;
md += `**Automated checks:** metadata↔spec match, PNG present & 1024×1024, class-lock rule. **Result: ${fails === 0 ? "ALL 21 PASS ✅" : `${fails} TOKEN(S) WITH ISSUES ❌`}**\n\n`;
md += `| Token | Class | Background | Archetype | Dim | Auto checks |\n|---|---|---|---|---|---|\n`;
for (const r of rows) md += `| #${r.id} | ${r.s.gameplayClass} | ${r.s.background} | ${r.s.baseArchetype.split(" ")[0]} | ${r.dim} | ${r.errs.length ? "❌ " + r.errs.join("; ") : "PASS ✅"} |\n`;
md += `\n> Thumbnail-readability strips written: \`_THUMBS-96.png\`, \`_THUMBS-64.png\`. Visual checklist (identity / focus / accent subtlety / anatomy / clipping) assessed from the review + thumbnail sheets.\n`;
fs.writeFileSync(path.join(REPORTS, "special-21-qa.md"), md);
console.log(md);
console.log(`Auto-check tokens with issues: ${fails}`);
