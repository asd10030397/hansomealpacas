// Adaptive countryside clothing — archetype-aware parametric fitting for the four
// torso garments, matching the Cozy Wool Scarf quality bar.
//
// Instead of one universal PNG scaled onto every body, each garment is DRAWN with
// per-archetype geometry derived from measured anatomy:
//   neck position + width, shoulder line, chest width, torso height, and a dense
//   silhouette profile (so the garment hugs the real body outline, per row).
// The garment concepts are unchanged — only the fitting/adaptation is upgraded.
//
// Garments: Farmer Overalls, Farm Vest, Explorer Cape, Festival Ribbon Outfit.
//
// Outputs per garment <id>:
//   public/pixel/traits/clothing/<id>/<archetype>.png            (fitted variant, tight)
//   public/pixel/traits/clothing/previews/<id>__<archetype>.png  (composite on base)
//   public/pixel/traits/clothing/previews/<id>__contact.png      (annotated review sheet)
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { P, Sprite } from "../lib/pixel.mjs";

const BASE = "public/pixel/traits/base";
const NORM = path.join(BASE, "normalized");
const CLO = "public/pixel/traits/clothing";
const PREV = path.join(CLO, "previews");
fs.mkdirSync(PREV, { recursive: true });

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
function rowSpan(data, W, y) {
  let l = -1, r = -1;
  for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 40) { if (l < 0) l = x; r = x; }
  return l < 0 ? null : [l, r];
}

async function measure(name) {
  const a = anchors[name];
  const { data, info } = await baseRaw(name);
  const W = info.width, h = a.bbox.h;
  const faceClearY = Math.round(a.eye.lineY + h * 0.06);
  const mouthClearY = Math.round(a.eye.lineY + h * 0.15);   // below the mouth/muzzle

  // neck pinch: narrowest silhouette in a window around the neck anchor
  const yStart = Math.max(faceClearY, Math.round(a.neck.y - h * 0.11));
  const yEnd = Math.round(a.neck.y + h * 0.13);
  let neck = { w: 1e9, y: a.neck.y, cx: a.neck.x };
  for (let y = yStart; y <= yEnd; y++) {
    let lo = 1e9, hi = -1, cnt = 0;
    for (let yy = y - 2; yy <= y + 2; yy++) { const s = rowSpan(data, W, yy); if (s) { lo = Math.min(lo, s[0]); hi = Math.max(hi, s[1]); cnt++; } }
    if (!cnt) continue; const w = hi - lo;
    if (w < neck.w) neck = { w, y, cx: Math.round((lo + hi) / 2) };
  }

  const shoulderY = Math.round(a.chest.y - h * 0.06);       // top of the torso (below the neck)
  const legLimitY = Math.round(a.bbox.y1 - h * 0.17);       // keep clear of legs/feet

  // dense per-pixel silhouette profile across the torso (shoulder .. leg limit)
  const profStartY = shoulderY, profEndY = legLimitY;
  const half = [], cxs = [];
  for (let y = profStartY; y <= profEndY; y++) {
    const s = rowSpan(data, W, y);
    if (s) { half.push((s[1] - s[0]) / 2); cxs.push((s[0] + s[1]) / 2); }
    else { half.push(half.length ? half[half.length - 1] : neck.w / 2); cxs.push(cxs.length ? cxs[cxs.length - 1] : neck.cx); }
  }
  const chestI = Math.max(0, Math.min(half.length - 1, a.chest.y - profStartY));
  const bodyCx = Math.round(cxs[chestI]);
  const legFeetY = Math.round(a.bbox.y1 - h * 0.10);   // feet line (garments must stay above)

  // front-leg centre: midpoint of the foot silhouette near the ground (the stance centre
  // between the two front legs). Garments are horizontally centred on this.
  let flo = 1e9, fhi = -1;
  for (let y = Math.round(a.bbox.y1 - h * 0.05); y <= a.bbox.y1 - 2; y++) { const s = rowSpan(data, W, y); if (s) { flo = Math.min(flo, s[0]); fhi = Math.max(fhi, s[1]); } }
  const legCx = fhi >= 0 ? Math.round((flo + fhi) / 2) : bodyCx;

  return {
    name, h, bbox: a.bbox,
    neckW: neck.w, neckX: neck.cx, neckRowY: neck.y,
    shoulderY, chestY: a.chest.y, legLimitY, legFeetY, faceClearY, mouthClearY,
    profStartY, profEndY, half, cxs, bodyCx, legCx,
  };
}
// silhouette half-width (px) at a canvas y
function qHalf(m, y) { const i = Math.max(0, Math.min(m.half.length - 1, Math.round(y) - m.profStartY)); return m.half[i]; }
function qCx(m, y) { const i = Math.max(0, Math.min(m.cxs.length - 1, Math.round(y) - m.profStartY)); return m.cxs[i]; }

