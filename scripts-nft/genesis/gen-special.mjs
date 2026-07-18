// SPECIAL-21 artwork generation — all 21 from the approved allocation spec.
// Each = class-locked background + existing Genesis archetype (no new anatomy) + ONE subtle class accent,
// placed via that archetype's anchors. Same recipe as the 5 approved prototypes.
// Non-destructive: outputs to public/pixel/genesis/special/ (staging). NO minting, public pipeline untouched.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { W, H, CELL, P, createCanvas, Sprite } from "../lib/pixel.mjs";
import { validateSpecialToken } from "./validate-special.mjs";

const ROOT = "public/pixel/traits";
const NORM = path.join(ROOT, "base/normalized");
const BG = path.join(ROOT, "backgrounds");
const OUT = "public/pixel/genesis/special";
fs.mkdirSync(OUT, { recursive: true });
const anchors = JSON.parse(fs.readFileSync(path.join(ROOT, "base/anchors.json"), "utf8")).archetypes;
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, "special-21-allocation.json"), "utf8"));
const G = (px) => Math.round(px / CELL);
const SF = 0.781742;

async function mascotNormalized() {
  const src = "public/pixel/alpaca-nft-master-base.png";
  const bb = { x0: 218, y0: 71, x1: 820, y1: 917 };
  const w = bb.x1 - bb.x0 + 1, h = bb.y1 - bb.y0 + 1;
  const sw = Math.round(w * SF), sh = Math.round(h * SF);
  const cropped = await sharp(src).extract({ left: bb.x0, top: bb.y0, width: w, height: h }).resize(sw, sh, { kernel: "nearest" }).png().toBuffer();
  const left = 512 - Math.round(sw / 2), top = 985 - sh;
  const buf = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: cropped, left, top }]).png().toBuffer();
  return { buf, crown: { x: 512, y: top } };
}

// ---- accent sprites (identical to approved prototypes) ----
function crownSprite() {
  const S = new Sprite(9, 6), Gd = P.goldL, D = P.goldD, r = P.redM, b = P.skyD, gr = P.greenM;
  S.set(0, 1, Gd); S.set(2, 1, Gd); S.set(4, 0, Gd); S.set(6, 1, Gd); S.set(8, 1, Gd);
  S.span(2, 0, 8, Gd); S.span(3, 0, 8, Gd); S.span(4, 0, 8, D);
  S.set(2, 3, r); S.set(4, 3, b); S.set(6, 3, gr);
  S.autoOutline(P.outline); return S;
}
function pinSprite() {
  const S = new Sprite(5, 5), D = [70, 84, 104, 255], L = [150, 176, 200, 255], c = [150, 224, 224, 255], cH = [214, 244, 244, 255];
  for (const [x, y] of [[1, 0], [2, 0], [3, 0], [0, 1], [4, 1], [0, 2], [4, 2], [0, 3], [4, 3], [1, 4], [2, 4], [3, 4]]) S.set(x, y, D);
  for (const [x, y] of [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2], [1, 3], [2, 3], [3, 3]]) S.set(x, y, L);
  S.set(1, 1, c); S.set(3, 1, c); S.set(2, 2, cH); S.set(1, 2, L); S.set(3, 2, L); S.set(2, 3, c);
  S.autoOutline(P.outline); return S;
}
function wheatSprite() {
  const S = new Sprite(5, 7), g0 = P.strawM, gl = P.strawL, st = [126, 120, 62, 255];
  for (let y = 3; y < 7; y++) S.set(2, y, st);
  S.set(2, 0, gl); S.set(1, 1, g0); S.set(3, 1, g0); S.set(2, 1, gl); S.set(1, 2, g0); S.set(3, 2, g0); S.set(2, 2, gl); S.set(1, 3, g0); S.set(3, 3, g0);
  S.autoOutline(P.outline); return S;
}
function cloverSprite() {
  const S = new Sprite(5, 6), g0 = P.greenM, gl = P.greenL, st = [126, 120, 62, 255];
  S.set(1, 0, gl); S.set(1, 1, g0); S.set(3, 0, gl); S.set(3, 1, g0);
  S.set(1, 3, g0); S.set(1, 4, gl); S.set(3, 3, g0); S.set(3, 4, gl);
  S.set(2, 2, [96, 152, 74, 255]); S.set(2, 3, st); S.set(2, 4, st);
  S.autoOutline(P.outline); return S;
}
function blitSprite(S, gx0, gy0) { const buf = createCanvas(); S.blit(buf, gx0, gy0); return buf; }
function motionBuf(bbox) {
  const buf = createCanvas();
  const put = (gx, gy, a) => { const bx = gx * CELL, by = gy * CELL; for (let yy = by; yy < by + CELL; yy++) for (let xx = bx; xx < bx + CELL; xx++) { const i = (yy * W + xx) * 4; buf[i] = 248; buf[i + 1] = 251; buf[i + 2] = 253; buf[i + 3] = a; } };
  const gx1 = G(bbox.x0) - 1;
  for (const [gy, len] of [[33, 5], [37, 6], [41, 6], [45, 5]]) for (let i = 0; i < len; i++) { const a = Math.round(235 * (1 - i / (len + 1))); put(gx1 - i, gy, Math.max(60, a)); }
  return buf;
}
async function bufToPng(buf) { return await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer(); }

