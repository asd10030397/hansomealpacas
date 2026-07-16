// Build the HANSOME Genesis base-body family:
//  1. Strip the flat background from each archetype -> transparent PNG (pixel-clean,
//     border flood-fill; the alpaca is protected by its dark outline).
//  2. Preserve the ORIGINAL (unframed) transparent artwork  -> base/original/<name>.png
//     (the visual source of truth for NFT portrait generation).
//  3. Produce the NORMALIZED avatar-frame artwork           -> base/normalized/<name>.png
//     (uniform scale, ground-aligned, centered; for avatar proportions, rigging,
//      trait fitting, and HANSOME HUB rendering).
//  4. Emit a full frame-transform document + a family contact sheet.
//
// Pixel art only: ALL scaling is nearest-neighbor. No smoothing / soft interpolation.
//
// Sources: public/pixel/traits/base/_source/*.png  (white-background originals)
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const BASE = "public/pixel/traits/base";
const SRC = path.join(BASE, "_source");
const ORIG = path.join(BASE, "original");
const NORM = path.join(BASE, "normalized");
fs.mkdirSync(ORIG, { recursive: true });
fs.mkdirSync(NORM, { recursive: true });

// name -> short personality label for the contact sheet
const FAMILY = [
  ["puff", "Puff · cozy"],
  ["curly", "Curly · sweet"],
  ["topknot", "Topknot · tidy"],
  ["cria", "Cria · baby"],
  ["sleek", "Sleek · elegant"],
  ["scruffy", "Scruffy · cheeky"],
  ["bramble", "Bramble · sleepy"],
  ["elder", "Elder · wise"],
];

// A pixel is "background" if it is light and near-neutral (white card + soft gray shadow).
function isBg(r, g, b) {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= 205 && max - min <= 22;
}

async function stripBackground(name) {
  const srcPath = path.join(SRC, `${name}.png`);
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const ch = info.channels; // 4
  const idx = (x, y) => (y * W + x) * ch;

  // Flood fill from every border pixel across background-colored, connected regions.
  const visited = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const p = y * W + x;
    if (visited[p]) return;
    const i = idx(x, y);
    if (!isBg(data[i], data[i + 1], data[i + 2])) return;
    visited[p] = 1;
    stack.push(x, y);
  };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    push(x + 1, y + 1); push(x - 1, y - 1); push(x + 1, y - 1); push(x - 1, y + 1);
  }

  // Clear alpha on the flooded background.
  let minX = W, minY = H, maxX = 0, maxY = 0, kept = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const i = idx(x, y);
      if (visited[p]) {
        data[i + 3] = 0;
      } else if (data[i + 3] > 16) {
        kept++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  const bbox = { x0: minX, y0: minY, x1: maxX, y1: maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
  const stripped = await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: ch } }).png().toBuffer();
  console.log(`  ${name.padEnd(8)} rawbbox=[${bbox.x0},${bbox.y0} .. ${bbox.x1},${bbox.y1}] ${bbox.w}x${bbox.h} kept=${kept}`);
  return { name, W, H, bbox, stripped };
}

// Canonical avatar frame: reserve headroom (hats) and margins (effects) so every
// trait fits within the 1024 canvas. One uniform scale across the family preserves
// each archetype's relative size/personality; all are ground-aligned + centered.
const FRAME = { canvas: 1024, groundY: 985, regionH: 745, centerX: 512 };

async function frameBase(r, SF) {
  const drawW = Math.max(1, Math.round(r.bbox.w * SF));
  const drawH = Math.max(1, Math.round(r.bbox.h * SF));
  const left = Math.round(FRAME.centerX - drawW / 2);
  const top = FRAME.groundY - drawH;
  const cut = await sharp(r.stripped).extract({ left: r.bbox.x0, top: r.bbox.y0, width: r.bbox.w, height: r.bbox.h })
    .resize(drawW, drawH, { kernel: "nearest" }).png().toBuffer();
  await sharp({ create: { width: FRAME.canvas, height: FRAME.canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: cut, left, top }]).png().toFile(path.join(NORM, `${r.name}.png`));
  const bbox = { x0: left, y0: top, x1: left + drawW - 1, y1: top + drawH - 1, w: drawW, h: drawH };
  console.log(`  ${r.name.padEnd(8)} framed=[${bbox.x0},${bbox.y0} .. ${bbox.x1},${bbox.y1}] ${bbox.w}x${bbox.h}`);
  return { ...r, origBbox: r.bbox, bbox, place: { left, top, drawW, drawH }, scale: SF };
}

