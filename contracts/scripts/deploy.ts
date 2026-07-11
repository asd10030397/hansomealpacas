import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";

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
  const [deployer] = await ethers.getSigners();
  const recipient = process.env.TOKEN_RECIPIENT ?? deployer.address;

  if (recipient === ethers.ZeroAddress) {
    throw new Error("TOKEN_RECIPIENT must be set to a non-zero address");
  }

  const factory = await ethers.getContractFactory("UglyDeer");
  const token = await factory.deploy(recipient);
  await token.waitForDeployment();

  const address = await token.getAddress();
  const maxSupply = await token.MAX_SUPPLY();

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
  console.log(`  Saved:     deployments/${network.name}.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
