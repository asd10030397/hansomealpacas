// Draw 5 cozy HANSOME glasses as tight, symmetric transparent sprites (front-facing:
// two lenses over the two eyes + a bridge; temple stubs point outward toward the ears).
// Exported as tight PNG + placement metadata:
//   centerCol   -> horizontal centre (maps to the eye-centre)
//   eyeRow      -> grid row of the lens centres (aligns to the eye line)
//   lensGap     -> distance (px) between the two lens centres (scaled to the eye span)
//   strapToEar  -> if true, the fitter draws a strap from each lens to the ear anchor
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { P, Sprite } from "../lib/pixel.mjs";

const OUT = "public/pixel/traits/glasses";
fs.mkdirSync(OUT, { recursive: true });
const SCALE = 16;

const SKYT = [150, 196, 224, 255];   // tinted lens
const GLASSHI = [236, 246, 252, 255]; // lens sheen

// outlined ring (frame). thick = ring thickness in cells.
function ring(S, cx, cy, r, color, thick = 2) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r + 0.5 && d >= r - thick + 0.5) S.set(cx + dx, cy + dy, color);
    }
  }
}
function fillDisc(S, cx, cy, r, color) {
  for (let dy = -r; dy <= r; dy++) { const w = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy))); for (let dx = -w; dx <= w; dx++) S.set(cx + dx, cy + dy, color); }
}

// ---------------- GLASSES DEFINITIONS ----------------

// 1. Round Glasses: thin warm-wire round frames, clear lenses. (common)
function roundGlasses() {
  const W = 46, H = 20, cx = 23, eyeRow = 10, r = 5, gap = 11;
  const S = new Sprite(W, H);
  const L = cx - gap, R = cx + gap;
  for (const lc of [L, R]) { fillDisc(S, lc, eyeRow, r - 1, SKYT); ring(S, lc, eyeRow, r, P.goldM, 2); S.set(lc - 2, eyeRow - 3, GLASSHI); S.set(lc - 3, eyeRow - 2, GLASSHI); }
  // bridge (temple arms are hidden behind the wool on a front view, so omitted)
  for (let x = L + r - 1; x <= R - r + 1; x++) { S.set(x, eyeRow - 2, P.goldM); }
  S.autoOutline(P.outline, false);
  return { S, cx, eyeRow, lensGap: (R - L), id: "round-glasses", name: "Round Glasses", tier: "common" };
}

// 2. Reading Glasses: half-moon lenses perched a touch low, thin wire. (uncommon)
function readingGlasses() {
  const W = 48, H = 20, cx = 24, eyeRow = 8, r = 5, gap = 12;
  const S = new Sprite(W, H);
  const L = cx - gap, R = cx + gap;
  for (const lc of [L, R]) {
    // bottom half-moon lens
    for (let dy = 0; dy <= r; dy++) { const w = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy))); for (let dx = -w; dx <= w; dx++) S.set(lc + dx, eyeRow + dy, SKYT); }
    // frame along the arc + straight top bar
    for (let x = lc - r; x <= lc + r; x++) S.set(x, eyeRow, P.goldM);
    ring(S, lc, eyeRow, r, P.goldM, 2);
    for (let dy = -r; dy < 0; dy++) for (let dx = -r; dx <= r; dx++) { if (S.get(lc + dx, eyeRow + dy) === P.goldM) S.set(lc + dx, eyeRow + dy, null); } // clear the top arc (half-moon)
    S.set(lc - 2, eyeRow + 2, GLASSHI);
  }
  for (let x = L + r - 1; x <= R - r + 1; x++) S.set(x, eyeRow, P.goldM); // bridge
  S.autoOutline(P.outline, false);
  return { S, cx, eyeRow, lensGap: (R - L), id: "reading-glasses", name: "Reading Glasses", tier: "uncommon" };
}

// 3. Sunglasses: bold rounded-square dark lenses + thick frame + sheen. (uncommon)
function sunglasses() {
  const W = 48, H = 20, cx = 24, eyeRow = 10, r = 5, gap = 12;
  const S = new Sprite(W, H);
  const L = cx - gap, R = cx + gap;
  for (const lc of [L, R]) {
    // rounded-square dark lens
    for (let dy = -r + 1; dy <= r - 1; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.abs(dx) === r && Math.abs(dy) >= r - 1) continue; S.set(lc + dx, eyeRow + dy, P.lensDark); }
    ring(S, lc, eyeRow, r, P.navy, 2);
    S.set(lc - 3, eyeRow - 2, P.lensHi); S.set(lc - 2, eyeRow - 3, P.lensHi); S.set(lc - 4, eyeRow - 1, P.lensHi);
  }
  for (let x = L + r - 1; x <= R - r + 1; x++) { S.set(x, eyeRow - 2, P.navy); S.set(x, eyeRow - 3, P.navy); } // thick bridge
  S.autoOutline(P.outline, false);
  return { S, cx, eyeRow, lensGap: (R - L), id: "sunglasses", name: "Sunglasses", tier: "uncommon" };
}

