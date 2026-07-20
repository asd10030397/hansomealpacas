/**
 * Probe live game host for contract address + timer wiring.
 * Usage:
 *   NEXT_PUBLIC_HANSOME_GAME_ADDRESS=0x92C8… GAME_RPC_URL=… node scripts/qa-probe-live-timers.mjs [baseUrl]
 *
 * Fail-closed: missing/invalid address, RPC, or chainId mismatch aborts.
 */
import { chromium } from "playwright";
import { createPublicClient, http, parseAbi, isAddress, getAddress } from "viem";

const EXPECTED_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_GAME_CHAIN_ID || process.env.EXPECTED_CHAIN_ID || 46630,
);

const rawGame =
  process.env.NEXT_PUBLIC_HANSOME_GAME_ADDRESS?.trim() ||
  process.env.HANSOME_GAME_ADDRESS?.trim() ||
  "";

const RPC =
  process.env.GAME_RPC_URL?.trim() ||
  process.env.NEXT_PUBLIC_GAME_RPC_URL?.trim() ||
  "";

const base = (process.argv[2] || "https://game.hansomealpacas.xyz").replace(
  /\/$/,
  "",
);

function rpcHostname(url) {
  try {
    return new URL(url).host;
  } catch {
    return "(invalid-rpc-url)";
  }
}

function fail(msg) {
  console.error(`[qa-probe-live-timers] FAIL: ${msg}`);
  process.exit(1);
}

if (!rawGame) {
  fail("Set NEXT_PUBLIC_HANSOME_GAME_ADDRESS (or HANSOME_GAME_ADDRESS).");
}
if (!isAddress(rawGame)) {
  fail(`Invalid game address: ${rawGame}`);
}
const EXPECTED_GAME = getAddress(rawGame);
if (!RPC) {
  fail("Set GAME_RPC_URL or NEXT_PUBLIC_GAME_RPC_URL.");
}

async function probeChain(address) {
  const c = createPublicClient({ transport: http(RPC) });
  const chainIdHex = await c.request({ method: "eth_chainId" });
  const chainId = Number(chainIdHex);
  if (chainId !== EXPECTED_CHAIN_ID) {
    fail(
      `chainId mismatch: got ${chainId}, expected ${EXPECTED_CHAIN_ID} (Robinhood Testnet).`,
    );
  }
  const code = await c.getBytecode({ address });
  if (!code || code === "0x") {
    fail(`No contract bytecode at ${address}`);
  }

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
    const block = await c.getBlockNumber();
    return {
      ok: true,
      chainId,
      rpcHost: rpcHostname(RPC),
      game: address,
      blockNumber: Number(block),
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
  console.log("[qa-probe-live-timers] config", {
    chainId: EXPECTED_CHAIN_ID,
    rpcHost: rpcHostname(RPC),
    game: EXPECTED_GAME,
    baseUrl: base,
  });

  const chainProbe = await probeChain(EXPECTED_GAME);
  if (!chainProbe.ok) {
    fail(chainProbe.error || "chain probe failed");
  }
  console.log("[qa-probe-live-timers] on-chain", chainProbe);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  page.on("console", (msg) => {
    const t = msg.text();
    if (/GAME_|hansome|commit|duration|0x92c8/i.test(t)) logs.push(t.slice(0, 300));
  });

  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(3000);

  const bodyText = await page.locator("body").innerText();
  const html = await page.content();

  const injected = await page.evaluate(() => {
    const scripts = [...document.querySelectorAll("script[src]")].map((s) => s.src);
    return {
      href: location.href,
      scripts: scripts.filter((s) => s.includes("/_next/static")),
    };
  });

  const chunkHits = { addresses: new Set(), durations: {} };
  for (const src of injected.scripts.slice(0, 40)) {
    try {
      const res = await fetch(src);
      const text = await res.text();
      const re = /0x[a-fA-F0-9]{40}/g;
      let m;
      while ((m = re.exec(text))) {
        chunkHits.addresses.add(m[0]);
      }
      for (const key of ["commitDuration", "revealDuration", "dayLength"]) {
        const dm = text.match(new RegExp(`${key}[^0-9]{0,40}(\\d{2,})`));
        if (dm) chunkHits.durations[key] = dm[1];
      }
    } catch {
      /* ignore chunk fetch errors */
    }
  }

  const gameInChunks = [...chunkHits.addresses].some(
    (a) => a.toLowerCase() === EXPECTED_GAME.toLowerCase(),
  );

  console.log(
    JSON.stringify(
      {
        base,
        expectedGame: EXPECTED_GAME,
        gameInChunks,
        chainProbe,
        bodySnippet: bodyText.slice(0, 400),
        consoleHits: logs.slice(0, 20),
        durationHints: chunkHits.durations,
        addressSample: [...chunkHits.addresses].slice(0, 12),
        htmlHasExpected: html.toLowerCase().includes(EXPECTED_GAME.toLowerCase()),
      },
      null,
      2,
    ),
  );

  await browser.close();
  if (!gameInChunks && !html.toLowerCase().includes(EXPECTED_GAME.toLowerCase())) {
    console.warn(
      "[qa-probe-live-timers] WARN: canonical game address not found in page chunks (build may still be on old env).",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
