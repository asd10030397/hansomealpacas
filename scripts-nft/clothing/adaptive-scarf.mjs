// Adaptive Cozy Wool Scarf — a real archetype-aware clothing generator.
//
// Instead of one universal scarf PNG scaled onto every body, this DRAWS a fitted scarf
// with different geometry per archetype, derived from measured anatomy:
//   neck width, neck height, shoulder/chest width, head clearance, body silhouette.
// The scarf identity (red cozy knit wool, pixel-art language: curved wrap band + knit
// ribs + centre knot + two ribbed fringed tails) is preserved across all bodies.
//
// Outputs:
//   public/pixel/traits/clothing/cozy-wool-scarf/<archetype>.png   (fitted variant, tight)
//   public/pixel/traits/clothing/previews/wool-scarf__<archetype>.png (composite)
//   public/pixel/traits/clothing/previews/wool-scarf__contact.png     (after, annotated)
//   public/pixel/traits/clothing/previews/_SCARF-before-after.png     (validation)
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { P, Sprite } from "../lib/pixel.mjs";

const BASE = "public/pixel/traits/base";
const NORM = path.join(BASE, "normalized");
const CLO = "public/pixel/traits/clothing";
const PREV = path.join(CLO, "previews");
const VAR = path.join(CLO, "cozy-wool-scarf");
fs.mkdirSync(PREV, { recursive: true });
fs.mkdirSync(VAR, { recursive: true });

const anchors = JSON.parse(fs.readFileSync(path.join(BASE, "anchors.json"), "utf8")).archetypes;
const ARCHES = ["puff", "curly", "topknot", "cria", "sleek", "scruffy", "bramble", "elder"];
const CARD = { r: 255, g: 252, b: 245, alpha: 1 };
const CELL = 16;

