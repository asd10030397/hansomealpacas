/**
 * Schedule + execute placeholder URI (timelocked) on Genesis NFT.
 *
 *   PLACEHOLDER_URI=ipfs://<cid>/placeholder.json \
 *     npx hardhat run scripts/set-genesis-placeholder-uri.ts --network robinhoodTestnet
 */
import { ethers, network } from "hardhat";
import { getDeployerSigner } from "./lib/signer";

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const addr =
    process.env.GENESIS_NFT_ADDRESS ||
    process.env.NEXT_PUBLIC_GENESIS_NFT_ADDRESS;
  const uri = process.env.PLACEHOLDER_URI;
  if (!addr) throw new Error("Set GENESIS_NFT_ADDRESS");
  if (!uri) throw new Error("Set PLACEHOLDER_URI");

  const signer = await getDeployerSigner(ethers.provider);
  const nft = await ethers.getContractAt("HansomeGenesisNFT", addr, signer);
  console.log("Network", network.name);
  console.log("NFT", addr);
  console.log("Placeholder URI", uri);

  const frozen = await nft.metadataFrozen();
  if (frozen) throw new Error("metadataFrozen");

  console.log("Scheduling placeholder URI…");
  const tx1 = await nft.schedulePlaceholderURI(uri);
  console.log("schedule tx", tx1.hash);
  await tx1.wait();

  const timelock = await nft.ADMIN_TIMELOCK();
  const waitSec = Number(timelock) + 5;
  console.log(`Waiting timelock ${waitSec}s…`);
  await sleep(waitSec * 1000);

  console.log("Executing placeholder URI…");
  const tx2 = await nft.executePlaceholderURI(uri);
  console.log("execute tx", tx2.hash);
  await tx2.wait();

  console.log("tokenURI(1) =", await nft.tokenURI(1n));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
