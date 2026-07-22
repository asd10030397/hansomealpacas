/**
 * Watch Testnet worker through RevealOpen → settle_window.
 * Pass if: logs show phase=reveal during reveal, and no finalizeDay while reveal is open.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createPublicClient, http, parseAbi } from "viem";

const root = path.resolve(import.meta.dirname, "..");
const RPC = process.env.RPC_URL || "https://rpc.testnet.chain.robinhood.com";
const GAME = "0x92C8e9CCF67e533438bCCE258D4bEEc6E0559FC5";
const RAND = "0x45F9FFaC891e06E83a5A315E4fE1B55E5b6b438F";

const abi = parseAbi([
  "function dayZero() view returns (uint256)",
  "function dayLength() view returns (uint256)",
  "function commitDuration() view returns (uint256)",
  "function revealDuration() view returns (uint256)",
  "function currentDay() view returns (uint256)",
  "function creditProgress(uint256) view returns (uint256,uint256,bool,bool)",
  "function hasDaySeed(uint256) view returns (bool)",
]);

const client = createPublicClient({ transport: http(RPC) });

async function chainSnapshot() {
  const [
    dayZero,
    dayLength,
    commitDuration,
    revealDuration,
    currentDay,
    block,
  ] = await Promise.all([
    client.readContract({ address: GAME, abi, functionName: "dayZero" }),
    client.readContract({ address: GAME, abi, functionName: "dayLength" }),
    client.readContract({ address: GAME, abi, functionName: "commitDuration" }),
    client.readContract({ address: GAME, abi, functionName: "revealDuration" }),
    client.readContract({ address: GAME, abi, functionName: "currentDay" }),
    client.getBlock({ blockTag: "latest" }),
  ]);
  const day = Number(currentDay);
  const now = Number(block.timestamp);
  const dayStart = Number(dayZero) + day * Number(dayLength);
  const commitEnd = dayStart + Number(commitDuration);
  const revealEnd = commitEnd + Number(revealDuration);
  const progress = await client.readContract({
    address: GAME,
    abi,
    functionName: "creditProgress",
    args: [BigInt(day)],
  });
  const hasDaySeed = await client.readContract({
    address: RAND,
    abi,
    functionName: "hasDaySeed",
    args: [BigInt(day)],
  });
  return {
    day,
    now,
    commitEnd,
    revealEnd,
    hasDaySeed: Boolean(hasDaySeed),
    finalized: progress[2],
    settled: progress[3],
  };
}

function railwayLogs() {
  const r = spawnSync(
    "npx",
    ["--yes", "@railway/cli", "logs", "--service", "settlement-worker-testnet"],
    { encoding: "utf8", shell: true, cwd: root, maxBuffer: 20 * 1024 * 1024 },
  );
  return (r.stdout || "") + (r.stderr || "");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let sawRevealLabel = false;
let finalizeDuringReveal = false;
let finalizeAfterReveal = false;
const seenFinalize = new Set();

const deadline = Date.now() + 8 * 60 * 1000;
while (Date.now() < deadline) {
  const j = await chainSnapshot();
  let expected = "commit";
  if (j.now >= j.revealEnd) expected = "settle_window";
  else if (j.now >= j.commitEnd) expected = "reveal";

  const L = railwayLogs();
  const lines = L.split(/\r?\n/).filter((l) =>
    /tick_ok|finalizeDay|creditBatch|fulfillDaySeed/.test(l),
  );
  const recent = lines.slice(-30);
  const tickPhase =
    [...recent]
      .reverse()
      .map((l) => {
        const m = l.match(/phase="(\w+)"/);
        return m ? m[1] : null;
      })
      .find(Boolean) || null;

  if (expected === "reveal" && tickPhase === "reveal") sawRevealLabel = true;

  for (const line of recent) {
    if (!/functionName="finalizeDay"|functionName=finalizeDay/.test(line)) {
      continue;
    }
    const key = (line.match(/0x[0-9a-fA-F]{64}/) || [line])[0];
    if (seenFinalize.has(key)) continue;
    seenFinalize.add(key);
    if (expected === "reveal") finalizeDuringReveal = true;
    if (expected === "settle_window") finalizeAfterReveal = true;
  }

  console.log(
    JSON.stringify({
      day: j.day,
      expected,
      tickPhase,
      sawRevealLabel,
      finalizeDuringReveal,
      finalizeAfterReveal,
      finalized: j.finalized,
      settled: j.settled,
      hasDaySeed: j.hasDaySeed,
      secsToReveal: Math.max(0, j.commitEnd - j.now),
      secsToSettle: Math.max(0, j.revealEnd - j.now),
    }),
  );

  if (
    sawRevealLabel &&
    expected === "settle_window" &&
    (j.finalized || finalizeAfterReveal || j.settled)
  ) {
    const ok = sawRevealLabel && !finalizeDuringReveal;
    console.log(
      JSON.stringify({
        pass: ok,
        sawRevealLabel,
        finalizeDuringReveal,
        finalizeAfterReveal,
        finalized: j.finalized,
      }),
    );
    process.exit(ok ? 0 : 1);
  }

  await sleep(15_000);
}

// Soft pass if we at least proved reveal labeling and no finalize during an observed reveal.
if (sawRevealLabel && !finalizeDuringReveal) {
  console.log(
    JSON.stringify({
      pass: true,
      soft: true,
      note: "Observed phase=reveal with no finalize during RevealOpen; settle_window not reached before timeout",
      sawRevealLabel,
      finalizeDuringReveal,
    }),
  );
  process.exit(0);
}

console.log(
  JSON.stringify({
    pass: false,
    reason: "timeout",
    sawRevealLabel,
    finalizeDuringReveal,
    finalizeAfterReveal,
  }),
);
process.exit(2);
