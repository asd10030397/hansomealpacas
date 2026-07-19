/**
 * QA: King + Runner + Lucky only → resolve → assert personal report filter
 * and idempotent seed handling.
 *
 * Usage: npx hardhat run scripts/qa-personal-battle.ts --network robinhoodTestnet
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { getDeployerSigner } from "./lib/signer";

const TOKENS = [1, 15, 14] as const; // King, Runner, Lucky
const LOCATION = 2;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitUntil(
  label: string,
  pred: () => Promise<boolean>,
  maxSec: number,
) {
  const t0 = Date.now();
  while (!(await pred())) {
    if ((Date.now() - t0) / 1000 > maxSec) throw new Error(`Timeout ${label}`);
    console.log(`Waiting ${label}…`);
    await sleep(5_000);
  }
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

async function main() {
  const base = (process.env.QA_BASE_URL ?? "http://localhost:3002").replace(/\/$/, "");
  const record = JSON.parse(
    readFileSync(join(__dirname, "..", "deployments", `${network.name}-game.json`), "utf8"),
  ) as { address: string; distributor: string; randomness: string; genesis: string };

  const signer = await getDeployerSigner(ethers.provider);
  const game = await ethers.getContractAt("HansomeGame", record.address, signer);
  const distributor = await ethers.getContractAt(
    "RewardDistributor",
    record.distributor,
    signer,
  );
  const randomness = await ethers.getContractAt("GameRandomness", record.randomness, signer);

  let day = Number(await game.currentDay());
  let state = Number(await game.dayState(day));
  if (state !== 1) {
    const target = day + 1;
    await waitUntil(
      `CommitOpen(${target})`,
      async () =>
        Number(await game.currentDay()) >= target &&
        Number(await game.dayState(target)) === 1,
      300,
    );
    day = Number(await game.currentDay());
  }
  console.log("day", day, "state", Number(await game.dayState(day)));

  const secrets: Array<{
    tokenId: number;
    day: number;
    locationId: number;
    salt: string;
    commitHash: string;
  }> = [];

  for (const tokenId of TOKENS) {
    const existing = await game.commitHashOf(tokenId, day);
    if (existing !== ethers.ZeroHash) {
      console.log(`#${tokenId} already committed`);
      continue;
    }
    const salt = ethers.id(`personal-qa-${day}-${tokenId}-${Date.now()}`);
    const commitHash = await game.computeCommitHash(tokenId, day, LOCATION, salt);
    const tx = await game.commit(tokenId, day, commitHash);
    await tx.wait();
    secrets.push({ tokenId, day, locationId: LOCATION, salt, commitHash });
    console.log("committed", tokenId);
  }

  // Reload secrets for already-committed? For vault we need salts — only upload fresh.
  for (const s of secrets) {
    const { status, json } = await post(`${base}/api/game/testnet-commit-secret`, {
      ...s,
      wallet: signer.address,
    });
    if (status >= 300 || json?.ok === false) {
      throw new Error(`vault fail #${s.tokenId}: ${JSON.stringify(json)}`);
    }
  }

  await waitUntil(
    `RevealOpen(${day})`,
    async () => Number(await game.dayState(day)) >= 3,
    300,
  );

  // First resolve
  const r1 = await post(`${base}/api/game/testnet-resolve`, {
    day,
    fulfillSeed: true,
    settle: true,
  });
  console.log("resolve1", JSON.stringify(r1.json));

  // Second resolve — must be idempotent (seed already set / already settled)
  const r2 = await post(`${base}/api/game/testnet-resolve`, {
    day,
    fulfillSeed: true,
    settle: true,
  });
  console.log("resolve2", JSON.stringify(r2.json));

  if (!r1.json?.ok) throw new Error("resolve1 failed");
  if (!r2.json?.ok) throw new Error("resolve2 failed (idempotent seed/settle)");
  if (r2.json?.error) throw new Error(`resolve2 error: ${r2.json.error}`);

  const settled = await game.isSettled(day);
  const hasSeed = await randomness.hasDaySeed(day);
  console.log({ settled, hasSeed, seedSkipped: r2.json?.seedSkipped });

  // Personal report filter: only TOKENS have commits; others owned should not.
  const ownedSamples = [1, 11, 12, 13, 14, 15, 16];
  const personal: number[] = [];
  for (const id of ownedSamples) {
    const h = await game.commitHashOf(id, day);
    if (h !== ethers.ZeroHash) personal.push(id);
  }
  console.log("personalBattleTokenIds", personal);
  const unexpected = personal.filter((id) => !(TOKENS as readonly number[]).includes(id));
  if (unexpected.length) {
    throw new Error(`Unexpected personal tokens: ${unexpected.join(",")}`);
  }
  for (const id of TOKENS) {
    if (!personal.includes(id)) throw new Error(`Missing personal token #${id}`);
  }

  for (const id of TOKENS) {
    const loc = Number(await game.locationOf(id, day));
    if (loc !== LOCATION) throw new Error(`#${id} loc=${loc}`);
    const claimable = await distributor.claimable(id);
    console.log(`#${id} loc=${loc} claimable=${ethers.formatEther(claimable)}`);
    if (claimable > 0n) {
      const tx = await distributor.claim(id);
      await tx.wait();
      console.log("claimed", id);
    }
  }

  console.log("OK — personal battle QA passed");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
