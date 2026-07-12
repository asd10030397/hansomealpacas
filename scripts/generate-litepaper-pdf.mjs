/**
 * Generates printable English + Traditional Chinese PDF versions of
 * /litepaper by rendering the real production page (same layout, same
 * copy, same components as the live site) and printing it to PDF.
 *
 * Usage:
 *   npm run generate:litepaper-pdf
 *
 * Requires `playwright` (fetched on demand via npx) and a production
 * build. Spins up its own `next start` on an ephemeral port, generates
 * both PDFs into public/docs/, then shuts the server back down — safe to
 * re-run any time the litepaper content changes.
 */
import { spawn, execSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(rootDir, "public", "docs");

const LOCALES = [
  { code: "en", file: "litepaper-en.pdf" },
  { code: "zh", file: "litepaper-zh.pdf" },
];

/** Picks a genuinely free OS-assigned port instead of a hardcoded one, so
 * this never silently reuses a stale, possibly out-of-date server left
 * running on a fixed port from a previous run. */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(url, serverProcess, timeoutMs = 60_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    let settled = false;
    const onExit = (code) => {
      if (settled) return;
      settled = true;
      reject(new Error(`next start exited early (code ${code}) before becoming ready — see [next] logs above`));
    };
    serverProcess.once("exit", onExit);

    const tick = async () => {
      if (settled) return;
      try {
        const res = await fetch(url);
        if (res.ok) {
          settled = true;
          serverProcess.off("exit", onExit);
          return resolve();
        }
      } catch {
        /* not up yet */
      }
      if (Date.now() - start > timeoutMs) {
        settled = true;
        serverProcess.off("exit", onExit);
        reject(new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

async function main() {
  if (!existsSync(path.join(rootDir, ".next"))) {
    console.log("No .next build found — running `next build` first...");
    await new Promise((resolve, reject) => {
      const build = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "build"], {
        cwd: rootDir,
        stdio: "inherit",
      });
      build.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`next build exited ${code}`))));
    });
  }

  await mkdir(OUT_DIR, { recursive: true });

  const PORT = process.env.LITEPAPER_PDF_PORT ?? String(await getFreePort());
  const BASE_URL = `http://127.0.0.1:${PORT}`;

  console.log(`Starting production server on ${BASE_URL} ...`);
  const server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-p", PORT], {
    cwd: rootDir,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => process.stdout.write(`[next] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[next] ${chunk}`));

  try {
    await waitForServer(`${BASE_URL}/litepaper`, server);
    console.log("Server ready. Launching Playwright...");

    const { chromium } = await import("playwright");
    const browser = await chromium.launch();

    for (const locale of LOCALES) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.addInitScript((code) => {
        try {
          window.localStorage.setItem("hansomealpacas:locale", code);
        } catch {
          /* ignore */
        }
      }, locale.code);

      await page.goto(`${BASE_URL}/litepaper`, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);

      // Every section fades in on scroll (IntersectionObserver-driven), which
      // never fires for content that's never scrolled into the live
      // viewport. Walk the whole page once so every section's "whileInView"
      // animation triggers and settles to its final, fully-visible state
      // before we snapshot it to PDF.
      await page.evaluate(async () => {
        // `html { scroll-behavior: smooth }` in globals.css would otherwise
        // animate (and coalesce/skip) these rapid programmatic scrolls —
        // force instant jumps so every section actually passes through the
        // viewport and its IntersectionObserver fires.
        const step = 500;
        const delayMs = 120;
        const height = document.body.scrollHeight;
        for (let y = 0; y < height; y += step) {
          window.scrollTo({ top: y, left: 0, behavior: "instant" });
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      });
      await page.waitForTimeout(600);

      await page.emulateMedia({ media: "print" });
      await page.waitForTimeout(500);

      const outPath = path.join(OUT_DIR, locale.file);
      await page.pdf({
        path: outPath,
        format: "A4",
        printBackground: true,
        margin: { top: "18mm", bottom: "18mm", left: "14mm", right: "14mm" },
      });
      console.log(`Wrote ${outPath}`);
      await page.close();
    }

    await browser.close();
  } finally {
    if (process.platform === "win32" && server.pid) {
      try {
        execSync(`taskkill /F /T /PID ${server.pid}`, { stdio: "ignore" });
      } catch {
        /* already gone */
      }
    } else {
      server.kill();
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
