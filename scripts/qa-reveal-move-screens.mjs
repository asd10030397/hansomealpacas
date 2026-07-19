/**
 * Capture desktop + mobile screenshots for Reveal Move rename QA.
 */
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.env.BASE_URL || "http://localhost:3003").replace(/\/$/, "");
const OUT = join(process.cwd(), "reports", "reveal-move");

mkdirSync(OUT, { recursive: true });

async function shot(context, name, path) {
  const page = await context.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, name), fullPage: true });
  await page.close();
  console.log("wrote", name);
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  const desktop = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "en-US",
  });
  await shot(desktop, "desktop-dashboard.png", "/game/dashboard");
  await shot(desktop, "desktop-reveal.png", "/game/reveal");
  await shot(desktop, "desktop-docs.png", "/game/docs");
  await shot(desktop, "desktop-guide.png", "/game/docs/guide");
  await desktop.close();

  const mobile = await browser.newContext({
    ...devices["iPhone 14"],
    locale: "en-US",
  });
  await shot(mobile, "mobile-dashboard.png", "/game/dashboard");
  await shot(mobile, "mobile-reveal.png", "/game/reveal");
  await shot(mobile, "mobile-docs.png", "/game/docs");
  await shot(mobile, "mobile-guide.png", "/game/docs/guide");
  await mobile.close();

  await browser.close();
  console.log("done", OUT);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
