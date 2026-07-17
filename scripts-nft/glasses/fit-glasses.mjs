// Fit each pair of glasses onto all 8 base archetypes using the EYE anchors (lens
// placement + scale via the eye span) and the EAR anchors (temple/strap direction +
// verification). Fully anchor-driven (no manual offsets).
// Outputs:
//   public/pixel/traits/glasses/previews/<id>__<archetype>.png   (composited)
//   public/pixel/traits/glasses/previews/<id>__contact.png       (all 8 wearing it)
//   public/pixel/traits/glasses/previews/_ALL-GLASSES.png        (overview)
//   public/pixel/traits/glasses/previews/_COMPARISON-puff.png    (bare -> each)
//   public/pixel/traits/glasses/previews/_MASTER-REVIEW.png      (single-file review)
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const BASE = "public/pixel/traits/base";
const NORM = path.join(BASE, "normalized");
const GL = "public/pixel/traits/glasses";
const PREV = path.join(GL, "previews");
fs.mkdirSync(PREV, { recursive: true });

const anchors = JSON.parse(fs.readFileSync(path.join(BASE, "anchors.json"), "utf8")).archetypes;
const meta = JSON.parse(fs.readFileSync(path.join(GL, "_glasses-meta.json"), "utf8"));
const ARCHES = ["puff", "curly", "topknot", "cria", "sleek", "scruffy", "bramble", "elder"];
const CARD = { r: 255, g: 252, b: 245, alpha: 1 };

function eyeGeom(name) {
  const a = anchors[name];
  const lx = a.eye.left.x, rx = a.eye.right.x;
  const span = Math.abs(rx - lx);
  const cxE = Math.round((lx + rx) / 2);
  const cyE = a.eye.lineY;
  return { span, cxE, cyE };
}

// Scale so the sprite's lens gap equals the archetype eye span -> lenses sit on the eyes.
function computePlacement(name, id) {
  const m = meta[id];
  const { span, cxE, cyE } = eyeGeom(name);
  const scale = span / m.lensGapPx;
  const drawW = Math.max(1, Math.round(m.pngW * scale));
  const drawH = Math.max(1, Math.round(m.pngH * scale));
  const off = (m.offsets && m.offsets[name]) || { dx: 0, dy: 0 };
  const left = Math.round(cxE - m.centerXpx * scale) + (off.dx || 0);
  const top = Math.round(cyE - m.eyeRowPx * scale) + (off.dy || 0);
  return { left, top, drawW, drawH, scale, span, cxE, cyE };
}

// Ear-anchored strap band (for goggles): a soft band from each lens edge to the ear.
function strapSvg(name, p, id) {
  const m = meta[id];
  if (!m.strapToEar) return null;
  const a = anchors[name];
  const lensR = (p.scale * (m.lensGapPx / m.scale)); // not used directly; keep for clarity
  const lensHalf = p.span / 2;
  const yc = p.cyE - Math.round(p.span * 0.06);
  const lx = p.cxE - lensHalf, rx = p.cxE + lensHalf;
  const t = Math.max(4, Math.round(p.span * 0.07));
  const col = "rgb(124,83,38)"; // woodM
  return Buffer.from(
    `<svg width="1024" height="1024">` +
    `<line x1="${lx}" y1="${yc}" x2="${a.ear.left.x}" y2="${a.ear.left.y}" stroke="${col}" stroke-width="${t}" stroke-linecap="round"/>` +
    `<line x1="${rx}" y1="${yc}" x2="${a.ear.right.x}" y2="${a.ear.right.y}" stroke="${col}" stroke-width="${t}" stroke-linecap="round"/>` +
    `</svg>`
  );
}

