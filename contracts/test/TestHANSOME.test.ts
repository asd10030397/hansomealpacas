import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  TestHANSOME,
  GameTreasury,
  EmissionController,
  RewardDistributor,
  GameRandomness,
  SinkRegistry,
  HansomeGame,
  MockGenesisNFT,
} from "../typechain-types";

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
const G0 = ethers.parseEther("900000000");
const R0 = ethers.parseEther("400000");

describe("TestHANSOME (Robinhood Testnet reward token)", () => {
  async function deployToken() {
    const [owner, alice] = await ethers.getSigners();
    const token = (await (
      await ethers.getContractFactory("TestHANSOME")
    ).deploy(owner.address)) as TestHANSOME;
    await token.waitForDeployment();
    return { owner, alice, token };
  }

  it("has Test HANSOME / tHANSOME / 18 decimals and mints initial supply to deployer", async () => {
    const { owner, token } = await deployToken();
    expect(await token.name()).to.equal("Test HANSOME");
    expect(await token.symbol()).to.equal("tHANSOME");
    expect(await token.decimals()).to.equal(18);
    expect(await token.balanceOf(owner.address)).to.equal(await token.TEST_SUPPLY());
  });

  it("allows authorized minting by owner", async () => {
    const { owner, alice, token } = await deployToken();
    const amount = ethers.parseEther("1000");
    await expect(token.connect(owner).mint(alice.address, amount))
      .to.emit(token, "Transfer")
      .withArgs(ethers.ZeroAddress, alice.address, amount);
    expect(await token.balanceOf(alice.address)).to.equal(amount);
  });

  it("rejects unauthorized mint", async () => {
    const { alice, token } = await deployToken();
    await expect(
      token.connect(alice).mint(alice.address, 1n),
    ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
  });

  it("supports ERC-20 transfer", async () => {
    const { owner, alice, token } = await deployToken();
    const amount = ethers.parseEther("50");
    await token.connect(owner).transfer(alice.address, amount);
    expect(await token.balanceOf(alice.address)).to.equal(amount);
  });

  describe("distributor funding + claim", () => {
    async function deployGameStack() {
      const [owner, alice] = await ethers.getSigners();

      const token = (await (
        await ethers.getContractFactory("TestHANSOME")
      ).deploy(owner.address)) as TestHANSOME;
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
        owner.address,
      )) as HansomeGame;
      await game.waitForDeployment();

      const sinks = (await (
        await ethers.getContractFactory("SinkRegistry")
      ).deploy(
        await token.getAddress(),
        await treasury.getAddress(),
        owner.address,
      )) as SinkRegistry;
      await sinks.waitForDeployment();

      await treasury.setGame(await game.getAddress());
      await treasury.setDistributor(await distributor.getAddress());
      await treasury.setSinkRegistry(await sinks.getAddress());
      await distributor.setGame(await game.getAddress());

      // Claims are paid from GameTreasury (RewardDistributor has no token balance).
      await token.transfer(await treasury.getAddress(), G0);

      await nft.mint(alice.address, 1, Side.Alpaca, Class.Common);

      return { owner, alice, token, nft, treasury, distributor, game, randomness, dayZero };
    }

    it("funds GameTreasury (claim payer behind RewardDistributor)", async () => {
      const { token, treasury } = await deployGameStack();
      expect(await token.balanceOf(await treasury.getAddress())).to.equal(G0);
      expect(await treasury.token()).to.equal(await token.getAddress());
    });

    it("pays claimMany in tHANSOME and zeroes claimable; blocks duplicate claim", async () => {
      const { alice, token, nft, distributor, game, randomness, dayZero } =
        await deployGameStack();

      await time.increaseTo(dayZero + 1);
      const day = 0;
      const loc = 2;
      const salt = ethers.id("thansome-claim-test");
      const commitHash = await game.computeCommitHash(1, day, loc, salt);

      await game.connect(alice).commit(1, day, commitHash);
      await time.increaseTo(dayZero + COMMIT + 1);
      await game.connect(alice).reveal(1, day, loc, salt);

      const seed = ethers.id("thansome-day-seed");
      await randomness.fulfillDaySeed(day, seed);
      await time.increaseTo(dayZero + DAY);
      await game.settleDay(day);

      const claimable = await distributor.claimable(1);
      expect(claimable).to.equal((R0 * 80n) / 100n);

      const before = await token.balanceOf(alice.address);
      await distributor.connect(alice).claimMany([1]);
      const after = await token.balanceOf(alice.address);

      expect(after - before).to.equal(claimable);
      expect(await distributor.claimable(1)).to.equal(0n);

      await expect(
        distributor.connect(alice).claimMany([1]),
      ).to.be.revertedWithCustomError(distributor, "NothingToClaim");
      expect(await nft.ownerOf(1)).to.equal(alice.address);
    });
  });
});

