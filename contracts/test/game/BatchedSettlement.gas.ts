/**
 * Batched settlement: economic identity + gas matrix at N=50/100/250/550.
 * SettlementLib math unchanged — only execution path differs.
 */
import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  HansomeAlpacas,
  HansomeGame,
  GameTreasury,
  EmissionController,
  RewardDistributor,
  GameRandomness,
  MockGenesisNFT,
} from "../../typechain-types";

const Side = { None: 0, Alpaca: 1, Cougar: 2 };
const Class = { None: 0, Common: 1 };

const DAY = 24 * 3600;
const COMMIT = 20 * 3600;
const REVEAL = DAY - COMMIT;
const G0 = ethers.parseEther("300000000");
const SEED = ethers.id("batched-settlement-seed-v1");

type Deployed = {
  owner: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  alice: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  nft: MockGenesisNFT;
  game: HansomeGame;
  randomness: GameRandomness;
  distributor: RewardDistributor;
  dayZero: number;
};

async function deployGame(): Promise<Deployed> {
  const [owner, alice] = await ethers.getSigners();

  const token = (await (
    await ethers.getContractFactory("HansomeAlpacas")
  ).deploy(owner.address)) as HansomeAlpacas;
  await token.waitForDeployment();

  const nft = (await (
    await ethers.getContractFactory("MockGenesisNFT")
  ).deploy()) as MockGenesisNFT;
  await nft.waitForDeployment();

  const treasury = (await (
    await ethers.getContractFactory("GameTreasury")
  ).deploy(await token.getAddress(), owner.address)) as GameTreasury;
  await treasury.waitForDeployment();

  const emission = (await (
    await ethers.getContractFactory("EmissionController")
  ).deploy()) as EmissionController;
  await emission.waitForDeployment();

  const distributor = (await (
    await ethers.getContractFactory("RewardDistributor")
  ).deploy(
    await nft.getAddress(),
    await treasury.getAddress(),
    owner.address,
  )) as RewardDistributor;
  await distributor.waitForDeployment();

  const randomness = (await (
    await ethers.getContractFactory("GameRandomness")
  ).deploy(owner.address)) as GameRandomness;
  await randomness.waitForDeployment();

  const dayZero = (await time.latest()) + 100;
  const game = (await (
    await ethers.getContractFactory("HansomeGame")
  ).deploy(
    await nft.getAddress(),
    await treasury.getAddress(),
    await emission.getAddress(),
    await distributor.getAddress(),
    await randomness.getAddress(),
    dayZero,
    DAY,
    COMMIT,
    REVEAL,
    owner.address,
  )) as HansomeGame;
  await game.waitForDeployment();

  await treasury.setGame(await game.getAddress());
  await treasury.setDistributor(await distributor.getAddress());
  await distributor.setGame(await game.getAddress());
  await token.transfer(await treasury.getAddress(), G0);

  return { owner, alice, nft, game, randomness, distributor, dayZero };
}

async function prepDay(d: Deployed, n: number, cougars: number) {
  const { alice, nft, game, dayZero } = d;
  await time.increaseTo(dayZero);

  const alpacaN = n - cougars;
  const salts: string[] = [];
  const locs: number[] = [];
  const tokenIds: number[] = [];

  for (let i = 0; i < alpacaN; i++) {
    const tokenId = 1000 + i;
    await nft.mint(alice.address, tokenId, Side.Alpaca, Class.Common);
    const loc = 1 + (i % 4); // Mountain..River
    const salt = ethers.id(`salt-a-${i}`);
    const hash = await game.computeCommitHash(tokenId, 0, loc, salt);
    await game.connect(alice).commit(tokenId, 0, hash);
    tokenIds.push(tokenId);
    locs.push(loc);
    salts.push(salt);
  }
  for (let i = 0; i < cougars; i++) {
    const tokenId = 5000 + i;
    await nft.mint(alice.address, tokenId, Side.Cougar, Class.None);
    const loc = 1 + (i % 4);
    const salt = ethers.id(`salt-c-${i}`);
    const hash = await game.computeCommitHash(tokenId, 0, loc, salt);
    await game.connect(alice).commit(tokenId, 0, hash);
    tokenIds.push(tokenId);
    locs.push(loc);
    salts.push(salt);
  }

  await time.increaseTo(dayZero + COMMIT);

  // Reveal in MAX_REVEAL_BATCH chunks (and measure).
  const maxBatch = Number(await game.MAX_REVEAL_BATCH());
  let revealGasTotal = 0n;
  let revealPeak = 0n;
  let revealChunks = 0;
  for (let i = 0; i < tokenIds.length; i += maxBatch) {
    const sliceIds = tokenIds.slice(i, i + maxBatch);
    const sliceLocs = locs.slice(i, i + maxBatch);
    const sliceSalts = salts.slice(i, i + maxBatch);
    for (let j = 0; j < sliceIds.length; j++) {
      const tx = await game
        .connect(alice)
        .reveal(sliceIds[j]!, 0, sliceLocs[j]!, sliceSalts[j]!);
      const receipt = await tx.wait();
      const g = receipt!.gasUsed;
      revealGasTotal += g;
      if (g > revealPeak) revealPeak = g;
    }
    revealChunks += 1;
  }

  await d.randomness.fulfillDaySeed(0, SEED);
  return { tokenIds, revealGasTotal, revealPeak, revealChunks };
}

