/**
 * Mobile + desktop wallet connect regression — Playwright taps, not DOM-only asserts.
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

async function assertNoMoreOverlay(page, label) {
  const state = await page.evaluate(() => {
    const sheet = document.querySelector(".mobile-dock__sheet, [data-more-sheet='open']");
    const backdrop = document.querySelector(
      ".mobile-dock__sheet-backdrop, [data-more-backdrop='true']",
    );
    const dock = document.querySelector(".mobile-dock");
    const mid = document.elementFromPoint(
      Math.floor(window.innerWidth / 2),
      Math.floor(window.innerHeight / 2),
    );
    const midClass = mid?.className?.toString?.() ?? "";
    return {
      sheetCount: document.querySelectorAll(".mobile-dock__sheet").length,
      backdropCount: document.querySelectorAll(".mobile-dock__sheet-backdrop").length,
      sheetDisplay: sheet ? getComputedStyle(sheet).display : null,
      sheetPointerEvents: sheet ? getComputedStyle(sheet).pointerEvents : null,
      backdropPointerEvents: backdrop ? getComputedStyle(backdrop).pointerEvents : null,
      dockZ: dock ? getComputedStyle(dock).zIndex : null,
      dockPointerEvents: dock ? getComputedStyle(dock).pointerEvents : null,
      moreOpenAttr: dock?.getAttribute("data-more-open") ?? null,
      midBlocks:
        Boolean(mid?.closest?.(".mobile-dock__sheet")) ||
        /mobile-dock__sheet/.test(midClass),
      midTag: mid?.tagName ?? null,
      midClass: midClass.slice(0, 80),
    };
  });

  if (state.sheetCount !== 0 || state.backdropCount !== 0) {
    throw new Error(`${label}: MORE sheet still in DOM after close: ${JSON.stringify(state)}`);
  }
  if (state.moreOpenAttr === "true") {
    throw new Error(`${label}: dock data-more-open still true after close`);
  }
  if (state.midBlocks) {
    throw new Error(`${label}: invisible MORE overlay still above page center: ${JSON.stringify(state)}`);
  }
  if (state.dockPointerEvents === "none") {
    throw new Error(`${label}: dock pointer-events disabled after close`);
  }
  return state;
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
            cls: (el.className || "").toString().slice(0, 60),
          }
        : null;
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );

  if (hit?.cls?.includes("mobile-dock__sheet")) {
    throw new Error(`${label}: MORE overlay intercepts wallet button hit test: ${JSON.stringify(hit)}`);
  }

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
      moreSheet: document.querySelectorAll(".mobile-dock__sheet").length,
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
    return Boolean(document.querySelector('[aria-label="Connect wallet"], [data-wallet-entry]'));
  });
  if (!ok) throw new Error("Wallet connect UI not mounted");
}

async function runMoreSheetChecks(page, results, prefix) {
  const more = page.locator('[data-dock-more="true"], .mobile-dock button:has-text("MORE")');
  if (!(await more.count())) {
    results.push({ label: `${prefix}:more-absent`, ok: true, note: "no MORE dock (expected on desktop)" });
    return;
  }

  await more.first().click();
  await page.locator('[data-more-sheet="open"]').waitFor({ state: "visible", timeout: 5000 });

  const openState = await page.evaluate(() => {
    const sheet = document.querySelector('[data-more-sheet="open"]');
    const backdrop = document.querySelector("[data-more-backdrop='true']");
    const dock = document.querySelector(".mobile-dock");
    return {
      sheetZ: sheet ? getComputedStyle(sheet).zIndex : null,
      backdropPe: backdrop ? getComputedStyle(backdrop).pointerEvents : null,
      dockZ: dock ? getComputedStyle(dock).zIndex : null,
      dockPe: dock ? getComputedStyle(dock).pointerEvents : null,
      moreOpen: dock?.getAttribute("data-more-open"),
    };
  });
  if (Number(openState.dockZ) <= Number(openState.sheetZ)) {
    throw new Error(`${prefix}: dock z-index must be above sheet while open: ${JSON.stringify(openState)}`);
  }
  if (openState.backdropPe !== "auto") {
    throw new Error(`${prefix}: backdrop pointer-events should be auto while open`);
  }
  if (openState.dockPe === "none") {
    throw new Error(`${prefix}: dock pointer-events must stay enabled while MORE is open`);
  }

  // Close via MORE toggle (must not be blocked by backdrop).
  await more.first().click({ timeout: 8000 });
  await page.locator('[data-more-sheet="open"]').waitFor({ state: "detached", timeout: 5000 });
  await assertNoMoreOverlay(page, `${prefix}:after-toggle-close`);

  // Open again and close via backdrop (center of viewport, clear of dock/header).
  await more.first().click();
  await page.locator('[data-more-sheet="open"]').waitFor({ state: "visible", timeout: 5000 });
  const backdropBox = await page.locator("[data-more-backdrop='true']").boundingBox();
  if (!backdropBox) throw new Error(`${prefix}: backdrop missing while open`);
  await page.mouse.click(
    backdropBox.x + backdropBox.width / 2,
    backdropBox.y + Math.min(80, backdropBox.height / 3),
  );
  await page.locator('[data-more-sheet="open"]').waitFor({ state: "detached", timeout: 5000 });
  await assertNoMoreOverlay(page, `${prefix}:after-backdrop-close`);

  results.push(
    await tapConnectAndExpectHelp(
      page,
      '[data-wallet-entry="header-mobile"] button, .game-nav__mobile [aria-label="Connect wallet"], [data-wallet-entry="header-desktop"] button, .game-nav--desktop [aria-label="Connect wallet"]',
      `${prefix}:after-more-close`,
    ),
  );
}

async function runMobileSuite(browser) {
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
        "mobile:header",
      ),
    );

    results.push(
      await tapConnectAndExpectHelp(
        page,
        '[data-wallet-entry="home-cta"], button.standoff__btn:has-text("CONNECT")',
        "mobile:home-cta",
      ),
    );

    await page.locator(".game-nav__menu-btn").click();
    await page.locator('[data-wallet-entry="mobile-menu"] button').waitFor({ state: "visible" });
    results.push(
      await tapConnectAndExpectHelp(
        page,
        '[data-wallet-entry="mobile-menu"] button',
        "mobile:menu",
      ),
    );

    await page.goto(`${BASE}${gamePath("myNfts")}`, { waitUntil: "domcontentloaded" });
    results.push(
      await tapConnectAndExpectHelp(page, '[data-wallet-entry="my-nfts"]', "mobile:my-nfts"),
    );

    await page.goto(`${BASE}${gamePath("mint")}`, { waitUntil: "domcontentloaded" });
    results.push(await tapConnectAndExpectHelp(page, '[data-wallet-entry="mint"]', "mobile:mint"));

    await page.goto(`${BASE}${gamePath("rewards")}`, { waitUntil: "domcontentloaded" });
    results.push(
      await tapConnectAndExpectHelp(
        page,
        '[data-wallet-entry="header-mobile"] button, .game-nav__mobile [aria-label="Connect wallet"]',
        "mobile:rewards-header",
      ),
    );

    await runMoreSheetChecks(page, results, "mobile");

    const finalLock = await bodyLockState(page);
    return { surface: "mobile", results, finalLock, pass: true };
  } catch (e) {
    return {
      surface: "mobile",
      results,
      pass: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await context.close();
  }
}

async function runDesktopSuite(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
  });
  const page = await context.newPage();
  const results = [];

  try {
    await page.goto(`${BASE}${gamePath("home")}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await assertProviderMounted(page);

    // Desktop chrome only — dock / MORE must not mount.
    const mobileChrome = await page.locator('[data-game-chrome="mobile"]').count();
    const dock = await page.locator(".mobile-dock").count();
    if (mobileChrome !== 0 || dock !== 0) {
      throw new Error(`desktop: mobile chrome unexpectedly mounted (chrome=${mobileChrome}, dock=${dock})`);
    }

    results.push(
      await tapConnectAndExpectHelp(
        page,
        '[data-wallet-entry="header-desktop"] button, .game-nav--desktop [aria-label="Connect wallet"], .game-nav__inner--desktop [aria-label="Connect wallet"]',
        "desktop:header",
      ),
    );

    results.push(
      await tapConnectAndExpectHelp(
        page,
        '[data-wallet-entry="home-cta"], button.standoff__btn:has-text("CONNECT")',
        "desktop:home-cta",
      ),
    );

    await runMoreSheetChecks(page, results, "desktop");

    const finalLock = await bodyLockState(page);
    return { surface: "desktop", results, finalLock, pass: true };
  } catch (e) {
    return {
      surface: "desktop",
      results,
      pass: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await context.close();
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  try {
    const mobile = await runMobileSuite(browser);
    const desktop = await runDesktopSuite(browser);
    const pass = Boolean(mobile.pass && desktop.pass);
    console.log(JSON.stringify({ base: BASE, mobile, desktop, pass }, null, 2));
    if (!pass) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