// ---------------- per-archetype tuning ----------------
// Fill factor = how much of the measured silhouette the garment body spans.
// wmul nudges that per body; dyPx lifts/drops the whole garment; maxOver caps overhang.
const TUNE = {
  puff:    { wmul: 1.00, dyPx: 0 },
  curly:   { wmul: 1.00, dyPx: 0 },
  topknot: { wmul: 1.00, dyPx: 0 },
  cria:    { wmul: 0.90, dyPx: 6 },    // small cute proportions: pull in, sit slightly lower
  sleek:   { wmul: 1.18, dyPx: -8 },   // slim + tall: widen the garment, lift toward the neck
  scruffy: { wmul: 0.84, dyPx: 0 },    // stay inside the fluffy wool silhouette
  bramble: { wmul: 0.94, dyPx: 0 },    // wide body: fill without looking stretched
  elder:   { wmul: 0.94, dyPx: 0 },
};

// ---------------- shared drawing helpers ----------------
// fill a garment row [cxS-half .. cxS+half] with soft pixel shading; gapHalf>0 leaves
// a centre gap (open-front vest). left column = highlight, right column = shade.
function fillRow(S, cxS, halfC, row, fill, hi, sh, gapHalf = 0) {
  if (halfC <= 0) return;
  if (gapHalf > 0) {
    for (let x = -halfC; x <= -gapHalf; x++) S.set(cxS + x, row, x === -halfC ? hi : (x === -gapHalf ? sh : fill));
    for (let x = gapHalf; x <= halfC; x++) S.set(cxS + x, row, x === gapHalf ? hi : (x === halfC ? sh : fill));
  } else {
    for (let x = -halfC; x <= halfC; x++) S.set(cxS + x, row, x === -halfC ? hi : (x === halfC ? sh : fill));
  }
}
function disc(S, cx, cy, r, fill, hi, sh) {
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    for (let dx = -w; dx <= w; dx++) {
      let c = fill;
      if (sh && (dx > r * 0.35 || dy > r * 0.4)) c = sh;
      if (hi && dx < -r * 0.3 && dy < -r * 0.2) c = hi;
      S.set(cx + dx, cy + dy, c);
    }
  }
}
// how many cells the garment half-width should be at canvas y, hugging the silhouette and
// clamped so a symmetric fill centred on hx can never cross the body's left/right envelope
// (kills float where the placement centre is off from the per-row silhouette centre).
function fitHalfAt(m, y, hx, factor, tune, maxOver = 1.0) {
  const i = Math.max(0, Math.min(m.half.length - 1, Math.round(y) - m.profStartY));
  const sil = m.half[i], rc = m.cxs[i];
  const usable = Math.max(0, Math.min(hx - (rc - sil), (rc + sil) - hx));  // room to the nearer edge
  let want = sil * factor * tune.wmul;
  want = Math.min(want, sil * maxOver, usable);
  return Math.max(0, Math.round(want / CELL));
}

