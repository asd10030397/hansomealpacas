// Draw 5 cozy HANSOME "effect" traits — full-canvas ambient/atmosphere layers composited
// LAST (on top of everything). Effects enhance rarity + mood; they must NOT cover the
// alpaca: particles live in the periphery (outside a central face/body corridor) and
// glows are edge-weighted and subtle. Everything is authored at full 1024x1024 with
// crisp pixel-blocks (nearest-neighbor feel) and low-alpha halos for softness.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const OUT = "public/pixel/traits/effects";
fs.mkdirSync(OUT, { recursive: true });
const S = 1024;

// central keep-out corridor: covers every archetype's face + core body so nothing
// obstructs the alpaca. Particles are placed OUTSIDE this box.
const SAFE = { x0: 372, y0: 300, x1: 652, y1: 720 };
function inSafe(x, y) { return x >= SAFE.x0 && x <= SAFE.x1 && y >= SAFE.y0 && y <= SAFE.y1; }

function newBuf() { return Buffer.alloc(S * S * 4, 0); }
function over(buf, x, y, c) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 4, a = c[3] / 255, ia = 1 - a;
  buf[i] = Math.round(c[0] * a + buf[i] * ia);
  buf[i + 1] = Math.round(c[1] * a + buf[i + 1] * ia);
  buf[i + 2] = Math.round(c[2] * a + buf[i + 2] * ia);
  buf[i + 3] = Math.min(255, Math.round(c[3] + buf[i + 3] * ia));
}
// crisp pixel-block of size ps
function block(buf, x, y, ps, c) { for (let dy = 0; dy < ps; dy++) for (let dx = 0; dx < ps; dx++) over(buf, x + dx, y + dy, c); }
// stamp a char-grid shape centred at (cx,cy) with pixel size ps
function stamp(buf, cx, cy, rows, pal, ps) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const x0 = Math.round(cx - (w * ps) / 2), y0 = Math.round(cy - (h * ps) / 2);
  for (let r = 0; r < h; r++) for (let col = 0; col < rows[r].length; col++) {
    const ch = rows[r][col]; if (ch === " " || ch === ".") continue;
    const c = pal[ch]; if (!c) continue; block(buf, x0 + col * ps, y0 + r * ps, ps, c);
  }
}
// soft round dot with radial alpha falloff (small, still chunky via step)
function softDot(buf, cx, cy, r, c, step = 3) {
  for (let dy = -r; dy <= r; dy += step) for (let dx = -r; dx <= r; dx += step) {
    const d = Math.hypot(dx, dy); if (d > r) continue;
    const a = Math.round(c[3] * (1 - d / r));
    if (a <= 3) continue;
    block(buf, cx + dx, cy + dy, step, [c[0], c[1], c[2], a]);
  }
}

// ---- shared particle position pools (all OUTSIDE the safe corridor) ----
const POOL = [
  [150, 170], [300, 120], [520, 110], [720, 140], [880, 180],
  [110, 340], [930, 330], [90, 520], [950, 520], [130, 700],
  [910, 700], [250, 250], [790, 250], [300, 830], [730, 840],
  [500, 880], [180, 900], [860, 900], [660, 200], [360, 200],
];
function poolOutside() { return POOL.filter(([x, y]) => !inSafe(x, y)); }

// 1. Small Sparkles — subtle rare shine scattered around the character.
function smallSparkles() {
  const buf = newBuf();
  const pal = { C: [255, 250, 238, 255], X: [255, 244, 214, 210], b: [255, 236, 180, 120] };
  const spark4 = ["..b..", "..X..", "bXCXb", "..X..", "..b.."];
  const spark3 = [".b.", "bCb", ".b."];
  const pts = poolOutside();
  pts.forEach(([x, y], i) => {
    const ps = i % 3 === 0 ? 6 : 4;
    stamp(buf, x, y, i % 2 === 0 ? spark4 : spark3, pal, ps);
  });
  return { buf, id: "small-sparkles", name: "Small Sparkles", tier: "rare" };
}

