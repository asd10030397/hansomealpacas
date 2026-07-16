// Detect per-archetype anatomy anchors for the HANSOME Genesis base family.
// For each transparent base PNG we locate:
//   crown  - top-center of the head (hat sits here)
//   earL/R - pink inner-ear centroids (ear accessories)
//   eyeL/R - dark eye clusters (glasses sit across these)
//   neck   - narrowest span below the head (necklace/collar line)
//   chest  - upper body center (clothing anchor)
// Output: public/pixel/traits/base/anchors.json  + an overlay review sheet.
//
// Detection is geometric/first-pass; the overlay sheet exists so anchors can be
// eyeballed and hand-tuned before the trait-fitting pass.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const BASE = "public/pixel/traits/base";
const NAMES = ["puff", "curly", "topknot", "cria", "sleek", "scruffy", "bramble", "elder"];

function loadRaw(name) {
  return sharp(path.join(BASE, `${name}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function analyze(data, W, H) {
  const A = (x, y) => data[(y * W + x) * 4 + 3];
  const px = (x, y) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };

  // silhouette bbox + per-row span
  let minX = W, minY = H, maxX = 0, maxY = 0;
  const rowL = new Int32Array(H).fill(-1);
  const rowR = new Int32Array(H).fill(-1);
  for (let y = 0; y < H; y++) {
    let l = -1, r = -1;
    for (let x = 0; x < W; x++) {
      if (A(x, y) > 40) { if (l < 0) l = x; r = x; }
    }
    rowL[y] = l; rowR[y] = r;
    if (l >= 0) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (l < minX) minX = l;
      if (r > maxX) maxX = r;
    }
  }
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const cx = Math.round((minX + maxX) / 2);

  // crown: top-center of the head. Use the silhouette center for x (robust against
  // stray wool tufts that skew the top-row span), and the topmost opaque row for y.
  const crown = { x: cx, y: minY };

  // pink inner-ear clusters, restricted to the top 32% of the silhouette (excludes nose)
  const earMaxY = minY + Math.round(h * 0.32);
  const pinkPts = [];
  for (let y = minY; y <= earMaxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const [r, g, b, a] = px(x, y);
      if (a > 128 && r > 175 && r - g > 22 && r - b > 12 && g > 85 && b > 80) pinkPts.push([x, y]);
    }
  }
  const earL = pinkPts.length ? centroid(pinkPts.filter((p) => p[0] < cx)) : null;
  const earR = pinkPts.length ? centroid(pinkPts.filter((p) => p[0] >= cx)) : null;

  // dark eye clusters: near-black, interior (all neighbours opaque), central-upper face band
  const eyeY0 = minY + Math.round(h * 0.08), eyeY1 = minY + Math.round(h * 0.46);
  const eyeX0 = cx - Math.round(w * 0.33), eyeX1 = cx + Math.round(w * 0.33);
  const darkPts = [];
  for (let y = eyeY0; y <= eyeY1; y++) {
    for (let x = eyeX0; x <= eyeX1; x++) {
      const [r, g, b, a] = px(x, y);
      if (a > 128 && Math.max(r, g, b) < 82) {
        // interior check
        if (A(x - 1, y) > 128 && A(x + 1, y) > 128 && A(x, y - 1) > 128 && A(x, y + 1) > 128) darkPts.push([x, y]);
      }
    }
  }
  const leftDark = darkPts.filter((p) => p[0] < cx);
  const rightDark = darkPts.filter((p) => p[0] >= cx);
  let eyeL = leftDark.length > 8 ? centroid(leftDark) : null;
  let eyeR = rightDark.length > 8 ? centroid(rightDark) : null;
  // fallback for wool-covered / low-contrast eyes
  if (!eyeL) eyeL = { x: cx - Math.round(w * 0.12), y: minY + Math.round(h * 0.27), fallback: true };
  if (!eyeR) eyeR = { x: cx + Math.round(w * 0.12), y: minY + Math.round(h * 0.27), fallback: true };
  const eyeLineY = Math.round((eyeL.y + eyeR.y) / 2);

  // neck: narrowest opaque span in the band just below the eyes
  const nb0 = eyeLineY + Math.round(h * 0.10), nb1 = eyeLineY + Math.round(h * 0.42);
  let neckY = nb0, neckW = Infinity;
  for (let y = nb0; y <= Math.min(nb1, maxY); y++) {
    if (rowL[y] < 0) continue;
    const ww = rowR[y] - rowL[y];
    if (ww < neckW) { neckW = ww; neckY = y; }
  }
  const neck = { x: Math.round((rowL[neckY] + rowR[neckY]) / 2), y: neckY };

  // chest: body center a little below the neck
  const chestY = Math.min(maxY - 1, neckY + Math.round(h * 0.16));
  const chest = { x: Math.round((rowL[chestY] + rowR[chestY]) / 2), y: chestY };

  return {
    bbox: { x0: minX, y0: minY, x1: maxX, y1: maxY, w, h },
    center: cx,
    crown,
    ear: { left: earL, right: earR },
    eye: { left: eyeL, right: eyeR, lineY: eyeLineY },
    neck,
    chest,
    ground: maxY,
  };
}

function centroid(pts) {
  if (!pts || !pts.length) return null;
  let sx = 0, sy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; }
  return { x: Math.round(sx / pts.length), y: Math.round(sy / pts.length) };
}

function overlaySvg(W, H, a, label) {
  const m = [];
  const dot = (p, color, r = 9) => p && m.push(`<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${color}" stroke="#000" stroke-width="2"/>`);
  const line = (p1, p2, color) => (p1 && p2) && m.push(`<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${color}" stroke-width="3"/>`);
  // bbox
  m.push(`<rect x="${a.bbox.x0}" y="${a.bbox.y0}" width="${a.bbox.w}" height="${a.bbox.h}" fill="none" stroke="#999" stroke-width="2" stroke-dasharray="10 8"/>`);
  line(a.eye.left, a.eye.right, "#1e6bff");
  dot(a.crown, "#ff2d2d");
  dot(a.ear.left, "#ff29c3"); dot(a.ear.right, "#ff29c3");
  dot(a.eye.left, "#1e6bff"); dot(a.eye.right, "#1e6bff");
  dot(a.neck, "#12b81f"); dot(a.chest, "#ff8c00", 11);
  m.push(`<text x="20" y="46" font-family="Verdana" font-size="34" font-weight="bold" fill="#5b4636">${label}</text>`);
  return Buffer.from(`<svg width="${W}" height="${H}">${m.join("")}</svg>`);
}

const anchors = {};
const cells = [];
const CELL = 340;
for (const name of NAMES) {
  const { data, info } = await loadRaw(name);
  const a = analyze(data, info.width, info.height);
  anchors[name] = a;
  const over = overlaySvg(info.width, info.height, a, name);
  const flat = await sharp({ create: { width: info.width, height: info.height, channels: 4, background: { r: 255, g: 252, b: 245, alpha: 1 } } })
    .composite([{ input: path.join(BASE, `${name}.png`) }, { input: over }])
    .png().toBuffer();
  cells.push(await sharp(flat).resize(CELL, CELL, { fit: "contain", background: { r: 255, g: 252, b: 245, alpha: 1 } }).png().toBuffer());
  const ef = a.eye.left.fallback || a.eye.right.fallback ? " (eye=fallback)" : "";
  console.log(`${name.padEnd(8)} crown(${a.crown.x},${a.crown.y}) eyeY=${a.eye.lineY} neck(${a.neck.x},${a.neck.y}) chest(${a.chest.x},${a.chest.y})${ef}`);
}

fs.writeFileSync(path.join(BASE, "anchors.json"), JSON.stringify({
  note: "First-pass geometric anchors on the 1024x1024 canvas. crown=hat, ear=ear accessory, eye=glasses line, neck=necklace, chest=clothing. Verify against _anchors-overlay.png before trait-fitting.",
  canvas: { width: 1024, height: 1024 },
  legend: { crown: "red", ear: "magenta", eye: "blue", neck: "green", chest: "orange" },
  archetypes: anchors,
}, null, 2));

// contact sheet of overlays (4x2)
const COLS = 4, ROWS = 2, PAD = 16;
const SW = COLS * (CELL + PAD) + PAD, SH = ROWS * (CELL + PAD) + PAD + 50;
const comp = [{ input: Buffer.from(`<svg width="${SW}" height="50"><text x="${SW / 2}" y="36" font-family="Verdana" font-size="28" font-weight="bold" fill="#5b4636" text-anchor="middle">Base Anatomy Anchors — crown/ear/eye/neck/chest</text></svg>`), top: 8, left: 0 }];
cells.forEach((buf, i) => {
  const c = i % COLS, r = Math.floor(i / COLS);
  comp.push({ input: buf, top: 50 + PAD + r * (CELL + PAD), left: PAD + c * (CELL + PAD) });
});
await sharp({ create: { width: SW, height: SH, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } })
  .composite(comp).png().toFile(path.join(BASE, "_anchors-overlay.png"));
console.log("wrote anchors.json + _anchors-overlay.png");
