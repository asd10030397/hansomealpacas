/**
 * One-off (re-runnable) builder: takes the official HANSOME ALPACAS mascot
 * photo (public/logo/mascot-source.jpg — pixel-art alpaca portrait, supplied
 * by the brand owner) and produces public/logo/coin.svg by:
 *
 *   1. Trimming the flat black background off the source art.
 *   2. Centering it, unscaled/unfiltered, inside a simple gold coin rim.
 *   3. Embedding the resulting raster as a base64 <image> inside the SVG.
 *
 * It also writes public/logo/mascot-cutout.png — the same artwork with the
 * flat backdrop keyed out to transparency (based on a luminance gap between
 * the background and the mascot's own darkest strokes) — for use anywhere
 * the mascot needs to sit on a non-black surface, e.g. the interactive 3D
 * hero coin.
 *
 * No AI regeneration, no re-drawing, no color/style changes to the mascot
 * itself — this only crops + frames the artwork the brand owner provided.
 * Re-run this whenever mascot-source.jpg is replaced, then run
 * `npm run generate:assets` to refresh every derived PNG/favicon/OG image.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const logoDir = join(root, "public/logo");
const SOURCE = join(logoDir, "mascot-source.jpg");
const OUTPUT_SVG = join(logoDir, "coin.svg");

const CANVAS = 512;
const RIM_R = 248;
const DISC_R = 228;
const DISC_BG = "#0D0D0D";

/**
 * The source photo sits on a flat black backdrop. Its own darkest strokes
 * (eye, fur outline) sit around luminance ~50+, while the backdrop +
 * JPEG noise stays under ~20. That gap lets us key the backdrop out to
 * transparency without touching any pixel that is actually part of the
 * alpaca artwork.
 */
async function chromaKeyToTransparent(buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const LOW = 16;
  const HIGH = 34;
  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const alpha = Math.max(0, Math.min(255, Math.round(((lum - LOW) / (HIGH - LOW)) * 255)));
    data[i + 3] = alpha;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function main() {
  const trimmed = await sharp(SOURCE).trim({ threshold: 20 }).toBuffer();
  const meta = await sharp(trimmed).metadata();

  const cutout = await chromaKeyToTransparent(trimmed);
  writeFileSync(join(logoDir, "mascot-cutout.png"), cutout);

  const maxDiameter = DISC_R * 2 * 0.92; // small padding inside the disc
  const scale = Math.min(maxDiameter / meta.width, maxDiameter / meta.height);
  const drawW = Math.round(meta.width * scale);
  const drawH = Math.round(meta.height * scale);

  const resized = await sharp(trimmed)
    .resize(drawW, drawH, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  const b64 = resized.toString("base64");
  const x = Math.round((CANVAS - drawW) / 2);
  const y = Math.round((CANVAS - drawH) / 2);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" fill="none" role="img" aria-label="HANSOME ALPACAS mascot coin">
  <defs>
    <radialGradient id="goldRim" cx="50%" cy="50%" r="50%">
      <stop offset="86%" stop-color="#C9A227"/>
      <stop offset="94%" stop-color="#F5D061"/>
      <stop offset="100%" stop-color="#6B4F0A"/>
    </radialGradient>
    <clipPath id="discClip">
      <circle cx="${CANVAS / 2}" cy="${CANVAS / 2}" r="${DISC_R}"/>
    </clipPath>
  </defs>
  <circle cx="${CANVAS / 2}" cy="${CANVAS / 2}" r="${RIM_R}" fill="url(#goldRim)"/>
  <circle cx="${CANVAS / 2}" cy="${CANVAS / 2}" r="${DISC_R}" fill="${DISC_BG}"/>
  <g clip-path="url(#discClip)">
    <image x="${x}" y="${y}" width="${drawW}" height="${drawH}" href="data:image/png;base64,${b64}"/>
  </g>
  <circle cx="${CANVAS / 2}" cy="${CANVAS / 2}" r="${DISC_R}" fill="none" stroke="#F5D061" stroke-opacity="0.35" stroke-width="2"/>
  <circle cx="${CANVAS / 2}" cy="${CANVAS / 2}" r="${RIM_R - 1.5}" fill="none" stroke="#FFF8D0" stroke-opacity="0.25" stroke-width="3"/>
</svg>
`;

  writeFileSync(OUTPUT_SVG, svg);
  console.log(`Wrote ${OUTPUT_SVG} (mascot drawn at ${drawW}x${drawH} inside ${CANVAS}x${CANVAS} coin)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
