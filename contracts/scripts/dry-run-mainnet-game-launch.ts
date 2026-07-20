/**
 * Final Mainnet Game launch preflight (NO transactions).
 *
 * Run after Genesis is ready and before live deploy-game.ts.
 * Aggregates addresses, chainId, token, timing, ownership plan, funding, blockers.
 *
 * Usage:
 *   DRY_RUN=1 npx hardhat run scripts/dry-run-mainnet-game-launch.ts --network mainnet
 *
 * Required env for zero blockers:
 *   GENESIS_NFT_ADDRESS or deployments/robinhood-genesis.json
 *   GAME_TOKEN_ADDRESS=0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875
 *   GAME_DAY_ZERO=<unix>
 *   RANDOMNESS_PROVIDER=<address>
 *   GAME_TREASURY_FUND_ETH=<whole> OR SKIP_TREASURY_FUND=1
 *   GAME_FAST_TIMING unset/0
 *
 * Recommended:
 *   MAINNET_OWNER=<multisig>
 *
 * Writes: deployments/robinhood-mainnet-game-launch.dry-run.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import {
  assertChainIdMatchesNetwork,
  assertExplicitMainnetNetwork,
  assertKnownNetwork,
  explorerBase,
  isDryRun,
  isMainnetNetwork,
  logDeployBanner,
  ROBINHOOD_MAINNET_CHAIN_ID,
} from "./lib/deploy-network-guard";
import {
  PROD_COMMIT_DURATION_SEC,
  PROD_DAY_LENGTH_SEC,
  PROD_REVEAL_DURATION_SEC,
  resolveGameTiming,
} from "./lib/game-timing";
import {
  assertCanonicalMainnetHansome,
  assertNotTestnetContractAddress,
  CANONICAL_MAINNET_HANSOME,
  requireMainnetGameDayZero,
  requireMainnetRandomnessProvider,
} from "./lib/mainnet-game-guards";
import { getDeployerSigner } from "./lib/signer";

type Check = {
  id: string;
  ok: boolean;
  severity: "pass" | "warn" | "blocker";
  detail: string;
};

async function main() {
  process.env.DRY_RUN = process.env.DRY_RUN?.trim() || "1";

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const ctx = { networkName: network.name, chainId };
  assertKnownNetwork(ctx.networkName);
  assertChainIdMatchesNetwork(ctx);
  if (!isMainnetNetwork(ctx)) {
    throw new Error(
      `REFUSED: dry-run-mainnet-game-launch.ts requires --network mainnet (or robinhood), chainId ${ROBINHOOD_MAINNET_CHAIN_ID}.`,
    );
  }
  assertExplicitMainnetNetwork(ctx);
  if (!isDryRun()) {
    throw new Error("REFUSED: this script is dry-run only. Set DRY_RUN=1.");
  }

  const deployer = await getDeployerSigner(ethers.provider);
  const deployerAddress = deployer.address;
  const timing = resolveGameTiming(network.name);

  logDeployBanner("dry-run-mainnet-game-launch.ts", ctx, {
    DEPLOYER: deployerAddress,
    EXPLORER: explorerBase(ctx),
    NOTE: "FINAL PREFLIGHT — no transactions",
  });

  const checks: Check[] = [];
  const push = (c: Check) => checks.push(c);

  const networkOk =
    (ctx.networkName === "mainnet" || ctx.networkName === "robinhood") &&
    ctx.chainId === ROBINHOOD_MAINNET_CHAIN_ID;
  push({
    id: "network",
    ok: networkOk,
    severity: networkOk ? "pass" : "blocker",
    detail: `network=${ctx.networkName} chainId=${ctx.chainId}`,
  });

  // Timing
  const timingGds =
    !timing.fast &&
    timing.commitDurationSec === PROD_COMMIT_DURATION_SEC &&
    timing.revealDurationSec === PROD_REVEAL_DURATION_SEC &&
    timing.dayLengthSec === PROD_DAY_LENGTH_SEC;
  push({
    id: "timing_gds",
    ok: timingGds,
    severity: timingGds ? "pass" : "blocker",
    detail: `commit=${timing.commitDurationSec} reveal=${timing.revealDurationSec} day=${timing.dayLengthSec} fast=${timing.fast}`,
  });

  // Genesis
  const genesisPath = join(
    __dirname,
    "..",
    "deployments",
    "robinhood-genesis.json",
  );
  const genesisFromFile = existsSync(genesisPath)
    ? (JSON.parse(readFileSync(genesisPath, "utf8")) as {
        address?: string;
        reservedMinted?: boolean;
        reserveMintStatus?: string;
      })
    : null;
  let genesisAddr: string | null = null;
  let genesisDetail = "";
  try {
    if (process.env.GENESIS_NFT_ADDRESS?.trim()) {
      genesisAddr = assertNotTestnetContractAddress(
        "GENESIS_NFT_ADDRESS",
        process.env.GENESIS_NFT_ADDRESS.trim(),
      );
    } else if (genesisFromFile?.address) {
      genesisAddr = assertNotTestnetContractAddress(
        "robinhood-genesis.json",
        genesisFromFile.address,
      );
    }
    genesisDetail = genesisAddr
      ? `Genesis=${genesisAddr}`
      : "Missing GENESIS_NFT_ADDRESS and robinhood-genesis.json";
  } catch (e) {
    genesisDetail = e instanceof Error ? e.message : String(e);
  }
  push({
    id: "genesis",
    ok: Boolean(genesisAddr),
    severity: genesisAddr ? "pass" : "blocker",
    detail: genesisDetail,
  });
  if (genesisFromFile) {
    const reservedOk =
      genesisFromFile.reservedMinted === true ||
      genesisFromFile.reserveMintStatus === "done";
    push({
      id: "genesis_reserved",
      ok: reservedOk,
      severity: reservedOk ? "pass" : "warn",
      detail: reservedOk
        ? "reservedMint recorded in robinhood-genesis.json"
        : "reservedMint not marked done — run verify-mainnet-reserved.ts",
    });
  }

  // Token — require explicit env (same as deploy-game Mainnet)
  let tokenAddr: string | null = null;
  let tokenDetail = "";
  let deployerTokenBal = 0n;
  try {
    const raw = process.env.GAME_TOKEN_ADDRESS?.trim();
    if (!raw) {
      throw new Error(
        `REFUSED: set GAME_TOKEN_ADDRESS=${CANONICAL_MAINNET_HANSOME}`,
      );
    }
    tokenAddr = assertCanonicalMainnetHansome(raw);
    const token = await ethers.getContractAt("HansomeAlpacas", tokenAddr);
    const [name, symbol, bal] = await Promise.all([
      token.name(),
      token.symbol(),
      token.balanceOf(deployerAddress),
    ]);
    deployerTokenBal = bal;
    if (symbol === "tHANSOME" || name === "Test HANSOME") {
      tokenAddr = null;
      tokenDetail = `REFUSED tHANSOME at ${raw}`;
    } else {
      tokenDetail = `${name}/${symbol} @ ${tokenAddr} deployerBal=${ethers.formatEther(bal)}`;
    }
  } catch (e) {
    tokenDetail = e instanceof Error ? e.message : String(e);
    tokenAddr = null;
  }
  push({
    id: "token",
    ok: Boolean(tokenAddr),
    severity: tokenAddr ? "pass" : "blocker",
    detail: tokenDetail,
  });

  // dayZero
  let dayZero: number | null = null;
  let dayZeroDetail = "";
  try {
    dayZero = requireMainnetGameDayZero();
    dayZeroDetail = `GAME_DAY_ZERO=${dayZero} (${new Date(dayZero * 1000).toISOString()}) commitEnds=${dayZero + PROD_COMMIT_DURATION_SEC} dayEnds=${dayZero + PROD_DAY_LENGTH_SEC}`;
  } catch (e) {
    dayZeroDetail = e instanceof Error ? e.message : String(e);
  }
  push({
    id: "day_zero",
    ok: dayZero != null,
    severity: dayZero != null ? "pass" : "blocker",
    detail: dayZeroDetail,
  });

  // Randomness provider
  let randomnessProvider: string | null = null;
  let rpDetail = "";
  try {
    randomnessProvider = requireMainnetRandomnessProvider(deployerAddress);
    rpDetail = `RANDOMNESS_PROVIDER=${randomnessProvider}`;
  } catch (e) {
    rpDetail = e instanceof Error ? e.message : String(e);
  }
  push({
    id: "randomness_provider",
    ok: Boolean(randomnessProvider),
    severity: randomnessProvider ? "pass" : "blocker",
    detail: rpDetail,
  });

  // Funding
  const skipFund = process.env.SKIP_TREASURY_FUND?.trim() === "1";
  const fundWhole = process.env.GAME_TREASURY_FUND_ETH?.trim() || null;
  let fundOk = skipFund || Boolean(fundWhole);
  let fundDetail = skipFund
    ? "SKIP_TREASURY_FUND=1 — fund GameTreasury later before settle"
    : fundWhole
      ? `GAME_TREASURY_FUND_ETH=${fundWhole}`
      : "Set GAME_TREASURY_FUND_ETH or SKIP_TREASURY_FUND=1";
  if (!skipFund && fundWhole && tokenAddr) {
    try {
      const need = ethers.parseEther(fundWhole);
      if (deployerTokenBal < need) {
        fundOk = false;
        fundDetail = `Deployer $HANSOME ${ethers.formatEther(deployerTokenBal)} < fund ${fundWhole}`;
      } else {
        fundDetail += ` (deployer has ${ethers.formatEther(deployerTokenBal)})`;
      }
    } catch {
      fundOk = false;
      fundDetail = `Invalid GAME_TREASURY_FUND_ETH=${fundWhole}`;
    }
  }
  push({
    id: "treasury_funding",
    ok: fundOk,
    severity: fundOk ? "pass" : "blocker",
    detail: fundDetail,
  });

  // Ownership plan
  const mainnetOwner = process.env.MAINNET_OWNER?.trim()
    ? ethers.getAddress(process.env.MAINNET_OWNER.trim())
    : null;
  push({
    id: "ownership_plan",
    ok: Boolean(mainnetOwner),
    severity: mainnetOwner ? "pass" : "warn",
    detail: mainnetOwner
      ? `MAINNET_OWNER=${mainnetOwner} (transfer after verify-mainnet-game.ts)`
      : "MAINNET_OWNER unset — plan multisig/timelock before live ownership transfer",
  });

  const relayer = process.env.MAINNET_RELAYER?.trim() || null;
  push({
    id: "relayer_plan",
    ok: true,
    severity: "warn",
    detail: relayer
      ? `MAINNET_RELAYER=${relayer} — gasless reveal batch is onlyOwner on Mainnet`
      : "MAINNET_RELAYER unset — gasless Mainnet design undecided",
  });

  // Gas
  const balEth = await ethers.provider.getBalance(deployerAddress);
  const gasOk = balEth > ethers.parseEther("0.05");
  push({
    id: "deployer_gas",
    ok: gasOk,
    severity: gasOk ? "pass" : "warn",
    detail: `Deployer ETH=${ethers.formatEther(balEth)}`,
  });

  // Live flags must NOT be set during preflight (safety)
  const allowLive = process.env.ALLOW_MAINNET_DEPLOY?.trim() === "1";
  const confirmLive =
    process.env.CONFIRM_MAINNET_DEPLOY?.trim() === "I_UNDERSTAND";
  push({
    id: "live_flags_off",
    ok: !allowLive && !confirmLive,
    severity: !allowLive && !confirmLive ? "pass" : "warn",
    detail:
      allowLive || confirmLive
        ? "ALLOW/CONFIRM set — unset for preflight; set only for approved live deploy"
        : "ALLOW_MAINNET_DEPLOY / CONFIRM_MAINNET_DEPLOY unset (good for preflight)",
  });

  // Existing game JSON would be overwritten — warn
  const existingGame = existsSync(
    join(__dirname, "..", "deployments", "robinhood-game.json"),
  );
  push({
    id: "no_existing_game_json",
    ok: !existingGame,
    severity: existingGame ? "warn" : "pass",
    detail: existingGame
      ? "deployments/robinhood-game.json already exists — live deploy would overwrite"
      : "No robinhood-game.json yet (fresh Game ceremony)",
  });

  const blockers = checks.filter((c) => c.severity === "blocker" && !c.ok);
  const warnings = checks.filter((c) => c.severity === "warn" && !c.ok);

  const plan = {
    mode: "DRY_RUN",
    script: "dry-run-mainnet-game-launch.ts",
    network: ctx.networkName,
    chainId: ctx.chainId,
    rpc: "https://rpc.mainnet.chain.robinhood.com",
    explorer: explorerBase(ctx),
    deployer: deployerAddress,
    generatedAt: new Date().toISOString(),
    addresses: {
      genesisNft: genesisAddr,
      hansomeToken: tokenAddr,
      plannedRandomnessProvider: randomnessProvider,
      plannedOwner: mainnetOwner,
      plannedRelayer: relayer,
      // Deployed at ceremony time:
      hansomeGame: "(deploy-game)",
      gameTreasury: "(deploy-game)",
      emissionController: "(deploy-game)",
      rewardDistributor: "(deploy-game)",
      gameRandomness: "(deploy-game)",
      sinkRegistry: "(deploy-game)",
    },
    timing: {
      dayZero,
      commitDurationSec: timing.commitDurationSec,
      revealDurationSec: timing.revealDurationSec,
      dayLengthSec: timing.dayLengthSec,
      fast: timing.fast,
      gds: {
        commit: PROD_COMMIT_DURATION_SEC,
        reveal: PROD_REVEAL_DURATION_SEC,
        day: PROD_DAY_LENGTH_SEC,
      },
    },
    ownership: {
      initialOwner: deployerAddress,
      transferTo: mainnetOwner,
      transferScript: "scripts/transfer-mainnet-ownership.ts",
      note: "All Ownable suite contracts start as deployer; transfer after verify-mainnet-game.ts",
    },
    funding: {
      skip: skipFund,
      amountWhole: fundWhole,
      token: CANONICAL_MAINNET_HANSOME,
      destination: "GameTreasury (not RewardDistributor)",
      deployerTokenBalance: ethers.formatEther(deployerTokenBal),
    },
    deploymentOrder: [
      "GameTreasury($HANSOME, deployer)",
      "EmissionController()",
      "RewardDistributor(genesis, treasury, deployer)",
      "GameRandomness(deployer)",
      "HansomeGame(genesis, treasury, emission, distributor, randomness, dayZero, 86400, 72000, 14400, deployer)",
      "SinkRegistry($HANSOME, treasury, deployer)",
      "treasury.setGame / setDistributor / setSinkRegistry",
      "distributor.setGame",
      "GameRandomness.setRandomnessProvider(RANDOMNESS_PROVIDER) if != deployer",
      "optional token.transfer → GameTreasury",
      "verify-mainnet-game.ts",
      "transfer-mainnet-ownership.ts",
    ],
    checks,
    blockers,
    warnings,
    readyForLiveDeploy: blockers.length === 0,
    nextCommands: [
      "DRY_RUN=1 npx hardhat run scripts/dry-run-mainnet-game-launch.ts --network mainnet",
      "GAME_FAST_TIMING=0 GAME_TOKEN_ADDRESS=0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875 GENESIS_NFT_ADDRESS=0x… GAME_DAY_ZERO=<unix> RANDOMNESS_PROVIDER=0x… SKIP_TREASURY_FUND=1 DRY_RUN=1 npx hardhat run scripts/deploy-game.ts --network mainnet",
      "# Live only after ceremony approval:",
      "ALLOW_MAINNET_DEPLOY=1 CONFIRM_MAINNET_DEPLOY=I_UNDERSTAND … npx hardhat run scripts/deploy-game.ts --network mainnet",
      "npx hardhat run scripts/verify-mainnet-game.ts --network mainnet",
    ],
  };

  // Fix network check ok flag properly was already done

  const outDir = join(__dirname, "..", "deployments");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "robinhood-mainnet-game-launch.dry-run.json");
  writeFileSync(outPath, `${JSON.stringify(plan, null, 2)}\n`);

  console.log("\n=== MAINNET GAME LAUNCH PREFLIGHT ===");
  console.log(`chainId:     ${ctx.chainId}`);
  console.log(`deployer:    ${deployerAddress}`);
  console.log(`genesis:     ${genesisAddr ?? "(missing)"}`);
  console.log(`token:       ${tokenAddr ?? "(missing)"}`);
  console.log(`dayZero:     ${dayZero ?? "(missing)"}`);
  console.log(`randProvider:${randomnessProvider ?? "(missing)"}`);
  console.log(`owner plan:  ${mainnetOwner ?? "(unset)"}`);
  console.log(`funding:     ${fundDetail}`);
  console.log("\n--- CHECKS ---");
  for (const c of checks) {
    const mark = c.ok ? "PASS" : c.severity.toUpperCase();
    console.log(`[${mark}] ${c.id}: ${c.detail}`);
  }
  console.log("\nWrote", outPath);

  if (blockers.length > 0) {
    console.error(
      `\nBLOCKERS: ${blockers.length}. Fix before live deploy-game.ts.`,
    );
    process.exitCode = 2;
  } else {
    console.log(
      "\nPREFLIGHT OK — no blockers. Review warnings, then DRY_RUN deploy-game, then live only with approval.",
    );
  }

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
