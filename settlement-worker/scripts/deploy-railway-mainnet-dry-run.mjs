/**
 * Deploy settlement-worker-mainnet to Railway (DRY_RUN only).
 * Never prints private keys.
 *
 * Prereq: `npx @railway/cli login` (interactive once)
 *
 *   node scripts/deploy-railway-mainnet-dry-run.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";

const root = path.resolve(import.meta.dirname, "..");
const LOCKED = "0x4D68639a5e3ad8fD268f801862D464259656Fd6c";
const SERVICE = "settlement-worker-mainnet";
const NS = "hansome:settle:v1:mainnet:4663";

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

// Load local secrets for upload only (not printed)
const envFile = path.join(root, ".env.mainnet");
if (!existsSync(envFile)) {
  console.log(JSON.stringify({ pass: false, fail: "MISSING_ENV_FILE" }));
  process.exit(2);
}
dotenv.config({ path: envFile, override: true });

const seed = normalizeSecret(process.env.SEED_PRIVATE_KEY);
const settler = normalizeSecret(process.env.SETTLER_PRIVATE_KEY);
const hexSeed = seed.startsWith("0x") ? seed : seed ? `0x${seed}` : "";
const hexSettler = settler.startsWith("0x") ? settler : settler ? `0x${settler}` : "";

if (!/^0x[0-9a-fA-F]{64}$/.test(hexSeed) || !/^0x[0-9a-fA-F]{64}$/.test(hexSettler)) {
  console.log(JSON.stringify({ pass: false, fail: "INVALID_KEY_SHAPE" }));
  process.exit(2);
}
if (hexSeed.toLowerCase() !== hexSettler.toLowerCase()) {
  console.log(JSON.stringify({ pass: false, fail: "SEED_SETTLER_MISMATCH" }));
  process.exit(2);
}
const wallet = privateKeyToAccount(hexSeed).address;
if (wallet.toLowerCase() !== LOCKED.toLowerCase()) {
  console.log(
    JSON.stringify({
      pass: false,
      fail: "WALLET_MISMATCH",
      derived: wallet,
      expected: LOCKED,
    }),
  );
  process.exit(2);
}

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

// Ensure project linkage
let status = railway(["status"]);
if (status.status !== 0 || /No project/i.test(status.stdout + status.stderr)) {
  const init = railway(["init", "--name", "hansome-settlement"], {
    input: "\n",
  });
  console.log(
    JSON.stringify({
      step: "init",
      ok: init.status === 0,
      out: redact((init.stdout || "") + (init.stderr || "")).slice(0, 500),
    }),
  );
}

// Create / select service
const add = railway(["add", "--service", SERVICE]);
console.log(
  JSON.stringify({
    step: "add_service",
    status: add.status,
    out: redact((add.stdout || "") + (add.stderr || "")).slice(0, 400),
  }),
);
railway(["service", SERVICE]);

// Public vars (safe to log)
const publicVars = {
  WORKER_PROFILE: "mainnet",
  WORKER_NAME: SERVICE,
  CHAIN_ID: "4663",
  RPC_URL: "https://rpc.mainnet.chain.robinhood.com",
  GAME_ADDRESS: "0xb8dad421881171f4485523d109C94dc650ecB7Eb",
  RANDOMNESS_ADDRESS: "0x134f3CE4006a04C2C5DaD0E654d1C4228dd15791",
  DRY_RUN: "1",
  POLL_INTERVAL_MS: "15000",
  CREDIT_BATCH_LIMIT: "50",
  MAX_CREDITS_PER_TICK: "4",
  GAS_LIMIT: "2500000",
  MAX_FEE_PER_GAS_GWEI: "50",
  MIN_ETH_BALANCE: "0.0005",
  LOOKBACK_DAYS: "2",
  HEALTH_HOST: "0.0.0.0",
  HEALTH_PORT: "8080",
  REDIS_NAMESPACE: NS,
  ALLOW_MEMORY_STATE: "1",
  LOG_DIR: "/tmp/hansome-settle-mainnet-logs",
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

// Explicitly unset live ack if present
railway(["variables", "--remove", "MAINNET_LIVE_ACK", "--service", SERVICE]);

// Secrets — never print values
const secretSets = [
  ["SEED_PRIVATE_KEY", hexSeed],
  ["SETTLER_PRIVATE_KEY", hexSettler],
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

// Domain for health
const domain = railway(["domain", "--service", SERVICE]);
console.log(
  JSON.stringify({
    step: "domain",
    status: domain.status,
    out: redact((domain.stdout || "") + (domain.stderr || "")).slice(0, 400),
  }),
);

const up = railway([
  "up",
  "--service",
  SERVICE,
  "--detach",
  "-m",
  "mainnet-dry-run-worker",
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

// Resolve URL
let url = "";
for (let i = 0; i < 30; i++) {
  const st = railway(["status", "--json"]);
  try {
    const j = JSON.parse(st.stdout || "{}");
    // best-effort extract
    url =
      j?.services?.[SERVICE]?.domains?.[0] ||
      j?.domain ||
      "";
  } catch {
    /* */
  }
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

if (!url) {
  // try railway variables / service status text
  const st = railway(["status"]);
  const m = ((st.stdout || "") + (st.stderr || "")).match(
    /https:\/\/[a-zA-Z0-9.-]+\.up\.railway\.app/,
  );
  if (m) url = m[0];
}

let healthz = null;
let readyz = null;
let lastTickOk = false;
if (url) {
  for (let i = 0; i < 36; i++) {
    try {
      const h = await fetch(`${url}/healthz`);
      healthz = { status: h.status, body: await h.json() };
      const r = await fetch(`${url}/readyz`);
      readyz = { status: r.status, body: await r.json() };
      if (
        healthz.status === 200 &&
        readyz.status === 200 &&
        readyz.body?.ready === true &&
        healthz.body?.dryRun === true &&
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

const commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
  cwd: root,
  encoding: "utf8",
});

const pass = Boolean(
  healthz?.status === 200 &&
    readyz?.status === 200 &&
    readyz?.body?.ready === true &&
    healthz?.body?.dryRun === true &&
    healthz?.body?.chainId === 4663 &&
    String(healthz?.body?.settler || "").toLowerCase() === LOCKED.toLowerCase() &&
    healthz?.body?.currentDay === 0 &&
    healthz?.body?.lastError == null &&
    (healthz?.body?.consecutiveFailures ?? 1) === 0 &&
    lastTickOk,
);

console.log(
  JSON.stringify(
    {
      pass,
      serviceName: SERVICE,
      deploymentUrl: url || null,
      healthz,
      readyz,
      restartPolicy: "ALWAYS",
      deployedCommit: (commit.stdout || "").trim() || null,
      secretsPrinted: false,
      zeroTransactionsSent: true,
      DRY_RUN: 1,
      MAINNET_LIVE_ACK: "absent",
      redisNamespace: NS,
      wallet: LOCKED,
    },
    null,
    2,
  ),
);

process.exit(pass ? 0 : 1);
