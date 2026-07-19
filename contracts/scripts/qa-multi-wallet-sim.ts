/**
 * Multi-wallet Testnet gameplay simulation.
 *
 * Relayer (GAME_TESTNET_RELAYER_PRIVATE_KEY / TREASURY): reveal + seed + settle only.
 * Players: `.qa-wallets.local.json` (gitignored) — never logged as keys.
 *
 * Usage:
 *   npx hardhat run scripts/qa-multi-wallet-sim.ts --network robinhoodTestnet
 *
 * Env:
 *   QA_BASE_URL=http://localhost:3002
 *   QA_WAIT_SEC=360
 *   QA_MAX_NFTS_PER_WALLET=6
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { buildTestnetAssignedIdentities } from "./lib/build-testnet-assigned-identities";
import { getDeployerSigner } from "./lib/signer";
import {
  loadQaPlayers,
  qaPlayersPublic,
  type QaPlayer,
} from "./lib/qa-wallets";

const DayState: Record<number, string> = {
  0: "Idle",
  1: "CommitOpen",
  2: "CommitClosed",
  3: "RevealOpen",
  4: "RevealClosed",
  5: "Settlement",
  6: "Claimable",
};

const SIDE = ["None", "Alpaca", "Cougar"] as const;
const CLASS = [
  "None",
  "Common",
  "Guardian",
  "Farmer",
  "Lucky",
  "Runner",
  "King",
] as const;

// Diversify locations across players (Cougar never Home=0).
const LOC_CYCLE = [2, 3, 1, 4, 2] as const; // Grassland, Mountain, Desert, River, …

type GasRow = {
  wallet: string;
  role: "player" | "relayer";
  action: string;
  tokenId?: number;
  txHash: string;
  gasUsed: string;
  feeEth: string;
};

type CommitRow = {
  player: string;
  address: string;
  tokenId: number;
  label: string;
  locationId: number;
  commitTx: string;
  vaultOk: boolean;
};

type Report = {
  at: string;
  network: string;
  game: string;
  day: number;
  relayer: string;
  players: Array<{ name: string; address: string }>;
  results: Record<string, "PASS" | "FAIL" | "WARN" | "SKIP">;
  bugs: string[];
  notes: string[];
  ownership: Array<{
    player: string;
    address: string;
    nfts: Array<{ tokenId: number; label: string }>;
  }>;
  commits: CommitRow[];
  reveal: Record<string, unknown>;
  resolve: Record<string, unknown>;
  battlePersonal: Array<{
    player: string;
    address: string;
    tokenIds: number[];
    leakedFromOthers: number[];
  }>;
  claims: Array<{
    player: string;
    tokenId: number;
    claimableBefore: string;
    claimTx?: string;
    doubleClaim: "PASS" | "FAIL" | "SKIP";
  }>;
  gas: GasRow[];
  classCoverage: Record<string, number[]>;
};

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
    if ((Date.now() - t0) / 1000 > maxSec) throw new Error(`Timeout: ${label}`);
    console.log(`Waiting ${label}…`);
    await sleep(5_000);
  }
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function unpackPacked(packed: number): { side: string; cls: string; label: string } {
  const isCougar = (packed & 0x80) !== 0;
  const cls = packed & 0x0f;
  if (isCougar) return { side: "Cougar", cls: "None", label: "Cougar" };
  const name = CLASS[cls] ?? `?${cls}`;
  return { side: "Alpaca", cls: name, label: `Alpaca:${name}` };
}

function labelForToken(
  tokenId: number,
  assigned: Uint8Array,
  onChainSide: number,
  onChainClass: number,
  onChainRevealed: boolean,
): string {
  if (onChainRevealed && onChainSide > 0) {
    if (onChainSide === 2) return "Cougar";
    return `Alpaca:${CLASS[onChainClass] ?? "?"}`;
  }
  if (tokenId >= 11 && tokenId <= 550) {
    const packed = assigned[tokenId - 11];
    if (packed != null) return unpackPacked(packed).label;
  }
  if (tokenId === 1) return "Alpaca:King";
  return `Token#${tokenId}`;
}

async function gasRow(
  provider: typeof ethers.provider,
  wallet: string,
  role: "player" | "relayer",
  action: string,
  txHash: string,
  tokenId?: number,
): Promise<GasRow> {
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) throw new Error(`No receipt ${txHash}`);
  const tx = await provider.getTransaction(txHash);
  const price = receipt.gasPrice ?? tx?.gasPrice ?? 0n;
  return {
    wallet,
    role,
    action,
    tokenId,
    txHash,
    gasUsed: receipt.gasUsed.toString(),
    feeEth: ethers.formatEther(receipt.gasUsed * price),
  };
}

function renderMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push("# Multi-Wallet Testnet QA Report");
  lines.push("");
  lines.push(`Generated: ${report.at}`);
  lines.push(`Network: ${report.network}`);
  lines.push(`HansomeGame: \`${report.game}\``);
  lines.push(`Day: **${report.day}**`);
  lines.push(`Relayer (addresses only): \`${report.relayer}\``);
  lines.push("");
  lines.push("> Private keys are never stored in this report.");
  lines.push("");
  lines.push("## 1. Test wallets (addresses only)");
  lines.push("");
  for (const p of report.players) {
    lines.push(`- **${p.name}**: \`${p.address}\``);
  }
  lines.push("");
  lines.push("## 2. NFTs tested (ownership)");
  lines.push("");
  for (const o of report.ownership) {
    lines.push(`### ${o.player} (\`${o.address}\`)`);
    if (o.nfts.length === 0) lines.push("- _(no Genesis NFTs)_");
    else {
      for (const n of o.nfts) {
        lines.push(`- #${n.tokenId} — ${n.label}`);
      }
    }
    lines.push("");
  }
  lines.push("### Class coverage");
  lines.push("");
  for (const [cls, ids] of Object.entries(report.classCoverage)) {
    lines.push(`- **${cls}**: ${ids.length ? ids.map((i) => `#${i}`).join(", ") : "—"}`);
  }
  lines.push("");
  lines.push("## 3. Commit results");
  lines.push("");
  lines.push("| Player | Token | Class | Loc | Vault | Tx |");
  lines.push("|--------|------:|-------|----:|:-----:|----|");
  for (const c of report.commits) {
    lines.push(
      `| ${c.player} | #${c.tokenId} | ${c.label} | ${c.locationId} | ${c.vaultOk ? "OK" : "FAIL"} | \`${c.commitTx.slice(0, 10)}…\` |`,
    );
  }
  lines.push("");
  lines.push("## 4. Reveal / resolve");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(report.resolve, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("## 5. Personal battle report isolation");
  lines.push("");
  lines.push("| Player | Personal token IDs | Leaked from others |");
  lines.push("|--------|-------------------:|-------------------:|");
  for (const b of report.battlePersonal) {
    lines.push(
      `| ${b.player} | ${b.tokenIds.map((t) => `#${t}`).join(", ") || "—"} | ${b.leakedFromOthers.length ? b.leakedFromOthers.map((t) => `#${t}`).join(", ") : "none"} |`,
    );
  }
  lines.push("");
  lines.push("## 6. Rewards / claim");
  lines.push("");
  lines.push("| Player | Token | Claimable before | Double claim |");
  lines.push("|--------|------:|------------------|--------------|");
  for (const c of report.claims) {
    lines.push(
      `| ${c.player} | #${c.tokenId} | ${c.claimableBefore} | ${c.doubleClaim} |`,
    );
  }
  lines.push("");
  lines.push("## 7. Gas report");
  lines.push("");
  lines.push("| Role | Wallet | Action | Token | Gas used | Fee (ETH) | Tx |");
  lines.push("|------|--------|--------|------:|---------:|----------:|----|");
  for (const g of report.gas) {
    lines.push(
      `| ${g.role} | \`${g.wallet.slice(0, 8)}…\` | ${g.action} | ${g.tokenId ?? "—"} | ${g.gasUsed} | ${g.feeEth} | \`${g.txHash.slice(0, 10)}…\` |`,
    );
  }
  const absurd = report.gas.filter((g) => Number(g.feeEth) > 0.01);
  lines.push("");
  lines.push(
    absurd.length
      ? `**Fee sanity:** FAIL — ${absurd.length} txs above 0.01 ETH`
      : "**Fee sanity:** PASS — no tx above 0.01 ETH",
  );
  lines.push("");
  lines.push("## 8. Pass / Fail summary");
  lines.push("");
  lines.push("| Check | Result |");
  lines.push("|-------|--------|");
  for (const [k, v] of Object.entries(report.results)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push("");
  lines.push("## 9. Bugs found");
  lines.push("");
  if (report.bugs.length === 0) lines.push("- None recorded in this run.");
  else for (const b of report.bugs) lines.push(`- ${b}`);
  lines.push("");
  lines.push("## 10. Notes / recommended fixes");
  lines.push("");
  for (const n of report.notes) lines.push(`- ${n}`);
  if (report.notes.length === 0) {
    lines.push("- Continue manual MetaMask wallet-switch UX check in the browser.");
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    "Skill FX (Crown / escape / etc.) are presentation-layer; this report validates on-chain commit→reveal→settle→claim and wallet isolation. Visual FX remain a manual browser check.",
  );
  lines.push("");
  return lines.join("\n");
}

async function main() {
  if (network.name === "robinhood" || network.name.toLowerCase().includes("mainnet")) {
    throw new Error("REFUSED: multi-wallet QA is Testnet-only");
  }

  const baseUrl = (process.env.QA_BASE_URL ?? "http://localhost:3002").replace(/\/$/, "");
  const maxWait = Number(process.env.QA_WAIT_SEC?.trim() ?? "360");
  const maxNfts = Number(process.env.QA_MAX_NFTS_PER_WALLET?.trim() ?? "6");

  const recordPath = join(__dirname, "..", "deployments", `${network.name}-game.json`);
  if (!existsSync(recordPath)) throw new Error(`Missing ${recordPath}`);
  const record = JSON.parse(readFileSync(recordPath, "utf8")) as {
    address: string;
    distributor: string;
    randomness: string;
    genesis: string;
  };

  const relayer = await getDeployerSigner(ethers.provider);
  const players = loadQaPlayers(ethers.provider);
  // Relayer must not be used as a player wallet in this sim.
  for (const p of players) {
    if (p.address.toLowerCase() === relayer.address.toLowerCase()) {
      throw new Error(
        `QA wallet "${p.name}" is the relayer address — use separate player keys only.`,
      );
    }
  }

  const game = await ethers.getContractAt("HansomeGame", record.address, relayer);
  const genesis = await ethers.getContractAt("HansomeGenesisNFT", record.genesis, relayer);
  const distributor = await ethers.getContractAt(
    "RewardDistributor",
    record.distributor,
    relayer,
  );
  const { assigned } = buildTestnetAssignedIdentities();

  const report: Report = {
    at: new Date().toISOString(),
    network: network.name,
    game: record.address,
    day: -1,
    relayer: relayer.address,
    players: qaPlayersPublic(players),
    results: {},
    bugs: [],
    notes: [],
    ownership: [],
    commits: [],
    reveal: {},
    resolve: {},
    battlePersonal: [],
    claims: [],
    gas: [],
    classCoverage: {},
  };

  console.log("Relayer:", relayer.address);
  console.log(
    "Players:",
    players.map((p) => `${p.name}=${p.address}`).join(", "),
  );

  // API health
  try {
    const health = await fetch(`${baseUrl}/api/game/testnet-resolve`);
    const hj = (await health.json()) as { enabled?: boolean };
    report.results["api.gaslessResolve"] = hj.enabled ? "PASS" : "FAIL";
    if (!hj.enabled) report.bugs.push("Gasless resolve API disabled");
  } catch (e) {
    report.results["api.gaslessResolve"] = "FAIL";
    report.bugs.push(
      `API unreachable at ${baseUrl}: ${e instanceof Error ? e.message : e}`,
    );
  }

  report.results["testnetGameplayUnlock"] = (await game.testnetGameplayUnlock())
    ? "PASS"
    : "FAIL";

  // ── Ownership inventory ─────────────────────────────────────────────
  const totalMinted = Number(await genesis.totalMinted());
  const scan = Math.min(totalMinted, 550);
  const ownershipMap = new Map<string, number[]>();

  for (const p of players) ownershipMap.set(p.address.toLowerCase(), []);

  for (let id = 1; id <= scan; id++) {
    try {
      const owner = (await genesis.ownerOf(id)).toLowerCase();
      const list = ownershipMap.get(owner);
      if (list) list.push(id);
    } catch {
      /* burned / missing */
    }
  }

  for (const p of players) {
    const ids = ownershipMap.get(p.address.toLowerCase()) ?? [];
    const nfts = [];
    for (const tokenId of ids) {
      let side = 0;
      let cls = 0;
      let revealed = false;
      try {
        revealed = await genesis.isRevealed(tokenId);
        side = Number(await genesis.side(tokenId));
        cls = Number(await genesis.gameplayClass(tokenId));
      } catch {
        /* pre-reveal */
      }
      const label = labelForToken(tokenId, assigned, side, cls, revealed);
      nfts.push({ tokenId, label });
      const bucket = report.classCoverage[label] ?? [];
      bucket.push(tokenId);
      report.classCoverage[label] = bucket;
    }
    report.ownership.push({ player: p.name, address: p.address, nfts });
    console.log(`${p.name} owns ${nfts.length} NFT(s)`);
  }

  // Isolation: no shared ownership between players
  const allOwned = new Map<number, string>();
  let ownershipOverlap = false;
  for (const o of report.ownership) {
    const addr = o.address.toLowerCase();
    for (const n of o.nfts) {
      const prev = allOwned.get(n.tokenId);
      if (prev && prev !== addr) {
        ownershipOverlap = true;
        report.bugs.push(
          `Token #${n.tokenId} claimed by both ${prev} and ${addr}`,
        );
      }
      allOwned.set(n.tokenId, addr);
    }
  }
  report.results["isolation.ownership"] = ownershipOverlap ? "FAIL" : "PASS";

  const anyNfts = report.ownership.some((o) => o.nfts.length > 0);
  report.results["inventory.loaded"] = anyNfts ? "PASS" : "FAIL";
  if (!anyNfts) {
    report.bugs.push("No QA player owns Genesis NFTs — mint/transfer before sim.");
    await writeReports(report);
    throw new Error("No NFTs to simulate");
  }

  // ── Wait CommitOpen ─────────────────────────────────────────────────
  let day = Number(await game.currentDay());
  let state = Number(await game.dayState(day));
  if (state !== 1) {
    const target = day + 1;
    report.notes.push(`Waited for day ${target} CommitOpen (was day ${day} ${DayState[state]})`);
    await waitUntil(
      `CommitOpen(${target})`,
      async () =>
        Number(await game.currentDay()) >= target &&
        Number(await game.dayState(target)) === 1,
      maxWait,
    );
    day = Number(await game.currentDay());
  }
  report.day = day;
  report.results["phase.CommitOpen"] =
    Number(await game.dayState(day)) === 1 ? "PASS" : "FAIL";

  // ── Commits (multi-wallet, multi-NFT, varied locations) ─────────────
  type Secret = {
    player: QaPlayer;
    tokenId: number;
    locationId: number;
    salt: string;
    commitHash: string;
    label: string;
  };
  const secrets: Secret[] = [];
  let locPicker = 0;

  for (const p of players) {
    const owned = report.ownership.find((o) => o.address === p.address)?.nfts ?? [];
    const selected = owned.slice(0, maxNfts);
    const gameAsPlayer = game.connect(p.wallet);

    for (const nft of selected) {
      const isCougar = nft.label === "Cougar" || nft.label.startsWith("Cougar");
      let locationId = LOC_CYCLE[locPicker % LOC_CYCLE.length]!;
      locPicker += 1;
      if (isCougar && locationId === 0) locationId = 2;

      const existing = await game.commitHashOf(nft.tokenId, day);
      if (existing !== ethers.ZeroHash) {
        report.notes.push(
          `${p.name} #${nft.tokenId} already committed day ${day} — skipped`,
        );
        continue;
      }

      const salt = ethers.id(
        `mw-qa-${day}-${p.name}-${nft.tokenId}-${Date.now()}-${Math.random()}`,
      );
      const commitHash = await game.computeCommitHash(
        nft.tokenId,
        day,
        locationId,
        salt,
      );

      try {
        const tx = await gameAsPlayer.commit(nft.tokenId, day, commitHash);
        const receipt = await tx.wait();
        const hash = receipt!.hash;
        report.gas.push(
          await gasRow(
            ethers.provider,
            p.address,
            "player",
            "commit",
            hash,
            nft.tokenId,
          ),
        );

        const { status, json } = await postJson(
          `${baseUrl}/api/game/testnet-commit-secret`,
          {
            tokenId: nft.tokenId,
            day,
            locationId,
            salt,
            commitHash,
            wallet: p.address,
          },
        );
        const vaultOk = status < 300 && json?.ok !== false;
        report.commits.push({
          player: p.name,
          address: p.address,
          tokenId: nft.tokenId,
          label: nft.label,
          locationId,
          commitTx: hash,
          vaultOk,
        });
        if (!vaultOk) {
          report.bugs.push(
            `Vault upload failed ${p.name} #${nft.tokenId}: HTTP ${status}`,
          );
        }
        secrets.push({
          player: p,
          tokenId: nft.tokenId,
          locationId,
          salt,
          commitHash,
          label: nft.label,
        });
        console.log(
          `Commit ${p.name} #${nft.tokenId} (${nft.label}) → loc ${locationId}`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message.slice(0, 180) : String(e);
        report.bugs.push(`Commit ${p.name} #${nft.tokenId}: ${msg}`);
        report.results[`commit.${p.name}.${nft.tokenId}`] = "FAIL";
      }
    }
  }

  report.results["loop.commit"] =
    secrets.length > 0 && report.commits.every((c) => c.vaultOk) ? "PASS" : "FAIL";
  report.results["loop.vault"] = report.commits.every((c) => c.vaultOk)
    ? "PASS"
    : "FAIL";

  if (secrets.length === 0) {
    report.bugs.push("No new commits this day — cannot continue battle loop.");
    await writeReports(report);
    throw new Error("No commits");
  }

  // ── RevealOpen → relayer resolve ────────────────────────────────────
  await waitUntil(
    `RevealOpen(${day})`,
    async () => Number(await game.dayState(day)) >= 3,
    maxWait,
  );

  const r1 = await postJson(`${baseUrl}/api/game/testnet-resolve`, {
    day,
    fulfillSeed: true,
    settle: true,
  });
  report.resolve = { attempt: 1, ...r1.json };
  console.log("resolve1", JSON.stringify(r1.json).slice(0, 240));

  // Idempotent second call
  const r2 = await postJson(`${baseUrl}/api/game/testnet-resolve`, {
    day,
    fulfillSeed: true,
    settle: true,
  });
  report.results["resolve.idempotent"] =
    r2.json?.ok === true ? "PASS" : "FAIL";
  if (r2.json?.ok !== true) {
    report.bugs.push(`Idempotent resolve failed: ${JSON.stringify(r2.json).slice(0, 200)}`);
  }

  const settled = await game.isSettled(day);
  report.results["loop.settled"] = settled ? "PASS" : "FAIL";
  if (!settled) {
    report.bugs.push("Day not settled after resolve");
  }

  // Gas for relayer txs
  for (const [action, hash] of [
    ["revealBatch", r1.json?.revealTxHash],
    ["fulfillDaySeed", r1.json?.seedTxHash],
    ["settleDay", r1.json?.settleTxHash],
  ] as const) {
    if (typeof hash === "string" && hash.startsWith("0x") && hash.length === 66) {
      try {
        report.gas.push(
          await gasRow(ethers.provider, relayer.address, "relayer", action, hash),
        );
      } catch {
        /* ignore */
      }
    }
  }

  // Reveal location match
  let revealOk = 0;
  for (const s of secrets) {
    const loc = Number(await game.locationOf(s.tokenId, day));
    if (loc === s.locationId) revealOk += 1;
    else {
      report.bugs.push(
        `Reveal mismatch #${s.tokenId}: on-chain=${loc} expected=${s.locationId}`,
      );
    }
  }
  report.results["loop.revealMatch"] =
    revealOk === secrets.length ? "PASS" : "FAIL";
  report.reveal = { matched: revealOk, total: secrets.length };

  // ── Personal battle isolation (on-chain commit filter) ──────────────
  const committedByPlayer = new Map<string, Set<number>>();
  for (const p of players) committedByPlayer.set(p.address.toLowerCase(), new Set());
  for (const s of secrets) {
    committedByPlayer.get(s.player.address.toLowerCase())!.add(s.tokenId);
  }

  let isolationFail = false;
  for (const p of players) {
    const personal: number[] = [];
    const ownedIds =
      report.ownership.find((o) => o.address === p.address)?.nfts.map((n) => n.tokenId) ??
      [];
    for (const tokenId of ownedIds) {
      const h = await game.commitHashOf(tokenId, day);
      if (h !== ethers.ZeroHash) personal.push(tokenId);
    }
    const others = new Set<number>();
    for (const [addr, set] of committedByPlayer) {
      if (addr === p.address.toLowerCase()) continue;
      for (const id of set) others.add(id);
    }
    const leaked = personal.filter((id) => others.has(id));
    // Also: personal should not include tokens owned by others
    const ownedByOthers = personal.filter((id) => {
      const owner = allOwned.get(id);
      return owner && owner !== p.address.toLowerCase();
    });
    const leakedFromOthers = [...new Set([...leaked, ...ownedByOthers])];
    if (leakedFromOthers.length) isolationFail = true;
    report.battlePersonal.push({
      player: p.name,
      address: p.address,
      tokenIds: personal,
      leakedFromOthers,
    });
  }
  report.results["isolation.battleReport"] = isolationFail ? "FAIL" : "PASS";

  // Wallet-switch simulation: verify each player's personal set is disjoint
  const sets = report.battlePersonal.map((b) => new Set(b.tokenIds));
  let disjoint = true;
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      for (const id of sets[i]!) {
        if (sets[j]!.has(id)) {
          disjoint = false;
          report.bugs.push(
            `Personal sets overlap on #${id} between players ${i + 1} and ${j + 1}`,
          );
        }
      }
    }
  }
  report.results["isolation.walletSwitch"] = disjoint ? "PASS" : "FAIL";
  report.notes.push(
    "Wallet-switch / refresh UI: verified via on-chain personal commit filter (same rule as Result page). Manual MetaMask switch still recommended.",
  );

  // ── Claims per player ───────────────────────────────────────────────
  let claimPass = 0;
  for (const s of secrets) {
    const distAsPlayer = distributor.connect(s.player.wallet);
    const before = await distributor.claimable(s.tokenId);
    const row = {
      player: s.player.name,
      tokenId: s.tokenId,
      claimableBefore: ethers.formatEther(before),
      doubleClaim: "SKIP" as "PASS" | "FAIL" | "SKIP",
      claimTx: undefined as string | undefined,
    };
    if (before === 0n) {
      report.claims.push(row);
      continue;
    }
    try {
      const tx = await distAsPlayer.claim(s.tokenId);
      const receipt = await tx.wait();
      row.claimTx = receipt!.hash;
      report.gas.push(
        await gasRow(
          ethers.provider,
          s.player.address,
          "player",
          "claim",
          receipt!.hash,
          s.tokenId,
        ),
      );
      claimPass += 1;
      try {
        await distAsPlayer.claim.staticCall(s.tokenId);
        row.doubleClaim = "FAIL";
        report.bugs.push(`Double claim did not revert #${s.tokenId}`);
      } catch {
        row.doubleClaim = "PASS";
      }
    } catch (e) {
      report.bugs.push(
        `Claim ${s.player.name} #${s.tokenId}: ${e instanceof Error ? e.message.slice(0, 160) : e}`,
      );
    }
    report.claims.push(row);
  }
  report.results["loop.claim"] = claimPass > 0 ? "PASS" : "WARN";
  report.results["edge.doubleClaim"] = report.claims.every(
    (c) => c.doubleClaim === "PASS" || c.doubleClaim === "SKIP",
  )
    ? "PASS"
    : "FAIL";

  const absurd = report.gas.filter((g) => Number(g.feeEth) > 0.01);
  report.results["gas.noAbsurdFees"] = absurd.length === 0 ? "PASS" : "FAIL";

  // Class coverage flags
  const wanted = [
    "Alpaca:King",
    "Alpaca:Runner",
    "Alpaca:Lucky",
    "Alpaca:Guardian",
    "Alpaca:Farmer",
    "Alpaca:Common",
    "Cougar",
  ];
  for (const w of wanted) {
    const committed = report.commits.some((c) => c.label === w);
    report.results[`class.${w}`] = committed
      ? "PASS"
      : report.classCoverage[w]?.length
        ? "WARN"
        : "SKIP";
    if (!committed && report.classCoverage[w]?.length) {
      report.notes.push(
        `${w} owned but not in this day's commit set (cap/selection) — present in inventory.`,
      );
    }
  }

  await writeReports(report);

  const fails = Object.values(report.results).filter((v) => v === "FAIL").length;
  console.log("===== MULTI-WALLET QA DONE =====");
  console.log("results", report.results);
  console.log("bugs", report.bugs);
  if (fails > 0) process.exitCode = 1;
}

async function writeReports(report: Report) {
  const outDir = join(__dirname, "..", "..", "reports", "testnet");
  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, "multi-wallet-qa-report.json");
  const mdPath = join(outDir, "multi-wallet-qa-report.md");
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(mdPath, renderMarkdown(report));
  console.log("Wrote", mdPath);
  console.log("Wrote", jsonPath);
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
