import sharp from "sharp";
import fs from "node:fs";

const BASE = "public/pixel/alpaca-nft-master-base.png";
const T = "public/pixel/traits";
const PREV = `${T}/previews`;
const NEUTRAL_BG = `${T}/backgrounds/meadow-green.png`;

const worn = {
  hats: ["straw-hat", "farmer-cap", "wool-beanie", "acorn-cap", "flower-crown"],
  glasses: ["round-glasses", "reading-glasses", "sunglasses", "heart-glasses", "monocle"],
  clothing: ["wool-scarf", "knit-sweater", "cozy-poncho", "plaid-bandana", "denim-overalls"],
  necklaces: ["wooden-bead", "bell-collar", "daisy-chain", "berry-string", "clover-pendant"],
};
const backgrounds = ["meadow-green", "morning-sky", "sunset-pasture", "barn-wood", "starry-night"];

async function compositePreview(bgInput, layers, out) {
  await sharp(bgInput).composite(layers.map((input) => ({ input }))).png().toFile(out);
}

async function contactSheet(items, out, label) {
  const thumb = 300, pad = 14, labelH = 30;
  const cols = items.length;
  const sheetW = cols * thumb + (cols + 1) * pad;
  const sheetH = thumb + pad * 2 + labelH;
  const bg = { create: { width: sheetW, height: sheetH, channels: 4, background: { r: 28, g: 24, b: 20, alpha: 1 } } };
  const composites = [];
  for (let i = 0; i < items.length; i++) {
    const buf = await sharp(items[i].file).resize(thumb, thumb, { kernel: "nearest" }).png().toBuffer();
    composites.push({ input: buf, left: pad + i * (thumb + pad), top: pad });
    const txt = Buffer.from(
      `<svg width="${thumb}" height="${labelH}"><text x="${thumb / 2}" y="20" font-family="monospace" font-size="18" fill="#f2d9a0" text-anchor="middle">${items[i].name}</text></svg>`
    );
    composites.push({ input: txt, left: pad + i * (thumb + pad), top: thumb + pad });
  }
  await sharp(bg).composite(composites).png().toFile(out);
  console.log("sheet", out);
}

async function main() {
  if (!fs.existsSync(PREV)) fs.mkdirSync(PREV, { recursive: true });

  // worn items: meadow bg + base + trait
  for (const [cat, ids] of Object.entries(worn)) {
    for (const id of ids) {
      const out = `${PREV}/${cat}__${id}.png`;
      await compositePreview(NEUTRAL_BG, [BASE, `${T}/${cat}/${id}.png`], out);
    }
  }
  // backgrounds: bg + base
  for (const id of backgrounds) {
    const out = `${PREV}/backgrounds__${id}.png`;
    await compositePreview(`${T}/backgrounds/${id}.png`, [BASE], out);
  }

  // contact sheets per category
  for (const [cat, ids] of Object.entries(worn)) {
    await contactSheet(ids.map((id) => ({ file: `${PREV}/${cat}__${id}.png`, name: id })), `${PREV}/_sheet-${cat}.png`, cat);
  }
  await contactSheet(backgrounds.map((id) => ({ file: `${PREV}/backgrounds__${id}.png`, name: id })), `${PREV}/_sheet-backgrounds.png`, "backgrounds");

  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
