import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import hre from "hardhat";

type DeploymentRecord = {
  address: string;
  recipient: string;
};

async function main() {
  const deploymentPath = join(__dirname, "..", "deployments", `${hre.network.name}.json`);
  let address = process.env.UGLY_DEER_ADDRESS?.trim();
  let recipient = process.env.TOKEN_RECIPIENT?.trim();

  if (existsSync(deploymentPath)) {
    const record = JSON.parse(readFileSync(deploymentPath, "utf8")) as DeploymentRecord;
    address = address || record.address;
    recipient = recipient || record.recipient;
  }

  if (!address) {
    throw new Error(
      `Missing contract address. Set UGLY_DEER_ADDRESS or deploy first (deployments/${hre.network.name}.json).`,
    );
  }

  if (!recipient) {
    throw new Error("Missing TOKEN_RECIPIENT for constructor verification.");
  }

  console.log(`Verifying UglyDeer at ${address} on ${hre.network.name}...`);

  await hre.run("verify:verify", {
    address,
    constructorArguments: [recipient],
  });

  console.log("Verification submitted.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
