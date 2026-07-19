/**
 * Visual QA for responsive Player Guide (local or production).
 *
 *   BASE_URL=http://localhost:3000 node scripts/qa-player-guide-mobile.mjs
 *   BASE_URL=https://game.hansomealpacas.xyz node scripts/qa-player-guide-mobile.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const isGameHost = BASE.includes("game.");
const GUIDE = isGameHost ? `${BASE}/docs/guide` : `${BASE}/game/docs/guide`;
const OUT = path.resolve("reports/player-guide-mobile");
fs.mkdirSync(OUT, { recursive: true });

const viewports = [
  { name: "iphone-se", width: 320, height: 568 },
  { name: "iphone-8", width: 375, height: 667 },
  { name: "iphone-12", width: 390, height: 844 },
  { name: "iphone-14", width: 393, height: 852 },
  { name: "iphone-14-pro-max", width: 430, height: 932 },
  { name: "android-360", width: 360, height: 800 },
  { name: "android-412", width: 412, height: 915 },
  { name: "ipad", width: 768, height: 1024 },
  { name: "ipad-air", width: 820, height: 1180 },
  { name: "desktop-1280", width: 1280, height: 720 },
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1920", width: 1920, height: 1080 },
];

const browser = await chromium.launch({ headless: true });
const results = [];

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: vp.width < 768,
    hasTouch: vp.width < 768,
  });
  const page = await context.newPage();
  await page.goto(GUIDE, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(600);

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const h1 = document.querySelector(".pg-cover h1");
    const cover = document.querySelector(".pg-cover");
    const h1Rect = h1?.getBoundingClientRect();
    const coverRect = cover?.getBoundingClientRect();
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflowX: doc.scrollWidth > doc.clientWidth + 1,
      h1Text: h1?.textContent?.trim() || "",
      h1FullyVisible:
        !!h1Rect &&
        h1Rect.left >= -1 &&
        h1Rect.right <= window.innerWidth + 1 &&
        h1Rect.width > 0,
      coverWidthOk: !!coverRect && coverRect.width <= window.innerWidth + 2,
      hasCreamOverlay: false,
    };
  });

  // Detect large light blocks overlapping the title (heuristic)
  metrics.hasCreamOverlay = await page.evaluate(() => {
    const h1 = document.querySelector(".pg-cover h1");
    if (!h1) return true;
    const r = h1.getBoundingClientRect();
    const cx = r.left + r.width * 0.4;
    const cy = r.top + r.height * 0.5;
    const el = document.elementFromPoint(cx, cy);
    if (!el) return false;
    const bg = getComputedStyle(el).backgroundColor;
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return false;
    const [, rr, gg, bb] = m.map(Number);
    const lum = (0.2126 * rr + 0.7152 * gg + 0.0722 * bb) / 255;
    return lum > 0.75 && el !== h1 && !h1.contains(el);
  });

  const shot = path.join(OUT, `guide-cover-${vp.name}.png`);
  await page.screenshot({ path: shot, fullPage: false });

  // Content page (locations) — scroll or flip
  try {
    if (vp.width < 768) {
      const loc = page.locator('[data-page-index="2"]');
      await loc.waitFor({ state: "attached", timeout: 10000 });
      await loc.evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(300);
    } else {
      await page.getByRole("button", { name: "Next section" }).click();
      await page.waitForTimeout(200);
      await page.getByRole("button", { name: "Next section" }).click();
      await page.waitForTimeout(200);
    }
  } catch (e) {
    console.log(`WARN content-nav ${vp.name}: ${e.message}`);
  }
  const shot2 = path.join(OUT, `guide-content-${vp.name}.png`);
  await page.screenshot({ path: shot2, fullPage: false });

  const pass =
    !metrics.overflowX &&
    metrics.h1FullyVisible &&
    metrics.coverWidthOk &&
    !metrics.hasCreamOverlay &&
    metrics.h1Text.includes("HANSOME");

  results.push({ vp: vp.name, ...metrics, pass, shot, shot2 });
  console.log(
    `${pass ? "PASS" : "FAIL"} ${vp.name} overflowX=${metrics.overflowX} h1vis=${metrics.h1FullyVisible} cream=${metrics.hasCreamOverlay}`,
  );
  await context.close();
}

await browser.close();
const summary = path.join(OUT, "summary.json");
fs.writeFileSync(summary, JSON.stringify({ base: BASE, guide: GUIDE, results }, null, 2));
const failed = results.filter((r) => !r.pass);
console.log(failed.length ? `PLAYER_GUIDE_QA_FAIL ${failed.length}` : "PLAYER_GUIDE_QA_PASS");
console.log("Wrote", summary);
process.exit(failed.length ? 1 : 0);
