import sharp from "sharp";
import { W, H, CELL, P, createCanvas, g, dot, fillPx, Sprite, save } from "./lib/pixel.mjs";

const BASE = "public/pixel/alpaca-nft-master-base.png";
const OUT = "public/pixel/traits";

// ---------- HATS (blit so brim rests on the wool crown ~gy6-7) ----------

function drawStrawHat(buf) {
  const s = new Sprite(30, 9);
  // crown dome
  s.span(1, 11, 18, P.strawL);
  s.span(2, 9, 20, P.strawM);
  s.span(3, 8, 21, P.strawM);
  s.span(4, 8, 21, P.strawD); // ribbon band
  s.span(5, 7, 22, P.strawM);
  // brim
  s.span(6, 1, 28, P.strawL);
  s.span(7, 1, 28, P.strawD);
  // left highlight
  s.set(2, 5, P.strawL); s.set(9, 2, P.strawL); s.set(10, 3, P.strawL);
  s.autoOutline(P.outline);
  s.blit(buf, 15, 0);
}

function drawFarmerCap(buf) {
  const s = new Sprite(28, 9);
  // crown
  s.span(2, 9, 21, P.greenM);
  s.span(3, 8, 22, P.greenM);
  s.span(4, 8, 22, P.greenL);
  s.span(5, 8, 22, P.greenM);
  s.span(6, 8, 22, P.greenD);
  // bill pointing forward (left, toward muzzle)
  s.span(6, 2, 8, P.greenD);
  s.span(7, 2, 9, P.greenD);
  // button on top
  s.set(14, 1, P.greenL);
  s.autoOutline(P.outline);
  s.blit(buf, 16, 0);
}

function drawWoolBeanie(buf) {
  const s = new Sprite(24, 9);
  // snug body (extends right to cover ear side)
  for (let y = 3; y <= 6; y++) {
    for (let x = 2; x <= 22; x++) {
      s.set(x, y, (x % 2 === 0) ? P.redM : P.redL);
    }
  }
  // folded band
  s.span(7, 2, 22, P.redD);
  s.span(8, 3, 21, P.redD);
  // pom-pom
  s.rect(10, 1, 13, 2, P.woolL);
  s.autoOutline(P.outline);
  s.blit(buf, 20, 0);
}

function drawAcornCap(buf) {
  const s = new Sprite(16, 8);
  // cap
  s.span(3, 3, 12, P.woodM);
  s.span(4, 2, 13, P.woodM);
  s.span(5, 2, 13, P.woodL);
  s.span(6, 2, 13, P.woodD); // rim
  // speckle texture
  s.set(4, 4, P.woodL); s.set(7, 3, P.woodL); s.set(10, 4, P.woodL); s.set(6, 5, P.woodD); s.set(9, 5, P.woodD);
  // stem
  s.rect(7, 1, 8, 2, P.woodD);
  s.autoOutline(P.outline);
  s.blit(buf, 23, 0);
}

function drawFlowerCrown(buf) {
  const s = new Sprite(22, 6);
  // green vine base along a gentle arc (higher middle)
  const arc = (x) => (x >= 7 && x <= 14 ? 2 : x >= 4 && x <= 17 ? 3 : 4);
  for (let x = 1; x <= 20; x++) s.set(x, arc(x), P.leafD);
  // flowers along the vine
  const flowers = [
    [2, P.white], [6, P.pink], [10, P.woolL], [14, P.pink], [18, P.white],
  ];
  for (const [fx, petal] of flowers) {
    const fy = arc(fx) - 1;
    s.set(fx, fy - 1, petal);
    s.set(fx - 1, fy, petal); s.set(fx + 1, fy, petal); s.set(fx, fy, P.yolk);
    s.set(fx, fy + 1, petal);
  }
  // little leaves
  s.set(4, arc(4), P.leafL); s.set(12, 1, P.leafL); s.set(16, arc(16), P.leafL);
  s.autoOutline(P.outline);
  s.blit(buf, 20, 3);
}

