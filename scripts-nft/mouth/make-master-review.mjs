// Combine every mouth review image into ONE tall PNG for a single-file visual review.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const PREV = "public/pixel/traits/mouth/previews";
const order = [
  "_MOUTH-ANCHORS.png",
  "_ALL-MOUTH.png",
  "_COMPARISON-puff.png",
  "fresh-grass__contact.png",
  "wheat__contact.png",
  "white-flower__contact.png",
  "lavender__contact.png",
  "four-leaf-clover__contact.png",
];
const GAP = 40, MARGIN = 40, BG = { r: 234, g: 224, b: 205, alpha: 1 };
const tiles = [];
let maxW = 0;
for (const f of order) { const buf = fs.readFileSync(path.join(PREV, f)); const m = await sharp(buf).metadata(); tiles.push({ buf, w: m.width, h: m.height }); maxW = Math.max(maxW, m.width); }
const SW = maxW + MARGIN * 2;
const SH = MARGIN * 2 + tiles.reduce((s, t) => s + t.h, 0) + GAP * (tiles.length - 1);
const comps = []; let y = MARGIN;
for (const t of tiles) { comps.push({ input: t.buf, left: Math.round((SW - t.w) / 2), top: y }); y += t.h + GAP; }
const out = path.join(PREV, "_MASTER-REVIEW.png");
await sharp({ create: { width: SW, height: SH, channels: 4, background: BG } }).composite(comps).png().toFile(out);
console.log("wrote", out, `${SW}x${SH}`);
