// Combine all clothing review images into one tall PNG for a single-file visual review.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const PREV = "public/pixel/traits/clothing/previews";
const meta = JSON.parse(fs.readFileSync("public/pixel/traits/clothing/_clothing-meta.json", "utf8"));
const order = ["_ALL-CLOTHING.png", "_COMPARISON-puff.png", ...Object.keys(meta).map((id) => `${id}__contact.png`)];

const imgs = [];
for (const f of order) {
  const p = path.join(PREV, f);
  if (!fs.existsSync(p)) continue;
  imgs.push(await sharp(p).png().toBuffer());
}
const metas = await Promise.all(imgs.map((b) => sharp(b).metadata()));
const W = Math.max(...metas.map((m) => m.width));
const GAP = 24;
const H = metas.reduce((s, m) => s + m.height, 0) + GAP * (imgs.length + 1);
const comps = [];
let y = GAP;
for (let i = 0; i < imgs.length; i++) { comps.push({ input: imgs[i], top: y, left: Math.round((W - metas[i].width) / 2) }); y += metas[i].height + GAP; }
const out = path.join(PREV, "_MASTER-REVIEW.png");
await sharp({ create: { width: W, height: H, channels: 4, background: { r: 222, g: 212, b: 193, alpha: 1 } } }).composite(comps).png().toFile(out);
console.log(`wrote ${out} ${W}x${H}`);
