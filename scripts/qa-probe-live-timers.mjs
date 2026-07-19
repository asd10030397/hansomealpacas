/**
 * Probe live game host for contract address + timer wiring.
 * Usage: node scripts/qa-probe-live-timers.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { createPublicClient, http, parseAbi, formatEther } from "viem";

const base = (process.argv[2] || "https://game.hansomealpacas.xyz").replace(/\/$/, "");
const EXPECTED_GAME = "0xa807b2E830B6ED9Fb2ECc215eC995C4dD0F736B5";
const RPC = "https://rpc.testnet.chain.robinhood.com";

async function probeChain(address) {
  const c = createPublicClient({ transport: http(RPC) });
  const abi = parseAbi([
    "function dayZero() view returns (uint256)",
    "function dayLength() view returns (uint256)",
    "function commitDuration() view returns (uint256)",
    "function revealDuration() view returns (uint256)",
    "function currentDay() view returns (uint256)",
    "function dayState(uint256) view returns (uint8)",
  ]);
  try {
    const [dayZero, dayLength, commitDuration, revealDuration, currentDay] =
      await Promise.all([
        c.readContract({ address, abi, functionName: "dayZero" }),
        c.readContract({ address, abi, functionName: "dayLength" }),
        c.readContract({ address, abi, functionName: "commitDuration" }),
        c.readContract({ address, abi, functionName: "revealDuration" }),
        c.readContract({ address, abi, functionName: "currentDay" }),
      ]);
    const state = await c.readContract({
      address,
      abi,
      functionName: "dayState",
      args: [currentDay],
    });
    return {
      ok: true,
      dayZero: Number(dayZero),
      dayLength: Number(dayLength),
      commitDuration: Number(commitDuration),
      revealDuration: Number(revealDuration),
      currentDay: Number(currentDay),
      dayState: Number(state),
    };
  } catch (e) {
    return { ok: false, error: String(e.shortMessage || e.message || e).slice(0, 240) };
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  page.on("console", (msg) => {
    const t = msg.text();
    if (/GAME_|hansome|commit|duration|0xa807|0x84f7|0x0c7a/i.test(t)) logs.push(t.slice(0, 300));
  });

  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(3000);

  const html = await page.content();
  const bodyText = await page.locator("body").innerText();

  const injected = await page.evaluate(() => {
    const scripts = [...document.querySelectorAll("script[src]")].map((s) => s.src);
    return {
      href: location.href,
      scripts: scripts.filter((s) => s.includes("/_next/static")),
      envFromWindow: {
        // Next inlines NEXT_PUBLIC_* at build time into chunks; try common globals
        nextData: window.__NEXT_DATA__?.runtimeConfig || null,
      },
    };
  });

  // Pull a few JS chunks and search for addresses / duration literals
  const chunkHits = { addresses: new Set(), durations: {} };
  for (const src of injected.scripts.slice(0, 40)) {
    try {
      const r = await fetch(src, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) continue;
      const js = await r.text();
      for (const m of js.matchAll(/0x[a-fA-F0-9]{40}/g)) {
        const a = m[0].toLowerCase();
        if (
          a.includes("a807b2e") ||
          a.startsWith("0x84f719") ||
          a.startsWith("0x0c7adf") ||
          a.startsWith("0x43c1d6")
        ) {
          chunkHits.addresses.add(m[0]);
        }
      }
      if (js.includes("43200")) chunkHits.durations.has43200 = true;
      if (js.includes("72000")) chunkHits.durations.has72000 = true;
      if (js.includes("14400")) chunkHits.durations.has14400 = true;
      if (js.includes("86400")) chunkHits.durations.has86400 = true;
      // look for explicit assignment patterns near COMMIT
      const m120 = js.match(/COMMIT_DURATION[^0-9]{0,40}(120)\b/);
      const m43200 = js.match(/COMMIT_DURATION[^0-9]{0,40}(43200)\b/);
      const m72000 = js.match(/COMMIT_DURATION[^0-9]{0,40}(72000)\b/);
      if (m120) chunkHits.durations.commitLiteral = 120;
      if (m43200) chunkHits.durations.commitLiteral = 43200;
      if (m72000) chunkHits.durations.commitLiteral = 72000;
      const d240 = js.match(/DAY_LENGTH[^0-9]{0,40}(240)\b/);
      const d86400 = js.match(/DAY_LENGTH[^0-9]{0,40}(86400)\b/);
      if (d240) chunkHits.durations.dayLiteral = 240;
      if (d86400) chunkHits.durations.dayLiteral = 86400;
    } catch {
      /* ignore */
    }
  }

  // Read UI timer labels
  const timerBits = {
    hasCommitEndsIn: /Commit ends in/i.test(bodyText),
    hasSettlementIn: /Settlement in/i.test(bodyText),
    hasCommitWindow: /Commit window/i.test(bodyText),
    countdownMatches: [...bodyText.matchAll(/(\d{2}:\d{2}:\d{2})/g)].map((m) => m[1]).slice(0, 8),
    phaseSnippet: (bodyText.match(/Current Phase[\s\S]{0,80}/i) || [""])[0].slice(0, 80),
  };

  const addresses = [...chunkHits.addresses];
  const gameAddr =
    addresses.find((a) => a.toLowerCase() === EXPECTED_GAME.toLowerCase()) ||
    addresses.find((a) => a.toLowerCase().startsWith("0xa807")) ||
    addresses.find((a) => a.toLowerCase().startsWith("0x84f7")) ||
    addresses.find((a) => a.toLowerCase().startsWith("0x0c7a")) ||
    null;

  const chain = gameAddr ? await probeChain(gameAddr) : { ok: false, error: "no game address in bundles" };
  // Also probe expected regardless
  const expectedChain = await probeChain(EXPECTED_GAME);

  console.log(
    JSON.stringify(
      {
        base,
        finalUrl: injected.href,
        expectedGame: EXPECTED_GAME,
        gameAddressInBundles: gameAddr,
        allRelevantAddresses: addresses,
        durationLiteralsInBundles: chunkHits.durations,
        ui: timerBits,
        chainForBundledGame: chain,
        chainForExpectedGame: expectedChain,
        htmlHints: {
          has43200: html.includes("43200"),
          has72000: html.includes("72000"),
          has120nearCommit: /commit[^]{0,80}120/i.test(html),
        },
        consoleLogs: logs.slice(0, 20),
      },
      null,
      2,
    ),
  );

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
