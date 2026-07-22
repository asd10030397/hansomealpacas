/**
 * Boot Mainnet worker in DRY_RUN with env from process + optional .env.mainnet.
 * Refuses if SEED/SETTLER do not resolve to the locked provider address.
 *
 *   WORKER_MAINNET_PRIVATE_KEY=0x... node scripts/boot-mainnet-dry-run.mjs
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http, parseAbi, formatEther } from "viem";
import dotenv from "dotenv";

const root = path.resolve(import.meta.dirname, "..");
const LOCKED = "0x4D68639a5e3ad8fD268f801862D464259656Fd6c";
const RAND = "0x134f3CE4006a04C2C5DaD0E654d1C4228dd15791";
const GAME = "0xb8dad421881171f4485523d109C94dc650ecB7Eb";

const envPath = path.join(root, ".env.mainnet");
const dotenvResult = dotenv.config({ path: envPath });

/** Strip surrounding quotes + whitespace. Never log the value. */
function normalizeSecret(raw) {
  if (raw == null) return "";
  let s = String(raw).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function classifySecret(raw) {
  if (raw == null || String(raw).trim() === "") return "missing";
  const original = String(raw);
  const trimmed = original.trim();
  const quoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"));
  const s = normalizeSecret(raw);
  if (!s) return quoted ? "quoted string" : "missing";
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return "looks like an address";
  if (/^([a-z]+(\s+|$)){11,24}$/i.test(s) && s.split(/\s+/).length >= 12) {
    return "looks like a mnemonic";
  }
  if (quoted) {
    // still classify after unquote
  }
  const hex = s.startsWith("0x") || s.startsWith("0X") ? s : `0x${s}`;
  if (!/^0x[0-9a-fA-F]+$/i.test(hex)) {
    if (quoted) return "quoted string";
    return "malformed";
  }
  if (hex.length !== 66) return "wrong length";
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) return "malformed";
  if (quoted) return "quoted string"; // valid hex but was quoted — note for user
  return "ok";
}

function secretReport(name, raw) {
  const normalized = normalizeSecret(raw);
  const hex =
    !normalized
      ? ""
      : normalized.startsWith("0x") || normalized.startsWith("0X")
        ? `0x${normalized.slice(2)}`
        : `0x${normalized}`;
  const classif = classifySecret(raw);
  return {
    name,
    loaded: Boolean(raw != null && String(raw).trim() !== ""),
    length: raw == null ? 0 : String(raw).length,
    lengthAfterTrim: normalized.length,
    matchesStrictHex: /^0x[0-9a-fA-F]{64}$/.test(hex),
    classification: classif,
  };
}

const seedRaw = process.env.SEED_PRIVATE_KEY;
const settlerRaw = process.env.SETTLER_PRIVATE_KEY;
const workerRaw = process.env.WORKER_MAINNET_PRIVATE_KEY;

const diagnostics = {
  dotenv: {
    path: envPath,
    fileExists: existsSync(envPath),
    error: dotenvResult.error ? String(dotenvResult.error.message) : null,
    parsedKeyCount: dotenvResult.parsed
      ? Object.keys(dotenvResult.parsed).length
      : 0,
    loadedSeedFromFile: Boolean(dotenvResult.parsed?.SEED_PRIVATE_KEY),
    loadedSettlerFromFile: Boolean(dotenvResult.parsed?.SETTLER_PRIVATE_KEY),
    loadedWorkerFromFile: Boolean(
      dotenvResult.parsed?.WORKER_MAINNET_PRIVATE_KEY,
    ),
  },
  SEED_PRIVATE_KEY: secretReport("SEED_PRIVATE_KEY", seedRaw),
  SETTLER_PRIVATE_KEY: secretReport("SETTLER_PRIVATE_KEY", settlerRaw),
  WORKER_MAINNET_PRIVATE_KEY: secretReport(
    "WORKER_MAINNET_PRIVATE_KEY",
    workerRaw,
  ),
  selection: {
    prefersWorkerMainnetFirst: true,
    note: "Script uses WORKER_MAINNET_PRIVATE_KEY || SEED_PRIVATE_KEY || SETTLER_PRIVATE_KEY",
  },
};

