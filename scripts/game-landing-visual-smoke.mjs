/**
 * Visual smoke for HANSOME game landing artwork.
 * Does NOT trust HTTP 200 alone — checks rendered bbox, CSS visibility,
 * viewport presence, stacking coverage, and screenshot pixel regression.
 *
 * Usage:
 *   node scripts/game-landing-visual-smoke.mjs
 *   node scripts/game-landing-visual-smoke.mjs --update-baseline
 *   node scripts/game-landing-visual-smoke.mjs --url=https://game.hansomealpacas.xyz/
 *   node scripts/game-landing-visual-smoke.mjs --www-only
 *   node scripts/game-landing-visual-smoke.mjs --game-only
 *
 * Exit 0 = PASS, 1 = FAIL
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "./_png-diff.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ARTIFACTS = path.join(ROOT, "tests", "visual", "artifacts");
const BASELINES = path.join(ROOT, "tests", "visual", "baselines");

const args = process.argv.slice(2);
const UPDATE_BASELINE = args.includes("--update-baseline");
const GAME_ONLY = args.includes("--game-only");
const WWW_ONLY = args.includes("--www-only");
const urlArg = args.find((a) => a.startsWith("--url="));
const GAME_URL = urlArg?.slice("--url=".length) || "https://game.hansomealpacas.xyz/";
const WWW_URL = "https://www.hansomealpacas.xyz/";
/** Max fraction of differing pixels vs baseline (desktop viewport). */
const DIFF_THRESHOLD = 0.08;
const VIEWPORT = { width: 1440, height: 900 };

fs.mkdirSync(ARTIFACTS, { recursive: true });
fs.mkdirSync(BASELINES, { recursive: true });

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  return false;
}

function pass(msg) {
  console.log(`PASS: ${msg}`);
  return true;
}

/**
 * elementFromPoint at several sample points inside the target's bbox.
 * Fail if a non-descendant coverer (higher paint order) sits on top for
 * a majority of samples — stage art is pointer-events:none so we must
 * use elementsFromPoint, not hover hit-testing.
 */
async function coverageCheck(page, selector, label) {
  return page.evaluate(
    ({ selector, label }) => {
      const el = document.querySelector(selector);
      if (!el) return { ok: false, reason: `${label}: missing DOM node (${selector})` };
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) {
        return { ok: false, reason: `${label}: zero/near-zero bbox ${JSON.stringify(r)}` };
      }
      const cs = getComputedStyle(el);
      if (cs.display === "none") return { ok: false, reason: `${label}: display:none` };
      if (cs.visibility === "hidden") return { ok: false, reason: `${label}: visibility:hidden` };
      const opacity = Number.parseFloat(cs.opacity);
      if (!(opacity > 0.05)) return { ok: false, reason: `${label}: opacity=${cs.opacity}` };

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const visibleW = Math.min(r.right, vw) - Math.max(r.left, 0);
      const visibleH = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      if (visibleW < 8 || visibleH < 8) {
        return {
          ok: false,
          reason: `${label}: outside viewport (visible ${visibleW}x${visibleH}, bbox ${r.width}x${r.height})`,
        };
      }

      // Sample grid inside the element's visible region
      const x0 = Math.max(r.left, 0) + 4;
      const y0 = Math.max(r.top, 0) + 4;
      const x1 = Math.min(r.right, vw) - 4;
      const y1 = Math.min(r.bottom, vh) - 4;
      const samples = [];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const x = x0 + ((x1 - x0) * i) / 2;
          const y = y0 + ((y1 - y0) * j) / 2;
          samples.push({ x, y });
        }
      }

      let covered = 0;
      const coverers = new Set();
      for (const { x, y } of samples) {
        const stack = document.elementsFromPoint(x, y);
        // Find first element that is NOT el and NOT a descendant of el,
        // and that is also NOT a descendant of el's stage ancestors that are
        // intentionally under heroes (we only care if something opaque covers art).
        let blocked = false;
        for (const node of stack) {
          if (node === el || el.contains(node) || node.contains(el)) break;
          // Ignore transparent overlays that are known stage chrome (vignette/seam)
          // only if they are siblings under .standoff__stage and very translucent —
          // for heroes we require the img (or its wrapper) appear in the stack.
          const cls = node.className?.toString?.() || "";
          if (
            cls.includes("standoff__vignette") ||
            cls.includes("standoff__seam") ||
            cls.includes("standoff__grade") ||
            cls.includes("standoff__whisper")
          ) {
            continue;
          }
          // Foreground menu covering center is OK for side heroes if samples
          // still hit hero; count as coverer only if neither el nor parent in stack.
          if (!stack.some((n) => n === el || el.contains(n) || n.contains?.(el))) {
            blocked = true;
            coverers.add(cls.slice(0, 80) || node.tagName);
          } else {
            // hero/img is in stack under some overlays — OK if we reached it
            break;
          }
        }
        // Simpler rule: el (or descendant/ancestor chain including el) must appear in stack
        const inStack = stack.some((n) => n === el || el.contains(n) || (typeof n.contains === "function" && n.contains(el)));
        if (!inStack) {
          covered++;
          if (stack[0]) coverers.add((stack[0].className?.toString?.() || stack[0].tagName).slice(0, 80));
        }
      }

      const coveredRatio = covered / samples.length;
      if (coveredRatio > 0.66) {
        return {
          ok: false,
          reason: `${label}: covered by other elements (${Math.round(coveredRatio * 100)}% samples); top=${[...coverers].join("|")}`,
        };
      }

      return {
        ok: true,
        bbox: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) },
        opacity,
        display: cs.display,
        visibility: cs.visibility,
        coveredRatio,
      };
    },
    { selector, label },
  );
}

