// Draw 5 cozy HANSOME countryside garments as tight, symmetric transparent sprites.
// Each garment is authored in a small grid, front-facing, draping over the torso.
// Exported as a tight PNG + placement metadata:
//   centerCol   -> horizontal centre of the sprite
//   collarRow   -> grid row that seats at the neck anchor (garment top / collar line)
//   widthFactor -> garment span relative to the measured basis width
//   basis       -> "neck" (scarf) or "body" (torso garments) width to scale against
//   drop        -> small downward nudge (fraction of base height) so it rests on the chest
// The fitting pass places a garment on every archetype via its neck + chest anchors.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { P, Sprite } from "../lib/pixel.mjs";

const OUT = "public/pixel/traits/clothing";
fs.mkdirSync(OUT, { recursive: true });
const SCALE = 16; // px per grid cell (matches base + hats + necklaces)

// filled panel: body fill, top+left highlight, right+bottom shade (soft pixel volume)
function panel(S, x0, y0, x1, y1, fill, hi, sh) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) S.set(x, y, fill);
  for (let x = x0; x <= x1; x++) { S.set(x, y0, hi); S.set(x, y1, sh); }
  for (let y = y0; y <= y1; y++) { S.set(x0, y, hi); S.set(x1, y, sh); }
  S.set(x1, y0, fill);
}

// vertical stitch/quilt hint
function vline(S, x, y0, y1, c) { for (let y = y0; y <= y1; y++) S.set(x, y, c); }
function hline(S, y, x0, x1, c) { for (let x = x0; x <= x1; x++) S.set(x, y, c); }

function disc(S, cx, cy, r, fill, hi, sh) {
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    for (let dx = -w; dx <= w; dx++) {
      let c = fill;
      if (sh && (dx > r * 0.35 || dy > r * 0.4)) c = sh;
      if (hi && dx < -r * 0.3 && dy < -r * 0.2) c = hi;
      S.set(cx + dx, cy + dy, c);
    }
  }
}

// ---------------- CLOTHING DEFINITIONS ----------------

// 1. Farmer Overalls: denim bib over the chest/belly + two shoulder straps with
//    brass buttons and a front pocket. The strongest common workwear piece.
function farmerOveralls() {
  const W = 46, H = 34, cx = 23;
  const S = new Sprite(W, H);
  const bx0 = cx - 12, bx1 = cx + 12, by0 = 9, by1 = 31;
  // shoulder straps rising to the shoulders
  panel(S, cx - 10, 0, cx - 7, by0, P.denimM, P.denimL, P.denimD);
  panel(S, cx + 7, 0, cx + 10, by0, P.denimM, P.denimL, P.denimD);
  // bib panel
  panel(S, bx0, by0, bx1, by1, P.denimM, P.denimL, P.denimD);
  // brass buttons where straps meet the bib
  disc(S, cx - 8, by0 + 1, 1, P.goldM, P.goldL, P.goldD);
  disc(S, cx + 8, by0 + 1, 1, P.goldM, P.goldL, P.goldD);
  // front pocket with stitch
  panel(S, cx - 5, by0 + 6, cx + 5, by1 - 3, P.denimD, P.denimM, P.denimD);
  hline(S, by0 + 6, cx - 5, cx + 5, P.denimL);
  vline(S, cx, by0 + 8, by1 - 4, P.denimL);
  S.autoOutline(P.outline, false);
  return { S, cx, collarRow: 0, widthFactor: 0.82, basis: "body", drop: 0.0, id: "farmer-overalls", name: "Farmer Overalls", tier: "common" };
}

