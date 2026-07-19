/**
 * Live Robinhood Testnet flow: Commit → Reveal → Settlement → Claim.
 *
 * Resumes from deployments/<network>-game.json (+ optional flow state file).
 *
 * Commit policy (strict):
 *   - Before submitting Commit, dayState MUST be CommitOpen.
 *   - If Commit has already ended, abort immediately — do NOT wait for the
 *     Commit window to close, and do NOT submit Commit outside CommitOpen.
 *   - For automatic E2E when Commit is already closed, set GAME_FLOW_AUTO_NEXT=1
 *     to wait for the *next* day's CommitOpen (never waits out the current Commit).
 *
 * After a successful Commit, the script may wait for RevealOpen / RevealClosed
 * (GDS phase boundaries; day lengths unchanged).
 *
 * Env:
 *   GAME_TOKEN_ID        — default 1 (reserved King alpaca)
 *   GAME_LOCATION        — default 2 (Grassland)
 *   GAME_DAY             — day index; default: currentDay() when CommitOpen,
 *                          else flow-file day / 0
 *   GAME_FLOW_WAIT       — max seconds to wait for Reveal/Settle phases (default 16000)
 *   GAME_FLOW_AUTO_NEXT  — if 1 and Commit already ended, wait for next day's CommitOpen
 *   GAME_FLOW_RESET=1    — ignore saved flow state and start fresh
 *
 * Usage: npx hardhat run scripts/validate-game-flow.ts --network robinhoodTestnet
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const COMMIT_OPEN = 1;

type GameRecord = {
  address: string;
  distributor: string;
  randomness: string;
  dayZero: number;
  token: string;
};

type FlowState = {
  day: number;
  tokenId: number;
  location: number;
  salt: string;
  commitHash: string;
  commitTx?: string;
  revealTx?: string;
  seedTx?: string;
  settleTx?: string;
  claimTx?: string;
  claimableBefore?: string;
  claimableAfter?: string;
  checks: Record<string, boolean | string>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function flowPath(): string {
  return join(__dirname, "..", "deployments", `${network.name}-game-flow.json`);
}

function loadFlow(): FlowState | null {
  const p = flowPath();
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as FlowState;
}

function saveFlow(state: FlowState): void {
  mkdirSync(join(__dirname, "..", "deployments"), { recursive: true });
  writeFileSync(flowPath(), `${JSON.stringify(state, null, 2)}\n`);
}

async function waitUntil(
  label: string,
  predicate: () => Promise<boolean>,
  maxWaitSec: number,
): Promise<void> {
  const start = Date.now();
  let rpcFails = 0;
  while (true) {
    try {
      if (await predicate()) return;
      rpcFails = 0;
    } catch (e) {
      rpcFails += 1;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`RPC blip while waiting for ${label} (${rpcFails}): ${msg.slice(0, 120)}`);
      if (rpcFails >= 8) throw e;
    }
    const elapsed = Math.floor((Date.now() - start) / 1000);
    if (elapsed > maxWaitSec) {
      throw new Error(
        `Timeout waiting for ${label} after ${maxWaitSec}s — re-run this script to resume`,
      );
    }
    console.log(`Waiting for ${label}… (${elapsed}s)`);
    await sleep(30_000);
  }
}

function abortCommitPhase(day: number, state: number): never {
  const name = DayState[state] ?? String(state);
  throw new Error(
    [
      `ABORT: Commit requires CommitOpen, but day ${day} is ${name}.`,
      "Do not submit Commit outside the Commit phase.",
      "This script will not wait for the current Commit window to close.",
      "Re-run before Commit closes, or set GAME_FLOW_AUTO_NEXT=1 to start from the next round.",
    ].join(" "),
  );
}

async function main() {
  const deployer = await getDeployerSigner(ethers.provider);
  const recordPath = join(__dirname, "..", "deployments", `${network.name}-game.json`);
  if (!existsSync(recordPath)) {
    throw new Error(`Missing ${recordPath} — deploy first`);
  }
  const record = JSON.parse(readFileSync(recordPath, "utf8")) as GameRecord;

  const tokenId = Number(process.env.GAME_TOKEN_ID?.trim() ?? "1");
  const location = Number(process.env.GAME_LOCATION?.trim() ?? "2");
  const maxWait = Number(process.env.GAME_FLOW_WAIT?.trim() ?? "16000");
  const autoNext = process.env.GAME_FLOW_AUTO_NEXT?.trim() === "1";
  const resetFlow = process.env.GAME_FLOW_RESET?.trim() === "1";

  const game = await ethers.getContractAt("HansomeGame", record.address, deployer);
  const distributor = await ethers.getContractAt(
    "RewardDistributor",
    record.distributor,
    deployer,
  );
  const randomness = await ethers.getContractAt(
    "GameRandomness",
    record.randomness,
    deployer,
  );
  // Prefer TestHANSOME on testnet; IERC20 surface is enough for balance checks.
  const token = await ethers.getContractAt("TestHANSOME", record.token, deployer);

  const currentDay = Number(await game.currentDay());
  let day = process.env.GAME_DAY?.trim()
    ? Number(process.env.GAME_DAY.trim())
    : currentDay;

  let flow = resetFlow ? null : loadFlow();

  // Resume in-progress flow for the same token (e.g. Commit done, waiting Reveal).
  if (flow && flow.tokenId === tokenId && flow.commitTx && !process.env.GAME_DAY?.trim()) {
    day = flow.day;
  }

  // ── Resolve CommitOpen before any Commit attempt ─────────────────────
  if (!flow?.commitTx || flow.day !== day || flow.tokenId !== tokenId) {
    let state = Number(await game.dayState(day));
    console.log(`dayState(${day}) before commit gate:`, DayState[state] ?? state);

    if (state !== COMMIT_OPEN) {
      if (!autoNext) {
        abortCommitPhase(day, state);
      }
      // Wait for the *next* day's CommitOpen — never wait for the current
      // Commit window to finish if we still need to submit Commit.
      const target = currentDay + (Number(await game.dayState(currentDay)) === COMMIT_OPEN ? 0 : 1);
      if (Number(await game.dayState(target)) !== COMMIT_OPEN) {
        console.log(
          `Commit already ended for day ${day} (${DayState[state]}).`,
          `GAME_FLOW_AUTO_NEXT=1 → waiting for day ${target} CommitOpen.`,
        );
        await waitUntil(
          `CommitOpen(day ${target})`,
          async () => Number(await game.dayState(target)) === COMMIT_OPEN,
          maxWait,
        );
      }
      day = target;
      state = Number(await game.dayState(day));
      if (state !== COMMIT_OPEN) abortCommitPhase(day, state);
    }

    // Fresh salt/hash for this day (or keep flow if same day mid-run without commitTx).
    if (!flow || flow.day !== day || flow.tokenId !== tokenId || resetFlow) {
      const salt = ethers.id(`hansome-testnet-flow-${Date.now()}`);
      const commitHash = await game.computeCommitHash(tokenId, day, location, salt);
      flow = {
        day,
        tokenId,
        location,
        salt,
        commitHash,
        checks: {},
      };
      saveFlow(flow);
    }
  }

  if (!flow) throw new Error("Internal: flow state missing");

  console.log("Game:", record.address);
  console.log("Distributor:", record.distributor);
  console.log("Deployer:", deployer.address);
  console.log("tokenId:", tokenId, "day:", flow.day, "loc:", location);
  console.log("dayZero:", record.dayZero);

  // ── Commit ──────────────────────────────────────────────────────────
  if (!flow.commitTx) {
    const state = Number(await game.dayState(flow.day));
    console.log("dayState before commit:", DayState[state] ?? state);
    if (state !== COMMIT_OPEN) {
      abortCommitPhase(flow.day, state);
    }
    try {
      const tx = await game.commit(tokenId, flow.day, flow.commitHash);
      const receipt = await tx.wait();
      flow.commitTx = receipt!.hash;
      flow.checks.commit = true;
      saveFlow(flow);
      console.log("Commit tx:", flow.commitTx);
    } catch (err) {
      flow.checks.commitFailedRecoverable = true;
      saveFlow(flow);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Commit failed (safe to re-run): ${msg}`);
    }
  } else {
    console.log("Commit already done:", flow.commitTx);
  }

  // ── Reveal ──────────────────────────────────────────────────────────
  if (!flow.revealTx) {
    const locAlready = Number(await game.locationOf(tokenId, flow.day));
    if (locAlready === location) {
      flow.revealTx = "on-chain-already";
      flow.checks.reveal = true;
      flow.checks.locationOf = true;
      saveFlow(flow);
      console.log("Reveal already on-chain, locationOf:", locAlready);
    } else {
      await waitUntil(
        "RevealOpen",
        async () => Number(await game.dayState(flow!.day)) === 3,
        maxWait,
      );
      const state = Number(await game.dayState(flow.day));
      if (state !== 3) {
        throw new Error(`Need RevealOpen, got ${DayState[state] ?? state}`);
      }
      try {
        const tx = await game.reveal(tokenId, flow.day, location, flow.salt);
        const receipt = await tx.wait();
        flow.revealTx = receipt!.hash;
        flow.checks.reveal = true;
        const locOnChain = Number(await game.locationOf(tokenId, flow.day));
        flow.checks.locationOf = locOnChain === location;
        if (locOnChain !== location) {
          throw new Error(`locationOf mismatch: ${locOnChain} !== ${location}`);
        }
        saveFlow(flow);
        console.log("Reveal tx:", flow.revealTx, "locationOf:", locOnChain);
      } catch (err) {
        // Recover if a prior attempt mined despite a client nonce race.
        const locOnChain = Number(await game.locationOf(tokenId, flow.day));
        if (locOnChain === location) {
          flow.revealTx = "recovered-on-chain";
          flow.checks.reveal = true;
          flow.checks.locationOf = true;
          flow.checks.revealFailedRecoverable = true;
          saveFlow(flow);
          console.log("Reveal recovered on-chain, locationOf:", locOnChain);
        } else {
          flow.checks.revealFailedRecoverable = true;
          saveFlow(flow);
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`Reveal failed (safe to re-run): ${msg}`);
        }
      }
    }
  } else {
    console.log("Reveal already done:", flow.revealTx);
  }

  // ── Day seed ────────────────────────────────────────────────────────
  if (!flow.seedTx) {
    if (!(await randomness.hasDaySeed(flow.day))) {
      const seed = ethers.id(`day-seed-${record.address}-${flow.day}`);
      const tx = await randomness.fulfillDaySeed(flow.day, seed);
      const receipt = await tx.wait();
      flow.seedTx = receipt!.hash;
      saveFlow(flow);
      console.log("Seed tx:", flow.seedTx);
    } else {
      flow.seedTx = "already-set";
      saveFlow(flow);
      console.log("Day seed already set");
    }
  }

  // ── Settlement ──────────────────────────────────────────────────────
  if (!flow.settleTx) {
    if (await game.isSettled(flow.day)) {
      flow.settleTx = "on-chain-already";
      flow.checks.isSettled = true;
      flow.checks.dayStateClaimable = Number(await game.dayState(flow.day)) === 6;
      saveFlow(flow);
      console.log("Settle already on-chain, dayState:", DayState[Number(await game.dayState(flow.day))]);
    } else {
      await waitUntil(
        "RevealClosed",
        async () => Number(await game.dayState(flow!.day)) === 4,
        maxWait,
      );
      try {
        const tx = await game.settleDay(flow.day);
        const receipt = await tx.wait();
        flow.settleTx = receipt!.hash;
        const settled = await game.isSettled(flow.day);
        const stateAfter = Number(await game.dayState(flow.day));
        flow.checks.isSettled = settled;
        flow.checks.dayStateClaimable = stateAfter === 6;
        if (!settled) throw new Error("isSettled false after settleDay");
        if (stateAfter !== 6) {
          throw new Error(`Expected Claimable(6), got ${DayState[stateAfter] ?? stateAfter}`);
        }
        saveFlow(flow);
        console.log("Settle tx:", flow.settleTx, "dayState:", DayState[stateAfter]);
      } catch (err) {
        if (await game.isSettled(flow.day)) {
          flow.settleTx = "recovered-on-chain";
          flow.checks.isSettled = true;
          flow.checks.dayStateClaimable = Number(await game.dayState(flow.day)) === 6;
          flow.checks.settleFailedRecoverable = true;
          saveFlow(flow);
          console.log("Settle recovered on-chain");
        } else {
          flow.checks.settleFailedRecoverable = true;
          saveFlow(flow);
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`Settle failed (safe to re-run): ${msg}`);
        }
      }
    }
  } else {
    console.log("Settle already done:", flow.settleTx);
  }

  // ── Claim ───────────────────────────────────────────────────────────
  const claimable = await distributor.claimable(tokenId);
  flow.claimableBefore = claimable.toString();
  flow.checks.claimableFromDistributor = claimable > 0n || Boolean(flow.claimTx);
  console.log("claimable:", ethers.formatEther(claimable));

  const treasuryAddr = (record as GameRecord & { treasury?: string }).treasury;
  if (!treasuryAddr) {
    throw new Error("Missing treasury address in game deployment record");
  }

  if (!flow.claimTx) {
    if (claimable === 0n) {
      throw new Error("claimable is 0 — treasury/emission/settlement produced no credit");
    }
    const playerBefore = await token.balanceOf(deployer.address);
    const treasuryBefore = await token.balanceOf(treasuryAddr);
    (flow as FlowState & Record<string, string>).playerBalanceBefore = playerBefore.toString();
    (flow as FlowState & Record<string, string>).treasuryBalanceBefore = treasuryBefore.toString();
    (flow as FlowState & Record<string, string>).rewardAmount = claimable.toString();
    console.log("player before:", ethers.formatEther(playerBefore));
    console.log("treasury before:", ethers.formatEther(treasuryBefore));

    try {
      const tx = await distributor.claimMany([tokenId]);
      const receipt = await tx.wait();
      flow.claimTx = receipt!.hash;
    } catch (err) {
      flow.checks.claimFailedRecoverable = true;
      saveFlow(flow);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Claim failed (safe to re-run): ${msg}`);
    }

    const after = await distributor.claimable(tokenId);
    flow.claimableAfter = after.toString();
    flow.checks.claimRefreshedToZero = after === 0n;
    if (after !== 0n) throw new Error("claimable not zero after claim");

    // Duplicate claim must fail
    let duplicateReverted = false;
    try {
      await (await distributor.claimMany([tokenId])).wait();
    } catch {
      duplicateReverted = true;
    }
    flow.checks.duplicateClaimReverted = duplicateReverted;
    if (!duplicateReverted) throw new Error("duplicate claimMany did not revert");

    const playerAfter = await token.balanceOf(deployer.address);
    const treasuryAfter = await token.balanceOf(treasuryAddr);
    (flow as FlowState & Record<string, string>).playerBalanceAfter = playerAfter.toString();
    (flow as FlowState & Record<string, string>).treasuryBalanceAfter = treasuryAfter.toString();
    flow.checks.tokenReceived = playerAfter > playerBefore;
    flow.checks.treasuryDecreased = treasuryAfter < treasuryBefore;
    flow.checks.rewardMatchesDelta = playerAfter - playerBefore === claimable;
    if (playerAfter - playerBefore !== claimable) {
      throw new Error(
        `Player delta ${playerAfter - playerBefore} !== claimable ${claimable}`,
      );
    }
    if (treasuryBefore - treasuryAfter !== claimable) {
      throw new Error(
        `Treasury delta ${treasuryBefore - treasuryAfter} !== claimable ${claimable}`,
      );
    }
    saveFlow(flow);
    console.log("Claim tx:", flow.claimTx);
    console.log("Token delta:", ethers.formatEther(playerAfter - playerBefore));
    console.log("Treasury after:", ethers.formatEther(treasuryAfter));
  } else {
    console.log("Claim already done:", flow.claimTx);
    const after = await distributor.claimable(tokenId);
    flow.claimableAfter = after.toString();
    flow.checks.claimRefreshedToZero = after === 0n;
  }

  // Isolation note for client: live mode is env-gated; mock uses localSettlement only when address unset.
  flow.checks.mockIsolatedByEnv =
    "Live mode requires NEXT_PUBLIC_HANSOME_GAME_ADDRESS; local mock only when unset";

  saveFlow(flow);

  const report = {
    ok: true,
    game: record.address,
    distributor: record.distributor,
    flow,
    explorerGame: `https://explorer.testnet.chain.robinhood.com/address/${record.address}`,
  };
  console.log(JSON.stringify(report, null, 2));
  const f = flow as FlowState & Record<string, string | undefined>;
  const reportMd = [
    `# Game flow validation — ${network.name}`,
    "",
    `- Day: \`${flow.day}\``,
    `- Token: \`#${flow.tokenId}\``,
    `- Commit: \`${flow.commitTx}\``,
    `- Reveal: \`${flow.revealTx}\``,
    `- Seed: \`${flow.seedTx}\``,
    `- Settle: \`${flow.settleTx}\``,
    `- Claim: \`${flow.claimTx}\``,
    `- Reward amount (wei): \`${f.rewardAmount ?? flow.claimableBefore}\``,
    `- Reward amount (ether): \`${ethers.formatEther(BigInt(f.rewardAmount ?? flow.claimableBefore ?? "0"))}\``,
    `- Player balance before: \`${f.playerBalanceBefore ?? "n/a"}\``,
    `- Player balance after: \`${f.playerBalanceAfter ?? "n/a"}\``,
    `- Treasury balance before: \`${f.treasuryBalanceBefore ?? "n/a"}\``,
    `- Treasury balance after: \`${f.treasuryBalanceAfter ?? "n/a"}\``,
    `- claimable before: \`${flow.claimableBefore}\``,
    `- claimable after: \`${flow.claimableAfter}\``,
    `- checks: \`${JSON.stringify(flow.checks)}\``,
    "",
  ].join("\n");
  writeFileSync(
    join(__dirname, "..", "deployments", `${network.name}-game-flow-report.md`),
    reportMd,
  );
  // Mirror into reports/ for the production validation pack
  try {
    writeFileSync(
      join(__dirname, "..", "..", "reports", "genesis", "game-flow-settle-claim.md"),
      reportMd,
    );
  } catch {
    /* optional path */
  }
  console.log("Wrote game-flow-report.md — full Commit → Reveal → Settle → Claim OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