// ---------- GLASSES ----------
// Designed for the canonical 3/4 side-profile alpaca: one dominant lens over the
// visible eye (gx33-39,gy22-25), only a partial hint of the far lens, temple arm
// running back toward the ear, and shapes that follow the muzzle/eye angle. No
// symmetrical front-facing two-lens frames.

function drawRoundGlasses(buf) {
  // single dominant round lens + a partial far-side arc turning away
  const s = new Sprite(22, 8);
  const F = P.outline, Hl = P.woolL;
  const ring = (x0, y0, x1, y1) => {
    s.span(y0, x0 + 1, x1 - 1, F);
    s.span(y1, x0 + 1, x1 - 1, F);
    for (let y = y0 + 1; y < y1; y++) { s.set(x0, y, F); s.set(x1, y, F); }
  };
  ring(7, 1, 15, 6); // main lens over the eye
  s.set(9, 2, Hl); // glint
  // partial far-side lens: a short curved sliver that reads as turning away
  s.set(4, 3, F); s.set(3, 4, F); s.set(3, 5, F); s.set(4, 6, F);
  // angled bridge from the sliver up to the main lens
  s.set(5, 4, F); s.set(6, 4, F); s.set(6, 3, F);
  // temple arm running back to the ear
  s.span(1, 15, 20, F);
  s.blit(buf, 24, 20);
}

function drawReadingGlasses(buf) {
  // half-frame readers perched low on the muzzle (bottom rim only)
  const s = new Sprite(22, 8);
  const F = P.goldM;
  // main lens: bottom rim + short sides, no top rim
  s.span(6, 8, 15, F);
  s.set(8, 4, F); s.set(8, 5, F);
  s.set(15, 4, F); s.set(15, 5, F);
  // far-side half rim sliver
  s.span(6, 3, 6, F);
  s.set(3, 5, F);
  // angled bridge
  s.set(6, 4, F); s.set(7, 4, F);
  // arm to ear
  s.span(3, 15, 20, F);
  s.set(11, 5, P.woolL);
  s.blit(buf, 24, 21); // perched a touch lower
}

function drawSunglasses(buf) {
  // one angled wraparound shade that follows the eye down toward the muzzle
  const s = new Sprite(22, 8);
  s.rect(7, 1, 15, 5, P.lensDark); // main lens over eye
  // wrap extension angling down-left along the muzzle line
  s.rect(4, 3, 7, 6, P.lensDark);
  s.set(3, 5, P.lensDark); s.set(3, 6, P.lensDark);
  // heavy top frame edge + arm to ear
  s.span(1, 7, 15, P.outline);
  s.span(1, 15, 20, P.outline);
  // angled highlight streak
  s.set(9, 2, P.lensHi); s.set(10, 2, P.lensHi); s.set(5, 4, P.lensHi);
  s.autoOutline(P.outline);
  s.blit(buf, 24, 20);
}

function drawHeartGlasses(buf) {
  // asymmetric: full heart over the eye, half-heart peeking on the far side
  const s = new Sprite(22, 8);
  const fr = P.pinkD, tint = P.pink;
  const heart = (cx, cy) => {
    s.set(cx - 2, cy, fr); s.set(cx - 1, cy - 1, fr); s.set(cx, cy - 1, fr);
    s.set(cx + 1, cy - 1, fr); s.set(cx + 2, cy, fr);
    s.set(cx - 1, cy, tint); s.set(cx, cy, tint); s.set(cx + 1, cy, tint);
    s.set(cx - 1, cy + 1, fr); s.set(cx, cy + 1, tint); s.set(cx + 1, cy + 1, fr);
    s.set(cx, cy + 2, fr);
  };
  heart(11, 2); // main over the eye
  // partial half-heart peeking on the far side
  s.set(4, 3, fr); s.set(5, 2, fr); s.set(5, 3, tint); s.set(5, 4, fr); s.set(6, 3, fr);
  // angled bridge + arm
  s.set(7, 3, fr); s.set(8, 3, fr);
  s.span(1, 14, 19, fr);
  s.blit(buf, 24, 20);
}

