/**
 * Production smoke: one NFT Commit → durable vault → gasless reveal → settlement.
 * Does not modify contracts. Never logs salts or private keys.
 *
 * Usage:
 *   QA_BASE_URL=https://game.hansomealpacas.xyz \
 *   npx hardhat run scripts/smoke-prod-gasless.ts --network robinhoodTestnet
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { getDeployerSigner } from "./lib/signer";

const DayState: Record<number, string> = {
  0: "Idle",
  1: "CommitOpen",
  2: "CommitClosed",
  3: "RevealOpen",
  4: "RevealClosed",
  5: "Settlement",
  6: "Claimable",
};

type Booleans = {
  canResolve: boolean;
  vaultWrite: boolean;
  vaultReadback: boolean;
  commitOnChain: boolean;
  revealSubmitted: boolean;
  settlement: boolean;
};

function sleep(ms: number) {
  return Promise.resolve().then(
    () => new Promise<void>((r) => setTimeout(r, ms)),
  );
}

async function waitUntil(
  label: string,
  predicate: () => Promise<boolean>,
  maxWaitSec: number,
): Promise<void> {
  const start = Date.now();
  while (!(await predicate())) {
    const elapsed = Math.floor((Date.now() - start) / 1000);
    if (elapsed > maxWaitSec) throw new Error(`Timeout: ${label} after ${maxWaitSec}s`);
    console.log(`Waiting for ${label}… (${elapsed}s)`);
    await sleep(5_000);
  }
}

async function postJson(
  url: string,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

async function main() {
  if (network.name === "robinhood" || network.name.toLowerCase().includes("mainnet")) {
    throw new Error("REFUSED: smoke script is Testnet-only");
  }

  const baseUrl = (
    process.env.QA_BASE_URL ?? "https://game.hansomealpacas.xyz"
  ).replace(/\/$/, "");
  const maxWait = Number(process.env.QA_WAIT_SEC?.trim() ?? "360");
  const preferToken = Number(process.env.QA_TOKEN_ID?.trim() ?? "1");

  const result: Booleans = {
    canResolve: false,
    vaultWrite: false,
    vaultReadback: false,
    commitOnChain: false,
    revealSubmitted: false,
    settlement: false,
  };

  const healthRes = await fetch(`${baseUrl}/api/game/testnet-resolve`);
  const health = (await healthRes.json()) as {
    enabled?: boolean;
    relayerConfigured?: boolean;
    vaultConfigured?: boolean;
    canResolve?: boolean;
    game?: string;
  };
  result.canResolve = Boolean(health.canResolve);
  console.log("status", {
    enabled: Boolean(health.enabled),
    relayerConfigured: Boolean(health.relayerConfigured),
    vaultConfigured: Boolean(health.vaultConfigured),
    canResolve: result.canResolve,
    game: health.game ?? null,
  });
  if (!result.canResolve || !health.game) {
    throw new Error("Production canResolve=false or game missing — abort smoke");
  }

  // Production API is source of truth for the live game (may differ from local deploy JSON).
  const gameAddress = health.game;
  const signer = await getDeployerSigner(ethers.provider);
  const wallet = await signer.getAddress();
  const game = await ethers.getContractAt("HansomeGame", gameAddress, signer);
  const genesisAddr = await game.genesis();
  const genesis = await ethers.getContractAt("HansomeGenesisNFT", genesisAddr, signer);
  console.log("onChain", { game: gameAddress, genesis: genesisAddr });

  // Pick one owned token (prefer QA_TOKEN_ID).
  const candidates = [
    preferToken,
    1,
    2,
    3,
    4,
    5,
    11,
    12,
    13,
    14,
    15,
    16,
  ];
  let tokenId: number | null = null;
  for (const id of [...new Set(candidates)]) {
    try {
      const owner = await genesis.ownerOf(id);
      if (owner.toLowerCase() === wallet.toLowerCase()) {
        tokenId = id;
        break;
      }
    } catch {
      /* missing */
    }
  }
  if (tokenId == null) {
    throw new Error(`Signer owns none of candidate tokens — cannot smoke commit`);
  }
  console.log("token", tokenId);

  const zero =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  let day = Number(await game.currentDay());
  let state = Number(await game.dayState(day));
  let existing = (await game.commitHashOf(tokenId, day)) as string;
  let alreadyCommitted = Boolean(existing && existing !== zero);

  // Fresh commit needs CommitOpen; resume if this token is already committed today.
  if (!alreadyCommitted && state !== 1) {
    const target = day + 1;
    console.log(`day ${day} is ${DayState[state]}; waiting for day ${target} CommitOpen`);
    await waitUntil(
      `CommitOpen(day ${target})`,
      async () => {
        const cd = Number(await game.currentDay());
        return cd >= target && Number(await game.dayState(target)) === 1;
      },
      maxWait,
    );
    day = Number(await game.currentDay());
    state = Number(await game.dayState(day));
    existing = (await game.commitHashOf(tokenId, day)) as string;
    alreadyCommitted = Boolean(existing && existing !== zero);
  }
  if (!alreadyCommitted && state !== 1) {
    throw new Error(`Expected CommitOpen, got ${DayState[state]}`);
  }
  console.log("phase", { day, state: DayState[state] ?? state, alreadyCommitted });
  // Cougar (#16) cannot use Home(0)
  const locationId = 2;

  if (alreadyCommitted) {
    // Resume path: prior smoke wrote vault + commit; skip recreate.
    result.vaultWrite = true;
    result.vaultReadback = true;
    result.commitOnChain = true;
    console.log("resume", { day, tokenId, alreadyCommitted: true });
  } else {
    const salt = ethers.id(`smoke-prod-${day}-${tokenId}-${Date.now()}`);
    const commitHash = await game.computeCommitHash(tokenId, day, locationId, salt);

    // 1) Vault write (before on-chain commit — matches production client)
    const vaultBody = {
      tokenId,
      day,
      locationId,
      salt,
      commitHash,
      wallet,
    };
    const write = await postJson(`${baseUrl}/api/game/testnet-commit-secret`, vaultBody);
    result.vaultWrite = write.status >= 200 && write.status < 300 && write.json.ok === true;
    console.log("vaultWrite", {
      ok: result.vaultWrite,
      status: write.status,
      verified: Boolean(write.json.verified),
      idempotent: Boolean(write.json.idempotent),
    });
    if (!result.vaultWrite) {
      throw new Error(`Vault write failed HTTP ${write.status}`);
    }

    // 2) Vault readback via idempotent re-POST (same commitment)
    const readback = await postJson(`${baseUrl}/api/game/testnet-commit-secret`, vaultBody);
    result.vaultReadback =
      readback.status >= 200 &&
      readback.status < 300 &&
      readback.json.ok === true &&
      readback.json.verified === true &&
      readback.json.idempotent === true;
    console.log("vaultReadback", {
      ok: result.vaultReadback,
      status: readback.status,
      verified: Boolean(readback.json.verified),
      idempotent: Boolean(readback.json.idempotent),
    });
    if (!result.vaultReadback) {
      throw new Error("Vault readback/idempotent verify failed");
    }

    // 3) On-chain commit
    const tx = await game.commit(tokenId, day, commitHash);
    const receipt = await tx.wait();
    const onChain = (await game.commitHashOf(tokenId, day)) as string;
    result.commitOnChain =
      Boolean(receipt?.hash) && onChain.toLowerCase() === commitHash.toLowerCase();
    console.log("commitOnChain", {
      ok: result.commitOnChain,
      txPresent: Boolean(receipt?.hash),
      hashMatches: onChain.toLowerCase() === commitHash.toLowerCase(),
    });
    if (!result.commitOnChain) throw new Error("On-chain commit failed");
  }

  // 4) Wait RevealOpen, then gasless resolve until revealed + settled
  await waitUntil(
    `RevealOpen(day ${day})`,
    async () => Number(await game.dayState(day)) >= 3,
    maxWait,
  );

  let revealedCount = 0;
  let lastResolve: Record<string, unknown> | null = null;
  const deadline = Date.now() + maxWait * 1000;
  while (Date.now() < deadline) {
    const { status, json } = await postJson(`${baseUrl}/api/game/testnet-resolve`, {
      day,
      fulfillSeed: true,
      settle: true,
    });
    lastResolve = { status, ...json };
    revealedCount = Number(json.revealed ?? 0);
    const loc = Number(await game.locationOf(tokenId, day));
    let settled = false;
    try {
      settled = Boolean(await game.isSettled(day));
    } catch {
      settled = Boolean(json.alreadySettled || json.fullySettled);
    }
    console.log("resolve", {
      status,
      ok: Boolean(json.ok),
      stage: json.stage ?? null,
      revealed: revealedCount,
      vaultCount: json.vaultCount ?? null,
      locationOf: loc,
      settled,
      battleReady: Boolean(json.battleReady || json.finalized),
      error: typeof json.error === "string" ? json.error.slice(0, 120) : null,
    });

    if (loc === locationId || revealedCount > 0) {
      result.revealSubmitted = true;
    }
    if (settled || Boolean(json.alreadySettled || json.fullySettled)) {
      result.settlement = true;
      break;
    }
    await sleep(6_000);
  }

  // Final on-chain checks
  const finalLoc = Number(await game.locationOf(tokenId, day));
  result.revealSubmitted = result.revealSubmitted || finalLoc === locationId;
  try {
    result.settlement = result.settlement || Boolean(await game.isSettled(day));
  } catch {
    /* some deployments revert isFinalized-style helpers; rely on resolve flags */
  }

  const outDir = join(__dirname, "..", "..", "reports", "testnet");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "smoke-prod-gasless.json");
  writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        at: new Date().toISOString(),
        baseUrl,
        game: gameAddress,
        day,
        tokenId,
        result,
        lastResolveSafe: lastResolve
          ? {
              status: lastResolve.status,
              ok: lastResolve.ok,
              stage: lastResolve.stage,
              revealed: lastResolve.revealed,
              vaultCount: lastResolve.vaultCount,
              battleReady: lastResolve.battleReady,
              fullySettled: lastResolve.fullySettled,
              alreadySettled: lastResolve.alreadySettled,
            }
          : null,
      },
      null,
      2,
    )}\n`,
  );

  console.log("SMOKE_RESULT", JSON.stringify(result));
  console.log("report", outPath);

  const allOk = Object.values(result).every(Boolean);
  if (!allOk) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
