// Fit each hat onto all 8 base archetypes using anchors + measured head width.
// Outputs:
//   public/pixel/traits/hats/previews/<hatId>__<archetype>.png   (composited)
//   public/pixel/traits/hats/previews/<hatId>__contact.png        (all 8 wearing it)
//   public/pixel/traits/hats/previews/_ALL-HATS.png               (overview)
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const BASE = "public/pixel/traits/base";
const HATS = "public/pixel/traits/hats";
const PREV = path.join(HATS, "previews");
fs.mkdirSync(PREV, { recursive: true });

const anchors = JSON.parse(fs.readFileSync(path.join(BASE, "anchors.json"), "utf8")).archetypes;
const meta = JSON.parse(fs.readFileSync(path.join(HATS, "_hats-meta.json"), "utf8"));
const ARCHES = ["puff", "curly", "topknot", "cria", "sleek", "scruffy", "bramble", "elder"];
const CARD = { r: 255, g: 252, b: 245, alpha: 1 };

// Measure the real head: dome-top row (skipping thin tufts/ear tips) and the head
// width just below it — so hats seat on the head instead of floating on a stray pixel.
const headCache = {};
async function headMetrics(name) {
  if (headCache[name]) return headCache[name];
  const { data, info } = await sharp(path.join(BASE, `${name}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const a = anchors[name];
  const bH = a.bbox.h;
  const bandBot = Math.round(a.bbox.y0 + bH * 0.30);
  const width = (y) => { let l = -1, r = -1; for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 40) { if (l < 0) l = x; r = x; } return r < 0 ? 0 : r - l; };
  let maxW = 0;
  for (let y = a.bbox.y0; y <= bandBot; y++) maxW = Math.max(maxW, width(y));
  let headTopY = a.bbox.y0;
  for (let y = a.bbox.y0; y <= bandBot; y++) { if (width(y) >= 0.45 * maxW) { headTopY = y; break; } }
  const seatRow = Math.min(bandBot, headTopY + Math.round(bH * 0.05));
  const headW = Math.max(width(seatRow), maxW * 0.6);
  const res = { W, H, headW, headTopY };
  headCache[name] = res;
  return res;
}

// Fully anchor-driven placement. Optional documented offsets live in
// meta[hatId].offsets[archetype] = { dx, dy } and default to zero.
async function computePlacement(name, hatId) {
  const m = meta[hatId];
  const a = anchors[name];
  const { headW, headTopY } = await headMetrics(name);
  const scale = (headW * m.widthFactor) / m.pngW;
  const drawW = Math.max(1, Math.round(m.pngW * scale));
  const drawH = Math.max(1, Math.round(m.pngH * scale));
  const off = (m.offsets && m.offsets[name]) || { dx: 0, dy: 0 };
  const left = Math.round(a.crown.x - m.centerXpx * scale) + (off.dx || 0);
  const top = Math.round(headTopY + a.bbox.h * m.sink - m.sitYpx * scale) + (off.dy || 0);
  return { left, top, drawW, drawH, scale, headW, headTopY };
}

async function placeHat(name, hatId) {
  const p = await computePlacement(name, hatId);
  const hatBuf = await sharp(path.join(HATS, `${hatId}.png`)).resize(p.drawW, p.drawH, { kernel: "nearest" }).png().toBuffer();
  return await sharp(path.join(BASE, `${name}.png`))
    .composite([{ input: hatBuf, left: p.left, top: p.top }])
    .png().toBuffer();
}

// Opaque bounding box of a hat sprite within its own PNG (ignores transparent padding).
const artBoxCache = {};
async function hatArtBox(hatId) {
  if (artBoxCache[hatId]) return artBoxCache[hatId];
  const { data, info } = await sharp(path.join(HATS, `${hatId}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 16) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const box = { x0, y0, x1, y1 };
  artBoxCache[hatId] = box;
  return box;
}

// Verify placement across the whole family. Returns a list of issue rows.
async function verify() {
  const rows = [];
  for (const hatId of Object.keys(meta)) {
    const box = await hatArtBox(hatId);
    for (const name of ARCHES) {
      const p = await computePlacement(name, hatId);
      const a = anchors[name];
      // real drawn art extents (exclude transparent sprite padding)
      const artTop = p.top + box.y0 * p.scale;
      const artBottom = p.top + box.y1 * p.scale;
      const artLeft = p.left + box.x0 * p.scale;
      const artRight = p.left + box.x1 * p.scale;
      const eyeTop = a.eye.lineY - Math.round(a.bbox.h * 0.05);
      const issues = [];
      if (artBottom <= p.headTopY) issues.push("FLOATING");             // must nestle into wool
      if (artBottom > eyeTop) issues.push("EYE-OVERLAP");               // must clear the eyes
      if (artLeft < 0 || artRight > 1024 || artTop < 0) issues.push("CLIP-CANVAS");
      const widthRatio = +(p.drawW / p.headW).toFixed(3);               // should equal widthFactor
      rows.push({ hatId, name, widthRatio, wf: meta[hatId].widthFactor, issues, artTop: Math.round(artTop), artBottom: Math.round(artBottom), headTopY: p.headTopY, eyeTop });
    }
  }
  const bad = rows.filter((r) => r.issues.length);
  console.log(`\nVERIFY: ${rows.length} placements, ${bad.length} with issues`);
  for (const r of bad) console.log(`  ! ${r.hatId}/${r.name}: ${r.issues.join(", ")}  [artTop=${r.artTop} artBottom=${r.artBottom} headTopY=${r.headTopY} eyeTop=${r.eyeTop}]`);
  // scaling consistency: widthRatio should match widthFactor for every archetype of a hat
  for (const hatId of Object.keys(meta)) {
    const rs = rows.filter((r) => r.hatId === hatId);
    const consistent = rs.every((r) => Math.abs(r.widthRatio - r.wf) < 0.02);
    console.log(`  scale ${hatId.padEnd(12)} ${consistent ? "consistent" : "INCONSISTENT"} (wf=${meta[hatId].widthFactor})`);
  }
  return bad;
}

function label(text, w, size = 22) {
  return Buffer.from(`<svg width="${w}" height="34"><text x="${w / 2}" y="25" font-family="Verdana" font-size="${size}" font-weight="bold" fill="#5b4636" text-anchor="middle">${text}</text></svg>`);
}

async function perHatContact(hatId) {
  const COLS = 4, ROWS = 2, CELL = 300, PAD = 16, LBL = 30;
  const CW = CELL + PAD, CH = CELL + PAD + LBL;
  const SW = COLS * CW + PAD, SH = 56 + ROWS * CH + PAD;
  const comps = [{ input: label(`${meta[hatId].name}  —  fits all 8 archetypes`, SW, 30), top: 12, left: 0 }];
  for (let i = 0; i < ARCHES.length; i++) {
    const name = ARCHES[i];
    const composited = await placeHat(name, hatId);
    // trim to the base bbox for a tight cell, keep hat (extend bbox upward a bit)
    const a = anchors[name];
    const pad = 40;
    const exL = Math.max(0, a.bbox.x0 - pad), exT = Math.max(0, a.bbox.y0 - pad * 3);
    const ex = { left: exL, top: exT, width: Math.min(1024 - exL, a.bbox.w + pad * 2), height: Math.min(1024 - exT, a.bbox.h + pad * 4) };
    const cell = await sharp(composited).extract(ex)
      .resize(CELL, CELL, { fit: "contain", background: CARD, kernel: "nearest" }).png().toBuffer();
    const c = i % COLS, r = Math.floor(i / COLS);
    const cardBuf = await sharp({ create: { width: CELL, height: CELL, channels: 4, background: CARD } }).png().toBuffer();
    const x0 = PAD + c * CW, y0 = 56 + r * CH;
    comps.push({ input: cardBuf, top: y0, left: x0 });
    comps.push({ input: cell, top: y0, left: x0 });
    comps.push({ input: label(name, CELL, 20), top: y0 + CELL - 2, left: x0 });
  }
  const out = path.join(PREV, `${hatId}__contact.png`);
  await sharp({ create: { width: SW, height: SH, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } })
    .composite(comps).png().toFile(out);
  // also save individual composites on a card
  for (const name of ARCHES) {
    const composited = await placeHat(name, hatId);
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: CARD } })
      .composite([{ input: composited }]).png().toFile(path.join(PREV, `${hatId}__${name}.png`));
  }
  console.log("contact ->", out);
}

