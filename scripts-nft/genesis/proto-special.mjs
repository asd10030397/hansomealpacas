// SPECIAL-21 artwork PROTOTYPES — 5 class representatives only.
//   King #001 (mascot base) · Guardian #11 (elder) · Farmer #16 (puff) · Lucky #21 (cria) · Runner #26 (sleek)
// Composite = class-locked special background + existing Genesis base (no new anatomy) + ONE subtle,
// optional class accent. Prototypes for review; NOT final NFTs, NO metadata, public pipeline untouched.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { W, H, CELL, P, createCanvas, save, Sprite } from "../lib/pixel.mjs";

const ROOT = "public/pixel/traits";
const NORM = path.join(ROOT, "base/normalized");
const BG = path.join(ROOT, "backgrounds");
const OUT = path.join(ROOT, "..", "genesis", "special-proto");
fs.mkdirSync(OUT, { recursive: true });
const anchors = JSON.parse(fs.readFileSync(path.join(ROOT, "base/anchors.json"), "utf8")).archetypes;
const G = (px) => Math.round(px / CELL); // px -> grid cell

// ---- normalized mascot (Founder-exclusive) built to match the family frame (SF, ground-align, center) ----
const SF = 0.781742;
async function mascotNormalized() {
  const src = "public/pixel/alpaca-nft-master-base.png";
  const bb = { x0: 218, y0: 71, x1: 820, y1: 917 };
  const w = bb.x1 - bb.x0 + 1, h = bb.y1 - bb.y0 + 1;
  const sw = Math.round(w * SF), sh = Math.round(h * SF);
  const cropped = await sharp(src).extract({ left: bb.x0, top: bb.y0, width: w, height: h }).resize(sw, sh, { kernel: "nearest" }).png().toBuffer();
  const left = 512 - Math.round(sw / 2), top = 985 - sh;
  const buf = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: cropped, left, top }]).png().toBuffer();
  return { buf, crown: { x: 512, y: top }, ear: { x: left + Math.round(sw * 0.28), y: top + Math.round(sh * 0.22) }, chest: { x: 512, y: top + Math.round(sh * 0.55) } };
}

// ---------- accent sprites (small, subtle) ----------
function crownSprite() {
  const S = new Sprite(9, 6), Gd = P.goldL, D = P.goldD, r = P.redM, b = P.skyD, gr = P.greenM;
  S.set(0, 1, Gd); S.set(2, 1, Gd); S.set(4, 0, Gd); S.set(6, 1, Gd); S.set(8, 1, Gd); // tips
  S.span(2, 0, 8, Gd); S.span(3, 0, 8, Gd); S.span(4, 0, 8, D); // body + band
  S.set(2, 3, r); S.set(4, 3, b); S.set(6, 3, gr); // jewels
  S.autoOutline(P.outline); return S;
}
// Guardian insignia PIN — a small ROUND medallion with a defensive chevron. Deliberately circular
// (not a shield/diamond) so it never competes with the background shield emblem. Subtle class accent
// that keeps the defensive identity via the chevron; echoes the background's steel/cyan palette.
function pinSprite() {
  const S = new Sprite(5, 5), D = [70, 84, 104, 255], L = [150, 176, 200, 255], c = [150, 224, 224, 255], cH = [214, 244, 244, 255];
  // round steel frame
  for (const [x, y] of [[1, 0], [2, 0], [3, 0], [0, 1], [4, 1], [0, 2], [4, 2], [0, 3], [4, 3], [1, 4], [2, 4], [3, 4]]) S.set(x, y, D);
  // light steel inner face
  for (const [x, y] of [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2], [1, 3], [2, 3], [3, 3]]) S.set(x, y, L);
  // cyan defensive chevron (downward V)
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

// motion accent: speed dashes trailing to the LEFT of the body — tasteful but readable.
// Leading edge (near the body) is brighter; the tail fades out for a clear sense of motion.
function motionBuf(bbox) {
  const buf = createCanvas();
  const put = (gx, gy, a) => { const bx = gx * CELL, by = gy * CELL; for (let yy = by; yy < by + CELL; yy++) for (let xx = bx; xx < bx + CELL; xx++) { const i = (yy * W + xx) * 4; buf[i] = 248; buf[i + 1] = 251; buf[i + 2] = 253; buf[i + 3] = a; } };
  const gx1 = G(bbox.x0) - 1; // just left of the body
  // rows: [gy, length]; each dash brightens toward the body (leading edge)
  for (const [gy, len] of [[33, 5], [37, 6], [41, 6], [45, 5]]) {
    for (let i = 0; i < len; i++) { const gx = gx1 - i; const a = Math.round(235 * (1 - i / (len + 1))); put(gx, gy, Math.max(60, a)); }
  }
  return buf;
}

