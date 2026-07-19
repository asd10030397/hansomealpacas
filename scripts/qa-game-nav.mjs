import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${base}/game/dashboard`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(800);

const desktop = await page.evaluate(() => {
  const nav = document.querySelector(".game-nav__links");
  const links = [...(nav?.querySelectorAll("a,button") ?? [])].map((el) => ({
    text: (el.textContent || "").trim().replace(/\s+/g, " "),
    href: el.getAttribute("href"),
  }));
  const brand = document.querySelector(".game-nav__brand")?.getAttribute("href");
  return { brand, links };
});

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
const mobile = await page.evaluate(() => {
  const dock = document.querySelector('nav[aria-label]') || document.querySelector(".fixed.bottom-0");
  const items = [...document.querySelectorAll(".fixed.bottom-0 a, .fixed.bottom-0 button")].map(
    (el) => ({
      text: (el.textContent || "").trim(),
      href: el.getAttribute("href"),
    }),
  );
  return { items, dockLabel: dock?.getAttribute("aria-label") };
});

// Click HOME and confirm we leave game shell for marketing
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${base}/game/dashboard`, { waitUntil: "domcontentloaded" });
await page.click('.game-nav__links a:has-text("HOME"), .game-nav__links a:has-text("主頁"), .game-nav a:text-is("HOME")');
await page.waitForTimeout(1000);
const afterHome = page.url();

console.log(JSON.stringify({ desktop, mobile, afterHome }, null, 2));

const homeLink = desktop.links.find((l) => /HOME|主頁|首页/i.test(l.text));
const playLink = desktop.links.find((l) => /PLAY|遊玩|游玩/i.test(l.text));
const ok =
  (homeLink?.href === "/" || homeLink?.href?.endsWith("hansomealpacas.xyz/")) &&
  (playLink?.href?.includes("dashboard") || playLink?.href === "/game") &&
  (afterHome.endsWith("/") || afterHome.match(/hansomealpacas\.xyz\/?$/));

console.log(ok ? "NAV_QA_PASS" : "NAV_QA_FAIL");
await browser.close();
process.exit(ok ? 0 : 1);
