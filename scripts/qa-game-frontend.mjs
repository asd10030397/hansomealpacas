/**
 * Lightweight frontend QA for /game dashboard + my-nfts (responsive + load timing).
 * Usage: node scripts/qa-game-frontend.mjs  [baseUrl]
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const base = process.argv[2] || "http://127.0.0.1:3000";
const outDir = path.resolve("reports/genesis");
fs.mkdirSync(outDir, { recursive: true });

async function measure(page, url) {
  const t0 = Date.now();
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(800);
  return { status: res?.status() ?? 0, ms: Date.now() - t0 };
}

async function overflow(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    return {
      overflow: root.scrollWidth > root.clientWidth + 1,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
    };
  });
}

const browser = await chromium.launch({ headless: true });
const results = { base, at: new Date().toISOString(), viewports: {} };

for (const vp of [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  const page = await browser.newPage({ viewport: vp });
  const dash = await measure(page, `${base}/game/dashboard`);
  const dashOverflow = await overflow(page);
  await page.screenshot({
    path: path.join(outDir, `qa-dashboard-${vp.name}.png`),
    fullPage: false,
  });

  const liveChip = await page.locator("text=Live chain").count();
  const mockChip = await page.locator(".mock-chip").count();
  const countdown = await page.locator("text=/COUNTDOWN|Countdown|ENDS/i").count();

  const nfts = await measure(page, `${base}/game/my-nfts`);
  const nftsOverflow = await overflow(page);
  await page.screenshot({
    path: path.join(outDir, `qa-my-nfts-${vp.name}.png`),
    fullPage: false,
  });

  results.viewports[vp.name] = {
    dashboard: { ...dash, ...dashOverflow, liveChip, mockChip, countdown },
    myNfts: { ...nfts, ...nftsOverflow },
  };
  await page.close();
}

await browser.close();
const out = path.join(outDir, "frontend-qa.json");
fs.writeFileSync(out, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
console.log("Wrote", out);