// ---------------- garment: Farmer Overalls ----------------
// denim bib over chest/belly + two shoulder straps with brass buttons + a front pocket
function drawOveralls(m, tune, hx) {
  const topPad = 5;                                   // rows above the bib for straps
  const bibTopY = m.shoulderY + Math.round(m.h * 0.03) + tune.dyPx;
  const bibBotY = m.legLimitY - Math.round(m.h * 0.02);
  const rows = Math.max(6, Math.round((bibBotY - bibTopY) / CELL));
  const factor = 0.60;
  let maxHalf = 0;
  const rowHalf = [];
  for (let r = 0; r <= rows; r++) { const y = bibTopY + r * CELL + CELL / 2; const hc = fitHalfAt(m, y, hx, factor, tune); rowHalf.push(hc); if (hc > maxHalf) maxHalf = hc; }
  const Wc = 2 * maxHalf + 8, Hc = topPad + rows + 4, cxS = Math.floor(Wc / 2);
  const S = new Sprite(Wc, Hc);

  // shoulder straps: rise from the bib top to the neck sides, but never above the mouth
  const topHalf = rowHalf[0];
  const strapX = Math.max(2, Math.round(topHalf * 0.52));
  const strapW = Math.max(1, Math.round(topHalf * 0.18));
  const minStrapRow = Math.max(0, topPad - Math.floor((bibTopY - m.mouthClearY) / CELL));
  for (const sx of [-strapX, strapX]) {
    for (let r = minStrapRow; r <= topPad; r++) for (let k = -strapW; k <= strapW; k++) {
      const x = cxS + sx + k;
      S.set(x, r, k === -strapW ? P.denimL : (k === strapW ? P.denimD : P.denimM));
    }
  }
  // bib body (hugs the silhouette per row)
  for (let r = 0; r <= rows; r++) fillRow(S, cxS, rowHalf[r], topPad + r, P.denimM, P.denimL, P.denimD);
  // brass buttons where straps meet the bib
  disc(S, cxS - strapX, topPad, 1, P.goldM, P.goldL, P.goldD);
  disc(S, cxS + strapX, topPad, 1, P.goldM, P.goldL, P.goldD);
  // front pocket (darker denim, centred on the belly)
  const pkTop = topPad + Math.round(rows * 0.42), pkBot = topPad + Math.round(rows * 0.78);
  const pkHalf = Math.max(2, Math.round(rowHalf[Math.round(rows * 0.6)] * 0.5));
  for (let r = pkTop; r <= pkBot; r++) fillRow(S, cxS, pkHalf, r, P.denimD, P.denimM, P.denimD);
  for (let x = -pkHalf; x <= pkHalf; x++) S.set(cxS + x, pkTop, P.denimL);
  for (let r = pkTop + 1; r <= pkBot; r++) S.set(cxS, r, P.denimL);

  S.autoOutline(P.outline, false);
  return { S, cxS, anchorY: bibTopY, anchorRow: topPad };
}

// ---------------- garment: Farm Vest ----------------
// open-front quilted gilet: two side panels + folded collar, centre wool shows through
function drawVest(m, tune, hx) {
  const topPad = 3;
  const topY = m.shoulderY + Math.round(m.h * 0.01) + tune.dyPx;
  const botY = m.legLimitY - Math.round(m.h * 0.05);
  const rows = Math.max(5, Math.round((botY - topY) / CELL));
  const factor = 0.64;
  let maxHalf = 0; const rowHalf = [];
  for (let r = 0; r <= rows; r++) { const y = topY + r * CELL + CELL / 2; const hc = fitHalfAt(m, y, hx, factor, tune); rowHalf.push(hc); if (hc > maxHalf) maxHalf = hc; }
  const Wc = 2 * maxHalf + 8, Hc = topPad + rows + 4, cxS = Math.floor(Wc / 2);
  const S = new Sprite(Wc, Hc);

  for (let r = 0; r <= rows; r++) {
    const hc = rowHalf[r];
    const gap = Math.max(2, Math.round(hc * 0.34));       // open centre showing wool
    fillRow(S, cxS, hc, topPad + r, P.greenM, P.greenL, P.greenD, gap);
    if (r % 3 === 2) {                                    // quilt stitch rows
      for (let x = -hc + 1; x <= -gap - 1; x++) S.set(cxS + x, topPad + r, P.greenD);
      for (let x = gap + 1; x <= hc - 1; x++) S.set(cxS + x, topPad + r, P.greenD);
    }
  }
  // folded collar at the shoulders
  const hc0 = rowHalf[0], gap0 = Math.max(2, Math.round(hc0 * 0.34));
  for (const s of [-1, 1]) {
    for (let r = 0; r < topPad; r++) {
      const x0 = s < 0 ? -hc0 : gap0, x1 = s < 0 ? -gap0 : hc0;
      for (let x = x0; x <= x1; x++) S.set(cxS + x, r + topPad - 1, r === 0 ? P.greenL : P.greenM);
    }
  }
  for (let x = -hc0; x <= -gap0; x++) S.set(cxS + x, topPad - 1, P.white);
  for (let x = gap0; x <= hc0; x++) S.set(cxS + x, topPad - 1, P.white);
  // wooden toggle buttons on the inner edges
  disc(S, cxS - gap0 - 1, topPad + 2, 1, P.woodM, P.woodL, P.woodD);
  disc(S, cxS - gap0 - 1, topPad + Math.round(rows * 0.45), 1, P.woodM, P.woodL, P.woodD);

  S.autoOutline(P.outline, false);
  return { S, cxS, anchorY: topY, anchorRow: topPad };
}

