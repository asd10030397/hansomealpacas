/**
 * Mobile wallet connect regression — Playwright taps, not DOM-only asserts.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 node scripts/qa-wallet-connect-mobile.mjs
 *   BASE_URL=https://game.hansomealpacas.xyz node scripts/qa-wallet-connect-mobile.mjs
 */
import { chromium, devices } from "playwright";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

const PATHS = {
  home: BASE.includes("game.") && !BASE.includes("localhost") ? "/" : "/game",
  mint: BASE.includes("game.") && !BASE.includes("localhost") ? "/mint" : "/game/mint",
  myNfts: BASE.includes("game.") && !BASE.includes("localhost") ? "/my-nfts" : "/game/my-nfts",
  rewards: BASE.includes("game.") && !BASE.includes("localhost") ? "/rewards" : "/game/rewards",
};

function gamePath(key) {
  return PATHS[key];
}

async function bodyLockState(page) {
  return page.evaluate(() => ({
    position: document.body.style.position,
    overflow: document.body.style.overflow,
    top: document.body.style.top,
  }));
}

async function sheetOverlayPresent(page) {
  return page.locator(".mobile-dock__sheet").count();
}

async function tapConnectAndExpectHelp(page, selector, label) {
  const btn = page.locator(selector).first();
  await btn.waitFor({ state: "visible", timeout: 20000 });
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  // Avoid hydration races on production CDN.
  await page.waitForTimeout(400);

  const disabled = await btn.isDisabled().catch(() => false);
  if (disabled) throw new Error(`${label}: connect button is disabled`);

  const box = await btn.boundingBox();
  if (!box) throw new Error(`${label}: no bounding box`);

  const hit = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el
        ? {
            tag: el.tagName,
            text: (el.textContent || "").trim().slice(0, 40),
            pe: getComputedStyle(el).pointerEvents,
          }
        : null;
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );

  await btn.click({ timeout: 8000 });
  const help = page.locator('[data-wallet-help-modal="open"]');
  try {
    await help.waitFor({ state: "visible", timeout: 10000 });
  } catch (e) {
    const diag = await page.evaluate(() => ({
      ethereum: typeof window.ethereum,
      helpOpen: Boolean(document.querySelector('[data-wallet-help-modal="open"]')),
      alerts: Array.from(document.querySelectorAll("[role='alert']")).map((n) =>
        (n.textContent || "").slice(0, 80),
      ),
      bodyPos: document.body.style.position,
      overlay: Boolean(document.querySelector(".mobile-dock__sheet, .game-nav__drawer")),
    }));
    throw new Error(
      `${label}: help modal did not open. hit=${JSON.stringify(hit)} diag=${JSON.stringify(diag)}`,
    );
  }
  const alertText = await help.locator("[role='alert']").innerText();
  if (!/Unable to open wallet connection|無法開啟錢包連接/i.test(alertText)) {
    throw new Error(`${label}: unexpected help text: ${alertText}`);
  }

  // Close help (prefer primary Close over the X control)
  const closeBtn = help.getByRole("button", { name: /^Close$|^關閉$/i });
  if (await closeBtn.count()) {
    await closeBtn.first().click();
  } else {
    await help.getByRole("button", { name: /^X$/i }).first().click();
  }
  await page
    .locator('[data-wallet-help-modal="open"]')
    .waitFor({ state: "detached", timeout: 8000 });

  const lock = await bodyLockState(page);
  if (lock.position === "fixed") {
    throw new Error(`${label}: body still position:fixed after close`);
  }

  return { label, hit, alertText: alertText.slice(0, 80), ok: true };
}

async function assertProviderMounted(page) {
  const ok = await page.evaluate(() => {
    // Wagmi + wallet help host: connect buttons exist and wagmi config is present via React.
    return Boolean(document.querySelector('[aria-label="Connect wallet"], [data-wallet-entry]'));
  });
  if (!ok) throw new Error("Wallet connect UI not mounted");
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices["iPhone SE"],
    locale: "en-US",
  });
  const page = await context.newPage();
  const results = [];

  try {
    await page.goto(`${BASE}${gamePath("home")}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await assertProviderMounted(page);

    results.push(
      await tapConnectAndExpectHelp(
        page,
        '[data-wallet-entry="header-mobile"] button, .game-nav__mobile [aria-label="Connect wallet"]',
        "header-mobile",
      ),
    );

    results.push(
      await tapConnectAndExpectHelp(
        page,
        '[data-wallet-entry="home-cta"], button.standoff__btn:has-text("CONNECT")',
        "home-cta",
      ),
    );

    // MENU wallet action
    await page.locator(".game-nav__menu-btn").click();
    await page.locator('[data-wallet-entry="mobile-menu"] button').waitFor({ state: "visible" });
    results.push(
      await tapConnectAndExpectHelp(
        page,
        '[data-wallet-entry="mobile-menu"] button',
        "mobile-menu",
      ),
    );

    await page.goto(`${BASE}${gamePath("myNfts")}`, { waitUntil: "domcontentloaded" });
    results.push(
      await tapConnectAndExpectHelp(page, '[data-wallet-entry="my-nfts"]', "my-nfts"),
    );

    await page.goto(`${BASE}${gamePath("mint")}`, { waitUntil: "domcontentloaded" });
    results.push(await tapConnectAndExpectHelp(page, '[data-wallet-entry="mint"]', "mint"));

    await page.goto(`${BASE}${gamePath("rewards")}`, { waitUntil: "domcontentloaded" });
    // Rewards uses header wallet (no page-level CTA)
    results.push(
      await tapConnectAndExpectHelp(
        page,
        '[data-wallet-entry="header-mobile"] button, .game-nav__mobile [aria-label="Connect wallet"]',
        "rewards-header",
      ),
    );

    // MORE sheet must not leave a blocking overlay
    const more = page.locator(".mobile-dock button:has-text('MORE')");
    if (await more.count()) {
      await more.first().click();
      await page.locator(".mobile-dock__sheet").waitFor({ state: "visible", timeout: 5000 });
      // Toggle MORE again (same as user closing); backdrop is a sibling under sheet.
      await more.first().click();
      await page.locator(".mobile-dock__sheet").waitFor({ state: "detached", timeout: 5000 });
      if ((await sheetOverlayPresent(page)) !== 0) {
        throw new Error("MORE sheet still mounted after close");
      }
      // Header connect still tappable — no leftover overlay
      results.push(
        await tapConnectAndExpectHelp(
          page,
          '[data-wallet-entry="header-mobile"] button, .game-nav__mobile [aria-label="Connect wallet"]',
          "after-more-close",
        ),
      );
    }

    const finalLock = await bodyLockState(page);
    console.log(JSON.stringify({ base: BASE, results, finalLock, pass: true }, null, 2));
  } catch (e) {
    console.error(
      JSON.stringify(
        {
          base: BASE,
          results,
          pass: false,
          error: e instanceof Error ? e.message : String(e),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
