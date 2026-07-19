/**
 * Capture desktop + mobile screenshots of King crown ability FX.
 * Usage: node scripts/qa-king-ability-fx-screenshots.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const outDir = path.join("reports", "ui", "king-ability-fx");

async function capture(viewport, name, opts = {}) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport, ...opts });
  await page.goto(`${base}/game/dev/ability-fx-preview?ability=king`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.getByTestId("ability-fx-preview-badge").waitFor();
  await page.getByTestId("ability-fx-label").filter({ hasText: "King" }).waitFor({
    timeout: 15_000,
  });
  // Mid-animation: crown drop + sparkles visible.
  await page.waitForTimeout(450);
  const file = path.join(outDir, name);
  await page.locator("[data-testid=ability-fx-stage]").screenshot({ path: file });
  console.log("wrote", file);
  await browser.close();
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await capture({ width: 1280, height: 900 }, "king-fx-desktop.png");
  await capture(
    { width: 390, height: 844 },
    "king-fx-mobile.png",
    { isMobile: true, hasTouch: true },
  );
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