// ---------------- garment: Explorer Cape ----------------
// collar band at the neck + trapezoid cape flaring toward the chest + gold clasp
function drawCape(m, tune, hx) {
  const topPad = 3;
  const collarY = Math.max(m.mouthClearY + topPad * CELL, m.shoulderY - Math.round(m.h * 0.02)) + tune.dyPx;
  const botY = Math.round(m.chestY + m.h * 0.10);
  const rows = Math.max(6, Math.round((botY - collarY) / CELL));
  let maxHalf = 0; const rowHalf = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;                                   // flare 0.52 -> ~0.95 of silhouette
    const factor = 0.52 + t * 0.43;
    const y = collarY + r * CELL + CELL / 2;
    const hc = fitHalfAt(m, y, hx, factor, tune, 1.0);
    rowHalf.push(hc); if (hc > maxHalf) maxHalf = hc;
  }
  const Wc = 2 * maxHalf + 8, Hc = topPad + rows + 4, cxS = Math.floor(Wc / 2);
  const S = new Sprite(Wc, Hc);

  // collar band across the neck — sized to the neck width at the collar's own height so it
  // doesn't overhang the (narrower) neck above the shoulder line
  const collarNeckHalf = fitHalfAt(m, collarY - Math.round(topPad * CELL / 2), hx, 0.85, tune);
  const collarHalf = Math.max(3, Math.min(Math.round(rowHalf[0] * 0.9), collarNeckHalf || 3));
  for (let r = 0; r < topPad; r++) fillRow(S, cxS, collarHalf, r, P.purpM, P.purpL, P.purpD);
  // cape body
  for (let r = 0; r <= rows; r++) fillRow(S, cxS, rowHalf[r], topPad + r, P.purpM, P.purpL, P.purpD);
  // soft vertical drape folds
  const foldMax = rowHalf[rows];
  for (const f of [-Math.round(foldMax * 0.5), 0, Math.round(foldMax * 0.5)]) for (let r = 1; r <= rows; r += 2) S.set(cxS + f, topPad + r, P.purpD);
  // gold clasp at the throat
  disc(S, cxS, 1, 2, P.goldM, P.goldL, P.goldD);

  S.autoOutline(P.outline, false);
  return { S, cxS, anchorY: collarY, anchorRow: topPad };
}

// ---------------- garment: Festival Ribbon Outfit ----------------
// diagonal harvest sash across the chest + rosette + two hanging ribbons + tiny bell
function drawRibbon(m, tune, hx) {
  const topPad = 2;
  // keep the sash compact + high enough that the rosette and tails clear the legs on short bodies
  const botY = Math.min(Math.round(m.chestY + m.h * 0.06), m.legFeetY - 4 * CELL);
  const topY = Math.min(m.shoulderY + Math.round(m.h * 0.02) + Math.min(tune.dyPx, 0), botY - 5 * CELL);
  const sashSpanY = botY - topY;
  const sashHalf = Math.max(4, fitHalfAt(m, m.chestY, hx, 0.92, tune));   // horizontal reach in cells (clamped to body)
  const th = Math.max(3, Math.round(m.neckW * 0.09 / CELL));   // sash thickness in cells
  const rowsY = Math.max(5, Math.round(sashSpanY / CELL));

  const Wc = 2 * sashHalf + 10, Hc = topPad + rowsY + th + 12, cxS = Math.floor(Wc / 2);
  const S = new Sprite(Wc, Hc);

  // diagonal band from left-shoulder (top-left) to right-hip (bottom-right)
  for (let r = 0; r <= rowsY; r++) {
    const t = r / rowsY;
    const x = Math.round(-sashHalf + t * 2 * sashHalf);
    for (let k = 0; k < th; k++) {
      const c = k === 0 ? P.berryL : (k >= th - 1 ? P.berryD : P.berryM);
      S.set(cxS + x, topPad + r + k, c);
    }
  }
  // rosette high on the chest (leaves room for the tails above the legs)
  const rx = cxS, ry = topPad + Math.round(rowsY * 0.38) + 1;
  for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, -2], [-2, 2], [2, 2]]) disc(S, rx + dx, ry + dy, 1, P.goldL, P.white, P.goldM);
  disc(S, rx, ry, 2, P.berryL, P.white, P.berryM);
  disc(S, rx, ry, 1, P.goldM, P.goldL, P.goldD);
  // two hanging ribbon tails + tiny bell — clamped so the tips stay above the feet line
  const rosetteCanvasY = topY + (ry - topPad) * CELL;
  const tailRoom = Math.floor((m.legFeetY - rosetteCanvasY) / CELL) - 4;
  const tailLen = Math.max(2, Math.min(Math.round(rowsY * 0.5), tailRoom));
  for (let i = 0; i <= tailLen; i++) { S.set(rx - 2, ry + 3 + i, i % 2 ? P.berryD : P.berryM); S.set(rx - 1, ry + 3 + i, P.berryL); }
  for (let i = 0; i <= tailLen - 2; i++) { S.set(rx + 2, ry + 3 + i, i % 2 ? P.goldD : P.goldM); S.set(rx + 1, ry + 3 + i, P.goldL); }
  disc(S, rx + 2, ry + 4 + Math.max(0, tailLen - 2), 1, P.goldM, P.goldL, P.goldD);

  S.autoOutline(P.outline, false);
  // anchor row aligns the sash's vertical centre with the chest
  return { S, cxS, anchorY: topY, anchorRow: topPad };
}

