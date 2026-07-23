import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const repoRoot = path.resolve(root, "..", "..");
const iconSrc = path.join(repoRoot, "public", "icons", "pwa", "icon-512.png");

if (!existsSync(iconSrc)) {
  console.error("Missing icon source:", iconSrc);
  process.exit(1);
}

const resDir = path.join(root, "android", "app", "src", "main", "res");
const densities = [
  ["mipmap-mdpi", 48],
  ["mipmap-hdpi", 72],
  ["mipmap-xhdpi", 96],
  ["mipmap-xxhdpi", 144],
  ["mipmap-xxxhdpi", 192],
];

// Capacitor Android project must exist first (run after cap add android).
if (!existsSync(resDir)) {
  console.error("Android res dir missing — run `npx cap add android` first.");
  process.exit(1);
}

async function main() {
  const sharp = (await import("sharp")).default;
  const splashDir = path.join(resDir, "drawable");
  mkdirSync(splashDir, { recursive: true });

  for (const [folder, size] of densities) {
    const dir = path.join(resDir, folder);
    mkdirSync(dir, { recursive: true });
    const out = path.join(dir, "ic_launcher.png");
    const outRound = path.join(dir, "ic_launcher_round.png");
    const outForeground = path.join(dir, "ic_launcher_foreground.png");
    await sharp(iconSrc).resize(size, size).png().toFile(out);
    await sharp(iconSrc).resize(size, size).png().toFile(outRound);
    await sharp(iconSrc).resize(size, size).png().toFile(outForeground);
  }

  const splash = path.join(splashDir, "splash.png");
  await sharp(iconSrc).resize(512, 512).png().toFile(splash);

  console.log("Icons and splash copied from", iconSrc);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
