// SPECIAL 21 backgrounds — King / Guardian / Farmer / Lucky / Runner.
// These are the rarity/identity backdrops for the 21 Special alpacas (Founder #001 + 20 Legendary).
// The alpaca stays the FOCUS: it is composited on top (layer 1) so auras/emblems glow AROUND the
// silhouette, and all extra motifs live in the open sky (y<15) or the side columns (x<16 / x>47),
// where the alpaca (grid bbox x16-47, y15-61) does not sit. No accessories are added to the alpaca.
// Same 64x64 pixel grid + shared palette as every other HANSOME background.
import sharp from "sharp";
import { W, H, CELL, P, createCanvas, g, dot, save, stamp } from "../lib/pixel.mjs";

const OUT = "public/pixel/traits/backgrounds";

// ---------- helpers ----------
function grad(buf, stops) {
  for (let gy = 0; gy < 64; gy++) {
    let color = stops[0].color;
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1];
      if (gy >= a.gy && gy <= b.gy) { const t = (gy - a.gy) / Math.max(1, b.gy - a.gy); color = [Math.round(a.color[0] + (b.color[0] - a.color[0]) * t), Math.round(a.color[1] + (b.color[1] - a.color[1]) * t), Math.round(a.color[2] + (b.color[2] - a.color[2]) * t), 255]; break; }
      if (gy > b.gy) color = b.color;
    }
    g(buf, 0, gy, 64, 1, color);
  }
}
function cellBase(buf, gx, gy) { const i = ((gy * CELL) * W + gx * CELL) * 4; return [buf[i], buf[i + 1], buf[i + 2]]; }
function blend(buf, gx, gy, col, a) { if (gx < 0 || gy < 0 || gx >= 64 || gy >= 64 || a <= 0) return; const b = cellBase(buf, gx, gy); g(buf, gx, gy, 1, 1, [Math.round(b[0] + (col[0] - b[0]) * a), Math.round(b[1] + (col[1] - b[1]) * a), Math.round(b[2] + (col[2] - b[2]) * a), 255]); }
function glow(buf, cx, cy, rad, col, maxA) { for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= rad) blend(buf, x, y, col, maxA * (1 - d / rad)); } }
function circle(buf, cx, cy, r, col) { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) { const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy <= r * r + r) dot(buf, x, y, col); } }
function star(buf, x, y, col) { dot(buf, x, y, col); blend(buf, x - 1, y, col, 0.45); blend(buf, x + 1, y, col, 0.45); blend(buf, x, y - 1, col, 0.45); blend(buf, x, y + 1, col, 0.45); }
function raysFrom(buf, cx, cy, r0, r1, col, a) { for (let ang = 0; ang < 12; ang++) { const t = ang * Math.PI / 6; for (let r = r0; r < r1; r += 2) blend(buf, Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), col, a); } }

// ---------- 1. KING ----------
function king(buf) {
  grad(buf, [
    { gy: 0, color: [52, 36, 84, 255] }, { gy: 22, color: [86, 60, 130, 255] },
    { gy: 40, color: [124, 96, 172, 255] }, { gy: 52, color: [96, 70, 138, 255] }, { gy: 63, color: [62, 44, 96, 255] },
  ]);
  raysFrom(buf, 32, 32, 15, 30, [250, 228, 150], 0.16);
  glow(buf, 32, 31, 26, [247, 216, 130], 0.26);
  glow(buf, 32, 31, 14, [252, 236, 180], 0.34);
  // NOTE: the crown lives on the alpaca (class accent), so the sky carries only the regal
  // sunburst aura + sparkles here — no crown emblem, to avoid a double crown on the King token.
  for (const [x, y] of [[6, 6], [57, 8], [10, 15], [55, 17], [4, 26], [59, 28], [8, 44], [56, 46], [31, 4], [33, 6]]) star(buf, x, y, [252, 236, 180, 255]);
}

