// Composite each full-canvas effect on top of all 8 base archetypes (effects are the LAST
// layer). Effects are archetype-independent art, but we still verify per archetype that:
//   - no strong effect pixel lands on the eyes/mouth (no face obstruction)
//   - the effect covers only a small fraction of the alpaca silhouette (stays visible)
//   - everything is within the canvas (no OOB / cut particles at the frame edge)
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const BASE = "public/pixel/traits/base";
const NORM = path.join(BASE, "normalized");
const EF = "public/pixel/traits/effects";
const PREV = path.join(EF, "previews");
fs.mkdirSync(PREV, { recursive: true });

const anchors = JSON.parse(fs.readFileSync(path.join(BASE, "anchors.json"), "utf8")).archetypes;
const meta = JSON.parse(fs.readFileSync(path.join(EF, "_effects-meta.json"), "utf8"));
const ARCHES = ["puff", "curly", "topknot", "cria", "sleek", "scruffy", "bramble", "elder"];
const CARD = { r: 255, g: 252, b: 245, alpha: 1 };
const STRONG = 120; // alpha above this counts as "solid" (potentially obstructing)

async function place(name, id) {
  return await sharp(path.join(NORM, `${name}.png`))
    .composite([{ input: path.join(EF, `${id}.png`) }]).png().toBuffer();
}

