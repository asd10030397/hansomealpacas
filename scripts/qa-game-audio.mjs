/**
 * Route-aware BGM audit (Playwright).
 *
 *   BASE_URL=https://game.hansomealpacas.xyz node scripts/qa-game-audio.mjs
 *   BASE_URL=http://localhost:3000 node scripts/qa-game-audio.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL || "https://game.hansomealpacas.xyz").replace(/\/$/, "");
const gameHost = BASE.includes("game.");
const path = (pretty, internal) => (gameHost ? `${BASE}${pretty}` : `${BASE}${internal}`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

async function audioSnapshot() {
  return page.evaluate(() => {
    const dbg = window.__HANSOME_AUDIO__ || {};
    const ambient = dbg.ambient || {};
    const game = dbg.game || {};
    const musicBtn = [...document.querySelectorAll("button")].find(
      (b) =>
        (b.textContent || "").includes("♪") ||
        (b.getAttribute("title") || "").toLowerCase().includes("warpath") ||
        (b.getAttribute("title") || "").toLowerCase().includes("music"),
    );
    const sfxBtn = [...document.querySelectorAll("button")].find(
      (b) =>
        (b.textContent || "").includes("◫") ||
        (b.getAttribute("aria-label") || "").toLowerCase().includes("sound"),
    );
    let prefs = null;
    try {
      prefs = JSON.parse(localStorage.getItem("hansome-game-audio") || "null");
    } catch {
      prefs = null;
    }
    const ambientLeak =
      ambient.suppressed !== true &&
      ambient.paused === false &&
      (ambient.volume || 0) > 0.01;
    return {
      host: location.hostname,
      path: location.pathname,
      musicPressed: musicBtn?.getAttribute("aria-pressed"),
      sfxPressed: sfxBtn?.getAttribute("aria-pressed"),
      prefs,
      ambient,
      game,
      ambientLeak,
      warpathDesired: game.desired === true,
    };
  });
}

const results = [];

async function step(name, url, interact = false) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1000);
  if (interact) {
    await page.mouse.click(80, 240);
    await page.waitForTimeout(800);
  }
  const snap = await audioSnapshot();
  const pass = !snap.ambientLeak && snap.ambient?.suppressed === true;
  results.push({ name, pass, ...snap });
  console.log(
    `${pass ? "PASS" : "FAIL"} ${name} path=${snap.path} music=${snap.musicPressed} sfx=${snap.sfxPressed} suppressed=${snap.ambient?.suppressed} ambientLeak=${snap.ambientLeak} warpathDesired=${snap.warpathDesired}`,
  );
}

await page.goto(path("/", "/game"), { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  localStorage.removeItem("hansome-game-audio");
  localStorage.removeItem("hansome-game-audio-defaults-v2");
});

await step("game-home", path("/", "/game"), true);
await step("dashboard", path("/dashboard", "/game/dashboard"), false);
await step("my-nfts", path("/my-nfts", "/game/my-nfts"), false);
await step("claim", path("/claim", "/game/claim"), false);
await step("docs", path("/docs", "/game/docs"), false);
await step("guide", path("/docs/guide", "/game/docs/guide"), false);

const defaults = results[0];
const defaultsOk =
  defaults?.musicPressed === "true" && defaults?.sfxPressed === "true";
const noAmbient = results.every((r) => r.pass);
const pass = defaultsOk && noAmbient;

console.log(pass ? "GAME_AUDIO_PASS" : "GAME_AUDIO_FAIL", {
  defaultsOk,
  noAmbient,
  music: defaults?.musicPressed,
  sfx: defaults?.sfxPressed,
});

await browser.close();
process.exit(pass ? 0 : 1);
