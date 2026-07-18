import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const base = process.env.DASHBOARD_URL ?? "http://localhost:3000/game/dashboard";
const outDir = path.resolve("reports/ux");

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(base, { waitUntil: "networkidle" });

const phases = ["COMMIT", "REVEAL", "SETTLEMENT", "CLAIM"];
for (const phase of phases) {
  await page.getByRole("button", { name: phase, exact: true }).click();
  await page.waitForTimeout(400);
  const file = path.join(outDir, `dashboard-${phase.toLowerCase()}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("wrote", file);
}

await browser.close();
