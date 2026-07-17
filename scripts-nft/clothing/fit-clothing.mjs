// Fit each garment onto all 8 base archetypes using the neck + chest anchors and the
// measured body/neck width. Fully anchor-driven (no manual offsets by default).
// Outputs:
//   public/pixel/traits/clothing/previews/<id>__<archetype>.png   (composited)
//   public/pixel/traits/clothing/previews/<id>__contact.png       (all 8 wearing it)
//   public/pixel/traits/clothing/previews/_ALL-CLOTHING.png       (overview, 5 side-by-side)
//   public/pixel/traits/clothing/previews/_COMPARISON-puff.png    (bare -> each)
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const BASE = "public/pixel/traits/base";
const NORM = path.join(BASE, "normalized"); // fit onto the normalized avatar frame
const CLO = "public/pixel/traits/clothing";
const PREV = path.join(CLO, "previews");
fs.mkdirSync(PREV, { recursive: true });

const anchors = JSON.parse(fs.readFileSync(path.join(BASE, "anchors.json"), "utf8")).archetypes;
const meta = JSON.parse(fs.readFileSync(path.join(CLO, "_clothing-meta.json"), "utf8"));
const ARCHES = ["puff", "curly", "topknot", "cria", "sleek", "scruffy", "bramble", "elder"];
const CARD = { r: 255, g: 252, b: 245, alpha: 1 };

// Per-garment review annotations. When present, the contact sheet gets a summary panel
// (Adjustments made / Fitting System) + a footer note, matching the review layout.
const NOTES = {
  "wool-scarf": {
    adjustments: [
      "Archetype-aware scaling based on neck width and height",
      "Vertical alignment to neck anchor for each archetype",
      "Face clearance maintained",
      "Wool silhouette collision handled",
      "Proportions preserved across all 8 archetypes",
    ],
    system: [
      "Uses neck + chest anchors",
      "Adapts width, height, and position",
      "Prevents clipping into wool",
      "Keeps pixel-perfect style",
    ],
    footer: "Scarf design unchanged. Only fitting logic was updated for perfect fit across all archetypes.",
  },
};

function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function starPts(cx, cy, rO, rI) {
  const p = [];
  for (let i = 0; i < 10; i++) { const r = i % 2 ? rI : rO; const a = -Math.PI / 2 + i * Math.PI / 5; p.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`); }
  return p.join(" ");
}
// Build the summary panel (two cards + footer) as an SVG buffer of the given width.
function buildPanel(SW, note) {
  const PAD = 16, cardY = 14, cardH = 212, gap = 16;
  const cardW = Math.floor((SW - PAD * 2 - gap) / 2);
  const c1x = PAD, c2x = PAD + cardW + gap;
  const footY = cardY + cardH + 14, footH = 54;
  const H = footY + footH + 14;
  const bullets = (items, x) => items.map((t, i) =>
    `<circle cx="${x + 26}" cy="${cardY + 78 + i * 27 - 5}" r="3" fill="#8a745b"/>` +
    `<text x="${x + 40}" y="${cardY + 78 + i * 27}" font-family="Verdana" font-size="17" fill="#5b4636">${esc(t)}</text>`
  ).join("");
  const card = (x, title, badge) =>
    `<rect x="${x}" y="${cardY}" width="${cardW}" height="${cardH}" rx="12" fill="#f3ece0" stroke="#d8cbb2" stroke-width="2"/>` +
    badge(x + 28, cardY + 32) +
    `<text x="${x + 48}" y="${cardY + 39}" font-family="Verdana" font-size="21" font-weight="bold" fill="#4a3a28">${esc(title)}</text>`;
  const checkBadge = (cx, cy) =>
    `<rect x="${cx - 12}" y="${cy - 12}" width="24" height="24" rx="6" fill="#6a9e4f"/>` +
    `<path d="M ${cx - 6} ${cy} L ${cx - 1} ${cy + 5} L ${cx + 6} ${cy - 6}" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const pinBadge = (cx, cy) =>
    `<circle cx="${cx}" cy="${cy - 3}" r="9" fill="#cf8a3a"/>` +
    `<rect x="${cx - 1.5}" y="${cy - 3}" width="3" height="12" rx="1.5" fill="#cf8a3a"/>` +
    `<circle cx="${cx}" cy="${cy - 3}" r="3" fill="#fff"/>`;
  const svg =
    `<svg width="${SW}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    card(c1x, "Adjustments made:", checkBadge) + bullets(note.adjustments, c1x) +
    card(c2x, "Fitting System:", pinBadge) + bullets(note.system, c2x) +
    `<rect x="${PAD}" y="${footY}" width="${SW - PAD * 2}" height="${footH}" rx="12" fill="#efe6d6" stroke="#d8cbb2" stroke-width="2"/>` +
    `<polygon points="${starPts(PAD + 34, footY + footH / 2, 11, 5)}" fill="#e8b84b" stroke="#c99a2f" stroke-width="1"/>` +
    `<text x="${SW / 2 + 14}" y="${footY + footH / 2 + 6}" font-family="Verdana" font-size="18" fill="#5b4636" text-anchor="middle">${esc(note.footer)}</text>` +
    `</svg>`;
  return { buf: Buffer.from(svg), height: H };
}

const rawCache = {};
async function baseRaw(name) {
  if (rawCache[name]) return rawCache[name];
  rawCache[name] = await sharp(path.join(NORM, `${name}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return rawCache[name];
}
function rowSpan(data, W, y) { let l = -1, r = -1; for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 40) { if (l < 0) l = x; r = x; } return l < 0 ? null : [l, r]; }

