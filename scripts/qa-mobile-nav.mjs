/**
 * Mobile header / dock / menu QA + screenshots.
 *
 *   BASE_URL=http://localhost:3000 node scripts/qa-mobile-nav.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const gameHost = BASE.includes("game.");
const p = (pretty, internal) => (gameHost ? `${BASE}${pretty}` : `${BASE}${internal}`);
const OUT = path.resolve("reports/mobile-nav");
fs.mkdirSync(OUT, { recursive: true });

const widths = [320, 360, 375, 390, 393, 412, 430];
const browser = await chromium.launch({ headless: true });
const results = [];

for (const width of widths) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.goto(p("/", "/game"), { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(800);

  const closed = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth > window.innerWidth + 2;
    const langInHeader = !!document.querySelector(".game-nav__mobile .game-lang");
    const walletText = document.querySelector(".game-nav__mobile-row--actions")?.innerText || "";
    return {
      overflow,
      langInHeader,
      hasInjectedStack: /INJECTED/i.test(walletText),
      hasMenu: !!document.querySelector(".game-nav__menu-btn"),
      hasTwoRows: !!document.querySelector(".game-nav__mobile-row--actions"),
    };
  });
  await page.screenshot({ path: path.join(OUT, `header-closed-${width}.png`) });

  await page.locator(".game-nav__menu-btn").click({ force: true });
  await page.waitForTimeout(350);
  const menu = await page.evaluate(() => {
    const ids = [...document.querySelectorAll(".game-nav__mobile-link")].map(
      (a) => a.getAttribute("data-nav-id"),
    );
    return {
      ids,
      hasLeaderboard: ids.includes("leaderboard"),
      hasDocs: ids.includes("docs"),
      hasMint: ids.includes("mint"),
      count: ids.length,
    };
  });
  await page.screenshot({ path: path.join(OUT, `menu-open-${width}.png`) });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  await page.goto(p("/dashboard", "/game/dashboard"), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const dock = await page.evaluate(() => {
    const items = [...document.querySelectorAll(".mobile-dock__item")].map((el) =>
      (el.textContent || "").trim().replace(/\s+/g, " "),
    );
    const el = document.querySelector(".mobile-dock");
    const style = el ? getComputedStyle(el) : null;
    return { items, visible: !!el && style?.display !== "none" };
  });
  await page.screenshot({ path: path.join(OUT, `dock-${width}.png`) });

  await page.locator(".mobile-dock__item").filter({ hasText: /MORE|更多/ }).click();
  await page.waitForSelector(".mobile-dock__sheet-link[data-nav-id='leaderboard']", {
    timeout: 10000,
  });
  const more = await page.evaluate(() => {
    const ids = [...document.querySelectorAll(".mobile-dock__sheet-link")].map((a) =>
      a.getAttribute("data-nav-id"),
    );
    return {
      ids,
      hasLeaderboard: ids.includes("leaderboard"),
      hasDocs: ids.includes("docs"),
      hasRewards: ids.includes("rewards"),
    };
  });
  await page.screenshot({ path: path.join(OUT, `dock-more-${width}.png`) });

  await page.locator(".mobile-dock__sheet-link[data-nav-id='leaderboard']").click({ force: true });
  await page.waitForURL(/leaderboard/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  const lbPath = new URL(page.url()).pathname;
  await page.screenshot({ path: path.join(OUT, `leaderboard-${width}.png`) });

  await page.goto(p("/docs", "/game/docs"), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const docsPath = new URL(page.url()).pathname;
  await page.screenshot({ path: path.join(OUT, `docs-${width}.png`) });

  const pass =
    !closed.overflow &&
    !closed.langInHeader &&
    !closed.hasInjectedStack &&
    closed.hasMenu &&
    closed.hasTwoRows &&
    menu.hasLeaderboard &&
    menu.hasDocs &&
    menu.hasMint &&
    menu.count === 7 &&
    dock.visible &&
    dock.items.length === 5 &&
    more.hasLeaderboard &&
    more.hasDocs &&
    more.hasRewards &&
    /leaderboard/i.test(lbPath) &&
    /docs/i.test(docsPath);

  results.push({ width, pass, closed, menu, dock, more, lbPath, docsPath });
  console.log(
    `${pass ? "PASS" : "FAIL"} ${width}`,
    JSON.stringify({
      overflow: closed.overflow,
      injected: closed.hasInjectedStack,
      menuCount: menu.count,
      dock: dock.items,
      lbPath,
      docsPath,
    }),
  );
  await context.close();
}

fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify({ base: BASE, results }, null, 2));
const failed = results.filter((r) => !r.pass);
console.log(failed.length ? `MOBILE_NAV_FAIL ${failed.length}` : "MOBILE_NAV_PASS");
await browser.close();
process.exit(failed.length ? 1 : 0);
