/**
 * Capture desktop + mobile screenshots of missed-reveal / waiting-seed UI.
 * Usage: node scripts/qa-settlement-edge-screenshots.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const outDir = path.join("reports", "ui", "settlement-edge");

async function shot(page, name) {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file, fullPage: true });
  console.log("wrote", file);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  // Desktop
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${base}/dev/settlement-edge-preview`, {
      waitUntil: "networkidle",
      timeout: 90_000,
    });
    await page.waitForSelector("[data-testid=settlement-edge-preview]");
    await page.click("[data-testid=locale-en]");
    await page.waitForTimeout(300);
    await shot(page, "missed-reveal-waiting-seed-desktop-en.png");
    await page.click("[data-testid=locale-zh]");
    await page.waitForTimeout(300);
    await shot(page, "missed-reveal-waiting-seed-desktop-zh.png");
    await page.close();
  }

  // Mobile
  {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await page.goto(`${base}/dev/settlement-edge-preview`, {
      waitUntil: "networkidle",
      timeout: 90_000,
    });
    await page.waitForSelector("[data-testid=settlement-edge-preview]");
    await page.click("[data-testid=locale-en]");
    await page.waitForTimeout(300);
    await shot(page, "missed-reveal-waiting-seed-mobile-en.png");
    await page.click("[data-testid=locale-zh]");
    await page.waitForTimeout(300);
    await shot(page, "missed-reveal-waiting-seed-mobile-zh.png");
    await page.close();
  }

  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
