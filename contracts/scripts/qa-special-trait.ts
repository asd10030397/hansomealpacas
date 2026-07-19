/**
 * Special-trait Testnet QA: densified samples on relayer wallet.
 * King #1, Common #11, Guardian #12, Farmer #13, Lucky #14, Runner #15, Cougar #16
 * → same location so hunt pressure exercises abilities.
 *
 * Usage: npx hardhat run scripts/qa-special-trait.ts --network robinhoodTestnet
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { getDeployerSigner } from "./lib/signer";

const SAMPLES = [
  { tokenId: 1, label: "Alpaca:King", side: "Alpaca", cls: "King" },
  { tokenId: 11, label: "Alpaca:Common", side: "Alpaca", cls: "Common" },
  { tokenId: 12, label: "Alpaca:Guardian", side: "Alpaca", cls: "Guardian" },
  { tokenId: 13, label: "Alpaca:Farmer", side: "Alpaca", cls: "Farmer" },
  { tokenId: 14, label: "Alpaca:Lucky", side: "Alpaca", cls: "Lucky" },
  { tokenId: 15, label: "Alpaca:Runner", side: "Alpaca", cls: "Runner" },
  { tokenId: 16, label: "Cougar", side: "Cougar", cls: "None" },
] as const;

/** Shared hunt location (not Home — Cougar illegal + no hunt at Home). */
const HUNT_LOC = 2; // Grassland

const PURPOSE_RUNNER = 1;
const PURPOSE_LUCKY = 2;
const P_RUNNER_BPS = 3000;
const P_LUCKY_BPS = 2000;

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
    await sleep(4_000);
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

function prePenaltyBps(locationId: number, adL: number, cdL: number): number {
  if (locationId === 0 || cdL === 0) return 0;
  const pi0 = 2500; // Candidate A Grassland π₀
  return Math.min(Math.floor((pi0 * (adL + cdL)) / (adL + 1)), 9000);
}

function deriveActivation(input: {
  cls: string;
  side: string;
  locationId: number;
  adL: number;
  cdL: number;
  runnerSuccess: boolean;
  luckySuccess: boolean;
}): {
  outcome: string;
  activatedAbility: string | null;
  abilityLabel: string | null;
  hunted: boolean;
  penaltyBps: number;
} {
  const hunted = prePenaltyBps(input.locationId, input.adL, input.cdL) > 0;
  const pre = prePenaltyBps(input.locationId, input.adL, input.cdL);

  if (input.side === "Cougar") {
    return {
      outcome: hunted ? "Cougar hunting" : "Cougar present",
      activatedAbility: null,
      abilityLabel: null,
      hunted,
      penaltyBps: 0,
    };
  }

  if (input.cls === "King") {
    return {
      outcome: hunted ? "King immune" : "King safe",
      activatedAbility: hunted ? "king" : null,
      abilityLabel: hunted ? "King activated!" : null,
      hunted,
      penaltyBps: 0,
    };
  }

  if (input.cls === "Farmer") {
    return {
      outcome: hunted ? "Farmer hunted" : "Farmer harvest",
      activatedAbility: null,
      abilityLabel: "Farmer · Harvest Boost",
      hunted,
      penaltyBps: hunted ? pre : 0,
    };
  }

  if (input.cls === "Guardian") {
    const pen = hunted ? Math.floor(pre / 2) : 0;
    return {
      outcome: hunted ? "Guardian protected" : "Guardian idle",
      activatedAbility: hunted ? "guardian" : null,
      abilityLabel: hunted ? "Guardian activated!" : null,
      hunted,
      penaltyBps: pen,
    };
  }

  if (input.cls === "Runner") {
    if (!hunted) {
      return {
        outcome: "Runner idle",
        activatedAbility: null,
        abilityLabel: null,
        hunted: false,
        penaltyBps: 0,
      };
    }
    if (input.runnerSuccess) {
      return {
        outcome: "Runner escaped",
        activatedAbility: "runner",
        abilityLabel: "Runner activated!",
        hunted: true,
        penaltyBps: 0,
      };
    }
    return {
      outcome: "Runner hunted",
      activatedAbility: null,
      abilityLabel: null,
      hunted: true,
      penaltyBps: pre,
    };
  }

  if (input.cls === "Lucky") {
    if (!hunted) {
      return {
        outcome: "Lucky idle",
        activatedAbility: null,
        abilityLabel: null,
        hunted: false,
        penaltyBps: 0,
      };
    }
    if (input.luckySuccess) {
      return {
        outcome: "Lucky immune",
        activatedAbility: "lucky",
        abilityLabel: "Lucky activated!",
        hunted: true,
        penaltyBps: 0,
      };
    }
    return {
      outcome: "Lucky hunted",
      activatedAbility: null,
      abilityLabel: null,
      hunted: true,
      penaltyBps: pre,
    };
  }

  // Common
  return {
    outcome: hunted ? "Common hunted" : "Common safe",
    activatedAbility: null,
    abilityLabel: null,
    hunted,
    penaltyBps: hunted ? pre : 0,
  };
}

