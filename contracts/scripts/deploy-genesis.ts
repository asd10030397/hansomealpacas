/**
 * Deploy HANSOME Genesis NFT with VRF-ready randomness provider.
 *
 * Env:
 *   ROYALTY_RECEIVER   — royalty fee recipient (default: deployer)
 *   PLACEHOLDER_URI    — pre-reveal URI
 *   USE_REVEAL_MOCK=1  — deploy RevealRandomnessMock (testnet/dev only)
 *   VRF_OPERATOR       — required if USE_REVEAL_MOCK is not set (adapter operator)
 *
 * Usage: npx hardhat run scripts/deploy-genesis.ts --network <network>
 */
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const royaltyReceiver = process.env.ROYALTY_RECEIVER ?? deployer.address;
  const placeholderURI = process.env.PLACEHOLDER_URI ?? "ipfs://placeholder.json";
  const useMock = process.env.USE_REVEAL_MOCK === "1";

  console.log("Deployer:", deployer.address);

  let randomnessProvider: string;

  if (useMock) {
    console.warn("WARNING: Deploying RevealRandomnessMock — NOT for mainnet.");
    const mock = await ethers.deployContract("RevealRandomnessMock", [deployer.address]);
    await mock.waitForDeployment();
    randomnessProvider = await mock.getAddress();
    console.log("RevealRandomnessMock:", randomnessProvider);
  } else {
    const vrfOperator = process.env.VRF_OPERATOR;
    if (!vrfOperator) throw new Error("Set VRF_OPERATOR or USE_REVEAL_MOCK=1");
    const adapter = await ethers.deployContract("VRFRevealAdapter", [deployer.address, vrfOperator]);
    await adapter.waitForDeployment();
    randomnessProvider = await adapter.getAddress();
    console.log("VRFRevealAdapter:", randomnessProvider);
  }

  const nft = await ethers.deployContract("HansomeGenesisNFT", [
    deployer.address,
    royaltyReceiver,
    randomnessProvider,
    placeholderURI,
  ]);
  await nft.waitForDeployment();
  console.log("HansomeGenesisNFT:", await nft.getAddress());

  if (!useMock) {
    const adapter = await ethers.getContractAt("VRFRevealAdapter", randomnessProvider);
    await adapter.setConsumer(await nft.getAddress());
    console.log("Adapter consumer set to NFT");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
