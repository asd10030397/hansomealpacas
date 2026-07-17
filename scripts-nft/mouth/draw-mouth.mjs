// Draw 5 cozy HANSOME "mouth" traits — little nature sprigs the alpaca is nibbling.
// The Genesis bases have a clean closed smile (no grass drawn in), so every mouth
// trait is a real overlay held at the mouth, poking up-and-out to the alpaca's side.
// Each sprite is authored in a small grid with a recorded BITE POINT (bitePx): the
// cell where the lips grip the stem. The fitting pass maps that point onto each
// archetype's mouth (derived from the eye line) and scales via the eye span.
//   widthFactor -> sprite drawn width relative to the measured eye span
// Cozy countryside nature only — no human/pop-culture props.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { P, Sprite } from "../lib/pixel.mjs";

const OUT = "public/pixel/traits/mouth";
fs.mkdirSync(OUT, { recursive: true });
const SCALE = 16; // px per grid cell (matches base + other traits)

// Bite angle: sprigs are authored UPRIGHT (stem down at the bite point, foliage up).
// A clockwise rotation about the bite point swings the foliage to the alpaca's RIGHT,
// so it reads as nibbling/holding the plant from the side instead of straight in front.
// The fitter rotates about the bite point (see fit-mouth.mjs), so the stem still enters
// exactly at the mouth anchor. ~85 deg = mostly horizontal with a slight natural upward lift.
const BITE_ROT = 85;

const GRASSHI = [176, 214, 132, 255];

// soft filled disc with top-left highlight / bottom-right shade
function disc(S, cx, cy, r, fill, hi, shade) {
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    for (let dx = -w; dx <= w; dx++) {
      let c = fill;
      if (shade && (dx > r * 0.35 || dy > r * 0.4)) c = shade;
      if (hi && dx < -r * 0.3 && dy < -r * 0.2) c = hi;
      S.set(cx + dx, cy + dy, c);
    }
  }
}

// A tapering blade/stem from (x0,y0) -> (x1,y1). Thick (2px) near the base, 1px at
// the tip; darker at the very base where it meets the lips, highlight up one side.
function blade(S, x0, y0, x1, y1, cMid, cHi, cDark) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    const base = t < 0.18;
    const thick = t < 0.55;
    S.set(x, y, base ? (cDark || cMid) : cMid);
    if (thick) S.set(x + (x1 >= x0 ? 1 : -1), y, base ? (cDark || cMid) : cHi);
  }
}

// ---------------- MOUTH TRAIT DEFINITIONS ----------------
// Authored so the BITE POINT sits low-centre; foliage fans up and to the alpaca's
// left (viewer's left) for a natural "just plucked a bite" look.

// 1. Fresh Grass (canonical default) — a small compact tuft of green blades that
//    sits at the mouth (kept short so it never reaches the eyes).
function freshGrass() {
  const W = 18, H = 13, bx = 8, by = 11;
  const S = new Sprite(W, H);
  blade(S, bx, by, 3, 5, P.greenM, GRASSHI, P.greenD);
  blade(S, bx, by, 5, 2, P.greenM, GRASSHI, P.greenD);
  blade(S, bx, by, 8, 1, P.greenL, GRASSHI, P.greenD);
  blade(S, bx, by, 11, 2, P.greenM, GRASSHI, P.greenD);
  blade(S, bx, by, 14, 5, P.greenM, GRASSHI, P.greenD);
  S.set(8, 1, P.greenL); S.set(5, 2, P.greenL);
  S.autoOutline(P.outline, false);
  return { S, bx, by, widthFactor: 0.62, tier: "common", id: "fresh-grass", name: "Fresh Grass" };
}

// 2. Wheat Stalk — authored HORIZONTALLY (rotationDeg 0) so it stays pixel-perfect and
//    complete: a short stem at the bite (mouth) end on the left, then a full teardrop
//    wheat head with awns extending to the right. Fully padded so nothing clips.
function wheatStalk() {
  const W = 22, H = 13, bx = 1, by = 6;
  const S = new Sprite(W, H);
  // Subtle upward slope (~6deg) baked into the sprite: the midline steps up as x grows,
  // so the stalk tilts up-right to match the other traits — no raster rotation needed.
  const midAt = (x) => (x <= 6 ? 6 : x <= 11 ? 5 : 4);
  // stem: enters the mouth on the left (bite stays at 1,6), connects into the head
  for (let x = bx; x <= 7; x++) { const m = midAt(x); S.set(x, m, P.strawM); S.set(x, m + 1, P.woodM); }
  // wheat head: teardrop of grains, widest in the middle, tapering to the tip on the right
  const halves = { 7: 1, 8: 2, 9: 2, 10: 3, 11: 3, 12: 3, 13: 2, 14: 2, 15: 1, 16: 1 };
  for (const [xs, half] of Object.entries(halves)) {
    const x = +xs, m = midAt(x);
    for (let y = m - half; y <= m + half; y++) {
      let c = P.strawM;
      if (y < m) c = P.strawL;   // upper highlight
      if (y > m) c = P.strawD;   // lower shade
      S.set(x, y, c);
    }
  }
  // grain separators (V-notch texture)
  for (const x of [9, 11, 13, 15]) { const m = midAt(x); S.set(x, m - 1, P.strawD); S.set(x, m + 1, P.strawD); }
  // tip + splayed awns on the right
  const mt = 4;
  S.set(17, mt, P.strawL);
  S.set(18, mt - 1, P.strawM); S.set(18, mt, P.strawL); S.set(18, mt + 1, P.strawD);
  S.set(19, mt - 2, P.strawM); S.set(19, mt + 2, P.strawM);
  S.set(20, mt - 2, P.strawL); S.set(20, mt + 2, P.strawD);
  S.autoOutline(P.outline, false);
  return { S, bx, by, widthFactor: 0.62, rotationDeg: 0, tier: "common", id: "wheat", name: "Wheat Stalk" };
}

