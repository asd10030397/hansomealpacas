/**
 * Record a short Playwright video of /game/dev/ability-fx-preview
 * (Guardian → Runner → Lucky → Farmer with SFX unlocked via click).
 *
 * Usage: node scripts/record-ability-fx-preview.mjs
 * Output: reports/ability-fx-preview/ability-fx-preview.webm
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "reports", "ability-fx-preview");
const baseUrl = process.env.PREVIEW_URL ?? "http://127.0.0.1:3000";
const previewPath = "/game/dev/ability-fx-preview";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function tryMuxAudio(videoPath, audioPath, muxedPath) {
  if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size < 1000) {
    return false;
  }
  const r = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      videoPath,
      "-i",
      audioPath,
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-shortest",
      muxedPath,
    ],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
  return r.status === 0 && fs.existsSync(muxedPath);
}

async function main() {
  ensureDir(outDir);

  // Optional: capture default WASAPI loopback while the preview runs.
  const audioPath = path.join(outDir, "ability-fx-preview-audio.wav");
  let audioProc = null;
  const wasapi = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-f", "wasapi", "-list_devices", "true", "-i", "dummy"],
    { encoding: "utf8" },
  );
  const list = `${wasapi.stderr || ""}\n${wasapi.stdout || ""}`;
  const loopback =
    list.match(/"([^"]*Loopback[^"]*)"/i)?.[1] ||
    list.match(/"([^"]*Stereo Mix[^"]*)"/i)?.[1] ||
    null;

  if (loopback) {
    console.log("Capturing WASAPI audio:", loopback);
    audioProc = spawn(
      "ffmpeg",
      [
        "-y",
        "-f",
        "wasapi",
        "-i",
        loopback,
        "-ac",
        "2",
        "-ar",
        "44100",
        audioPath,
      ],
      { stdio: "ignore" },
    );
  } else {
    console.warn(
      "No WASAPI loopback device found — video will be silent; SFX still plays in-browser during capture.",
    );
  }

  const browser = await chromium.launch({
    headless: false,
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--use-fake-ui-for-media-stream",
    ],
  });

  const initAudioPrefs = () => {
    localStorage.setItem(
      "hansome-game-audio",
      JSON.stringify({ musicEnabled: false, sfxEnabled: true }),
    );
    localStorage.setItem("hansome-game-audio-defaults-v2", "1");
  };

  // Warm compile outside the recorded context.
  {
    const warm = await browser.newContext({ viewport: { width: 720, height: 900 } });
    const warmPage = await warm.newPage();
    await warmPage.addInitScript(initAudioPrefs);
    await warmPage.goto(`${baseUrl}${previewPath}`, { waitUntil: "domcontentloaded" });
    await warmPage.getByTestId("ability-fx-preview-badge").waitFor({ timeout: 60000 });
    await warm.close();
  }

  const context = await browser.newContext({
    viewport: { width: 720, height: 900 },
    recordVideo: {
      dir: outDir,
      size: { width: 720, height: 900 },
    },
  });

  const page = await context.newPage();
  await page.addInitScript(initAudioPrefs);

  // Recorded take — click unlocks autoplay; autostart also armed via query.
  await page.goto(`${baseUrl}${previewPath}?autostart=1`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByTestId("ability-fx-preview-badge").waitFor();
  await page.getByTestId("ability-fx-start").click();

  await page.getByTestId("ability-fx-label").filter({ hasText: "Guardian" }).waitFor({
    timeout: 10000,
  });
  await page.getByTestId("ability-fx-label").filter({ hasText: "Runner" }).waitFor({
    timeout: 8000,
  });
  await page.getByTestId("ability-fx-label").filter({ hasText: "Lucky" }).waitFor({
    timeout: 8000,
  });
  await page.getByTestId("ability-fx-label").filter({ hasText: "Harvest" }).waitFor({
    timeout: 8000,
  });
  await page.getByTestId("ability-fx-label").filter({ hasText: "SEQUENCE COMPLETE" }).waitFor({
    timeout: 8000,
  });

  // Hold a beat on the complete state.
  await page.waitForTimeout(1000);

  const video = page.video();
  await context.close();
  await browser.close();

  if (audioProc) {
    try {
      audioProc.kill("SIGINT");
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  const rawVideo = video ? await video.path() : null;
  if (!rawVideo || !fs.existsSync(rawVideo)) {
    throw new Error("Playwright did not produce a video file");
  }

  const finalVideo = path.join(outDir, "ability-fx-preview.webm");
  const muxedMp4 = path.join(outDir, "ability-fx-preview.mp4");
  fs.copyFileSync(rawVideo, finalVideo);

  let delivered = finalVideo;
  if (tryMuxAudio(finalVideo, audioPath, muxedMp4)) {
    delivered = muxedMp4;
    console.log("Muxed video + WASAPI audio →", path.relative(root, muxedMp4));
  } else {
    // Re-encode to mp4 for easier playback even without audio track.
    const enc = spawnSync(
      "ffmpeg",
      ["-y", "-i", finalVideo, "-c:v", "libx264", "-pix_fmt", "yuv420p", muxedMp4],
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
    );
    if (enc.status === 0) {
      delivered = muxedMp4;
      console.log("Wrote", path.relative(root, muxedMp4), "(video only)");
    } else {
      console.log("Wrote", path.relative(root, finalVideo));
    }
  }

  console.log("DONE:", delivered);
  console.log("Preview URL:", `${baseUrl}${previewPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
