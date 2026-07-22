/**
 * Plan / execute Ownable.transferOwnership for the Mainnet game suite.
 *
 * Default: DRY_RUN (no txs). Live requires ALLOW + CONFIRM.
 *
 * Env:
 *   MAINNET_OWNER              — required multisig/timelock recipient
 *   DRY_RUN=1                  — default recommended; plan only
 *   ALLOW_MAINNET_DEPLOY=1
 *   CONFIRM_MAINNET_DEPLOY=YES|I_UNDERSTAND
 *   LIVE_MAINNET_SEND=1
 *
 * Usage:
 *   DRY_RUN=1 npx hardhat run scripts/transfer-mainnet-ownership.ts --network mainnet
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import {
  assertMainnetDeployAllowed,
  deploymentFileStem,
  explorerBase,
  isDryRun,
  isMainnetLiveConfirmSet,
  logDeployBanner,
  logLiveMainnetPreflight,
} from "./lib/deploy-network-guard";
import { getDeployerSigner } from "./lib/signer";
import { requireMainnetOwner } from "./lib/mainnet-game-guards";

const OWNABLE_ABI = [
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner)",
] as const;

async function main() {
  // Force dry-run unless full live gate present — safer default for ownership.
  const liveSend = process.env.LIVE_MAINNET_SEND?.trim();
  const liveGate =
    process.env.ALLOW_MAINNET_DEPLOY?.trim() === "1" &&
    isMainnetLiveConfirmSet() &&
    (liveSend === "1" || liveSend?.toUpperCase() === "YES");
  if (!liveGate) {
    process.env.DRY_RUN = process.env.DRY_RUN?.trim() || "1";
  }

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const ctx = { networkName: network.name, chainId };
  assertMainnetDeployAllowed(ctx, "transfer-mainnet-ownership.ts");

  const fileStem = deploymentFileStem(ctx);
  const deployer = await getDeployerSigner(ethers.provider);
  const newOwner = requireMainnetOwner(deployer.address);

  const genesisPath = join(__dirname, "..", "deployments", `${fileStem}-genesis.json`);
  const gamePath = join(__dirname, "..", "deployments", `${fileStem}-game.json`);
  if (!existsSync(genesisPath) || !existsSync(gamePath)) {
    throw new Error(
      `REFUSED: need ${fileStem}-genesis.json and ${fileStem}-game.json before ownership transfer.`,
    );
  }

  const genesis = JSON.parse(readFileSync(genesisPath, "utf8")) as {
    address: string;
    randomnessProvider?: string;
  };
  const game = JSON.parse(readFileSync(gamePath, "utf8")) as {
    address: string;
    treasury: string;
    emission: string;
    distributor: string;
    randomness: string;
    sinks: string;
  };

  const targets: Array<{ role: string; address: string }> = [
    { role: "HansomeGenesisNFT", address: genesis.address },
    { role: "VRFRevealAdapter", address: genesis.randomnessProvider || "" },
    { role: "HansomeGame", address: game.address },
    { role: "GameTreasury", address: game.treasury },
    { role: "EmissionController", address: game.emission },
    { role: "RewardDistributor", address: game.distributor },
    { role: "GameRandomness", address: game.randomness },
    { role: "SinkRegistry", address: game.sinks },
  ].filter((t) => Boolean(t.address));

  logDeployBanner("transfer-mainnet-ownership.ts", ctx, {
    DEPLOYER: deployer.address,
    MAINNET_OWNER: newOwner,
    EXPLORER: explorerBase(ctx),
  });

  const planRows: Array<{
    role: string;
    address: string;
    currentOwner: string;
    action: string;
  }> = [];

  for (const t of targets) {
    const c = new ethers.Contract(t.address, OWNABLE_ABI, deployer);
    const currentOwner = ethers.getAddress(await c.owner());
    const action =
      currentOwner === newOwner
        ? "SKIP (already owner)"
        : currentOwner === deployer.address
          ? "transferOwnership"
          : "BLOCKED (deployer is not owner)";
    planRows.push({
      role: t.role,
      address: t.address,
      currentOwner,
      action,
    });
    console.log(
      `${t.role}: ${t.address} owner=${currentOwner} → ${action}`,
    );
  }

  const outDir = join(__dirname, "..", "deployments");
  mkdirSync(outDir, { recursive: true });
  const planPath = join(
    outDir,
    `${fileStem}-ownership-transfer.${isDryRun() ? "dry-run." : ""}json`,
  );
  const plan = {
    mode: isDryRun() ? "DRY_RUN" : "LIVE",
    network: ctx.networkName,
    chainId: ctx.chainId,
    deployer: deployer.address,
    newOwner,
    targets: planRows,
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  console.log("Wrote", planPath);

  if (isDryRun()) {
    console.log("DRY_RUN complete — no ownership transfers sent.");
    return;
  }

  const blocked = planRows.filter((r) => r.action.startsWith("BLOCKED"));
  if (blocked.length > 0) {
    throw new Error(
      `REFUSED: deployer cannot transfer ${blocked.map((b) => b.role).join(", ")}.`,
    );
  }

  logLiveMainnetPreflight("transfer-mainnet-ownership.ts", ctx, {
    newOwner,
    transfers: planRows.filter((r) => r.action === "transferOwnership").length,
  });

  console.log("CHAIN_ID before tx:", ctx.chainId);
  for (const row of planRows) {
    if (row.action !== "transferOwnership") continue;
    const c = new ethers.Contract(row.address, OWNABLE_ABI, deployer);
    console.log(`transferOwnership ${row.role} → ${newOwner}`);
    await (await c.transferOwnership(newOwner)).wait();
  }
  console.log("Ownership transfer complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