async function buildContactSheet(results) {
  const COLS = 4, ROWS = 2;
  const CELL = 300, PAD = 28, LABEL = 40;
  const CW = CELL + PAD * 2;
  const CH = CELL + PAD + LABEL;
  const SW = COLS * CW;
  const SH = ROWS * CH + 70;

  const bg = {
    create: { width: SW, height: SH, channels: 4, background: { r: 247, g: 241, b: 227, alpha: 1 } },
  };
  const composites = [];

  const title = `<svg width="${SW}" height="60"><text x="${SW / 2}" y="42" font-family="Verdana" font-size="30" font-weight="bold" fill="#5b4636" text-anchor="middle">HANSOME Genesis — Base Archetype Family (8)</text></svg>`;
  composites.push({ input: Buffer.from(title), top: 8, left: 0 });

  for (let i = 0; i < FAMILY.length; i++) {
    const [name, label] = FAMILY[i];
    const r = results.find((x) => x.name === name);
    const col = i % COLS, row = Math.floor(i / COLS);
    const cellLeft = col * CW;
    const cellTop = 70 + row * CH;

    // card
    const card = await sharp({
      create: { width: CW - 12, height: CH - 12, channels: 4, background: { r: 255, g: 252, b: 245, alpha: 1 } },
    }).png().toBuffer();
    composites.push({ input: card, top: cellTop + 6, left: cellLeft + 6 });

    // trait, trimmed to bbox then fit into CELL
    const b = r.bbox;
    const trait = await sharp(path.join(NORM, `${name}.png`))
      .extract({ left: b.x0, top: b.y0, width: b.w, height: b.h })
      .resize(CELL, CELL, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "nearest" })
      .png().toBuffer();
    composites.push({ input: trait, top: cellTop + PAD, left: cellLeft + PAD });

    const lbl = `<svg width="${CW}" height="${LABEL}"><text x="${CW / 2}" y="26" font-family="Verdana" font-size="20" font-weight="bold" fill="#5b4636" text-anchor="middle">${label}</text></svg>`;
    composites.push({ input: Buffer.from(lbl), top: cellTop + PAD + CELL - 4, left: cellLeft });
  }

  const out = path.join(BASE, "_family-contact-sheet.png");
  await sharp(bg).composite(composites).png().toFile(out);
  console.log("contact sheet ->", out);
}

console.log("stripping backgrounds...");
const stripped = [];
for (const [name] of FAMILY) stripped.push(await stripBackground(name));

// (1) Preserve the ORIGINAL (unframed) transparent artwork — visual source of truth
// for NFT portrait generation. This is the stripped alpaca on the full 1024 canvas,
// with NO scaling/resampling applied (identity-preserving).
console.log("writing original (unframed) archetypes...");
for (const r of stripped) {
  await sharp(r.stripped).png().toFile(path.join(ORIG, `${r.name}.png`));
}

// (2) Produce the NORMALIZED avatar frame. Uniform scale so the tallest archetype fills
// the reserved region; preserves relative sizes. Nearest-neighbor only (no smoothing).
const maxH = Math.max(...stripped.map((r) => r.bbox.h));
const SF = FRAME.regionH / maxH;
console.log(`framing into canonical avatar frame (SF=${SF.toFixed(4)}, ground=${FRAME.groundY}, regionH=${FRAME.regionH})...`);
const results = [];
for (const r of stripped) results.push(await frameBase(r, SF));

fs.writeFileSync(path.join(BASE, "_bbox.json"), JSON.stringify({
  frame: FRAME, scaleFactor: +SF.toFixed(4),
  note: "Framed (post-normalization) bounding boxes on the 1024 canvas. One uniform scale keeps relative sizes; all ground-aligned + centered with headroom reserved for hats/effects.",
  boxes: Object.fromEntries(results.map((r) => [r.name, r.bbox])),
}, null, 2));

// (3) Full frame-transform document: original <-> normalized mapping for every archetype.
const transform = {
  canvas: FRAME.canvas,
  resampling: "nearest-neighbor",
  smoothing: false,
  interpolation: "none (pixel art; nearest-neighbor scaling only)",
  frame: FRAME,
  uniformScale: +SF.toFixed(6),
  scaleReference: "SF = FRAME.regionH / max(originalBboxHeight); one uniform scale for the whole family",
  groundAlignment: `all archetypes bottom-aligned to y=${FRAME.groundY}; horizontally centered on x=${FRAME.centerX}`,
  paths: {
    source: "public/pixel/traits/base/_source/<name>.png (white-background originals)",
    original: "public/pixel/traits/base/original/<name>.png (transparent, UNFRAMED — NFT portrait source of truth)",
    normalized: "public/pixel/traits/base/normalized/<name>.png (transparent, avatar-frame — trait fitting / HUB / rigging)",
  },
  anchors: {
    space: "NORMALIZED",
    file: "public/pixel/traits/base/anchors.json",
    note: "Anchors are detected in normalized space and used for trait fitting + HUB rendering.",
    mapToOriginal: "ox = origCenterX + (nx - 512) / SF ;  oy = origBottomY - (985 - ny) / SF",
    mapToNormalized: "nx = 512 + (ox - origCenterX) * SF ;  ny = 985 - (origBottomY - oy) * SF",
  },
  archetypes: Object.fromEntries(results.map((r) => {
    const o = r.origBbox, n = r.bbox;
    return [r.name, {
      original: {
        bbox: { x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1, w: o.w, h: o.h },
        centerX: Math.round((o.x0 + o.x1) / 2),
        bottomY: o.y1,
      },
      normalized: {
        bbox: { x0: n.x0, y0: n.y0, x1: n.x1, y1: n.y1, w: n.w, h: n.h },
        scale: +SF.toFixed(6),
        offset: { left: r.place.left, top: r.place.top },
        drawSize: { w: r.place.drawW, h: r.place.drawH },
        groundAlignedY: FRAME.groundY,
      },
      resampled: o.w !== n.w || o.h !== n.h ? "nearest-neighbor" : "none (1:1)",
    }];
  })),
};
fs.writeFileSync(path.join(BASE, "_frame-transform.json"), JSON.stringify(transform, null, 2));
console.log("frame-transform ->", path.join(BASE, "_frame-transform.json"));

await buildContactSheet(results);
console.log("done.");
