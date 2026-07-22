/**
 * Deploy HANSOME gameplay suite (Treasury, Emission, Distributor, GameRandomness,
 * HansomeGame, SinkRegistry) and wire links.
 *
 * Default: Testnet. Mainnet requires ALLOW_MAINNET_DEPLOY + CONFIRM (or DRY_RUN).
 *
 * Env:
 *   GENESIS_NFT_ADDRESS     — default: deployments/<network>-genesis.json
 *   GAME_TOKEN_ADDRESS      — optional existing ERC-20; else deploys HansomeAlpacas (Testnet only)
 *                             Mainnet: must be canonical $HANSOME
 *   GAME_DAY_ZERO           — unix seconds; Mainnet: REQUIRED (no "now" default)
 *   GAME_DAY_LENGTH_SEC / GAME_COMMIT_DURATION_SEC — optional timing overrides
 *   GAME_FAST_TIMING=0|1    — robinhoodTestnet defaults to fast (2m/2m); Mainnet must be 0/unset
 *   RANDOMNESS_PROVIDER     — Mainnet: REQUIRED; set on GameRandomness after deploy
 *   GAME_TREASURY_FUND_ETH  — whole HANSOME to fund treasury (Mainnet default 30000000 launch; protocol G0 remains 300000000)
 *   SKIP_TREASURY_FUND=1    — skip token transfer into treasury
 *   DRY_RUN=1               — plan only; write *.dry-run.json; no txs
 *   ALLOW_MAINNET_DEPLOY=1 / CONFIRM_MAINNET_DEPLOY=I_UNDERSTAND — Mainnet live writes
 *
 * Usage:
 *   npx hardhat run scripts/deploy-game.ts --network robinhoodTestnet
 *   GAME_FAST_TIMING=0 DRY_RUN=1 npx hardhat run scripts/deploy-game.ts --network mainnet
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { resolveGameTiming } from "./lib/game-timing";
import {
  assertChainIdMatchesNetwork,
  assertKnownNetwork,
  assertMainnetDeployAllowed,
  deploymentFileStem,
  explorerBase,
  isDryRun,
  isMainnetNetwork,
  logDeployBanner,
  logLiveMainnetPreflight,
} from "./lib/deploy-network-guard";
import {
  assertCanonicalMainnetHansome,
  assertNotTestnetContractAddress,
  CANONICAL_MAINNET_HANSOME,
  requireMainnetGameDayZero,
  requireMainnetRandomnessProvider,
} from "./lib/mainnet-game-guards";
import { getDeployerSigner } from "./lib/signer";

/** Testnet-only fallback — never used when isMainnet=true. */
const DEFAULT_TESTNET_GENESIS = "0x43c1d6aF194A796EC612F2bAC04085a409A1347C";

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
  randomnessProvider: string;
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

