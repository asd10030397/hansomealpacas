/**
 * Probe testnet balances / reserved NFT identity for game deploy.
 * Does not print private keys.
 */
import { ethers } from "hardhat";
import { getDeployerSigner } from "./lib/signer";

const TOKEN = "0xFff67Ad7c818B55E6717fc190D761B83454f7AE2";
const GENESIS = "0x43c1d6aF194A796EC612F2bAC04085a409A1347C";

async function main() {
  const deployer = await getDeployerSigner(ethers.provider);
  const token = await ethers.getContractAt("HansomeAlpacas", TOKEN);
  const nft = await ethers.getContractAt("HansomeGenesisNFT", GENESIS);

  const eth = await ethers.provider.getBalance(deployer.address);
  const hansome = await token.balanceOf(deployer.address);
  console.log(JSON.stringify({
    deployer: deployer.address,
    ethWei: eth.toString(),
    hansomeWei: hansome.toString(),
    ownerOf1: await nft.ownerOf(1),
    side1: Number(await nft.side(1)),
    class1: Number(await nft.gameplayClass(1)),
    revealed1: await nft.isRevealed(1),
    collectionRevealed: await nft.isCollectionRevealed(),
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