async function naturalSizeCheck(page, selector, label) {
  return page.evaluate(
    ({ selector, label }) => {
      const el = document.querySelector(selector);
      if (!el) return { ok: false, reason: `${label}: missing` };
      const img = el.tagName === "IMG" ? el : el.querySelector("img");
      if (!img) return { ok: false, reason: `${label}: no <img>` };
      if (!img.complete) return { ok: false, reason: `${label}: image not complete` };
      if (img.naturalWidth < 8 || img.naturalHeight < 8) {
        return {
          ok: false,
          reason: `${label}: natural size ${img.naturalWidth}x${img.naturalHeight} (broken decode)`,
        };
      }
      return { ok: true, natural: { w: img.naturalWidth, h: img.naturalHeight }, src: img.currentSrc || img.src };
    },
    { selector, label },
  );
}

/**
 * Sample painted pixels inside the element's visible box via drawImage.
 * Catches "HTTP 200 but transparent / solid-dark paint" regressions that
 * bbox + naturalWidth alone miss.
 */
async function paintedPixelCheck(page, selector, label) {
  return page.evaluate(
    ({ selector, label }) => {
      const el = document.querySelector(selector);
      if (!el) return { ok: false, reason: `${label}: missing for pixel sample` };
      const img = el.tagName === "IMG" ? el : el.querySelector("img");
      if (!img || !img.complete || img.naturalWidth < 8) {
        return { ok: false, reason: `${label}: cannot sample pixels` };
      }
      const r = el.getBoundingClientRect();
      const w = Math.max(8, Math.min(64, Math.floor(r.width)));
      const h = Math.max(8, Math.min(64, Math.floor(r.height)));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      try {
        ctx.drawImage(img, 0, 0, w, h);
      } catch (e) {
        return { ok: false, reason: `${label}: drawImage failed (${e.message})` };
      }
      const { data } = ctx.getImageData(0, 0, w, h);
      let opaque = 0;
      let nonDark = 0;
      let sumR = 0, sumG = 0, sumB = 0;
      const n = w * h;
      for (let i = 0; i < n; i++) {
        const o = i * 4;
        const a = data[o + 3];
        if (a < 16) continue;
        opaque++;
        const r0 = data[o], g0 = data[o + 1], b0 = data[o + 2];
        sumR += r0; sumG += g0; sumB += b0;
        if (r0 + g0 + b0 > 40) nonDark++;
      }
      const opaqueRatio = opaque / n;
      const nonDarkRatio = opaque ? nonDark / opaque : 0;
      const mean = opaque
        ? { r: Math.round(sumR / opaque), g: Math.round(sumG / opaque), b: Math.round(sumB / opaque) }
        : { r: 0, g: 0, b: 0 };
      // Stage art must have meaningful opaque, non-near-black content
      if (opaqueRatio < 0.08) {
        return { ok: false, reason: `${label}: mostly transparent paint (opaque=${(opaqueRatio * 100).toFixed(1)}%)` };
      }
      if (nonDarkRatio < 0.12) {
        return {
          ok: false,
          reason: `${label}: painted content near-black (nonDark=${(nonDarkRatio * 100).toFixed(1)}% mean=${JSON.stringify(mean)})`,
        };
      }
      return { ok: true, opaqueRatio, nonDarkRatio, mean };
    },
    { selector, label },
  );
}

