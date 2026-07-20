/**
 * Production Testnet smoke: vault → commit → reveal → settle.
 * Never prints salts, private keys, or vault ciphertext.
 *
 * Usage (from repo root):
 *   node scripts/smoke-prod-vault.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  encodePacked,
  keccak256,
  isHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const BASE = "https://game.hansomealpacas.xyz";
const RPC = "https://rpc.testnet.chain.robinhood.com";
const LOCATION = 2; // Grassland — valid for Alpaca + Cougar
const CANDIDATE_TOKENS = [1, 2, 3, 4, 5, 11, 12, 13, 14, 15, 16];

const DayState = {
  0: "Idle",
  1: "CommitOpen",
  2: "CommitClosed",
  3: "RevealOpen",
  4: "RevealClosed",
  5: "Settlement",
  6: "Claimable",
};

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnvFile(resolve("contracts/.env"));
loadEnvFile(resolve(".env.local"));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function result(step, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function postJson(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function computeCommitHash(tokenId, day, locationId, salt) {
  return keccak256(
    encodePacked(
      ["uint256", "uint256", "uint8", "bytes32"],
      [BigInt(tokenId), BigInt(day), locationId, salt],
    ),
  );
}

function randomSalt() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function waitUntil(label, pred, maxSec) {
  const t0 = Date.now();
  while (!(await pred())) {
    const elapsed = Math.floor((Date.now() - t0) / 1000);
    if (elapsed > maxSec) throw new Error(`Timeout waiting for ${label} (${maxSec}s)`);
    console.log(`… waiting ${label} (${elapsed}s)`);
    await sleep(4_000);
  }
}

async function main() {
  const checks = {
    status: false,
    vaultWrite: false,
    vaultReadback: false,
    onChainCommit: false,
    revealSubmission: false,
    settlement: false,
  };

  const statusRes = await fetch(`${BASE}/api/game/testnet-resolve`, {
    cache: "no-store",
  });
  const status = await statusRes.json();
  checks.status = Boolean(
    status.ok && status.canResolve && status.relayerConfigured && status.vaultConfigured,
  );
  result(
    "production canResolve",
    checks.status,
    `relayer=${Boolean(status.relayerConfigured)} vault=${Boolean(status.vaultConfigured)} canResolve=${Boolean(status.canResolve)}`,
  );
  if (!checks.status) {
    process.exitCode = 1;
    return;
  }

  const game = status.game;
  const pkRaw =
    process.env.DEPLOYER_PRIVATE_KEY?.trim() ||
    process.env.TREASURY_PRIVATE_KEY?.trim() ||
    process.env.PRIVATE_KEY?.trim() ||
    "";
  if (!pkRaw) throw new Error("Missing DEPLOYER/TREASURY/PRIVATE_KEY in env");
  const pk = (pkRaw.startsWith("0x") ? pkRaw : `0x${pkRaw}`);
  if (!isHex(pk) || pk.length !== 66) throw new Error("Invalid private key shape");

  const account = privateKeyToAccount(pk);
  const chain = {
    id: 46630,
    name: "Robinhood Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [RPC] }, public: { http: [RPC] } },
  };
  const transport = http(RPC);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  const gameAbi = parseAbi([
    "function currentDay() view returns (uint256)",
    "function dayState(uint256 day) view returns (uint8)",
    "function nft() view returns (address)",
    "function commitHashOf(uint256 tokenId, uint256 day) view returns (bytes32)",
    "function locationOf(uint256 tokenId, uint256 day) view returns (uint8)",
    "function isSettled(uint256 day) view returns (bool)",
    "function isFinalized(uint256 day) view returns (bool)",
    "function commit(uint256 tokenId, uint256 day, bytes32 commitHash)",
  ]);
  const nftAbi = parseAbi([
    "function ownerOf(uint256 tokenId) view returns (address)",
  ]);

  const nft = await publicClient.readContract({
    address: game,
    abi: gameAbi,
    functionName: "nft",
  });

  let day = Number(
    await publicClient.readContract({
      address: game,
      abi: gameAbi,
      functionName: "currentDay",
    }),
  );
  let state = Number(
    await publicClient.readContract({
      address: game,
      abi: gameAbi,
      functionName: "dayState",
      args: [BigInt(day)],
    }),
  );
  console.log(`day=${day} state=${DayState[state] ?? state} wallet=${account.address}`);

  if (state !== 1) {
    const target = state === 0 ? day : day + 1;
    console.log(`Not CommitOpen — waiting for day ${target} CommitOpen…`);
    await waitUntil(
      `CommitOpen(${target})`,
      async () => {
        day = Number(
          await publicClient.readContract({
            address: game,
            abi: gameAbi,
            functionName: "currentDay",
          }),
        );
        state = Number(
          await publicClient.readContract({
            address: game,
            abi: gameAbi,
            functionName: "dayState",
            args: [BigInt(day)],
          }),
        );
        return day >= target && state === 1;
      },
      300,
    );
  }

  let tokenId = null;
  for (const id of CANDIDATE_TOKENS) {
    try {
      const owner = await publicClient.readContract({
        address: nft,
        abi: nftAbi,
        functionName: "ownerOf",
        args: [BigInt(id)],
      });
      if (owner.toLowerCase() !== account.address.toLowerCase()) continue;
      const hash = await publicClient.readContract({
        address: game,
        abi: gameAbi,
        functionName: "commitHashOf",
        args: [BigInt(id), BigInt(day)],
      });
      if (hash === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        tokenId = id;
        break;
      }
    } catch {
      /* token may not exist */
    }
  }

  if (tokenId == null) {
    result("select uncommitted owned NFT", false, "none available this day");
    process.exitCode = 1;
    return;
  }
  console.log(`using tokenId=#${tokenId}`);

  const salt = randomSalt();
  const commitHash = computeCommitHash(tokenId, day, LOCATION, salt);

  // 1) Vault write (production order: before on-chain commit)
  const write = await postJson("/api/game/testnet-commit-secret", {
    tokenId,
    day,
    locationId: LOCATION,
    salt,
    commitHash,
    wallet: account.address,
  });
  checks.vaultWrite = write.status < 300 && write.json?.ok === true && write.json?.verified === true;
  result(
    "vault write + verify",
    checks.vaultWrite,
    `http=${write.status} ok=${Boolean(write.json?.ok)} verified=${Boolean(write.json?.verified)} code=${write.json?.code ?? "none"}`,
  );
  if (!checks.vaultWrite) {
    process.exitCode = 1;
    return;
  }

  // 2) Vault readback via idempotent re-persist (same commitment)
  const readback = await postJson("/api/game/testnet-commit-secret", {
    tokenId,
    day,
    locationId: LOCATION,
    salt,
    commitHash,
    wallet: account.address,
  });
  checks.vaultReadback =
    readback.status < 300 &&
    readback.json?.ok === true &&
    readback.json?.verified === true &&
    readback.json?.idempotent === true;
  result(
    "vault readback (idempotent)",
    checks.vaultReadback,
    `idempotent=${Boolean(readback.json?.idempotent)} verified=${Boolean(readback.json?.verified)}`,
  );
  if (!checks.vaultReadback) {
    process.exitCode = 1;
    return;
  }

  // 3) On-chain commit
  const commitTx = await walletClient.writeContract({
    address: game,
    abi: gameAbi,
    functionName: "commit",
    args: [BigInt(tokenId), BigInt(day), commitHash],
    account,
  });
  const commitReceipt = await publicClient.waitForTransactionReceipt({
    hash: commitTx,
  });
  const onChainHash = await publicClient.readContract({
    address: game,
    abi: gameAbi,
    functionName: "commitHashOf",
    args: [BigInt(tokenId), BigInt(day)],
  });
  checks.onChainCommit =
    commitReceipt.status === "success" &&
    onChainHash.toLowerCase() === commitHash.toLowerCase();
  result(
    "on-chain commit",
    checks.onChainCommit,
    `tx=${commitTx.slice(0, 10)}… status=${commitReceipt.status} hashMatch=${onChainHash.toLowerCase() === commitHash.toLowerCase()}`,
  );
  if (!checks.onChainCommit) {
    process.exitCode = 1;
    return;
  }

  // 4) Wait RevealOpen, then relayer resolve (reveal from vault)
  await waitUntil(
    `RevealOpen(${day})`,
    async () =>
      Number(
        await publicClient.readContract({
          address: game,
          abi: gameAbi,
          functionName: "dayState",
          args: [BigInt(day)],
        }),
      ) >= 3,
    180,
  );

  let revealed = 0;
  let revealTxHash = null;
  let vaultCount = null;
  let battleReady = false;
  let fullySettled = false;

  for (let i = 0; i < 40; i++) {
    const r = await postJson("/api/game/testnet-resolve", {
      day,
      fulfillSeed: true,
      settle: true,
    });
    if (r.json?.revealed != null) revealed = Number(r.json.revealed);
    if (r.json?.revealTxHash) revealTxHash = r.json.revealTxHash;
    if (r.json?.vaultCount != null) vaultCount = Number(r.json.vaultCount);
    battleReady = Boolean(r.json?.battleReady || r.json?.finalized);
    fullySettled = Boolean(r.json?.fullySettled || r.json?.alreadySettled);

    console.log(
      `resolve[${i}] ok=${Boolean(r.json?.ok)} stage=${r.json?.stage ?? "?"} revealed=${revealed} vaultCount=${vaultCount} battleReady=${battleReady} fullySettled=${fullySettled}`,
    );

    if (r.status >= 300 || r.json?.ok === false) {
      console.log(`resolve error: ${r.json?.error ?? r.status}`);
    }

    const loc = Number(
      await publicClient.readContract({
        address: game,
        abi: gameAbi,
        functionName: "locationOf",
        args: [BigInt(tokenId), BigInt(day)],
      }),
    );
    if (loc === LOCATION || revealed > 0 || revealTxHash) {
      checks.revealSubmission = true;
    }

    if (fullySettled) break;
    if (battleReady && checks.revealSubmission) {
      // keep polling briefly for credits / full settle
      if (i > 8) break;
    }
    await sleep(5_000);
  }

  const locFinal = Number(
    await publicClient.readContract({
      address: game,
      abi: gameAbi,
      functionName: "locationOf",
      args: [BigInt(tokenId), BigInt(day)],
    }),
  );
  checks.revealSubmission = checks.revealSubmission || locFinal === LOCATION;
  result(
    "reveal submission",
    checks.revealSubmission,
    `locationOf=${locFinal} revealed=${revealed} vaultCount=${vaultCount} revealTx=${revealTxHash ? `${revealTxHash.slice(0, 10)}…` : "none"}`,
  );

  let finalized = false;
  let settled = false;
  try {
    finalized = Boolean(
      await publicClient.readContract({
        address: game,
        abi: gameAbi,
        functionName: "isFinalized",
        args: [BigInt(day)],
      }),
    );
  } catch {
    /* older ABI */
  }
  try {
    settled = Boolean(
      await publicClient.readContract({
        address: game,
        abi: gameAbi,
        functionName: "isSettled",
        args: [BigInt(day)],
      }),
    );
  } catch {
    /* ignore */
  }

  checks.settlement = Boolean(battleReady || fullySettled || finalized || settled);
  result(
    "settlement",
    checks.settlement,
    `battleReady=${battleReady} fullySettled=${fullySettled} finalized=${finalized} isSettled=${settled}`,
  );

  const all =
    checks.status &&
    checks.vaultWrite &&
    checks.vaultReadback &&
    checks.onChainCommit &&
    checks.revealSubmission &&
    checks.settlement;

  console.log("---");
  console.log(
    JSON.stringify(
      {
        day,
        tokenId,
        ...checks,
        overall: all ? "PASS" : "FAIL",
      },
      null,
      2,
    ),
  );
  if (!all) process.exitCode = 1;
}

main().catch((e) => {
  console.error("SMOKE ERROR:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
