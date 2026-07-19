/**
 * Encode ability SFX from music/<Ability>/ → public/audio/game/abilities/<id>/effect.{ogg,mp3}
 *
 * Folder convention (source masters, not served):
 *   music/Guardian/  music/Runner/  music/Lucky/  music/Farmer/
 *
 * Drop any .wav/.mp3/.ogg into a folder; the first audio file is encoded as `effect.*`.
 * Replace files later without touching gameplay code — re-run this script.
 *
 * Usage: npm run generate:ability-sfx
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

/** Must stay in sync with lib/game/abilityEffects/catalog.ts */
const ABILITIES = [
  { id: "guardian", folder: "Guardian", maxSec: 1.4 },
  { id: "runner", folder: "Runner", maxSec: 1.3 },
  { id: "lucky", folder: "Lucky", maxSec: 1.4 },
  { id: "farmer", folder: "Farmer", maxSec: 1.4 },
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

  for (const ability of ABILITIES) {
    const srcDir = path.join(root, "music", ability.folder);
    const src = pickSource(srcDir);
    if (!src) {
      console.warn(`⚠ Skip ${ability.id}: no audio in ${path.relative(root, srcDir)}`);
      continue;
    }

    const outDir = path.join(root, "public/audio/game/abilities", ability.id);
    fs.mkdirSync(outDir, { recursive: true });
    const ogg = path.join(outDir, "effect.ogg");
    const mp3 = path.join(outDir, "effect.mp3");

    run(
      [
        "-i",
        src,
        "-t",
        String(ability.maxSec),
        "-af",
        af,
        "-c:a",
        "libvorbis",
        "-q:a",
        "5",
        ogg,
      ],
      `${ability.id} → effect.ogg`,
    );
    run(
      [
        "-i",
        src,
        "-t",
        String(ability.maxSec),
        "-af",
        af,
        "-c:a",
        "libmp3lame",
        "-q:a",
        "4",
        mp3,
      ],
      `${ability.id} → effect.mp3`,
    );

    console.log(`  ${path.relative(root, ogg)}`);
    console.log(`  ${path.relative(root, mp3)}`);
  }

  console.log("\nDone. Catalog paths: /audio/game/abilities/<id>/effect.{ogg,mp3}");
}

main();
