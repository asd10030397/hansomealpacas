import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";

const EXPECTED_SUPPLY = ethers.parseEther("1000000000");

async function main() {
  const deploymentPath = join(__dirname, "..", "deployments", `${network.name}.json`);

  if (!existsSync(deploymentPath)) {
    throw new Error(`Missing deployment record: deployments/${network.name}.json`);
  }

  const record = JSON.parse(readFileSync(deploymentPath, "utf8")) as {
    address: string;
    recipient: string;
  };

  const token = await ethers.getContractAt("HansomeAlpacas", record.address);

  const [name, symbol, decimals, totalSupply, recipientBalance] = await Promise.all([
    token.name(),
    token.symbol(),
    token.decimals(),
    token.totalSupply(),
    token.balanceOf(record.recipient),
  ]);

  console.log("Contract validation");
  console.log(`  name():                    ${name}`);
  console.log(`  symbol():                  ${symbol}`);
  console.log(`  decimals():                ${decimals}`);
  console.log(`  totalSupply():             ${ethers.formatEther(totalSupply)} HANSOME`);
  console.log(`  balanceOf(TOKEN_RECIPIENT): ${ethers.formatEther(recipientBalance)} HANSOME`);
  console.log(`  Recipient:                 ${record.recipient}`);

  const checks = [
    name === "Hansome Alpacas",
    symbol === "HANSOME",
    Number(decimals) === 18,
    totalSupply === EXPECTED_SUPPLY,
    recipientBalance === EXPECTED_SUPPLY,
  ];

  if (checks.every(Boolean)) {
    console.log("  Result:                    PASS — full supply minted to TOKEN_RECIPIENT");
    return;
  }

  console.error("  Result:                    FAIL — on-chain values do not match expectations");
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
