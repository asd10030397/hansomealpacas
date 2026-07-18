/**
 * Encode game BGM from music/Alpaca Warpath.wav → public/audio/game/gameplay-theme.{ogg,mp3}
 * Does NOT modify public/audio/ambient.wav.
 *
 * Usage: node scripts/generate-gameplay-theme.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = path.join(root, "music", "Alpaca Warpath.wav");
const outDir = path.join(root, "public/audio/game");

function run(args, label) {
  console.log(`\n→ ${label}`);
  const r = spawnSync("ffmpeg", ["-y", ...args], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    throw new Error(`ffmpeg failed: ${label}`);
  }
}

function main() {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source: ${src}`);
  }
  fs.mkdirSync(outDir, { recursive: true });

  const ogg = path.join(outDir, "gameplay-theme.ogg");
  const mp3 = path.join(outDir, "gameplay-theme.mp3");
  const af = "loudnorm=I=-18:TP=-2:LRA=9,volume=0.85";

  run(
    ["-i", src, "-af", af, "-c:a", "libvorbis", "-q:a", "5", ogg],
    "Encode gameplay-theme.ogg (Alpaca Warpath)",
  );
  run(
    ["-i", src, "-af", af, "-c:a", "libmp3lame", "-q:a", "4", mp3],
    "Encode gameplay-theme.mp3 (Alpaca Warpath)",
  );

  console.log("\nDone.");
  console.log(`  ${path.relative(root, ogg)}`);
  console.log(`  ${path.relative(root, mp3)}`);
  console.log("  Source ambient.wav left unchanged.");
}

main();
