/**
 * Encode settlement result SFX:
 *   music/<Folder>/ → public/audio/game/settlement-results/<id>/effect.{ogg,mp3}
 *
 * Folders: AlpacaHunted, AlpacaSafe, CougarHuntSuccess, CougarHuntFailed
 *
 * Usage: npm run generate:settlement-result-sfx
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

/** Keep in sync with lib/game/settlementResults/catalog.ts */
const RESULTS = [
  { id: "alpaca-hunted", folder: "AlpacaHunted", maxSec: 1.3 },
  { id: "alpaca-safe", folder: "AlpacaSafe", maxSec: 1.4 },
  { id: "cougar-hunt-success", folder: "CougarHuntSuccess", maxSec: 1.5 },
  { id: "cougar-hunt-failed", folder: "CougarHuntFailed", maxSec: 1.4 },
];

const AUDIO_EXT = new Set([".wav", ".mp3", ".ogg", ".m4a", ".flac"]);

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

function pickSource(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => AUDIO_EXT.has(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  return files[0] ? path.join(dir, files[0]) : null;
}

function main() {
  const af = "loudnorm=I=-16:TP=-1.5:LRA=7,volume=0.95";

  for (const item of RESULTS) {
    const srcDir = path.join(root, "music", item.folder);
    const src = pickSource(srcDir);
    if (!src) {
      console.warn(`⚠ Skip ${item.id}: no audio in ${path.relative(root, srcDir)}`);
      continue;
    }

    const outDir = path.join(root, "public/audio/game/settlement-results", item.id);
    fs.mkdirSync(outDir, { recursive: true });
    const ogg = path.join(outDir, "effect.ogg");
    const mp3 = path.join(outDir, "effect.mp3");

    run(
      ["-i", src, "-t", String(item.maxSec), "-af", af, "-c:a", "libvorbis", "-q:a", "5", ogg],
      `${item.id} → effect.ogg`,
    );
    run(
      ["-i", src, "-t", String(item.maxSec), "-af", af, "-c:a", "libmp3lame", "-q:a", "4", mp3],
      `${item.id} → effect.mp3`,
    );

    console.log(`  ${path.relative(root, ogg)}`);
    console.log(`  ${path.relative(root, mp3)}`);
  }

  console.log("\nDone. Paths: /audio/game/settlement-results/<id>/effect.{ogg,mp3}");
}

main();