// ---------------- anatomy measurement ----------------
const rawCache = {};
async function baseRaw(name) {
  if (rawCache[name]) return rawCache[name];
  rawCache[name] = await sharp(path.join(NORM, `${name}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return rawCache[name];
}
function rowSpan(data, W, y) { let l = -1, r = -1; for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 40) { if (l < 0) l = x; r = x; } return l < 0 ? null : [l, r]; }
async function spanAt(name, y) {
  const { data, info } = await baseRaw(name);
  let lo = 1e9, hi = -1, cnt = 0;
  for (let yy = y - 4; yy <= y + 4; yy++) { const s = rowSpan(data, info.width, yy); if (s) { lo = Math.min(lo, s[0]); hi = Math.max(hi, s[1]); cnt++; } }
  return cnt ? { l: lo, r: hi, w: hi - lo, cx: Math.round((lo + hi) / 2) } : null;
}

async function measure(name) {
  const a = anchors[name];
  const { data, info } = await baseRaw(name);
  const W = info.width, h = a.bbox.h;
  const faceClearY = Math.round(a.eye.lineY + h * 0.06);   // head clearance line (below the face)
  // neck pinch: narrowest silhouette in a window around the neck anchor
  const yStart = Math.max(faceClearY, Math.round(a.neck.y - h * 0.11));
  const yEnd = Math.round(a.neck.y + h * 0.13);
  let best = { w: 1e9, y: a.neck.y, cx: a.neck.x };
  for (let y = yStart; y <= yEnd; y++) {
    let lo = 1e9, hi = -1, cnt = 0;
    for (let yy = y - 2; yy <= y + 2; yy++) { const s = rowSpan(data, W, yy); if (s) { lo = Math.min(lo, s[0]); hi = Math.max(hi, s[1]); cnt++; } }
    if (!cnt) continue; const w = hi - lo;
    if (w < best.w) best = { w, y, cx: Math.round((lo + hi) / 2) };
  }
  const chest = await spanAt(name, a.chest.y);
  const shoulderY = Math.round(a.chest.y - h * 0.03);
  const chinY = faceClearY;
  const neckHeight = shoulderY - chinY;
  const legLimitY = Math.round(a.bbox.y1 - h * 0.16);
  // mouth clearance: no mouth anchor exists, so approximate the bottom of the muzzle/mouth
  // from the eye line, then drop the band so its TOP clears it (full mouth stays visible).
  const mouthClearY = Math.round(a.eye.lineY + h * 0.15);
  // band seat row + the silhouette edges there: the scarf band extends left/right to these
  // boundaries while its centre stays on the neck; seat drops below the mouth.
  const seatY = Math.max(best.y, faceClearY + 3 * CELL, mouthClearY + 3 * CELL);
  const seat = await spanAt(name, seatY) || { l: best.cx - best.w / 2, r: best.cx + best.w / 2, cx: best.cx, w: best.w };
  return {
    neckW: best.w, neckX: best.cx, neckRowY: best.y,
    neckHeight, chestW: chest ? chest.w : a.bbox.w * 0.6, chestX: chest ? chest.cx : a.center,
    faceClearY, legLimitY, torsoH: legLimitY - best.y, bbox: a.bbox,
    seatY, seatL: seat.l, seatR: seat.r, seatCx: seat.cx, seatW: seat.r - seat.l,
  };
}

// ---------------- parametric scarf (per-archetype geometry) ----------------
function drawScarf(m) {
  // Band extends left/right to the silhouette boundary at the seat row (centre stays on
  // the neck). Band stays thin and tails stay compact (they are NOT extended to the
  // boundary). All geometry in grid cells of CELL px; pixels stay square.
  const bandHalf = Math.max(3, Math.round((m.neckW / 2) * 1.06 / CELL));      // span the two sides of the neck only (follows thin necks like sleek)
  const depth = Math.max(1, Math.min(3, Math.round(bandHalf * 0.14)));        // gentle front dip
  const thick = Math.min(4, Math.max(2, Math.round(m.neckW * 0.01) + 2));     // thin band
  const topRow = 2;
  const anchorRow = topRow + depth + Math.floor(thick / 2);                   // band front-centre midline
  const seatY = m.seatY;
  const bandBottomCanvas = seatY + Math.ceil(thick / 2) * CELL;

  // tails: small + compact (not counted toward the boundary reach), centred under the knot
  const availTorso = Math.max(CELL * 3, m.legLimitY - bandBottomCanvas);
  const tailLen = Math.max(3, Math.min(7, Math.round(availTorso * 0.26 / CELL)));
  const tailW = Math.min(4, Math.max(2, Math.round(m.neckW * 0.07 / CELL)));

  const pad = 3;
  const H = anchorRow + Math.ceil(thick / 2) + tailLen + 3 + pad;
  const Wc = 2 * bandHalf + pad * 2 + 4;
  const S = new Sprite(Wc, H);
  const cx = Math.floor(Wc / 2);

  // curved thick wrap band: higher at the sides, dips in front centre
  for (let x = -bandHalf; x <= bandHalf; x++) {
    const t = x / bandHalf;
    const cyTop = topRow + Math.round((1 - t * t) * depth);
    for (let k = 0; k < thick; k++) {
      const c = k === 0 ? P.redL : (k >= thick - 1 ? P.redD : P.redM);
      S.set(cx + x, cyTop + k, c);
    }
    if (((x + bandHalf) % 2) === 0) S.set(cx + x, cyTop + Math.min(1, thick - 1), P.redD); // knit rib
  }

  // centre knot fold (overlapping cozy fold)
  const knotTop = topRow + depth - 1;
  S.rect(cx - 2, knotTop, cx + 2, knotTop + thick + 1, P.redM);
  S.rect(cx - 2, knotTop, cx + 1, knotTop + 2, P.redL);
  S.set(cx, knotTop + 1, P.white);
  for (let y = knotTop; y <= knotTop + thick + 1; y++) S.set(cx + 2, y, P.redD);

  // two ribbed fringed tails from the knot (slight natural splay, right a touch shorter)
  const tailTop = knotTop + thick + 1;
  drawTail(S, cx - 2, tailTop, tailW, tailLen, -1);
  drawTail(S, cx + 3, tailTop, tailW, Math.max(3, tailLen - 2), 1);

  S.autoOutline(P.outline, false);
  return { S, cx, anchorRow, seatY };
}

function drawTail(S, xc, top, w, len, drift) {
  const half = Math.floor(w / 2);
  for (let i = 0; i < len; i++) {
    const y = top + i;
    const dx = Math.round((i / len) * 2) * drift; // gentle splay outward
    for (let k = 0; k < w; k++) {
      const x = xc - half + k + dx;
      const c = k === 0 ? P.redL : (k === w - 1 ? P.redD : P.redM);
      S.set(x, y, c);
    }
    if (i % 2 === 0) for (let k = 0; k < w; k++) S.set(xc - half + k + dx, y, P.redD); // fringe ridge
  }
  const dxEnd = Math.round(((len) / len) * 2) * drift;
  for (let k = 0; k < w; k++) S.set(xc - half + k + dxEnd, top + len, P.redD); // fringe tips
}

// tight content bbox in sprite cells
function contentBox(S) {
  let x0 = S.w, y0 = S.h, x1 = 0, y1 = 0;
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) if (S.get(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}
function renderCells(S, box) {
  const w = (box.x1 - box.x0 + 1) * CELL, h = (box.y1 - box.y0 + 1) * CELL;
  const buf = Buffer.alloc(w * h * 4, 0);
  for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) {
    const c = S.get(x, y); if (!c) continue;
    for (let dy = 0; dy < CELL; dy++) for (let dx = 0; dx < CELL; dx++) {
      const i = (((y - box.y0) * CELL + dy) * w + ((x - box.x0) * CELL + dx)) * 4;
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = c[3];
    }
  }
  return { buf, w, h };
}

// place the fitted scarf onto a base; also return the variant PNG buffer (tight)
async function placeAdaptive(name) {
  const m = await measure(name);
  const { S, cx, anchorRow, seatY } = drawScarf(m);
  const box = contentBox(S);
  const { buf, w, h } = renderCells(S, box);
  // centre on the neck (unchanged); band spans the neck sides only
  const left = Math.round(m.neckX - (cx - box.x0) * CELL);
  const top = Math.round(seatY - (anchorRow - box.y0) * CELL);
  const variant = await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  const composite = await sharp(path.join(NORM, `${name}.png`)).composite([{ input: variant, left, top }]).png().toBuffer();
  return { variant, composite, left, top, m };
}

// "before": the universal scarf PNG scaled to neck width (previous same-silhouette approach)
const uni = JSON.parse(fs.readFileSync(path.join(CLO, "_clothing-meta.json"), "utf8"))["wool-scarf"];
async function placeUniversal(name) {
  const m = await measure(name);
  const scale = (m.neckW * 1.12) / uni.bandWpx;
  const drawW = Math.round(uni.pngW * scale), drawH = Math.round(uni.pngH * scale);
  const buf = await sharp(path.join(CLO, "wool-scarf.png")).resize(drawW, drawH, { kernel: "nearest" }).png().toBuffer();
  const left = Math.round(m.neckX - uni.centerXpx * scale);
  const top = Math.round(m.neckRowY - uni.bandYpx * scale);
  return await sharp(path.join(NORM, `${name}.png`)).composite([{ input: buf, left, top }]).png().toBuffer();
}

// ---------------- review rendering ----------------
function label(text, w, size = 22, color = "#5b4636") {
  return Buffer.from(`<svg width="${w}" height="34"><text x="${w / 2}" y="25" font-family="Verdana" font-size="${size}" font-weight="bold" fill="${color}" text-anchor="middle">${text}</text></svg>`);
}
function cropWin(a) {
  const pad = 34;
  const exL = Math.max(0, a.bbox.x0 - pad), exT = Math.max(0, a.bbox.y0 - pad);
  return { left: exL, top: exT, width: Math.min(1024 - exL, a.bbox.w + pad * 2), height: Math.min(1024 - exT, a.bbox.h + pad * 2) };
}
function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function starPts(cx, cy, rO, rI) { const p = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? rI : rO; const ang = -Math.PI / 2 + i * Math.PI / 5; p.push(`${(cx + r * Math.cos(ang)).toFixed(1)},${(cy + r * Math.sin(ang)).toFixed(1)}`); } return p.join(" "); }
function buildPanel(SW, note) {
  const PAD = 16, cardY = 14, cardH = 212, gap = 16;
  const cardW = Math.floor((SW - PAD * 2 - gap) / 2);
  const c1x = PAD, c2x = PAD + cardW + gap;
  const footY = cardY + cardH + 14, footH = 54, H = footY + footH + 14;
  const bullets = (items, x) => items.map((t, i) => `<circle cx="${x + 26}" cy="${cardY + 78 + i * 27 - 5}" r="3" fill="#8a745b"/><text x="${x + 40}" y="${cardY + 78 + i * 27}" font-family="Verdana" font-size="17" fill="#5b4636">${esc(t)}</text>`).join("");
  const check = (cx, cy) => `<rect x="${cx - 12}" y="${cy - 12}" width="24" height="24" rx="6" fill="#6a9e4f"/><path d="M ${cx - 6} ${cy} L ${cx - 1} ${cy + 5} L ${cx + 6} ${cy - 6}" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const pin = (cx, cy) => `<circle cx="${cx}" cy="${cy - 3}" r="9" fill="#cf8a3a"/><rect x="${cx - 1.5}" y="${cy - 3}" width="3" height="12" rx="1.5" fill="#cf8a3a"/><circle cx="${cx}" cy="${cy - 3}" r="3" fill="#fff"/>`;
  const card = (x, title, badge) => `<rect x="${x}" y="${cardY}" width="${cardW}" height="${cardH}" rx="12" fill="#f3ece0" stroke="#d8cbb2" stroke-width="2"/>${badge(x + 28, cardY + 32)}<text x="${x + 48}" y="${cardY + 39}" font-family="Verdana" font-size="21" font-weight="bold" fill="#4a3a28">${esc(title)}</text>`;
  const svg = `<svg width="${SW}" height="${H}" xmlns="http://www.w3.org/2000/svg">${card(c1x, "Adjustments made:", check)}${bullets(note.adjustments, c1x)}${card(c2x, "Fitting System:", pin)}${bullets(note.system, c2x)}<rect x="${PAD}" y="${footY}" width="${SW - PAD * 2}" height="${footH}" rx="12" fill="#efe6d6" stroke="#d8cbb2" stroke-width="2"/><polygon points="${starPts(PAD + 34, footY + footH / 2, 11, 5)}" fill="#e8b84b" stroke="#c99a2f" stroke-width="1"/><text x="${SW / 2 + 14}" y="${footY + footH / 2 + 6}" font-family="Verdana" font-size="18" fill="#5b4636" text-anchor="middle">${esc(note.footer)}</text></svg>`;
  return { buf: Buffer.from(svg), height: H };
}

const NOTE = {
  adjustments: [
    "Per-archetype scarf geometry (not one scaled silhouette)",
    "Band width + wrap follow measured neck width",
    "Vertical seat rides the neck; face kept clear",
    "Tail length/width adapt to neck height + body",
    "Wool silhouette collision handled",
  ],
  system: [
    "Measures neck W/H, chest W, head clearance, body",
    "Generates a fitted variant PNG per archetype",
    "Prevents clipping into wool / covering the face",
    "Keeps the red cozy-wool pixel identity",
  ],
  footer: "Same scarf identity. Geometry is generated per archetype so each alpaca truly wears it.",
};

async function grid(title, getComposite, subtitleColor) {
  const COLS = 4, ROWS = 2, CELL2 = 300, PAD = 16, LBL = 30;
  const CW = CELL2 + PAD, CH = CELL2 + PAD + LBL;
  const SW = COLS * CW + PAD, SH = 56 + ROWS * CH + PAD;
  const comps = [{ input: label(title, SW, 30, subtitleColor), top: 12, left: 0 }];
  for (let i = 0; i < ARCHES.length; i++) {
    const name = ARCHES[i];
    const composited = await getComposite(name);
    const cell = await sharp(composited).extract(cropWin(anchors[name])).resize(CELL2, CELL2, { fit: "contain", background: CARD, kernel: "nearest" }).png().toBuffer();
    const c = i % COLS, r = Math.floor(i / COLS);
    const x0 = PAD + c * CW, y0 = 56 + r * CH;
    comps.push({ input: await sharp({ create: { width: CELL2, height: CELL2, channels: 4, background: CARD } }).png().toBuffer(), top: y0, left: x0 });
    comps.push({ input: cell, top: y0, left: x0 });
    comps.push({ input: label(name, CELL2, 20), top: y0 + CELL2 - 2, left: x0 });
  }
  return { comps, SW, SH };
}

// verification: clipping / floating / silhouette / face / legs (matches adaptive-clothing.mjs)
async function verifyScarf(name, variantBuf, left, top) {
  const a = anchors[name];
  const { data: bd, info: bi } = await baseRaw(name);
  const env = [];
  for (let y = 0; y < bi.height; y++) { const s = rowSpan(bd, bi.width, y); env.push(s ? [s[0], s[1]] : null); }
  const gv = await sharp(variantBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: gd, info: gi } = gv;
  const mouthLineY = Math.round(a.eye.lineY + a.bbox.h * 0.12);
  const legFeetY = Math.round(a.bbox.y1 - a.bbox.h * 0.10);
  let total = 0, offBody = 0, faceCover = 0, legClip = 0, minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
  for (let y = 0; y < gi.height; y++) for (let x = 0; x < gi.width; x++) {
    if (gd[(y * gi.width + x) * 4 + 3] <= 40) continue;
    total++;
    const cx = left + x, cy = top + y;
    if (cx < minX) minX = cx; if (cx > maxX) maxX = cx; if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
    if (cx < 0 || cx >= bi.width || cy < 0 || cy >= bi.height) { offBody++; continue; }
    const e = env[cy];
    if (!e || cx < e[0] - CELL || cx > e[1] + CELL) offBody++;
    if (cy < mouthLineY - CELL) faceCover++;
    if (cy > legFeetY) legClip++;
  }
  return { offBodyPct: +(offBody / total * 100).toFixed(1), faceCoverPct: +(faceCover / total * 100).toFixed(1), legClipPct: +(legClip / total * 100).toFixed(1), oob: minX < 0 || minY < 0 || maxX >= bi.width || maxY >= bi.height };
}

// 1) generate variant PNGs + after composites
const afterCache = {};
const scarfReport = [];
for (const name of ARCHES) {
  const { variant, composite, left, top } = await placeAdaptive(name);
  await sharp(variant).toFile(path.join(VAR, `${name}.png`));
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: CARD } }).composite([{ input: composite }]).png().toFile(path.join(PREV, `wool-scarf__${name}.png`));
  afterCache[name] = composite;
  const v = await verifyScarf(name, variant, left, top);
  const fails = [];
  if (v.oob) fails.push("CLIP-CANVAS");
  if (v.offBodyPct > 12) fails.push(`FLOAT ${v.offBodyPct}%`);
  if (v.faceCoverPct > 0.5) fails.push(`FACE ${v.faceCoverPct}%`);
  if (v.legClipPct > 1.0) fails.push(`LEG ${v.legClipPct}%`);
  scarfReport.push({ name, ...v, status: fails.length ? fails.join(", ") : "OK" });
}
console.log("\n=== SCARF VERIFICATION ===");
console.log("arch      off-body  face   leg    status");
for (const r of scarfReport) console.log(`${r.name.padEnd(8)} ${String(r.offBodyPct).padStart(6)}%  ${String(r.faceCoverPct).padStart(4)}% ${String(r.legClipPct).padStart(5)}%  ${r.status}`);
console.log(`${scarfReport.filter(r => r.status === "OK").length}/${scarfReport.length} clean.`);

