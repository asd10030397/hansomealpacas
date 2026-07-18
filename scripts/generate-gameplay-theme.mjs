/**
 * Build a "battle mode" HANSOME theme from the existing site ambient track.
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
const src = path.join(root, "public/audio/ambient.wav");
const outDir = path.join(root, "public/audio/game");
const tmpDir = path.join(root, "tmp/audio");

const TEMPO = 1.15; // ~15% faster
const LOOP_XFADE = 1.6; // seconds of loop seam blend

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

function probeDuration(file) {
  const r = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      file,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error("ffprobe failed");
  return Number(r.stdout.trim());
}

function main() {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source: ${src}`);
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  const srcDur = probeDuration(src);
  const baseDur = srcDur / TEMPO;
  console.log(`Source duration: ${srcDur.toFixed(3)}s → tempo ${TEMPO}x ≈ ${baseDur.toFixed(3)}s`);

  const base = path.join(tmpDir, "base-tempo.wav");
  const tension = path.join(tmpDir, "tension.wav");
  const drums = path.join(tmpDir, "drums.wav");
  const mixed = path.join(tmpDir, "mixed.wav");
  const looped = path.join(tmpDir, "looped.wav");
  const ogg = path.join(outDir, "gameplay-theme.ogg");
  const mp3 = path.join(outDir, "gameplay-theme.mp3");
  const impact = path.join(outDir, "phase-impact.ogg");

  // 1) Tempo-shift original (identity preserved) + mild presence / low-end for hunt feel
  run(
    [
      "-i",
      src,
      "-af",
      [
        `atempo=${TEMPO}`,
        "equalizer=f=70:t=q:w=0.8:g=4",
        "equalizer=f=180:t=q:w=0.9:g=2",
        "equalizer=f=2200:t=q:w=1.1:g=1.8",
        "equalizer=f=5500:t=q:w=1:g=-1.5",
        "acompressor=threshold=-18dB:ratio=2.2:attack=20:release=220:makeup=1.5",
      ].join(","),
      "-ar",
      "44100",
      "-ac",
      "2",
      base,
    ],
    "Tempo + hunt EQ",
  );

  // 2) Tension layer: dark pad pulse from the same theme (recognizable, more suspense)
  run(
    [
      "-i",
      base,
      "-af",
      [
        "lowpass=f=420",
        "highpass=f=60",
        "treble=g=-8",
        "tremolo=f=0.22:d=0.55",
        "chorus=0.5:0.8:40:0.4:0.25:2",
        // Slow build: tension rises across the loop
        `volume='0.25+0.55*(t/${baseDur.toFixed(3)})':eval=frame`,
      ].join(","),
      tension,
    ],
    "Tension strings/synth pulse",
  );

  // 3) Percussion stem: deep kicks + taiko-ish hits + rising cinematic accents
  // Built from synthesized sources so we don't need a sample pack.
  const d = baseDur.toFixed(3);
  const drumGraph = [
    `anoisesrc=color=brown:amplitude=0.55:d=${d}[nk]`,
    `sine=f=58:d=${d}[sk]`,
    `[nk][sk]amix=inputs=2:duration=first:dropout_transition=0,lowpass=f=110,apulsator=mode=sine:hz=1.92:amount=1:offset_l=0.15:offset_r=0.15,acompressor=threshold=-28dB:ratio=8:attack=5:release=80:makeup=8,volume=0.55[kick]`,
    `anoisesrc=color=pink:amplitude=0.4:d=${d},bandpass=f=180:width_type=h:width=120,apulsator=mode=sine:hz=0.48:amount=1:offset_l=0.05:offset_r=0.55,acompressor=threshold=-26dB:ratio=6:attack=8:release=120:makeup=7,volume=0.38[taiko]`,
    `anoisesrc=color=white:amplitude=0.7:d=${d},highpass=f=200,lowpass=f=2500,apulsator=mode=sine:hz=0.125:amount=1:offset_l=0.7:offset_r=0.7,acompressor=threshold=-22dB:ratio=10:attack=3:release=200:makeup=6,volume='0.12+0.55*(t/${d})':eval=frame[hits]`,
    `[kick][taiko][hits]amix=inputs=3:duration=first:dropout_transition=0,alimiter=limit=0.85,volume='0.25+0.75*(t/${d})':eval=frame`,
  ].join(";");

  run(
    ["-filter_complex", drumGraph, "-ar", "44100", "-ac", "2", drums],
    "Percussion stem",
  );

  // 4) Mix: theme (always lead) + tension + drums; theme stays recognizable
  run(
    [
      "-i",
      base,
      "-i",
      tension,
      "-i",
      drums,
      "-filter_complex",
      [
        `[0:a]volume=1.0[theme]`,
        `[1:a]volume=0.55[ten]`,
        `[2:a]volume=0.62[drm]`,
        `[theme][ten][drm]amix=inputs=3:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.92,volume='0.88+0.18*(t/${baseDur.toFixed(3)})':eval=frame[out]`,
      ].join(";"),
      "-map",
      "[out]",
      "-ar",
      "44100",
      "-ac",
      "2",
      mixed,
    ],
    "Mix stems",
  );

  // 5) Seamless loop: crossfade tail into head
  const outDur = Math.max(baseDur - LOOP_XFADE, 8);
  const cf = LOOP_XFADE.toFixed(3);
  run(
    [
      "-i",
      mixed,
      "-filter_complex",
      [
        `[0:a]asplit=2[a][b]`,
        `[a]atrim=0:${outDur.toFixed(3)},asetpts=PTS-STARTPTS[main]`,
        `[b]atrim=${(baseDur - LOOP_XFADE).toFixed(3)}:${baseDur.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=out:st=0:d=${cf}[tail]`,
        `[main]afade=t=in:st=0:d=${cf}[head]`,
        `[head][tail]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.9[out]`,
      ].join(";"),
      "-map",
      "[out]",
      "-ar",
      "44100",
      "-ac",
      "2",
      looped,
    ],
    "Loop seam crossfade",
  );

  // 6) Encode delivery formats (keep levels modest for UI/SFX headroom)
  run(
    [
      "-i",
      looped,
      "-af",
      "loudnorm=I=-18:TP=-2:LRA=9,volume=0.85",
      "-c:a",
      "libvorbis",
      "-q:a",
      "5",
      ogg,
    ],
    "Encode gameplay-theme.ogg",
  );

  run(
    [
      "-i",
      looped,
      "-af",
      "loudnorm=I=-18:TP=-2:LRA=9,volume=0.85",
      "-c:a",
      "libmp3lame",
      "-q:a",
      "4",
      mp3,
    ],
    "Encode gameplay-theme.mp3",
  );

  // 7) Short phase-impact one-shot (Reveal / Settlement sting) — derived character, not a new theme
  run(
    [
      "-filter_complex",
      [
        "sine=f=70:d=1.4[a]",
        "sine=f=110:d=1.4[b]",
        "anoisesrc=color=pink:amplitude=0.5:d=1.4[n]",
        "[a][b][n]amix=inputs=3:duration=first,afade=t=in:st=0:d=0.02,afade=t=out:st=0.35:d=1.0,lowpass=f=900,acompressor=threshold=-20dB:ratio=6:attack=5:release=200:makeup=4,volume=0.7,alimiter=limit=0.85[out]",
      ].join(";"),
      "-map",
      "[out]",
      "-ar",
      "44100",
      "-ac",
      "2",
      "-c:a",
      "libvorbis",
      "-q:a",
      "4",
      impact,
    ],
    "Encode phase-impact.ogg",
  );

  const oggDur = probeDuration(ogg);
  console.log("\nDone.");
  console.log(`  ${path.relative(root, ogg)}  (${oggDur.toFixed(2)}s)`);
  console.log(`  ${path.relative(root, mp3)}`);
  console.log(`  ${path.relative(root, impact)}`);
  console.log("  Source ambient.wav left unchanged.");
}

main();