// 3. Wildflower — a white daisy with a yellow heart on a SHORT leafy stem so it reads
//    as a small bloom being nibbled (not a long-stemmed flower attached to the face).
function wildflower() {
  const W = 16, H = 13, bx = 8, by = 11;
  const S = new Sprite(W, H);
  blade(S, bx, by, 8, 6, P.greenM, GRASSHI, P.greenD); // short stem (bite sits near the flower base)
  S.set(6, 8, P.leafL); S.set(5, 8, P.leafL); S.set(6, 7, P.leafD); S.set(5, 9, P.leafD); // little leaf
  // daisy head just above the stem
  const cx = 8, cy = 4;
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]])
    disc(S, cx + dx, cy + dy, 1, P.white, P.white, P.woolM);
  disc(S, cx, cy, 1, P.yolk, P.sunCore, P.goldM); // heart
  S.autoOutline(P.outline, false);
  return { S, bx, by, widthFactor: 0.5, tier: "uncommon", id: "white-flower", name: "Wildflower" };
}

// 4. Lavender Sprig — a compact purple flower spike on a SHORT stem: a small sprig
//    being nibbled rather than a tall stalk.
function lavenderSprig() {
  const W = 14, H = 13, bx = 7, by = 11;
  const S = new Sprite(W, H);
  blade(S, bx, by, 7, 7, P.greenM, GRASSHI, P.greenD); // short stem
  S.set(5, 9, P.leafL); S.set(4, 9, P.leafD); // little leaf
  // compact spike of paired buds tapering up
  const cx = 7;
  const halves = [2, 2, 2, 1, 1, 0];
  let y = 7;
  for (const half of halves) {
    for (let x = cx - half; x <= cx + half; x++) {
      const edge = x === cx - half || x === cx + half;
      S.set(x, y, edge ? P.purpD : P.purpM);
    }
    if (half >= 1) S.set(cx - 1, y, P.purpL);
    y -= 1;
  }
  S.set(cx, y, P.lavender); // top bud
  S.autoOutline(P.outline, false);
  return { S, bx, by, widthFactor: 0.44, tier: "rare", id: "lavender", name: "Lavender Sprig" };
}

// 5. Four-leaf Clover — a lucky clover on a SHORT stem so the head rests on the muzzle
//    (kept compact so the leaves never reach the eyes on shorter faces).
function fourLeafClover() {
  const W = 16, H = 13, bx = 7, by = 11;
  const S = new Sprite(W, H);
  blade(S, bx, by, 7, 8, P.greenM, GRASSHI, P.greenD); // short stem
  const cx = 7, cy = 5, o = 2, lr = 2;
  for (const [sx, sy] of [[-o, -o], [o, -o], [-o, o], [o, o]])
    disc(S, cx + sx, cy + sy, lr, P.leafL, GRASSHI, P.leafD);
  disc(S, cx, cy, 1, P.greenD, null, null); // centre
  for (const [sx, sy] of [[-o, -o], [o, -o], [-o, o], [o, o]]) S.set(cx + Math.sign(sx), cy + Math.sign(sy), P.greenD); // veins
  S.autoOutline(P.outline, false);
  return { S, bx, by, widthFactor: 0.52, tier: "epic", id: "four-leaf-clover", name: "Four-leaf Clover" };
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

const items = [freshGrass(), wheatStalk(), wildflower(), lavenderSprig(), fourLeafClover()];
const meta = {};
for (const it of items) {
  const { buf, w, h } = renderTight(it.S);
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toFile(path.join(OUT, `${it.id}.png`));
  meta[it.id] = {
    name: it.name, tier: it.tier, file: `mouth/${it.id}.png`,
    pngW: w, pngH: h, scale: SCALE,
    bitePx: { x: it.bx * SCALE, y: it.by * SCALE },
    widthFactor: it.widthFactor,
    // Sprigs are authored UPRIGHT and rotated clockwise about the bite point at fit time
    // so the plant is held from the SIDE (foliage extends to the alpaca's right).
    rotationDeg: it.rotationDeg ?? BITE_ROT,
    offsets: {}, // per-archetype {dx,dy} overrides — empty = fully anchor-driven
  };
  console.log(`${it.id.padEnd(18)} ${w}x${h}  bite=${it.bx * SCALE},${it.by * SCALE} wf=${it.widthFactor}`);
}
fs.writeFileSync(path.join(OUT, "_mouth-meta.json"), JSON.stringify(meta, null, 2));
console.log("wrote", Object.keys(meta).length, "mouth traits + _mouth-meta.json");
