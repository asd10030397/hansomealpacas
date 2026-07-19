/**
 * Manual-style MORE sheet lifecycle QA (mobile + desktop).
 *
 * Flow:
 *   Open MORE → Connect wallet → return from MetaMask → Open MORE again →
 *   Change language → Navigate away → Return
 *
 * Usage:
 *   BASE_URL=http://localhost:3010 node scripts/qa-more-sheet-lifecycle.mjs
 */
import { chromium, devices } from "playwright";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const HOME = BASE.includes("game.") && !BASE.includes("localhost") ? "/" : "/game";
const MINT = BASE.includes("game.") && !BASE.includes("localhost") ? "/mint" : "/game/mint";
const REWARDS =
  BASE.includes("game.") && !BASE.includes("localhost") ? "/rewards" : "/game/rewards";
/** Title/standoff hides the dock — MORE lifecycle starts on a dock-visible page. */
const START = MINT;

function fail(label, detail) {
  const err = new Error(`${label}: ${detail}`);
  err.label = label;
  throw err;
}

async function overlaySnapshot(page) {
  return page.evaluate(() => {
    const sheets = [...document.querySelectorAll(".mobile-dock__sheet, [data-more-sheet]")];
    const backdrops = [
      ...document.querySelectorAll(".mobile-dock__sheet-backdrop, [data-more-backdrop]"),
    ];
    const dock = document.querySelector(".mobile-dock");
    const header = document.querySelector(".game-nav");
    const mid = document.elementFromPoint(
      Math.floor(window.innerWidth / 2),
      Math.floor(window.innerHeight / 2),
    );
    const midCls = (mid?.className || "").toString();
    return {
      sheetCount: sheets.length,
      backdropCount: backdrops.length,
      sheetZs: sheets.map((el) => getComputedStyle(el).zIndex),
      backdropPes: backdrops.map((el) => getComputedStyle(el).pointerEvents),
      dockZ: dock ? getComputedStyle(dock).zIndex : null,
      dockPe: dock ? getComputedStyle(dock).pointerEvents : null,
      headerZ: header ? getComputedStyle(header).zIndex : null,
      moreOpen: dock?.getAttribute("data-more-open") ?? null,
      bodyPosition: document.body.style.position,
      bodyOverflow: document.body.style.overflow,
      midBlocked: Boolean(mid?.closest?.(".mobile-dock__sheet")) || /mobile-dock__sheet/.test(midCls),
      midTag: mid?.tagName ?? null,
      midCls: midCls.slice(0, 80),
    };
  });
}

async function assertClosedClean(page, label) {
  const s = await overlaySnapshot(page);
  if (s.sheetCount !== 0) fail(label, `expected 0 MORE sheets, got ${s.sheetCount}`);
  if (s.backdropCount !== 0) fail(label, `expected 0 backdrops, got ${s.backdropCount}`);
  if (s.moreOpen === "true") fail(label, "data-more-open still true");
  if (s.bodyPosition === "fixed") fail(label, "body still position:fixed");
  if (s.midBlocked) fail(label, `invisible overlay at page center: ${JSON.stringify(s)}`);
  if (s.dockPe === "none") fail(label, "dock pointer-events none while closed");
  return s;
}

async function assertOpenSingle(page, label) {
  const s = await overlaySnapshot(page);
  if (s.sheetCount !== 1) fail(label, `expected exactly 1 MORE sheet, got ${s.sheetCount}`);
  if (s.backdropCount !== 1) fail(label, `expected exactly 1 backdrop, got ${s.backdropCount}`);
  if (s.moreOpen !== "true") fail(label, "data-more-open should be true");
  if (s.backdropPes.some((pe) => pe !== "auto")) {
    fail(label, `backdrop pointer-events not auto: ${JSON.stringify(s.backdropPes)}`);
  }
  if (s.dockPe === "none") fail(label, "dock pointer-events must stay enabled while open");
  const sheetZ = Number(s.sheetZs[0]);
  const dockZ = Number(s.dockZ);
  if (!(dockZ > sheetZ)) {
    fail(label, `dock z-index (${dockZ}) must be above sheet (${sheetZ})`);
  }
  return s;
}

async function openMore(page) {
  const more = page.locator('[data-dock-more="true"]');
  await more.waitFor({ state: "visible", timeout: 15000 });
  await more.click();
  await page.locator('[data-more-sheet="open"]').waitFor({ state: "visible", timeout: 5000 });
}

async function closeMoreViaToggle(page) {
  await page.locator('[data-dock-more="true"]').click({ timeout: 8000 });
  await page.locator('[data-more-sheet="open"]').waitFor({ state: "detached", timeout: 5000 });
}

