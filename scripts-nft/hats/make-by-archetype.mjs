// Build ONE grid: 8 archetypes (rows) x 5 hats (columns), from the existing composites.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const PREV = "public/pixel/traits/hats/previews";
const ARCHES = ["puff", "curly", "topknot", "cria", "sleek", "scruffy", "bramble", "elder"];
const HATS = [
  ["straw-hat", "Straw Sun Hat"],
  ["wool-beanie", "Wool Beanie"],
  ["bobble-hat", "Bobble Hat"],
  ["cloth-cap", "Cloth Cap"],
  ["flower-crown", "Flower Crown"],
];
const CARD = { r: 255, g: 252, b: 245, alpha: 1 };
const BG = { r: 234, g: 224, b: 205, alpha: 1 };
const CELL = 240, PAD = 12, HEAD = 46, ROWLBL = 96, TITLE = 56;

function label(text, w, size = 22, x = null) {
  return Buffer.from(`<svg width="${w}" height="34"><text x="${x ?? w / 2}" y="25" font-family="Verdana" font-size="${size}" font-weight="bold" fill="#5b4636" text-anchor="${x ? "start" : "middle"}">${text}</text></svg>`);
}

const GW = ROWLBL + HATS.length * (CELL + PAD) + PAD;
const GH = TITLE + HEAD + ARCHES.length * (CELL + PAD) + PAD;
const comps = [{ input: label("HANSOME Genesis — 8 archetypes x 5 hats", GW, 30), top: 14, left: 0 }];

// column headers
for (let c = 0; c < HATS.length; c++) {
  const x0 = ROWLBL + PAD + c * (CELL + PAD);
  comps.push({ input: label(HATS[c][1], CELL, 20), top: TITLE, left: x0 });
}

for (let r = 0; r < ARCHES.length; r++) {
  const name = ARCHES[r];
  const y0 = TITLE + HEAD + r * (CELL + PAD);
  comps.push({ input: label(name, ROWLBL - 4, 20, 8), top: y0 + CELL / 2 - 16, left: 4 });
  for (let c = 0; c < HATS.length; c++) {
    const x0 = ROWLBL + PAD + c * (CELL + PAD);
    const src = path.join(PREV, `${HATS[c][0]}__${name}.png`);
    const cell = await sharp(src).resize(CELL, CELL, { fit: "contain", background: CARD, kernel: "nearest" }).png().toBuffer();
    comps.push({ input: await sharp({ create: { width: CELL, height: CELL, channels: 4, background: CARD } }).png().toBuffer(), top: y0, left: x0 });
    comps.push({ input: cell, top: y0, left: x0 });
  }
}

const out = path.join(PREV, "_BY-ARCHETYPE.png");
await sharp({ create: { width: GW, height: GH, channels: 4, background: BG } }).composite(comps).png().toFile(out);
console.log("wrote", out, `${GW}x${GH}`);
