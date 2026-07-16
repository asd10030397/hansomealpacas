// Draw 5 cozy HANSOME necklaces as tight, symmetric transparent sprites.
// Each necklace is authored in a small grid as a front-facing U that drapes around
// the neck/upper chest, with an optional charm hanging at centre. Exported as a
// tight PNG + placement metadata:
//   centerCol   -> horizontal centre of the sprite
//   neckRow     -> grid row where the cord meets the neck sides (aligns to the neck anchor)
//   widthFactor -> necklace span relative to the measured neck width
//   sink        -> small downward nudge (fraction of base height) so it rests on wool
// The fitting pass places a necklace on every archetype via its neck + chest anchors.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { P, Sprite } from "../lib/pixel.mjs";

const OUT = "public/pixel/traits/necklaces";
fs.mkdirSync(OUT, { recursive: true });
const SCALE = 16; // px per grid cell (matches base + hats)

// A front-facing U: dips lowest at the centre, rises toward the neck sides.
// Returns the centre-bottom row so charms can hang from it.
function ucord(S, cx, half, topY, depth, top, mid, thick = 2) {
  for (let x = cx - half; x <= cx + half; x++) {
    const t = (x - cx) / half;
    const y = topY + Math.round((1 - t * t) * depth);
    for (let k = 0; k < thick; k++) S.set(x, y + k, k === 0 ? top : mid);
  }
  return topY + depth; // centre-bottom row of the cord
}

// Bead/charm-friendly path sampler: returns [x,y] points along the same U.
function upath(cx, half, topY, depth) {
  const pts = [];
  for (let x = cx - half; x <= cx + half; x++) {
    const t = (x - cx) / half;
    pts.push([x, topY + Math.round((1 - t * t) * depth)]);
  }
  return pts;
}

// Filled circle with soft shading: fill body, top-left highlight, bottom-right shade.
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

// ---------------- NECKLACE DEFINITIONS ----------------
// Designed as BOLD character traits: larger silhouettes, strong shapes, readable at
// NFT size. Cozy handcrafted village feel — not realistic/luxury jewelry.
const TAN = [190, 140, 82, 255];
const WOODHI = [214, 176, 122, 255];

// 1. HANSOME Pendant: bold golden cord + a large signature medallion with a carved "H".
//    (Kept in the same iconic direction, scaled up for presence.)
function hansomePendant() {
  const W = 50, H = 34, cx = 25, half = 21, topY = 3, depth = 8;
  const S = new Sprite(W, H);
  const cb = ucord(S, cx, half, topY, depth, P.goldM, P.goldD, 3);
  for (let x = cx - half; x <= cx + half; x++) { const t = (x - cx) / half; S.set(x, topY + Math.round((1 - t * t) * depth), P.goldL); } // top glint
  S.set(cx, cb + 1, P.goldD); S.set(cx - 1, cb + 1, P.goldD); S.set(cx + 1, cb + 1, P.goldD); // bail
  // large medallion
  const cy = cb + 7, r = 6;
  disc(S, cx, cy, r, P.goldM, P.goldL, P.goldD);
  // carved "H" (engraved = darker)
  for (let y = cy - 3; y <= cy + 3; y++) { S.set(cx - 2, y, P.goldD); S.set(cx + 2, y, P.goldD); }
  S.set(cx - 1, cy, P.goldD); S.set(cx, cy, P.goldD); S.set(cx + 1, cy, P.goldD);
  S.autoOutline(P.outline, false);
  return { S, cx, neckRow: topY, widthFactor: 0.86, sink: 0.01, id: "hansome-pendant", name: "HANSOME Pendant", tier: "rare" };
}

