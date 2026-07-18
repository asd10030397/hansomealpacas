// Draw 5 cozy HANSOME "ear accessory" traits — small handcrafted pieces that rest ON
// one ear (the alpaca's left ear from the viewer, anchors[name].ear.left). Each sprite is
// authored in a small grid with a recorded PIN POINT (pinPx): the cell that touches the
// ear. The fitting pass maps that point onto the ear anchor and scales via the ear span.
// Nothing covers the whole ear; no human-style jewelry; countryside/farm vibe only.
//   widthFactor -> sprite drawn width relative to the measured ear span
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { P, Sprite } from "../lib/pixel.mjs";

const OUT = "public/pixel/traits/ears";
fs.mkdirSync(OUT, { recursive: true });
const SCALE = 16;

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

// ---------------- EAR ACCESSORY DEFINITIONS ----------------

// 1. Small Flower — a little daisy blossom tucked on the ear, tiny green leaf at the base.
function smallFlower() {
  const W = 13, H = 14, bx = 6, by = 12; // pin at the stem base (sits on the ear)
  const S = new Sprite(W, H);
  // short stem
  for (let y = 8; y <= 12; y++) S.set(6, y, P.greenM);
  S.set(6, 12, P.greenD);
  // little leaf off the stem
  disc(S, 4, 10, 1, P.leafL, null, P.leafD); S.set(4, 10, P.leafL); S.set(3, 10, P.leafD);
  // blossom: yellow core + 6 pink petals
  const cx = 6, cy = 5;
  for (const [dx, dy] of [[0, -2], [2, -1], [2, 1], [0, 2], [-2, 1], [-2, -1]]) disc(S, cx + dx, cy + dy, 1, P.pink, null, P.pinkD);
  disc(S, cx, cy, 1, P.yolk, P.sunCore, P.strawM);
  S.autoOutline(P.outline, false);
  return { S, bx, by, widthFactor: 0.5, tier: "common", id: "small-flower", name: "Small Flower" };
}

// 2. Leaf Clip — a single pointed leaf clipped onto the ear at a natural upward angle.
function leafClip() {
  const W = 12, H = 14, bx = 4, by = 12; // pin at the clip base
  const S = new Sprite(W, H);
  // tiny wooden clip at the base
  S.set(4, 12, P.woodD); S.set(5, 12, P.woodM); S.set(4, 11, P.woodM);
  // leaf: pointed oval rising diagonally from base (4,11) to tip (8,3)
  const pts = [[4, 11], [5, 10], [5, 9], [6, 8], [6, 7], [7, 6], [7, 5], [8, 4], [8, 3]];
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    const wdt = i < 2 ? 1 : i < 6 ? 2 : 1; // fat in the middle, taper at both ends
    for (let k = -wdt; k <= wdt; k++) {
      let c = P.leafL;
      if (k > 0) c = P.leafD; // shade the lower-right side
      S.set(x + k, y, c);
    }
    S.set(x, y, P.greenD); // central vein
  }
  S.autoOutline(P.outline, false);
  return { S, bx, by, widthFactor: 0.5, tier: "common", id: "leaf-clip", name: "Leaf Clip" };
}

// 3. Tiny Bell — a small rustic brass bell that hangs off the ear tip.
function tinyBell() {
  const W = 10, H = 13, bx = 5, by = 2; // pin at the loop (hangs below the ear anchor)
  const S = new Sprite(W, H);
  // loop
  S.set(5, 1, P.goldD); S.set(4, 2, P.goldM); S.set(6, 2, P.goldM); S.set(5, 2, P.clear);
  // short strap into the bell
  S.set(5, 3, P.woodM);
  // bell body: widening trapezoid
  const rows = [[4, 6, 4], [3, 7, 5], [3, 7, 6], [2, 8, 7], [2, 8, 8]];
  for (const [xl, xr, y] of rows) {
    for (let x = xl; x <= xr; x++) {
      let c = P.goldM;
      if (x <= xl + 1) c = P.goldL;   // left highlight
      if (x >= xr - 1) c = P.goldD;   // right shade
      S.set(x, y, c);
    }
  }
  // rim + mouth
  S.span(9, 2, 8, P.goldD);
  S.set(5, 10, P.goldD); // clapper
  S.autoOutline(P.outline, false);
  return { S, bx, by, widthFactor: 0.34, tier: "rare", id: "tiny-bell", name: "Tiny Bell" };
}

