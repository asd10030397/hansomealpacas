/**
 * Finish sale bootstrap on an already-deployed Genesis NFT (testnet recovery).
 *
 * Env:
 *   GENESIS_NFT_ADDRESS — required
 *   GENESIS_MINT_PRICE_ETH — default 0.001
 *   GENESIS_PUBLIC_START — unix timestamp (required if not already set)
 *   GENESIS_MERKLE_ROOT — bytes32 (optional; testnet WL)
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { getDeployerSigner } from "./lib/signer";

async function main() {
  const deployer = await getDeployerSigner(ethers.provider);
  const address = process.env.GENESIS_NFT_ADDRESS;
  if (!address) throw new Error("Set GENESIS_NFT_ADDRESS");

  const nft = await ethers.getContractAt("HansomeGenesisNFT", address, deployer);
  const priceEth = process.env.GENESIS_MINT_PRICE_ETH ?? "0.001";
  const mintPriceWei = ethers.parseEther(priceEth);

  let publicStart = Number(process.env.GENESIS_PUBLIC_START || "0");
  let merkleRoot = process.env.GENESIS_MERKLE_ROOT || "";

  const wlPath = join(__dirname, "..", "deployments", `${network.name}-genesis-whitelist-TESTNET-ONLY.json`);
  if (!merkleRoot && existsSync(wlPath)) {
    const wl = JSON.parse(readFileSync(wlPath, "utf8")) as { merkleRoot: string };
    merkleRoot = wl.merkleRoot;
  }

  if (!publicStart) {
    // Prefer value from a partial deploy log via env; else derive short WL window.
    const latest = await ethers.provider.getBlock("latest");
    const now = latest?.timestamp ?? Math.floor(Date.now() / 1000);
    publicStart = now + 600;
    console.warn("GENESIS_PUBLIC_START unset — using now+600:", publicStart);
    console.warn("If a different publicStart was already scheduled, set GENESIS_PUBLIC_START to that value.");
  }

  console.log("NFT:", address);
  console.log("mintPrice:", priceEth, "ETH");
  console.log("publicStart:", publicStart);
  console.log("merkleRoot:", merkleRoot || "(none)");

  // If ops were already scheduled, just execute; otherwise schedule then wait.
  const delay = Number(await nft.ADMIN_TIMELOCK());

  async function ensureScheduled(label: string, schedule: () => Promise<unknown>, execute: () => Promise<unknown>) {
    try {
      await (await execute()).wait();
      console.log(`  executed ${label}`);
    } catch {
      console.log(`  execute ${label} failed — scheduling…`);
      await (await schedule()).wait();
      const latest = await ethers.provider.getBlock("latest");
      const eta = (latest?.timestamp ?? 0) + delay + 2;
      for (;;) {
        const b = await ethers.provider.getBlock("latest");
        if ((b?.timestamp ?? 0) >= eta) break;
        console.log(`  waiting ${eta - (b?.timestamp ?? 0)}s for ${label}`);
        await new Promise((r) => setTimeout(r, 5000));
      }
      await (await execute()).wait();
      console.log(`  executed ${label} after schedule`);
    }
  }

  await ensureScheduled(
    "mintPrice",
    () => nft.scheduleMintPrice(mintPriceWei),
    () => nft.executeMintPrice(mintPriceWei),
  );

  if (merkleRoot && merkleRoot !== ethers.ZeroHash) {
    await ensureScheduled(
      "merkle",
      () => nft.scheduleWhitelistMerkleRoot(merkleRoot),
      () => nft.executeWhitelistMerkleRoot(merkleRoot),
    );
  }

  await ensureScheduled(
    "publicStart",
    () => nft.schedulePublicStart(publicStart),
    () => nft.executePublicStart(publicStart),
  );

  console.log("mintPrice:", (await nft.mintPrice()).toString());
  console.log("publicStart:", (await nft.publicStart()).toString());
  console.log("merkle:", await nft.whitelistMerkleRoot());
  console.log("isWhitelistOpen:", await nft.isWhitelistOpen());
  console.log("isPublicOpen:", await nft.isPublicOpen());
  console.log("totalMinted:", (await nft.totalMinted()).toString());
  console.log("tokenURI(1):", await nft.tokenURI(1n));

  const recordPath = join(__dirname, "..", "deployments", `${network.name}-genesis.json`);
  const prev = existsSync(recordPath) ? JSON.parse(readFileSync(recordPath, "utf8")) : {};
  const record = {
    ...prev,
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    contract: "HansomeGenesisNFT",
    address,
    mintPriceWei: mintPriceWei.toString(),
    publicStart,
    whitelistStart: publicStart > 3600 ? publicStart - 3600 : 0,
    whitelistMerkleRoot: merkleRoot || ethers.ZeroHash,
    bootstrapped: true,
    testnetWhitelistOnly: Boolean(merkleRoot),
    finishedAt: new Date().toISOString(),
    deployer: deployer.address,
  };
  mkdirSync(join(__dirname, "..", "deployments"), { recursive: true });
  writeFileSync(recordPath, JSON.stringify(record, null, 2));
  console.log("Updated", recordPath);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
