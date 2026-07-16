// Draw 5 cozy HANSOME hats as tight, symmetric transparent sprites.
// Each hat is authored in its own small grid and exported as a tight PNG plus
// placement metadata (sitRow = grid row that rests on the head-top, centerCol =
// horizontal center, widthFactor = hat width relative to a head, sink = how far
// to nestle into the wool). The fitting pass uses this to place a hat on every
// archetype via its crown anchor.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { P, Sprite } from "../lib/pixel.mjs";

const OUT = "public/pixel/traits/hats";
fs.mkdirSync(OUT, { recursive: true });
const SCALE = 16; // px per grid cell

// palette extras
const CREAMHI = [255, 250, 240, 255];
const STRAWHI = [242, 214, 140, 255];

function sym(S, y, cx, hw, color) {
  for (let x = cx - hw; x <= cx + hw; x++) S.set(x, y, color);
}

// ---------------- HAT DEFINITIONS ----------------
// straw sun hat: wide flat brim + rounded dome + ribbon band
function strawHat() {
  const W = 52, H = 30, cx = 26;
  const S = new Sprite(W, H);
  // dome
  const dome = [[6, 3], [7, 4], [8, 5], [9, 6], [10, 8], [10, 10], [11, 12], [11, 14], [11, 16]];
  for (const [hw, y] of dome) sym(S, y, cx, hw, P.strawM);
  // dome shading (left light, right darker)
  for (let y = 4; y <= 16; y++) {
    for (let x = cx - 11; x <= cx + 11; x++) {
      if (S.get(x, y)) {
        if (x < cx - 3) S.set(x, y, STRAWHI);
        else if (x > cx + 4) S.set(x, y, P.strawD);
      }
    }
  }
  // ribbon band
  sym(S, 15, cx, 11, P.redM);
  sym(S, 16, cx, 11, P.redD);
  // brim (wide ellipse)
  sym(S, 17, cx, 15, P.strawM);
  sym(S, 18, cx, 22, P.strawM);
  sym(S, 19, cx, 25, P.strawL);
  sym(S, 20, cx, 25, P.strawM);
  sym(S, 21, cx, 22, P.strawD);
  // brim front dip shading
  for (let x = cx - 25; x <= cx + 25; x++) if (S.get(x, 20)) S.set(x, 21 - 0, S.get(x, 21) || P.strawD);
  S.autoOutline(P.outline, true);
  return { S, cx, sitRow: 17, widthFactor: 1.7, sink: 0.02, id: "straw-hat", name: "Straw Sun Hat", tier: "common" };
}

// cozy wool beanie with fold cuff + small pom
function woolBeanie() {
  const W = 40, H = 28, cx = 20;
  const S = new Sprite(W, H);
  // pom
  S.rect(cx - 2, 0, cx + 2, 3, P.woolL);
  S.set(cx - 3, 1, P.woolL); S.set(cx + 3, 1, P.woolL); S.set(cx - 3, 2, P.woolL); S.set(cx + 3, 2, P.woolL);
  // dome
  const dome = [[4, 4], [6, 5], [8, 6], [9, 7], [10, 8], [11, 9], [12, 11], [12, 13], [13, 15]];
  for (const [hw, y] of dome) sym(S, y, cx, hw, P.berryM);
  // knit shading columns
  for (let y = 5; y <= 15; y++) for (let x = cx - 13; x <= cx + 13; x++) {
    if (S.get(x, y) === P.berryM && ((x - cx) % 3 === 0)) S.set(x, y, P.berryD);
  }
  // fold cuff
  sym(S, 16, cx, 14, P.berryL);
  sym(S, 17, cx, 14, P.berryL);
  sym(S, 18, cx, 14, P.berryM);
  for (let x = cx - 14; x <= cx + 14; x += 3) { S.set(x, 16, P.berryD); S.set(x, 17, P.berryD); }
  S.autoOutline(P.outline, true);
  return { S, cx, sitRow: 16, widthFactor: 1.16, sink: 0.055, id: "wool-beanie", name: "Wool Beanie", tier: "common" };
}

// flower crown: curved circlet that wraps the head dome (arched band, layered
// depth, varied clustered flowers + leaves) rather than a flat headband
function flowerCrown() {
  const W = 56, H = 24, cx = 28, half = 26;
  const S = new Sprite(W, H);
  // arch: band is highest at the centre and curves down toward the ears (wraps the dome)
  const bandY = (x) => { const t = (x - cx) / half; return 11 + Math.round(t * t * 8); };
  // back band (darker, sits a touch higher to imply the crown continuing behind the head)
  for (let x = 5; x <= W - 6; x++) { const y = bandY(x) - 1; S.set(x, y, P.greenD); }
  // main vine band, 2 rows thick with a highlight ridge for depth
  for (let x = 4; x <= W - 5; x++) {
    const y = bandY(x);
    S.set(x, y - 1, P.leafL);
    S.set(x, y, P.greenM);
    S.set(x, y + 1, P.greenD);
  }
  // small leaves poking up along the band
  for (const lx of [11, 22, 34, 45]) { const y = bandY(lx); S.set(lx, y - 2, P.leafD); S.set(lx - 1, y - 2, P.leafL); S.set(lx + 1, y - 1, P.leafD); }
  // flowers: bigger toward the centre-front, smaller toward the sides -> depth
  const flower = (fx, size, pet, petD) => {
    const fy = bandY(fx) - 2;
    S.set(fx, fy, P.yolk);
    S.set(fx, fy - 1, pet); S.set(fx, fy + 1, pet); S.set(fx - 1, fy, pet); S.set(fx + 1, fy, pet);
    S.set(fx - 1, fy - 1, petD); S.set(fx + 1, fy + 1, petD);
    if (size === 2) {
      S.set(fx + 1, fy - 1, pet); S.set(fx - 1, fy + 1, petD);
      S.set(fx, fy - 2, petD); S.set(fx, fy + 2, petD); S.set(fx - 2, fy, petD); S.set(fx + 2, fy, petD);
      S.set(fx, fy, P.goldL);
    }
  };
  flower(10, 1, P.pink, P.pinkD);
  flower(18, 1, P.goldL, P.goldM);
  flower(24, 2, P.berryL, P.berryM);
  flower(28, 2, P.purpL, P.purpM);
  flower(32, 2, P.pink, P.pinkD);
  flower(38, 1, P.goldL, P.goldM);
  flower(46, 1, P.berryL, P.berryM);
  S.autoOutline(P.outline, false);
  return { S, cx, sitRow: 12, widthFactor: 1.32, sink: 0.045, id: "flower-crown", name: "Flower Crown", tier: "rare" };
}

