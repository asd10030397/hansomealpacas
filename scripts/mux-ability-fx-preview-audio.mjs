/**
 * Build a demo audio bed from the four ability SFX files (with gaps) and
 * mux onto reports/ability-fx-preview/ability-fx-preview.mp4
 *
 * Env: SFX_DELAY_SEC — silence before first SFX (default 1.0)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "reports", "ability-fx-preview");
const videoIn = path.join(outDir, "ability-fx-preview.mp4");
const bed = path.join(outDir, "ability-fx-sfx-bed.wav");
const videoOut = path.join(outDir, "ability-fx-preview-with-sfx.mp4");
const delaySec = Number(process.env.SFX_DELAY_SEC ?? "1.0");

const clips = [
  path.join(root, "public/audio/game/abilities/guardian/effect.mp3"),
  path.join(root, "public/audio/game/abilities/runner/effect.mp3"),
  path.join(root, "public/audio/game/abilities/lucky/effect.mp3"),
  path.join(root, "public/audio/game/abilities/farmer/effect.mp3"),
];

function run(args, label) {
  console.log("→", label);
  const r = spawnSync("ffmpeg", ["-y", ...args], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    throw new Error(label);
  }
}

function main() {
  if (!fs.existsSync(videoIn)) throw new Error(`Missing ${videoIn}`);
  for (const c of clips) {
    if (!fs.existsSync(c)) throw new Error(`Missing ${c}`);
  }

  const filter = [
    `aevalsrc=0:d=${delaySec}[s0]`,
    "[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=1.0[a0]",
    "aevalsrc=0:d=0.45[s1]",
    "[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=1.0[a1]",
    "aevalsrc=0:d=0.45[s2]",
    "[2:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=1.0[a2]",
    "aevalsrc=0:d=0.45[s3]",
    "[3:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=1.0[a3]",
    "[s0][a0][s1][a1][s2][a2][s3][a3]concat=n=8:v=0:a=1[aout]",
  ].join(";");

  run(
    [
      "-i",
      clips[0],
      "-i",
      clips[1],
      "-i",
      clips[2],
      "-i",
      clips[3],
      "-filter_complex",
      filter,
      "-map",
      "[aout]",
      bed,
    ],
    "Build SFX bed",
  );

  // Keep full video length; pad audio with silence if shorter.
  run(
    [
      "-i",
      videoIn,
      "-i",
      bed,
      "-filter_complex",
      "[1:a]apad[a]",
      "-map",
      "0:v",
      "-map",
      "[a]",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-shortest",
      videoOut,
    ],
    "Mux SFX bed onto preview video",
  );

  console.log("DONE:", path.relative(root, videoOut));
}

main();
