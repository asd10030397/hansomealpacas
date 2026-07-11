import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { getDeployerSigner } from "./lib/signer";

type DeploymentRecord = {
  network: string;
  chainId: number;
  contract: string;
  address: string;
  recipient: string;
  maxSupply: string;
  deployedAt: string;
  deployer: string;
};

async function main() {
  const deployer = await getDeployerSigner(ethers.provider);
  const recipient = process.env.TOKEN_RECIPIENT ?? deployer.address;

  if (recipient === ethers.ZeroAddress) {
    throw new Error("TOKEN_RECIPIENT must be set to a non-zero address");
  }

  const factory = await ethers.getContractFactory("UglyDeer", deployer);
  const token = await factory.deploy(recipient);
  const deployTx = token.deploymentTransaction();

  if (!deployTx) {
    throw new Error("Deployment transaction was not created");
  }

  await token.waitForDeployment();
  const receipt = await deployTx.wait();

  if (!receipt) {
    throw new Error("Deployment transaction receipt was not returned");
  }

  const address = await token.getAddress();
  const maxSupply = await token.MAX_SUPPLY();
  const gasUsed = receipt.gasUsed;
  const gasPrice = receipt.gasPrice ?? deployTx.gasPrice ?? BigInt(0);
  const deploymentCost = gasUsed * gasPrice;

  const record: DeploymentRecord = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    contract: "UglyDeer",
    address,
    recipient,
    maxSupply: maxSupply.toString(),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  const deploymentsDir = join(__dirname, "..", "deployments");
  mkdirSync(deploymentsDir, { recursive: true });
  writeFileSync(join(deploymentsDir, `${network.name}.json`), JSON.stringify(record, null, 2));

  console.log("UGLY DEER deployed");
  console.log(`  Network:   ${record.network} (${record.chainId})`);
  console.log(`  Contract:  ${record.address}`);
  console.log(`  Recipient: ${record.recipient}`);
  console.log(`  Supply:    ${ethers.formatEther(maxSupply)} UGLY`);
  console.log(`  Tx hash:   ${receipt.hash}`);
  console.log(`  Block:     ${receipt.blockNumber}`);
  console.log(`  Gas used:  ${gasUsed.toString()}`);
  console.log(`  Gas price: ${gasPrice.toString()} wei`);
  console.log(`  Cost:      ${ethers.formatEther(deploymentCost)} ETH`);
  console.log(`  Saved:     deployments/${network.name}.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
