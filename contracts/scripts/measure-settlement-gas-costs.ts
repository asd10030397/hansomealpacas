/**
 * Measure relayer + player gas for batched settlement cost analysis.
 * Genesis shape: 500 Alpacas + 50 Cougars = 550.
 *
 *   npx hardhat run scripts/measure-settlement-gas-costs.ts
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
const SEED = ethers.id("cost-analysis-seed-v1");
const ALPACAS = 500;
const COUGARS = 50;
const N = ALPACAS + COUGARS;

async function main() {
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

  const maxReveal = Number(await game.MAX_REVEAL_BATCH());
  const maxCredit = Number(await game.MAX_CREDIT_BATCH());

  await time.increaseTo(dayZero);

  const tokenIds: number[] = [];
  const locs: number[] = [];
  const salts: string[] = [];
  const commitGas: bigint[] = [];

  for (let i = 0; i < ALPACAS; i++) {
    const tokenId = 1000 + i;
    await nft.mint(alice.address, tokenId, Side.Alpaca, Class.Common);
    const loc = 1 + (i % 4);
    const salt = ethers.id(`salt-a-${i}`);
    const hash = await game.computeCommitHash(tokenId, 0, loc, salt);
    const tx = await game.connect(alice).commit(tokenId, 0, hash);
    const rc = await tx.wait();
    commitGas.push(rc!.gasUsed);
    tokenIds.push(tokenId);
    locs.push(loc);
    salts.push(salt);
  }
  for (let i = 0; i < COUGARS; i++) {
    const tokenId = 5000 + i;
    await nft.mint(alice.address, tokenId, Side.Cougar, Class.None);
    const loc = 1 + (i % 4);
    const salt = ethers.id(`salt-c-${i}`);
    const hash = await game.computeCommitHash(tokenId, 0, loc, salt);
    const tx = await game.connect(alice).commit(tokenId, 0, hash);
    const rc = await tx.wait();
    commitGas.push(rc!.gasUsed);
    tokenIds.push(tokenId);
    locs.push(loc);
    salts.push(salt);
  }

  await time.increaseTo(dayZero + COMMIT);

  // Relayer batch reveals
  const revealBatchGas: bigint[] = [];
  for (let i = 0; i < tokenIds.length; i += maxReveal) {
    const sliceIds = tokenIds.slice(i, i + maxReveal).map(BigInt);
    const sliceLocs = locs.slice(i, i + maxReveal);
    const sliceSalts = salts.slice(i, i + maxReveal);
    const tx = await game.testnetRelayerRevealBatch(sliceIds, 0, sliceLocs, sliceSalts);
    const rc = await tx.wait();
    revealBatchGas.push(rc!.gasUsed);
  }

  // Measure one player-owned single reveal path on a fresh tiny deploy would be better;
  // approximate from first batch / batch size as lower bound is wrong.
  // Instead: measure single reveal gas via a second small fixture.
  const singleReveal = await measureSingleRevealGas();

  await randomness.fulfillDaySeed(0, SEED);

  const finTx = await game.finalizeDay(0);
  const finRc = await finTx.wait();
  const finalizeGas = finRc!.gasUsed;

  const creditBatchGas: bigint[] = [];
  while (!(await game.isSettled(0))) {
    const tx = await game.creditBatch(0, maxCredit);
    const rc = await tx.wait();
    creditBatchGas.push(rc!.gasUsed);
  }

  // Claim one NFT
  const claimTx = await distributor.connect(alice).claim(tokenIds[0]!);
  const claimRc = await claimTx.wait();
  const claimGas = claimRc!.gasUsed;

  // claimMany of 5
  const claimManyIds = tokenIds.slice(1, 6);
  const claimManyTx = await distributor.connect(alice).claimMany(claimManyIds);
  const claimManyRc = await claimManyTx.wait();
  const claimManyGas = claimManyRc!.gasUsed;

  const sum = (arr: bigint[]) => arr.reduce((a, b) => a + b, 0n);
  const avg = (arr: bigint[]) => (arr.length ? sum(arr) / BigInt(arr.length) : 0n);
  const peak = (arr: bigint[]) => arr.reduce((a, b) => (b > a ? b : a), 0n);

  const report = {
    generatedAt: new Date().toISOString(),
    network: "hardhat",
    genesis: { alpacas: ALPACAS, cougars: COUGARS, total: N },
    caps: { maxRevealBatch: maxReveal, maxCreditBatch: maxCredit },
    relayer: {
      revealBatchTxCount: revealBatchGas.length,
      revealBatchGasEach: revealBatchGas.map(String),
      revealBatchGasAvg: avg(revealBatchGas).toString(),
      revealBatchGasPeak: peak(revealBatchGas).toString(),
      revealBatchGasTotal: sum(revealBatchGas).toString(),
      finalizeDayGas: finalizeGas.toString(),
      creditBatchTxCount: creditBatchGas.length,
      creditBatchGasEach: creditBatchGas.map(String),
      creditBatchGasAvg: avg(creditBatchGas).toString(),
      creditBatchGasPeak: peak(creditBatchGas).toString(),
      creditBatchGasTotal: sum(creditBatchGas).toString(),
      settlementGasTotal: (sum(revealBatchGas) + finalizeGas + sum(creditBatchGas)).toString(),
      settleWithoutReveal: (finalizeGas + sum(creditBatchGas)).toString(),
      canFinishAutomatically: true,
      notes:
        "testnetRelayerRevealBatch is owner/relayer-only and Mainnet-forbidden; Mainnet needs vault+relayer or player reveals. finalizeDay + creditBatch are permissionless.",
    },
    player: {
      commitGasCold: commitGas[0]!.toString(),
      commitGasWarmAvg: avg(commitGas.slice(1)).toString(),
      commitGasPeak: peak(commitGas).toString(),
      singleRevealGas: singleReveal.toString(),
      claimGas: claimGas.toString(),
      claimMany5Gas: claimManyGas.toString(),
      claimManyPerToken: (claimManyGas / 5n).toString(),
    },
  };

  const outDir = join(__dirname, "..", "..", "reports", "testnet");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "settlement-gas-cost-analysis.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log("wrote", outPath);
}

async function measureSingleRevealGas(): Promise<bigint> {
  const [owner, bob] = await ethers.getSigners();
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

  await time.increaseTo(dayZero);
  await nft.mint(bob.address, 1, Side.Alpaca, Class.Common);
  const salt = ethers.id("single-reveal");
  const hash = await game.computeCommitHash(1, 0, 2, salt);
  await game.connect(bob).commit(1, 0, hash);
  await time.increaseTo(dayZero + COMMIT);
  const tx = await game.connect(bob).reveal(1, 0, 2, salt);
  const rc = await tx.wait();
  return rc!.gasUsed;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