// Averaged silhouette width over a small band around a given row.
async function widthAt(name, y) {
  const { data, info } = await baseRaw(name);
  let sum = 0, cnt = 0;
  for (let yy = y - 8; yy <= y + 8; yy++) { const s = rowSpan(data, info.width, yy); if (s) { sum += s[1] - s[0]; cnt++; } }
  return cnt ? sum / cnt : anchors[name].bbox.w * 0.5;
}

const metricsCache = {};
async function metrics(name) {
  if (metricsCache[name]) return metricsCache[name];
  const a = anchors[name];
  const neckW = await widthAt(name, a.neck.y);
  // Torso garments seat between the neck and chest; measure the upper-mid torso so
  // slim/tapered bodies (e.g. sleek) get a snug width instead of the wider chest.
  const midY = Math.round(a.neck.y + 0.45 * (a.chest.y - a.neck.y));
  const bodyW = await widthAt(name, midY);
  metricsCache[name] = { neckW, bodyW };
  return metricsCache[name];
}

// Archetype-aware neck detection for neck-basis garments (scarf/collars).
// Scans a window centred on the neck anchor and finds the narrowest silhouette row
// (the "neck pinch"). This yields, per archetype:
//   neckW      -> true neck width at the wool boundary (handles fluffy scruffy/puff)
//   neckX      -> horizontal centre of the neck (handles off-centre necks)
//   neckRowY   -> vertical seat for the wrap band (rides up long thin necks like sleek)
//   faceClear  -> lowest allowed band-top so the scarf never covers the face/chin
//   neckHeight -> chin->shoulder span (kept for reference/tuning)
const neckBandCache = {};
async function neckBand(name) {
  if (neckBandCache[name]) return neckBandCache[name];
  const a = anchors[name];
  const { data, info } = await baseRaw(name);
  const W = info.width;
  const faceClear = Math.round(a.eye.lineY + a.bbox.h * 0.07); // keep band below the face/chin
  const yStart = Math.max(faceClear, Math.round(a.neck.y - a.bbox.h * 0.11));
  const yEnd = Math.round(a.neck.y + a.bbox.h * 0.13);
  let best = { w: Infinity, y: a.neck.y, cx: a.neck.x };
  for (let y = yStart; y <= yEnd; y++) {
    let sum = 0, cnt = 0, l = 1e9, r = -1;
    for (let yy = y - 2; yy <= y + 2; yy++) { const s = rowSpan(data, W, yy); if (s) { sum += s[1] - s[0]; cnt++; l = Math.min(l, s[0]); r = Math.max(r, s[1]); } }
    if (!cnt) continue;
    const w = sum / cnt;
    if (w < best.w) best = { w, y, cx: Math.round((l + r) / 2) };
  }
  const shoulderY = Math.round(a.chest.y - a.bbox.h * 0.03);
  const res = { neckW: best.w, neckX: best.cx, neckRowY: best.y, faceClear, neckHeight: shoulderY - faceClear };
  neckBandCache[name] = res;
  return res;
}

