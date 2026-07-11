import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { createPremiumSocialPreview } from "./social-preview.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");
const logoDir = join(publicDir, "logo");
const imagesDir = join(publicDir, "images");
const iconsDir = join(publicDir, "icons");

const SOCIAL_PREVIEW_VERSION = 3;
const OG_IMAGE = `opengraph-image-v${SOCIAL_PREVIEW_VERSION}.png`;
const TWITTER_IMAGE = `twitter-image-v${SOCIAL_PREVIEW_VERSION}.png`;

const COIN_SVG = join(logoDir, "coin.svg");

async function rasterizeCoin(outputPath, size) {
  const svg = readFileSync(COIN_SVG);
  await sharp(svg).resize(size, size).png().toFile(outputPath);
  console.log(`  ${outputPath} (${size}x${size})`);
}

async function upscaleLogo256(outputPath, size) {
  const source = join(logoDir, "logo-256.png");
  await sharp(source)
    .resize(size, size, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(outputPath);
  console.log(`  ${outputPath} (${size}x${size}, upscaled from logo-256.png)`);
}

async function syncListingAssets() {
  const listingAssets = join(root, "launch/listings/assets");
  mkdirSync(listingAssets, { recursive: true });
  writeFileSync(
    join(listingAssets, "logo-256.png"),
    readFileSync(join(logoDir, "logo-256.png")),
  );
  writeFileSync(
    join(listingAssets, "logo-512.png"),
    readFileSync(join(logoDir, "logo-512.png")),
  );
  console.log("  Synced launch/listings/assets/logo-256.png + logo-512.png");
}

async function createFaviconIco(outputPath) {
  const png16 = await sharp(readFileSync(COIN_SVG)).resize(16, 16).png().toBuffer();
  const png32 = await sharp(readFileSync(COIN_SVG)).resize(32, 32).png().toBuffer();

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

  console.log("Generating HANSOME ALPACAS brand assets...\n");

  await syncLogoSvg();

  // logo-256.png is the canonical PNG. logo-512.png is upscale-only (never from SVG).
  const logo256 = join(logoDir, "logo-256.png");
  if (!existsSync(logo256)) {
    await rasterizeCoin(logo256, 256);
  }
  await upscaleLogo256(join(logoDir, "logo-512.png"), 512);
  await syncListingAssets();

  await rasterizeCoin(join(iconsDir, "apple-touch-icon.png"), 180);
  await rasterizeCoin(join(imagesDir, "avatar.png"), 512);

  await createFaviconIco(join(publicDir, "favicon.ico"));

  console.log("  Premium social previews (1200x630)...");
  await createPremiumSocialPreview(COIN_SVG, join(imagesDir, OG_IMAGE));
  console.log(`  ${join(imagesDir, OG_IMAGE)}`);
  await sharp(join(imagesDir, OG_IMAGE)).toFile(join(imagesDir, TWITTER_IMAGE));
  console.log(`  ${join(imagesDir, TWITTER_IMAGE)} (pixel-matched copy)`);

  await sharp(join(imagesDir, OG_IMAGE)).toFile(join(imagesDir, "og.png"));
  await sharp(join(iconsDir, "favicon-32x32.png")).toFile(join(iconsDir, "favicon.png"));
  console.log("  Legacy aliases: og.png, favicon.png");

  await sharp(join(imagesDir, OG_IMAGE)).toFile(join(publicDir, OG_IMAGE));
  await sharp(join(imagesDir, TWITTER_IMAGE)).toFile(join(publicDir, TWITTER_IMAGE));
  await sharp(join(imagesDir, OG_IMAGE)).toFile(join(publicDir, "og.png"));
  await sharp(join(imagesDir, OG_IMAGE)).jpeg({ quality: 90 }).toFile(join(publicDir, "og.jpg"));
  await sharp(join(iconsDir, "favicon-32x32.png")).toFile(join(publicDir, "favicon.png"));
  await sharp(join(iconsDir, "apple-touch-icon.png")).toFile(join(publicDir, "apple-touch-icon.png"));
  console.log(`  Root fallbacks: og.png, og.jpg, ${OG_IMAGE}, ${TWITTER_IMAGE}, favicon.png, apple-touch-icon.png`);

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