// ---------- 2. GUARDIAN ----------
function guardian(buf) {
  grad(buf, [
    { gy: 0, color: [36, 50, 76, 255] }, { gy: 24, color: [70, 96, 128, 255] },
    { gy: 42, color: [112, 142, 170, 255] }, { gy: 63, color: [72, 98, 126, 255] },
  ]);
  glow(buf, 32, 31, 25, [150, 210, 220], 0.20);
  glow(buf, 32, 31, 13, [214, 240, 244], 0.30);
  // stone pillars on the far edges (visible beside the alpaca)
  const S = { s: [120, 128, 140, 255], d: [88, 96, 110, 255], l: [160, 168, 178, 255] };
  for (const bx of [0, 61]) {
    for (let y = 6; y < 64; y++) { g(buf, bx, y, 3, 1, S.s); dot(buf, bx, y, S.d); dot(buf, bx + 2, y, S.l); }
    for (let y = 6; y < 64; y += 6) g(buf, bx, y, 3, 1, S.d); // block seams
    g(buf, bx, 5, 3, 2, S.l); // capital
  }
  // guardian shield emblem in the open sky above the head
  const SH = { D: [70, 84, 104, 255], L: [150, 176, 200, 255], c: [150, 224, 224, 255] };
  stamp(buf, 28, 1, ["DDDDDDDDD", "DLLLLLLLD", "DLLLcLLLD", "DLLLcLLLD", "DLcccccLD", ".DLLLLLD.", "..DLLLD..", "...DDD..."], SH);
  for (const [x, y] of [[7, 10], [56, 12], [9, 24], [55, 26], [8, 40], [57, 42]]) star(buf, x, y, [218, 240, 244, 255]);
}

// ---------- 3. FARMER ----------
function farmer(buf) {
  grad(buf, [
    { gy: 0, color: [250, 212, 148, 255] }, { gy: 18, color: [250, 228, 180, 255] },
    { gy: 33, color: [246, 226, 170, 255] }, { gy: 37, color: [178, 198, 98, 255] }, { gy: 63, color: [148, 176, 78, 255] },
  ]);
  glow(buf, 13, 11, 11, [255, 236, 170], 0.5); circle(buf, 13, 11, 5, [255, 240, 195, 255]); circle(buf, 13, 11, 3, [255, 248, 214, 255]);
  // rolling hill band
  for (let x = 0; x < 64; x++) { const hy = 36 + Math.round(1.5 * Math.sin(x / 7)); blend(buf, x, hy, [110, 150, 70, 255], 0.5); blend(buf, x, hy + 1, [110, 150, 70, 255], 0.35); }
  // distant barn to the right of the alpaca
  const B = { R: [178, 82, 68, 255], K: [120, 60, 50, 255], d: [92, 60, 40, 255], w: [214, 196, 168, 255] };
  stamp(buf, 52, 28, [".KKKKKK.", "KKKKKKKK", "RRRRRRRR", "RRRwwRRR", "RRRddRRR", "RRRddRRR", "RRRddRRR", "RRRddRRR"], B);
  // wheat stalks along the bottom corners only
  const gold = [209, 164, 69, 255], goldL = [233, 196, 106, 255], stem = [150, 138, 70, 255];
  const wheat = (x, base) => { for (let y = base; y > base - 4; y--) dot(buf, x, y, stem); dot(buf, x, base - 5, goldL); dot(buf, x - 1, base - 4, gold); dot(buf, x + 1, base - 4, gold); dot(buf, x, base - 4, goldL); dot(buf, x - 1, base - 3, gold); dot(buf, x + 1, base - 3, gold); };
  for (const x of [2, 5, 8, 11]) wheat(x, 63 - (x % 3));
  for (const x of [52, 55, 58, 61]) wheat(x, 63 - (x % 3));
}