// Per-garment fitting hierarchy. hRef picks the horizontal placement reference:
//   "leg"  -> front-leg stance centre (m.legCx)
//   "body" -> body/silhouette centre (m.bodyCx)
// Vertical + scale references are baked into each draw* function (documented inline).
// Genesis clothing pool (torso garments handled here): only Festival Ribbon Outfit.
// The Cozy Wool Scarf is neck-based and generated by adaptive-scarf.mjs.
// Farmer Overalls / Farm Vest / Explorer Cape were removed (too human/RPG-like); their
// draw* functions are retained above for reference/history but are not in the pool.
const GARMENTS = {
  "festival-ribbon": { name: "Festival Ribbon Outfit", draw: drawRibbon, hRef: "body", note: {
    adjustments: [
      "Diagonal sash spans the measured chest width",
      "Sash thickness scales with neck width",
      "Rosette + tails centred on the chest",
      "Vertical span follows torso height",
      "Sleek widened; cria pulled in; scruffy inside wool",
    ],
    system: ["Measures chest W, neck W, torso height", "Generates a fitted variant PNG per archetype", "Prevents clipping into wool / covering the face", "Keeps the festive sash identity"],
    footer: "Same festival identity. Geometry is generated per archetype so each alpaca truly wears it.",
  } },
};

// ---------------- render / place ----------------
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
async function placeAdaptive(id, name) {
  const m = await measure(name);
  const tune = TUNE[name];
  const hx = GARMENTS[id].hRef === "leg" ? m.legCx : m.bodyCx;
  const { S, cxS, anchorY, anchorRow } = GARMENTS[id].draw(m, tune, hx);
  const box = contentBox(S);
  const { buf, w, h } = renderCells(S, box);
  const left = Math.round(hx - (cxS - box.x0) * CELL);        // horizontal per the garment's hRef
  const top = Math.round(anchorY - (anchorRow - box.y0) * CELL);
  const variant = await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  const composite = await sharp(path.join(NORM, `${name}.png`)).composite([{ input: variant, left, top }]).png().toBuffer();
  return { variant, composite, left, top, m };
}

// ---------------- verification: clipping / floating / silhouette / face / legs ----------------
async function verify(name, variantBuf, left, top) {
  const a = anchors[name];
  const { data: bd, info: bi } = await baseRaw(name);
  // per-row silhouette envelope [l,r]; interior gaps (e.g. between legs) count as "on body"
  const env = [];
  for (let y = 0; y < bi.height; y++) { const s = rowSpan(bd, bi.width, y); env.push(s ? [s[0], s[1]] : null); }
  const gv = await sharp(variantBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: gd, info: gi } = gv;
  const mouthLineY = Math.round(a.eye.lineY + a.bbox.h * 0.12);   // garment must stay below this
  const legLimitY = Math.round(a.bbox.y1 - a.bbox.h * 0.10);      // and above this (feet)
  let total = 0, offBody = 0, faceCover = 0, legClip = 0;
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
  for (let y = 0; y < gi.height; y++) for (let x = 0; x < gi.width; x++) {
    if (gd[(y * gi.width + x) * 4 + 3] <= 40) continue;
    total++;
    const cx = left + x, cy = top + y;
    if (cx < minX) minX = cx; if (cx > maxX) maxX = cx; if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
    if (cx < 0 || cx >= bi.width || cy < 0 || cy >= bi.height) { offBody++; continue; }
    const e = env[cy];
    if (!e || cx < e[0] - CELL || cx > e[1] + CELL) offBody++;   // outside envelope (+1 cell outline tolerance)
    if (cy < mouthLineY - CELL) faceCover++;                     // above the mouth (+1 cell outline tolerance)
    if (cy > legLimitY) legClip++;
  }
  const oob = minX < 0 || minY < 0 || maxX >= bi.width || maxY >= bi.height;
  return {
    total,
    offBodyPct: +(offBody / total * 100).toFixed(1),
    faceCoverPct: +(faceCover / total * 100).toFixed(1),
    legClipPct: +(legClip / total * 100).toFixed(1),
    oob,
  };
}
// thresholds (percent of garment opaque pixels)
const TH = { offBody: 12, faceCover: 0.5, legClip: 1.0 };
function verdict(v) {
  const fails = [];
  if (v.oob) fails.push("CLIP-CANVAS");
  if (v.offBodyPct > TH.offBody) fails.push(`FLOAT ${v.offBodyPct}%`);
  if (v.faceCoverPct > TH.faceCover) fails.push(`FACE ${v.faceCoverPct}%`);
  if (v.legClipPct > TH.legClip) fails.push(`LEG ${v.legClipPct}%`);
  return fails;
}