// 2. Bell Collar: soft farm ribbon band with a small bow + a LARGE rustic brass bell.
function bellCollar() {
  const W = 52, H = 36, cx = 26, half = 22, topY = 3, depth = 7;
  const S = new Sprite(W, H);
  const cb = ucord(S, cx, half, topY, depth, P.redM, P.redD, 4); // soft wide ribbon
  for (let x = cx - half; x <= cx + half; x++) { const t = (x - cx) / half; S.set(x, topY + Math.round((1 - t * t) * depth), P.redL); } // ribbon sheen
  // little side bow (folds) on the left of the band for a handcrafted feel
  const bx = cx - 12, byo = topY + Math.round((1 - ((bx - cx) / half) ** 2) * depth);
  S.rect(bx - 2, byo - 1, bx - 1, byo + 2, P.redL); S.rect(bx + 1, byo - 1, bx + 2, byo + 2, P.redM);
  S.set(bx, byo, P.redD); S.set(bx, byo + 1, P.redD);
  // LARGE rustic bell hanging centre
  const by = cb + 1;
  S.rect(cx - 1, by, cx + 1, by + 1, P.goldD); // loop
  // flared bell body
  const rows = [[2, by + 2], [3, by + 3], [4, by + 4], [5, by + 5], [6, by + 6], [6, by + 7]];
  for (const [hw, y] of rows) for (let x = cx - hw; x <= cx + hw; x++) S.set(x, y, P.goldM);
  for (let x = cx - 6; x <= cx + 6; x++) { if (S.get(x, by + 7)) S.set(x, by + 7, P.goldD); }       // rim shade
  for (let y = by + 2; y <= by + 6; y++) S.set(cx - 3, y, P.goldL);                                   // left shine
  for (let y = by + 3; y <= by + 7; y++) { S.set(cx, y, P.goldD); }                                   // centre slit
  disc(S, cx, by + 9, 1, P.goldD, null, null);                                                        // clapper
  S.autoOutline(P.outline, false);
  return { S, cx, neckRow: topY, widthFactor: 0.9, sink: 0.005, id: "bell-collar", name: "Bell Collar", tier: "uncommon" };
}

// 3. Clover Pendant: green vine cord + a BIG, unmistakable four-leaf clover.
function cloverPendant() {
  const W = 50, H = 36, cx = 25, half = 21, topY = 3, depth = 7;
  const S = new Sprite(W, H);
  const cb = ucord(S, cx, half, topY, depth, P.greenM, P.greenD, 3);
  S.set(cx, cb + 1, P.greenD); S.set(cx, cb + 2, P.greenD); // stem
  // four round leaves (big heart-lobes) around the centre
  const cy = cb + 8, o = 5, lr = 4;
  disc(S, cx - o, cy - o, lr, P.leafL, [176, 214, 132, 255], P.leafD); // NW
  disc(S, cx + o, cy - o, lr, P.leafL, [176, 214, 132, 255], P.leafD); // NE
  disc(S, cx - o, cy + o, lr, P.leafL, [176, 214, 132, 255], P.leafD); // SW
  disc(S, cx + o, cy + o, lr, P.leafL, [176, 214, 132, 255], P.leafD); // SE
  // notch each leaf toward centre + central veins for a clear clover read
  disc(S, cx, cy, 2, P.greenD, null, null);
  for (const [sx, sy] of [[-o, -o], [o, -o], [-o, o], [o, o]]) {
    S.set(cx + sx - Math.sign(sx), cy + sy - Math.sign(sy), P.greenM);
    S.set(cx + Math.sign(sx), cy + Math.sign(sy), P.greenD); // vein
  }
  S.autoOutline(P.outline, false);
  return { S, cx, neckRow: topY, widthFactor: 0.9, sink: 0.01, id: "clover-pendant", name: "Clover Pendant", tier: "rare" };
}

// 4. Wooden Necklace: chunky hand-carved wooden beads + a large carved wooden HANSOME
//    tag at centre. Bold, rustic — the strongest common accessory.
function woodenBeads() {
  const W = 54, H = 34, cx = 27, half = 23, topY = 4, depth = 6;
  const S = new Sprite(W, H);
  const pts = upath(cx, half, topY, depth);
  for (const [x, y] of pts) S.set(x, y + 1, P.woodD); // cord
  // chunky round beads, alternating tones, big and clearly separated
  const tones = [P.woodL, TAN, P.woodM];
  const beadIdx = [1, 8, 16, 30, 38, 45].filter((i) => i < pts.length);
  let bi = 0;
  for (const i of beadIdx) {
    const [x, y] = pts[i];
    if (Math.abs(x - cx) < 6) continue; // leave room for the centre tag
    disc(S, x, y, 2, tones[bi % tones.length], WOODHI, P.woodD); bi++;
  }
  // large carved wooden tag hanging centre (rounded plank with a carved notch)
  const cb = topY + depth, ty = cb + 6;
  S.set(cx, cb + 1, P.woodD); // knot
  S.rect(cx - 4, ty - 3, cx + 4, ty + 4, P.woodM);
  for (let y = ty - 3; y <= ty + 4; y++) { S.set(cx - 4, y, P.woodD); S.set(cx + 4, y, P.woodD); } // sides
  for (let x = cx - 4; x <= cx + 4; x++) { S.set(x, ty - 3, WOODHI); S.set(x, ty + 4, P.woodD); }   // top glint / base shade
  // carved "H" on the tag
  for (let y = ty - 1; y <= ty + 2; y++) { S.set(cx - 2, y, P.woodD); S.set(cx + 2, y, P.woodD); }
  S.set(cx - 1, ty, P.woodD); S.set(cx, ty, P.woodD); S.set(cx + 1, ty, P.woodD);
  S.autoOutline(P.outline, false);
  return { S, cx, neckRow: topY, widthFactor: 0.92, sink: 0.005, id: "wooden-beads", name: "Wooden Necklace", tier: "common" };
}