async function composeSpecial(s) {
  const bgPath = path.join(BG, `${s.background}.png`);
  const cls = s.gameplayClass;
  let baseInput, a;
  if (s.tokenId === 1) { const m = await mascotNormalized(); baseInput = m.buf; a = { crown: m.crown }; }
  else { const arch = s.baseArchetype; baseInput = path.join(NORM, `${arch}.png`); a = anchors[arch]; }

  if (cls === "Runner") {
    const motion = await bufToPng(motionBuf(a.bbox));
    return await sharp(bgPath).composite([{ input: motion }, { input: baseInput }]).png().toBuffer();
  }
  let accent;
  if (cls === "King") accent = blitSprite(crownSprite(), G(a.crown.x) - 4, G(a.crown.y) - 4);
  else if (cls === "Guardian") accent = blitSprite(pinSprite(), G(a.chest.x) - 2, G(a.chest.y) - 2);
  else if (cls === "Farmer") accent = blitSprite(wheatSprite(), G(a.ear.left.x) - 2, G(a.ear.left.y) - 5);
  else if (cls === "Lucky") accent = blitSprite(cloverSprite(), G(a.ear.left.x) - 2, G(a.ear.left.y) - 4);
  return await sharp(bgPath).composite([{ input: baseInput }, { input: await bufToPng(accent) }]).png().toBuffer();
}

async function main() {
  const done = [];
  let lockErrors = 0;
  for (const s of spec.specials) {
    const r = validateSpecialToken({ type: s.tokenId === 1 ? "Reserved" : "Legendary", gameplayClass: s.gameplayClass, background: s.background });
    if (!r.ok) { console.error("LOCK FAIL", s.specialId, r.errors); lockErrors++; }
    const buf = await composeSpecial(s);
    const id = String(s.tokenId).padStart(3, "0");
    await sharp(buf).png().toFile(path.join(OUT, `${id}.png`));
    done.push({ ...s, id });
  }
  console.log(`generated ${done.length} special artworks · class-lock errors: ${lockErrors}`);
  fs.writeFileSync(path.join(OUT, "_special-metadata.json"), JSON.stringify({ note: "staging metadata for the Special 21 — artwork generated, awaiting final collection assembly", specials: done.map(d => ({ tokenId: d.tokenId, specialId: d.specialId, gameplayClass: d.gameplayClass, background: d.background, baseArchetype: d.baseArchetype, roleName: d.roleName, image: `special/${d.id}.png` })) }, null, 2));

  // ---------- complete review sheet, grouped by class (one row per class) ----------
  const classes = ["King", "Guardian", "Farmer", "Lucky", "Runner"];
  const byClass = {}; for (const c of classes) byClass[c] = done.filter(d => d.gameplayClass === c).sort((x, y) => x.tokenId - y.tokenId);
  const COLS = 5, CELLP = 300, PAD = 10, LBL = 22, ROWLBL = 26;
  const SW = COLS * (CELLP + PAD) + PAD + 8;
  const rowH = ROWLBL + CELLP + LBL + PAD;
  const SH = 50 + classes.length * rowH + PAD;
  const comps = [{ input: Buffer.from(`<svg width="${SW}" height="44"><text x="${SW / 2}" y="30" font-family="Verdana" font-size="26" font-weight="bold" fill="#5b4636" text-anchor="middle">HANSOME Genesis — Special 21 (complete): background + existing archetype + one subtle class accent</text></svg>`), top: 8, left: 0 }];
  for (let r = 0; r < classes.length; r++) {
    const cls = classes[r], row = byClass[cls];
    const yRow = 50 + r * rowH;
    comps.push({ input: Buffer.from(`<svg width="${SW}" height="${ROWLBL}"><text x="8" y="19" font-family="Verdana" font-size="17" font-weight="bold" fill="#5b4636">${cls} — ${row.length}</text></svg>`), top: yRow, left: 0 });
    for (let i = 0; i < row.length; i++) {
      const d = row[i], x0 = PAD + i * (CELLP + PAD), y0 = yRow + ROWLBL;
      comps.push({ input: await sharp(path.join(OUT, `${d.id}.png`)).resize(CELLP, CELLP, { kernel: "nearest" }).png().toBuffer(), top: y0, left: x0 });
      comps.push({ input: Buffer.from(`<svg width="${CELLP}" height="${LBL}"><text x="4" y="16" font-family="Verdana" font-size="12" fill="#5b4636">#${String(d.tokenId).padStart(3, "0")} ${d.roleName.split(" — ")[0]} · ${d.baseArchetype.split(" ")[0]}</text></svg>`), top: y0 + CELLP, left: x0 });
    }
  }
  await sharp({ create: { width: SW, height: SH, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } }).composite(comps).png().toFile(path.join(OUT, "_SPECIAL-REVIEW.png"));
  console.log("wrote _SPECIAL-REVIEW.png");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
