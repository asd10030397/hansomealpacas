// Fit each necklace onto all 8 base archetypes using the neck + chest anchors and
// the measured neck width. Fully anchor-driven (no manual offsets).
// Outputs:
//   public/pixel/traits/necklaces/previews/<id>__<archetype>.png   (composited)
//   public/pixel/traits/necklaces/previews/<id>__contact.png       (all 8 wearing it)
//   public/pixel/traits/necklaces/previews/_ALL-NECKLACES.png      (overview, 5 side-by-side)
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const BASE = "public/pixel/traits/base";
const NORM = path.join(BASE, "normalized"); // fit onto normalized avatar frame
const NECK = "public/pixel/traits/necklaces";
const PREV = path.join(NECK, "previews");
fs.mkdirSync(PREV, { recursive: true });

const anchors = JSON.parse(fs.readFileSync(path.join(BASE, "anchors.json"), "utf8")).archetypes;
const meta = JSON.parse(fs.readFileSync(path.join(NECK, "_necklaces-meta.json"), "utf8"));
const ARCHES = ["puff", "curly", "topknot", "cria", "sleek", "scruffy", "bramble", "elder"];
const CARD = { r: 255, g: 252, b: 245, alpha: 1 };

// Measure the front width available for a necklace: silhouette width around the neck
// anchor row (averaged over a small band so a single stray row can't skew it).
const rawCache = {};
async function baseRaw(name) {
  if (rawCache[name]) return rawCache[name];
  const r = await sharp(path.join(NORM, `${name}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  rawCache[name] = r;
  return r;
}
function rowSpan(data, W, y) { let l = -1, r = -1; for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 40) { if (l < 0) l = x; r = x; } return l < 0 ? null : [l, r]; }

const neckCache = {};
async function neckMetrics(name) {
  if (neckCache[name]) return neckCache[name];
  const { data, info } = await baseRaw(name);
  const W = info.width;
  const a = anchors[name];
  let sum = 0, cnt = 0;
  for (let y = a.neck.y - 6; y <= a.neck.y + 10; y++) { const s = rowSpan(data, W, y); if (s) { sum += s[1] - s[0]; cnt++; } }
  const neckW = cnt ? sum / cnt : a.bbox.w * 0.45;
  const res = { W, H: info.height, neckW };
  neckCache[name] = res;
  return res;
}

// Fully anchor-driven placement: centre on neck.x, seat the cord row at neck.y,
// scale the sprite so its width equals neckW * widthFactor.
async function computePlacement(name, id) {
  const m = meta[id];
  const a = anchors[name];
  const { neckW } = await neckMetrics(name);
  const scale = (neckW * m.widthFactor) / m.pngW;
  const drawW = Math.max(1, Math.round(m.pngW * scale));
  const drawH = Math.max(1, Math.round(m.pngH * scale));
  const off = (m.offsets && m.offsets[name]) || { dx: 0, dy: 0 };
  const left = Math.round(a.neck.x - m.centerXpx * scale) + (off.dx || 0);
  const top = Math.round(a.neck.y + a.bbox.h * m.sink - m.neckYpx * scale) + (off.dy || 0);
  return { left, top, drawW, drawH, scale, neckW };
}

async function place(name, id) {
  const p = await computePlacement(name, id);
  const buf = await sharp(path.join(NECK, `${id}.png`)).resize(p.drawW, p.drawH, { kernel: "nearest" }).png().toBuffer();
  return await sharp(path.join(NORM, `${name}.png`))
    .composite([{ input: buf, left: p.left, top: p.top }]).png().toBuffer();
}

// Opaque bounding box of a necklace sprite within its own PNG (ignore transparent pad).
const artBoxCache = {};
async function artBox(id) {
  if (artBoxCache[id]) return artBoxCache[id];
  const { data, info } = await sharp(path.join(NECK, `${id}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 16) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const box = { x0, y0, x1, y1 };
  artBoxCache[id] = box;
  return box;
}

// Count necklace opaque pixels that fall OUTSIDE the base silhouette (would float in
// air beside the body). Uses the composited alpha vs base alpha is overkill; instead
// sample the drawn art bbox against the base silhouette span per row.
async function offBodyPixels(name, id, p, box) {
  const { data, info } = await baseRaw(name);
  const W = info.width;
  const nb = await sharp(path.join(NECK, `${id}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let off = 0;
  for (let sy = box.y0; sy <= box.y1; sy++) {
    const cy = Math.round(p.top + sy * p.scale);
    if (cy < 0 || cy >= info.height) continue;
    const span = rowSpan(data, W, cy);
    for (let sx = box.x0; sx <= box.x1; sx++) {
      if (nb.data[(sy * nb.info.width + sx) * 4 + 3] <= 40) continue; // transparent sprite pixel
      const cx = Math.round(p.left + sx * p.scale);
      if (!span || cx < span[0] || cx > span[1]) off++;
    }
  }
  return off;
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
      const artTop = p.top + box.y0 * p.scale;
      const artBottom = p.top + box.y1 * p.scale;
      const artLeft = p.left + box.x0 * p.scale;
      const artRight = p.left + box.x1 * p.scale;
      const faceLimit = a.eye.lineY + a.bbox.h * 0.04;   // stay below the eyes/chin
      const legLimit = a.bbox.y1 - a.bbox.h * 0.20;       // stay above the legs
      const issues = [];
      if (artTop < faceLimit) issues.push("FACE-CLIP");
      if (artBottom > legLimit) issues.push("LEG-CLIP");
      if (artLeft < 0 || artRight > 1024 || artTop < 0 || artBottom > 1024) issues.push("OOB");
      const off = await offBodyPixels(name, id, p, box);
      const offFrac = off / Math.max(1, (box.x1 - box.x0 + 1) * (box.y1 - box.y0 + 1));
      if (offFrac > 0.06) issues.push(`FLOAT(${(offFrac * 100).toFixed(1)}%)`);
      rows.push({ id, name, widthRatio: +(p.drawW / p.neckW).toFixed(3), wf: meta[id].widthFactor, off, issues,
        artTop: Math.round(artTop), artBottom: Math.round(artBottom), faceLimit: Math.round(faceLimit), legLimit: Math.round(legLimit) });
    }
  }
  const bad = rows.filter((r) => r.issues.length);
  let oob = 0; for (const r of rows) if (r.issues.includes("OOB")) oob++;
  console.log(`\nVERIFY: ${rows.length} placements tested`);
  console.log(`  clipping failures (FACE/LEG): ${rows.filter((r) => r.issues.some((i) => i.startsWith("FACE") || i.startsWith("LEG"))).length}`);
  console.log(`  floating failures:            ${rows.filter((r) => r.issues.some((i) => i.startsWith("FLOAT"))).length}`);
  console.log(`  out-of-bounds pixels:         ${oob} placements`);
  console.log(`  manual offsets:               ${manualOffsets}`);
  for (const r of bad) console.log(`  ! ${r.id}/${r.name}: ${r.issues.join(", ")}  [artTop=${r.artTop} artBottom=${r.artBottom} face>=${r.faceLimit} leg<=${r.legLimit} off=${r.off}]`);
  for (const id of Object.keys(meta)) {
    const rs = rows.filter((r) => r.id === id);
    const consistent = rs.every((r) => Math.abs(r.widthRatio - r.wf) < 0.02);
    console.log(`  scale ${id.padEnd(16)} ${consistent ? "consistent" : "INCONSISTENT"} (wf=${meta[id].widthFactor})`);
  }
  return bad;
}

function label(text, w, size = 22) {
  return Buffer.from(`<svg width="${w}" height="34"><text x="${w / 2}" y="25" font-family="Verdana" font-size="${size}" font-weight="bold" fill="#5b4636" text-anchor="middle">${text}</text></svg>`);
}

// crop window focused on neck/chest (so the necklace is clearly visible)
function cropWin(a) {
  const pad = 40;
  const exL = Math.max(0, a.bbox.x0 - pad), exT = Math.max(0, a.bbox.y0 - pad);
  return { left: exL, top: exT, width: Math.min(1024 - exL, a.bbox.w + pad * 2), height: Math.min(1024 - exT, a.bbox.h + pad * 2) };
}

async function perNecklaceContact(id) {
  const COLS = 4, ROWS = 2, CELL = 300, PAD = 16, LBL = 30;
  const CW = CELL + PAD, CH = CELL + PAD + LBL;
  const SW = COLS * CW + PAD, SH = 56 + ROWS * CH + PAD;
  const comps = [{ input: label(`${meta[id].name}  —  fits all 8 archetypes`, SW, 30), top: 12, left: 0 }];
  for (let i = 0; i < ARCHES.length; i++) {
    const name = ARCHES[i];
    const composited = await place(name, id);
    const cell = await sharp(composited).extract(cropWin(anchors[name]))
      .resize(CELL, CELL, { fit: "contain", background: CARD, kernel: "nearest" }).png().toBuffer();
    const c = i % COLS, r = Math.floor(i / COLS);
    const x0 = PAD + c * CW, y0 = 56 + r * CH;
    comps.push({ input: await sharp({ create: { width: CELL, height: CELL, channels: 4, background: CARD } }).png().toBuffer(), top: y0, left: x0 });
    comps.push({ input: cell, top: y0, left: x0 });
    comps.push({ input: label(name, CELL, 20), top: y0 + CELL - 2, left: x0 });
  }
  const out = path.join(PREV, `${id}__contact.png`);
  await sharp({ create: { width: SW, height: SH, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } })
    .composite(comps).png().toFile(out);
  for (const name of ARCHES) {
    const composited = await place(name, id);
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: CARD } })
      .composite([{ input: composited }]).png().toFile(path.join(PREV, `${id}__${name}.png`));
  }
  console.log("contact ->", out);
}

for (const id of Object.keys(meta)) await perNecklaceContact(id);

// overview: the transparent trait PNG + one representative archetype (puff) wearing each
const COLS = 5, CELL = 300, PAD = 16, TH = 150;
const SW = COLS * (CELL + PAD) + PAD, SH = 56 + TH + 20 + CELL + PAD + 30;
const ocomps = [{ input: label("All 5 Neck Accessories — trait PNG (top) + on 'Puff' (bottom)", SW, 26), top: 12, left: 0 }];
let i = 0;
function checker(size) {
  const c = 20, buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const on = (Math.floor(x / c) + Math.floor(y / c)) % 2 === 0; const v = on ? 214 : 236; const idx = (y * size + x) * 4; buf[idx] = v; buf[idx + 1] = v; buf[idx + 2] = v - 6; buf[idx + 3] = 255; }
  return sharp(buf, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
}
for (const id of Object.keys(meta)) {
  const x0 = PAD + i * (CELL + PAD);
  // top: transparent trait on a checker so it reads
  const chk = await checker(TH);
  const trait = await sharp(path.join(NECK, `${id}.png`)).resize(TH - 16, TH - 16, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "nearest" }).png().toBuffer();
  const tile = await sharp(chk).composite([{ input: trait, gravity: "center" }]).png().toBuffer();
  ocomps.push({ input: tile, top: 56, left: x0 + (CELL - TH) / 2 });
  // bottom: on puff
  const composited = await place("puff", id);
  const cell = await sharp(composited).extract(cropWin(anchors.puff)).resize(CELL, CELL, { fit: "contain", background: CARD, kernel: "nearest" }).png().toBuffer();
  const yb = 56 + TH + 20;
  ocomps.push({ input: await sharp({ create: { width: CELL, height: CELL, channels: 4, background: CARD } }).png().toBuffer(), top: yb, left: x0 });
  ocomps.push({ input: cell, top: yb, left: x0 });
  ocomps.push({ input: label(meta[id].name, CELL, 17), top: yb + CELL - 2, left: x0 });
  i++;
}
await sharp({ create: { width: SW, height: SH, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } })
  .composite(ocomps).png().toFile(path.join(PREV, "_ALL-NECKLACES.png"));
console.log("wrote _ALL-NECKLACES.png");

// comparison sheet: the SAME archetype shown bare, then wearing each necklace, so
// proportions + visual impact are directly comparable (full-body crop).
async function comparisonSheet(name) {
  const a = anchors[name];
  const pad = 34;
  const exL = Math.max(0, a.bbox.x0 - pad), exT = Math.max(0, a.bbox.y0 - pad);
  const win = { left: exL, top: exT, width: Math.min(1024 - exL, a.bbox.w + pad * 2), height: Math.min(1024 - exT, a.bbox.h + pad * 2) };
  const order = [{ id: null, name: "No necklace" }, ...Object.keys(meta).map((id) => ({ id, name: meta[id].name }))];
  const CELL = 300, PADc = 18, LBL = 34, COLS = order.length;
  const CW = CELL + PADc, CH = CELL + LBL;
  const SWc = COLS * CW + PADc, SHc = 60 + CH + PADc;
  const comps = [{ input: label(`Neck Accessories comparison on '${name}'  —  bare  →  5 accessories  (same archetype)`, SWc, 26), top: 14, left: 0 }];
  for (let k = 0; k < order.length; k++) {
    const { id, name: lab } = order[k];
    const composited = id ? await place(name, id) : await sharp(path.join(NORM, `${name}.png`)).png().toBuffer();
    const cell = await sharp(composited).extract(win).resize(CELL, CELL, { fit: "contain", background: CARD, kernel: "nearest" }).png().toBuffer();
    const x0 = PADc + k * CW, y0 = 60;
    comps.push({ input: await sharp({ create: { width: CELL, height: CELL, channels: 4, background: CARD } }).png().toBuffer(), top: y0, left: x0 });
    comps.push({ input: cell, top: y0, left: x0 });
    comps.push({ input: label(lab, CELL, 17), top: y0 + CELL - 2, left: x0 });
  }
  const out = path.join(PREV, `_COMPARISON-${name}.png`);
  await sharp({ create: { width: SWc, height: SHc, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } })
    .composite(comps).png().toFile(out);
  console.log("wrote", out);
}
await comparisonSheet("puff");

await verify();
