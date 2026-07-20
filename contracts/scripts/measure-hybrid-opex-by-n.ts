/**
 * Hybrid OpEx gas matrix by participation N.
 * Project pays: revealBatch + finalizeDay + creditBatch.
 *
 *   npx hardhat run scripts/measure-hybrid-opex-by-n.ts
 */
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const Side = { None: 0, Alpaca: 1, Cougar: 2 };
const Class = { None: 0, Common: 1 };
const DAY = 24 * 3600;
const COMMIT = 20 * 3600;
const REVEAL = DAY - COMMIT;
const G0 = ethers.parseEther("300000000");
const SIZES = [50, 100, 250, 400, 550] as const;

async function deploy() {
  const [owner, alice] = await ethers.getSigners();
  const token = await (await ethers.getContractFactory("HansomeAlpacas")).deploy(owner.address);
  await token.waitForDeployment();
  const nft = await (await ethers.getContractFactory("MockGenesisNFT")).deploy();
  await nft.waitForDeployment();
  const treasury = await (
    await ethers.getContractFactory("GameTreasury")
  ).deploy(await token.getAddress(), owner.address);
  await treasury.waitForDeployment();
  const emission = await (await ethers.getContractFactory("EmissionController")).deploy();
  await emission.waitForDeployment();
  const distributor = await (
    await ethers.getContractFactory("RewardDistributor")
  ).deploy(await nft.getAddress(), await treasury.getAddress(), owner.address);
  await distributor.waitForDeployment();
  const randomness = await (
    await ethers.getContractFactory("GameRandomness")
  ).deploy(owner.address);
  await randomness.waitForDeployment();
  const dayZero = (await time.latest()) + 100;
  const game = await (
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
  );
  await game.waitForDeployment();
  await treasury.setGame(await game.getAddress());
  await treasury.setDistributor(await distributor.getAddress());
  await distributor.setGame(await game.getAddress());
  await token.transfer(await treasury.getAddress(), G0);
  return { owner, alice, nft, game, randomness, dayZero };
}

async function measureN(n: number) {
  const cougars = Math.max(1, Math.round(n * (50 / 550)));
  const alpacas = n - cougars;
  const d = await deploy();
  const maxReveal = Number(await d.game.MAX_REVEAL_BATCH());
  const maxCredit = Number(await d.game.MAX_CREDIT_BATCH());
  await time.increaseTo(d.dayZero);

  const tokenIds: number[] = [];
  const locs: number[] = [];
  const salts: string[] = [];
  for (let i = 0; i < alpacas; i++) {
    const tokenId = 1000 + i;
    await d.nft.mint(d.alice.address, tokenId, Side.Alpaca, Class.Common);
    const loc = 1 + (i % 4);
    const salt = ethers.id(`a-${n}-${i}`);
    const hash = await d.game.computeCommitHash(tokenId, 0, loc, salt);
    await d.game.connect(d.alice).commit(tokenId, 0, hash);
    tokenIds.push(tokenId);
    locs.push(loc);
    salts.push(salt);
  }
  for (let i = 0; i < cougars; i++) {
    const tokenId = 5000 + i;
    await d.nft.mint(d.alice.address, tokenId, Side.Cougar, Class.None);
    const loc = 1 + (i % 4);
    const salt = ethers.id(`c-${n}-${i}`);
    const hash = await d.game.computeCommitHash(tokenId, 0, loc, salt);
    await d.game.connect(d.alice).commit(tokenId, 0, hash);
    tokenIds.push(tokenId);
    locs.push(loc);
    salts.push(salt);
  }

  await time.increaseTo(d.dayZero + COMMIT);

  let revealTotal = 0n;
  let revealTx = 0;
  let revealPeak = 0n;
  for (let i = 0; i < tokenIds.length; i += maxReveal) {
    const ids = tokenIds.slice(i, i + maxReveal).map(BigInt);
    const ls = locs.slice(i, i + maxReveal);
    const ss = salts.slice(i, i + maxReveal);
    const tx = await d.game.testnetRelayerRevealBatch(ids, 0, ls, ss);
    const rc = await tx.wait();
    const g = rc!.gasUsed;
    revealTotal += g;
    if (g > revealPeak) revealPeak = g;
    revealTx += 1;
  }

  await d.randomness.fulfillDaySeed(0, ethers.id(`opex-seed-${n}`));
  const finTx = await d.game.finalizeDay(0);
  const finRc = await finTx.wait();
  const finalizeGas = finRc!.gasUsed;

  let creditTotal = 0n;
  let creditTx = 0;
  let creditPeak = 0n;
  while (!(await d.game.isSettled(0))) {
    const tx = await d.game.creditBatch(0, maxCredit);
    const rc = await tx.wait();
    const g = rc!.gasUsed;
    creditTotal += g;
    if (g > creditPeak) creditPeak = g;
    creditTx += 1;
  }

  const total = revealTotal + finalizeGas + creditTotal;
  return {
    n,
    alpacas,
    cougars,
    revealBatchTx: revealTx,
    creditBatchTx: creditTx,
    revealGasTotal: revealTotal.toString(),
    revealGasPeak: revealPeak.toString(),
    finalizeGas: finalizeGas.toString(),
    creditGasTotal: creditTotal.toString(),
    creditGasPeak: creditPeak.toString(),
    projectGasTotal: total.toString(),
  };
}

async function main() {
  const rows = [];
  for (const n of SIZES) {
    console.log("measuring N=", n);
    const row = await measureN(n);
    rows.push(row);
    console.log(JSON.stringify(row));
  }
  const out = {
    generatedAt: new Date().toISOString(),
    model: "hybrid-project-pays-reveal-finalize-credit",
    rows,
  };
  const outDir = join(__dirname, "..", "..", "reports", "testnet");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const path = join(outDir, "hybrid-opex-by-participation.json");
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log("wrote", path);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
