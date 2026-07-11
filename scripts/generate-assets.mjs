import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");
const logoDir = join(publicDir, "logo");
const imagesDir = join(publicDir, "images");
const iconsDir = join(publicDir, "icons");

const THEME = { r: 13, g: 13, b: 13, alpha: 1 };
const COIN_SVG = join(logoDir, "coin.svg");

async function rasterizeCoin(outputPath, size) {
  const svg = readFileSync(COIN_SVG);
  await sharp(svg).resize(size, size).png().toFile(outputPath);
  console.log(`  ${outputPath} (${size}x${size})`);
}

function socialImageSvg(width, height) {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="28%" cy="42%" r="55%">
      <stop offset="0%" stop-color="#d4af37" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#0D0D0D" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="#0D0D0D"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <text x="680" y="270" font-family="Arial Black, Helvetica, sans-serif" font-size="92" font-weight="900" fill="#FAFAFA" letter-spacing="6">UGLY DEER</text>
  <text x="680" y="340" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#B0B0B0">The internet's ugliest deer became a meme coin.</text>
  <text x="680" y="390" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#D4AF37">Preparing for launch on Robinhood Chain.</text>
</svg>`);
}

async function createSocialImage(outputPath, width, height) {
  const coinSize = Math.round(height * 0.72);
  const coinBuffer = await sharp(readFileSync(COIN_SVG)).resize(coinSize, coinSize).png().toBuffer();
  const textBuffer = await sharp(socialImageSvg(width, height)).png().toBuffer();
  const coinTop = Math.floor((height - coinSize) / 2);

  await sharp({
    create: { width, height, channels: 4, background: THEME },
  })
    .composite([
      { input: coinBuffer, left: 64, top: coinTop },
      { input: textBuffer, left: 0, top: 0 },
    ])
    .png()
    .toFile(outputPath);

  console.log(`  ${outputPath} (${width}x${height})`);
}

async function createFaviconIco(outputPath) {
  const png16 = await sharp(readFileSync(COIN_SVG)).resize(16, 16).png().toBuffer();
  const png32 = await sharp(readFileSync(COIN_SVG)).resize(32, 32).png().toBuffer();

  // Single-size ICO fallback (32px) — widely supported
  await sharp(png32).toFile(outputPath);
  console.log(`  ${outputPath} (32x32 ico)`);

  writeFileSync(join(iconsDir, "favicon-16x16.png"), png16);
  writeFileSync(join(iconsDir, "favicon-32x32.png"), png32);
  console.log(`  ${join(iconsDir, "favicon-16x16.png")} (16x16)`);
  console.log(`  ${join(iconsDir, "favicon-32x32.png")} (32x32)`);
}

async function syncLogoSvg() {
  const coin = readFileSync(COIN_SVG);
  writeFileSync(join(logoDir, "logo.svg"), coin);
  writeFileSync(join(logoDir, "logo-dark.svg"), coin);
  writeFileSync(join(logoDir, "logo-light.svg"), coin);
  writeFileSync(join(logoDir, "logo-monochrome.svg"), coin);
  console.log("  Synced logo/*.svg from coin.svg");
}

async function main() {
  mkdirSync(imagesDir, { recursive: true });
  mkdirSync(iconsDir, { recursive: true });

  console.log("Generating UGLY DEER brand assets...\n");

  await syncLogoSvg();

  await rasterizeCoin(join(logoDir, "logo-512.png"), 512);
  await rasterizeCoin(join(iconsDir, "apple-touch-icon.png"), 180);
  await rasterizeCoin(join(imagesDir, "avatar.png"), 512);

  await createFaviconIco(join(publicDir, "favicon.ico"));

  await createSocialImage(join(imagesDir, "opengraph-image.png"), 1200, 630);
  await createSocialImage(join(imagesDir, "twitter-image.png"), 1200, 630);

  // Legacy aliases used by older paths
  await sharp(join(imagesDir, "opengraph-image.png")).toFile(join(imagesDir, "og.png"));
  await sharp(join(iconsDir, "favicon-32x32.png")).toFile(join(iconsDir, "favicon.png"));
  console.log("  Legacy aliases: og.png, favicon.png");

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
