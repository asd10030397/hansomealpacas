import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  HansomeAlpacas,
  HansomeGame,
  GameTreasury,
  EmissionController,
  RewardDistributor,
  GameRandomness,
  SinkRegistry,
  MockGenesisNFT,
} from "../../typechain-types";
const Side = { None: 0, Alpaca: 1, Cougar: 2 };
const Class = {
  None: 0,
  Common: 1,
  Guardian: 2,
  Farmer: 3,
  Lucky: 4,
  Runner: 5,
  King: 6,
};

const DAY = 24 * 3600;
const COMMIT = 20 * 3600;
const G0 = ethers.parseEther("300000000");
const R0 = ethers.parseEther("400000");

async function deployFixture() {
  const [owner, alice, bob, carol] = await ethers.getSigners();

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
    owner.address,
  )) as HansomeGame;
  await game.waitForDeployment();

  const sinks = (await (
    await ethers.getContractFactory("SinkRegistry")
  ).deploy(await token.getAddress(), await treasury.getAddress(), owner.address)) as SinkRegistry;
  await sinks.waitForDeployment();

  await treasury.setGame(await game.getAddress());
  await treasury.setDistributor(await distributor.getAddress());
  await treasury.setSinkRegistry(await sinks.getAddress());
  await distributor.setGame(await game.getAddress());

  // Fund treasury at G0
  await token.transfer(await treasury.getAddress(), G0);

  return {
    owner,
    alice,
    bob,
    carol,
    token,
    nft,
    treasury,
    emission,
    distributor,
    randomness,
    game,
    sinks,
    dayZero,
  };
}

async function mintAlpaca(
  nft: MockGenesisNFT,
  to: string,
  tokenId: number,
  cls: number,
) {
  await nft.mint(to, tokenId, Side.Alpaca, cls);
}

async function mintCougar(nft: MockGenesisNFT, to: string, tokenId: number) {
  await nft.mint(to, tokenId, Side.Cougar, Class.None);
}