// 2. Cozy Wool Scarf: a chunky knitted wrap around the neck with two ribbed tails
//    hanging down the chest. Sits high on the neck.
function woolScarf() {
  const W = 40, H = 25, cx = 20;
  const S = new Sprite(W, H);
  // wrap band around the neck (knit ridges)
  panel(S, cx - 12, 2, cx + 12, 8, P.redM, P.redL, P.redD);
  for (let x = cx - 11; x <= cx + 11; x += 2) vline(S, x, 3, 7, P.redD); // knit ribs
  // knotted fold at centre
  panel(S, cx - 4, 6, cx + 4, 12, P.redL, P.white, P.redM);
  // two hanging tails (shorter so they clear short-bodied crias' legs)
  panel(S, cx - 6, 11, cx - 1, 22, P.redM, P.redL, P.redD);
  panel(S, cx + 1, 10, cx + 6, 20, P.redM, P.redL, P.redD);
  for (let y = 13; y <= 21; y += 2) { hline(S, y, cx - 6, cx - 1, P.redD); hline(S, y, cx + 1, cx + 6, P.redD); } // fringe ridges
  // fringe tips
  for (let x = cx - 6; x <= cx - 1; x++) S.set(x, 22, P.redD);
  for (let x = cx + 1; x <= cx + 6; x++) S.set(x, 20, P.redD);
  S.autoOutline(P.outline, false);
  // bandRow/bandCols describe the wrap-band so the fitter can seat it on the neck pinch
  // and scale its width to the measured neck width (archetype-aware).
  return { S, cx, collarRow: 2, bandRow: 5, bandHalfRows: 3, bandCols: 25, widthFactor: 1.12, basis: "neck", drop: 0.0, id: "wool-scarf", name: "Cozy Wool Scarf", tier: "uncommon" };
}

// 3. Farm Vest: an open-front quilted gilet — two side panels + a collar, leaving the
//    centre wool visible so the alpaca identity reads through.
function farmVest() {
  const W = 46, H = 32, cx = 23;
  const S = new Sprite(W, H);
  const top = 6, bot = 30;
  // left + right front panels (gap in the middle shows wool)
  panel(S, cx - 13, top, cx - 4, bot, P.greenM, P.greenL, P.greenD);
  panel(S, cx + 4, top, cx + 13, bot, P.greenM, P.greenL, P.greenD);
  // quilt stitching
  for (let y = top + 3; y <= bot - 2; y += 4) { hline(S, y, cx - 12, cx - 5, P.greenD); hline(S, y, cx + 5, cx + 12, P.greenD); }
  // collar folding outward at the neck
  panel(S, cx - 13, top, cx - 8, top + 3, P.greenL, P.white, P.greenM);
  panel(S, cx + 8, top, cx + 13, top + 3, P.greenL, P.white, P.greenM);
  // wooden toggle buttons on the inner edges
  disc(S, cx - 5, top + 6, 1, P.woodM, P.woodL, P.woodD);
  disc(S, cx - 5, top + 12, 1, P.woodM, P.woodL, P.woodD);
  S.autoOutline(P.outline, false);
  return { S, cx, collarRow: 4, widthFactor: 0.92, basis: "body", drop: 0.0, id: "farm-vest", name: "Farm Vest", tier: "uncommon" };
}

// 4. Explorer Cape: a travel cape over the shoulders, fastened with a round clasp at
//    the neck and flaring softly toward the chest.
function explorerCape() {
  const W = 50, H = 32, cx = 25;
  const S = new Sprite(W, H);
  // shoulder collar band
  panel(S, cx - 12, 2, cx + 12, 6, P.purpM, P.purpL, P.purpD);
  // cape body: trapezoid widening downward
  for (let y = 6; y <= 30; y++) {
    const t = (y - 6) / 24;
    const half = Math.round(11 + t * 9);
    for (let x = cx - half; x <= cx + half; x++) {
      let c = P.purpM;
      if (x < cx - half + 2) c = P.purpL;
      else if (x > cx + half - 2 || y > 28) c = P.purpD;
      S.set(x, y, c);
    }
  }
  // soft vertical drape folds
  for (const fx of [-9, 0, 9]) for (let y = 8; y <= 29; y += 2) S.set(cx + fx, y, P.purpD);
  // round clasp at the throat
  disc(S, cx, 4, 2, P.goldM, P.goldL, P.goldD);
  S.autoOutline(P.outline, false);
  return { S, cx, collarRow: 2, widthFactor: 1.0, basis: "body", drop: 0.0, id: "explorer-cape", name: "Explorer Cape", tier: "rare" };
}

