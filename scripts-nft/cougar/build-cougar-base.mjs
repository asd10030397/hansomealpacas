// Build the OFFICIAL Cougar NFT base — one 1024x1024 image used by ALL 50 identical Cougars.
// Same full-bleed frame as the Alpaca Genesis collection (1024x1024, nearest-neighbor, no smoothing).
// No redesign: the original pixel art is only fit into the square (cover, anchored to the bottom so
// paws are never cropped — only empty sky is trimmed). Does NOT touch the Alpaca system.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SRC = "public/pixel/cougar-base.png";
const OUTDIR = "public/pixel/cougar";
fs.mkdirSync(OUTDIR, { recursive: true });
const OUT = path.join(OUTDIR, "cougar-official-base.png");
const SIZE = 1024;

const meta = await sharp(SRC).metadata();
console.log(`source ${meta.width}x${meta.height}`);

// Full-bleed square, anchored to the bottom edge: horizontal fills exactly (653->1024);
// vertical overflow (sky) is trimmed from the TOP so ears + paws stay in frame. Nearest-neighbor only.
await sharp(SRC)
  .resize(SIZE, SIZE, { fit: "cover", position: "bottom", kernel: "nearest" })
  .png()
  .toFile(OUT);
console.log(`wrote ${OUT} (${SIZE}x${SIZE})`);

// meta
fs.writeFileSync(path.join(OUTDIR, "_cougar-meta.json"), JSON.stringify({
  collection: "HANSOME Cougars",
  officialBase: "cougar/cougar-official-base.png",
  source: SRC,
  canvas: { width: SIZE, height: SIZE, resampling: "nearest", smoothing: false, frame: "full-bleed, same as Alpaca Genesis" },
  supply: 50,
  rules: {
    identical: true,
    rarity: "none",
    specialAbilities: "none",
    classes: 1,
    note: "All 50 Cougar NFTs use this exact same official base artwork. No per-token variation, no traits, no rarity tiers. Rules per HANSOME GDS v1.1 §4.2 / §11 / §12.3 (uniform weight w^C=1).",
  },
  fit: { method: "cover", anchor: "bottom", reason: "trim only empty sky from the top; never crop ears or paws; no redesign / no smoothing" },
  status: "official-base-ready",
}, null, 2));
console.log("wrote _cougar-meta.json");

// frame-parity check vs an alpaca genesis token (both are full-bleed 1024 squares)
const alpacaSample = "public/pixel/genesis/100.png";
const TILE = 420, PAD = 16, LBL = 26;
const W = TILE * 2 + PAD * 3, Hh = 40 + TILE + LBL + PAD;
const comps = [
  { input: Buffer.from(`<svg width="${W}" height="34"><text x="16" y="24" font-family="Verdana" font-size="18" font-weight="bold" fill="#5b4636">Frame parity — Cougar official base vs Alpaca Genesis (both 1024² full-bleed)</text></svg>`), top: 6, left: 0 },
  { input: await sharp(OUT).resize(TILE, TILE, { kernel: "nearest" }).png().toBuffer(), top: 40, left: PAD },
  { input: Buffer.from(`<svg width="${TILE}" height="${LBL}"><text x="4" y="18" font-family="Verdana" font-size="13" fill="#5b4636">Cougar official base · used by all 50</text></svg>`), top: 40 + TILE, left: PAD },
  { input: await sharp(alpacaSample).resize(TILE, TILE, { kernel: "nearest" }).png().toBuffer(), top: 40, left: PAD * 2 + TILE },
  { input: Buffer.from(`<svg width="${TILE}" height="${LBL}"><text x="4" y="18" font-family="Verdana" font-size="13" fill="#5b4636">Alpaca Genesis #100 (reference frame)</text></svg>`), top: 40 + TILE, left: PAD * 2 + TILE },
];
await sharp({ create: { width: W, height: Hh, channels: 4, background: { r: 234, g: 224, b: 205, alpha: 1 } } }).composite(comps).png().toFile(path.join(OUTDIR, "_FRAME-CHECK.png"));
console.log("wrote _FRAME-CHECK.png");
