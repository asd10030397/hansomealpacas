/**
 * Record King Alpaca promotional trailer (16:9 + optional 9:16) and mux audio.
 *
 * Prerequisites: `npm run dev` on PREVIEW_URL (default http://127.0.0.1:3000)
 *
 * Usage:
 *   node scripts/record-king-promo.mjs
 *   node scripts/record-king-promo.mjs --vertical
 *
 * Output:
 *   reports/king-promo/hansome-king-promo-16x9.mp4
 *   reports/king-promo/hansome-king-promo-9x16.mp4 (with --vertical or by default both)
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "reports", "king-promo");
const baseUrl = process.env.PREVIEW_URL ?? "http://127.0.0.1:3000";

/** Sum of KING_PROMO_SCENES durations + buffer */
const TOTAL_SCENE_MS = 4500 + 4500 + 4000 + 5500 + 5000; // 23500
const HOLD_AFTER_MS = 600;

const VARIANTS = [
  {
    name: "16x9",
    width: 1920,
    height: 1080,
    aspect: "16:9",
    out: "hansome-king-promo-16x9.mp4",
  },
  {
    name: "9x16",
    width: 608,
    height: 1080,
    aspect: "9:16",
    out: "hansome-king-promo-9x16.mp4",
  },
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

function pickVariants() {
  const argv = process.argv.slice(2);
  if (argv.includes("--vertical-only")) return VARIANTS.filter((v) => v.name === "9x16");
  if (argv.includes("--horizontal-only")) return VARIANTS.filter((v) => v.name === "16x9");
  return VARIANTS;
}

async function recordVariant(browser, variant) {
  const previewPath = `/dev/king-promo?autostart=1&record=1&silent=1&aspect=${encodeURIComponent(variant.aspect)}`;

  const initPrefs = () => {
    localStorage.setItem(
      "hansome-game-audio",
      JSON.stringify({ musicEnabled: false, sfxEnabled: false }),
    );
    localStorage.setItem("hansome-game-audio-defaults-v2", "1");
  };

  // Warm compile + asset decode
  {
    const warm = await browser.newContext({
      viewport: { width: variant.width, height: variant.height },
    });
    const warmPage = await warm.newPage();
    await warmPage.addInitScript(initPrefs);
    await warmPage.goto(`${baseUrl}/dev/king-promo?aspect=${encodeURIComponent(variant.aspect)}`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await warmPage.getByTestId("king-promo-root").waitFor({ timeout: 120000 });
    await warmPage.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="king-promo-root"]')
          ?.getAttribute("data-assets-ready") === "1",
      null,
      { timeout: 120000 },
    );
    await warm.close();
  }

  const context = await browser.newContext({
    viewport: { width: variant.width, height: variant.height },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: outDir,
      size: { width: variant.width, height: variant.height },
    },
  });

  const page = await context.newPage();
  await page.addInitScript(initPrefs);

  const navAt = Date.now();
  await page.goto(`${baseUrl}${previewPath}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.getByTestId("king-promo-root").waitFor();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="king-promo-root"]')
        ?.getAttribute("data-assets-ready") === "1",
    null,
    { timeout: 120000 },
  );

  // Wait until playing starts (autostart) — click Start if still idle.
  try {
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="king-promo-root"]')
          ?.getAttribute("data-phase") === "playing",
      null,
      { timeout: 12000 },
    );
  } catch {
    const start = page.getByTestId("king-promo-start");
    if (await start.count()) {
      await start.click();
    }
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="king-promo-root"]')
          ?.getAttribute("data-phase") === "playing",
      null,
      { timeout: 30000 },
    );
  }
  const leadInMs = Date.now() - navAt;

  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="king-promo-root"]')
        ?.getAttribute("data-done") === "1",
    null,
    { timeout: TOTAL_SCENE_MS + 15000 },
  );
  await page.waitForTimeout(HOLD_AFTER_MS);

  const video = page.video();
  await context.close();

  const rawVideo = video ? await video.path() : null;
  if (!rawVideo || !fs.existsSync(rawVideo)) {
    throw new Error(`No video for ${variant.name}`);
  }

  const silentMp4 = path.join(outDir, `king-promo-${variant.name}-silent.mp4`);
  runFfmpeg(
    [
      "-i",
      rawVideo,
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "30",
      "-crf",
      "18",
      "-preset",
      "medium",
      silentMp4,
    ],
    `encode silent ${variant.name}`,
  );

  return { silentMp4, leadInMs, variant };
}

async function main() {
  ensureDir(outDir);
  const variants = pickVariants();

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--font-render-hinting=none",
    ],
  });

  const recorded = [];
  try {
    for (const variant of variants) {
      console.log(`\n=== Recording ${variant.name} (${variant.width}×${variant.height}) ===`);
      recorded.push(await recordVariant(browser, variant));
    }
  } finally {
    await browser.close();
  }

  // Build audio using lead-in from first (16x9) take when present
  const lead = recorded.find((r) => r.variant.name === "16x9") ?? recorded[0];
  process.env.LEAD_IN_MS = String(Math.max(200, Math.min(lead.leadInMs, 2500)));
  console.log("\nLEAD_IN_MS", process.env.LEAD_IN_MS);
  const audioBuild = spawnSync("node", [path.join(root, "scripts/build-king-promo-audio.mjs")], {
    encoding: "utf8",
    env: process.env,
    cwd: root,
  });
  if (audioBuild.status !== 0) {
    console.error(audioBuild.stderr || audioBuild.stdout);
    throw new Error("audio mix failed");
  }
  console.log(audioBuild.stdout);

  const mixWav = path.join(outDir, "king-promo-mix.wav");
  for (const { silentMp4, variant } of recorded) {
    const finalMp4 = path.join(outDir, variant.out);
    runFfmpeg(
      [
        "-i",
        silentMp4,
        "-i",
        mixWav,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        finalMp4,
      ],
      `mux ${variant.name}`,
    );
    console.log("✓", finalMp4);
  }

  console.log("\nDone. Exports:");
  for (const { variant } of recorded) {
    console.log(" ", path.join(outDir, variant.out));
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
