/**
 * Encode music/UI.wav → public/audio/game/ui-click.{ogg,mp3}
 * Trims trailing silence; keeps the audible UI hit (~1.85s).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = path.join(root, "music", "UI.wav");
const outDir = path.join(root, "public/audio/game");

function run(args, label) {
  console.log(`\n→ ${label}`);
  const r = spawnSync("ffmpeg", ["-y", ...args], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    throw new Error(`ffmpeg failed: ${label}`);
  }
}

function main() {
  if (!fs.existsSync(src)) throw new Error(`Missing source: ${src}`);
  fs.mkdirSync(outDir, { recursive: true });

  const af = "loudnorm=I=-16:TP=-1.5:LRA=7,volume=0.9";
  const ogg = path.join(outDir, "ui-click.ogg");
  const mp3 = path.join(outDir, "ui-click.mp3");

  run(
    ["-i", src, "-t", "1.85", "-af", af, "-c:a", "libvorbis", "-q:a", "5", ogg],
    "Encode ui-click.ogg",
  );
  run(
    ["-i", src, "-t", "1.85", "-af", af, "-c:a", "libmp3lame", "-q:a", "4", mp3],
    "Encode ui-click.mp3",
  );

  console.log("\nDone.");
  console.log(`  ${path.relative(root, ogg)}`);
  console.log(`  ${path.relative(root, mp3)}`);
}

main();
