/**
 * Deploy HANSOME gameplay suite on Robinhood Testnet.
 *
 * Env:
 *   GENESIS_NFT_ADDRESS     — default: deployments/<network>-genesis.json
 *   GAME_TOKEN_ADDRESS      — optional existing ERC-20; else deploys HansomeAlpacas to deployer
 *   GAME_DAY_ZERO           — unix seconds; default: start of current commit window
 *   GAME_DAY_LENGTH_SEC / GAME_COMMIT_DURATION_SEC — optional timing overrides
 *   GAME_FAST_TIMING=0|1    — robinhoodTestnet defaults to fast (2m/2m); set 0 for GDS 20h/4h
 *   GAME_TREASURY_FUND_ETH  — whole HANSOME to fund treasury (default 300000000 = G0)
 *   SKIP_TREASURY_FUND=1    — skip token transfer into treasury
 *
 * Usage: npx hardhat run scripts/deploy-game.ts --network robinhoodTestnet
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { resolveGameTiming } from "./lib/game-timing";
import { getDeployerSigner } from "./lib/signer";

const DEFAULT_GENESIS = "0x43c1d6aF194A796EC612F2bAC04085a409A1347C";

type GameDeploymentRecord = {
  network: string;
  chainId: number;
  contract: "HansomeGame";
  address: string;
  genesis: string;
  token: string;
  tokenDeployed: boolean;
  treasury: string;
  emission: string;
  distributor: string;
  randomness: string;
  sinks: string;
  dayZero: number;
  dayLengthSec: number;
  commitDurationSec: number;
  revealDurationSec: number;
  fastTiming: boolean;
  treasuryFundedWei: string;
  deployTxHash: string;
  deployBlockNumber: number;
  deployedAt: string;
  deployer: string;
};

async function resolveGenesis(): Promise<string> {
  if (process.env.GENESIS_NFT_ADDRESS?.trim()) {
    return ethers.getAddress(process.env.GENESIS_NFT_ADDRESS.trim());
  }
  const genesisPath = join(__dirname, "..", "deployments", `${network.name}-genesis.json`);
  if (existsSync(genesisPath)) {
    const rec = JSON.parse(readFileSync(genesisPath, "utf8")) as { address: string };
    return ethers.getAddress(rec.address);
  }
  return ethers.getAddress(DEFAULT_GENESIS);
}

async function main() {
  const deployer = await getDeployerSigner(ethers.provider);
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const genesis = await resolveGenesis();

  console.log("Network:", network.name, "chainId:", chainId);
  console.log("Deployer:", deployer.address);
  console.log("Genesis:", genesis);

  let tokenAddress: string;
  let tokenDeployed = false;
  if (process.env.GAME_TOKEN_ADDRESS?.trim()) {
    tokenAddress = ethers.getAddress(process.env.GAME_TOKEN_ADDRESS.trim());
    console.log("Using existing token:", tokenAddress);
  } else {
    // Deployer has 0 of the public testnet HANSOME; mint a dedicated game-reward token.
    const tokenFactory = await ethers.getContractFactory("HansomeAlpacas", deployer);
    const token = await tokenFactory.deploy(deployer.address);
    await token.waitForDeployment();
    tokenAddress = await token.getAddress();
    tokenDeployed = true;
    console.log("Deployed game reward token:", tokenAddress);
  }

  const token = await ethers.getContractAt("HansomeAlpacas", tokenAddress, deployer);

  const treasury = await (
    await ethers.getContractFactory("GameTreasury", deployer)
  ).deploy(tokenAddress, deployer.address);
  await treasury.waitForDeployment();
  console.log("GameTreasury:", await treasury.getAddress());

  const emission = await (
    await ethers.getContractFactory("EmissionController", deployer)
  ).deploy();
  await emission.waitForDeployment();
  console.log("EmissionController:", await emission.getAddress());

  const distributor = await (
    await ethers.getContractFactory("RewardDistributor", deployer)
  ).deploy(genesis, await treasury.getAddress(), deployer.address);
  await distributor.waitForDeployment();
  console.log("RewardDistributor:", await distributor.getAddress());

  const randomness = await (
    await ethers.getContractFactory("GameRandomness", deployer)
  ).deploy(deployer.address);
  await randomness.waitForDeployment();
  console.log("GameRandomness:", await randomness.getAddress());

  const timing = resolveGameTiming(network.name);
  console.log(
    "Timing:",
    timing.fast ? "FAST (testnet QA)" : "PRODUCTION (GDS)",
    `commit=${timing.commitDurationSec}s`,
    `reveal=${timing.revealDurationSec}s`,
    `battle=${timing.battleDurationSec}s`,
    `day=${timing.dayLengthSec}s`,
  );

  const latest = await ethers.provider.getBlock("latest");
  if (!latest) throw new Error("Missing latest block");
  const now = latest.timestamp;
  // Fast: start day 0 now (full commit window). Prod: ~10 min commit remaining.
  const defaultDayZero = timing.fast
    ? now
    : now - (timing.commitDurationSec - 10 * 60);
  const dayZero = process.env.GAME_DAY_ZERO?.trim()
    ? Number(process.env.GAME_DAY_ZERO.trim())
    : defaultDayZero;
  if (!Number.isFinite(dayZero) || dayZero <= 0) {
    throw new Error("Invalid GAME_DAY_ZERO");
  }

  const game = await (
    await ethers.getContractFactory("HansomeGame", deployer)
  ).deploy(
    genesis,
    await treasury.getAddress(),
    await emission.getAddress(),
    await distributor.getAddress(),
    await randomness.getAddress(),
    dayZero,
    timing.dayLengthSec,
    timing.commitDurationSec,
    timing.revealDurationSec,
    deployer.address,
  );
  await game.waitForDeployment();
  const deployTx = game.deploymentTransaction();
  if (!deployTx) throw new Error("Missing HansomeGame deployment tx");
  const deployReceipt = await deployTx.wait();
  if (!deployReceipt) throw new Error("Missing HansomeGame receipt");
  console.log("HansomeGame:", await game.getAddress());
  console.log(
    "dayZero:",
    dayZero,
    "commitEndsAt:",
    dayZero + timing.commitDurationSec,
    "revealEndsAt:",
    dayZero + timing.commitDurationSec + timing.revealDurationSec,
    "dayEndsAt:",
    dayZero + timing.dayLengthSec,
  );

  const sinks = await (
    await ethers.getContractFactory("SinkRegistry", deployer)
  ).deploy(tokenAddress, await treasury.getAddress(), deployer.address);
  await sinks.waitForDeployment();
  console.log("SinkRegistry:", await sinks.getAddress());

  await (await treasury.setGame(await game.getAddress())).wait();
  await (await treasury.setDistributor(await distributor.getAddress())).wait();
  await (await treasury.setSinkRegistry(await sinks.getAddress())).wait();
  await (await distributor.setGame(await game.getAddress())).wait();

  let treasuryFundedWei = "0";
  if (process.env.SKIP_TREASURY_FUND !== "1") {
    // Testnet default 50M (above G_SAFE); production/mainnet still prefers full G0 when set.
    const fundWhole =
      process.env.GAME_TREASURY_FUND_ETH?.trim() ??
      (timing.fast ? "50000000" : "300000000");
    const fund = ethers.parseEther(fundWhole);
    const bal = await token.balanceOf(deployer.address);
    if (bal < fund) {
      throw new Error(
        `Deployer token balance ${ethers.formatEther(bal)} < fund ${fundWhole}. ` +
          `Set GAME_TREASURY_FUND_ETH lower, fund the deployer, or SKIP_TREASURY_FUND=1.`,
      );
    }
    await (await token.transfer(await treasury.getAddress(), fund)).wait();
    treasuryFundedWei = fund.toString();
    console.log("Funded treasury:", ethers.formatEther(fund), "HANSOME");
  }

  // Sanity: day 0 should be CommitOpen with default dayZero.
  const state = await game.dayState(0);
  console.log("dayState(0):", Number(state), "(1=CommitOpen)");

  const record: GameDeploymentRecord = {
    network: network.name,
    chainId,
    contract: "HansomeGame",
    address: await game.getAddress(),
    genesis,
    token: tokenAddress,
    tokenDeployed,
    treasury: await treasury.getAddress(),
    emission: await emission.getAddress(),
    distributor: await distributor.getAddress(),
    randomness: await randomness.getAddress(),
    sinks: await sinks.getAddress(),
    dayZero,
    dayLengthSec: timing.dayLengthSec,
    commitDurationSec: timing.commitDurationSec,
    revealDurationSec: timing.revealDurationSec,
    fastTiming: timing.fast,
    treasuryFundedWei,
    deployTxHash: deployReceipt.hash,
    deployBlockNumber: deployReceipt.blockNumber,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  const deploymentsDir = join(__dirname, "..", "deployments");
  mkdirSync(deploymentsDir, { recursive: true });
  const outPath = join(deploymentsDir, `${network.name}-game.json`);
  writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`);
  console.log("Wrote", outPath);

  const reportPath = join(deploymentsDir, `${network.name}-game-report.md`);
  writeFileSync(
    reportPath,
    [
      `# Game deploy report — ${network.name}`,
      "",
      `- HansomeGame: \`${record.address}\``,
      `- RewardDistributor: \`${record.distributor}\``,
      `- GameTreasury: \`${record.treasury}\``,
      `- Token: \`${record.token}\`${tokenDeployed ? " (deployed for game funding)" : ""}`,
      `- Genesis: \`${record.genesis}\``,
      `- dayZero: \`${record.dayZero}\``,
      `- Timing: commit \`${record.commitDurationSec}s\` / reveal \`${record.revealDurationSec}s\` / day \`${record.dayLengthSec}s\`${record.fastTiming ? " (fast testnet)" : " (production GDS)"}`,
      `- Deploy tx: \`${record.deployTxHash}\``,
      `- Deployer: \`${record.deployer}\``,
      `- Explorer: https://explorer.testnet.chain.robinhood.com/address/${record.address}`,
      "",
      "Next:",
      "```bash",
      "npx hardhat run scripts/sync-game-env.ts --network robinhoodTestnet",
      "npx hardhat run scripts/validate-game-flow.ts --network robinhoodTestnet",
      "```",
      "",
    ].join("\n"),
  );
  console.log("Wrote", reportPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