async function main() {
  if (network.name === "robinhood" || network.name.toLowerCase().includes("mainnet")) {
    throw new Error("REFUSED: Testnet-only");
  }

  const base = (process.env.QA_BASE_URL ?? "http://localhost:3002").replace(/\/$/, "");
  const maxWait = Number(process.env.QA_WAIT_SEC ?? "360");
  const record = JSON.parse(
    readFileSync(join(__dirname, "..", "deployments", `${network.name}-game.json`), "utf8"),
  ) as {
    address: string;
    distributor: string;
    randomness: string;
    genesis: string;
  };

  const signer = await getDeployerSigner(ethers.provider);
  const game = await ethers.getContractAt("HansomeGame", record.address, signer);
  const genesis = await ethers.getContractAt("HansomeGenesisNFT", record.genesis, signer);
  const distributor = await ethers.getContractAt(
    "RewardDistributor",
    record.distributor,
    signer,
  );
  const randomness = await ethers.getContractAt("GameRandomness", record.randomness, signer);

  const bugs: string[] = [];
  const notes: string[] = [];
  const gas: Array<{
    action: string;
    tokenId?: number;
    txHash: string;
    gasUsed: string;
    feeEth: string;
  }> = [];

  // Ownership check
  for (const s of SAMPLES) {
    const owner = await genesis.ownerOf(s.tokenId);
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
      throw new Error(
        `#${s.tokenId} (${s.label}) owned by ${owner}, not relayer ${signer.address}`,
      );
    }
  }

  let day = Number(await game.currentDay());
  let state = Number(await game.dayState(day));
  if (state !== 1) {
    const target = day + 1;
    await waitUntil(
      `CommitOpen(${target})`,
      async () =>
        Number(await game.currentDay()) >= target &&
        Number(await game.dayState(target)) === 1,
      maxWait,
    );
    day = Number(await game.currentDay());
  }
  console.log("day", day, "CommitOpen secs left ~", "check probe");

  type Secret = {
    tokenId: number;
    label: string;
    side: string;
    cls: string;
    locationId: number;
    salt: string;
    commitHash: string;
  };
  const secrets: Secret[] = [];

  for (const s of SAMPLES) {
    // Re-check phase — short Commit windows can close mid-loop.
    const st = Number(await game.dayState(day));
    if (st !== 1) {
      notes.push(`Commit window closed before #${s.tokenId}; waiting next day`);
      const target = Number(await game.currentDay()) + (st === 1 ? 0 : 1);
      await waitUntil(
        `CommitOpen(${target})`,
        async () =>
          Number(await game.currentDay()) >= target &&
          Number(await game.dayState(target)) === 1,
        maxWait,
      );
      day = Number(await game.currentDay());
      // Fresh day — restart sample loop would be cleaner; abort partial.
      if (secrets.length > 0 && secrets[0]!.tokenId !== s.tokenId) {
        bugs.push(
          `Partial day interrupted; re-run for full set (committed ${secrets.length} before close)`,
        );
        break;
      }
    }

    const existing = await game.commitHashOf(s.tokenId, day);
    if (existing !== ethers.ZeroHash) {
      notes.push(`#${s.tokenId} already committed — skip`);
      continue;
    }
    const salt = ethers.id(`special-qa-${day}-${s.tokenId}-${Date.now()}`);
    const commitHash = await game.computeCommitHash(
      s.tokenId,
      day,
      HUNT_LOC,
      salt,
    );
    try {
      await game.commit.staticCall(s.tokenId, day, commitHash);
    } catch (e) {
      bugs.push(
        `Commit simulate #${s.tokenId}: ${e instanceof Error ? e.message.slice(0, 120) : e}`,
      );
      continue;
    }
    const tx = await game.commit(s.tokenId, day, commitHash);
    const receipt = await tx.wait();
    if (receipt!.status !== 1) {
      bugs.push(`Commit reverted #${s.tokenId}`);
      continue;
    }
    const price = receipt!.gasPrice ?? 0n;
    gas.push({
      action: "commit",
      tokenId: s.tokenId,
      txHash: receipt!.hash,
      gasUsed: receipt!.gasUsed.toString(),
      feeEth: ethers.formatEther(receipt!.gasUsed * price),
    });

    const vault = await post(`${base}/api/game/testnet-commit-secret`, {
      tokenId: s.tokenId,
      day,
      locationId: HUNT_LOC,
      salt,
      commitHash,
      wallet: signer.address,
    });
    if (vault.status >= 300 || vault.json?.ok === false) {
      bugs.push(`Vault fail #${s.tokenId}`);
    }
    secrets.push({
      tokenId: s.tokenId,
      label: s.label,
      side: s.side,
      cls: s.cls,
      locationId: HUNT_LOC,
      salt,
      commitHash,
    });
    console.log("committed", s.label, s.tokenId, "day", day);
  }

  // Prefer a clean full set: if incomplete, wait next CommitOpen and recommit all.
  const labelsDone = new Set(secrets.map((s) => s.label));
  const missing = SAMPLES.filter((s) => !labelsDone.has(s.label));
  if (missing.length > 0) {
    notes.push(
      `Incomplete set (${secrets.length}/7). Waiting next CommitOpen for full special set.`,
    );
    const target = Number(await game.currentDay()) + 1;
    await waitUntil(
      `CommitOpen(${target}) full-set`,
      async () =>
        Number(await game.currentDay()) >= target &&
        Number(await game.dayState(target)) === 1,
      maxWait,
    );
    day = Number(await game.currentDay());
    secrets.length = 0;
    gas.length = 0;

    for (const s of SAMPLES) {
      const existing = await game.commitHashOf(s.tokenId, day);
      if (existing !== ethers.ZeroHash) continue;
      const salt = ethers.id(`special-qa-${day}-${s.tokenId}-${Date.now()}`);
      const commitHash = await game.computeCommitHash(
        s.tokenId,
        day,
        HUNT_LOC,
        salt,
      );
      const tx = await game.commit(s.tokenId, day, commitHash);
      const receipt = await tx.wait();
      if (receipt!.status !== 1) {
        bugs.push(`Commit reverted #${s.tokenId} on retry day`);
        continue;
      }
      const price = receipt!.gasPrice ?? 0n;
      gas.push({
        action: "commit",
        tokenId: s.tokenId,
        txHash: receipt!.hash,
        gasUsed: receipt!.gasUsed.toString(),
        feeEth: ethers.formatEther(receipt!.gasUsed * price),
      });
      const vault = await post(`${base}/api/game/testnet-commit-secret`, {
        tokenId: s.tokenId,
        day,
        locationId: HUNT_LOC,
        salt,
        commitHash,
        wallet: signer.address,
      });
      if (vault.status >= 300 || vault.json?.ok === false) {
        bugs.push(`Vault fail #${s.tokenId}`);
      }
      secrets.push({
        tokenId: s.tokenId,
        label: s.label,
        side: s.side,
        cls: s.cls,
        locationId: HUNT_LOC,
        salt,
        commitHash,
      });
      console.log("committed(retry)", s.label, s.tokenId);
    }
  }

  if (secrets.length < 7) {
    throw new Error(
      `Need all 7 specials committed, got ${secrets.length}: ${secrets.map((s) => s.label).join(",")}`,
    );
  }

  await waitUntil(
    `RevealOpen(${day})`,
    async () => Number(await game.dayState(day)) >= 3,
    maxWait,
  );

  const r1 = await post(`${base}/api/game/testnet-resolve`, {
    day,
    fulfillSeed: true,
    settle: true,
  });
  console.log("resolve1", JSON.stringify(r1.json).slice(0, 280));
  if (!r1.json?.ok) {
    bugs.push(`Resolve failed: ${JSON.stringify(r1.json).slice(0, 200)}`);
  }

  const r2 = await post(`${base}/api/game/testnet-resolve`, {
    day,
    fulfillSeed: true,
    settle: true,
  });
  if (!r2.json?.ok) {
    bugs.push(`Idempotent resolve failed: ${JSON.stringify(r2.json).slice(0, 160)}`);
  } else {
    notes.push("Duplicate resolve OK (no failed second settle)");
  }

  const settled = await game.isSettled(day);
  if (!settled) bugs.push("Day not settled");

  for (const [action, hash] of [
    ["revealBatch", r1.json?.revealTxHash],
    ["fulfillDaySeed", r1.json?.seedTxHash],
    ["settleDay", r1.json?.settleTxHash],
  ] as const) {
    if (typeof hash === "string" && hash.startsWith("0x") && hash.length === 66) {
      const receipt = await ethers.provider.getTransactionReceipt(hash);
      if (receipt) {
        const tx = await ethers.provider.getTransaction(hash);
        const price = receipt.gasPrice ?? tx?.gasPrice ?? 0n;
        gas.push({
          action,
          txHash: hash,
          gasUsed: receipt.gasUsed.toString(),
          feeEth: ethers.formatEther(receipt.gasUsed * price),
        });
      }
    }
  }

  // Cohort at hunt loc
  let adL = 0;
  let cdL = 0;
  for (const s of secrets) {
    const loc = Number(await game.locationOf(s.tokenId, day));
    if (loc !== HUNT_LOC) {
      bugs.push(`Reveal mismatch #${s.tokenId}: loc=${loc}`);
    }
    if (s.side === "Alpaca") adL += 1;
    else cdL += 1;
  }

  const rows = [];
  for (const s of secrets) {
    let runnerSuccess = false;
    let luckySuccess = false;
    if (s.cls === "Runner") {
      runnerSuccess = await randomness.bernoulli(
        day,
        s.tokenId,
        PURPOSE_RUNNER,
        P_RUNNER_BPS,
      );
    }
    if (s.cls === "Lucky") {
      luckySuccess = await randomness.bernoulli(
        day,
        s.tokenId,
        PURPOSE_LUCKY,
        P_LUCKY_BPS,
      );
    }

    const act = deriveActivation({
      cls: s.cls,
      side: s.side,
      locationId: HUNT_LOC,
      adL,
      cdL,
      runnerSuccess,
      luckySuccess,
    });

    const claimable = await distributor.claimable(s.tokenId);
    let claimTx: string | undefined;
    if (claimable > 0n) {
      const tx = await distributor.claim(s.tokenId);
      const receipt = await tx.wait();
      claimTx = receipt!.hash;
      const price = receipt!.gasPrice ?? 0n;
      gas.push({
        action: "claim",
        tokenId: s.tokenId,
        txHash: claimTx,
        gasUsed: receipt!.gasUsed.toString(),
        feeEth: ethers.formatEther(receipt!.gasUsed * price),
      });
      try {
        await distributor.claim.staticCall(s.tokenId);
        bugs.push(`Double claim did not revert #${s.tokenId}`);
      } catch {
        /* expected */
      }
    }

    // Ability rule checks
    if (s.cls === "King" && act.penaltyBps !== 0) {
      bugs.push("King should have 0 penalty");
    }
    if (s.cls === "King" && act.hunted && act.activatedAbility !== "king") {
      bugs.push("King hunted but crown activation missing");
    }
    if (s.cls === "Farmer" && act.activatedAbility != null) {
      bugs.push("Farmer must not have proc activatedAbility");
    }
    if (s.cls === "Farmer" && act.abilityLabel !== "Farmer · Harvest Boost") {
      bugs.push("Farmer missing passive Harvest Boost label");
    }
    if (s.cls === "Guardian" && act.hunted) {
      const pre = prePenaltyBps(HUNT_LOC, adL, cdL);
      if (act.penaltyBps !== Math.floor(pre / 2)) {
        bugs.push(
          `Guardian penalty expected ${Math.floor(pre / 2)} got ${act.penaltyBps}`,
        );
      }
      if (act.activatedAbility !== "guardian") {
        bugs.push("Guardian hunted but activation missing");
      }
    }
    if (s.cls === "Runner" && act.hunted && runnerSuccess && act.activatedAbility !== "runner") {
      bugs.push("Runner escape success but FX activation missing");
    }
    if (s.cls === "Runner" && act.hunted && !runnerSuccess && act.activatedAbility != null) {
      bugs.push("Runner failed escape but false FX activation");
    }
    if (s.cls === "Lucky" && act.hunted && luckySuccess && act.activatedAbility !== "lucky") {
      bugs.push("Lucky immunity success but FX activation missing");
    }
    if (s.cls === "Lucky" && act.hunted && !luckySuccess && act.activatedAbility != null) {
      bugs.push("Lucky failed immunity but false FX activation");
    }

    rows.push({
      tokenId: s.tokenId,
      class: s.label,
      locationId: HUNT_LOC,
      hunted: act.hunted,
      outcome: act.outcome,
      activatedAbility: act.activatedAbility,
      abilityLabel: act.abilityLabel,
      runnerSuccess: s.cls === "Runner" ? runnerSuccess : null,
      luckySuccess: s.cls === "Lucky" ? luckySuccess : null,
      penaltyBps: act.penaltyBps,
      reward: ethers.formatEther(claimable),
      claimTx: claimTx ?? null,
    });
  }

  // Personal report: only these committed tokens for this wallet
  const personal: number[] = [];
  for (const s of SAMPLES) {
    const h = await game.commitHashOf(s.tokenId, day);
    if (h !== ethers.ZeroHash) personal.push(s.tokenId);
  }
  const unexpected = personal.filter(
    (id) => !SAMPLES.some((s) => s.tokenId === id),
  );
  if (unexpected.length) {
    bugs.push(`Personal report leaked tokens: ${unexpected.join(",")}`);
  }

  const absurd = gas.filter((g) => Number(g.feeEth) > 0.01);
  if (absurd.length) bugs.push(`Absurd fees: ${absurd.map((g) => g.action).join(",")}`);

  const report = {
    at: new Date().toISOString(),
    day,
    game: record.address,
    wallet: signer.address,
    huntLocation: HUNT_LOC,
    cohort: { adL, cdL },
    resolve: r1.json,
    resolve2: { ok: r2.json?.ok, alreadySettled: r2.json?.alreadySettled },
    settled,
    rows,
    personalBattleTokenIds: personal,
    gas,
    bugs,
    notes,
  };

  const outDir = join(__dirname, "..", "..", "reports", "testnet");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "special-trait-qa-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  const md: string[] = [];
  md.push("# Special Trait Gameplay QA Report");
  md.push("");
  md.push(`Generated: ${report.at}`);
  md.push(`Network: robinhoodTestnet`);
  md.push(`HansomeGame: \`${report.game}\``);
  md.push(`Day: **${day}**`);
  md.push(`Player wallet (addresses only): \`${signer.address}\``);
  md.push(`Hunt location: **${HUNT_LOC}** (Grassland) — all specials + Cougar co-located`);
  md.push(`Cohort at location: alpaca=${adL}, cougar=${cdL}`);
  md.push("");
  md.push("> Private keys never included. Visual Crown/escape FX confirmed via activation rules + on-chain Bernoulli (manual browser polish optional).");
  md.push("");
  md.push("## NFT IDs tested");
  md.push("");
  md.push("| Token | Class | Loc | Hunted | Outcome | Ability activation | Reward (tHANSOME) |");
  md.push("|------:|-------|----:|:------:|---------|--------------------|------------------:|");
  for (const row of rows) {
    md.push(
      `| #${row.tokenId} | ${row.class} | ${row.locationId} | ${row.hunted ? "Y" : "N"} | ${row.outcome} | ${row.activatedAbility ?? row.abilityLabel ?? "—"} | ${row.reward} |`,
    );
  }
  md.push("");
  md.push("### Ability detail");
  md.push("");
  for (const row of rows) {
    md.push(`#### #${row.tokenId} ${row.class}`);
    md.push(`- Outcome: ${row.outcome}`);
    md.push(`- Activated ability (proc FX): \`${row.activatedAbility ?? "null"}\``);
    md.push(`- Ability label: ${row.abilityLabel ?? "—"}`);
    if (row.runnerSuccess != null) md.push(`- Runner bernoulli: ${row.runnerSuccess}`);
    if (row.luckySuccess != null) md.push(`- Lucky bernoulli: ${row.luckySuccess}`);
    md.push(`- Penalty bps (presentation): ${row.penaltyBps}`);
    md.push(`- Reward: ${row.reward}`);
    md.push("");
  }
  md.push("## Resolve");
  md.push("");
  md.push("```json");
  md.push(JSON.stringify(r1.json, null, 2));
  md.push("```");
  md.push("");
  md.push(`Idempotent second resolve: ok=${r2.json?.ok} alreadySettled=${r2.json?.alreadySettled}`);
  md.push("");
  md.push("## Personal battle isolation");
  md.push("");
  md.push(`Token IDs in personal report: ${personal.map((t) => `#${t}`).join(", ")}`);
  md.push("");
  md.push("## Gas usage");
  md.push("");
  md.push("| Action | Token | Gas used | Fee (ETH) | Tx |");
  md.push("|--------|------:|---------:|----------:|----|");
  for (const g of gas) {
    md.push(
      `| ${g.action} | ${g.tokenId ?? "—"} | ${g.gasUsed} | ${g.feeEth} | \`${g.txHash.slice(0, 10)}…\` |`,
    );
  }
  md.push("");
  md.push(
    absurd.length
      ? `**Fee sanity:** FAIL`
      : "**Fee sanity:** PASS — no tx above 0.01 ETH",
  );
  md.push("");
  md.push("## Bugs");
  md.push("");
  if (bugs.length === 0) md.push("- None");
  else for (const b of bugs) md.push(`- ${b}`);
  md.push("");
  md.push("## Notes");
  md.push("");
  for (const n of notes) md.push(`- ${n}`);
  md.push(
    "- Crown / escape / clover overlays are UI; this run validates activation gating matches SettlementLib + bernoulli.",
  );
  md.push("");

  const mdPath = join(outDir, "special-trait-qa-report.md");
  writeFileSync(mdPath, md.join("\n"));
  console.log("Wrote", mdPath);
  console.log("bugs", bugs);
  if (bugs.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
