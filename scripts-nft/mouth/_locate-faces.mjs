// Dev helper: zoomed face crop per archetype with an ABSOLUTE-coordinate grid, so the
// mouth (bite) anchor can be read directly off the muzzle. Not a shipped asset.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const BASE = "public/pixel/traits/base";
const NORM = path.join(BASE, "normalized");
const OUT = path.join(BASE, "_face-locate");
fs.mkdirSync(OUT, { recursive: true });
const anchors = JSON.parse(fs.readFileSync(path.join(BASE, "anchors.json"), "utf8")).archetypes;
const ARCHES = ["puff", "curly", "topknot", "cria", "sleek", "scruffy", "bramble", "elder"];
const Z = 3, STEP = 20;

for (const n of ARCHES) {
  const a = anchors[n];
  const cx = Math.round((a.bbox.x0 + a.bbox.x1) / 2);
  const top = Math.max(0, a.eye.lineY - 45);
  const bot = Math.min(1024, a.eye.lineY + 185);
  const left = cx - 150, width = 300, height = bot - top;
  const crop = await sharp(path.join(NORM, `${n}.png`)).extract({ left, top, width, height })
    .resize(width * Z, height * Z, { kernel: "nearest" }).png().toBuffer();
  // grid + labels in absolute canvas coords
  let g = `<svg width="${width * Z}" height="${height * Z}">`;
  for (let x = Math.ceil(left / STEP) * STEP; x < left + width; x += STEP) {
    const px = (x - left) * Z;
    g += `<line x1="${px}" y1="0" x2="${px}" y2="${height * Z}" stroke="rgba(0,120,255,.35)" stroke-width="1"/>`;
    g += `<text x="${px + 2}" y="14" font-family="monospace" font-size="13" fill="#0059b3">${x}</text>`;
  }
  for (let y = Math.ceil(top / STEP) * STEP; y < bot; y += STEP) {
    const py = (y - top) * Z;
    g += `<line x1="0" y1="${py}" x2="${width * Z}" y2="${py}" stroke="rgba(0,120,255,.35)" stroke-width="1"/>`;
    g += `<text x="2" y="${py - 2}" font-family="monospace" font-size="13" fill="#0059b3">${y}</text>`;
  }
  g += `<text x="${width * Z / 2}" y="${height * Z - 8}" font-family="Verdana" font-size="22" font-weight="bold" fill="#b30000" text-anchor="middle">${n}  (cx=${cx})</text></svg>`;
  await sharp(crop).composite([{ input: Buffer.from(g), left: 0, top: 0 }]).png().toFile(path.join(OUT, `${n}.png`));
  console.log(n, "-> crop origin", { left, top }, "cx", cx);
}
console.log("wrote face-locate crops");
