// Fit each mouth sprig onto all 8 base archetypes using the DEDICATED MOUTH ANCHOR
// (anchors[name].mouth = the hand-verified bite position: below nose, centred on the
// muzzle, above chin). The sprite's BITE POINT maps directly onto that anchor. Mouth
// POSITION is fully independent of the eyes; the eye span is used ONLY as a uniform
// face-scale proxy so the sprig is sized proportionally to each head. Fully
// anchor-driven (per-archetype offsets stay empty unless review needs a nudge).
// Outputs:
//   public/pixel/traits/mouth/previews/<id>__<archetype>.png   (composited)
//   public/pixel/traits/mouth/previews/<id>__contact.png       (all 8 nibbling it)
//   public/pixel/traits/mouth/previews/_ALL-MOUTH.png          (overview)
//   public/pixel/traits/mouth/previews/_COMPARISON-puff.png    (bare -> each)
//   public/pixel/traits/mouth/previews/_MASTER-REVIEW.png      (single-file review)
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const BASE = "public/pixel/traits/base";
const NORM = path.join(BASE, "normalized");
const MO = "public/pixel/traits/mouth";
const PREV = path.join(MO, "previews");
fs.mkdirSync(PREV, { recursive: true });

const anchors = JSON.parse(fs.readFileSync(path.join(BASE, "anchors.json"), "utf8")).archetypes;
const meta = JSON.parse(fs.readFileSync(path.join(MO, "_mouth-meta.json"), "utf8"));
const ARCHES = ["puff", "curly", "topknot", "cria", "sleek", "scruffy", "bramble", "elder"];
const CARD = { r: 255, g: 252, b: 245, alpha: 1 };

// Mouth POSITION comes straight from the dedicated mouth anchor. The eye span is used
// only as a face-scale proxy (uniform sizing), never for placement.
function mouthGeom(name) {
  const a = anchors[name];
  const span = Math.abs(a.eye.right.x - a.eye.left.x); // face-scale proxy ONLY
  const mx = a.mouth.x, my = a.mouth.y;                 // bite position (independent of eyes)
  return { span, mx, my, eyeL: a.eye.left, eyeR: a.eye.right };
}

function computePlacement(name, id) {
  const m = meta[id];
  const a = anchors[name];
  const { span, mx, my } = mouthGeom(name);
  const scale = (span * m.widthFactor) / m.pngW;
  // rotation = muzzle bite angle (from the anchor) + any intentional per-trait tilt.
  const rotation = (a.mouth.rot || 0) + (m.rotationDeg || 0);
  const drawW = Math.max(1, Math.round(m.pngW * scale));
  const drawH = Math.max(1, Math.round(m.pngH * scale));
  const off = (m.offsets && m.offsets[name]) || { dx: 0, dy: 0 };
  const sbx = m.bitePx.x * scale, sby = m.bitePx.y * scale; // bite point in scaled sprite px
  const left = Math.round(mx - sbx) + (off.dx || 0);
  const top = Math.round(my - sby) + (off.dy || 0);
  return { left, top, drawW, drawH, scale, span, mx, my, rotation, sbx, sby, off };
}

