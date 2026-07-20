/**
 * Build optimized page scenic WebPs for game routes (not HOME/MINT).
 * Reuses handcrafted ranch + map art; adds battlefield composite.
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "game", "backgrounds", "scenic");
mkdirSync(outDir, { recursive: true });

const W = 1600;
const H = 900;

async function fitCover(input, w = W, h = H) {
  return sharp(input)
    .resize(w, h, { fit: "cover", position: "centre" })
    .ensureAlpha();
}

/** Darken slightly for UI wash room, but keep midtones visible. */
async function toScenicWebp(pipeline, name, { brightness = 1, saturation = 1.05 } = {}) {
  const out = join(outDir, `${name}.webp`);
  await pipeline
    .modulate({ brightness, saturation })
    .webp({ quality: 78, effort: 5 })
    .toFile(out);
  const stats = await sharp(out).stats();
  const mean = stats.channels.slice(0, 3).map((c) => Math.round(c.mean));
  console.log("wrote", out, "mean", mean.join(","));
}

async function battlefield() {
  // Composite four location maps into a split battlefield vista.
  const [mountain, grassland, forest, river] = await Promise.all([
    fitCover(join(root, "public/game/maps/mountain.png"), 800, 900),
    fitCover(join(root, "public/game/maps/grassland.png"), 800, 450),
    fitCover(join(root, "public/game/maps/forest.png"), 800, 450),
    fitCover(join(root, "public/game/maps/river.png"), 1600, 280),
  ]);

  const left = await mountain.png().toBuffer();
  const grass = await grassland.png().toBuffer();
  const trees = await forest.png().toBuffer();
  const water = await river.png().toBuffer();

  const base = sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: { r: 28, g: 36, b: 52 },
    },
  });

  const composed = await base
    .composite([
      { input: left, left: 0, top: 0 },
      { input: grass, left: 800, top: 0 },
      { input: trees, left: 800, top: 450 },
      { input: water, left: 0, top: 620, blend: "over" },
    ])
    .modulate({ brightness: 1.15, saturation: 1.08 })
    .blur(0.3);

  // Soft vignette via SVG
  const vignette = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <radialGradient id="g" cx="50%" cy="42%" r="72%">
          <stop offset="0%" stop-color="rgb(0,0,0)" stop-opacity="0"/>
          <stop offset="70%" stop-color="rgb(0,0,0)" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="rgb(0,0,0)" stop-opacity="0.55"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
    </svg>`);

  await sharp(await composed.png().toBuffer())
    .composite([{ input: vignette, blend: "over" }])
    .webp({ quality: 78 })
    .toFile(join(outDir, "play-battlefield.webp"));
  console.log("wrote play-battlefield.webp");
}

async function main() {
  await battlefield();

  await toScenicWebp(
    await fitCover(join(root, "public/assets/backgrounds/alpaca-ranch-lush.png")),
    "nfts-ranch",
    { brightness: 0.92, saturation: 1.05 },
  );

  // Prefer existing themed chambers; lift midtones for readability.
  await toScenicWebp(
    await fitCover(join(root, "public/game/backgrounds/rewards-bg.png")),
    "claim-vault",
    { brightness: 1.22, saturation: 1.1 },
  );
  await toScenicWebp(
    await fitCover(join(root, "public/game/backgrounds/leaderboard-bg.png")),
    "leaderboard-hall",
    { brightness: 1.2, saturation: 1.08 },
  );
  await toScenicWebp(
    await fitCover(join(root, "public/game/backgrounds/docs-bg.png")),
    "docs-library",
    { brightness: 1.18, saturation: 1.05 },
  );

  // Shared battle result uses same battlefield with slightly cooler grade.
  await toScenicWebp(
    sharp(join(outDir, "play-battlefield.webp")),
    "battle-field",
    { brightness: 0.95, saturation: 0.98 },
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
