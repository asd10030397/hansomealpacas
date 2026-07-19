/**
 * Read tokenURI / side / class for sample tokens after URI + optional reveal.
 *
 *   npx hardhat run scripts/verify-genesis-uris.ts --network robinhoodTestnet
 */
import { ethers } from "hardhat";

const SAMPLES = [1n, 2n, 8n, 10n, 11n, 12n];

async function main() {
  const addr =
    process.env.GENESIS_NFT_ADDRESS ||
    process.env.NEXT_PUBLIC_GENESIS_NFT_ADDRESS;
  if (!addr) throw new Error("Set GENESIS_NFT_ADDRESS");

  const nft = await ethers.getContractAt("HansomeGenesisNFT", addr);
  const revealed = await nft.collectionRevealed();
  const frozen = await nft.metadataFrozen();
  const minted = await nft.totalMinted();

  console.log("NFT", addr);
  console.log("totalMinted", minted.toString());
  console.log("collectionRevealed", revealed);
  console.log("metadataFrozen", frozen);

  for (const id of SAMPLES) {
    try {
      const uri = await nft.tokenURI(id);
      let side = "?";
      let cls = "?";
      if (revealed) {
        side = (await nft.side(id)).toString();
        cls = (await nft.gameplayClass(id)).toString();
      }
      console.log(`#${id} uri=${uri} side=${side} class=${cls}`);
    } catch (e) {
      console.log(`#${id} error: ${(e as Error).message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