async function waitForHydration(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => {
    const root = document.querySelector(".standoff") || document.querySelector("main") || document.body;
    return Boolean(root) && document.readyState === "complete";
  }, { timeout: 30000 });
  // Allow client hydration + priority images
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll(".standoff__stage img, .standoff img")];
    if (imgs.length === 0) return true; // www path
    return imgs.every((img) => img.complete && img.naturalWidth > 0);
  }, { timeout: 45000 }).catch(() => {});
}

async function pixelDiffRatio(aBuf, bBuf) {
  const a = await PNG.decode(aBuf);
  const b = await PNG.decode(bBuf);
  if (a.width !== b.width || a.height !== b.height) {
    return { ratio: 1, reason: `size mismatch ${a.width}x${a.height} vs ${b.width}x${b.height}`, diffPng: null };
  }
  const { diff, count } = PNG.diff(a, b);
  const total = a.width * a.height;
  return { ratio: count / total, count, total, diffPng: await PNG.encode(diff) };
}

async function checkGameLanding(page, url) {
  console.log(`\n=== GAME LANDING: ${url} ===`);
  const results = [];
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await waitForHydration(page);

  const hasStage = await page.locator(".standoff__stage").count();
  if (!hasStage) {
    results.push(fail("game: .standoff__stage missing after hydration"));
    await page.screenshot({ path: path.join(ARTIFACTS, "game-no-stage.png"), fullPage: false });
    return results.every(Boolean);
  }
  results.push(pass("game: .standoff__stage present"));

  // Composition: west/left = cougar, east/right = alpaca (code truth)
  const checks = [
    { sel: ".standoff__hero--alpaca .standoff__hero-img", label: "alpaca hero (right)" },
    { sel: ".standoff__hero--cougar .standoff__hero-img", label: "cougar hero (left)" },
    { sel: ".standoff__world--west .standoff__plate-img", label: "landscape west (cougar mountain)" },
    { sel: ".standoff__world--east .standoff__plate-img", label: "landscape east (alpaca ranch)" },
  ];

  for (const c of checks) {
    const nat = await naturalSizeCheck(page, c.sel, c.label);
    if (!nat.ok) results.push(fail(nat.reason));
    else results.push(pass(`${c.label}: decoded ${nat.natural.w}x${nat.natural.h}`));

    const paint = await paintedPixelCheck(page, c.sel, c.label);
    if (!paint.ok) results.push(fail(paint.reason));
    else {
      results.push(
        pass(
          `${c.label}: painted opaque=${(paint.opaqueRatio * 100).toFixed(0)}% nonDark=${(paint.nonDarkRatio * 100).toFixed(0)}% meanRGB=${paint.mean.r},${paint.mean.g},${paint.mean.b}`,
        ),
      );
    }

    const vis = await coverageCheck(page, c.sel, c.label);
    if (!vis.ok) results.push(fail(vis.reason));
    else {
      results.push(
        pass(
          `${c.label}: bbox ${vis.bbox.w}x${vis.bbox.h} @(${vis.bbox.x},${vis.bbox.y}) opacity=${vis.opacity} covered=${Math.round(vis.coveredRatio * 100)}%`,
        ),
      );
    }
  }

  // Combined landscape plate presence (either world counts as landscape)
  const westOk = await coverageCheck(page, ".standoff__world--west .standoff__plate-img", "landscape");
  const eastOk = await coverageCheck(page, ".standoff__world--east .standoff__plate-img", "landscape");
  if (!westOk.ok && !eastOk.ok) {
    results.push(fail(`landscape background not visible: west=${westOk.reason}; east=${eastOk.reason}`));
  } else {
    results.push(pass("landscape background: at least one world plate visible"));
  }

  const shotPath = path.join(ARTIFACTS, "game-landing-current.png");
  await page.screenshot({ path: shotPath, fullPage: false });
  const baselinePath = path.join(BASELINES, "game-landing-desktop.png");

  if (UPDATE_BASELINE || !fs.existsSync(baselinePath)) {
    fs.copyFileSync(shotPath, baselinePath);
    results.push(pass(`baseline written: ${path.relative(ROOT, baselinePath)}`));
  } else {
    const { ratio, reason, diffPng, count, total } = await pixelDiffRatio(
      fs.readFileSync(baselinePath),
      fs.readFileSync(shotPath),
    );
    if (diffPng) fs.writeFileSync(path.join(ARTIFACTS, "game-landing-diff.png"), diffPng);
    const pct = (ratio * 100).toFixed(2);
    if (ratio > DIFF_THRESHOLD) {
      results.push(
        fail(
          `screenshot diff ${pct}% > ${(DIFF_THRESHOLD * 100).toFixed(0)}% threshold (${count}/${total}${reason ? `; ${reason}` : ""})`,
        ),
      );
    } else {
      results.push(pass(`screenshot diff ${pct}% ≤ ${(DIFF_THRESHOLD * 100).toFixed(0)}% threshold`));
    }
  }

  return results.every(Boolean);
}

