// Build the HANSOME Genesis base-body family:
//  1. Strip the flat background from each archetype -> transparent PNG (pixel-clean,
//     border flood-fill; the alpaca is protected by its dark outline).
//  2. Compute the silhouette bounding box for each.
//  3. Emit a family contact sheet for review.
//
// Sources: public/pixel/traits/base/_source/*.png  (white-background originals)
// Outputs: public/pixel/traits/base/<name>.png     (transparent)
//          public/pixel/traits/base/_family-contact-sheet.png
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const BASE = "public/pixel/traits/base";
const SRC = path.join(BASE, "_source");

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

  const outPath = path.join(BASE, `${name}.png`);
  await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: ch } })
    .png()
    .toFile(outPath);

  const bbox = { x0: minX, y0: minY, x1: maxX, y1: maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
  console.log(`  ${name.padEnd(8)} bbox=[${bbox.x0},${bbox.y0} .. ${bbox.x1},${bbox.y1}] ${bbox.w}x${bbox.h} kept=${kept}`);
  return { name, W, H, bbox };
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
    const trait = await sharp(path.join(BASE, `${name}.png`))
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

const results = [];
console.log("stripping backgrounds...");
for (const [name] of FAMILY) results.push(await stripBackground(name));
fs.writeFileSync(path.join(BASE, "_bbox.json"), JSON.stringify(Object.fromEntries(results.map((r) => [r.name, r.bbox])), null, 2));
await buildContactSheet(results);
console.log("done.");
