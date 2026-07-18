// Review sheet for the Special 21 backgrounds: bare backdrop + the same alpaca on each,
// across a few archetypes, to confirm the alpaca stays the focus.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const BG = "public/pixel/traits/backgrounds";
const NORM = "public/pixel/traits/base/normalized";
const OUT = path.join(BG, "previews", "special");
fs.mkdirSync(OUT, { recursive: true });
const W = 1024, CARD = { r: 234, g: 224, b: 205, alpha: 1 };
const BGS = [["king", "King"], ["guardian", "Guardian"], ["farmer", "Farmer"], ["lucky", "Lucky"], ["runner", "Runner"]];
const ARCH = ["puff", "sleek", "elder"];

async function comp(bg, arch) {
  return await sharp(path.join(BG, `${bg}.png`)).composite([{ input: path.join(NORM, `${arch}.png`) }]).png().toBuffer();
}

// individual composites (puff) + a full review grid
const CELL = 300, PAD = 10, LBL = 22, COLS = 1 + ARCH.length;
const rowH = CELL + LBL, SW = COLS * (CELL + PAD) + PAD, SH = 50 + BGS.length * (rowH + PAD) + PAD;
const comps = [{ input: Buffer.from(`<svg width="${SW}" height="44"><text x="${SW / 2}" y="30" font-family="Verdana" font-size="24" font-weight="bold" fill="#5b4636" text-anchor="middle">Special 21 Backgrounds — bare backdrop + same alpaca (Puff / Sleek / Elder)</text></svg>`), top: 8, left: 0 }];
for (let r = 0; r < BGS.length; r++) {
  const [id, label] = BGS[r];
  const y0 = 50 + r * (rowH + PAD);
  const cells = [];
  cells.push(await sharp(path.join(BG, `${id}.png`)).resize(CELL, CELL, { kernel: "nearest" }).png().toBuffer());
  for (const a of ARCH) cells.push(await sharp(await comp(id, a)).resize(CELL, CELL, { kernel: "nearest" }).png().toBuffer());
  for (let c = 0; c < cells.length; c++) {
    const x0 = PAD + c * (CELL + PAD);
    comps.push({ input: cells[c], top: y0, left: x0 });
    const tag = c === 0 ? `${label} (backdrop)` : `${label} · ${ARCH[c - 1]}`;
    comps.push({ input: Buffer.from(`<svg width="${CELL}" height="${LBL}"><text x="4" y="16" font-family="Verdana" font-size="13" fill="#5b4636">${tag}</text></svg>`), top: y0 + CELL, left: x0 });
  }
  // save the puff composite standalone too
  await sharp(await comp(id, "puff")).png().toFile(path.join(OUT, `${id}__puff.png`));
}
await sharp({ create: { width: SW, height: SH, channels: 4, background: CARD } }).composite(comps).png().toFile(path.join(OUT, "_SPECIAL-BACKGROUNDS-REVIEW.png"));
console.log("wrote", path.join(OUT, "_SPECIAL-BACKGROUNDS-REVIEW.png"));