// 2. Falling Leaves — a few autumn leaves drifting across the frame.
function fallingLeaves() {
  const buf = newBuf();
  const cols = [
    { o: [210, 120, 62, 255], d: [166, 84, 40, 255] }, // amber
    { o: [198, 91, 78, 255], d: [150, 60, 52, 255] },  // russet red
    { o: [209, 164, 69, 255], d: [160, 118, 44, 255] }, // gold
  ];
  const leaf = ["..o.o..", ".ooooo.", "ooooooo", ".ooooo.", "..ooo..", "...s...", "...s..."];
  const pts = poolOutside();
  pts.forEach(([x, y], i) => {
    const c = cols[i % cols.length];
    stamp(buf, x, y, leaf, { o: c.o, s: [110, 74, 40, 235] }, 6);
    // vein
    stamp(buf, x, y, ["...v...", "...v...", "..vvv..", "...v...", "...v..."], { v: c.d }, 6);
  });
  return { buf, id: "falling-leaves", name: "Falling Leaves", tier: "rare" };
}

// 3. Small Fireflies — warm glowing dots, night-countryside mood (lower/side-weighted).
function fireflies() {
  const buf = newBuf();
  const core = [255, 244, 176, 255], hot = [255, 226, 128, 200], glow = [255, 198, 96, 150];
  const pts = poolOutside().filter(([, y]) => y > 240); // keep them low / mid
  pts.forEach(([x, y], i) => {
    softDot(buf, x, y, i % 2 ? 26 : 20, glow, 3);
    softDot(buf, x, y, 11, hot, 2);
    block(buf, x - 4, y - 4, 8, core);
  });
  return { buf, id: "fireflies", name: "Small Fireflies", tier: "rare" };
}

// 4. Soft Snowflakes — gentle winter flurry.
function snowflakes() {
  const buf = newBuf();
  const flake = ["..X..", "X.X.X", ".XXX.", "X.X.X", "..X.."];
  const dot = ["o"];
  const pal = { X: [236, 246, 252, 235], o: [255, 255, 255, 160] };
  const pts = poolOutside();
  pts.forEach(([x, y], i) => {
    if (i % 3 === 2) block(buf, x, y, 6, [255, 255, 255, 150]);
    else stamp(buf, x, y, flake, pal, i % 2 ? 5 : 4);
  });
  return { buf, id: "snowflakes", name: "Soft Snowflakes", tier: "rare" };
}

// 5. Golden Glow — very subtle legendary aura: a warm bright halo RING hugging the
// character (fades to clear at the centre and the corners) + a few gold sparkles.
function goldenGlow() {
  const buf = newBuf();
  const cx = 512, cy = 540;                       // aura centred on the body mass
  const Rin = 300, Rpeak = 430, Rout = 660, maxA = 82;
  const gold = [255, 234, 168];                   // bright warm gold (reads as glow, not vignette)
  for (let y = 0; y < S; y += 2) for (let x = 0; x < S; x += 2) {
    const d = Math.hypot(x - cx, y - cy);
    if (d < Rin || d > Rout) continue;
    const t = d < Rpeak ? (d - Rin) / (Rpeak - Rin) : 1 - (d - Rpeak) / (Rout - Rpeak);
    const a = Math.round(maxA * Math.max(0, t));
    if (a <= 2) continue;
    block(buf, x, y, 2, [gold[0], gold[1], gold[2], a]);
  }
  // a scattering of gold sparkles floating in the aura
  const pal = { C: [255, 246, 206, 240], b: [250, 220, 140, 140] };
  const spark = ["..b..", "..C..", "bCCCb", "..C..", "..b.."];
  poolOutside().forEach(([x, y], i) => { if (i % 2 === 0) stamp(buf, x, y, spark, pal, 5); });
  return { buf, id: "golden-glow", name: "Golden Glow", tier: "legendary" };
}

const items = [smallSparkles(), fallingLeaves(), fireflies(), snowflakes(), goldenGlow()];
const meta = {};
for (const it of items) {
  await sharp(it.buf, { raw: { width: S, height: S, channels: 4 } }).png().toFile(path.join(OUT, `${it.id}.png`));
  meta[it.id] = { name: it.name, tier: it.tier, file: `effects/${it.id}.png`, layer: "effects", fullCanvas: true, safeZone: SAFE };
  console.log(`${it.id.padEnd(16)} ${S}x${S}  tier=${it.tier}`);
}
fs.writeFileSync(path.join(OUT, "_effects-meta.json"), JSON.stringify(meta, null, 2));
console.log("wrote", Object.keys(meta).length, "effects + _effects-meta.json");
