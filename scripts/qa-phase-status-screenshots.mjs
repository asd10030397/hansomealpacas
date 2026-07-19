/**
 * Capture Desktop + Mobile phase-status UI screenshots.
 * Usage: node scripts/qa-phase-status-screenshots.mjs [baseUrl]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const base = process.argv[2] || process.env.QA_BASE_URL || "http://localhost:3002";
const outDir = join(process.cwd(), "reports", "ui", "phase-status");
mkdirSync(outDir, { recursive: true });

async function shot(page, name) {
  const path = join(outDir, name);
  await page.screenshot({ path, fullPage: false });
  console.log("wrote", path);
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // Desktop
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(`${base}/game/dashboard`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForSelector(".phase-status, .phase-tl", { timeout: 30_000 });
    await shot(page, "desktop-dashboard-1280.png");
    await page.goto(`${base}/game/commit`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForSelector(".phase-status", { timeout: 30_000 });
    await shot(page, "desktop-commit-1280.png");
    await context.close();
  }

  // Mobile
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto(`${base}/game/dashboard`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForSelector(".phase-status--mobile, .phase-status-panel--mobile", {
      timeout: 30_000,
    });
    await shot(page, "mobile-dashboard-390.png");
    await page.goto(`${base}/game/commit`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForSelector(".phase-status--mobile", { timeout: 30_000 });
    await shot(page, "mobile-commit-390.png");
    await context.close();
  }

  // Small mobile
  {
    const context = await browser.newContext({
      viewport: { width: 360, height: 740 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto(`${base}/game/dashboard`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForSelector(".phase-status--mobile", { timeout: 30_000 });
    await shot(page, "mobile-dashboard-360.png");
    await context.close();
  }

  await browser.close();
  console.log("ok");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