async function place(name, id) {
  const p = computePlacement(name, id);
  const sprite = sharp(path.join(MO, `${id}.png`)).resize(p.drawW, p.drawH, { kernel: "nearest" });
  // rotation = 0 -> pixel-perfect translate + scale only (no resampling).
  if (((p.rotation % 360) + 360) % 360 === 0) {
    const buf = await sprite.png().toBuffer();
    return await sharp(path.join(NORM, `${name}.png`)).composite([{ input: buf, left: p.left, top: p.top }]).png().toBuffer();
  }
  // rotation != 0 -> rotate about the bite point so the bite still lands on the anchor.
  const rotated = await sprite.rotate(p.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const rm = await sharp(rotated).metadata();
  const rad = p.rotation * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const cx = p.drawW / 2, cy = p.drawH / 2;
  const rx = (p.sbx - cx) * cos - (p.sby - cy) * sin;
  const ry = (p.sbx - cx) * sin + (p.sby - cy) * cos;
  const biteX = rm.width / 2 + rx, biteY = rm.height / 2 + ry;
  const left = Math.round(p.mx - biteX) + (p.off.dx || 0);
  const top = Math.round(p.my - biteY) + (p.off.dy || 0);
  return await sharp(path.join(NORM, `${name}.png`)).composite([{ input: rotated, left, top }]).png().toBuffer();
}

const rawCache = {};
async function baseRaw(name) {
  if (rawCache[name]) return rawCache[name];
  const r = await sharp(path.join(NORM, `${name}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  rawCache[name] = r;
  return r;
}
function rowSpan(data, W, y) { let l = -1, r = -1; for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 40) { if (l < 0) l = x; r = x; } return l < 0 ? null : [l, r]; }

const artBoxCache = {};
async function artBox(id) {
  if (artBoxCache[id]) return artBoxCache[id];
  const { data, info } = await sharp(path.join(MO, `${id}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const box = { x0, y0, x1, y1 };
  artBoxCache[id] = box;
  return box;
}

// fraction of the sprig's opaque pixels that land OFF the head silhouette (per row)
async function offHeadFraction(name, id, p, box) {
  const { data, info } = await baseRaw(name);
  const W = info.width, H = info.height;
  const gl = await sharp(path.join(MO, `${id}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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

// does any opaque sprig pixel land on/near an eye anchor? (a nibble must never cover the eyes)
async function eyeCover(name, id, p, box) {
  const g = mouthGeom(name);
  const rad = Math.max(14, g.span * 0.16); // eye protection radius
  const gl = await sharp(path.join(MO, `${id}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let hit = 0;
  for (let sy = box.y0; sy <= box.y1; sy++) {
    for (let sx = box.x0; sx <= box.x1; sx++) {
      if (gl.data[(sy * gl.info.width + sx) * 4 + 3] <= 40) continue;
      const cx = p.left + sx * p.scale, cy = p.top + sy * p.scale;
      if (Math.hypot(cx - g.eyeL.x, cy - g.eyeL.y) < rad || Math.hypot(cx - g.eyeR.x, cy - g.eyeR.y) < rad) hit++;
    }
  }
  return hit;
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
      const offFrac = await offHeadFraction(name, id, p, box);
      if (offFrac > 0.06) issues.push(`FLOAT(${(offFrac * 100).toFixed(1)}%)`);
      const eye = await eyeCover(name, id, p, box);
      if (eye > 0) issues.push(`EYE-COVER(${eye})`);
      if (artLeft < 0 || artRight > 1024 || artTop < 0 || artBottom > 1024) issues.push("OOB");
      rows.push({ id, name, off: +(offFrac * 100).toFixed(1), eye, issues });
    }
  }
  const bad = rows.filter((r) => r.issues.length);
  console.log(`\nVERIFY: ${rows.length} placements tested`);
  console.log(`  floating (off-head) failures: ${rows.filter((r) => r.issues.some((i) => i.startsWith("FLOAT"))).length}`);
  console.log(`  eye-cover failures: ${rows.filter((r) => r.issues.some((i) => i.startsWith("EYE-COVER"))).length}`);
  console.log(`  out-of-bounds: ${rows.filter((r) => r.issues.includes("OOB")).length}`);
  console.log(`  manual offsets: ${manualOffsets}`);
  for (const r of bad) console.log(`  ! ${r.id}/${r.name}: ${r.issues.join(", ")}  [off=${r.off}%]`);
  const worst = rows.reduce((a, b) => (b.off > a.off ? b : a), rows[0]);
  console.log(`  max off-head fraction: ${worst.off}% (${worst.id}/${worst.name})`);
  console.log(`  ${rows.length - bad.length}/${rows.length} clean`);
  return bad;
}

function label(text, w, size = 22) {
  return Buffer.from(`<svg width="${w}" height="34"><text x="${w / 2}" y="25" font-family="Verdana" font-size="${size}" font-weight="bold" fill="#5b4636" text-anchor="middle">${text}</text></svg>`);
}
// crop focused on the head so the nibble is clearly visible
function headWin(a) {
  const pad = 40;
  const exL = Math.max(0, a.bbox.x0 - pad), exT = Math.max(0, a.bbox.y0 - pad);
  const h = Math.min(1024 - exT, Math.round(a.bbox.h * 0.72) + pad * 2);
  return { left: exL, top: exT, width: Math.min(1024 - exL, a.bbox.w + pad * 2), height: h };
}

// Dedicated review: zoomed face per archetype with a crosshair on the mouth anchor,
// so the bite position can be verified independently of any trait.
async function mouthAnchorOverlay() {
  const COLS = 4, ROWS = 2, CELL = 320, PAD = 16, LBL = 30;
  const CW = CELL + PAD, CH = CELL + PAD + LBL;
  const SW = COLS * CW + PAD, SH = 56 + ROWS * CH + PAD;
  const comps = [{ input: label("Mouth Anchors — bite position per archetype (below nose · muzzle-centred · above chin · independent of eyes)", SW, 24), top: 12, left: 0 }];
  for (let i = 0; i < ARCHES.length; i++) {
    const name = ARCHES[i];
    const a = anchors[name];
    const win = headWin(a);
    const cross = Buffer.from(`<svg width="1024" height="1024">` +
      `<circle cx="${a.mouth.x}" cy="${a.mouth.y}" r="10" fill="none" stroke="#00c2c2" stroke-width="4"/>` +
      `<line x1="${a.mouth.x - 26}" y1="${a.mouth.y}" x2="${a.mouth.x + 26}" y2="${a.mouth.y}" stroke="#00c2c2" stroke-width="3"/>` +
      `<line x1="${a.mouth.x}" y1="${a.mouth.y - 26}" x2="${a.mouth.x}" y2="${a.mouth.y + 26}" stroke="#00c2c2" stroke-width="3"/></svg>`);
    const composited = await sharp(path.join(NORM, `${name}.png`)).composite([{ input: cross }]).png().toBuffer();
    const cell = await sharp(composited).extract(win).resize(CELL, CELL, { fit: "contain", background: CARD, kernel: "nearest" }).png().toBuffer();
    const c = i % COLS, r = Math.floor(i / COLS);
    const x0 = PAD + c * CW, y0 = 56 + r * CH;
    comps.push({ input: await sharp({ create: { width: CELL, height: CELL, channels: 4, background: CARD } }).png().toBuffer(), top: y0, left: x0 });
    comps.push({ input: cell, top: y0, left: x0 });
    comps.push({ input: label(`${name}  (${a.mouth.x},${a.mouth.y})`, CELL, 19), top: y0 + CELL - 2, left: x0 });
  }
  await sharp({ create: { width: SW, height: SH, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } }).composite(comps).png().toFile(path.join(PREV, "_MOUTH-ANCHORS.png"));
  console.log("wrote _MOUTH-ANCHORS.png");
}
await mouthAnchorOverlay();

async function perMouthContact(id) {
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

for (const id of Object.keys(meta)) await perMouthContact(id);

// overview: transparent trait (checker) + on 'puff'
function checker(size) {
  const c = 20, buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const on = (Math.floor(x / c) + Math.floor(y / c)) % 2 === 0; const v = on ? 214 : 236; const i = (y * size + x) * 4; buf[i] = v; buf[i + 1] = v; buf[i + 2] = v - 6; buf[i + 3] = 255; }
  return sharp(buf, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
}
{
  const ids = Object.keys(meta);
  const COLS = ids.length, CELL = 300, PAD = 16, TH = 150;
  const SW = COLS * (CELL + PAD) + PAD, SH = 56 + TH + 20 + CELL + PAD + 30;
  const ocomps = [{ input: label("Mouth — trait PNG (top) + on 'Puff' (bottom)", SW, 26), top: 12, left: 0 }];
  let i = 0;
  for (const id of ids) {
    const x0 = PAD + i * (CELL + PAD);
    const chk = await checker(TH);
    const trait = await sharp(path.join(MO, `${id}.png`)).resize(TH - 16, TH - 16, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "nearest" }).png().toBuffer();
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
  await sharp({ create: { width: SW, height: SH, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } }).composite(ocomps).png().toFile(path.join(PREV, "_ALL-MOUTH.png"));
  console.log("wrote _ALL-MOUTH.png");
}

// comparison: same archetype bare -> each mouth trait
{
  const name = "puff";
  const win = headWin(anchors[name]);
  const order = [{ id: null, name: "Bare" }, ...Object.keys(meta).map((id) => ({ id, name: meta[id].name }))];
  const CELL = 300, PADc = 18, LBL = 34, COLS = order.length;
  const CW = CELL + PADc, CH = CELL + LBL;
  const SWc = COLS * CW + PADc, SHc = 60 + CH + PADc;
  const comps = [{ input: label(`Mouth comparison on '${name}'  —  bare  →  5 traits`, SWc, 26), top: 14, left: 0 }];
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

// ---- transform data: x / y / scale / rotation for every placement ----
async function dumpTransforms() {
  const out = {};
  console.log("\nTRANSFORM DATA  (x,y = mouth anchor / bite target in canvas px; scale = uniform NN scale; rotation deg, 0 = horizontal)");
  console.log("  trait             archetype    x     y    scale   rot   (left,top)");
  for (const id of Object.keys(meta)) {
    out[id] = { rotationDeg: meta[id].rotationDeg || 0, placements: {} };
    for (const name of ARCHES) {
      const p = computePlacement(name, id);
      out[id].placements[name] = { x: p.mx, y: p.my, scale: +p.scale.toFixed(4), rotation: p.rotation, left: p.left, top: p.top };
      console.log(`  ${id.padEnd(17)} ${name.padEnd(9)} ${String(p.mx).padStart(4)}  ${String(p.my).padStart(4)}  ${p.scale.toFixed(3).padStart(6)}  ${String(p.rotation).padStart(4)}   (${p.left},${p.top})`);
    }
  }
  fs.writeFileSync(path.join(PREV, "_transforms.json"), JSON.stringify({
    note: "Per-placement transform for mouth traits. x,y = the dedicated mouth anchor (bite target, canvas px) — the sprite's bite point maps here. scale = uniform nearest-neighbor scale applied to the trait PNG (face-scale proxy = eye span x widthFactor / pngW). rotation = degrees (0 = horizontal/level bite, no tilt) = anchor bite-angle + per-trait rotationDeg. left,top = final composite offset.",
    placements: out,
  }, null, 2));
  console.log("  wrote _transforms.json");
}
await dumpTransforms();