async function bufToPng(buf) { return await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer(); }

async function main() {
  const reps = [];

  // KING #001 — mascot + small crown
  {
    const m = await mascotNormalized();
    const crown = blitSprite(crownSprite(), G(m.crown.x) - 4, G(m.crown.y) - 4);
    const out = await sharp(path.join(BG, "king.png")).composite([{ input: m.buf }, { input: await bufToPng(crown) }]).png().toBuffer();
    reps.push({ id: "king-001", label: "King #001 · The Founder King · mascot", buf: out });
  }
  // GUARDIAN #11 — elder + small guardian insignia pin (chest)
  {
    const a = anchors.elder;
    const pin = blitSprite(pinSprite(), G(a.chest.x) - 2, G(a.chest.y) - 2);
    const out = await sharp(path.join(BG, "guardian.png")).composite([{ input: path.join(NORM, "elder.png") }, { input: await bufToPng(pin) }]).png().toBuffer();
    reps.push({ id: "guardian-011", label: "Guardian #11 · Warden of the Old Stones · elder", buf: out });
  }
  // FARMER #16 — puff + wheat sprig (by ear)
  {
    const a = anchors.puff;
    const wheat = blitSprite(wheatSprite(), G(a.ear.left.x) - 2, G(a.ear.left.y) - 5);
    const out = await sharp(path.join(BG, "farmer.png")).composite([{ input: path.join(NORM, "puff.png") }, { input: await bufToPng(wheat) }]).png().toBuffer();
    reps.push({ id: "farmer-016", label: "Farmer #16 · Keeper of the Golden Fields · puff", buf: out });
  }
  // LUCKY #21 — cria + clover (by ear)
  {
    const a = anchors.cria;
    const clover = blitSprite(cloverSprite(), G(a.ear.left.x) - 2, G(a.ear.left.y) - 4);
    const out = await sharp(path.join(BG, "lucky.png")).composite([{ input: path.join(NORM, "cria.png") }, { input: await bufToPng(clover) }]).png().toBuffer();
    reps.push({ id: "lucky-021", label: "Lucky #21 · The Clover Child · cria", buf: out });
  }
  // RUNNER #26 — sleek + subtle motion dashes
  {
    const a = anchors.sleek;
    const motion = motionBuf(a.bbox);
    const out = await sharp(path.join(BG, "runner.png")).composite([{ input: await bufToPng(motion) }, { input: path.join(NORM, "sleek.png") }]).png().toBuffer();
    reps.push({ id: "runner-026", label: "Runner #26 · The Dawn Runner · sleek", buf: out });
  }

  for (const r of reps) { await sharp(r.buf).png().toFile(path.join(OUT, `${r.id}.png`)); console.log("wrote", r.id); }

  // review sheet
  const CELLP = 460, PAD = 12, LBL = 26, COLS = reps.length, SW = COLS * (CELLP + PAD) + PAD, SH = 50 + CELLP + LBL + PAD;
  const comps = [{ input: Buffer.from(`<svg width="${SW}" height="44"><text x="${SW / 2}" y="30" font-family="Verdana" font-size="24" font-weight="bold" fill="#5b4636" text-anchor="middle">Special-21 Prototypes — 5 class representatives (background + existing base + subtle class accent)</text></svg>`), top: 8, left: 0 }];
  for (let i = 0; i < reps.length; i++) {
    const x0 = PAD + i * (CELLP + PAD), y0 = 50;
    comps.push({ input: await sharp(reps[i].buf).resize(CELLP, CELLP, { kernel: "nearest" }).png().toBuffer(), top: y0, left: x0 });
    comps.push({ input: Buffer.from(`<svg width="${CELLP}" height="${LBL}"><text x="4" y="18" font-family="Verdana" font-size="13" fill="#5b4636">${reps[i].label}</text></svg>`), top: y0 + CELLP, left: x0 });
  }
  await sharp({ create: { width: SW, height: SH, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } }).composite(comps).png().toFile(path.join(OUT, "_PROTO-REVIEW.png"));
  console.log("wrote _PROTO-REVIEW.png");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
