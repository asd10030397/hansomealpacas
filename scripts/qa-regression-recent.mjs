/**
 * Regression smoke for recently upgraded game surfaces.
 *
 *   BASE_URL=http://localhost:3001 node scripts/qa-regression-recent.mjs
 *   BASE_URL=https://game.hansomealpacas.xyz node scripts/qa-regression-recent.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const gameHost = BASE.includes("game.");
const p = (pretty, internal) => (gameHost ? `${BASE}${pretty}` : `${BASE}${internal}`);

const OUT = path.resolve("reports/regression-recent");
fs.mkdirSync(OUT, { recursive: true });

const routes = [
  { name: "home", url: p("/", "/game"), expect: [/HANSOME/i], forbid: [/\bLOOT\b/, /MOCK_NFTS/i] },
  { name: "dashboard", url: p("/dashboard", "/game/dashboard"), expect: [/DAILY GAME|PLAY|COMMIT|REVEAL|SETTLE/i], forbid: [/MOCK_NFTS/i] },
  { name: "mint", url: p("/mint", "/game/mint"), expect: [/MINT|GENESIS|DEPLOY|TESTNET/i], forbid: [/NOT YET/i, /LIVE TESTNET/i, /testing only/i] },
  { name: "my-nfts", url: p("/my-nfts", "/game/my-nfts"), expect: [/MY NFT|NFT/i], forbid: [/MOCK_NFTS/i, /mock claimable/i] },
  { name: "rewards", url: p("/rewards", "/game/rewards"), expect: [/REWARD|CLAIM|HANSOME/i], forbid: [/MOCK_NFTS/i] },
  { name: "leaderboard", url: p("/leaderboard", "/game/leaderboard"), expect: [/LEADERBOARD|SEASON|RANK/i], forbid: [/\bLOOT\b/] },
  { name: "docs", url: p("/docs", "/game/docs"), expect: [/PLAYER DOCS|玩家文件|Player Guide|玩家指南/i], forbid: [] },
  { name: "guide", url: p("/docs/guide", "/game/docs/guide"), expect: [/HANSOME Alpacas/, /Player Guide/], forbid: [] },
  {
    name: "litepaper",
    url: `${BASE.replace("game.", "www.")}/litepaper`.replace("localhost:3001", "localhost:3001"),
    expect: [/Gameplay|Litepaper|HANSOME|Sustainable/i],
    forbid: [/BUILD STATUS/i, /LIVE TESTNET/i],
  },
];

// For local, litepaper is on same host
if (!BASE.includes("hansomealpacas.xyz")) {
  routes.find((r) => r.name === "litepaper").url = `${BASE}/litepaper`;
} else if (gameHost) {
  routes.find((r) => r.name === "litepaper").url = "https://www.hansomealpacas.xyz/litepaper";
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const results = [];

for (const r of routes) {
  try {
    await page.goto(r.url, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(800);
    const body = await page.locator("body").innerText();
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    );
    const nav = await page.evaluate(() => {
      const links = [...document.querySelectorAll(".game-nav__links a")].map((a) => ({
        text: (a.textContent || "").trim().replace(/\s+/g, " "),
        href: a.getAttribute("href"),
      }));
      return {
        links,
        hasLoot: links.some((l) => /LOOT/i.test(l.text)),
        homeHref: links.find((l) => /^HOME$/i.test(l.text))?.href,
      };
    });
    const expectOk = r.expect.every((re) => re.test(body));
    const forbidOk = r.forbid.every((re) => !re.test(body));
    const shot = path.join(OUT, `${r.name}-390.png`);
    await page.screenshot({ path: shot, fullPage: false });
    const pass = expectOk && forbidOk && !overflowX;
    results.push({
      name: r.name,
      url: r.url,
      pass,
      expectOk,
      forbidOk,
      overflowX,
      hasLoot: nav.hasLoot,
      homeHref: nav.homeHref,
      shot,
    });
    console.log(
      `${pass ? "PASS" : "FAIL"} ${r.name} overflow=${overflowX} loot=${nav.hasLoot} home=${nav.homeHref || "-"}`,
    );
  } catch (e) {
    results.push({ name: r.name, url: r.url, pass: false, error: String(e) });
    console.log("FAIL", r.name, e.message);
  }
}

// Desktop nav HOME check on guide
await page.setViewportSize({ width: 1280, height: 720 });
await page.goto(p("/docs/guide", "/game/docs/guide"), { waitUntil: "networkidle", timeout: 90000 });
await page.screenshot({ path: path.join(OUT, "guide-desktop-1280.png"), fullPage: false });

await browser.close();
const summaryPath = path.join(OUT, "summary.json");
fs.writeFileSync(summaryPath, JSON.stringify({ base: BASE, results }, null, 2));
const failed = results.filter((x) => !x.pass);
console.log(failed.length ? `REGRESSION_FAIL ${failed.length}` : "REGRESSION_PASS");
process.exit(failed.length ? 1 : 0);