const selectedSource = workerRaw?.trim()
  ? "WORKER_MAINNET_PRIVATE_KEY"
  : seedRaw?.trim()
    ? "SEED_PRIVATE_KEY"
    : settlerRaw?.trim()
      ? "SETTLER_PRIVATE_KEY"
      : null;

diagnostics.selection.selectedSource = selectedSource;
diagnostics.selection.accidentallyPreferWorker = Boolean(workerRaw?.trim());

console.log(JSON.stringify({ diagnostics }, null, 2));

const rawSelected =
  normalizeSecret(workerRaw) ||
  normalizeSecret(seedRaw) ||
  normalizeSecret(settlerRaw) ||
  "";

if (!rawSelected) {
  console.log(
    JSON.stringify({
      pass: false,
      fail: "MISSING_KEY",
      classification: "missing",
      detail: "No SEED_PRIVATE_KEY / SETTLER_PRIVATE_KEY / WORKER_MAINNET_PRIVATE_KEY",
    }),
  );
  process.exit(2);
}

const hex = (
  rawSelected.startsWith("0x") || rawSelected.startsWith("0X")
    ? `0x${rawSelected.slice(2)}`
    : `0x${rawSelected}`
);

if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
  console.log(
    JSON.stringify({
      pass: false,
      fail: "INVALID_KEY_SHAPE",
      classification: classifySecret(
        workerRaw || seedRaw || settlerRaw || "",
      ),
      whyPrivateKeyToAccountWouldThrow:
        "viem privateKeyToAccount requires a 32-byte hex private key as 0x + 64 hex chars. Input failed that shape check.",
    }),
  );
  process.exit(2);
}

let account;
try {
  account = privateKeyToAccount(hex);
} catch (e) {
  console.log(
    JSON.stringify({
      pass: false,
      fail: "PRIVATE_KEY_TO_ACCOUNT_THROW",
      classification: classifySecret(workerRaw || seedRaw || settlerRaw || ""),
      errorName: e instanceof Error ? e.name : "Error",
      errorMessageSafe: e instanceof Error ? e.message.replace(/0x[0-9a-fA-F]+/g, "0x[REDACTED]") : "unknown",
      whyPrivateKeyToAccountThrows:
        "Hex shape passed local regex but viem rejected it (invalid secp256k1 scalar or internal hex parse).",
    }),
  );
  process.exit(2);
}

if (account.address.toLowerCase() !== LOCKED.toLowerCase()) {
  console.log(
    JSON.stringify({
      pass: false,
      fail: "KEY_ADDRESS_MISMATCH",
      derived: account.address,
      expected: LOCKED,
    }),
  );
  process.exit(2);
}

const client = createPublicClient({
  transport: http("https://rpc.mainnet.chain.robinhood.com"),
});
const chainId = await client.getChainId();
if (chainId !== 4663) {
  console.log(JSON.stringify({ pass: false, fail: "WRONG_CHAIN", chainId }));
  process.exit(2);
}

const abi = parseAbi([
  "function randomnessProvider() view returns (address)",
  "function dayZero() view returns (uint256)",
  "function dayLength() view returns (uint256)",
  "function commitDuration() view returns (uint256)",
  "function revealDuration() view returns (uint256)",
  "function currentDay() view returns (uint256)",
  "function hasDaySeed(uint256) view returns (bool)",
  "function creditProgress(uint256) view returns (uint256,uint256,bool,bool)",
]);
const provider = await client.readContract({
  address: RAND,
  abi,
  functionName: "randomnessProvider",
});
if (provider.toLowerCase() !== LOCKED.toLowerCase()) {
  console.log(
    JSON.stringify({
      pass: false,
      fail: "ONCHAIN_PROVIDER_MISMATCH",
      provider,
      expected: LOCKED,
    }),
  );
  process.exit(2);
}