async function resolveGenesis(
  isMainnet: boolean,
  fileStem: string,
): Promise<string> {
  let resolved: string;
  if (process.env.GENESIS_NFT_ADDRESS?.trim()) {
    resolved = ethers.getAddress(process.env.GENESIS_NFT_ADDRESS.trim());
  } else {
    const candidates = [
      join(__dirname, "..", "deployments", `${fileStem}-genesis.json`),
      join(__dirname, "..", "deployments", `${network.name}-genesis.json`),
    ];
    resolved = "";
    for (const genesisPath of candidates) {
      if (existsSync(genesisPath)) {
        const rec = JSON.parse(readFileSync(genesisPath, "utf8")) as {
          address: string;
        };
        resolved = ethers.getAddress(rec.address);
        break;
      }
    }
    if (!resolved) {
      if (isMainnet) {
        throw new Error(
          "REFUSED: Mainnet deploy-game requires explicit GENESIS_NFT_ADDRESS " +
            "or deployments/robinhood-genesis.json. No Testnet Genesis fallback.",
        );
      }
      resolved = ethers.getAddress(DEFAULT_TESTNET_GENESIS);
    }
  }
  if (isMainnet) {
    assertNotTestnetContractAddress("Genesis NFT", resolved);
  }
  return resolved;
}

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const ctx = { networkName: network.name, chainId };
  assertKnownNetwork(ctx.networkName);
  assertChainIdMatchesNetwork(ctx);
  if (isMainnetNetwork(ctx)) {
    assertMainnetDeployAllowed(ctx, "deploy-game.ts");
  }

  const fileStem = deploymentFileStem(ctx);
  const deployer = await getDeployerSigner(ethers.provider);
  const isMainnet = isMainnetNetwork(ctx);

  if (isMainnet && !process.env.GENESIS_NFT_ADDRESS?.trim()) {
    const genesisFile = join(
      __dirname,
      "..",
      "deployments",
      `${fileStem}-genesis.json`,
    );
    if (!existsSync(genesisFile)) {
      throw new Error(
        "REFUSED: Mainnet requires GENESIS_NFT_ADDRESS (explicit) or deployments/robinhood-genesis.json from deploy-genesis.",
      );
    }
  }
  if (isMainnet && !process.env.GAME_TOKEN_ADDRESS?.trim()) {
    throw new Error(
      `REFUSED: Mainnet requires explicit GAME_TOKEN_ADDRESS (expected ${CANONICAL_MAINNET_HANSOME}).`,
    );
  }
  if (
    isMainnet &&
    process.env.SKIP_TREASURY_FUND !== "1" &&
    !process.env.GAME_TREASURY_FUND_ETH?.trim()
  ) {
    throw new Error(
      "REFUSED: Mainnet requires explicit GAME_TREASURY_FUND_ETH or SKIP_TREASURY_FUND=1 (no silent 300M fund).",
    );
  }

  const genesis = await resolveGenesis(isMainnet, fileStem);
  const timing = resolveGameTiming(network.name);

  if (isMainnet && timing.fast) {
    throw new Error(
      "REFUSED: Mainnet must use production GDS timings. Set GAME_FAST_TIMING=0 and unset 120s overrides.",
    );
  }

  // Mainnet: explicit GAME_DAY_ZERO required. Testnet may compute later.
  const mainnetDayZero = isMainnet ? requireMainnetGameDayZero() : null;

  const randomnessProvider = isMainnet
    ? requireMainnetRandomnessProvider(deployer.address)
    : ethers.getAddress(
        process.env.RANDOMNESS_PROVIDER?.trim() || deployer.address,
      );

  logDeployBanner("deploy-game.ts", ctx, {
    DEPLOYER: deployer.address,
    GENESIS: genesis,
    TOKEN_ENV: process.env.GAME_TOKEN_ADDRESS?.trim() || "(deploy new / default)",
    TIMING: timing.fast ? "FAST" : "GDS",
    COMMIT_SEC: timing.commitDurationSec,
    REVEAL_SEC: timing.revealDurationSec,
    DAY_SEC: timing.dayLengthSec,
    DAY_ZERO:
      mainnetDayZero ??
      (process.env.GAME_DAY_ZERO?.trim() || "(computed)"),
    RANDOMNESS_PROVIDER: randomnessProvider,
    EXPLORER: explorerBase(ctx),
  });

  let tokenAddress: string;
  let tokenDeployed = false;
  if (process.env.GAME_TOKEN_ADDRESS?.trim()) {
    tokenAddress = ethers.getAddress(process.env.GAME_TOKEN_ADDRESS.trim());
    if (isMainnet) {
      tokenAddress = assertCanonicalMainnetHansome(tokenAddress);
    }
    console.log("Using existing token:", tokenAddress);
  } else if (isMainnet) {
    tokenAddress = assertCanonicalMainnetHansome(CANONICAL_MAINNET_HANSOME);
  } else {
    if (isDryRun()) {
      tokenAddress = ethers.ZeroAddress;
      tokenDeployed = true;
      console.log("DRY_RUN: would deploy new HansomeAlpacas reward token");
    } else {
      const tokenFactory = await ethers.getContractFactory(
        "HansomeAlpacas",
        deployer,
      );
      const token = await tokenFactory.deploy(deployer.address);
      await token.waitForDeployment();
      tokenAddress = await token.getAddress();
      tokenDeployed = true;
      console.log("Deployed game reward token:", tokenAddress);
    }
  }

  if (isDryRun()) {
    let plannedDayZero: number;
    if (isMainnet) {
      plannedDayZero = mainnetDayZero as number;
    } else {
      const latest = await ethers.provider.getBlock("latest");
      const now = latest?.timestamp ?? 0;
      const defaultDayZero = timing.fast
        ? now
        : now - (timing.commitDurationSec - 10 * 60);
      plannedDayZero = process.env.GAME_DAY_ZERO?.trim()
        ? Number(process.env.GAME_DAY_ZERO.trim())
        : defaultDayZero;
    }
    const plan = {
      mode: "DRY_RUN",
      script: "deploy-game.ts",
      network: ctx.networkName,
      chainId: ctx.chainId,
      deploymentFileStem: fileStem,
      deployer: deployer.address,
      genesis,
      token: tokenAddress,
      tokenDeployed,
      randomnessProvider,
      timing,
      dayZero: plannedDayZero,
      postDeploy: [
        randomnessProvider.toLowerCase() === deployer.address.toLowerCase()
          ? "GameRandomness.randomnessProvider remains deployer (constructor default)"
          : `GameRandomness.setRandomnessProvider(${randomnessProvider})`,
      ],
      deploymentOrder: [
        "GameTreasury",
        "EmissionController",
        "RewardDistributor",
        "GameRandomness",
        "HansomeGame",
        "SinkRegistry",
        "link treasury+distributor",
        "setRandomnessProvider (if != deployer)",
        "optional treasury fund",
      ],
      links: [
        "treasury.setGame(game)",
        "treasury.setDistributor(distributor)",
        "treasury.setSinkRegistry(sinks)",
        "distributor.setGame(game)",
      ],
      fundTreasury:
        process.env.SKIP_TREASURY_FUND === "1"
          ? "SKIP"
          : process.env.GAME_TREASURY_FUND_ETH?.trim() ||
            (timing.fast ? "50000000" : "30000000"),
      note:
        "GameRandomness + RewardDistributor are deployed inside this script (no separate scripts).",
      generatedAt: new Date().toISOString(),
    };
    const deploymentsDir = join(__dirname, "..", "deployments");
    mkdirSync(deploymentsDir, { recursive: true });
    const outPath = join(deploymentsDir, `${fileStem}-game.dry-run.json`);
    writeFileSync(outPath, `${JSON.stringify(plan, null, 2)}\n`);
    console.log("DRY_RUN complete — no transactions sent.");
    console.log("Wrote", outPath);
    return;
  }

  // Live path — resolve dayZero for Testnet if needed.
  let resolvedDayZero: number;
  if (isMainnet) {
    resolvedDayZero = mainnetDayZero as number;
  } else {
    const latest = await ethers.provider.getBlock("latest");
    if (!latest) throw new Error("Missing latest block");
    const now = latest.timestamp;
    const defaultDayZero = timing.fast
      ? now
      : now - (timing.commitDurationSec - 10 * 60);
    resolvedDayZero = process.env.GAME_DAY_ZERO?.trim()
      ? Number(process.env.GAME_DAY_ZERO.trim())
      : defaultDayZero;
    if (!Number.isFinite(resolvedDayZero) || resolvedDayZero <= 0) {
      throw new Error("Invalid GAME_DAY_ZERO");
    }
  }

  if (isMainnet) {
    logLiveMainnetPreflight("deploy-game.ts", ctx, {
      deployer: deployer.address,
      genesis,
      token: tokenAddress,
      randomnessProvider,
      commitDurationSec: timing.commitDurationSec,
      revealDurationSec: timing.revealDurationSec,
      dayLengthSec: timing.dayLengthSec,
      dayZero: resolvedDayZero,
      fundTreasury:
        process.env.SKIP_TREASURY_FUND === "1"
          ? "SKIP"
          : process.env.GAME_TREASURY_FUND_ETH?.trim() || "?",
      outputJson: `deployments/${fileStem}-game.json`,
      plannedOwner: process.env.MAINNET_OWNER?.trim() || "(transfer later)",
    });
  }

  console.log("CHAIN_ID before tx:", ctx.chainId);
  const token = await ethers.getContractAt(
    "HansomeAlpacas",
    tokenAddress,
    deployer,
  );

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

  console.log(
    "RewardDistributor constructor: genesis=",
    genesis,
    "treasury=",
    await treasury.getAddress(),
  );
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

  console.log(
    "Timing:",
    timing.fast ? "FAST (testnet QA)" : "PRODUCTION (GDS)",
    `commit=${timing.commitDurationSec}s`,
    `reveal=${timing.revealDurationSec}s`,
    `battle=${timing.battleDurationSec}s`,
    `day=${timing.dayLengthSec}s`,
  );

  console.log("CHAIN_ID before HansomeGame tx:", ctx.chainId);
  console.log("HansomeGame constructor targets:", {
    genesis,
    treasury: await treasury.getAddress(),
    emission: await emission.getAddress(),
    distributor: await distributor.getAddress(),
    randomness: await randomness.getAddress(),
    dayZero: resolvedDayZero,
    dayLengthSec: timing.dayLengthSec,
    commitDurationSec: timing.commitDurationSec,
    revealDurationSec: timing.revealDurationSec,
    owner: deployer.address,
  });
  const game = await (
    await ethers.getContractFactory("HansomeGame", deployer)
  ).deploy(
    genesis,
    await treasury.getAddress(),
    await emission.getAddress(),
    await distributor.getAddress(),
    await randomness.getAddress(),
    resolvedDayZero,
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
    resolvedDayZero,
    "commitEndsAt:",
    resolvedDayZero + timing.commitDurationSec,
    "revealEndsAt:",
    resolvedDayZero + timing.commitDurationSec + timing.revealDurationSec,
    "dayEndsAt:",
    resolvedDayZero + timing.dayLengthSec,
  );

  const sinks = await (
    await ethers.getContractFactory("SinkRegistry", deployer)
  ).deploy(tokenAddress, await treasury.getAddress(), deployer.address);
  await sinks.waitForDeployment();
  console.log("SinkRegistry:", await sinks.getAddress());

  const gameAddr = await game.getAddress();
  const distAddr = await distributor.getAddress();
  const sinksAddr = await sinks.getAddress();
  console.log(
    "Linking (onlyOwner): treasury.setGame/setDistributor/setSinkRegistry; distributor.setGame",
  );
  console.log(
    "  game=",
    gameAddr,
    "distributor=",
    distAddr,
    "sinks=",
    sinksAddr,
  );
  await (await treasury.setGame(gameAddr)).wait();
  await (await treasury.setDistributor(distAddr)).wait();
  await (await treasury.setSinkRegistry(sinksAddr)).wait();
  await (await distributor.setGame(gameAddr)).wait();
  console.log("Linking complete.");

  const currentProvider = ethers.getAddress(
    await randomness.randomnessProvider(),
  );
  if (currentProvider !== randomnessProvider) {
    console.log(
      `GameRandomness.setRandomnessProvider(${randomnessProvider}) (was ${currentProvider})`,
    );
    await (await randomness.setRandomnessProvider(randomnessProvider)).wait();
  } else {
    console.log(
      "GameRandomness.randomnessProvider already",
      randomnessProvider,
      "(constructor default)",
    );
  }
  const finalProvider = ethers.getAddress(await randomness.randomnessProvider());
  if (finalProvider !== randomnessProvider) {
    throw new Error(
      `REFUSED: randomnessProvider mismatch after set — want ${randomnessProvider}, got ${finalProvider}`,
    );
  }

  let treasuryFundedWei = "0";
  if (process.env.SKIP_TREASURY_FUND !== "1") {
    const fundWhole =
      process.env.GAME_TREASURY_FUND_ETH?.trim() ??
      (timing.fast ? "50000000" : "30000000");
    const fund = ethers.parseEther(fundWhole);
    const bal = await token.balanceOf(deployer.address);
    if (bal < fund) {
      throw new Error(
        `Deployer token balance ${ethers.formatEther(bal)} < fund ${fundWhole}. ` +
          `Set GAME_TREASURY_FUND_ETH lower, fund the deployer, or SKIP_TREASURY_FUND=1.`,
      );
    }
    console.log(
      "Funding GameTreasury (claim payer) with",
      fundWhole,
      "tokens →",
      await treasury.getAddress(),
    );
    await (await token.transfer(await treasury.getAddress(), fund)).wait();
    treasuryFundedWei = fund.toString();
    console.log("Funded treasury:", ethers.formatEther(fund), "HANSOME");
  }

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
    randomnessProvider: finalProvider,
    dayZero: resolvedDayZero,
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
  const outPath = join(deploymentsDir, `${fileStem}-game.json`);
  writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`);
  console.log("Wrote", outPath);
  console.log("Saved addresses:", {
    game: record.address,
    distributor: record.distributor,
    randomness: record.randomness,
    randomnessProvider: record.randomnessProvider,
    treasury: record.treasury,
    genesis: record.genesis,
    token: record.token,
  });

  const reportPath = join(deploymentsDir, `${fileStem}-game-report.md`);
  writeFileSync(
    reportPath,
    [
      `# Game deploy report — ${network.name} (stem=${fileStem})`,
      "",
      `- HansomeGame: \`${record.address}\``,
      `- RewardDistributor: \`${record.distributor}\``,
      `- GameRandomness: \`${record.randomness}\``,
      `- randomnessProvider: \`${record.randomnessProvider}\``,
      `- GameTreasury: \`${record.treasury}\``,
      `- SinkRegistry: \`${record.sinks}\``,
      `- Token: \`${record.token}\`${tokenDeployed ? " (deployed for game funding)" : ""}`,
      `- Genesis: \`${record.genesis}\``,
      `- dayZero: \`${record.dayZero}\``,
      `- Timing: commit \`${record.commitDurationSec}s\` / reveal \`${record.revealDurationSec}s\` / day \`${record.dayLengthSec}s\`${record.fastTiming ? " (fast testnet)" : " (production GDS)"}`,
      `- Deploy tx: \`${record.deployTxHash}\``,
      `- Deployer: \`${record.deployer}\``,
      `- Explorer: ${explorerBase(ctx)}/address/${record.address}`,
      "",
      "Next:",
      "```bash",
      isMainnet
        ? "npx hardhat run scripts/verify-mainnet-game.ts --network mainnet"
        : "npx hardhat run scripts/sync-game-env.ts --network robinhoodTestnet",
      isMainnet
        ? "DRY_RUN=1 MAINNET_OWNER=0x… npx hardhat run scripts/transfer-mainnet-ownership.ts --network mainnet"
        : "npx hardhat run scripts/validate-game-flow.ts --network robinhoodTestnet",
      isMainnet ? "# Then Vercel cutover — docs/MAINNET_VERCEL_CUTOVER.md" : "",
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