// 4. Feather — a single soft dusty-blue feather tucked behind the ear, pointing up-and-out.
function feather() {
  const W = 10, H = 16, bx = 4, by = 14; // pin at the quill base
  const S = new Sprite(W, H);
  // quill (slight lean to the right/up)
  const quill = [[4, 14], [4, 13], [5, 12], [5, 11], [5, 10], [5, 9], [6, 8], [6, 7], [6, 6], [6, 5], [6, 4], [6, 3]];
  // vane width per step (teardrop: narrow base, wide mid, fine tip)
  const vane = [0, 1, 1, 2, 2, 2, 2, 2, 1, 1, 1, 0];
  for (let i = 0; i < quill.length; i++) {
    const [x, y] = quill[i];
    const wdt = vane[i];
    for (let k = 1; k <= wdt; k++) { S.set(x - k, y, k === wdt ? P.denimD : P.denimL); S.set(x + k, y, k === wdt ? P.denimD : P.denimM); }
    S.set(x, y, P.woodM); // spine
  }
  // warm tip
  S.set(6, 3, P.strawL); S.set(6, 4, P.strawM);
  S.autoOutline(P.outline, false);
  return { S, bx, by, widthFactor: 0.48, tier: "rare", id: "feather", name: "Feather" };
}

// 5. Golden Ear Tag — a small farm-style tag clipped through the ear (HANSOME's countryside nod).
function goldenEarTag() {
  const W = 11, H = 12, bx = 5, by = 3; // pin at the clip stud (pierces the ear)
  const S = new Sprite(W, H);
  // clip stud through the ear
  S.set(5, 2, P.goldL); S.set(5, 3, P.woodD);
  // tag plate (rounded gold square)
  const x0 = 2, x1 = 8, y0 = 4, y1 = 9;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let c = P.goldM;
    if (x <= x0 + 1 || y <= y0) c = P.goldL;
    if (x >= x1 - 1 || y >= y1) c = P.goldD;
    S.set(x, y, c);
  }
  // round the corners
  S.set(x0, y0, P.clear); S.set(x1, y0, P.clear); S.set(x0, y1, P.clear); S.set(x1, y1, P.clear);
  // engraved emboss dot (kept abstract, no text)
  S.set(5, 6, P.goldD); S.set(5, 7, P.goldD); S.set(4, 7, P.goldD); S.set(6, 6, P.goldL);
  S.autoOutline(P.outline, false);
  return { S, bx, by, widthFactor: 0.38, tier: "epic", id: "golden-ear-tag", name: "Golden Ear Tag" };
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

const items = [smallFlower(), leafClip(), tinyBell(), feather(), goldenEarTag()];
const meta = {};
for (const it of items) {
  const { buf, w, h } = renderTight(it.S);
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toFile(path.join(OUT, `${it.id}.png`));
  meta[it.id] = {
    name: it.name, tier: it.tier, file: `ears/${it.id}.png`,
    pngW: w, pngH: h, scale: SCALE,
    pinPx: { x: it.bx * SCALE, y: it.by * SCALE },
    widthFactor: it.widthFactor,
    ear: "left", // rests on the viewer-left ear
    offsets: {}, // per-archetype {dx,dy} overrides — empty = fully anchor-driven
  };
  console.log(`${it.id.padEnd(16)} ${w}x${h}  pin=${it.bx * SCALE},${it.by * SCALE} wf=${it.widthFactor}`);
}
fs.writeFileSync(path.join(OUT, "_ears-meta.json"), JSON.stringify(meta, null, 2));
console.log("wrote", Object.keys(meta).length, "ear accessory traits + _ears-meta.json");