describe("HansomeGame integration", () => {
  it("I-FSM-01 happy path commit→reveal→settle→claim", async () => {
    const { alice, nft, game, randomness, distributor, token, dayZero, treasury } =
      await deployFixture();

    await mintAlpaca(nft, alice.address, 1, Class.Common);
    await time.increaseTo(dayZero);

    const salt = ethers.id("salt-a");
    const day = 0;
    const loc = 2;
    const hash = await game.computeCommitHash(1, day, loc, salt);
    await game.connect(alice).commit(1, day, hash);

    await time.increaseTo(dayZero + COMMIT);
    await game.connect(alice).reveal(1, day, loc, salt);

    await randomness.fulfillDaySeed(day, ethers.id("seed-day-0"));
    await time.increaseTo(dayZero + DAY);
    await game.settleDay(day);

    expect(await game.isSettled(day)).to.equal(true);
    const claimable = await distributor.claimable(1);
    // Sole alpaca, no cougars → Ra only; Rc+Rh return to treasury (E2)
    expect(claimable).to.equal((R0 * 80n) / 100n);

    const before = await token.balanceOf(alice.address);
    await distributor.connect(alice).claim(1);
    expect(await token.balanceOf(alice.address)).to.equal(before + claimable);
    expect(await distributor.claimable(1)).to.equal(0);
    expect(await treasury.outstandingClaims()).to.equal(0);
  });

  it("I-FSM-02/03 wrong phase reverts", async () => {
    const { alice, nft, game, dayZero } = await deployFixture();
    await mintAlpaca(nft, alice.address, 1, Class.Common);
    await time.increaseTo(dayZero);
    const salt = ethers.id("s");
    const hash = await game.computeCommitHash(1, 0, 1, salt);
    await game.connect(alice).commit(1, 0, hash);

    // still commit window — reveal fails
    await expect(game.connect(alice).reveal(1, 0, 1, salt)).to.be.revertedWithCustomError(
      game,
      "WrongPhase",
    );

    await time.increaseTo(dayZero + COMMIT);
    // commit in reveal window fails
    await expect(game.connect(alice).commit(1, 0, hash)).to.be.revertedWithCustomError(
      game,
      "WrongPhase",
    );
  });

  it("I-FSM-04/E13 duplicate commit", async () => {
    const { alice, nft, game, dayZero } = await deployFixture();
    await mintAlpaca(nft, alice.address, 1, Class.Common);
    await time.increaseTo(dayZero);
    const hash = await game.computeCommitHash(1, 0, 1, ethers.id("s"));
    await game.connect(alice).commit(1, 0, hash);
    await expect(game.connect(alice).commit(1, 0, hash)).to.be.revertedWithCustomError(
      game,
      "AlreadyCommitted",
    );
  });

  it("I-FSM-05 bad reveal hash", async () => {
    const { alice, nft, game, dayZero } = await deployFixture();
    await mintAlpaca(nft, alice.address, 1, Class.Common);
    await time.increaseTo(dayZero);
    const hash = await game.computeCommitHash(1, 0, 1, ethers.id("s"));
    await game.connect(alice).commit(1, 0, hash);
    await time.increaseTo(dayZero + COMMIT);
    await expect(
      game.connect(alice).reveal(1, 0, 1, ethers.id("wrong")),
    ).to.be.revertedWithCustomError(game, "BadCommitHash");
  });

  it("E8 cougar Home reveal rejected", async () => {
    const { alice, nft, game, dayZero } = await deployFixture();
    await mintCougar(nft, alice.address, 50);
    await time.increaseTo(dayZero);
    const salt = ethers.id("s");
    const hash = await game.computeCommitHash(50, 0, 0, salt);
    await game.connect(alice).commit(50, 0, hash);
    await time.increaseTo(dayZero + COMMIT);
    await expect(game.connect(alice).reveal(50, 0, 0, salt)).to.be.revertedWithCustomError(
      game,
      "IllegalLocation",
    );
  });

  it("I-NFT-01 non-owner commit reverts", async () => {
    const { alice, bob, nft, game, dayZero } = await deployFixture();
    await mintAlpaca(nft, alice.address, 1, Class.Common);
    await time.increaseTo(dayZero);
    const hash = await game.computeCommitHash(1, 0, 1, ethers.id("s"));
    await expect(game.connect(bob).commit(1, 0, hash)).to.be.revertedWithCustomError(
      game,
      "NotAuthorized",
    );
  });

  it("I-NFT-02 operator can commit/reveal/claim", async () => {
    const { alice, bob, nft, game, randomness, distributor, dayZero } = await deployFixture();
    await mintAlpaca(nft, alice.address, 1, Class.Common);
    await nft.connect(alice).setApprovalForAll(bob.address, true);
    await time.increaseTo(dayZero);
    const salt = ethers.id("s");
    const hash = await game.computeCommitHash(1, 0, 2, salt);
    await game.connect(bob).commit(1, 0, hash);
    await time.increaseTo(dayZero + COMMIT);
    await game.connect(bob).reveal(1, 0, 2, salt);
    await randomness.fulfillDaySeed(0, ethers.id("seed"));
    await time.increaseTo(dayZero + DAY);
    await game.settleDay(0);
    await distributor.connect(bob).claim(1);
  });

  it("I-NFT-03 unrevealed NFT cannot commit", async () => {
    const { alice, nft, game, dayZero } = await deployFixture();
    await mintAlpaca(nft, alice.address, 1, Class.Common);
    await nft.setRevealed(1, false);
    await time.increaseTo(dayZero);
    const hash = await game.computeCommitHash(1, 0, 1, ethers.id("s"));
    await expect(game.connect(alice).commit(1, 0, hash)).to.be.revertedWithCustomError(
      game,
      "TokenNotRevealed",
    );
  });

  it("I-FSM-08/INV-04 double settle reverts", async () => {
    const { alice, nft, game, randomness, dayZero } = await deployFixture();
    await mintAlpaca(nft, alice.address, 1, Class.Common);
    await time.increaseTo(dayZero);
    const salt = ethers.id("s");
    await game.connect(alice).commit(1, 0, await game.computeCommitHash(1, 0, 1, salt));
    await time.increaseTo(dayZero + COMMIT);
    await game.connect(alice).reveal(1, 0, 1, salt);
    await randomness.fulfillDaySeed(0, ethers.id("seed"));
    await time.increaseTo(dayZero + DAY);
    await game.settleDay(0);
    await expect(game.settleDay(0)).to.be.revertedWithCustomError(game, "AlreadySettled");
  });

  it("I-FSM-09/E14 reveal after settle reverts", async () => {
    const { alice, bob, nft, game, randomness, dayZero } = await deployFixture();
    await mintAlpaca(nft, alice.address, 1, Class.Common);
    await mintAlpaca(nft, bob.address, 2, Class.Common);
    await time.increaseTo(dayZero);
    const s1 = ethers.id("s1");
    const s2 = ethers.id("s2");
    await game.connect(alice).commit(1, 0, await game.computeCommitHash(1, 0, 1, s1));
    await game.connect(bob).commit(2, 0, await game.computeCommitHash(2, 0, 1, s2));
    await time.increaseTo(dayZero + COMMIT);
    await game.connect(alice).reveal(1, 0, 1, s1);
    await randomness.fulfillDaySeed(0, ethers.id("seed"));
    await time.increaseTo(dayZero + DAY);
    await game.settleDay(0);
    await expect(game.connect(bob).reveal(2, 0, 1, s2)).to.be.revertedWithCustomError(
      game,
      "WrongPhase",
    );
  });

  it("I-CLM-02/03 claim security", async () => {
    const { alice, bob, nft, game, randomness, distributor, dayZero } = await deployFixture();
    await mintAlpaca(nft, alice.address, 1, Class.Common);
    await time.increaseTo(dayZero);
    const salt = ethers.id("s");
    await game.connect(alice).commit(1, 0, await game.computeCommitHash(1, 0, 1, salt));
    await time.increaseTo(dayZero + COMMIT);
    await game.connect(alice).reveal(1, 0, 1, salt);
    await randomness.fulfillDaySeed(0, ethers.id("seed"));
    await time.increaseTo(dayZero + DAY);
    await game.settleDay(0);

    await expect(distributor.connect(bob).claim(1)).to.be.revertedWithCustomError(
      distributor,
      "NotTokenController",
    );
    await distributor.connect(alice).claim(1);
    await expect(distributor.connect(alice).claim(1)).to.be.revertedWithCustomError(
      distributor,
      "NothingToClaim",
    );
  });

  it("I-CLM-04 claim follows NFT transfer", async () => {
    const { alice, bob, nft, game, randomness, distributor, dayZero } = await deployFixture();
    await mintAlpaca(nft, alice.address, 1, Class.Common);
    await time.increaseTo(dayZero);
    const salt = ethers.id("s");
    await game.connect(alice).commit(1, 0, await game.computeCommitHash(1, 0, 2, salt));
    await time.increaseTo(dayZero + COMMIT);
    await game.connect(alice).reveal(1, 0, 2, salt);
    await randomness.fulfillDaySeed(0, ethers.id("seed"));
    await time.increaseTo(dayZero + DAY);
    await game.settleDay(0);

    await nft.connect(alice).transferFrom(alice.address, bob.address, 1);
    await expect(distributor.connect(alice).claim(1)).to.be.revertedWithCustomError(
      distributor,
      "NotTokenController",
    );
    await distributor.connect(bob).claim(1);
  });

  it("I-SET mixed alpaca+cougar; INV-05 no mint", async () => {
    const { alice, bob, nft, game, randomness, distributor, token, dayZero } =
      await deployFixture();
    const supplyBefore = await token.totalSupply();

    await mintAlpaca(nft, alice.address, 1, Class.Common);
    await mintCougar(nft, bob.address, 50);
    await time.increaseTo(dayZero);
    const sa = ethers.id("a");
    const sc = ethers.id("c");
    await game.connect(alice).commit(1, 0, await game.computeCommitHash(1, 0, 3, sa));
    await game.connect(bob).commit(50, 0, await game.computeCommitHash(50, 0, 3, sc));
    await time.increaseTo(dayZero + COMMIT);
    await game.connect(alice).reveal(1, 0, 3, sa);
    await game.connect(bob).reveal(50, 0, 3, sc);
    await randomness.fulfillDaySeed(0, ethers.id("seed"));
    await time.increaseTo(dayZero + DAY);
    await game.settleDay(0);

    const aClaim = await distributor.claimable(1);
    const cClaim = await distributor.claimable(50);
    expect(aClaim + cClaim).to.be.lte(R0);
    expect(cClaim).to.be.gt(0);
    expect(await token.totalSupply()).to.equal(supplyBefore);
  });

  it("I-FSM-10/E11 safe mode blocks commit (low G)", async () => {
    const [owner, alice] = await ethers.getSigners();
    const token = (await (
      await ethers.getContractFactory("HansomeAlpacas")
    ).deploy(owner.address)) as HansomeAlpacas;
    const nft = (await (
      await ethers.getContractFactory("MockGenesisNFT")
    ).deploy()) as MockGenesisNFT;
    const treasury = (await (
      await ethers.getContractFactory("GameTreasury")
    ).deploy(await token.getAddress(), owner.address)) as GameTreasury;
    const emission = (await (
      await ethers.getContractFactory("EmissionController")
    ).deploy()) as EmissionController;
    const distributor = (await (
      await ethers.getContractFactory("RewardDistributor")
    ).deploy(await nft.getAddress(), await treasury.getAddress(), owner.address)) as RewardDistributor;
    const randomness = (await (
      await ethers.getContractFactory("GameRandomness")
    ).deploy(owner.address)) as GameRandomness;
    const dayZero = (await time.latest()) + 50;
    const game = (await (
      await ethers.getContractFactory("HansomeGame")
    ).deploy(
      await nft.getAddress(),
      await treasury.getAddress(),
      await emission.getAddress(),
      await distributor.getAddress(),
      await randomness.getAddress(),
      dayZero,
      owner.address,
    )) as HansomeGame;
    await treasury.setGame(await game.getAddress());
    await treasury.setDistributor(await distributor.getAddress());
    await distributor.setGame(await game.getAddress());
    // Fund below G_SAFE (15M)
    await token.transfer(await treasury.getAddress(), ethers.parseEther("1000000"));

    await mintAlpaca(nft, alice.address, 1, Class.Common);
    await time.increaseTo(dayZero);
    const hash = await game.computeCommitHash(1, 0, 1, ethers.id("s"));
    await expect(game.connect(alice).commit(1, 0, hash)).to.be.revertedWithCustomError(
      game,
      "SafeMode",
    );
  });

  it("I-TRE sink credits treasury balance", async () => {
    const { alice, token, treasury, sinks } = await deployFixture();
    await token.transfer(alice.address, ethers.parseEther("1000"));
    await token.connect(alice).approve(await sinks.getAddress(), ethers.parseEther("100"));
    const before = await token.balanceOf(await treasury.getAddress());
    await sinks.connect(alice).sink(0, ethers.parseEther("100")); // Upgrade
    expect(await token.balanceOf(await treasury.getAddress())).to.equal(
      before + ethers.parseEther("100"),
    );
  });

  it("U-EM emission bands", async () => {
    const { emission } = await deployFixture();
    expect(await emission.currentRd(G0)).to.equal(R0);
    expect(await emission.currentRd((G0 * 50n) / 100n)).to.equal(ethers.parseEther("280000"));
    expect(await emission.currentRd((G0 * 30n) / 100n)).to.equal(ethers.parseEther("160000"));
    expect(await emission.currentRd(ethers.parseEther("20000000"))).to.equal(
      ethers.parseEther("80000"),
    );
    expect(await emission.isSafeMode(ethers.parseEther("14999999"))).to.equal(true);
    expect(await emission.currentRd(ethers.parseEther("14999999"))).to.equal(0);
  });

  it("E9 commit without reveal → excluded", async () => {
    const { alice, bob, nft, game, randomness, distributor, dayZero } = await deployFixture();
    await mintAlpaca(nft, alice.address, 1, Class.Common);
    await mintAlpaca(nft, bob.address, 2, Class.Common);
    await time.increaseTo(dayZero);
    const s1 = ethers.id("s1");
    await game.connect(alice).commit(1, 0, await game.computeCommitHash(1, 0, 1, s1));
    await game.connect(bob).commit(2, 0, await game.computeCommitHash(2, 0, 1, ethers.id("s2")));
    await time.increaseTo(dayZero + COMMIT);
    await game.connect(alice).reveal(1, 0, 1, s1);
    // bob does not reveal
    await randomness.fulfillDaySeed(0, ethers.id("seed"));
    await time.increaseTo(dayZero + DAY);
    await game.settleDay(0);
    expect(await distributor.claimable(1)).to.equal((R0 * 80n) / 100n);
    expect(await distributor.claimable(2)).to.equal(0);
  });

  it("I-ABL Farmer vs Common share; King immunity path integrated", async () => {
    const { alice, bob, carol, nft, game, randomness, distributor, dayZero } =
      await deployFixture();
    await mintAlpaca(nft, alice.address, 1, Class.Farmer);
    await mintAlpaca(nft, bob.address, 2, Class.Common);
    await mintAlpaca(nft, carol.address, 3, Class.King);
    await mintCougar(nft, alice.address, 50);

    await time.increaseTo(dayZero);
    const salts = [ethers.id("f"), ethers.id("c"), ethers.id("k"), ethers.id("cg")];
    await game.connect(alice).commit(1, 0, await game.computeCommitHash(1, 0, 3, salts[0]));
    await game.connect(bob).commit(2, 0, await game.computeCommitHash(2, 0, 3, salts[1]));
    await game.connect(carol).commit(3, 0, await game.computeCommitHash(3, 0, 4, salts[2]));
    await game.connect(alice).commit(50, 0, await game.computeCommitHash(50, 0, 4, salts[3]));
    await time.increaseTo(dayZero + COMMIT);
    await game.connect(alice).reveal(1, 0, 3, salts[0]);
    await game.connect(bob).reveal(2, 0, 3, salts[1]);
    await game.connect(carol).reveal(3, 0, 4, salts[2]);
    await game.connect(alice).reveal(50, 0, 4, salts[3]);
    await randomness.fulfillDaySeed(0, ethers.id("seed"));
    await time.increaseTo(dayZero + DAY);
    await game.settleDay(0);

    const farmer = await distributor.claimable(1);
    const common = await distributor.claimable(2);
    const king = await distributor.claimable(3);
    expect(farmer).to.be.gt(common);
    expect(king).to.be.gt(0);
  });
});
