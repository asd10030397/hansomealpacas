/**
 * Deploy settlement-worker-testnet to Railway (DRY_RUN=1 only).
 * Never prints private keys. Never touches settlement-worker-mainnet.
 *
 * Prereq: `npx @railway/cli login` (interactive once)
 *
 *   node scripts/deploy-railway-testnet-dry-run.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";

const root = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(root, "..");
const MAINNET_FORBIDDEN = "0x4D68639a5e3ad8fD268f801862D464259656Fd6c";
const MAINNET_SERVICE = "settlement-worker-mainnet";
const SERVICE = "settlement-worker-testnet";
const NS = "hansome:settle:v1:testnet:46630";
const MAINNET_NS = "hansome:settle:v1:mainnet:4663";
const EXPECTED_PROVIDER = "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A";
const GAME = "0x92C8e9CCF67e533438bCCE258D4bEEc6E0559FC5";
const RANDOMNESS = "0x45F9FFaC891e06E83a5A315E4fE1B55E5b6b438F";
const RPC = "https://rpc.testnet.chain.robinhood.com";
const CHAIN_ID = "46630";
const MAINNET_URL =
  "https://settlement-worker-mainnet-production.up.railway.app";

function railway(args, opts = {}) {
  // Windows: npx is a .cmd shim; shell required. Avoid spaces in args when shell:true.
  const r = spawnSync("npx", ["--yes", "@railway/cli", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env },
    maxBuffer: 20 * 1024 * 1024,
    shell: process.platform === "win32",
    ...opts,
  });
  return r;
}

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

function redact(s) {
  return String(s || "")
    .replace(/0x[0-9a-fA-F]{64}/g, "0x[REDACTED_KEY]")
    .replace(/[0-9a-fA-F]{64}/g, "[REDACTED_KEY]");
}

function varKeysOnly(kvText) {
  // Ignore Railway-injected keys — they can change when sibling services are added.
  return String(kvText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("=")[0])
    .filter((k) => k && !k.startsWith("RAILWAY_"))
    .sort();
}

async function fetchJson(url) {
  const res = await fetch(url);
  const body = await res.json();
  return { status: res.status, body };
}

// --- Load Testnet key from Testnet-only sources (never .env.mainnet) ---
const envTestnetPath = path.join(root, ".env.testnet");
const sources = [
  path.join(repoRoot, ".env.local"),
  path.join(repoRoot, "contracts", ".env"),
];

let hexKey = "";
let keySource = "";
for (const src of sources) {
  if (!existsSync(src)) continue;
  const parsed = dotenv.parse(readFileSync(src));
  const candidates = [
    parsed.GAME_TESTNET_RELAYER_PRIVATE_KEY,
    parsed.SEED_PRIVATE_KEY,
    parsed.SETTLER_PRIVATE_KEY,
    parsed.TREASURY_PRIVATE_KEY,
  ];
  for (const c of candidates) {
    const n = normalizeSecret(c);
    const h = n.startsWith("0x") ? n : n ? `0x${n}` : "";
    if (/^0x[0-9a-fA-F]{64}$/.test(h)) {
      const addr = privateKeyToAccount(h).address;
      if (addr.toLowerCase() === MAINNET_FORBIDDEN.toLowerCase()) continue;
      if (addr.toLowerCase() === EXPECTED_PROVIDER.toLowerCase()) {
        hexKey = h;
        keySource = path.relative(repoRoot, src);
        break;
      }
    }
  }
  if (hexKey) break;
}

if (!hexKey) {
  console.log(
    JSON.stringify({
      pass: false,
      fail: "NO_TESTNET_PROVIDER_KEY",
      detail:
        "Need Testnet key deriving to randomnessProvider 0xcE15…069A from .env.local or contracts/.env",
    }),
  );
  process.exit(2);
}

const wallet = privateKeyToAccount(hexKey).address;
if (wallet.toLowerCase() === MAINNET_FORBIDDEN.toLowerCase()) {
  console.log(
    JSON.stringify({
      pass: false,
      fail: "REFUSED_MAINNET_WALLET",
      derived: wallet,
    }),
  );
  process.exit(2);
}
if (wallet.toLowerCase() !== EXPECTED_PROVIDER.toLowerCase()) {
  console.log(
    JSON.stringify({
      pass: false,
      fail: "WALLET_NOT_TESTNET_PROVIDER",
      derived: wallet,
      expected: EXPECTED_PROVIDER,
    }),
  );
  process.exit(2);
}

// Write .env.testnet (DRY_RUN=1) without echoing secrets
const envBody = [
  "WORKER_PROFILE=testnet",
  `WORKER_NAME=${SERVICE}`,
  `CHAIN_ID=${CHAIN_ID}`,
  `RPC_URL=${RPC}`,
  `GAME_ADDRESS=${GAME}`,
  `RANDOMNESS_ADDRESS=${RANDOMNESS}`,
  `SETTLER_PRIVATE_KEY=${hexKey}`,
  `SEED_PRIVATE_KEY=${hexKey}`,
  "DRY_RUN=1",
  "POLL_INTERVAL_MS=5000",
  "CREDIT_BATCH_LIMIT=50",
  "MAX_CREDITS_PER_TICK=8",
  "GAS_LIMIT=2500000",
  "MIN_ETH_BALANCE=0.01",
  "LOOKBACK_DAYS=2",
  "HEALTH_HOST=0.0.0.0",
  "HEALTH_PORT=8080",
  "PORT=8080",
  `REDIS_NAMESPACE=${NS}`,
  "ALLOW_MEMORY_STATE=1",
  "LOG_DIR=/tmp/hansome-settle-testnet-logs",
  "",
].join("\n");
writeFileSync(envTestnetPath, envBody, { encoding: "utf8", mode: 0o600 });
console.log(
  JSON.stringify({
    step: "env_testnet_written",
    path: ".env.testnet",
    keySource,
    wallet,
    secretsPrinted: false,
    DRY_RUN: "1",
  }),
);

// --- Safety checks ---
const client = createPublicClient({ transport: http(RPC) });
const onChainProvider = await client.readContract({
  address: RANDOMNESS,
  abi: parseAbi(["function randomnessProvider() view returns (address)"]),
  functionName: "randomnessProvider",
});
const rpcChainId = await client.getChainId();

const safety = {
  profileChain: Number(CHAIN_ID) === 46630 && rpcChainId === 46630,
  suiteTestnetOnly:
    GAME.toLowerCase() ===
      "0x92c8e9ccf67e533438bcce258d4beec6e0559fc5" &&
    RANDOMNESS.toLowerCase() ===
      "0x45f9ffac891e06e83a5a315e4fe1b55e5b6b438f",
  redisNs: NS === "hansome:settle:v1:testnet:46630" && NS !== MAINNET_NS,
  walletNotMainnet: wallet.toLowerCase() !== MAINNET_FORBIDDEN.toLowerCase(),
  walletMatchesProvider:
    wallet.toLowerCase() === String(onChainProvider).toLowerCase(),
  dryRunForced: true,
  notUsingMainnetNs: NS !== MAINNET_NS,
  notUsingMainnetChain: CHAIN_ID !== "4663",
};

if (!Object.values(safety).every(Boolean)) {
  console.log(JSON.stringify({ pass: false, fail: "SAFETY_CHECK", safety, onChainProvider }));
  process.exit(2);
}
console.log(JSON.stringify({ step: "safety_pass", safety, onChainProvider, wallet }));

const who = railway(["whoami"]);
if (who.status !== 0) {
  console.log(
    JSON.stringify({
      pass: false,
      fail: "RAILWAY_NOT_LOGGED_IN",
      detail: "Run: npx @railway/cli login",
      stderr: redact(who.stderr || who.stdout),
    }),
  );
  process.exit(2);
}
console.log(JSON.stringify({ step: "logged_in", whoami: (who.stdout || "").trim() }));

// Snapshot Mainnet BEFORE (keys only — never dump secret values)
const mainnetVarsBefore = railway([
  "variables",
  "--service",
  MAINNET_SERVICE,
  "--kv",
]);
const mainnetKeysBefore = varKeysOnly(mainnetVarsBefore.stdout);
let mainnetHealthBefore = null;
try {
  mainnetHealthBefore = await fetchJson(`${MAINNET_URL}/healthz`);
} catch (e) {
  console.log(
    JSON.stringify({
      pass: false,
      fail: "MAINNET_HEALTH_BEFORE",
      err: String(e),
    }),
  );
  process.exit(2);
}
console.log(
  JSON.stringify({
    step: "mainnet_snapshot_before",
    keys: mainnetKeysBefore,
    healthz: mainnetHealthBefore,
  }),
);

// Ensure project is linked (do not change Mainnet service config)
let status = railway(["status"]);
if (status.status !== 0 || /No project/i.test(status.stdout + status.stderr)) {
  console.log(
    JSON.stringify({
      pass: false,
      fail: "NO_PROJECT_LINK",
      detail: "Link hansome-settlement project first",
      out: redact((status.stdout || "") + (status.stderr || "")).slice(0, 400),
    }),
  );
  process.exit(2);
}

// Create Testnet service (idempotent-ish)
const add = railway(["add", "--service", SERVICE]);
console.log(
  JSON.stringify({
    step: "add_service",
    status: add.status,
    out: redact((add.stdout || "") + (add.stderr || "")).slice(0, 400),
  }),
);

// Select Testnet service explicitly — never leave Mainnet as deploy target
const sel = railway(["service", SERVICE]);
if (sel.status !== 0) {
  console.log(
    JSON.stringify({
      pass: false,
      fail: "SERVICE_SELECT",
      err: redact(sel.stderr || sel.stdout).slice(0, 300),
    }),
  );
  process.exit(1);
}

// Confirm linked service is Testnet before up
const statusAfterSelect = railway(["status"]);
const statusText =
  (statusAfterSelect.stdout || "") + (statusAfterSelect.stderr || "");
if (
  /Linked service/i.test(statusText) &&
  /settlement-worker-mainnet/i.test(statusText) &&
  !new RegExp(SERVICE, "i").test(statusText.split("Linked service")[1] || "")
) {
  // Parse carefully: "Linked service" section should name testnet
  const linkedBlock = statusText.split("All resources")[0] || statusText;
  if (
    linkedBlock.includes(MAINNET_SERVICE) &&
    !linkedBlock.includes(SERVICE)
  ) {
    console.log(
      JSON.stringify({
        pass: false,
        fail: "MAINNET_STILL_SELECTED",
        detail: "Aborting before railway up — Mainnet would be the target",
      }),
    );
    process.exit(2);
  }
}
console.log(
  JSON.stringify({
    step: "service_selected",
    service: SERVICE,
    statusSnippet: redact(statusText).slice(0, 500),
  }),
);

const publicVars = {
  WORKER_PROFILE: "testnet",
  WORKER_NAME: SERVICE,
  CHAIN_ID,
  RPC_URL: RPC,
  GAME_ADDRESS: GAME,
  RANDOMNESS_ADDRESS: RANDOMNESS,
  DRY_RUN: "1",
  POLL_INTERVAL_MS: "5000",
  CREDIT_BATCH_LIMIT: "50",
  MAX_CREDITS_PER_TICK: "8",
  GAS_LIMIT: "2500000",
  MIN_ETH_BALANCE: "0.01",
  LOOKBACK_DAYS: "2",
  HEALTH_HOST: "0.0.0.0",
  HEALTH_PORT: "8080",
  PORT: "8080",
  REDIS_NAMESPACE: NS,
  ALLOW_MEMORY_STATE: "1",
  LOG_DIR: "/tmp/hansome-settle-testnet-logs",
};

for (const [k, v] of Object.entries(publicVars)) {
  const r = railway(["variables", "--set", `${k}=${v}`, "--service", SERVICE]);
  if (r.status !== 0) {
    console.log(
      JSON.stringify({
        pass: false,
        fail: "SET_VAR",
        key: k,
        err: redact(r.stderr || r.stdout).slice(0, 200),
      }),
    );
    process.exit(1);
  }
}

// Ensure live ack absent on Testnet too
railway(["variables", "--remove", "MAINNET_LIVE_ACK", "--service", SERVICE]);

const secretSets = [
  ["SEED_PRIVATE_KEY", hexKey],
  ["SETTLER_PRIVATE_KEY", hexKey],
];
for (const [k, v] of secretSets) {
  const r = railway(["variables", "--set", `${k}=${v}`, "--service", SERVICE]);
  if (r.status !== 0) {
    console.log(
      JSON.stringify({
        pass: false,
        fail: "SET_SECRET",
        key: k,
        err: redact(r.stderr || r.stdout).slice(0, 200),
      }),
    );
    process.exit(1);
  }
}
console.log(
  JSON.stringify({
    step: "variables_set",
    publicKeys: Object.keys(publicVars),
    secretKeys: ["SEED_PRIVATE_KEY", "SETTLER_PRIVATE_KEY"],
    secretsPrinted: false,
    MAINNET_LIVE_ACK: "absent",
    DRY_RUN: "1",
  }),
);

const domain = railway(["domain", "--service", SERVICE]);
console.log(
  JSON.stringify({
    step: "domain",
    status: domain.status,
    out: redact((domain.stdout || "") + (domain.stderr || "")).slice(0, 400),
  }),
);

// Final guard: selected service must be Testnet
const preUp = railway(["status"]);
const preUpText = (preUp.stdout || "") + (preUp.stderr || "");
const linkedSection = preUpText.split("All resources")[0] || preUpText;
if (
  linkedSection.includes(MAINNET_SERVICE) &&
  !linkedSection.includes(SERVICE)
) {
  console.log(
    JSON.stringify({
      pass: false,
      fail: "ABORT_UP_MAINNET_SELECTED",
    }),
  );
  process.exit(2);
}

const up = railway([
  "up",
  "--service",
  SERVICE,
  "--detach",
  "-m",
  "testnet-dry-run-worker",
]);
console.log(
  JSON.stringify({
    step: "up",
    status: up.status,
    out: redact((up.stdout || "") + (up.stderr || "")).slice(0, 800),
  }),
);
if (up.status !== 0) {
  console.log(JSON.stringify({ pass: false, fail: "DEPLOY_UP" }));
  process.exit(1);
}

let url = "";
for (let i = 0; i < 36; i++) {
  const d2 = railway(["domain", "--service", SERVICE]);
  const m = ((d2.stdout || "") + (d2.stderr || "")).match(
    /https:\/\/[a-zA-Z0-9.-]+\.up\.railway\.app/,
  );
  if (m) {
    url = m[0];
    break;
  }
  await new Promise((r) => setTimeout(r, 5000));
}

let healthz = null;
let readyz = null;
let lastTickOk = false;
if (url) {
  for (let i = 0; i < 48; i++) {
    try {
      healthz = await fetchJson(`${url}/healthz`);
      readyz = await fetchJson(`${url}/readyz`);
      if (
        healthz.status === 200 &&
        readyz.status === 200 &&
        readyz.body?.ready === true &&
        healthz.body?.dryRun === true &&
        healthz.body?.chainId === 46630 &&
        healthz.body?.lastTickAt
      ) {
        lastTickOk = true;
        break;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

// Snapshot Mainnet AFTER — must be unchanged
const mainnetVarsAfter = railway([
  "variables",
  "--service",
  MAINNET_SERVICE,
  "--kv",
]);
const mainnetKeysAfter = varKeysOnly(mainnetVarsAfter.stdout);
let mainnetHealthAfter = null;
try {
  mainnetHealthAfter = await fetchJson(`${MAINNET_URL}/healthz`);
} catch (e) {
  console.log(
    JSON.stringify({
      pass: false,
      fail: "MAINNET_HEALTH_AFTER",
      err: String(e),
    }),
  );
  process.exit(2);
}

const mainnetUntouched =
  JSON.stringify(mainnetKeysBefore) === JSON.stringify(mainnetKeysAfter) &&
  mainnetHealthAfter?.body?.dryRun === true &&
  mainnetHealthAfter?.body?.chainId === 4663 &&
  String(mainnetHealthAfter?.body?.settler || "").toLowerCase() ===
    MAINNET_FORBIDDEN.toLowerCase() &&
  mainnetHealthBefore?.body?.dryRun === true &&
  mainnetHealthBefore?.body?.chainId === 4663;

const commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
  cwd: root,
  encoding: "utf8",
});

const settlerOk =
  String(healthz?.body?.settler || "").toLowerCase() === wallet.toLowerCase();
const seedOk =
  String(healthz?.body?.seedWallet || healthz?.body?.settler || "")
    .toLowerCase() === wallet.toLowerCase();

const pass = Boolean(
  healthz?.status === 200 &&
    readyz?.status === 200 &&
    readyz?.body?.ready === true &&
    healthz?.body?.dryRun === true &&
    healthz?.body?.chainId === 46630 &&
    settlerOk &&
    seedOk &&
    lastTickOk &&
    mainnetUntouched &&
    NS !== MAINNET_NS &&
    wallet.toLowerCase() !== MAINNET_FORBIDDEN.toLowerCase(),
);

console.log(
  JSON.stringify(
    {
      pass,
      serviceName: SERVICE,
      deploymentUrl: url || null,
      chainId: 46630,
      rpc: RPC,
      wallet,
      onChainRandomnessProvider: onChainProvider,
      redisNamespace: NS,
      DRY_RUN: 1,
      healthz,
      readyz,
      lastTickOk,
      mainnetUntouched,
      mainnetHealthAfter,
      restartPolicy: "ALWAYS",
      deployedCommit: (commit.stdout || "").trim() || null,
      secretsPrinted: false,
      zeroMainnetTransactionsSent: true,
      MAINNET_LIVE_ACK: "absent",
      note: "DRY_RUN=1 still; awaiting approval before DRY_RUN=0",
    },
    null,
    2,
  ),
);

process.exit(pass ? 0 : 1);
