/**
 * Record Season 1 presentation showcase at 1920×1080 / 60fps and mux
 * production gameplay BGM + SFX.
 *
 * Prerequisites: `npm run dev` on PREVIEW_URL (default http://127.0.0.1:3000)
 *
 * Usage: node scripts/record-season1-showcase.mjs
 * Output: reports/season1-showcase/hansome-season1-presentation-showcase.mp4
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "reports", "season1-showcase");
const baseUrl = process.env.PREVIEW_URL ?? "http://127.0.0.1:3000";
const previewPath = "/dev/season1-showcase?record=1&silent=1";

const WIDTH = 1920;
const HEIGHT = 1080;

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

async function main() {
  ensureDir(outDir);
  const mixWav = path.join(outDir, "season1-showcase-mix.wav");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--font-render-hinting=none",
    ],
  });

  const initPrefs = () => {
    localStorage.setItem(
      "hansome-game-audio",
      JSON.stringify({ musicEnabled: false, sfxEnabled: false }),
    );
    localStorage.setItem("hansome-game-audio-defaults-v2", "1");
  };

  // Warm compile
  {
    const warm = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
    });
    const warmPage = await warm.newPage();
    await warmPage.addInitScript(initPrefs);
    await warmPage.goto(`${baseUrl}/dev/season1-showcase`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await warmPage.getByTestId("s1-showcase-root").waitFor({ timeout: 120000 });
    // Prefetch NFT images used in the showcase
    await warmPage.evaluate(async () => {
      const ids = [13, 8, 6, 4, 100, 250, 501, 525];
      await Promise.all(
        ids.map(
          (id) =>
            new Promise((resolve) => {
              const img = new Image();
              img.onload = img.onerror = () => resolve(null);
              img.src = `/pixel/genesis/collection-550/image/${id}.png`;
            }),
        ),
      );
    });
    await warm.close();
  }

  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: outDir,
      size: { width: WIDTH, height: HEIGHT },
    },
  });

  const page = await context.newPage();
  await page.addInitScript(initPrefs);

  const navAt = Date.now();
  await page.goto(`${baseUrl}${previewPath}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.getByTestId("s1-showcase-root").waitFor();

  // Wait until NFT art is preloaded (no pop-in during take).
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="s1-showcase-root"]')
        ?.getAttribute("data-assets-ready") === "1",
    null,
    { timeout: 120000 },
  );
  await page.waitForTimeout(200);

  const leadInMs = Date.now() - navAt;
  console.log(`Lead-in before START click: ${leadInMs}ms`);

  // Explicit start — scene 0 mounts here (audio lead-in = time to this click).
  // Button may be visually hidden in record mode; force JS click.
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="s1-showcase-start"]');
    if (!btn) throw new Error("START button missing");
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  const startedAt = Date.now();

  // Wait for end card, then hold through fade, then done.
  // Ignore mid-run HMR navigations by re-checking the live document.
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="s1-showcase-ending"]') != null ||
      document
        .querySelector('[data-testid="s1-showcase-root"]')
        ?.getAttribute("data-done") === "1",
    null,
    { timeout: 90000 },
  );
  await page.waitForTimeout(2800);
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="s1-showcase-root"]')?.getAttribute("data-done") ===
      "1",
    null,
    { timeout: 10000 },
  );
  await page.waitForTimeout(400);

  const elapsed = Date.now() - startedAt;
  console.log(`Sequence elapsed: ${(elapsed / 1000).toFixed(2)}s`);

  // Build audio with measured lead-in so SFX land on FX (after NFT hold).
  const audioBuild = spawnSync(
    process.execPath,
    [path.join(root, "scripts/build-season1-showcase-audio.mjs")],
    {
      cwd: root,
      encoding: "utf8",
      stdio: "inherit",
      env: { ...process.env, LEAD_IN_MS: String(leadInMs) },
    },
  );
  if (audioBuild.status !== 0) throw new Error("Audio mix failed");
  const timeline = JSON.parse(
    fs.readFileSync(path.join(outDir, "season1-showcase-timeline.json"), "utf8"),
  );
  console.log(`Audio total: ${timeline.totalSec.toFixed(2)}s`);

  const video = page.video();
  await context.close();
  await browser.close();

  const rawVideo = video ? await video.path() : null;
  if (!rawVideo || !fs.existsSync(rawVideo)) {
    throw new Error("Playwright did not produce a video file");
  }

  const rawCopy = path.join(outDir, "season1-showcase-raw.webm");
  fs.copyFileSync(rawVideo, rawCopy);

  const silentMp4 = path.join(outDir, "season1-showcase-silent.mp4");
  // Re-encode to 60fps H.264 1080p
  runFfmpeg(
    [
      "-i",
      rawCopy,
      "-vf",
      "scale=1920:1080:flags=lanczos,fps=60",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "16",
      "-pix_fmt",
      "yuv420p",
      "-an",
      silentMp4,
    ],
    "Encode silent 1080p60 H.264",
  );

  const finalMp4 = path.join(
    outDir,
    "hansome-season1-presentation-showcase.mp4",
  );

  runFfmpeg(
    [
      "-i",
      silentMp4,
      "-i",
      mixWav,
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
      "256k",
      "-shortest",
      "-movflags",
      "+faststart",
      finalMp4,
    ],
    "Mux Warpath+SFX mix onto video",
  );

  // Probe
  const probe = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,r_frame_rate,duration",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      finalMp4,
    ],
    { encoding: "utf8" },
  );
  if (probe.status === 0) {
    fs.writeFileSync(
      path.join(outDir, "season1-showcase-probe.json"),
      probe.stdout,
    );
    console.log(probe.stdout);
  }

  console.log("DONE:", path.relative(root, finalMp4));
  console.log("Preview:", `${baseUrl}/dev/season1-showcase`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
