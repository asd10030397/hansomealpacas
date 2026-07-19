/**
 * Set Genesis NFT baseURI to final metadata CID (owner only).
 *
 *   METADATA_CID=<cid> npx hardhat run scripts/set-genesis-base-uri.ts --network robinhoodTestnet
 *
 * Or: BASE_URI=ipfs://<cid>/
 *
 * Does not freeze metadata. Does not change gameplay.
 */
import { ethers, network } from "hardhat";
import { getDeployerSigner } from "./lib/signer";

async function main() {
  const addr =
    process.env.GENESIS_NFT_ADDRESS ||
    process.env.NEXT_PUBLIC_GENESIS_NFT_ADDRESS;
  if (!addr) throw new Error("Set GENESIS_NFT_ADDRESS");

  const cid = process.env.METADATA_CID;
  const baseURI =
    process.env.BASE_URI ||
    (cid ? `ipfs://${cid}/` : undefined);
  if (!baseURI) throw new Error("Set METADATA_CID or BASE_URI");
  if (!baseURI.endsWith("/")) {
    throw new Error(`BASE_URI must end with / (got ${baseURI})`);
  }

  const signer = await getDeployerSigner(ethers.provider);
  const nft = await ethers.getContractAt("HansomeGenesisNFT", addr, signer);
  console.log("Network", network.name);
  console.log("NFT", addr);
  console.log("baseURI", baseURI);

  const frozen = await nft.metadataFrozen();
  if (frozen) throw new Error("metadataFrozen — cannot setBaseURI");

  const tx = await nft.setBaseURI(baseURI);
  console.log("tx", tx.hash);
  await tx.wait();
  console.log("tokenURI(1) =", await nft.tokenURI(1n));
  console.log("collectionRevealed", await nft.collectionRevealed());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