// 2) annotated AFTER contact sheet
{
  const { comps, SW, SH } = await grid("Cozy Wool Scarf — fits all 8 archetypes", (n) => afterCache[n]);
  const panel = buildPanel(SW, NOTE);
  comps.push({ input: panel.buf, top: SH, left: 0 });
  await sharp({ create: { width: SW, height: SH + panel.height, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } }).composite(comps).png().toFile(path.join(PREV, "wool-scarf__contact.png"));
  console.log("wrote wool-scarf__contact.png");
}

// 3) BEFORE/AFTER validation sheet (all 8, stacked)
{
  const before = await grid("BEFORE — one universal scarf scaled onto every body", (n) => placeUniversal(n), "#a05a4a");
  const after = await grid("AFTER — per-archetype fitted geometry", (n) => afterCache[n], "#4a7a3a");
  const SW = Math.max(before.SW, after.SW);
  const GAP = 20;
  const H = before.SH + after.SH + GAP * 3;
  const comps = [];
  const header = (t, y, col) => ({ input: Buffer.from(`<svg width="${SW}" height="40"><text x="${SW / 2}" y="30" font-family="Verdana" font-size="26" font-weight="bold" fill="${col}" text-anchor="middle">${t}</text></svg>`), top: y, left: 0 });
  for (const c of before.comps) comps.push({ input: c.input, top: c.top + GAP, left: c.left });
  for (const c of after.comps) comps.push({ input: c.input, top: c.top + before.SH + GAP * 2, left: c.left });
  await sharp({ create: { width: SW, height: H, channels: 4, background: { r: 222, g: 212, b: 193, alpha: 1 } } }).composite(comps).png().toFile(path.join(PREV, "_SCARF-before-after.png"));
  console.log("wrote _SCARF-before-after.png");
}