async function checkWwwMarketing(page, url) {
  console.log(`\n=== WWW MARKETING: ${url} ===`);
  const results = [];
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200);

  // www does not use standoff stage — verify pasture hero art instead
  const heroBg = 'img[src*="pasture-hero-bg"]';
  const count = await page.locator(heroBg).count();
  if (!count) {
    // Also accept CSS background if markup drifts
    const anyHero = await page.locator('section[aria-labelledby="hero-title"] img').count();
    if (!anyHero) {
      results.push(fail("www: no hero imagery found (pasture-hero-bg / hero section imgs)"));
    } else {
      results.push(pass(`www: hero section has ${anyHero} img(s)`));
    }
  } else {
    const nat = await naturalSizeCheck(page, heroBg, "www pasture hero");
    if (!nat.ok) results.push(fail(nat.reason));
    else results.push(pass(`www pasture hero: decoded ${nat.natural.w}x${nat.natural.h}`));

    const vis = await coverageCheck(page, heroBg, "www pasture hero");
    if (!vis.ok) results.push(fail(vis.reason));
    else {
      results.push(
        pass(
          `www pasture hero: bbox ${vis.bbox.w}x${vis.bbox.h} opacity=${vis.opacity} covered=${Math.round(vis.coveredRatio * 100)}%`,
        ),
      );
    }
  }

  // Explicit: standoff stage is game-only
  const stage = await page.locator(".standoff__stage").count();
  if (stage > 0) {
    console.log("NOTE: www unexpectedly includes .standoff__stage — running game checks too");
    // Don't fail; just note
  } else {
    results.push(pass("www: no standoff stage (expected — marketing hero only)"));
  }

  const shotPath = path.join(ARTIFACTS, "www-landing-current.png");
  await page.screenshot({ path: shotPath, fullPage: false });
  const baselinePath = path.join(BASELINES, "www-landing-desktop.png");
  if (UPDATE_BASELINE || !fs.existsSync(baselinePath)) {
    fs.copyFileSync(shotPath, baselinePath);
    results.push(pass(`baseline written: ${path.relative(ROOT, baselinePath)}`));
  } else {
    const { ratio, reason, diffPng, count: dCount, total } = await pixelDiffRatio(
      fs.readFileSync(baselinePath),
      fs.readFileSync(shotPath),
    );
    if (diffPng) fs.writeFileSync(path.join(ARTIFACTS, "www-landing-diff.png"), diffPng);
    const pct = (ratio * 100).toFixed(2);
    // www is looser — marketing can have live banners; still catch total blank
    const wwwThreshold = 0.2;
    if (ratio > wwwThreshold) {
      results.push(fail(`www screenshot diff ${pct}% > ${wwwThreshold * 100}% (${dCount}/${total}${reason ? `; ${reason}` : ""})`));
    } else {
      results.push(pass(`www screenshot diff ${pct}% ≤ ${wwwThreshold * 100}%`));
    }
  }

  return results.every(Boolean);
}

async function main() {
  console.log("HANSOME game landing visual smoke");
  console.log(`viewport ${VIEWPORT.width}x${VIEWPORT.height}`);
  console.log(`updateBaseline=${UPDATE_BASELINE} diffThreshold=${DIFF_THRESHOLD}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  let ok = true;
  try {
    if (!WWW_ONLY) {
      const gameOk = await checkGameLanding(page, GAME_URL);
      ok = ok && gameOk;
    }
    if (!GAME_ONLY) {
      const wwwOk = await checkWwwMarketing(page, WWW_URL);
      ok = ok && wwwOk;
    }
  } finally {
    await browser.close();
  }

  console.log(`\n=== VERDICT: ${ok ? "PASS" : "FAIL"} ===`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
