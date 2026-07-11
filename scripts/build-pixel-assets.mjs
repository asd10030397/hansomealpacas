/**
 * Processes the generated pasture-theme pixel art (hero background +
 * decorative alpaca sprites) into web-ready files:
 *
 *   - Hero background: trimmed + saved as-is (full scene, opaque).
 *   - Alpaca sprites: flat sky-blue backdrop keyed out to transparency
 *     (color-distance threshold, same idea as build-mascot-coin.mjs's
 *     luminance key, just matched against the sampled backdrop color
 *     instead of pure black) so they can be scattered over any section.
 *
 * Re-run after regenerating/replacing any *-source.png in public/pixel/.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pixelDir = join(root, "public/pixel");

async function chromaKeySprite(sourceName, outputName) {
  const { data, info } = await sharp(join(pixelDir, sourceName))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Sample the backdrop color from a corner pixel.
  const [bgR, bgG, bgB] = [data[0], data[1], data[2]];
  const LOW = 28;
  const HIGH = 55;

  for (let i = 0; i < data.length; i += 4) {
    const dist = Math.sqrt(
      (data[i] - bgR) ** 2 + (data[i + 1] - bgG) ** 2 + (data[i + 2] - bgB) ** 2,
    );
    const alpha = Math.max(0, Math.min(255, Math.round(((dist - LOW) / (HIGH - LOW)) * 255)));
    data[i + 3] = alpha;
  }

  const keyed = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  const trimmed = await keyed.png().toBuffer();
  const out = await sharp(trimmed).trim({ threshold: 10 }).png().toBuffer();
  writeFileSync(join(pixelDir, outputName), out);
  console.log(`  ${join(pixelDir, outputName)}`);
}

async function main() {
  console.log("Building pasture pixel art assets...\n");

  writeFileSync(
    join(pixelDir, "pasture-hero-bg.png"),
    readFileSync(join(pixelDir, "pasture-hero-bg-source.png")),
  );
  console.log(`  ${join(pixelDir, "pasture-hero-bg.png")}`);

  await chromaKeySprite("alpaca-sunglasses-source.png", "alpaca-sunglasses.png");
  await chromaKeySprite("alpaca-goofy-source.png", "alpaca-goofy.png");

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