const efRawCache = {};
async function efRaw(id) {
  if (efRawCache[id]) return efRawCache[id];
  const r = await sharp(path.join(EF, `${id}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  efRawCache[id] = r; return r;
}
const baseRawCache = {};
async function baseRaw(name) {
  if (baseRawCache[name]) return baseRawCache[name];
  const r = await sharp(path.join(NORM, `${name}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  baseRawCache[name] = r; return r;
}

async function verify() {
  const rows = [];
  for (const id of Object.keys(meta)) {
    const { data: ed } = await efRaw(id);
    // OOB / edge-cut: any strong effect pixel touching the outer 2px frame?
    let edgeCut = 0;
    for (let x = 0; x < 1024; x++) { for (const y of [0, 1, 1022, 1023]) if (ed[(y * 1024 + x) * 4 + 3] > STRONG) edgeCut++; }
    for (let y = 0; y < 1024; y++) { for (const x of [0, 1, 1022, 1023]) if (ed[(y * 1024 + x) * 4 + 3] > STRONG) edgeCut++; }
    for (const name of ARCHES) {
      const a = anchors[name];
      const { data: bd } = await baseRaw(name);
      const span = Math.abs(a.eye.right.x - a.eye.left.x);
      const rad = Math.max(16, span * 0.28); // generous face guard (eyes + between them)
      const guards = [a.eye.left, a.eye.right, a.mouth];
      let faceHit = 0, bodyTot = 0, bodyCov = 0;
      for (let y = 0; y < 1024; y++) {
        for (let x = 0; x < 1024; x++) {
          const i = (y * 1024 + x) * 4;
          const ea = ed[i + 3];
          const onBody = bd[i + 3] > 40;
          if (onBody) { bodyTot++; if (ea > STRONG) bodyCov++; }
          if (ea > STRONG) {
            for (const gp of guards) if (Math.hypot(x - gp.x, y - gp.y) < rad) { faceHit++; break; }
          }
        }
      }
      const cov = bodyTot ? bodyCov / bodyTot : 0;
      const issues = [];
      if (faceHit > 0) issues.push(`FACE(${faceHit})`);
      if (cov > 0.1) issues.push(`COVER(${(cov * 100).toFixed(1)}%)`);
      if (edgeCut > 0) issues.push(`EDGE(${edgeCut})`);
      rows.push({ id, name, face: faceHit, cov: +(cov * 100).toFixed(1), issues });
    }
  }
  const bad = rows.filter((r) => r.issues.length);
  console.log(`\nVERIFY: ${rows.length} placements tested`);
  console.log(`  face/eye obstruction failures: ${rows.filter((r) => r.issues.some((i) => i.startsWith("FACE"))).length}`);
  console.log(`  excessive coverage (>10%) failures: ${rows.filter((r) => r.issues.some((i) => i.startsWith("COVER"))).length}`);
  console.log(`  edge-cut failures: ${rows.filter((r) => r.issues.some((i) => i.startsWith("EDGE"))).length}`);
  for (const r of bad) console.log(`  ! ${r.id}/${r.name}: ${r.issues.join(", ")}`);
  const worst = rows.reduce((a, b) => (b.cov > a.cov ? b : a), rows[0]);
  console.log(`  max silhouette coverage: ${worst.cov}% (${worst.id}/${worst.name})`);
  console.log(`  ${rows.length - bad.length}/${rows.length} clean`);
  return bad;
}

function label(text, w, size = 22) {
  return Buffer.from(`<svg width="${w}" height="34"><text x="${w / 2}" y="25" font-family="Verdana" font-size="${size}" font-weight="bold" fill="#5b4636" text-anchor="middle">${text}</text></svg>`);
}

async function perEffectContact(id) {
  const COLS = 4, ROWS = 2, CELL = 300, PAD = 16, LBL = 30;
  const CW = CELL + PAD, CH = CELL + PAD + LBL;
  const SW = COLS * CW + PAD, SH = 56 + ROWS * CH + PAD;
  const comps = [{ input: label(`${meta[id].name}  —  on all 8 archetypes`, SW, 30), top: 12, left: 0 }];
  for (let i = 0; i < ARCHES.length; i++) {
    const name = ARCHES[i];
    const composited = await place(name, id);
    const cell = await sharp(composited).resize(CELL, CELL, { fit: "contain", background: CARD, kernel: "nearest" }).png().toBuffer();
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
for (const id of Object.keys(meta)) await perEffectContact(id);

// overview: transparent effect (checker) + on 'puff'
function checker(size) {
  const c = 20, buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const on = (Math.floor(x / c) + Math.floor(y / c)) % 2 === 0; const v = on ? 214 : 236; const i = (y * size + x) * 4; buf[i] = v; buf[i + 1] = v; buf[i + 2] = v - 6; buf[i + 3] = 255; }
  return sharp(buf, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
}
{
  const ids = Object.keys(meta);
  const COLS = ids.length, CELL = 300, PAD = 16, TH = 240;
  const SW = COLS * (CELL + PAD) + PAD, SH = 56 + TH + 20 + CELL + PAD + 30;
  const ocomps = [{ input: label("Effects — trait PNG (top) + on 'Puff' (bottom)", SW, 26), top: 12, left: 0 }];
  let i = 0;
  for (const id of ids) {
    const x0 = PAD + i * (CELL + PAD);
    const chk = await checker(TH);
    const trait = await sharp(path.join(EF, `${id}.png`)).resize(TH, TH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "nearest" }).png().toBuffer();
    const tile = await sharp(chk).composite([{ input: trait }]).png().toBuffer();
    ocomps.push({ input: tile, top: 56, left: x0 + (CELL - TH) / 2 });
    const composited = await place("puff", id);
    const cell = await sharp(composited).resize(CELL, CELL, { fit: "contain", background: CARD, kernel: "nearest" }).png().toBuffer();
    const yb = 56 + TH + 20;
    ocomps.push({ input: await sharp({ create: { width: CELL, height: CELL, channels: 4, background: CARD } }).png().toBuffer(), top: yb, left: x0 });
    ocomps.push({ input: cell, top: yb, left: x0 });
    ocomps.push({ input: label(meta[id].name, CELL, 17), top: yb + CELL - 2, left: x0 });
    i++;
  }
  await sharp({ create: { width: SW, height: SH, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } }).composite(ocomps).png().toFile(path.join(PREV, "_ALL-EFFECTS.png"));
  console.log("wrote _ALL-EFFECTS.png");
}

// comparison: same archetype bare -> each effect
{
  const name = "puff";
  const order = [{ id: null, name: "Bare" }, ...Object.keys(meta).map((id) => ({ id, name: meta[id].name }))];
  const CELL = 300, PADc = 18, LBL = 34, COLS = order.length;
  const CW = CELL + PADc, CH = CELL + LBL;
  const SWc = COLS * CW + PADc, SHc = 60 + CH + PADc;
  const comps = [{ input: label(`Effect comparison on '${name}'  —  bare  →  5 effects`, SWc, 26), top: 14, left: 0 }];
  for (let k = 0; k < order.length; k++) {
    const { id, name: lab } = order[k];
    const composited = id ? await place(name, id) : await sharp(path.join(NORM, `${name}.png`)).png().toBuffer();
    const cell = await sharp(composited).resize(CELL, CELL, { fit: "contain", background: CARD, kernel: "nearest" }).png().toBuffer();
    const x0 = PADc + k * CW, y0 = 60;
    comps.push({ input: await sharp({ create: { width: CELL, height: CELL, channels: 4, background: CARD } }).png().toBuffer(), top: y0, left: x0 });
    comps.push({ input: cell, top: y0, left: x0 });
    comps.push({ input: label(lab, CELL, 17), top: y0 + CELL - 2, left: x0 });
  }
  await sharp({ create: { width: SWc, height: SHc, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } }).composite(comps).png().toFile(path.join(PREV, "_COMPARISON-puff.png"));
  console.log("wrote _COMPARISON-puff.png");
}

await verify();
