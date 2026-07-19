/**
 * Mix production gameplay BGM (Alpaca Warpath) with presentation SFX.
 * Loud SFX + BGM ducking while SFX play, then smooth restore.
 *
 * Timestamps must match app/dev/season1-showcase/page.tsx
 *
 * Usage: node scripts/build-season1-showcase-audio.mjs
 * Env: LEAD_IN_MS — ms from video start until START click
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "reports", "season1-showcase");
const outWav = path.join(outDir, "season1-showcase-mix.wav");
const timelineJson = path.join(outDir, "season1-showcase-timeline.json");

/** Keep in sync with page.tsx */
const LEAD_IN_MS = Math.max(0, Number(process.env.LEAD_IN_MS ?? "500"));
const FX_DELAY_MS = 950; // NFT enter 450 + hold 500
const GAP_MS = 320;
const ENDING_MS = 3400;
const PAD_END_MS = 400;

const BGM_BASE = 0.22;
const BGM_DUCKED = 0.07;
const SFX_GAIN = 4.2;
const DUCK_PAD_SEC = 0.1;
/** Soft restore after each SFX window (seconds) */
const DUCK_RELEASE_SEC = 0.28;

const BGM = path.join(root, "public/audio/game/gameplay-theme.mp3");

const SCENES = [
  { label: "guardian", durationMs: 1200, sfx: "public/audio/game/abilities/guardian/effect.mp3" },
  { label: "runner", durationMs: 1200, sfx: "public/audio/game/abilities/runner/effect.mp3" },
  { label: "lucky", durationMs: 1300, sfx: "public/audio/game/abilities/lucky/effect.mp3" },
  { label: "farmer", durationMs: 1400, sfx: "public/audio/game/abilities/farmer/effect.mp3" },
  { label: "alpaca-hunted", durationMs: 1200, sfx: "public/audio/game/settlement-results/alpaca-hunted/effect.mp3" },
  { label: "alpaca-safe", durationMs: 1250, sfx: "public/audio/game/settlement-results/alpaca-safe/effect.mp3" },
  { label: "cougar-hunt-success", durationMs: 1300, sfx: "public/audio/game/settlement-results/cougar-hunt-success/effect.mp3" },
  { label: "cougar-hunt-failed", durationMs: 1350, sfx: "public/audio/game/settlement-results/cougar-hunt-failed/effect.mp3" },
];

function buildTimeline() {
  let cursor = LEAD_IN_MS;
  const events = [];
  for (let i = 0; i < SCENES.length; i++) {
    const s = SCENES[i];
    const fxStart = cursor + FX_DELAY_MS;
    events.push({
      label: s.label,
      startSec: fxStart / 1000,
      endSec: (fxStart + s.durationMs) / 1000 + DUCK_PAD_SEC,
      durationMs: s.durationMs,
      sfx: path.join(root, s.sfx),
    });
    cursor = fxStart + s.durationMs + GAP_MS;
  }
  const endingStart = cursor;
  const totalMs = endingStart + ENDING_MS + PAD_END_MS;
  return {
    events,
    endingStartSec: endingStart / 1000,
    totalSec: totalMs / 1000,
    leadInMs: LEAD_IN_MS,
  };
}

/**
 * BGM gain envelope: ducked during SFX, linear restore after each window.
 * Built as nested if() for ffmpeg volume eval=frame.
 */
function bgmVolumeExpr(events) {
  const rel = DUCK_RELEASE_SEC;
  let expr = `${BGM_BASE}`;
  for (let i = events.length - 1; i >= 0; i--) {
    const s = events[i].startSec;
    const e = events[i].endSec;
    const r = e + rel;
    // During [s,e]: ducked. During [e,r]: lerp ducked→base. Else: fall through.
    const ramp = `${BGM_DUCKED}+(${BGM_BASE}-${BGM_DUCKED})*(t-${e.toFixed(3)})/${rel.toFixed(3)}`;
    expr =
      `if(between(t\\,${s.toFixed(3)}\\,${e.toFixed(3)})\\,${BGM_DUCKED}\\,` +
      `if(between(t\\,${e.toFixed(3)}\\,${r.toFixed(3)})\\,${ramp}\\,${expr}))`;
  }
  return expr;
}

function run(args, label) {
  console.log("→", label);
  const r = spawnSync("ffmpeg", ["-y", ...args], {
    encoding: "utf8",
    maxBuffer: 40 * 1024 * 1024,
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    throw new Error(label);
  }
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(BGM)) throw new Error(`Missing BGM: ${BGM}`);

  const { events, endingStartSec, totalSec, leadInMs } = buildTimeline();
  for (const e of events) {
    if (!fs.existsSync(e.sfx)) throw new Error(`Missing SFX: ${e.sfx}`);
  }

  fs.writeFileSync(
    timelineJson,
    JSON.stringify(
      {
        totalSec,
        endingStartSec,
        leadInMs,
        bgmBase: BGM_BASE,
        bgmDucked: BGM_DUCKED,
        sfxGain: SFX_GAIN,
        fxDelayMs: FX_DELAY_MS,
        duckReleaseSec: DUCK_RELEASE_SEC,
        events,
      },
      null,
      2,
    ),
  );

  const inputs = ["-i", BGM];
  for (const e of events) inputs.push("-i", e.sfx);

  const n = events.length;
  const fadeOutStart = Math.max(0, totalSec - 1.5);
  const volExpr = bgmVolumeExpr(events);

  const parts = [];
  parts.push(
    `[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,atrim=0:${totalSec.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.85,afade=t=out:st=${fadeOutStart.toFixed(3)}:d=1.4,volume='${volExpr}':eval=frame[bgm]`,
  );

  // Delay each SFX onto a full-length silent bed, then sum — avoids amix dilution.
  const sfxLabels = [];
  for (let i = 0; i < n; i++) {
    const e = events[i];
    const lab = `s${i}`;
    sfxLabels.push(lab);
    const delayMs = Math.round(e.startSec * 1000);
    parts.push(
      `[${i + 1}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=${SFX_GAIN},acompressor=threshold=-16dB:ratio=2.5:attack=5:release=60:makeup=3,adelay=${delayMs}|${delayMs},apad=whole_dur=${totalSec.toFixed(3)}[${lab}]`,
    );
  }

  parts.push(
    `${sfxLabels.map((l) => `[${l}]`).join("")}amix=inputs=${n}:duration=first:dropout_transition=0:normalize=0[sfxsum]`,
  );
  parts.push(
    `[bgm][sfxsum]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[aout]`,
  );

  run(
    [
      ...inputs,
      "-filter_complex",
      parts.join(";"),
      "-map",
      "[aout]",
      "-t",
      totalSec.toFixed(3),
      "-ar",
      "44100",
      "-ac",
      "2",
      outWav,
    ],
    "Mix Warpath BGM + loud ducked SFX",
  );

  console.log("Timeline:", path.relative(root, timelineJson));
  console.log("Audio:", path.relative(root, outWav));
  console.log(
    `Duration: ${totalSec.toFixed(2)}s · SFX×${SFX_GAIN} · BGM ${BGM_BASE}→${BGM_DUCKED} (release ${DUCK_RELEASE_SEC}s)`,
  );
}

main();
