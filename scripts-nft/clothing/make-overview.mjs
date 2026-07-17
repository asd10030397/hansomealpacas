// Rebuild the clothing overview sheet from the CURRENT adaptive fits:
// top row = fitted trait PNG (transparent, on checker) for 'puff', bottom = composite on 'puff'.
import sharp from "sharp";
import path from "node:path";

const CLO = "public/pixel/traits/clothing";
const PREV = path.join(CLO, "previews");
const arch = "puff";
const items = [
  { id: "wool-scarf", name: "Cozy Wool Scarf", variant: `${CLO}/cozy-wool-scarf/${arch}.png` },
  { id: "festival-ribbon", name: "Festival Ribbon Outfit", variant: `${CLO}/festival-ribbon/${arch}.png` },
];

const anchors = JSON.parse((await import("node:fs")).readFileSync(`${CLO}/../base/anchors.json`, "utf8")).archetypes;
const a = anchors[arch];
const crop = { left: Math.max(0, a.bbox.x0 - 30), top: Math.max(0, a.bbox.y0 - 30), width: Math.min(1024, a.bbox.w + 60), height: Math.min(1024, a.bbox.h + 60) };

const THUMB = 150, CELLW = 200, TOP = 46, TROW = THUMB + 20, BROW = 300, LBL = 30;
const SW = items.length * CELLW + 20, SH = TOP + TROW + BROW + LBL + 20;

function checker(size) {
  const s = 12; const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const on = ((x / s | 0) + (y / s | 0)) % 2 === 0; const v = on ? 220 : 244; const i = (y * size + x) * 4; buf[i] = buf[i + 1] = buf[i + 2] = v; buf[i + 3] = 255; }
  return sharp(buf, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
}
function label(text, w, size, color) {
  return Buffer.from(`<svg width="${w}" height="34"><text x="${w / 2}" y="25" font-family="Verdana" font-size="${size}" font-weight="bold" fill="${color}" text-anchor="middle">${text}</text></svg>`);
}

const BG = { r: 226, g: 216, b: 197, alpha: 1 };
const CARD = { r: 255, g: 252, b: 245, alpha: 1 };
const comps = [{ input: label("Clothing — trait PNG + on 'Puff'", SW, 18, "#4a3a28"), top: 12, left: 0 }];
for (let i = 0; i < items.length; i++) {
  const it = items[i];
  const x0 = 10 + i * CELLW;
  const chk = await checker(THUMB);
  const tr = await sharp(it.variant).resize(THUMB - 20, THUMB - 20, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "nearest" }).png().toBuffer();
  const trThumb = await sharp(chk).composite([{ input: tr, gravity: "center" }]).png().toBuffer();
  comps.push({ input: trThumb, top: TOP, left: x0 + (CELLW - THUMB) / 2 });
  const comp = await sharp(`${PREV}/${it.id}__${arch}.png`).extract(crop).resize(BROW - 10, BROW - 10, { fit: "contain", background: CARD, kernel: "nearest" }).png().toBuffer();
  comps.push({ input: await sharp({ create: { width: BROW - 10, height: BROW - 10, channels: 4, background: CARD } }).png().toBuffer(), top: TOP + TROW, left: x0 + (CELLW - (BROW - 10)) / 2 });
  comps.push({ input: comp, top: TOP + TROW, left: x0 + (CELLW - (BROW - 10)) / 2 });
  comps.push({ input: label(it.name, CELLW, 16, "#5b4636"), top: TOP + TROW + BROW - 8, left: x0 });
}
await sharp({ create: { width: SW, height: SH, channels: 4, background: BG } }).composite(comps).png().toFile(`${PREV}/_ALL-CLOTHING.png`);
console.log("wrote _ALL-CLOTHING.png");