// ---------- 4. LUCKY ----------
function clover(buf, cx, cy, leaf, leafL) {
  // four small leaves around center
  const L = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  for (const [dx, dy] of L) { dot(buf, cx + dx, cy + dy, leaf); blend(buf, cx + dx, cy + dy, leafL, 0.4); }
  dot(buf, cx, cy, [120, 90, 50, 255]); // stem knot
  dot(buf, cx, cy + 2, [110, 150, 70, 255]);
}
function lucky(buf) {
  grad(buf, [
    { gy: 0, color: [198, 233, 197, 255] }, { gy: 30, color: [170, 216, 168, 255] },
    { gy: 39, color: [143, 192, 106, 255] }, { gy: 63, color: [104, 156, 78, 255] },
  ]);
  glow(buf, 32, 31, 23, [247, 222, 140], 0.24);
  glow(buf, 32, 31, 12, [252, 238, 175], 0.32);
  // big lucky clover emblem in the open sky above the head
  const CC = { g: [120, 190, 118, 255], G: [150, 200, 140, 255], s: [120, 90, 50, 255] };
  stamp(buf, 27, 0, [".gg...gg.", "gGGg.gGGg", "gGGg.gGGg", ".gg.s.gg.", "...sss...", ".gg.s.gg.", "gGGg.gGGg", ".gg...gg."], CC);
  for (const [x, y] of [[7, 9], [55, 11], [10, 22], [54, 24], [6, 40], [57, 42]]) clover(buf, x, y, [96, 152, 74, 255], [150, 200, 130, 255]);
  for (const [x, y] of [[13, 6], [50, 7], [4, 32], [60, 34]]) star(buf, x, y, [252, 238, 175, 255]);
}

// ---------- 5. RUNNER ----------
function runner(buf) {
  grad(buf, [
    { gy: 0, color: [118, 196, 214, 255] }, { gy: 22, color: [178, 224, 228, 255] },
    { gy: 33, color: [250, 208, 172, 255] }, { gy: 40, color: [222, 196, 168, 255] }, { gy: 63, color: [150, 122, 96, 255] },
  ]);
  circle(buf, 32, 33, 6, [255, 232, 172, 255]); // low sun (mostly behind alpaca; peeks as a warm halo)
  glow(buf, 32, 31, 22, [255, 236, 190], 0.22);
  // receding track that peeks at the bottom sides = ground motion
  for (let gy = 40; gy < 64; gy++) { const half = 2 + (gy - 40) * 0.8; blend(buf, Math.round(32 - half), gy, [212, 188, 156, 255], 0.5); blend(buf, Math.round(32 + half), gy, [212, 188, 156, 255], 0.5); }
  // horizontal speed streaks in the side columns (sense of motion, not covering the alpaca)
  const streak = (x0, x1, y, a) => { for (let x = x0; x <= x1; x++) blend(buf, x, y, [246, 250, 252, 255], a); };
  for (const [x0, x1, y, a] of [[0, 10, 10, 0.5], [2, 12, 14, 0.4], [0, 8, 20, 0.45], [4, 13, 26, 0.35], [1, 11, 44, 0.4]]) streak(x0, x1, y, a);
  for (const [x0, x1, y, a] of [[52, 63, 12, 0.5], [50, 61, 17, 0.4], [54, 63, 23, 0.45], [51, 60, 30, 0.35], [53, 63, 46, 0.4]]) streak(x0, x1, y, a);
  // dust motes trailing low on the sides
  for (const [x, y] of [[9, 55], [6, 58], [12, 60], [53, 56], [58, 59], [55, 61]]) blend(buf, x, y, [235, 220, 198, 255], 0.6);
}

const BGS = [["king", king], ["guardian", guardian], ["farmer", farmer], ["lucky", lucky], ["runner", runner]];

async function main() {
  for (const [id, draw] of BGS) { const buf = createCanvas(); draw(buf); await save(buf, `${OUT}/${id}.png`); console.log("drew", `${OUT}/${id}.png`); }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
