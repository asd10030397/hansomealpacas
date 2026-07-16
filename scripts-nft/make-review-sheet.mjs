import sharp from "sharp";

const T = "public/pixel/traits";
const PREV = `${T}/previews`;
const BASE = "public/pixel/alpaca-nft-master-base.png";
const OUT = `${PREV}/_REVIEW-BATCH.png`;

const ROWS = [
  ["backgrounds", ["meadow-green", "morning-sky", "sunset-pasture", "barn-wood", "starry-night"]],
  ["hats", ["straw-hat", "farmer-cap", "wool-beanie", "acorn-cap", "flower-crown"]],
  ["glasses", ["round-glasses", "reading-glasses", "sunglasses", "heart-glasses", "monocle"]],
  ["clothing", ["wool-scarf", "knit-sweater", "cozy-poncho", "plaid-bandana", "denim-overalls"]],
  ["necklaces", ["wooden-bead", "bell-collar", "daisy-chain", "berry-string", "clover-pendant"]],
];

const THUMB = 150;
const MARGIN = 28;
const GAP = 18;
const CARD_W = THUMB * 2 + 8;
const HEADER_H = 78;
const LABEL_H = 34;
const SUBLABEL_H = 20;
const ROW_H = LABEL_H + THUMB + SUBLABEL_H + 16;

function checkerBuffer(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cell = Math.round(size / 8);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0 ? 208 : 232;
      const i = (y * size + x) * 4;
      buf[i] = c; buf[i + 1] = c; buf[i + 2] = c; buf[i + 3] = 255;
    }
  }
  return sharp(buf, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
}

function svgText(w, h, lines) {
  const parts = lines
    .map(
      (l) =>
        `<text x="${l.x}" y="${l.y}" font-family="monospace" font-size="${l.size}" font-weight="${l.weight || "normal"}" fill="${l.fill}" text-anchor="${l.anchor || "start"}">${l.text}</text>`
    )
    .join("");
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${parts}</svg>`);
}

async function main() {
  const checkerThumb = await checkerBuffer(THUMB);

  const cols = ROWS[0][1].length;
  const sheetW = MARGIN * 2 + cols * CARD_W + (cols - 1) * GAP;
  const sheetH = HEADER_H + ROWS.length * ROW_H + MARGIN;

  const composites = [];

  // title
  composites.push({
    input: svgText(sheetW, HEADER_H, [
      { x: MARGIN, y: 34, size: 26, weight: "bold", fill: "#f2d9a0", text: "HANSOME Genesis — Trait Review Batch" },
      { x: MARGIN, y: 60, size: 15, fill: "#c9b48a", text: "5 hats · 5 glasses · 5 clothing · 5 necklaces · 5 backgrounds     left = transparent overlay (checker) · right = composited on canonical alpaca" },
    ]),
    left: 0,
    top: 0,
  });

  for (let r = 0; r < ROWS.length; r++) {
    const [cat, ids] = ROWS[r];
    const rowTop = HEADER_H + r * ROW_H;
    for (let c = 0; c < ids.length; c++) {
      const id = ids[c];
      const cardLeft = MARGIN + c * (CARD_W + GAP);

      // label: category + name
      composites.push({
        input: svgText(CARD_W, LABEL_H, [
          { x: 0, y: 14, size: 12, weight: "bold", fill: "#8fbf6a", text: cat.toUpperCase() },
          { x: 0, y: 30, size: 15, weight: "bold", fill: "#f4ecd8", text: id.replace(/-/g, " ") },
        ]),
        left: cardLeft,
        top: rowTop,
      });

      // overlay thumb (transparent trait over checker). backgrounds: show raw bg.
      const traitPng = `${T}/${cat}/${id}.png`;
      let overlayBuf;
      if (cat === "backgrounds") {
        overlayBuf = await sharp(traitPng).resize(THUMB, THUMB, { kernel: "nearest" }).png().toBuffer();
      } else {
        const traitThumb = await sharp(traitPng).resize(THUMB, THUMB, { kernel: "nearest" }).png().toBuffer();
        overlayBuf = await sharp(checkerThumb).composite([{ input: traitThumb }]).png().toBuffer();
      }
      composites.push({ input: overlayBuf, left: cardLeft, top: rowTop + LABEL_H });

      // composited thumb
      const compBuf = await sharp(`${PREV}/${cat}__${id}.png`)
        .resize(THUMB, THUMB, { kernel: "nearest" })
        .png()
        .toBuffer();
      composites.push({ input: compBuf, left: cardLeft + THUMB + 8, top: rowTop + LABEL_H });

      // sublabels
      composites.push({
        input: svgText(CARD_W, SUBLABEL_H, [
          { x: THUMB / 2, y: 14, size: 11, fill: "#a79877", text: "overlay", anchor: "middle" },
          { x: THUMB + 8 + THUMB / 2, y: 14, size: 11, fill: "#a79877", text: "on alpaca", anchor: "middle" },
        ]),
        left: cardLeft,
        top: rowTop + LABEL_H + THUMB + 1,
      });
    }
  }

  await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: { r: 26, g: 22, b: 18, alpha: 1 } } })
    .composite(composites)
    .png()
    .toFile(OUT);
  console.log("wrote", OUT, `${sheetW}x${sheetH}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
