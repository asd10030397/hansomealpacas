/**
 * Deploy Test HANSOME (tHANSOME) — Robinhood Testnet ONLY.
 *
 * TEST TOKEN. Do not deploy to Robinhood Mainnet.
 * Does not modify the real $HANSOME (`HansomeAlpacas`) contract.
 *
 *   npx hardhat run scripts/deploy-thansome.ts --network robinhoodTestnet
 *
 * Mints 1_000_000_000 tHANSOME to the deployer.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { getDeployerSigner } from "./lib/signer";

const MAINNET_NAMES = new Set(["robinhood", "mainnet", "robinhoodMainnet"]);

type ThansomeRecord = {
  warning: string;
  network: string;
  chainId: number;
  contract: "TestHANSOME";
  name: "Test HANSOME";
  symbol: "tHANSOME";
  decimals: 18;
  address: string;
  testSupplyWei: string;
  deployTxHash: string;
  deployBlockNumber: number;
  deployedAt: string;
  deployer: string;
  deployerBalanceWei: string;
};

async function main() {
  if (MAINNET_NAMES.has(network.name) || network.name.toLowerCase().includes("mainnet")) {
    throw new Error(
      `REFUSED: tHANSOME must not be deployed on ${network.name}. Use --network robinhoodTestnet only.`,
    );
  }
  if (network.name !== "robinhoodTestnet" && network.name !== "hardhat") {
    console.warn(
      `WARNING: deploying tHANSOME on non-standard network "${network.name}". Intended for robinhoodTestnet only.`,
    );
  }

  const deployer = await getDeployerSigner(ethers.provider);
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  console.log("Network:", network.name, "chainId:", chainId);
  console.log("Deployer:", deployer.address);
  console.log("Contract: TestHANSOME (TEST-ONLY — not $HANSOME)");

  const factory = await ethers.getContractFactory("TestHANSOME", deployer);
  const token = await factory.deploy(deployer.address);
  await token.waitForDeployment();
  const address = await token.getAddress();
  const deployTx = token.deploymentTransaction();
  if (!deployTx) throw new Error("Missing deployment tx");
  const receipt = await deployTx.wait();
  if (!receipt) throw new Error("Missing receipt");

  const supply = await token.TEST_SUPPLY();
  const bal = await token.balanceOf(deployer.address);
  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = await token.decimals();

  console.log("tHANSOME:", address);
  console.log("name/symbol/decimals:", name, symbol, decimals);
  console.log("deployer balance:", ethers.formatEther(bal));
  console.log("deploy tx:", receipt.hash);

  if (name !== "Test HANSOME" || symbol !== "tHANSOME" || decimals !== 18n) {
    throw new Error("Unexpected token metadata");
  }
  if (bal !== supply) throw new Error("Deployer did not receive full TEST_SUPPLY");

  const record: ThansomeRecord = {
    warning:
      "TESTNET ONLY — Test HANSOME (tHANSOME). Not the real $HANSOME. Do not deploy or use on Mainnet.",
    network: network.name,
    chainId,
    contract: "TestHANSOME",
    name: "Test HANSOME",
    symbol: "tHANSOME",
    decimals: 18,
    address,
    testSupplyWei: supply.toString(),
    deployTxHash: receipt.hash,
    deployBlockNumber: receipt.blockNumber,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    deployerBalanceWei: bal.toString(),
  };

  const dir = join(__dirname, "..", "deployments");
  mkdirSync(dir, { recursive: true });
  const outPath = join(dir, `${network.name}-thansome.json`);
  writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`);
  console.log("Wrote", outPath);

  // Patch contracts/.env THANSOME_ADDRESS / GAME_TOKEN_ADDRESS hints (no secrets logged)
  const envPath = join(__dirname, "..", ".env");
  if (existsSync(envPath)) {
    let env = readFileSync(envPath, "utf8");
    const upsert = (key: string, value: string) => {
      const re = new RegExp(`^${key}=.*$`, "m");
      if (re.test(env)) env = env.replace(re, `${key}=${value}`);
      else env = `${env.trimEnd()}\n${key}=${value}\n`;
    };
    upsert("THANSOME_ADDRESS", address);
    upsert("GAME_TOKEN_ADDRESS", address);
    writeFileSync(envPath, env.endsWith("\n") ? env : `${env}\n`);
    console.log("Updated contracts/.env THANSOME_ADDRESS + GAME_TOKEN_ADDRESS");
  }

  const reportPath = join(dir, `${network.name}-thansome-report.md`);
  writeFileSync(
    reportPath,
    [
      `# tHANSOME deploy — ${network.name} (TEST ONLY)`,
      "",
      "> Not real $HANSOME. Robinhood Testnet only. Do not deploy to Mainnet.",
      "",
      `- Address: \`${address}\``,
      `- Name / Symbol: Test HANSOME / tHANSOME`,
      `- Decimals: 18`,
      `- Supply minted to deployer: \`${ethers.formatEther(supply)}\``,
      `- Deploy tx: \`${receipt.hash}\``,
      `- Deployer: \`${deployer.address}\``,
      "",
      "Next:",
      "```bash",
      "# Redeploy game suite bound to tHANSOME (treasury token is immutable)",
      "GAME_TOKEN_ADDRESS=" + address + " SKIP_TREASURY_FUND=1 \\",
      "  npx hardhat run scripts/deploy-game.ts --network robinhoodTestnet",
      "npx hardhat run scripts/fund-test-reward-distributor.ts --network robinhoodTestnet",
      "npx hardhat run scripts/sync-game-env.ts --network robinhoodTestnet",
      "```",
      "",
    ].join("\n"),
  );
  console.log("Wrote", reportPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
