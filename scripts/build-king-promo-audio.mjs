/**
 * Mix soft BGM bed + King royal SFX for the King promo trailer.
 * Timestamps must match app/dev/king-promo/page.tsx scene durations.
 *
 * Usage: node scripts/build-king-promo-audio.mjs
 * Env: LEAD_IN_MS — ms from video start until scene 0 begins
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "reports", "king-promo");
const outWav = path.join(outDir, "king-promo-mix.wav");

const LEAD_IN_MS = Math.max(0, Number(process.env.LEAD_IN_MS ?? "500"));
const FX_DELAY_MS = 700;
const PAD_END_MS = 350;

const BGM_BASE = 0.2;
const BGM_DUCKED = 0.06;
const SFX_GAIN = 3.6;
const DUCK_PAD_SEC = 0.12;
const DUCK_RELEASE_SEC = 0.3;

const BGM = path.join(root, "public/audio/game/gameplay-theme.mp3");
const KING_SFX = path.join(root, "public/audio/game/abilities/king/effect.mp3");
const HUNT_SFX = path.join(
  root,
  "public/audio/game/settlement-results/cougar-hunt-success/effect.mp3",
);

/** Keep in sync with KING_PROMO_SCENES in page.tsx */
const SCENES = [
  { id: "intro", durationMs: 4500, sfx: "king" },
  { id: "hunt", durationMs: 4500, sfx: "hunt" },
  { id: "reveal", durationMs: 4000, sfx: null },
  { id: "immunity", durationMs: 5500, sfx: "king" },
  { id: "ending", durationMs: 5000, sfx: null },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function runFfmpeg(args, label) {
  console.log("→", label);
  const r = spawnSync("ffmpeg", ["-y", ...args], {
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024,
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    throw new Error(label);
  }
}

function buildTimeline() {
  let cursor = LEAD_IN_MS;
  const events = [];
  for (const s of SCENES) {
    if (s.sfx) {
      const startMs = cursor + FX_DELAY_MS;
      const durationMs = s.sfx === "king" ? 1400 : 1300;
      events.push({
        label: `${s.id}-${s.sfx}`,
        startSec: startMs / 1000,
        endSec: (startMs + durationMs) / 1000 + DUCK_PAD_SEC,
        sfxPath: s.sfx === "king" ? KING_SFX : HUNT_SFX,
      });
    }
    cursor += s.durationMs;
  }
  return {
    events,
    totalSec: (cursor + PAD_END_MS) / 1000,
    leadInMs: LEAD_IN_MS,
  };
}

function bgmVolumeExpr(events) {
  const rel = DUCK_RELEASE_SEC;
  let expr = `${BGM_BASE}`;
  for (let i = events.length - 1; i >= 0; i--) {
    const s = events[i].startSec;
    const e = events[i].endSec;
    const restore = e + rel;
    expr = `if(between(t\\,${s.toFixed(3)}\\,${e.toFixed(3)})\\,${BGM_DUCKED}\\,if(between(t\\,${e.toFixed(3)}\\,${restore.toFixed(3)})\\,${BGM_DUCKED}+(${BGM_BASE}-${BGM_DUCKED})*(t-${e.toFixed(3)})/${rel}\\,${expr}))`;
  }
  return expr;
}

function main() {
  ensureDir(outDir);
  for (const p of [BGM, KING_SFX, HUNT_SFX]) {
    if (!fs.existsSync(p)) throw new Error(`Missing audio: ${p}`);
  }

  const timeline = buildTimeline();
  fs.writeFileSync(
    path.join(outDir, "king-promo-timeline.json"),
    JSON.stringify(timeline, null, 2),
  );

  const inputs = ["-i", BGM];
  for (const ev of timeline.events) {
    inputs.push("-i", ev.sfxPath);
  }

  const n = timeline.events.length;
  const volExpr = bgmVolumeExpr(timeline.events);
  const filters = [
    `[0:a]atrim=0:${timeline.totalSec.toFixed(3)},asetpts=PTS-STARTPTS,volume='${volExpr}':eval=frame[bgm]`,
  ];

  const mixInputs = ["[bgm]"];
  for (let i = 0; i < n; i++) {
    const ev = timeline.events[i];
    const delayMs = Math.round(ev.startSec * 1000);
    filters.push(
      `[${i + 1}:a]aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${SFX_GAIN},adelay=${delayMs}|${delayMs}[sfx${i}]`,
    );
    mixInputs.push(`[sfx${i}]`);
  }

  filters.push(
    `${mixInputs.join("")}amix=inputs=${mixInputs.length}:duration=first:dropout_transition=0:normalize=0[mix]`,
  );

  runFfmpeg(
    [
      ...inputs,
      "-filter_complex",
      filters.join(";"),
      "-map",
      "[mix]",
      "-t",
      timeline.totalSec.toFixed(3),
      "-ar",
      "48000",
      "-ac",
      "2",
      outWav,
    ],
    "mix king promo audio",
  );

  console.log("wrote", outWav);
  console.log("totalSec", timeline.totalSec.toFixed(2));
}

main();
