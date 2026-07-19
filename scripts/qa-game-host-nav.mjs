import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("https://game.hansomealpacas.xyz/game/dashboard", {
  waitUntil: "networkidle",
  timeout: 90000,
});
await page.waitForTimeout(1000);

const links = await page.evaluate(() => {
  const nav = document.querySelector(".game-nav__links");
  return {
    host: location.host,
    path: location.pathname,
    brand: document.querySelector(".game-nav__brand")?.getAttribute("href"),
    items: [...(nav?.querySelectorAll("a") ?? [])].map((a) => ({
      text: (a.textContent || "").trim().replace(/\s+/g, " "),
      href: a.getAttribute("href"),
    })),
  };
});
console.log(JSON.stringify(links, null, 2));

await page.locator('.game-nav__links a', { hasText: /^HOME$/ }).click();
await page.waitForTimeout(1500);

const after = {
  url: page.url(),
  hasDaily: await page.locator("text=DAILY GAME").count(),
  pathname: new URL(page.url()).pathname,
};
console.log("after HOME", after);

const homeHref = links.items.find((i) => i.text === "HOME")?.href;
const playHref = links.items.find((i) => i.text === "PLAY")?.href;
const homeOk = homeHref === "/";
const playOk = playHref === "/dashboard";
const landedOnTitle = after.pathname === "/" || after.pathname === "/game";
const notDaily = after.hasDaily === 0;

const pass = homeOk && playOk && landedOnTitle && notDaily;
console.log(pass ? "GAME_HOST_NAV_PASS" : "GAME_HOST_NAV_FAIL", {
  homeOk,
  playOk,
  landedOnTitle,
  notDaily,
});

await browser.close();
process.exit(pass ? 0 : 1);