// 5. Festival Ribbon Outfit: a bright harvest-festival sash across the chest with a
//    rosette and hanging ribbons + a tiny bell. Cheerful village-celebration piece.
function festivalRibbon() {
  const W = 46, H = 34, cx = 23;
  const S = new Sprite(W, H);
  // diagonal sash from left shoulder to right hip
  for (let i = 0; i <= 26; i++) {
    const x = cx - 12 + i, y = 3 + Math.round(i * 0.85);
    for (let k = 0; k < 4; k++) { S.set(x, y + k, k < 2 ? P.berryM : P.berryD); S.set(x, y + k - 1, P.berryL); }
  }
  // rosette at the centre of the chest
  const rx = cx - 1, ry = 15;
  for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, -2], [-2, 2], [2, 2]]) disc(S, rx + dx, ry + dy, 1, P.goldL, P.white, P.goldM);
  disc(S, rx, ry, 2, P.berryL, P.white, P.berryM);
  disc(S, rx, ry, 1, P.goldM, P.goldL, P.goldD);
  // two hanging ribbon tails
  panel(S, rx - 3, ry + 3, rx - 1, ry + 12, P.berryM, P.berryL, P.berryD);
  panel(S, rx + 1, ry + 3, rx + 3, ry + 10, P.goldM, P.goldL, P.goldD);
  // notched ribbon tips
  S.set(rx - 3, ry + 12, P.clear); S.set(rx - 1, ry + 12, P.clear);
  // tiny festival bell
  disc(S, rx + 2, ry + 13, 1, P.goldM, P.goldL, P.goldD);
  S.autoOutline(P.outline, false);
  return { S, cx, collarRow: 1, widthFactor: 0.92, basis: "body", drop: 0.0, id: "festival-ribbon", name: "Festival Ribbon Outfit", tier: "epic" };
}

function renderTight(S) {
  const w = S.w * SCALE, h = S.h * SCALE;
  const buf = Buffer.alloc(w * h * 4, 0);
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
    const c = S.get(x, y);
    if (!c || c[3] === 0) continue;
    for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) {
      const i = ((y * SCALE + dy) * w + (x * SCALE + dx)) * 4;
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = c[3];
    }
  }
  return { buf, w, h };
}

const items = [farmerOveralls(), woolScarf(), farmVest(), explorerCape(), festivalRibbon()];
const meta = {};
for (const n of items) {
  const { buf, w, h } = renderTight(n.S);
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toFile(path.join(OUT, `${n.id}.png`));
  meta[n.id] = {
    name: n.name, tier: n.tier, file: `clothing/${n.id}.png`,
    pngW: w, pngH: h, scale: SCALE,
    centerXpx: n.cx * SCALE, collarYpx: n.collarRow * SCALE,
    bandYpx: n.bandRow != null ? n.bandRow * SCALE : null,
    bandWpx: n.bandCols != null ? n.bandCols * SCALE : null,
    bandHalfPx: n.bandHalfRows != null ? n.bandHalfRows * SCALE : null,
    widthFactor: n.widthFactor, basis: n.basis, drop: n.drop,
    offsets: {}, // per-archetype {dx,dy} overrides — empty = fully anchor-driven
  };
  console.log(`${n.id.padEnd(18)} ${w}x${h}  center=${n.cx * SCALE} collar=${n.collarRow * SCALE} wf=${n.widthFactor} basis=${n.basis}`);
}
fs.writeFileSync(path.join(OUT, "_clothing-meta.json"), JSON.stringify(meta, null, 2));
console.log("wrote", Object.keys(meta).length, "clothing + _clothing-meta.json");