// winter bobble hat: big pom, ribbed knit dome, cuff
function bobbleHat() {
  const W = 40, H = 30, cx = 20;
  const S = new Sprite(W, H);
  // big pom — cool blue-white with shading + a dark knot so it reads clearly
  // against the warm cream wool (was near-invisible when cream-on-cream)
  const pomRows = [[1, 0], [3, 1], [4, 2], [4, 3], [3, 4], [1, 5]];
  for (const [hw, y] of pomRows) sym(S, y, cx, hw, P.white);
  for (let y = 0; y <= 5; y++) for (let x = cx - 4; x <= cx + 4; x++) if (S.get(x, y) === P.white && x > cx + 1) S.set(x, y, P.denimL);
  S.set(cx - 2, 1, CREAMHI); S.set(cx - 1, 2, CREAMHI); // top-left highlight
  S.set(cx + 1, 3, P.denimD); S.set(cx - 1, 4, P.denimD); // texture specks
  S.set(cx, 5, P.denimD); // knot into the hat
  // dome
  const dome = [[4, 5], [6, 6], [8, 7], [9, 8], [10, 9], [11, 10], [11, 12], [12, 14], [12, 16]];
  for (const [hw, y] of dome) sym(S, y, cx, hw, P.denimM);
  for (let y = 6; y <= 16; y++) for (let x = cx - 12; x <= cx + 12; x++) {
    if (S.get(x, y) === P.denimM && ((x - cx) % 2 === 0)) S.set(x, y, P.denimD);
  }
  // thick cuff
  sym(S, 17, cx, 13, P.denimL);
  sym(S, 18, cx, 13, P.white);
  sym(S, 19, cx, 13, P.denimL);
  sym(S, 20, cx, 13, P.denimM);
  S.autoOutline(P.outline, true);
  return { S, cx, sitRow: 17, widthFactor: 1.14, sink: 0.05, id: "bobble-hat", name: "Bobble Hat", tier: "uncommon" };
}

// soft cloth farmer cap with short front peak
function clothCap() {
  const W = 46, H = 24, cx = 23;
  const S = new Sprite(W, H);
  // rounded soft panel
  const dome = [[6, 4], [8, 5], [10, 6], [11, 7], [12, 8], [13, 10], [13, 12], [14, 13]];
  for (const [hw, y] of dome) sym(S, y, cx, hw, P.woodL);
  for (let y = 5; y <= 13; y++) for (let x = cx - 14; x <= cx + 14; x++) {
    if (S.get(x, y)) { if (x > cx + 5) S.set(x, y, P.woodM); else if (x < cx - 7) S.set(x, y, [190, 140, 82, 255]); }
  }
  // seam
  for (let y = 5; y <= 12; y++) S.set(cx, y, P.woodD);
  // short peak/brim at front-bottom center
  sym(S, 14, cx, 12, P.woodM);
  sym(S, 15, cx, 10, P.woodD);
  sym(S, 16, cx, 7, P.woodD);
  S.autoOutline(P.outline, true);
  return { S, cx, sitRow: 14, widthFactor: 1.18, sink: 0.045, id: "cloth-cap", name: "Cloth Cap", tier: "uncommon" };
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

const hats = [strawHat(), woolBeanie(), flowerCrown(), bobbleHat(), clothCap()];
const meta = {};
for (const hat of hats) {
  const { buf, w, h } = renderTight(hat.S);
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toFile(path.join(OUT, `${hat.id}.png`));
  meta[hat.id] = {
    name: hat.name, tier: hat.tier, file: `hats/${hat.id}.png`,
    pngW: w, pngH: h, scale: SCALE,
    centerXpx: hat.cx * SCALE, sitYpx: hat.sitRow * SCALE,
    widthFactor: hat.widthFactor, sink: hat.sink,
    offsets: {}, // per-archetype {dx,dy} overrides — empty = fully anchor-driven (none needed)
  };
  console.log(`${hat.id.padEnd(12)} ${w}x${h}  center=${hat.cx * SCALE} sit=${hat.sitRow * SCALE} wf=${hat.widthFactor}`);
}
fs.writeFileSync(path.join(OUT, "_hats-meta.json"), JSON.stringify(meta, null, 2));
console.log("wrote", Object.keys(meta).length, "hats + _hats-meta.json");