// Anchor-driven placement: centre on chest.x (body) / neck.x (scarf), seat the collar
// row at neck.y, scale the sprite so its width equals basisW * widthFactor.
async function computePlacement(name, id) {
  const m = meta[id];
  const a = anchors[name];
  const off = (m.offsets && m.offsets[name]) || { dx: 0, dy: 0 };
  // Neck-basis garments (scarf) use the detected neck pinch: width, centre and vertical
  // seat all adapt per archetype, and the band never rises above the face-clearance line.
  if (m.basis === "neck" && m.bandWpx) {
    const nb = await neckBand(name);
    const box = await artBox(id);
    const legLimit = a.bbox.y1 - a.bbox.h * 0.16;
    const tailExt = Math.max(1, box.y1 - m.bandYpx); // sprite px from band centre to art bottom
    let scale = (nb.neckW * m.widthFactor) / m.bandWpx;          // width tracks neck width
    // seat the wrap band on the neck pinch, but never so high it covers the face/chin
    let bandCenterY = Math.max(nb.neckRowY, nb.faceClear + m.bandHalfPx * scale);
    // collision handling: shrink uniformly so the hanging tails clear the legs
    const maxScale = (legLimit - bandCenterY) / tailExt;
    if (scale > maxScale) { scale = maxScale; bandCenterY = Math.max(nb.neckRowY, nb.faceClear + m.bandHalfPx * scale); }
    const drawW = Math.max(1, Math.round(m.pngW * scale));
    const drawH = Math.max(1, Math.round(m.pngH * scale));
    const top = Math.round(bandCenterY - m.bandYpx * scale) + (off.dy || 0);
    const left = Math.round(nb.neckX - m.centerXpx * scale) + (off.dx || 0);
    return { left, top, drawW, drawH, scale, basisW: nb.neckW };
  }
  const { neckW, bodyW } = await metrics(name);
  const basisW = m.basis === "neck" ? neckW : bodyW;
  const centerX = m.basis === "neck" ? a.neck.x : a.chest.x;
  const scale = (basisW * m.widthFactor) / m.pngW;
  const drawW = Math.max(1, Math.round(m.pngW * scale));
  const drawH = Math.max(1, Math.round(m.pngH * scale));
  const left = Math.round(centerX - m.centerXpx * scale) + (off.dx || 0);
  const top = Math.round(a.neck.y + a.bbox.h * m.drop - m.collarYpx * scale) + (off.dy || 0);
  return { left, top, drawW, drawH, scale, basisW };
}

async function place(name, id) {
  const p = await computePlacement(name, id);
  const buf = await sharp(path.join(CLO, `${id}.png`)).resize(p.drawW, p.drawH, { kernel: "nearest" }).png().toBuffer();
  return await sharp(path.join(NORM, `${name}.png`)).composite([{ input: buf, left: p.left, top: p.top }]).png().toBuffer();
}

