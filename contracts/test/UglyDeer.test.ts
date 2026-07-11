import { expect } from "chai";
import { ethers } from "hardhat";
import { UglyDeer } from "../typechain-types";

const MAX_SUPPLY = 1_000_000_000n * 10n ** 18n;

describe("UglyDeer", () => {
  async function deploy(recipient: string) {
    const factory = await ethers.getContractFactory("UglyDeer");
    const token = await factory.deploy(recipient);
    await token.waitForDeployment();
    return token as UglyDeer;
  }

  it("sets standard ERC-20 metadata", async () => {
    const [owner] = await ethers.getSigners();
    const token = await deploy(owner.address);

    expect(await token.name()).to.equal("Ugly Deer");
    expect(await token.symbol()).to.equal("UGLY");
    expect(await token.decimals()).to.equal(18);
  });

  it("mints the fixed max supply once to the recipient", async () => {
    const [owner, recipient] = await ethers.getSigners();
    const token = await deploy(recipient.address);

    expect(await token.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
    expect(await token.totalSupply()).to.equal(MAX_SUPPLY);
    expect(await token.balanceOf(recipient.address)).to.equal(MAX_SUPPLY);
    expect(await token.balanceOf(owner.address)).to.equal(0n);
  });

  it("rejects a zero-address recipient", async () => {
    const factory = await ethers.getContractFactory("UglyDeer");
    await expect(factory.deploy(ethers.ZeroAddress)).to.be.revertedWith("UglyDeer: zero recipient");
  });

  it("supports standard transfers without fees", async () => {
    const [, recipient, holder] = await ethers.getSigners();
    const token = await deploy(recipient.address);
    const amount = 1_000_000n * 10n ** 18n;

    await token.connect(recipient).transfer(holder.address, amount);

    expect(await token.balanceOf(holder.address)).to.equal(amount);
    expect(await token.balanceOf(recipient.address)).to.equal(MAX_SUPPLY - amount);
    expect(await token.totalSupply()).to.equal(MAX_SUPPLY);
  });

  it("does not expose mint, owner, pause, blacklist, or tax functions", async () => {
    const [owner] = await ethers.getSigners();
    const token = await deploy(owner.address);
    const forbidden = [
      "mint",
      "owner",
      "transferOwnership",
      "renounceOwnership",
      "pause",
      "unpause",
      "blacklist",
      "whitelist",
      "setFee",
      "setTax",
      "enableTrading",
      "disableTrading",
    ];

    const externalFunctions = token.interface.fragments
      .filter((fragment) => fragment.type === "function")
      .map((fragment) => fragment.name);

    for (const fn of forbidden) {
      expect(externalFunctions, `unexpected function in ABI: ${fn}`).to.not.include(fn);
    }

    expect(externalFunctions).to.include("transfer");
    expect(externalFunctions).to.include("approve");
    expect(externalFunctions).to.include("MAX_SUPPLY");
  });

  it("does not change total supply after deployment", async () => {
    const [, recipient, alice, bob] = await ethers.getSigners();
    const token = await deploy(recipient.address);

    await token.connect(recipient).transfer(alice.address, 100n * 10n ** 18n);
    await token.connect(alice).transfer(bob.address, 25n * 10n ** 18n);

    expect(await token.totalSupply()).to.equal(MAX_SUPPLY);
  });
});