// ---------------- review rendering (matches the scarf sheet) ----------------
function label(text, w, size = 22, color = "#5b4636") {
  return Buffer.from(`<svg width="${w}" height="34"><text x="${w / 2}" y="25" font-family="Verdana" font-size="${size}" font-weight="bold" fill="${color}" text-anchor="middle">${esc(text)}</text></svg>`);
}
function cropWin(a) {
  const pad = 34;
  const exL = Math.max(0, a.bbox.x0 - pad), exT = Math.max(0, a.bbox.y0 - pad);
  return { left: exL, top: exT, width: Math.min(1024 - exL, a.bbox.w + pad * 2), height: Math.min(1024 - exT, a.bbox.h + pad * 2) };
}
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
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
async function grid(title, getComposite) {
  const COLS = 4, ROWS = 2, CELL2 = 300, PAD = 16, LBL = 30;
  const CW = CELL2 + PAD, CH = CELL2 + PAD + LBL;
  const SW = COLS * CW + PAD, SH = 56 + ROWS * CH + PAD;
  const comps = [{ input: label(title, SW, 30), top: 12, left: 0 }];
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

// ---------------- run ----------------
const only = process.env.ONLY ? process.env.ONLY.split(",") : Object.keys(GARMENTS);
const report = [];
let fails = 0, tested = 0;
for (const id of only) {
  const g = GARMENTS[id];
  const VAR = path.join(CLO, id);
  fs.mkdirSync(VAR, { recursive: true });
  const cache = {};
  for (const name of ARCHES) {
    const { variant, composite, left, top } = await placeAdaptive(id, name);
    await sharp(variant).toFile(path.join(VAR, `${name}.png`));
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: CARD } }).composite([{ input: composite }]).png().toFile(path.join(PREV, `${id}__${name}.png`));
    cache[name] = composite;
    const v = await verify(name, variant, left, top);
    const f = verdict(v);
    tested++; if (f.length) fails++;
    report.push({ id, name, ...v, status: f.length ? f.join(", ") : "OK" });
  }
  const { comps, SW, SH } = await grid(`${g.name} — fits all 8 archetypes`, (n) => cache[n]);
  const panel = buildPanel(SW, g.note);
  comps.push({ input: panel.buf, top: SH, left: 0 });
  await sharp({ create: { width: SW, height: SH + panel.height, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } }).composite(comps).png().toFile(path.join(PREV, `${id}__contact.png`));
  console.log(`wrote ${id}__contact.png (+ 8 variants + 8 composites)`);
}

console.log("\n=== CLOTHING VERIFICATION (4 torso garments) ===");
console.log("garment          arch      off-body  face   leg    status");
for (const r of report) {
  console.log(`${r.id.padEnd(16)} ${r.name.padEnd(8)} ${String(r.offBodyPct).padStart(6)}%  ${String(r.faceCoverPct).padStart(4)}% ${String(r.legClipPct).padStart(5)}%  ${r.status}`);
}
console.log(`\n${tested - fails}/${tested} clean, ${fails} flagged.`);
if (process.env.WRITE_REPORT) fs.writeFileSync(path.join(PREV, "_clothing-verify.json"), JSON.stringify(report, null, 2));