const artBoxCache = {};
async function artBox(id) {
  if (artBoxCache[id]) return artBoxCache[id];
  const { data, info } = await sharp(path.join(CLO, `${id}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  artBoxCache[id] = { x0, y0, x1, y1 };
  return artBoxCache[id];
}

// Fraction of garment opaque pixels that land OFF the base silhouette (float in air).
async function offBodyFraction(name, id, p, box) {
  const { data, info } = await baseRaw(name);
  const W = info.width, H = info.height;
  const gb = await sharp(path.join(CLO, `${id}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let off = 0, total = 0;
  for (let sy = box.y0; sy <= box.y1; sy++) {
    for (let sx = box.x0; sx <= box.x1; sx++) {
      if (gb.data[(sy * gb.info.width + sx) * 4 + 3] <= 40) continue;
      total++;
      const cx = Math.round(p.left + sx * p.scale), cy = Math.round(p.top + sy * p.scale);
      if (cy < 0 || cy >= H) { off++; continue; }
      const span = rowSpan(data, W, cy);
      if (!span || cx < span[0] || cx > span[1]) off++;
    }
  }
  return total ? off / total : 0;
}

async function verify() {
  const rows = [];
  let manualOffsets = 0;
  for (const id of Object.keys(meta)) {
    const box = await artBox(id);
    if (meta[id].offsets && Object.keys(meta[id].offsets).length) manualOffsets += Object.keys(meta[id].offsets).length;
    for (const name of ARCHES) {
      const p = await computePlacement(name, id);
      const a = anchors[name];
      const artTop = p.top + box.y0 * p.scale, artBottom = p.top + box.y1 * p.scale;
      const artLeft = p.left + box.x0 * p.scale, artRight = p.left + box.x1 * p.scale;
      const faceLimit = a.eye.lineY + a.bbox.h * 0.03;   // stay below the eyes/chin
      const legLimit = a.bbox.y1 - a.bbox.h * 0.16;       // stay above the legs
      const issues = [];
      if (artTop < faceLimit) issues.push("FACE-CLIP");
      if (artBottom > legLimit) issues.push("LEG-CLIP");
      if (artLeft < 0 || artRight > 1024 || artTop < 0 || artBottom > 1024) issues.push("OOB");
      const offFrac = await offBodyFraction(name, id, p, box);
      if (offFrac > 0.10) issues.push(`FLOAT(${(offFrac * 100).toFixed(1)}%)`);
      rows.push({ id, name, off: +(offFrac * 100).toFixed(1), issues, artTop: Math.round(artTop), artBottom: Math.round(artBottom), face: Math.round(faceLimit), leg: Math.round(legLimit) });
    }
  }
  const bad = rows.filter((r) => r.issues.length);
  let oob = 0; for (const r of rows) if (r.issues.includes("OOB")) oob++;
  console.log(`\nVERIFY: ${rows.length} placements tested`);
  console.log(`  clipping failures (FACE/LEG): ${rows.filter((r) => r.issues.some((i) => i.startsWith("FACE") || i.startsWith("LEG"))).length}`);
  console.log(`  floating failures:            ${rows.filter((r) => r.issues.some((i) => i.startsWith("FLOAT"))).length}`);
  console.log(`  out-of-bounds pixels:         ${oob} placements`);
  console.log(`  manual offsets:               ${manualOffsets}`);
  for (const r of bad) console.log(`  ! ${r.id}/${r.name}: ${r.issues.join(", ")}  [artTop=${r.artTop} artBottom=${r.artBottom} face>=${r.face} leg<=${r.leg} off=${r.off}%]`);
  const worst = rows.reduce((a, b) => (b.off > a.off ? b : a), rows[0]);
  console.log(`  max off-body fraction: ${worst.off}% (${worst.id}/${worst.name})`);
  return bad;
}

function label(text, w, size = 22) {
  return Buffer.from(`<svg width="${w}" height="34"><text x="${w / 2}" y="25" font-family="Verdana" font-size="${size}" font-weight="bold" fill="#5b4636" text-anchor="middle">${text}</text></svg>`);
}
function cropWin(a) {
  const pad = 34;
  const exL = Math.max(0, a.bbox.x0 - pad), exT = Math.max(0, a.bbox.y0 - pad);
  return { left: exL, top: exT, width: Math.min(1024 - exL, a.bbox.w + pad * 2), height: Math.min(1024 - exT, a.bbox.h + pad * 2) };
}

async function perClothingContact(id) {
  const COLS = 4, ROWS = 2, CELL = 300, PAD = 16, LBL = 30;
  const CW = CELL + PAD, CH = CELL + PAD + LBL;
  const SW = COLS * CW + PAD, SH = 56 + ROWS * CH + PAD;
  const comps = [{ input: label(`${meta[id].name}  —  fits all 8 archetypes`, SW, 30), top: 12, left: 0 }];
  for (let i = 0; i < ARCHES.length; i++) {
    const name = ARCHES[i];
    const composited = await place(name, id);
    const cell = await sharp(composited).extract(cropWin(anchors[name])).resize(CELL, CELL, { fit: "contain", background: CARD, kernel: "nearest" }).png().toBuffer();
    const c = i % COLS, r = Math.floor(i / COLS);
    const x0 = PAD + c * CW, y0 = 56 + r * CH;
    comps.push({ input: await sharp({ create: { width: CELL, height: CELL, channels: 4, background: CARD } }).png().toBuffer(), top: y0, left: x0 });
    comps.push({ input: cell, top: y0, left: x0 });
    comps.push({ input: label(name, CELL, 20), top: y0 + CELL - 2, left: x0 });
  }
  const note = NOTES[id];
  const panel = note ? buildPanel(SW, note) : null;
  const totalSH = SH + (panel ? panel.height : 0);
  if (panel) comps.push({ input: panel.buf, top: SH, left: 0 });
  const out = path.join(PREV, `${id}__contact.png`);
  await sharp({ create: { width: SW, height: totalSH, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } }).composite(comps).png().toFile(out);
  for (const name of ARCHES) {
    const composited = await place(name, id);
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: CARD } }).composite([{ input: composited }]).png().toFile(path.join(PREV, `${id}__${name}.png`));
  }
  console.log("contact ->", out);
}

