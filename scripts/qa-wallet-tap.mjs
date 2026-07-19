import { chromium, devices } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";

async function probeVisible(page, label) {
  const buttons = page.locator(
    'button[aria-label="Connect wallet"], button.standoff__btn:has-text("CONNECT")',
  );
  const total = await buttons.count();
  const results = [];

  for (let i = 0; i < total; i += 1) {
    const btn = buttons.nth(i);
    const visible = await btn.isVisible().catch(() => false);
    const box = visible ? await btn.boundingBox() : null;
    let hit = null;
    let clickOk = false;
    let clickErr = null;
    let connectCalled = false;

    if (visible && box) {
      hit = await page.evaluate(
        ({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          if (!el) return null;
          return {
            tag: el.tagName,
            cls: String(el.className || "").slice(0, 100),
            text: (el.textContent || "").trim().slice(0, 48),
            pe: getComputedStyle(el).pointerEvents,
          };
        },
        { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      );

      await page.evaluate(() => {
        window.__WALLET_TAP__ = { clicked: false, at: 0 };
        document.addEventListener(
          "click",
          (e) => {
            const t = e.target;
            if (!(t instanceof Element)) return;
            if (
              t.closest(
                'button[aria-label="Connect wallet"], button.standoff__btn',
              )
            ) {
              window.__WALLET_TAP__ = { clicked: true, at: Date.now() };
            }
          },
          true,
        );
      });

      try {
        await btn.click({ timeout: 4000 });
        clickOk = true;
      } catch (e) {
        clickErr = e instanceof Error ? e.message.split("\n")[0] : String(e);
        try {
          await btn.click({ force: true, timeout: 2000 });
          clickOk = true;
          clickErr = (clickErr || "") + " | forceClickOk";
        } catch (e2) {
          clickErr =
            (clickErr || "") +
            " | forceFail:" +
            (e2 instanceof Error ? e2.message.split("\n")[0] : String(e2));
        }
      }
      await page.waitForTimeout(400);
      connectCalled = await page.evaluate(() => window.__WALLET_TAP__?.clicked === true);
    }

    results.push({ i, visible, box, hit, clickOk, clickErr, connectCalled });
  }

  const body = await page.evaluate(() => ({
    bodyPos: document.body.style.position,
    bodyOverflow: document.body.style.overflow,
    eth: typeof window.ethereum,
    htmlGameRoute: document.documentElement.classList.contains("hansome-game-route"),
    marketingToggleDisplay: (() => {
      const el = document.querySelector("[data-marketing-language-toggle]");
      return el ? getComputedStyle(el).display : "absent";
    })(),
    stagePe: (() => {
      const el = document.querySelector(".standoff__stage");
      return el ? getComputedStyle(el).pointerEvents : "no-stage";
    })(),
    platePe: (() => {
      const el = document.querySelector(".standoff__plate-img");
      return el ? getComputedStyle(el).pointerEvents : "no-plate";
    })(),
  }));

  console.log(JSON.stringify({ label, total, results, body }, null, 2));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ ...devices["iPhone SE"] });
  const page = await ctx.newPage();

  for (const path of ["/", "/my-nfts", "/mint", "/rewards"]) {
    const url = BASE.includes("game.")
      ? `${BASE.replace(/\/$/, "")}${path === "/" ? "/" : path}`
      : `${BASE.replace(/\/$/, "")}/game${path === "/" ? "" : path}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 120000 }).catch(async () => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    });
    await page.waitForTimeout(1200);
    await probeVisible(page, url);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