function drawMonocle(buf) {
  // single gold ring over the visible eye with a chain dropping toward the neck
  const s = new Sprite(20, 13);
  const F = P.goldM, Hl = P.goldL;
  const ring = (x0, y0, x1, y1) => {
    s.span(y0, x0 + 1, x1 - 1, F);
    s.span(y1, x0 + 1, x1 - 1, F);
    for (let y = y0 + 1; y < y1; y++) { s.set(x0, y, F); s.set(x1, y, F); }
  };
  ring(7, 1, 15, 6);
  s.set(9, 2, Hl);
  // chain dangling down toward the neck (gentle curve)
  s.set(8, 6, F); s.set(8, 7, F); s.set(7, 8, F); s.set(7, 9, F); s.set(8, 10, F); s.set(8, 11, F);
  s.blit(buf, 24, 20);
}

// ---------- CLOTHING (neck/chest gy34-56) ----------

function drawWoolScarf(buf) {
  const s = new Sprite(32, 24);
  // wrap around neck
  for (let y = 2; y <= 5; y++) s.span(y, 6, 26, (y % 2 === 0) ? P.redM : P.redL);
  s.span(5, 6, 26, P.redD);
  // knot front-left
  s.rect(8, 4, 12, 8, P.redM);
  s.set(9, 5, P.redL); s.set(11, 6, P.redD);
  // two hanging tails
  for (let y = 8; y <= 17; y++) { s.span(y, 7, 9, (y % 2 === 0) ? P.redM : P.redL); s.span(y, 11, 13, (y % 2 === 0) ? P.redL : P.redM); }
  // fringe
  s.span(18, 7, 9, P.redD); s.span(18, 11, 13, P.redD);
  s.set(7, 19, P.redD); s.set(9, 19, P.redD); s.set(11, 19, P.redD); s.set(13, 19, P.redD);
  s.autoOutline(P.outline);
  s.blit(buf, 17, 33);
}

function drawKnitSweater(buf) {
  const s = new Sprite(34, 24);
  // rolled collar
  for (let y = 2; y <= 4; y++) s.span(y, 7, 27, P.greenD);
  s.span(3, 8, 26, P.greenM);
  // body over chest with knit stripes
  for (let y = 5; y <= 21; y++) {
    const x0 = Math.max(4, 6 - Math.floor((y - 5) / 3));
    const x1 = Math.min(31, 28 + Math.floor((y - 5) / 4));
    s.span(y, x0, x1, (y % 2 === 0) ? P.greenM : P.greenL);
  }
  // ribbing lines
  for (let y = 6; y <= 20; y += 3) s.span(y, 5, 30, P.greenD);
  s.autoOutline(P.outline);
  s.blit(buf, 15, 33);
}

function drawCozyPoncho(buf) {
  const s = new Sprite(36, 24);
  // wide shoulders tapering to a point
  for (let y = 3; y <= 19; y++) {
    const half = 14 - Math.floor((y - 3) * 0.55);
    const cx = 18;
    s.span(y, cx - half, cx + half, (y % 2 === 0) ? P.strawM : P.redL);
  }
  // cream stripe bands
  s.span(7, 4, 32, P.woolL);
  s.span(12, 6, 30, P.woolL);
  // collar
  s.span(2, 12, 24, P.redD);
  // bottom fringe
  for (let x = 10; x <= 26; x += 2) { s.set(x, 20, P.strawD); s.set(x, 21, P.strawD); }
  s.autoOutline(P.outline);
  s.blit(buf, 14, 33);
}