const bal = await client.getBalance({ address: LOCKED });
const dayZero = Number(
  await client.readContract({ address: GAME, abi, functionName: "dayZero" }),
);
const dayLength = Number(
  await client.readContract({ address: GAME, abi, functionName: "dayLength" }),
);
const commitDuration = Number(
  await client.readContract({
    address: GAME,
    abi,
    functionName: "commitDuration",
  }),
);
const revealDuration = Number(
  await client.readContract({
    address: GAME,
    abi,
    functionName: "revealDuration",
  }),
);
const currentDay = Number(
  await client.readContract({ address: GAME, abi, functionName: "currentDay" }),
);
const now = Number((await client.getBlock({ blockTag: "latest" })).timestamp);
const dayStart = dayZero + currentDay * dayLength;
const commitEnd = dayStart + commitDuration;
const revealEnd = commitEnd + revealDuration;
let phase = "before_day_zero";
if (now >= dayZero) {
  if (now < commitEnd) phase = "commit";
  else if (now < revealEnd) phase = "reveal";
  else phase = "settle_window";
}

const ns = "hansome:settle:v1:mainnet:4663";
const logDir = path.join(root, "logs", "mainnet");
mkdirSync(logDir, { recursive: true });

console.log(
  JSON.stringify(
    {
      preflight: "ok",
      wallet: account.address,
      eth: formatEther(bal),
      chainId,
      currentDay,
      phase,
      redisNamespace: ns,
      dryRun: true,
      plannedActions:
        now < dayZero
          ? ["noop_until_day_zero", "after_day_zero: dry_run seed/finalize/credit when phase allows"]
          : ["dry_run_plan_from_phase"],
      note: "Using existing .env.mainnet (not overwritten). Starting local dry-run worker.",
    },
    null,
    2,
  ),
);

if (!existsSync(path.join(root, "dist", "index.js"))) {
  console.error("dist/ missing — run npm run build first");
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ["--env-file=.env.mainnet", "dist/index.js"],
  {
    cwd: root,
    // Force dry-run: parent shells often still have DRY_RUN=0 from Hardhat live ops.
    // dotenv override:false inside the worker would keep that and refuse boot.
    env: {
      ...process.env,
      WORKER_PROFILE: "mainnet",
      DRY_RUN: "1",
      MAINNET_LIVE_ACK: "",
      ALLOW_MEMORY_STATE: "1",
      HEALTH_HOST: "127.0.0.1",
      HEALTH_PORT: "8081",
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  },
);

const logFile = path.join(logDir, `worker-${Date.now()}.log`);
const { createWriteStream } = await import("node:fs");
const out = createWriteStream(logFile, { flags: "a" });
child.stdout.pipe(out);
child.stderr.pipe(out);
child.unref();

// wait for health
let healthz = null;
let readyz = null;
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  try {
    const h = await fetch("http://127.0.0.1:8081/healthz");
    healthz = { status: h.status, body: await h.json() };
    const rdy = await fetch("http://127.0.0.1:8081/readyz");
    readyz = { status: rdy.status, body: await rdy.json() };
    if (healthz.body?.lastTickAt) break;
  } catch {
    /* retry */
  }
}

console.log(
  JSON.stringify(
    {
      pass: Boolean(healthz?.body?.ok && healthz?.body?.dryRun === true),
      deployment: {
        serviceName: "settlement-worker-mainnet",
        mode: "local-dry-run",
        url: "http://127.0.0.1:8081",
        pid: child.pid,
        logFile,
      },
      wallet: account.address,
      ethBalance: formatEther(bal),
      chainId,
      currentDay,
      phase,
      plannedActions:
        now < dayZero
          ? [
              "wait until GAME_DAY_ZERO 2026-07-24T12:00:00.000Z",
              "then DRY_RUN would log fulfillDaySeed / finalizeDay / creditBatch (no broadcast)",
            ]
          : ["see health / logs"],
      healthz,
      readyz,
      zeroTransactionsSent: true,
      dryRun: true,
      mainnetLiveAckSet: false,
      redisNamespace: ns,
    },
    null,
    2,
  ),
);

if (!healthz?.body?.ok) process.exit(1);