async function simulateReturnFromMetaMask(page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await page.waitForTimeout(500);
}

async function connectWalletFromHeader(page) {
  const btn = page
    .locator(
      '[data-wallet-entry="header-mobile"] button, .game-nav__mobile [aria-label="Connect wallet"]',
    )
    .first();
  await btn.waitFor({ state: "visible", timeout: 15000 });
  await btn.click({ timeout: 8000 });
  const help = page.locator('[data-wallet-help-modal="open"]');
  await help.waitFor({ state: "visible", timeout: 10000 });
  const closeBtn = help.getByRole("button", { name: /^Close$|^關閉$/i });
  if (await closeBtn.count()) await closeBtn.first().click();
  else await help.getByRole("button", { name: /^X$/i }).first().click();
  await help.waitFor({ state: "detached", timeout: 8000 });
}

async function changeLanguageInMore(page) {
  const zh = page.locator('[data-more-panel="true"] .game-lang__btn').filter({ hasText: /中文|ZH/i });
  const en = page.locator('[data-more-panel="true"] .game-lang__btn').filter({ hasText: /^EN$/i });
  // Prefer switching to the inactive locale.
  if (await zh.count()) {
    await zh.first().click();
  } else if (await en.count()) {
    await en.first().click();
  } else {
    fail("language", "language toggle not found in MORE panel");
  }
  await page.waitForTimeout(300);
}

