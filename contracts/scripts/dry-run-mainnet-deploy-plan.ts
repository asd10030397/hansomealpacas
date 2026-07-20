/**
 * Mainnet deployment plan + dry-run verification (NO transactions).
 *
 * Validates env / network / timing / linking intent before any Mainnet deploy.
 *
 * Usage:
 *   DRY_RUN=1 npx hardhat run scripts/dry-run-mainnet-deploy-plan.ts --network mainnet
 *   (also accepts --network robinhood)
 *
 * Required env for a complete plan:
 *   GAME_TOKEN_ADDRESS          — Mainnet $HANSOME (must not be tHANSOME)
 *   GENESIS_NFT_ADDRESS         — optional if robinhood-genesis.json exists (usually none yet)
 *   VRF_OPERATOR                — required for Genesis VRF path (no mock on Mainnet)
 *   ROYALTY_RECEIVER            — optional
 *   GAME_FAST_TIMING=0          — required (or unset; must not be 1)
 *   GAME_DAY_ZERO               — required before deploy-game (unix seconds; no "now" default)
 *   GAME_TREASURY_FUND_ETH      — whole tokens to fund treasury (plan only)
 *   MAINNET_OWNER               — planned Ownable recipient after deploy (multisig)
 *   MAINNET_RELAYER             — planned hot wallet (gasless owner path risk — see report)
 *   RANDOMNESS_PROVIDER         — required before deploy-game (may equal deployer)
 *
 * Always writes: deployments/robinhood-mainnet-deploy-plan.dry-run.json
 * Never sends transactions.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { resolveGameTiming } from "./lib/game-timing";
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
import { getDeployerSigner } from "./lib/signer";

const CANONICAL_MAINNET_HANSOME =
  "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875";

type Check = {
  id: string;
  ok: boolean;
  severity: "pass" | "warn" | "blocker";
  detail: string;
};

async function main() {
  // Force dry-run semantics even if env forgotten.
  process.env.DRY_RUN = process.env.DRY_RUN?.trim() || "1";

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const ctx = { networkName: network.name, chainId };
  assertKnownNetwork(ctx.networkName);
  assertChainIdMatchesNetwork(ctx);

  if (!isMainnetNetwork(ctx)) {
    throw new Error(
      `REFUSED: dry-run-mainnet-deploy-plan.ts requires --network mainnet (or robinhood), chainId ${ROBINHOOD_MAINNET_CHAIN_ID}. Got ${ctx.networkName}/${ctx.chainId}.`,
    );
  }
  assertExplicitMainnetNetwork(ctx);
  if (!isDryRun()) {
    throw new Error("REFUSED: this script is dry-run only. Set DRY_RUN=1.");
  }

  const deployer = await getDeployerSigner(ethers.provider);
  const deployerAddress = await deployer.address;
  const timing = resolveGameTiming(network.name);

  logDeployBanner("dry-run-mainnet-deploy-plan.ts", ctx, {
    DEPLOYER: deployerAddress,
    EXPLORER: explorerBase(ctx),
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
    detail: `network=${ctx.networkName} chainId=${ctx.chainId} (expect mainnet|robinhood / ${ROBINHOOD_MAINNET_CHAIN_ID})`,
  });

  const fastEnv = process.env.GAME_FAST_TIMING?.trim();
  push({
    id: "timing_not_fast",
    ok: fastEnv !== "1" && timing.fast === false,
    severity: fastEnv === "1" || timing.fast ? "blocker" : "pass",
    detail: `GAME_FAST_TIMING=${fastEnv ?? "(unset)"} → commit=${timing.commitDurationSec}s reveal=${timing.revealDurationSec}s day=${timing.dayLengthSec}s fast=${timing.fast}`,
  });
  push({
    id: "timing_gds",
    ok:
      timing.commitDurationSec === 72_000 &&
      timing.revealDurationSec === 14_400 &&
      timing.dayLengthSec === 86_400,
    severity:
      timing.commitDurationSec === 72_000 &&
      timing.revealDurationSec === 14_400 &&
      timing.dayLengthSec === 86_400
        ? "pass"
        : "blocker",
    detail: "Expected GDS 72000 / 14400 / 86400 on Mainnet",
  });

  const tokenAddr =
    process.env.GAME_TOKEN_ADDRESS?.trim() || CANONICAL_MAINNET_HANSOME;
  let tokenOk = false;
  let tokenDetail = "";
  try {
    const token = await ethers.getContractAt(
      "HansomeAlpacas",
      ethers.getAddress(tokenAddr),
    );
    const [name, symbol, decimals, bal] = await Promise.all([
      token.name(),
      token.symbol(),
      token.decimals(),
      token.balanceOf(deployerAddress),
    ]);
    tokenOk = symbol === "HANSOME" || name.toLowerCase().includes("hansome");
    if (symbol === "tHANSOME" || name === "Test HANSOME") {
      tokenOk = false;
      tokenDetail = `REFUSED token is tHANSOME (${name}/${symbol}) at ${tokenAddr}`;
    } else {
      tokenDetail = `${name}/${symbol} decimals=${decimals} deployerBalance=${ethers.formatEther(bal)} @ ${tokenAddr}`;
    }
  } catch (e) {
    tokenDetail = `Could not read token at ${tokenAddr}: ${e instanceof Error ? e.message : String(e)}`;
  }
  push({
    id: "reward_token",
    ok: tokenOk,
    severity: tokenOk ? "pass" : "blocker",
    detail: tokenDetail,
  });

  const genesisEnv = process.env.GENESIS_NFT_ADDRESS?.trim();
  const genesisPath = join(__dirname, "..", "deployments", "robinhood-genesis.json");
  const genesisFromFile = existsSync(genesisPath)
    ? (JSON.parse(readFileSync(genesisPath, "utf8")) as { address?: string }).address
    : undefined;
  const genesisPlanned = genesisEnv || genesisFromFile || null;
  push({
    id: "genesis_address",
    ok: Boolean(genesisPlanned),
    severity: genesisPlanned ? "pass" : "warn",
    detail: genesisPlanned
      ? `Planned Genesis=${genesisPlanned}`
      : "Genesis not deployed yet — run deploy-genesis Mainnet ceremony first (no mock)",
  });

  const useMock = process.env.USE_REVEAL_MOCK === "1";
  const vrfOperator = process.env.VRF_OPERATOR?.trim() || null;
  push({
    id: "genesis_no_mock",
    ok: !useMock,
    severity: useMock ? "blocker" : "pass",
    detail: useMock
      ? "USE_REVEAL_MOCK=1 is forbidden on Mainnet"
      : "USE_REVEAL_MOCK unset (good)",
  });
  push({
    id: "vrf_operator",
    ok: Boolean(vrfOperator),
    severity: vrfOperator ? "pass" : "blocker",
    detail: vrfOperator
      ? `VRF_OPERATOR=${vrfOperator}`
      : "Set VRF_OPERATOR for VRFRevealAdapter (Genesis NFT reveal randomness)",
  });

  const owner = process.env.MAINNET_OWNER?.trim() || null;
  const relayer = process.env.MAINNET_RELAYER?.trim() || null;
  const randomnessProvider = process.env.RANDOMNESS_PROVIDER?.trim() || null;
  push({
    id: "mainnet_owner",
    ok: Boolean(owner),
    severity: owner ? "pass" : "warn",
    detail: owner
      ? `MAINNET_OWNER=${owner}`
      : "MAINNET_OWNER unset — plan multisig/timelock before ownership transfer",
  });
  push({
    id: "relayer_role",
    ok: Boolean(relayer),
    severity: "warn",
    detail: relayer
      ? `MAINNET_RELAYER=${relayer} — NOTE: testnetRelayerRevealBatch is onlyOwner; gasless Mainnet needs owner=relayer OR a new operator path (Solidity change)`
      : "MAINNET_RELAYER unset — gasless Mainnet design undecided (onlyOwner reveal batch)",
  });
  push({
    id: "game_randomness_provider",
    ok: Boolean(randomnessProvider),
    severity: randomnessProvider ? "pass" : "warn",
    detail: randomnessProvider
      ? `RANDOMNESS_PROVIDER=${randomnessProvider}`
      : "RANDOMNESS_PROVIDER unset — after deploy, call GameRandomness.setRandomnessProvider",
  });

  const fundWhole = process.env.GAME_TREASURY_FUND_ETH?.trim() || null;
  push({
    id: "treasury_fund_plan",
    ok: true,
    severity: fundWhole ? "pass" : "warn",
    detail: fundWhole
      ? `GAME_TREASURY_FUND_ETH=${fundWhole} (transfer to GameTreasury after link)`
      : "GAME_TREASURY_FUND_ETH unset — decide Mainnet emission funding amount before live settle",
  });

  const balEth = await ethers.provider.getBalance(deployerAddress);
  push({
    id: "deployer_gas",
    ok: balEth > ethers.parseEther("0.05"),
    severity: balEth > ethers.parseEther("0.05") ? "pass" : "warn",
    detail: `Deployer ETH=${ethers.formatEther(balEth)} (need enough for suite deploy gas)`,
  });

  // Planned constructor / link order (documentation in JSON).
  const plan = {
    mode: "DRY_RUN",
    network: ctx.networkName,
    chainId: ctx.chainId,
    explorer: explorerBase(ctx),
    deployer: deployerAddress,
    generatedAt: new Date().toISOString(),
    timing: {
      commitDurationSec: timing.commitDurationSec,
      revealDurationSec: timing.revealDurationSec,
      dayLengthSec: timing.dayLengthSec,
      fast: timing.fast,
      dayZeroEnv: process.env.GAME_DAY_ZERO?.trim() || null,
    },
    addresses: {
      hansomeToken: ethers.getAddress(tokenAddr),
      genesisNft: genesisPlanned,
      vrfOperator,
      plannedOwner: owner,
      plannedRelayer: relayer,
      plannedRandomnessProvider: randomnessProvider,
      royaltyReceiver: process.env.ROYALTY_RECEIVER?.trim() || deployerAddress,
    },
    deploymentOrder: [
      "1) Genesis NFT + VRFRevealAdapter (deploy-genesis, BOOTSTRAP_SALE=0, RESERVE_MINT_TO=founderWallet)",
      "2) Lock sale identity commitment + reserveMint(founderWallet) → #001–#010 (automatic in deploy-genesis Mainnet path)",
      "3) verify-mainnet-reserved.ts — confirm ownerOf(#001–#010)",
      "4) Game suite via deploy-game: GameTreasury, Emission, RewardDistributor, GameRandomness, HansomeGame, SinkRegistry",
      "5) Link: treasury.setGame / setDistributor / setSinkRegistry; distributor.setGame",
      "6) Fund GameTreasury with $HANSOME (not tHANSOME)",
      "7) Ownership transfers to MAINNET_OWNER (multisig)",
      "8) Frontend/Vercel env cutover ONLY after deployments/robinhood-*.json",
    ],
    reservedAllocationPurpose: {
      "001": "Founder NFT",
      "002-004": "Internal Mainnet gameplay testing",
      "005-010": "Community giveaways, partnerships, collaborations",
    },
    constructorPlans: {
      VRFRevealAdapter: ["initialOwner=deployer", "vrfOperator=VRF_OPERATOR"],
      HansomeGenesisNFT: [
        "initialOwner=deployer",
        "royaltyReceiver",
        "randomnessProvider=VRFRevealAdapter",
        "placeholderURI",
        "adminTimelockSeconds=0 (24h) recommended on Mainnet",
      ],
      GameTreasury: ["token=$HANSOME", "initialOwner=deployer"],
      EmissionController: ["(no token args)"],
      RewardDistributor: ["genesis", "treasury", "initialOwner=deployer"],
      GameRandomness: ["initialOwner=deployer (provider defaults to owner)"],
      HansomeGame: [
        "genesis",
        "treasury",
        "emission",
        "distributor",
        "randomness",
        "dayZero",
        "dayLengthSec=86400",
        "commitDurationSec=72000",
        "revealDurationSec=14400",
        "initialOwner=deployer",
      ],
      SinkRegistry: ["token=$HANSOME", "treasury", "initialOwner=deployer"],
    },
    checks,
    blockers: checks.filter((c) => c.severity === "blocker" && !c.ok),
    warnings: checks.filter((c) => c.severity === "warn" && !c.ok),
    nextCommands: [
      "DRY_RUN=1 npx hardhat run scripts/dry-run-mainnet-deploy-plan.ts --network mainnet",
      "DRY_RUN=1 VRF_OPERATOR=0x… BOOTSTRAP_SALE=0 npx hardhat run scripts/deploy-genesis.ts --network mainnet",
      "GAME_FAST_TIMING=0 GAME_TOKEN_ADDRESS=0x2C38… GENESIS_NFT_ADDRESS=0x… GAME_DAY_ZERO=<unix> RANDOMNESS_PROVIDER=0x… SKIP_TREASURY_FUND=1 DRY_RUN=1 npx hardhat run scripts/dry-run-mainnet-game-launch.ts --network mainnet",
      "… same env … DRY_RUN=1 npx hardhat run scripts/deploy-game.ts --network mainnet",
      "npx hardhat run scripts/verify-mainnet-game.ts --network mainnet",
      "DRY_RUN=1 MAINNET_OWNER=0x… npx hardhat run scripts/transfer-mainnet-ownership.ts --network mainnet",
      "# Live (ONLY after dry-run clean + ceremony approval):",
      "ALLOW_MAINNET_DEPLOY=1 CONFIRM_MAINNET_DEPLOY=I_UNDERSTAND … --network mainnet",
    ],
  };

  const outDir = join(__dirname, "..", "deployments");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "robinhood-mainnet-deploy-plan.dry-run.json");
  writeFileSync(outPath, `${JSON.stringify(plan, null, 2)}\n`);

  console.log("\n--- CHECK RESULTS ---");
  for (const c of checks) {
    const mark = c.ok ? "PASS" : c.severity.toUpperCase();
    console.log(`[${mark}] ${c.id}: ${c.detail}`);
  }
  console.log("\nWrote", outPath);

  if (plan.blockers.length > 0) {
    console.error(
      `\nDRY-RUN BLOCKERS: ${plan.blockers.length}. Fix env/plan before any Mainnet deploy.`,
    );
    process.exitCode = 2;
  } else {
    console.log("\nDRY-RUN: no blockers. Warnings may still require manual decisions.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