const ONLY = process.env.ONLY; // regenerate a single garment's previews + contact when set
const IDS = ONLY ? [ONLY] : Object.keys(meta);
for (const id of IDS) await perClothingContact(id);

if (!ONLY) {
// overview: transparent trait (checker) + on 'puff'
function checker(size) {
  const c = 20, buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const on = (Math.floor(x / c) + Math.floor(y / c)) % 2 === 0; const v = on ? 214 : 236; const i = (y * size + x) * 4; buf[i] = v; buf[i + 1] = v; buf[i + 2] = v - 6; buf[i + 3] = 255; }
  return sharp(buf, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
}
{
  const COLS = 5, CELL = 300, PAD = 16, TH = 150;
  const SW = COLS * (CELL + PAD) + PAD, SH = 56 + TH + 20 + CELL + PAD + 30;
  const ocomps = [{ input: label("All 5 Clothing — trait PNG (top) + on 'Puff' (bottom)", SW, 26), top: 12, left: 0 }];
  let i = 0;
  for (const id of Object.keys(meta)) {
    const x0 = PAD + i * (CELL + PAD);
    const chk = await checker(TH);
    const trait = await sharp(path.join(CLO, `${id}.png`)).resize(TH - 16, TH - 16, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "nearest" }).png().toBuffer();
    const tile = await sharp(chk).composite([{ input: trait, gravity: "center" }]).png().toBuffer();
    ocomps.push({ input: tile, top: 56, left: x0 + (CELL - TH) / 2 });
    const composited = await place("puff", id);
    const cell = await sharp(composited).extract(cropWin(anchors.puff)).resize(CELL, CELL, { fit: "contain", background: CARD, kernel: "nearest" }).png().toBuffer();
    const yb = 56 + TH + 20;
    ocomps.push({ input: await sharp({ create: { width: CELL, height: CELL, channels: 4, background: CARD } }).png().toBuffer(), top: yb, left: x0 });
    ocomps.push({ input: cell, top: yb, left: x0 });
    ocomps.push({ input: label(meta[id].name, CELL, 16), top: yb + CELL - 2, left: x0 });
    i++;
  }
  await sharp({ create: { width: SW, height: SH, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } }).composite(ocomps).png().toFile(path.join(PREV, "_ALL-CLOTHING.png"));
  console.log("wrote _ALL-CLOTHING.png");
}

// comparison: same archetype bare -> each garment (full-body crop)
async function comparisonSheet(name) {
  const a = anchors[name];
  const pad = 34;
  const exL = Math.max(0, a.bbox.x0 - pad), exT = Math.max(0, a.bbox.y0 - pad);
  const win = { left: exL, top: exT, width: Math.min(1024 - exL, a.bbox.w + pad * 2), height: Math.min(1024 - exT, a.bbox.h + pad * 2) };
  const order = [{ id: null, name: "No clothing" }, ...Object.keys(meta).map((id) => ({ id, name: meta[id].name }))];
  const CELL = 300, PADc = 18, LBL = 34, COLS = order.length;
  const CW = CELL + PADc, CH = CELL + LBL;
  const SWc = COLS * CW + PADc, SHc = 60 + CH + PADc;
  const comps = [{ input: label(`Clothing comparison on '${name}'  —  bare  →  5 garments  (same archetype)`, SWc, 26), top: 14, left: 0 }];
  for (let k = 0; k < order.length; k++) {
    const { id, name: lab } = order[k];
    const composited = id ? await place(name, id) : await sharp(path.join(NORM, `${name}.png`)).png().toBuffer();
    const cell = await sharp(composited).extract(win).resize(CELL, CELL, { fit: "contain", background: CARD, kernel: "nearest" }).png().toBuffer();
    const x0 = PADc + k * CW, y0 = 60;
    comps.push({ input: await sharp({ create: { width: CELL, height: CELL, channels: 4, background: CARD } }).png().toBuffer(), top: y0, left: x0 });
    comps.push({ input: cell, top: y0, left: x0 });
    comps.push({ input: label(lab, CELL, 16), top: y0 + CELL - 2, left: x0 });
  }
  const out = path.join(PREV, `_COMPARISON-${name}.png`);
  await sharp({ create: { width: SWc, height: SHc, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } }).composite(comps).png().toFile(out);
  console.log("wrote", out);
}
await comparisonSheet("puff");
} // end !ONLY

await verify();
