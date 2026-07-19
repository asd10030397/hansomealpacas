/**
 * Record a step-by-step how-to-play walkthrough from the live local game UI.
 * Ends holding on Battle Result / settlement visuals (real pages, not mock slides).
 *
 * Prerequisites:
 *   Local site running (default http://localhost:3002)
 *   ffmpeg on PATH
 *
 * Usage:
 *   PREVIEW_URL=http://localhost:3002 node scripts/record-how-to-play.mjs
 *
 * Output:
 *   reports/how-to-play/hansome-how-to-play.mp4
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "reports", "how-to-play");
const baseUrl = (process.env.PREVIEW_URL || "http://localhost:3002").replace(
  /\/$/,
  "",
);

const WIDTH = 1440;
const HEIGHT = 900;

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

async function showStep(page, step, title, body, holdMs = 2800) {
  await page.evaluate(
    ({ step, title, body }) => {
      let el = document.getElementById("howto-caption");
      if (!el) {
        el = document.createElement("div");
        el.id = "howto-caption";
        el.setAttribute(
          "style",
          [
            "position:fixed",
            "left:24px",
            "right:24px",
            "bottom:28px",
            "z-index:2147483646",
            "pointer-events:none",
            "padding:16px 20px",
            "border:3px solid #9a6a12",
            "background:rgba(10,14,24,0.92)",
            "box-shadow:4px 4px 0 #0a0c12",
            "color:#f3ebe0",
            "font-family:Anton,Impact,sans-serif",
            "letter-spacing:0.04em",
          ].join(";"),
        );
        document.body.appendChild(el);
      }
      el.innerHTML = `
        <div style="color:#f0c44a;font-size:14px;margin-bottom:6px">STEP ${step}</div>
        <div style="font-size:22px;color:#f0c44a;margin-bottom:6px">${title}</div>
        <div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.45;color:#c8c4b8;letter-spacing:0;font-weight:500">${body}</div>
      `;
    },
    { step, title, body },
  );
  await page.waitForTimeout(holdMs);
}

async function hideStep(page) {
  await page.evaluate(() => {
    document.getElementById("howto-caption")?.remove();
  });
}

async function safeGoto(page, urlPath, waitMs = 800) {
  await page.goto(`${baseUrl}${urlPath}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(waitMs);
}

async function main() {
  ensureDir(outDir);
  console.log("Recording how-to-play from", baseUrl);

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
      JSON.stringify({ musicEnabled: true, sfxEnabled: true }),
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
    await warmPage.goto(`${baseUrl}/game`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await warmPage.waitForTimeout(1500);
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

  // ── 1. Title / HOME ──────────────────────────────────────────────
  await safeGoto(page, "/game", 1200);
  await showStep(
    page,
    "1",
    "ENTER HANSOME",
    "打開遊戲首頁。連接錢包後，從 PLAY 進入每日對局。",
    3200,
  );

  // ── 2. PLAY dashboard ────────────────────────────────────────────
  await safeGoto(page, "/game/dashboard", 1000);
  await showStep(
    page,
    "2",
    "CHECK THE DAY LOOP",
    "看目前階段與倒數：COMMIT = 選擇地點；之後自動進入戰鬥結算。",
    3400,
  );

  // Try click main CTA if present
  try {
    const cta = page.locator("a,button").filter({ hasText: /CHOOSE LOCATION|選擇地點|BATTLE RESULT|戰鬥結果/i }).first();
    if (await cta.count()) {
      await cta.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(900);
    }
  } catch {
    /* continue */
  }

  // ── 3. Explore / Deploy ──────────────────────────────────────────
  await safeGoto(page, "/game/explore", 1200);
  await showStep(
    page,
    "3",
    "SELECT YOUR NFT",
    "先點選要出戰的 NFT，確認是哪一隻在提交。",
    3000,
  );

  try {
    const selectBtn = page
      .locator("button")
      .filter({ hasText: /SELECT|選擇|SELECTED|已選/i })
      .first();
    if (await selectBtn.count()) {
      await selectBtn.click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
  } catch {
    /* continue */
  }

  await showStep(
    page,
    "4",
    "COMMIT HERE",
    "在地圖地點卡按綠色 COMMIT HERE／在此提交 — 會立刻送出，無需再按 Continue。",
    3600,
  );

  // Soft highlight location cards
  await page.evaluate(() => {
    document.querySelectorAll("button").forEach((b) => {
      if (/COMMIT HERE|在此提交|COMMITTING/i.test(b.textContent || "")) {
        b.style.outline = "3px solid #f0c44a";
        b.style.outlineOffset = "2px";
      }
    });
  });
  await page.waitForTimeout(2200);

  // ── 4. Claim page (brief — rewards are separate from Play) ───────
  await safeGoto(page, "/game/claim", 900);
  await showStep(
    page,
    "5",
    "CLAIM ANYTIME",
    "獎勵不在 Play 流程裡限時領取。累積的 HANSOME 隨時到 CLAIM 頁提領。",
    3000,
  );

  // ── 5. Battle Result — real settlement UI ─────────────────────────
  await safeGoto(page, "/game/result", 1200);
  await showStep(
    page,
    "6",
    "BATTLE RESULT",
    "Commit 結束後進入戰鬥結果：自動揭露、結算、顯示每隻 NFT 的結果與獎勵。",
    3200,
  );

  // Scroll to auto-reveal / battle results if present
  await page.evaluate(() => {
    const ids = ["auto-reveal-section", "battle-results-section", "commit-section"];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      }
    }
  });
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    const battle = document.getElementById("battle-results-section");
    if (battle) battle.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  await page.waitForTimeout(2500);

  await showStep(
    page,
    "7",
    "SETTLEMENT SCREEN",
    "這裡就是結算畫面：位置、勝敗／狩獵結果、技能、可領獎勵。可隨時回來觀看。",
    4000,
  );

  // Hold briefly on live Battle Result, then always show settlement VFX finale.
  await page.waitForTimeout(3500);
  await hideStep(page);
  await safeGoto(page, "/dev/settlement-preview", 1000);
  await showStep(
    page,
    "7",
    "SETTLEMENT REVEAL",
    "結算畫面：獎勵彈出、技能演出（與正式 Battle Result 同一套 UI）。",
    2800,
  );

  try {
    const combo = page.getByTestId("dev-preview-combined");
    if (await combo.count()) {
      await combo.click({ timeout: 5000 });
    }
  } catch {
    /* hold anyway */
  }
  await page.waitForTimeout(12000);

  await showStep(
    page,
    "✓",
    "YOU ARE READY",
    "每日：選 NFT → COMMIT HERE → 看 Battle Result → 需要時到 CLAIM 領獎。",
    3500,
  );
  await hideStep(page);
  await page.waitForTimeout(800);

  const video = page.video();
  await context.close();
  await browser.close();

  const rawVideo = video ? await video.path() : null;
  if (!rawVideo || !fs.existsSync(rawVideo)) {
    throw new Error("Playwright did not produce a video file");
  }

  const webm = path.join(outDir, "how-to-play-raw.webm");
  const mp4 = path.join(outDir, "hansome-how-to-play.mp4");
  fs.copyFileSync(rawVideo, webm);

  runFfmpeg(
    [
      "-i",
      webm,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-an",
      mp4,
    ],
    "encode mp4",
  );

  console.log("Wrote", path.relative(root, mp4));
  console.log("Raw", path.relative(root, webm));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