function drawPlaidBandana(buf) {
  const s = new Sprite(24, 16);
  // triangle neckerchief pointing down
  for (let y = 2; y <= 11; y++) {
    const half = 9 - y + 2;
    if (half < 0) break;
    const cx = 11;
    s.span(y, cx - half, cx + half, P.redM);
  }
  // plaid lines
  for (let y = 2; y <= 11; y++) { if (y % 3 === 0) s.span(y, 2, 20, P.redD); }
  for (let x = 4; x <= 18; x += 3) for (let y = 2; y <= 11; y++) { if (s.get(x, y)) s.set(x, y, P.woolL); }
  s.autoOutline(P.outline);
  s.blit(buf, 22, 34);
}

function drawDenimOveralls(buf) {
  const s = new Sprite(30, 24);
  // bib
  s.rect(11, 8, 21, 20, P.denimM);
  // shading
  for (let y = 8; y <= 20; y++) s.set(11, y, P.denimD);
  for (let x = 11; x <= 21; x++) s.set(x, 20, P.denimD);
  // pocket
  s.rect(14, 12, 18, 16, P.denimL); s.span(16, 14, 18, P.denimD);
  // straps up over shoulders
  s.rect(12, 1, 14, 8, P.denimM); s.rect(18, 1, 20, 8, P.denimM);
  // buttons
  s.set(13, 8, P.goldM); s.set(19, 8, P.goldM);
  s.autoOutline(P.outline);
  s.blit(buf, 17, 33);
}

// ---------- NECKLACES (base of neck gy39-44, gentle arc) ----------

const arcY = (x, w) => { // dips in the middle
  const c = w / 2;
  return Math.round(1 + (1 - Math.abs(x - c) / c) * 1.6);
};

function drawWoodenBead(buf) {
  const s = new Sprite(22, 8);
  // cord
  for (let x = 1; x <= 20; x++) s.set(x, arcY(x, 22), P.woodD);
  // beads
  for (let x = 2; x <= 19; x += 3) {
    const y = arcY(x, 22);
    s.rect(x, y, x + 1, y + 1, P.woodM);
    s.set(x, y, P.woodL);
  }
  s.autoOutline(P.outline);
  s.blit(buf, 23, 38);
}

function drawBellCollar(buf) {
  const s = new Sprite(22, 9);
  // leather band
  for (let x = 1; x <= 20; x++) { const y = arcY(x, 22); s.set(x, y, P.woodM); s.set(x, y + 1, P.woodD); }
  // bell hanging center
  const cx = 10, cy = arcY(cx, 22) + 2;
  s.rect(cx - 1, cy, cx + 1, cy + 2, P.goldM);
  s.span(cy, cx - 1, cx + 1, P.goldL);
  s.set(cx, cy + 3, P.goldD); // clapper
  s.autoOutline(P.outline);
  s.blit(buf, 23, 38);
}

function drawDaisyChain(buf) {
  const s = new Sprite(22, 8);
  for (let x = 1; x <= 20; x++) s.set(x, arcY(x, 22), P.leafD);
  for (let x = 3; x <= 18; x += 4) {
    const y = arcY(x, 22);
    s.set(x, y - 1, P.white); s.set(x - 1, y, P.white); s.set(x + 1, y, P.white);
    s.set(x, y + 1, P.white); s.set(x, y, P.yolk);
  }
  s.autoOutline(P.outline);
  s.blit(buf, 23, 38);
}

function drawBerryString(buf) {
  const s = new Sprite(22, 9);
  for (let x = 1; x <= 20; x++) s.set(x, arcY(x, 22), P.woodD);
  for (let x = 3; x <= 18; x += 3) {
    const y = arcY(x, 22) + 1;
    s.set(x, y, P.berryM); s.set(x, y + 1, P.berryL);
    s.set(x - 1, y + 1, P.berryM);
  }
  s.autoOutline(P.outline);
  s.blit(buf, 23, 38);
}

