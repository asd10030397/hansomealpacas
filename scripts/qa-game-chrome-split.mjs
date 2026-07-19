import { chromium, devices } from "playwright";

const BASE = (process.env.BASE_URL || "http://localhost:3005").replace(/\/$/, "");

async function probe(context, label) {
  const page = await context.newPage();
  await page.goto(`${BASE}/game/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(600);
  const state = await page.evaluate(() => ({
    desktop: Boolean(document.querySelector('[data-game-chrome="desktop"]')),
    mobile: Boolean(document.querySelector('[data-game-chrome="mobile"]')),
    header: Boolean(document.querySelector('[data-game-chrome="mobile-header"]')),
    dock: Boolean(document.querySelector(".mobile-dock")),
  }));
  await page.close();
  console.log(label, state);
  return state;
}

const browser = await chromium.launch({ headless: true });
try {
  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const d = await probe(desk, "desktop");
  await desk.close();

  const mob = await browser.newContext({ ...devices["iPhone 14"] });
  const m = await probe(mob, "mobile");
  await mob.close();

  if (!d.desktop || d.mobile || d.dock) {
    throw new Error("Desktop viewport must mount only DesktopGameNav");
  }
  if (!m.mobile || !m.header || !m.dock || m.desktop) {
    throw new Error("Mobile viewport must mount MobileGameChrome only");
  }
  console.log("pass");
} finally {
  await browser.close();
}
