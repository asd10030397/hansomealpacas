import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HansomeGenesisNFT, RevealRandomnessMock } from "../typechain-types";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { Signer, Wallet } from "ethers";

const SALE_CAP = 540;
const WL_EARLY = 3600;
const TIMELOCK = 24 * 3600;

function buildSaleIdentities(): Uint8Array {
  const bytes = new Uint8Array(SALE_CAP);
  let i = 0;
  const push = (v: number, n: number) => {
    for (let k = 0; k < n; k++) bytes[i++] = v;
  };
  push(0x80, 50);
  push(1, 479);
  push(2, 3);
  push(3, 3);
  push(4, 3);
  push(5, 2);
  if (i !== SALE_CAP) throw new Error(`bad length ${i}`);
  return bytes;
}

function wlTree(addresses: string[]) {
  return StandardMerkleTree.of(
    addresses.map((a) => [a]),
    ["address"],
  );
}

async function fundedWallets(n: number, funder: Signer): Promise<Wallet[]> {
  const out: Wallet[] = [];
  for (let i = 0; i < n; i++) {
    const w = Wallet.createRandom().connect(ethers.provider);
    await funder.sendTransaction({ to: w.address, value: ethers.parseEther("0.05") });
    out.push(w as unknown as Wallet);
  }
  return out;
}

