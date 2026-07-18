import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "screenshots", "game");
mkdirSync(outDir, { recursive: true });

const base = process.env.GAME_URL || "http://localhost:3000/game";

const browser = await chromium.launch({ headless: true });

async function shot(name, width, height) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  await page.goto(base, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".hansome-game", { timeout: 15000 });
  await page.waitForTimeout(800);
  const path = join(outDir, name);
  await page.screenshot({ path, fullPage: false });
  console.log("wrote", path);
  await page.close();
}

await shot("game-desktop.png", 1536, 864);
await shot("game-mobile.png", 390, 844);

await browser.close();
console.log("done");