for (const hatId of Object.keys(meta)) await perHatContact(hatId);

// overview: one representative archetype (puff) wearing each hat
const COLS = 5, CELL = 300, PAD = 16;
const SW = COLS * (CELL + PAD) + PAD, SH = 56 + CELL + PAD + 30;
const ocomps = [{ input: label("All 5 hats on 'Puff'", SW, 28), top: 12, left: 0 }];
let i = 0;
for (const hatId of Object.keys(meta)) {
  const composited = await placeHat("puff", hatId);
  const a = anchors.puff, pad = 40;
  const exLeft = Math.max(0, a.bbox.x0 - pad), exTop = Math.max(0, a.bbox.y0 - pad * 3);
  const ex = { left: exLeft, top: exTop, width: Math.min(1024 - exLeft, a.bbox.w + pad * 2), height: Math.min(1024 - exTop, a.bbox.h + pad * 4) };
  const cell = await sharp(composited).extract(ex).resize(CELL, CELL, { fit: "contain", background: CARD, kernel: "nearest" }).png().toBuffer();
  const x0 = PAD + i * (CELL + PAD);
  ocomps.push({ input: await sharp({ create: { width: CELL, height: CELL, channels: 4, background: CARD } }).png().toBuffer(), top: 56, left: x0 });
  ocomps.push({ input: cell, top: 56, left: x0 });
  ocomps.push({ input: label(meta[hatId].name, CELL, 18), top: 56 + CELL - 2, left: x0 });
  i++;
}
await sharp({ create: { width: SW, height: SH, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } })
  .composite(ocomps).png().toFile(path.join(PREV, "_ALL-HATS.png"));
console.log("wrote _ALL-HATS.png");

await verify();