function drawCloverPendant(buf) {
  const s = new Sprite(22, 11);
  for (let x = 1; x <= 20; x++) s.set(x, arcY(x, 22), P.goldD);
  // four-leaf clover pendant center
  const cx = 10, cy = arcY(cx, 22) + 3;
  s.set(cx - 1, cy - 1, P.greenM); s.set(cx, cy - 1, P.greenL);
  s.set(cx - 1, cy, P.greenL); s.set(cx, cy, P.greenM);
  s.set(cx + 1, cy - 1, P.greenM); s.set(cx + 1, cy, P.greenL);
  s.set(cx, cy + 1, P.greenM);
  s.set(cx, cy - 2, P.goldM); // link
  s.autoOutline(P.outline);
  s.blit(buf, 23, 38);
}

// ---------- BACKGROUNDS (full canvas, procedural) ----------

function bgFillGrad(buf, stops) {
  // stops: array of {gy, color}; linear between
  for (let gy = 0; gy < 64; gy++) {
    let color = stops[0].color;
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1];
      if (gy >= a.gy && gy <= b.gy) {
        const t = (gy - a.gy) / Math.max(1, b.gy - a.gy);
        color = [
          Math.round(a.color[0] + (b.color[0] - a.color[0]) * t),
          Math.round(a.color[1] + (b.color[1] - a.color[1]) * t),
          Math.round(a.color[2] + (b.color[2] - a.color[2]) * t),
          255,
        ];
        break;
      }
      if (gy > b.gy) color = b.color;
    }
    g(buf, 0, gy, 64, 1, color);
  }
}

function drawMeadowGreen(buf) {
  bgFillGrad(buf, [
    { gy: 0, color: [222, 240, 226, 255] },
    { gy: 34, color: [196, 226, 200, 255] },
    { gy: 40, color: P.greenL },
    { gy: 63, color: P.greenM },
  ]);
  // grass tufts along the ground line
  for (let x = 2; x < 64; x += 5) {
    const y = 39 + (x % 3);
    dot(buf, x, y, P.greenD); dot(buf, x + 1, y - 1, P.greenD);
  }
}

function drawMorningSky(buf) {
  bgFillGrad(buf, [
    { gy: 0, color: [206, 232, 248, 255] },
    { gy: 40, color: [230, 244, 252, 255] },
    { gy: 63, color: [214, 238, 246, 255] },
  ]);
  // soft sun top-right
  fillCircle(buf, 50, 12, 6, P.sunCore);
  fillCircle(buf, 50, 12, 4, [255, 240, 200, 255]);
  // chunky clouds
  cloud(buf, 12, 20); cloud(buf, 34, 30);
}

function drawSunsetPasture(buf) {
  bgFillGrad(buf, [
    { gy: 0, color: P.sunsetTop },
    { gy: 18, color: P.sunsetMid },
    { gy: 30, color: P.sunsetLow },
    { gy: 40, color: P.lavender },
    { gy: 44, color: [120, 96, 78, 255] },
    { gy: 63, color: [92, 72, 58, 255] },
  ]);
  // low sun
  fillCircle(buf, 24, 30, 7, [252, 224, 150, 255]);
  fillCircle(buf, 24, 30, 5, [255, 240, 190, 255]);
}

function drawBarnWood(buf) {
  const planks = [P.woodM, P.woodL, P.woodD];
  let x = 0, i = 0;
  while (x < 64) {
    const w = 5 + (i % 3);
    g(buf, x, 0, w, 64, planks[i % planks.length]);
    // seam
    g(buf, x, 0, 1, 64, P.woodD);
    // a couple of knots
    if (i % 2 === 0) fillCircle(buf, x + 2, 12 + (i % 4) * 10, 1, P.woodD);
    x += w; i++;
  }
  // horizontal grain lines
  for (let y = 6; y < 64; y += 13) g(buf, 0, y, 64, 1, [0, 0, 0, 30]);
}

