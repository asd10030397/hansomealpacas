/**
 * Mint additional Genesis NFTs on Robinhood Testnet (public sale).
 *
 *   MINT_QTY=3 npx hardhat run scripts/mint-genesis-testnet.ts --network robinhoodTestnet
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { getDeployerSigner } from "./lib/signer";

async function main() {
  const qty = Math.max(1, Number(process.env.MINT_QTY?.trim() ?? "3"));
  const addr =
    process.env.GENESIS_NFT_ADDRESS ||
    process.env.NEXT_PUBLIC_GENESIS_NFT_ADDRESS ||
    (() => {
      const p = join(__dirname, "..", "deployments", `${network.name}-genesis.json`);
      if (!existsSync(p)) throw new Error("Set GENESIS_NFT_ADDRESS");
      return (JSON.parse(readFileSync(p, "utf8")) as { address: string }).address;
    })();

  const signer = await getDeployerSigner(ethers.provider);
  const nft = await ethers.getContractAt("HansomeGenesisNFT", addr, signer);
  const price = await nft.mintPrice();
  const before = await nft.totalMinted();
  const pubCount = await nft.publicMintCount(signer.address);

  console.log("Network", network.name);
  console.log("NFT", addr);
  console.log("mintPrice", ethers.formatEther(price), "ETH");
  console.log("totalMinted before", before.toString());
  console.log("publicMintCount", pubCount.toString());
  console.log("mint qty", qty);

  if (!(await nft.isPublicOpen())) {
    throw new Error("Public mint not open");
  }

  const value = price * BigInt(qty);
  const tx = await nft.publicMint(qty, { value });
  console.log("mint tx", tx.hash);
  const receipt = await tx.wait();
  const after = await nft.totalMinted();
  console.log("totalMinted after", after.toString());

  const owned: number[] = [];
  for (let id = 1; id <= Number(after); id++) {
    try {
      const owner = await nft.ownerOf(id);
      if (owner.toLowerCase() === signer.address.toLowerCase()) owned.push(id);
    } catch {
      /* not minted */
    }
  }

  const out = {
    network: network.name,
    nft: addr,
    minter: signer.address,
    mintTx: receipt!.hash,
    qty,
    totalMintedBefore: Number(before),
    totalMintedAfter: Number(after),
    ownedTokenIds: owned,
    mintedAt: new Date().toISOString(),
  };
  const dir = join(__dirname, "..", "deployments");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${network.name}-genesis-mint.json`);
  writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`);
  console.log("Owned tokens:", owned.join(", "));
  console.log("Wrote", path);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