describe("Batched settlement execution", () => {
  it("identical economics: settleDay wrapper vs finalize+creditBatch", async () => {
    const n = 12;
    const cougars = 2;

    const a = await deployGame();
    const { tokenIds } = await prepDay(a, n, cougars);
    await a.game.settleDay(0);
    const maxCreditA = Number(await a.game.MAX_CREDIT_BATCH());
    while (!(await a.game.isSettled(0))) {
      await a.game.creditBatch(0, maxCreditA);
    }
    const claimA: Record<number, bigint> = {};
    for (const id of tokenIds) {
      claimA[id] = await a.distributor.claimable(id);
    }
    const totalsA = await a.game.daySettlementTotals(0);

    const b = await deployGame();
    await prepDay(b, n, cougars);
    await b.game.finalizeDay(0);
    expect(await b.game.isFinalized(0)).to.equal(true);
    expect(await b.game.isSettled(0)).to.equal(false);
    const maxCredit = Number(await b.game.MAX_CREDIT_BATCH());
    while (!(await b.game.isSettled(0))) {
      await b.game.creditBatch(0, maxCredit);
    }
    const totalsB = await b.game.daySettlementTotals(0);
    expect(totalsB.rd).to.equal(totalsA.rd);
    expect(totalsB.pen).to.equal(totalsA.pen);
    expect(totalsB.huntDust).to.equal(totalsA.huntDust);
    expect(totalsB.unallocated).to.equal(totalsA.unallocated);
    expect(totalsB.playerTotal).to.equal(totalsA.playerTotal);

    for (const id of tokenIds) {
      expect(await b.distributor.claimable(id)).to.equal(claimA[id]);
      expect(await b.game.pendingRewardOf(id, 0)).to.equal(claimA[id]);
    }
  });

  it("rejects reveal batch larger than MAX_REVEAL_BATCH", async () => {
    const d = await deployGame();
    await time.increaseTo(d.dayZero + COMMIT);
    const ids = Array.from({ length: 51 }, (_, i) => BigInt(i + 1));
    const locs = ids.map(() => 1);
    const salts = ids.map((_, i) => ethers.id(`x${i}`));
    await expect(
      d.game.testnetRelayerRevealBatch(ids, 0, locs, salts),
    ).to.be.revertedWithCustomError(d.game, "BatchTooLarge");
  });

  it("gas matrix N=50/100/250/550 (writes report)", async function () {
    this.timeout(900_000);
    const sizes = [50, 100, 250, 550] as const;
    const rows: Array<Record<string, string | number>> = [];

    for (const n of sizes) {
      const cougars = Math.max(1, Math.round(n * 0.1));
      // Path: finalize + credit batches
      const d = await deployGame();
      const { revealGasTotal, revealPeak, revealChunks } = await prepDay(
        d,
        n,
        cougars,
      );

      const finTx = await d.game.finalizeDay(0);
      const finRc = await finTx.wait();
      const finalizeGas = finRc!.gasUsed;

      const maxCredit = Number(await d.game.MAX_CREDIT_BATCH());
      let creditTotal = 0n;
      let creditPeak = 0n;
      let creditBatches = 0;
      while (!(await d.game.isSettled(0))) {
        const tx = await d.game.creditBatch(0, maxCredit);
        const rc = await tx.wait();
        const g = rc!.gasUsed;
        creditTotal += g;
        if (g > creditPeak) creditPeak = g;
        creditBatches += 1;
      }

      // Monolithic settleDay wrapper: only reliable for small N (documents OOG risk).
      let settleWrapperGas = 0n;
      let settleWrapperOk = false;
      if (n <= 100) {
        const d2 = await deployGame();
        await prepDay(d2, n, cougars);
        const settleTx = await d2.game.settleDay(0);
        const settleRc = await settleTx.wait();
        settleWrapperGas = settleRc!.gasUsed;
        settleWrapperOk = await d2.game.isSettled(0);
        while (!(await d2.game.isSettled(0))) {
          await d2.game.creditBatch(0, maxCredit);
        }
      }

      const batchedPeak = finalizeGas > creditPeak ? finalizeGas : creditPeak;
      const peak = batchedPeak > revealPeak ? batchedPeak : revealPeak;

      rows.push({
        n,
        cougars,
        revealChunks,
        revealGasTotal: revealGasTotal.toString(),
        revealPeak: revealPeak.toString(),
        finalizeGas: finalizeGas.toString(),
        creditBatches,
        creditGasTotal: creditTotal.toString(),
        creditPeak: creditPeak.toString(),
        settleWrapperGas: settleWrapperGas.toString(),
        settleWrapperOk,
        peakTxGas: peak.toString(),
      });

      expect(Number(peak)).to.be.lessThan(12_000_000);
      console.log(
        `N=${n} finalize=${finalizeGas} creditPeak=${creditPeak} settleWrapper=${settleWrapperGas} peak=${peak}`,
      );
    }

    const outDir = join(__dirname, "..", "..", "..", "reports", "testnet");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, "batched-settlement-gas.json");
    writeFileSync(
      outPath,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          seed: SEED,
          maxRevealBatch: 50,
          maxCreditBatch: 50,
          rows,
        },
        null,
        2,
      )}\n`,
    );

    // Markdown summary
    const md = [
      "# Batched settlement gas matrix",
      "",
      `Generated: ${new Date().toISOString()}`,
      "",
      "Local Hardhat receipts (not Robinhood Testnet). SettlementLib unchanged.",
      "",
      "| N | finalizeDay | creditPeak | creditBatches | settleDay wrapper | peak tx |",
      "|--:|--:|--:|--:|--:|--:|",
      ...rows.map(
        (r) =>
          `| ${r.n} | ${r.finalizeGas} | ${r.creditPeak} | ${r.creditBatches} | ${r.settleWrapperGas} | ${r.peakTxGas} |`,
      ),
      "",
      `Full JSON: \`reports/testnet/batched-settlement-gas.json\``,
      "",
    ].join("\n");
    writeFileSync(join(outDir, "batched-settlement-gas.md"), md);

    expect(rows.length).to.equal(4);
  });
});
