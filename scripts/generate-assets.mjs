import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const logoDir = join(root, "public", "logo");
const imagesDir = join(root, "public", "images");
const iconsDir = join(root, "public", "icons");

const BACKGROUND = { r: 9, g: 9, b: 9, alpha: 1 };

async function rasterizeLogo(outputPath, size) {
  const svg = readFileSync(join(logoDir, "logo.svg"));
  await sharp(svg).resize(size, size).png().toFile(outputPath);
  console.log(`  ${outputPath} (${size}x${size})`);
}

async function createBanner(outputPath, width, height, logoSize) {
  const logoBuffer = await sharp(readFileSync(join(logoDir, "logo.svg")))
    .resize(logoSize, logoSize)
    .png()
    .toBuffer();

  const left = Math.floor((width - logoSize) / 2);
  const top = Math.floor((height - logoSize) / 2);

  await sharp({
    create: { width, height, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: logoBuffer, left, top }])
    .png()
    .toFile(outputPath);

  console.log(`  ${outputPath} (${width}x${height})`);
}

async function main() {
  mkdirSync(imagesDir, { recursive: true });
  mkdirSync(iconsDir, { recursive: true });

  console.log("Generating brand assets...\n");

  await rasterizeLogo(join(logoDir, "logo-512.png"), 512);
  await rasterizeLogo(join(imagesDir, "avatar.png"), 512);
  await rasterizeLogo(join(iconsDir, "favicon.png"), 32);

  await createBanner(join(imagesDir, "og.png"), 1200, 630, 280);
  await createBanner(join(imagesDir, "twitter-banner.png"), 1500, 500, 220);
  await createBanner(join(imagesDir, "telegram-banner.png"), 1280, 640, 260);

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
