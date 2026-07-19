import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const srcRoot = path.join(
  process.env.USERPROFILE || "",
  ".cursor/projects/c-hansomealpacas/assets",
);
const outDir = path.join(process.cwd(), "public/game/backgrounds");

const jobs = [
  ["home-bg.png", "home-bg.png", "nav-home.webp", 0.35],
  ["nfts-bg.png", "nfts-bg.png", "nfts.webp", 0.4],
  ["rewards-bg.png", "rewards-bg.png", "rewards.webp", 0.38],
  ["leaderboard-bg.png", "leaderboard-bg.png", "leaderboard.webp", 0.4],
  ["docs-bg.png", "docs-bg.png", "docs.webp", 0.48],
];

for (const [srcName, pngName, webpName, darken] of jobs) {
  const src = path.join(srcRoot, srcName);
  const base = sharp(src)
    .resize({ width: 1600, withoutEnlargement: true })
    .modulate({ brightness: 1 - darken * 0.22, saturation: 0.94 });
  const pngOut = path.join(outDir, pngName);
  const webpOut = path.join(outDir, webpName);
  await base.clone().png({ compressionLevel: 9 }).toFile(pngOut);
  await base.clone().webp({ quality: 78, effort: 5 }).toFile(webpOut);
  console.log(
    pngName,
    `${Math.round(fs.statSync(pngOut).size / 1024)}KB`,
    webpName,
    `${Math.round(fs.statSync(webpOut).size / 1024)}KB`,
  );
}