async function runMobileLifecycle(browser) {
  const context = await browser.newContext({
    ...devices["iPhone SE"],
    locale: "en-US",
  });
  const page = await context.newPage();
  const checks = [];

  try {
    await page.goto(`${BASE}${START}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(500);
    await page.locator('[data-dock-more="true"]').waitFor({ state: "visible", timeout: 15000 });

    // 1) Open MORE
    await openMore(page);
    checks.push({ step: "open-more", ...(await assertOpenSingle(page, "mobile:open-more")) });

    // Close before wallet (header is under sheet while open)
    await closeMoreViaToggle(page);
    checks.push({ step: "close-before-wallet", ...(await assertClosedClean(page, "mobile:close-before-wallet")) });

    // 2) Connect wallet
    await connectWalletFromHeader(page);
    checks.push({ step: "after-wallet-help", ...(await assertClosedClean(page, "mobile:after-wallet-help")) });

    // 3) Return from MetaMask
    await simulateReturnFromMetaMask(page);
    checks.push({ step: "after-metamask-return", ...(await assertClosedClean(page, "mobile:after-metamask-return")) });

    // 4) Open MORE again
    await openMore(page);
    checks.push({ step: "open-more-again", ...(await assertOpenSingle(page, "mobile:open-more-again")) });

    // 5) Change language (while MORE open)
    await changeLanguageInMore(page);
    checks.push({ step: "after-language", ...(await assertOpenSingle(page, "mobile:after-language")) });

    // 6) Navigate via MORE link (Rewards is in MORE, not primary dock)
    await page
      .locator('[data-more-panel="true"] a[data-nav-id="rewards"], .mobile-dock__sheet-link[data-nav-id="rewards"]')
      .first()
      .click({ timeout: 8000 });
    await page.waitForURL(/\/rewards/, { timeout: 15000 });
    await page.waitForTimeout(400);
    checks.push({
      step: "after-navigate-rewards",
      ...(await assertClosedClean(page, "mobile:after-navigate-rewards")),
    });

    // 7) Return to previous page (MINT) via primary dock
    await page.locator('.mobile-dock a[href*="mint"]').first().click({ timeout: 8000 });
    await page.waitForURL(/\/mint/, { timeout: 15000 });
    await page.waitForTimeout(400);
    checks.push({ step: "after-return-mint", ...(await assertClosedClean(page, "mobile:after-return-mint")) });

    // Final interaction: MORE open/close still works; wallet still tappable
    await openMore(page);
    await assertOpenSingle(page, "mobile:final-open");
    await closeMoreViaToggle(page);
    await assertClosedClean(page, "mobile:final-close");
    await connectWalletFromHeader(page);
    checks.push({ step: "final-wallet-ok", ok: true });

    return { surface: "mobile", pass: true, checks };
  } catch (e) {
    return {
      surface: "mobile",
      pass: false,
      checks,
      error: e instanceof Error ? e.message : String(e),
      snapshot: await overlaySnapshot(page).catch(() => null),
    };
  } finally {
    await context.close();
  }
}

async function runDesktopLifecycle(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
  });
  const page = await context.newPage();
  const checks = [];

  try {
    await page.goto(`${BASE}${HOME}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(500);

    const chrome = await page.evaluate(() => ({
      mobile: document.querySelectorAll('[data-game-chrome="mobile"]').length,
      dock: document.querySelectorAll(".mobile-dock").length,
      sheet: document.querySelectorAll(".mobile-dock__sheet").length,
      backdrop: document.querySelectorAll(".mobile-dock__sheet-backdrop").length,
      desktop: document.querySelectorAll('[data-game-chrome="desktop"]').length,
      headerZ: getComputedStyle(document.querySelector(".game-nav") || document.body).zIndex,
    }));

    if (chrome.mobile !== 0 || chrome.dock !== 0 || chrome.sheet !== 0 || chrome.backdrop !== 0) {
      fail("desktop:chrome", `mobile MORE chrome leaked onto desktop: ${JSON.stringify(chrome)}`);
    }
    if (chrome.desktop !== 1) {
      fail("desktop:chrome", `expected desktop chrome, got ${JSON.stringify(chrome)}`);
    }
    checks.push({ step: "no-more-on-desktop", ...chrome, ok: true });

    // Wallet connect still works; no overlay regressions
    const btn = page
      .locator(
        '[data-wallet-entry="header-desktop"] button, .game-nav--desktop [aria-label="Connect wallet"]',
      )
      .first();
    await btn.click({ timeout: 8000 });
    const help = page.locator('[data-wallet-help-modal="open"]');
    await help.waitFor({ state: "visible", timeout: 10000 });
    await help.getByRole("button", { name: /^Close$|^關閉$/i }).first().click();
    await help.waitFor({ state: "detached", timeout: 8000 });

    await simulateReturnFromMetaMask(page);
    const after = await page.evaluate(() => ({
      sheet: document.querySelectorAll(".mobile-dock__sheet").length,
      backdrop: document.querySelectorAll(".mobile-dock__sheet-backdrop").length,
      bodyPosition: document.body.style.position,
      midBlocked: Boolean(
        document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)?.closest?.(
          ".mobile-dock__sheet",
        ),
      ),
    }));
    if (after.sheet || after.backdrop || after.bodyPosition === "fixed" || after.midBlocked) {
      fail("desktop:after-metamask", JSON.stringify(after));
    }
    checks.push({ step: "desktop-after-metamask", ...after, ok: true });

    // Language toggle on desktop header tools (if present)
    const lang = page.locator('[data-game-language-toggle="true"] .game-lang__btn').filter({
      hasText: /中文|ZH/i,
    });
    if (await lang.count()) {
      await lang.first().click();
      await page.waitForTimeout(200);
    }

    await page.goto(`${BASE}${REWARDS}`, { waitUntil: "commit", timeout: 60000 });
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await page.goto(`${BASE}${MINT}`, { waitUntil: "commit", timeout: 60000 });
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    const final = await page.evaluate(() => ({
      sheet: document.querySelectorAll(".mobile-dock__sheet").length,
      backdrop: document.querySelectorAll(".mobile-dock__sheet-backdrop").length,
      bodyPosition: document.body.style.position,
      mobileChrome: document.querySelectorAll('[data-game-chrome="mobile"]').length,
      desktopChrome: document.querySelectorAll('[data-game-chrome="desktop"]').length,
    }));
    if (final.sheet || final.backdrop || final.bodyPosition === "fixed") {
      fail("desktop:after-nav", JSON.stringify(final));
    }
    if (final.mobileChrome !== 0 || final.desktopChrome !== 1) {
      fail("desktop:after-nav-chrome", JSON.stringify(final));
    }
    checks.push({ step: "desktop-nav-clean", ...final, ok: true });

    return { surface: "desktop", pass: true, checks };
  } catch (e) {
    return {
      surface: "desktop",
      pass: false,
      checks,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await context.close();
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  try {
    const mobile = await runMobileLifecycle(browser);
    const desktop = await runDesktopLifecycle(browser);
    const pass = Boolean(mobile.pass && desktop.pass);
    const report = {
      base: BASE,
      scenario: [
        "Start on dock-visible page (Mint; title standoff hides dock)",
        "Open MORE",
        "Connect wallet",
        "Return from MetaMask (visibility/focus/pageshow)",
        "Open MORE again",
        "Change language",
        "Navigate to another Game page (Rewards)",
        "Return to previous page (Mint)",
      ],
      mobile,
      desktop,
      pass,
    };
    console.log(JSON.stringify(report, null, 2));
    if (!pass) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