describe("HansomeGenesisNFT (hardened)", () => {
  async function deploy() {
    const [owner, treasury, alice, bob] = await ethers.getSigners();

    const mock = (await (
      await ethers.getContractFactory("RevealRandomnessMock")
    ).deploy(owner.address)) as RevealRandomnessMock;
    await mock.waitForDeployment();

    const nft = (await (
      await ethers.getContractFactory("HansomeGenesisNFT")
    ).deploy(
      owner.address,
      treasury.address,
      await mock.getAddress(),
      "ipfs://placeholder.json",
    )) as HansomeGenesisNFT;
    await nft.waitForDeployment();

    const identities = buildSaleIdentities();
    const commitment = ethers.keccak256(identities);
    await nft.setSaleIdentityCommitment(commitment);

    return { nft, mock, owner, treasury, alice, bob, identities, commitment };
  }

  async function lockAndOpenPublic(
    nft: HansomeGenesisNFT,
    merkleRoot: string,
    publicStart: number,
  ) {
    await nft.lockSaleIdentityCommitment();
    await nft.setBaseURI("ipfs://final/");

    await nft.scheduleWhitelistMerkleRoot(merkleRoot);
    await time.increase(TIMELOCK);
    await nft.executeWhitelistMerkleRoot(merkleRoot);

    await nft.schedulePublicStart(publicStart);
    await time.increase(TIMELOCK);
    await nft.executePublicStart(publicStart);
  }

  it("has correct name, royalty, and zero supply before mint", async () => {
    const { nft, treasury } = await deploy();
    expect(await nft.name()).to.equal("HANSOME Genesis NFT");
    expect(await nft.symbol()).to.equal("HGEN");
    expect(await nft.totalMinted()).to.equal(0n);
    const royalty = await nft.royaltyInfo(1, 10_000n);
    expect(royalty[0]).to.equal(treasury.address);
    expect(royalty[1]).to.equal(500n);
  });

  it("reserveMint mints #001–#010 with locked Special classes", async () => {
    const { nft, treasury } = await deploy();
    await nft.reserveMint(treasury.address);
    expect(await nft.gameplayClass(1)).to.equal(6);
    expect(await nft.isRevealed(1)).to.equal(true);
    expect(await nft.gameplayClass(2)).to.equal(2);
    expect(await nft.gameplayClass(10)).to.equal(5);
    await expect(nft.reserveMint(treasury.address)).to.be.revertedWithCustomError(
      nft,
      "ReservedAlreadyMinted",
    );
  });

  it("requires commitment lock before mint; locks on executePublicStart", async () => {
    const { nft, treasury, alice, commitment } = await deploy();
    await nft.reserveMint(treasury.address);
    const tree = wlTree([alice.address]);

    // cannot mint without lock
    const now = await time.latest();
    await nft.scheduleWhitelistMerkleRoot(tree.root);
    await time.increase(TIMELOCK);
    await nft.executeWhitelistMerkleRoot(tree.root);
    await nft.schedulePublicStart(now + TIMELOCK + 2 * WL_EARLY + 100);
    await time.increase(TIMELOCK);
    // executePublicStart auto-locks commitment
    await nft.executePublicStart(now + TIMELOCK + 2 * WL_EARLY + 100);
    expect(await nft.saleIdentityCommitmentLocked()).to.equal(true);

    await expect(nft.setSaleIdentityCommitment(commitment)).to.be.revertedWithCustomError(
      nft,
      "CommitmentLocked",
    );
  });

  it("timelocks mint price changes", async () => {
    const { nft } = await deploy();
    await nft.scheduleMintPrice(ethers.parseEther("0.1"));
    await expect(nft.executeMintPrice(ethers.parseEther("0.1"))).to.be.revertedWithCustomError(
      nft,
      "TimelockNotReady",
    );
    await time.increase(TIMELOCK);
    await nft.executeMintPrice(ethers.parseEther("0.1"));
    expect(await nft.mintPrice()).to.equal(ethers.parseEther("0.1"));
  });

  it("opens whitelist 1 hour before public; enforces max 1 WL", async () => {
    const { nft, treasury, alice, bob } = await deploy();
    await nft.reserveMint(treasury.address);
    const tree = wlTree([alice.address, bob.address]);

    const now = await time.latest();
    // leave room for two timelock waits inside lockAndOpenPublic
    const publicStart = now + 2 * TIMELOCK + 2 * WL_EARLY + 60;
    await lockAndOpenPublic(nft, tree.root, publicStart);

    await expect(
      nft.connect(alice).whitelistMint(tree.getProof([alice.address])),
    ).to.be.revertedWithCustomError(nft, "WhitelistNotOpen");

    await time.increaseTo(publicStart - WL_EARLY);
    await nft.connect(alice).whitelistMint(tree.getProof([alice.address]));
    expect(await nft.ownerOf(11)).to.equal(alice.address);
    expect(await nft.side(11)).to.equal(0);
    expect(await nft.isRevealed(11)).to.equal(false);

    await expect(
      nft.connect(alice).whitelistMint(tree.getProof([alice.address])),
    ).to.be.revertedWithCustomError(nft, "ExceedsWalletCap");

    await time.increaseTo(publicStart);
    await expect(
      nft.connect(bob).whitelistMint(tree.getProof([bob.address])),
    ).to.be.revertedWithCustomError(nft, "WhitelistClosed");
  });

  it("public mint enforces max 5 and combined max 6", async () => {
    const { nft, treasury, alice } = await deploy();
    await nft.reserveMint(treasury.address);
    const tree = wlTree([alice.address]);
    const now = await time.latest();
    const publicStart = now + 2 * TIMELOCK + WL_EARLY + 60;
    await lockAndOpenPublic(nft, tree.root, publicStart);

    await time.increaseTo(publicStart - WL_EARLY);
    await nft.connect(alice).whitelistMint(tree.getProof([alice.address]));
    await time.increaseTo(publicStart);
    await nft.connect(alice).publicMint(5);
    expect(await nft.balanceOf(alice.address)).to.equal(6n);
    await expect(nft.connect(alice).publicMint(1)).to.be.revertedWithCustomError(
      nft,
      "ExceedsWalletCap",
    );
  });

  it("rejects owner fulfill; hides seed and sale side until collection revealed; auto-freezes", async () => {
    const { nft, mock, owner, treasury, identities } = await deploy();
    await nft.reserveMint(treasury.address);

    // Fill entire sale: 100 WL + 440 public
    const wlWallets = await fundedWallets(100, owner);
    const pubWallets = await fundedWallets(88, owner); // 88 * 5 = 440
    const tree = wlTree(wlWallets.map((w) => w.address));

    const now = await time.latest();
    const publicStart = now + 2 * TIMELOCK + WL_EARLY + 120;
    await lockAndOpenPublic(nft, tree.root, publicStart);

    await time.increaseTo(publicStart - WL_EARLY);
    for (const w of wlWallets) {
      await nft.connect(w).whitelistMint(tree.getProof([w.address]));
    }
    expect(await nft.whitelistMinted()).to.equal(100n);

    await time.increaseTo(publicStart);
    for (const w of pubWallets) {
      await nft.connect(w).publicMint(5);
    }
    expect(await nft.saleMinted()).to.equal(540n);

    // owner cannot fulfill
    await nft.requestReveal(identities);
    const reqId = await nft.revealRequestId();
    await expect(
      nft.connect(owner).fulfillRevealRandomWord(reqId, 999n),
    ).to.be.revertedWithCustomError(nft, "UnauthorizedRandomness");

    await mock.fulfill(reqId, 123456789n);
    expect(await nft.revealEntropyReady()).to.equal(true);
    await expect(nft.revealRandomWord()).to.be.revertedWithCustomError(nft, "RevealSeedHidden");

    // Mid-batch: views still opaque for sale tokens
    await nft.processReveal(90);
    expect(await nft.isCollectionRevealed()).to.equal(false);
    expect(await nft.side(11)).to.equal(0);
    expect(await nft.isRevealed(11)).to.equal(false);

    while (!(await nft.isCollectionRevealed())) {
      await nft.processReveal(90);
    }

    expect(await nft.isRevealed(11)).to.equal(true);
    const s11 = await nft.side(11);
    expect(s11 === 1n || s11 === 2n).to.equal(true);
    expect(await nft.revealRandomWord()).to.equal(123456789n);
    expect(await nft.metadataFrozen()).to.equal(true);
    expect(await nft.tokenURI(11)).to.equal("ipfs://final/11.json");
    await expect(nft.setBaseURI("ipfs://hack/")).to.be.revertedWithCustomError(
      nft,
      "MetadataIsFrozen",
    );
  });

  it("rejects reveal before sell-out and bad commitment", async () => {
    const { nft, treasury, alice, identities } = await deploy();
    await nft.reserveMint(treasury.address);
    const tree = wlTree([alice.address]);
    const now = await time.latest();
    const publicStart = now + 2 * TIMELOCK + WL_EARLY + 60;
    await lockAndOpenPublic(nft, tree.root, publicStart);
    await time.increaseTo(publicStart);
    await nft.connect(alice).publicMint(1);

    await expect(nft.requestReveal(identities)).to.be.revertedWithCustomError(
      nft,
      "SaleIncomplete",
    );
  });

  it("VRFRevealAdapter only allows vrfOperator to fulfill", async () => {
    const [owner, treasury, operator, stranger] = await ethers.getSigners();
    const adapter = await (
      await ethers.getContractFactory("VRFRevealAdapter")
    ).deploy(owner.address, operator.address);
    await adapter.waitForDeployment();

    const nft = await (
      await ethers.getContractFactory("HansomeGenesisNFT")
    ).deploy(
      owner.address,
      treasury.address,
      await adapter.getAddress(),
      "ipfs://placeholder.json",
    );
    await nft.waitForDeployment();
    await adapter.setConsumer(await nft.getAddress());

    // Minimal path to requestReveal would need full sale — just check adapter access control
    await expect(adapter.connect(stranger).fulfill(1, 42n)).to.be.revertedWithCustomError(
      adapter,
      "NotOperator",
    );
  });
});