function drawStarryNight(buf) {
  bgFillGrad(buf, [
    { gy: 0, color: [22, 28, 54, 255] },
    { gy: 40, color: P.navy },
    { gy: 63, color: [40, 50, 86, 255] },
  ]);
  // crescent moon
  fillCircle(buf, 48, 14, 6, [246, 242, 214, 255]);
  fillCircle(buf, 45, 12, 6, P.navy);
  // stars
  const stars = [[6, 6], [14, 12], [22, 5], [30, 16], [10, 24], [38, 8], [56, 26], [20, 34], [34, 30], [58, 10], [5, 18], [26, 22]];
  for (const [sx, sy] of stars) {
    dot(buf, sx, sy, P.white);
    fillPx(buf, sx * CELL + 4, sy * CELL - 4, 8, 8, [255, 255, 255, 120]);
  }
}

// helpers for backgrounds
function fillCircle(buf, gcx, gcy, gr, color) {
  for (let y = gcy - gr; y <= gcy + gr; y++) {
    for (let x = gcx - gr; x <= gcx + gr; x++) {
      const dx = x - gcx, dy = y - gcy;
      if (dx * dx + dy * dy <= gr * gr + gr) dot(buf, x, y, color);
    }
  }
}
function cloud(buf, gx, gy) {
  fillCircle(buf, gx, gy, 3, P.white);
  fillCircle(buf, gx + 4, gy + 1, 4, P.white);
  fillCircle(buf, gx + 8, gy, 3, P.white);
  g(buf, gx - 2, gy + 1, 13, 2, P.white);
}

// ---------- runner ----------

const TRAITS = [
  ["hats", "straw-hat", drawStrawHat],
  ["hats", "farmer-cap", drawFarmerCap],
  ["hats", "wool-beanie", drawWoolBeanie],
  ["hats", "acorn-cap", drawAcornCap],
  ["hats", "flower-crown", drawFlowerCrown],
  ["glasses", "round-glasses", drawRoundGlasses],
  ["glasses", "reading-glasses", drawReadingGlasses],
  ["glasses", "sunglasses", drawSunglasses],
  ["glasses", "heart-glasses", drawHeartGlasses],
  ["glasses", "monocle", drawMonocle],
  ["clothing", "wool-scarf", drawWoolScarf],
  ["clothing", "knit-sweater", drawKnitSweater],
  ["clothing", "cozy-poncho", drawCozyPoncho],
  ["clothing", "plaid-bandana", drawPlaidBandana],
  ["clothing", "denim-overalls", drawDenimOveralls],
  ["necklaces", "wooden-bead", drawWoodenBead],
  ["necklaces", "bell-collar", drawBellCollar],
  ["necklaces", "daisy-chain", drawDaisyChain],
  ["necklaces", "berry-string", drawBerryString],
  ["necklaces", "clover-pendant", drawCloverPendant],
  ["backgrounds", "meadow-green", drawMeadowGreen],
  ["backgrounds", "morning-sky", drawMorningSky],
  ["backgrounds", "sunset-pasture", drawSunsetPasture],
  ["backgrounds", "barn-wood", drawBarnWood],
  ["backgrounds", "starry-night", drawStarryNight],
];

// categories whose art must stay within the alpaca silhouette
const BODY_HUG = new Set(["clothing", "necklaces"]);

async function loadBaseAlpha() {
  const { data, info } = await sharp(BASE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info };
}

function maskToBase(buf, baseData) {
  for (let i = 0; i < W * H; i++) {
    if (baseData[i * 4 + 3] <= 8) {
      buf[i * 4 + 3] = 0; // clear anything outside the alpaca body
    }
  }
}

async function main() {
  const { data: baseData } = await loadBaseAlpha();
  for (const [cat, id, draw] of TRAITS) {
    const buf = createCanvas();
    draw(buf);
    if (BODY_HUG.has(cat)) maskToBase(buf, baseData);
    const out = `${OUT}/${cat}/${id}.png`;
    await save(buf, out);
    console.log("drew", out);
  }
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