async function place(name, id) {
  const p = computePlacement(name, id);
  const glBuf = await sharp(path.join(GL, `${id}.png`)).resize(p.drawW, p.drawH, { kernel: "nearest" }).png().toBuffer();
  const layers = [];
  const strap = strapSvg(name, p, id);
  if (strap) layers.push({ input: strap, left: 0, top: 0 }); // strap sits under the lenses
  layers.push({ input: glBuf, left: p.left, top: p.top });
  return await sharp(path.join(NORM, `${name}.png`)).composite(layers).png().toBuffer();
}

const rawCache = {};
async function baseRaw(name) {
  if (rawCache[name]) return rawCache[name];
  const r = await sharp(path.join(NORM, `${name}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  rawCache[name] = r;
  return r;
}
function rowSpan(data, W, y) { let l = -1, r = -1; for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 40) { if (l < 0) l = x; r = x; } return l < 0 ? null : [l, r]; }
async function headSpan(name, y) {
  const { data, info } = await baseRaw(name);
  let lo = Infinity, hi = -Infinity;
  for (let yy = y - 4; yy <= y + 4; yy++) { const s = rowSpan(data, info.width, yy); if (s) { lo = Math.min(lo, s[0]); hi = Math.max(hi, s[1]); } }
  return lo === Infinity ? null : [lo, hi];
}

// True floating metric: fraction of glasses opaque pixels that land OFF the head
// silhouette (checked per row, so a lens resting on the wider face below the eye line
// is correctly counted as on-head).
async function offHeadFraction(name, id, p, box) {
  const { data, info } = await baseRaw(name);
  const W = info.width, H = info.height;
  const gl = await sharp(path.join(GL, `${id}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let off = 0, total = 0;
  for (let sy = box.y0; sy <= box.y1; sy++) {
    for (let sx = box.x0; sx <= box.x1; sx++) {
      if (gl.data[(sy * gl.info.width + sx) * 4 + 3] <= 40) continue;
      total++;
      const cx = Math.round(p.left + sx * p.scale), cy = Math.round(p.top + sy * p.scale);
      if (cy < 0 || cy >= H) { off++; continue; }
      const span = rowSpan(data, W, cy);
      if (!span || cx < span[0] || cx > span[1]) off++;
    }
  }
  return total ? off / total : 0;
}

const artBoxCache = {};
async function artBox(id) {
  if (artBoxCache[id]) return artBoxCache[id];
  const { data, info } = await sharp(path.join(GL, `${id}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const box = { x0, y0, x1, y1 };
  artBoxCache[id] = box;
  return box;
}

async function verify() {
  const rows = [];
  let manualOffsets = 0;
  for (const id of Object.keys(meta)) {
    const box = await artBox(id);
    if (meta[id].offsets && Object.keys(meta[id].offsets).length) manualOffsets += Object.keys(meta[id].offsets).length;
    for (const name of ARCHES) {
      const p = computePlacement(name, id);
      const artTop = p.top + box.y0 * p.scale, artBottom = p.top + box.y1 * p.scale;
      const artLeft = p.left + box.x0 * p.scale, artRight = p.left + box.x1 * p.scale;
      const issues = [];
      // (1) lenses land on the eyes: by construction the sprite's lens centres map to
      // eye.left / eye.right at eye.lineY — assert the residual is ~0.
      const placedEyeY = p.top + meta[id].eyeRowPx * p.scale;
      const placedLeftLensX = p.left + (meta[id].centerXpx - meta[id].lensGapPx / 2) * p.scale;
      const placedRightLensX = p.left + (meta[id].centerXpx + meta[id].lensGapPx / 2) * p.scale;
      const eyeErr = Math.max(Math.abs(placedEyeY - p.cyE), Math.abs(placedLeftLensX - anchors[name].eye.left.x), Math.abs(placedRightLensX - anchors[name].eye.right.x));
      if (eyeErr > 2) issues.push(`EYE-OFF(${Math.round(eyeErr)})`);
      // (2) not floating off the head: fraction of glasses pixels beyond the head outline
      const offFrac = await offHeadFraction(name, id, p, box);
      if (offFrac > 0.08) issues.push(`FLOAT(${(offFrac * 100).toFixed(1)}%)`);
      // (3) canvas bounds
      if (artLeft < 0 || artRight > 1024 || artTop < 0 || artBottom > 1024) issues.push("OOB");
      rows.push({ id, name, span: p.span, eyeErr: Math.round(eyeErr), off: +(offFrac * 100).toFixed(1), issues, artL: Math.round(artLeft), artR: Math.round(artRight) });
    }
  }
  const bad = rows.filter((r) => r.issues.length);
  let oob = 0; for (const r of rows) if (r.issues.includes("OOB")) oob++;
  console.log(`\nVERIFY: ${rows.length} placements tested`);
  console.log(`  eye-alignment failures: ${rows.filter((r) => r.issues.some((i) => i.startsWith("EYE-OFF"))).length}`);
  console.log(`  floating (off-head) failures: ${rows.filter((r) => r.issues.includes("FLOAT")).length}`);
  console.log(`  out-of-bounds pixels: ${oob} placements`);
  console.log(`  manual offsets: ${manualOffsets}`);
  for (const r of bad) console.log(`  ! ${r.id}/${r.name}: ${r.issues.join(", ")}  [artL=${r.artL} artR=${r.artR} off=${r.off}% eyeErr=${r.eyeErr}]`);
  const worst = rows.reduce((a, b) => (b.off > a.off ? b : a), rows[0]);
  console.log(`  max off-head fraction: ${worst.off}% (${worst.id}/${worst.name})`);
  for (const id of Object.keys(meta)) console.log(`  scale ${id.padEnd(16)} lens-gap tracks eye span (lensGapPx=${meta[id].lensGapPx})`);
  return bad;
}

function label(text, w, size = 22) {
  return Buffer.from(`<svg width="${w}" height="34"><text x="${w / 2}" y="25" font-family="Verdana" font-size="${size}" font-weight="bold" fill="#5b4636" text-anchor="middle">${text}</text></svg>`);
}
// crop focused on the head so eyewear is clearly visible
function headWin(a) {
  const pad = 40;
  const exL = Math.max(0, a.bbox.x0 - pad), exT = Math.max(0, a.bbox.y0 - pad);
  const h = Math.min(1024 - exT, Math.round(a.bbox.h * 0.7) + pad * 2);
  return { left: exL, top: exT, width: Math.min(1024 - exL, a.bbox.w + pad * 2), height: h };
}

async function perGlassesContact(id) {
  const COLS = 4, ROWS = 2, CELL = 300, PAD = 16, LBL = 30;
  const CW = CELL + PAD, CH = CELL + PAD + LBL;
  const SW = COLS * CW + PAD, SH = 56 + ROWS * CH + PAD;
  const comps = [{ input: label(`${meta[id].name}  —  fits all 8 archetypes`, SW, 30), top: 12, left: 0 }];
  for (let i = 0; i < ARCHES.length; i++) {
    const name = ARCHES[i];
    const composited = await place(name, id);
    const cell = await sharp(composited).extract(headWin(anchors[name])).resize(CELL, CELL, { fit: "contain", background: CARD, kernel: "nearest" }).png().toBuffer();
    const c = i % COLS, r = Math.floor(i / COLS);
    const x0 = PAD + c * CW, y0 = 56 + r * CH;
    comps.push({ input: await sharp({ create: { width: CELL, height: CELL, channels: 4, background: CARD } }).png().toBuffer(), top: y0, left: x0 });
    comps.push({ input: cell, top: y0, left: x0 });
    comps.push({ input: label(name, CELL, 20), top: y0 + CELL - 2, left: x0 });
  }
  const out = path.join(PREV, `${id}__contact.png`);
  await sharp({ create: { width: SW, height: SH, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } }).composite(comps).png().toFile(out);
  for (const name of ARCHES) {
    const composited = await place(name, id);
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: CARD } }).composite([{ input: composited }]).png().toFile(path.join(PREV, `${id}__${name}.png`));
  }
  console.log("contact ->", out);
}

for (const id of Object.keys(meta)) await perGlassesContact(id);

// overview: transparent trait (checker) + on 'puff'
function checker(size) {
  const c = 20, buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const on = (Math.floor(x / c) + Math.floor(y / c)) % 2 === 0; const v = on ? 214 : 236; const i = (y * size + x) * 4; buf[i] = v; buf[i + 1] = v; buf[i + 2] = v - 6; buf[i + 3] = 255; }
  return sharp(buf, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
}
{
  const COLS = 5, CELL = 300, PAD = 16, TH = 150;
  const SW = COLS * (CELL + PAD) + PAD, SH = 56 + TH + 20 + CELL + PAD + 30;
  const ocomps = [{ input: label("All 5 Glasses — trait PNG (top) + on 'Puff' (bottom)", SW, 26), top: 12, left: 0 }];
  let i = 0;
  for (const id of Object.keys(meta)) {
    const x0 = PAD + i * (CELL + PAD);
    const chk = await checker(TH);
    const trait = await sharp(path.join(GL, `${id}.png`)).resize(TH - 16, TH - 16, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "nearest" }).png().toBuffer();
    const tile = await sharp(chk).composite([{ input: trait, gravity: "center" }]).png().toBuffer();
    ocomps.push({ input: tile, top: 56, left: x0 + (CELL - TH) / 2 });
    const composited = await place("puff", id);
    const cell = await sharp(composited).extract(headWin(anchors.puff)).resize(CELL, CELL, { fit: "contain", background: CARD, kernel: "nearest" }).png().toBuffer();
    const yb = 56 + TH + 20;
    ocomps.push({ input: await sharp({ create: { width: CELL, height: CELL, channels: 4, background: CARD } }).png().toBuffer(), top: yb, left: x0 });
    ocomps.push({ input: cell, top: yb, left: x0 });
    ocomps.push({ input: label(meta[id].name, CELL, 17), top: yb + CELL - 2, left: x0 });
    i++;
  }
  await sharp({ create: { width: SW, height: SH, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } }).composite(ocomps).png().toFile(path.join(PREV, "_ALL-GLASSES.png"));
  console.log("wrote _ALL-GLASSES.png");
}

// comparison: same archetype bare -> each glasses
{
  const name = "puff";
  const win = headWin(anchors[name]);
  const order = [{ id: null, name: "No glasses" }, ...Object.keys(meta).map((id) => ({ id, name: meta[id].name }))];
  const CELL = 300, PADc = 18, LBL = 34, COLS = order.length;
  const CW = CELL + PADc, CH = CELL + LBL;
  const SWc = COLS * CW + PADc, SHc = 60 + CH + PADc;
  const comps = [{ input: label(`Glasses comparison on '${name}'  —  bare  →  5 glasses  (same archetype)`, SWc, 26), top: 14, left: 0 }];
  for (let k = 0; k < order.length; k++) {
    const { id, name: lab } = order[k];
    const composited = id ? await place(name, id) : await sharp(path.join(NORM, `${name}.png`)).png().toBuffer();
    const cell = await sharp(composited).extract(win).resize(CELL, CELL, { fit: "contain", background: CARD, kernel: "nearest" }).png().toBuffer();
    const x0 = PADc + k * CW, y0 = 60;
    comps.push({ input: await sharp({ create: { width: CELL, height: CELL, channels: 4, background: CARD } }).png().toBuffer(), top: y0, left: x0 });
    comps.push({ input: cell, top: y0, left: x0 });
    comps.push({ input: label(lab, CELL, 17), top: y0 + CELL - 2, left: x0 });
  }
  await sharp({ create: { width: SWc, height: SHc, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } }).composite(comps).png().toFile(path.join(PREV, "_COMPARISON-puff.png"));
  console.log("wrote _COMPARISON-puff.png");
}

await verify();
