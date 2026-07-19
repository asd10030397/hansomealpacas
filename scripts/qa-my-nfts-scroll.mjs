/**
 * Verify My NFTs navigation does not leave a wild scroll offset.
 */
import { chromium, devices } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const iphone = devices["iPhone SE"];
  const context = await browser.newContext({ ...iphone });
  const page = await context.newPage();

  await page.goto(`${BASE}/game/dashboard`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 420));
  const before = await page.evaluate(() => window.scrollY);

  await page.click('a.mobile-dock__item:has-text("NFTS"), a.mobile-dock__item:has-text("NFTs")');
  await page.waitForURL(/my-nfts/, { timeout: 30000 });
  await page.waitForSelector("h1", { timeout: 30000 });
  await page.waitForTimeout(500);

  const after = await page.evaluate(() => ({
    y: window.scrollY,
    href: location.pathname,
    hasWalletPanel: !!document.querySelector(".my-nfts-wallet-panel, h1"),
    bodyTop: document.body.style.top,
    bodyPosition: document.body.style.position,
    modalOpen: !!document.querySelector('[role="dialog"][aria-modal="true"]'),
  }));

  const ok =
    after.href.includes("my-nfts") &&
    after.y <= 8 &&
    !after.modalOpen &&
    after.bodyPosition !== "fixed";

  console.log(JSON.stringify({ before, after, ok }, null, 2));
  await browser.close();
  if (!ok) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