// 4. Heart Glasses: two heart-shaped tinted lenses, rosy frame. (rare)
function heartGlasses() {
  const W = 50, H = 22, cx = 25, eyeRow = 10, gap = 11;
  const S = new Sprite(W, H);
  const L = cx - gap, R = cx + gap;
  const heart = (hx, hy, fill, edge) => {
    // two humps
    for (const [ox] of [[-2], [2]]) fillDisc(S, hx + ox, hy - 2, 2, fill);
    // body triangle
    const body = [[3, hy - 1], [3, hy], [3, hy + 1], [2, hy + 2], [1, hy + 3], [0, hy + 4]];
    for (const [hw, y] of body) for (let x = hx - hw; x <= hx + hw; x++) S.set(x, y, fill);
    S.set(hx - 2, hy - 2, GLASSHI); // sheen
  };
  for (const lc of [L, R]) heart(lc, eyeRow, P.pink, P.pinkD);
  for (let x = L + 3; x <= R - 3; x++) S.set(x, eyeRow - 3, P.berryM); // bridge (no outer temples)
  S.autoOutline(P.berryM, false);
  return { S, cx, eyeRow, lensGap: (R - L), id: "heart-glasses", name: "Heart Glasses", tier: "rare" };
}

// 5. Farm Goggles: round tinted goggles with a wide strap that runs back to the ears.
//    (epic) The strap is drawn by the fitter using the ear anchors.
function farmGoggles() {
  const W = 48, H = 22, cx = 24, eyeRow = 11, r = 6, gap = 11;
  const S = new Sprite(W, H);
  const L = cx - gap, R = cx + gap;
  for (const lc of [L, R]) { fillDisc(S, lc, eyeRow, r - 1, SKYT); ring(S, lc, eyeRow, r, P.woodM, 3); S.set(lc - 3, eyeRow - 3, GLASSHI); S.set(lc - 4, eyeRow - 2, GLASSHI); }
  for (let x = L + r - 2; x <= R - r + 2; x++) { S.set(x, eyeRow - 1, P.woodM); S.set(x, eyeRow, P.woodD); } // bridge band
  // (strap to the ears is drawn by the fitter using the ear anchors)
  S.autoOutline(P.outline, false);
  return { S, cx, eyeRow, lensGap: (R - L), strapToEar: true, id: "farm-goggles", name: "Farm Goggles", tier: "epic" };
}

function renderTight(S) {
  const w = S.w * SCALE, h = S.h * SCALE;
  const buf = Buffer.alloc(w * h * 4, 0);
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
    const c = S.get(x, y);
    if (!c) continue;
    for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) {
      const i = ((y * SCALE + dy) * w + (x * SCALE + dx)) * 4;
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = c[3];
    }
  }
  return { buf, w, h };
}

const glasses = [roundGlasses(), readingGlasses(), sunglasses(), heartGlasses(), farmGoggles()];
const meta = {};
for (const gdef of glasses) {
  const { buf, w, h } = renderTight(gdef.S);
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toFile(path.join(OUT, `${gdef.id}.png`));
  meta[gdef.id] = {
    name: gdef.name, tier: gdef.tier, file: `glasses/${gdef.id}.png`,
    pngW: w, pngH: h, scale: SCALE,
    centerXpx: gdef.cx * SCALE, eyeRowPx: gdef.eyeRow * SCALE, lensGapPx: gdef.lensGap * SCALE,
    strapToEar: !!gdef.strapToEar,
    offsets: {},
  };
  console.log(`${gdef.id.padEnd(16)} ${w}x${h}  center=${gdef.cx * SCALE} eyeRow=${gdef.eyeRow * SCALE} lensGap=${gdef.lensGap * SCALE}`);
}
fs.writeFileSync(path.join(OUT, "_glasses-meta.json"), JSON.stringify(meta, null, 2));
console.log("wrote", Object.keys(meta).length, "glasses + _glasses-meta.json");
