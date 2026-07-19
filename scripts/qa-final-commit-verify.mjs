/**
 * Final pre-commit verification for Commit UI + audio + layout.
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.resolve("reports/final-verify");
fs.mkdirSync(OUT, { recursive: true });

const FORBIDDEN =
  /\b(salt|commit\s*hash|tx\s*hash|0x[a-f0-9]{16,}|on-chain|on chain|secrets?\s+stored|configured\s+contract|keccak)\b/i;

function locLabel(id) {
  const names = ["Home", "Mountain", "Grassland", "Forest", "River"];
  const weights = [1, 2, 3, 5, 8];
  return `${names[id]} · W${weights[id]}`;
}

async function seedCommits(page, day, specs) {
  await page.evaluate(
    ({ day, specs }) => {
      const records = specs.map((s) => ({
        tokenId: s.tokenId,
        day,
        locationId: s.locationId,
        salt: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        commitHash:
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        status: "submitted",
        updatedAt: Date.now(),
      }));
      localStorage.setItem("hansome-commit-secrets-v1", JSON.stringify(records));
      sessionStorage.setItem("hansome-pending-location-v1", "4");
    },
    { day, specs },
  );
}

async function auditCommit(page, label) {
  await page.goto(`${BASE}/game/commit`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForSelector("h1.pixel-title", { timeout: 60000 });
  await page.waitForSelector(".commit-nft-row__title", { timeout: 60000 });
  await page.waitForFunction(
    () => /DAY\s+[1-9]\d*/i.test(document.body.innerText) || /DEMO/i.test(document.body.innerText),
    { timeout: 60000 },
  );

  const day = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll("*")).find((n) =>
      /^DAY\s+\d+$/i.test((n.textContent || "").trim()),
    );
    return Number(((el?.textContent || "DAY 1").match(/\d+/) || ["1"])[0]);
  });

  const tokenIds = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".commit-nft-row__title")).map((el) =>
      Number((el.textContent || "").match(/#(\d+)/)?.[1] || 0),
    ),
  );

  const specs = tokenIds.slice(0, 5).map((tokenId, i) => ({
    tokenId,
    locationId: /** @type {0|1|2|3|4} */ ([4, 3, 2, 1, 0][i] ?? 4),
  }));

  await seedCommits(page, day, specs);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector(".commit-nft-row--done", { timeout: 60000 });
  await page.waitForTimeout(400);

  const result = await page.evaluate((forbiddenSource) => {
    const forbidden = new RegExp(forbiddenSource, "i");
    const root = document.querySelector("main") || document.body;
    const text = root.innerText || "";
    const bad = forbidden.test(text);
    const rows = Array.from(document.querySelectorAll(".commit-nft-row")).map((row) => {
      const title = row.querySelector(".commit-nft-row__title")?.textContent?.trim() || "";
      const submitted = row.querySelector(".commit-nft-row__submitted")?.textContent?.trim() || "";
      const location = row.querySelector(".commit-nft-row__location")?.textContent?.trim() || "";
      const done = row.classList.contains("commit-nft-row--done");
      return { title, submitted, location, done };
    });
    const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    return {
      blurb: document.querySelector("h1.pixel-title + p")?.textContent?.trim() || "",
      badTerms: bad,
      sampleMatch: bad ? text.match(forbidden)?.[0] : null,
      rows,
      overflowX,
      bodyW: document.body.scrollWidth,
      viewW: document.documentElement.clientWidth,
    };
  }, FORBIDDEN.source);

  const expected = new Map(specs.map((s) => [s.tokenId, locLabel(s.locationId)]));
  const locationOk = result.rows
    .filter((r) => r.done)
    .every((r) => {
      const id = Number(r.title.match(/#(\d+)/)?.[1] || 0);
      const want = expected.get(id);
      return want && r.location.includes(want) && /Submitted/i.test(r.submitted);
    });

  await page.screenshot({
    path: path.join(OUT, `commit-${label}.png`),
    fullPage: true,
  });

  return { ...result, locationOk, day, specsCount: specs.length, doneCount: result.rows.filter((r) => r.done).length };
}

async function auditAudio(page) {
  await page.goto(`${BASE}/game`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(700);
  return page.evaluate(() => {
    const prefs = localStorage.getItem("hansome-game-audio");
    const music = document.querySelector('button[title*="Alpaca Warpath"], button[title*="Music"]');
    const sfx = Array.from(document.querySelectorAll('button[aria-pressed]')).find(
      (b) => /sound|SFX|effects/i.test(b.getAttribute("aria-label") || b.getAttribute("title") || ""),
    );
    const dbg = window.__HANSOME_AUDIO__ || null;
    return {
      prefs,
      musicPressed: music?.getAttribute("aria-pressed"),
      sfxPressed: sfx?.getAttribute("aria-pressed"),
      ambientSuppressed: dbg?.ambient?.suppressed === true,
      ambientPaused: dbg?.ambient?.paused !== false,
      gameSrc: String(dbg?.game?.src || ""),
      gameDesired: dbg?.game?.desired === true,
    };
  });
}

async function auditMyNfts(page) {
  await page.goto(`${BASE}/game/dashboard`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.click('a.mobile-dock__item >> text=/NFTS|NFTs/i');
  await page.waitForURL(/my-nfts/, { timeout: 30000 });
  await page.waitForTimeout(400);
  return page.evaluate(() => ({
    y: window.scrollY,
    modal: !!document.querySelector('[role="dialog"][aria-modal="true"]'),
    bodyFixed: document.body.style.position === "fixed",
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }));
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // Desktop commit + audio
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const commit = await auditCommit(page, "desktop");
    const audio = await auditAudio(page);
    console.log("DESKTOP_COMMIT", JSON.stringify(commit, null, 2));
    console.log("DESKTOP_AUDIO", JSON.stringify(audio, null, 2));
    if (!commit.locationOk || commit.badTerms || commit.overflowX) {
      throw new Error("Desktop commit checks failed");
    }
    if (
      audio.prefs != null ||
      audio.musicPressed !== "true" ||
      audio.sfxPressed !== "true" ||
      !audio.ambientSuppressed ||
      !audio.gameSrc.includes("gameplay-theme") ||
      !audio.gameDesired
    ) {
      throw new Error("Desktop audio checks failed: " + JSON.stringify(audio));
    }
    await ctx.close();
  }

  // Mobile commit + my-nfts scroll
  {
    const ctx = await browser.newContext({ ...devices["iPhone SE"] });
    const page = await ctx.newPage();
    const commit = await auditCommit(page, "mobile");
    const myNfts = await auditMyNfts(page);
    const audio = await auditAudio(page);
    console.log("MOBILE_COMMIT", JSON.stringify(commit, null, 2));
    console.log("MOBILE_MY_NFTS", JSON.stringify(myNfts, null, 2));
    console.log("MOBILE_AUDIO", JSON.stringify(audio, null, 2));
    if (!commit.locationOk || commit.badTerms || commit.overflowX) {
      throw new Error("Mobile commit checks failed");
    }
    if (myNfts.y > 8 || myNfts.modal || myNfts.bodyFixed || myNfts.overflowX) {
      throw new Error("Mobile My NFTs scroll checks failed");
    }
    if (
      audio.musicPressed !== "true" ||
      audio.sfxPressed !== "true" ||
      !audio.ambientSuppressed ||
      !audio.gameSrc.includes("gameplay-theme")
    ) {
      throw new Error("Mobile audio checks failed");
    }
    await ctx.close();
  }

  await browser.close();
  console.log("FINAL_VERIFY_OK", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
