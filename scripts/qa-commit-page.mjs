/**
 * QA screenshots for Commit page (desktop + mobile).
 * Seeds a sealed commit for NFT #7 → River so location display is visible.
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.resolve("reports/commit-page");
fs.mkdirSync(OUT, { recursive: true });

async function seedAndOpen(context, page, url) {
  await context.addInitScript(() => {
    sessionStorage.setItem("hansome-pending-location-v1", "4");
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("h1.pixel-title", { timeout: 60000 });
  await page.waitForSelector(".commit-nft-row__title", { timeout: 60000 });
  await page.waitForFunction(
    () => {
      const text = document.body.innerText || "";
      return /DAY\s+[1-9]\d*/i.test(text) || /DEMO/i.test(text);
    },
    { timeout: 60000 },
  );
  // Seed sealed location for the active day + first listed NFT.
  await page.evaluate(() => {
    const eyebrow = Array.from(document.querySelectorAll("*")).find((el) =>
      /^DAY\s+\d+$/i.test((el.textContent || "").trim()),
    );
    const day = Number(((eyebrow?.textContent || "DAY 1").match(/\d+/) || ["1"])[0]);
    const firstToken =
      Number(
        (
          document.querySelector(".commit-nft-row__title")?.textContent || "#1"
        ).match(/#(\d+)/)?.[1] || "1",
      ) || 1;
    localStorage.setItem(
      "hansome-commit-secrets-v1",
      JSON.stringify([
        {
          tokenId: firstToken,
          day,
          locationId: 4,
          salt: "0x1111111111111111111111111111111111111111111111111111111111111111",
          commitHash:
            "0x2222222222222222222222222222222222222222222222222222222222222222",
          status: "submitted",
          updatedAt: Date.now(),
        },
      ]),
    );
  });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector(".commit-nft-row--done", { timeout: 60000 });
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // Desktop
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    await seedAndOpen(context, page, `${BASE}/game/commit`);
    const blurb = await page.locator("h1 + p").first().innerText();
    const hasRiver = (await page.locator("text=River").count()) > 0;
    const hasSubmitted = (await page.locator("text=Submitted").count()) > 0;
    const hasHash = (await page.locator("text=/hash|salt|on-chain/i").count()) > 0;
    await page.screenshot({
      path: path.join(OUT, "commit-desktop.png"),
      fullPage: true,
    });
    console.log("desktop", { blurb, hasRiver, hasSubmitted, hasHash });
    await context.close();
  }

  // Mobile (iPhone SE)
  {
    const iphone = devices["iPhone SE"];
    const context = await browser.newContext({ ...iphone });
    const page = await context.newPage();
    await seedAndOpen(context, page, `${BASE}/game/commit`);
    await page.screenshot({
      path: path.join(OUT, "commit-mobile.png"),
      fullPage: true,
    });
    console.log("mobile ok", path.join(OUT, "commit-mobile.png"));
    await context.close();
  }

  // Audio defaults check (fresh profile)
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/game`, { waitUntil: "networkidle", timeout: 120000 });
    const prefs = await page.evaluate(() => {
      const raw = localStorage.getItem("hansome-game-audio");
      return raw ? JSON.parse(raw) : null;
    });
    const toggles = await page.evaluate(() => {
      const music = document.querySelector('button[aria-pressed][title*="Music"], button[title*="Alpaca Warpath"]');
      const sfx = document.querySelector('button[aria-label*="SFX"], button[title*="SFX"]');
      return {
        musicPressed: music?.getAttribute("aria-pressed"),
        sfxPressed: sfx?.getAttribute("aria-pressed"),
        musicTitle: music?.getAttribute("title") || "",
      };
    });
    const audioDebug = await page.evaluate(() => window.__HANSOME_AUDIO__ || null);
    console.log("audio-fresh", { prefs, toggles, audioDebug });
    await context.close();
  }

  await browser.close();
  console.log("Wrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