// 5. Berry String: a natural curving vine with BIG leaves + plump berry clusters.
function berryString() {
  const W = 56, H = 30, cx = 28, half = 24, topY = 4, depth = 7;
  const S = new Sprite(W, H);
  const pts = upath(cx, half, topY, depth);
  // thick natural vine (2 rows) with a little wobble
  for (const [x, y] of pts) { const w = Math.round(Math.sin((x) * 0.6)); S.set(x, y + w, P.greenM); S.set(x, y + 1 + w, P.greenD); }
  // big pointed leaves alternating up/down along the vine
  const leaf = (x, y, dir) => {
    S.set(x, y, P.leafL); S.set(x + 1, y, P.leafL);
    S.set(x - 1, y - dir, P.leafL); S.set(x, y - dir, P.leafL); S.set(x + 1, y - dir, P.leafL); S.set(x + 2, y - dir, P.leafD);
    S.set(x, y - 2 * dir, P.leafL); S.set(x + 1, y - 2 * dir, P.leafD);
    S.set(x, y - dir, P.greenD); // midrib hint
  };
  for (let i = 4; i < pts.length - 2; i += 9) { const [x, y] = pts[i]; leaf(x, y, 1); }
  for (let i = 8; i < pts.length - 2; i += 9) { const [x, y] = pts[i]; leaf(x, y, -1); }
  // plump berry clusters hanging at intervals
  const cols = [-16, -8, 0, 8, 16];
  for (const off of cols) {
    const x = cx + off;
    const t = off / half; const vy = topY + Math.round((1 - t * t) * depth) + Math.round(Math.sin(x * 0.6));
    const red = Math.abs(off) <= 4;
    const fill = red ? P.redM : P.berryM, hi = red ? P.redL : P.berryL, sh = red ? P.redD : P.berryD;
    S.set(x, vy + 2, P.greenD); // stem
    disc(S, x, vy + 4, 2, fill, hi, sh); // big berry
    S.set(x - 2, vy + 3, hi); // tiny sheen
  }
  S.autoOutline(P.outline, false);
  return { S, cx, neckRow: topY, widthFactor: 0.94, sink: 0.005, id: "berry-string", name: "Berry String", tier: "uncommon" };
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

const necklaces = [hansomePendant(), bellCollar(), cloverPendant(), woodenBeads(), berryString()];
const meta = {};
for (const n of necklaces) {
  const { buf, w, h } = renderTight(n.S);
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toFile(path.join(OUT, `${n.id}.png`));
  meta[n.id] = {
    name: n.name, tier: n.tier, file: `necklaces/${n.id}.png`,
    pngW: w, pngH: h, scale: SCALE,
    centerXpx: n.cx * SCALE, neckYpx: n.neckRow * SCALE,
    widthFactor: n.widthFactor, sink: n.sink,
    offsets: {}, // per-archetype {dx,dy} overrides — empty = fully anchor-driven
  };
  console.log(`${n.id.padEnd(16)} ${w}x${h}  center=${n.cx * SCALE} neckRow=${n.neckRow * SCALE} wf=${n.widthFactor}`);
}
fs.writeFileSync(path.join(OUT, "_necklaces-meta.json"), JSON.stringify(meta, null, 2));
console.log("wrote", Object.keys(meta).length, "necklaces + _necklaces-meta.json");
