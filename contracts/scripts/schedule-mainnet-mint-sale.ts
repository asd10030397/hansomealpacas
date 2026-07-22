/**
 * Schedule / execute Mainnet Genesis mint price, publicStart, and Merkle root.
 * Uses existing timelocked admin ops (no Solidity changes).
 *
 * Env (all required for live; dry-run validates presence):
 *   GENESIS_NFT_ADDRESS
 *   GENESIS_MINT_PRICE_ETH     — e.g. 0.05 (explicit; no silent default on Mainnet)
 *   GENESIS_PUBLIC_START       — unix seconds
 *   GENESIS_MERKLE_ROOT        — or load from robinhood-genesis-whitelist.mainnet.json
 *   SKIP_MERKLE_ROOT=1         — schedule price + publicStart only (no merkle)
 *   DRY_RUN=1                  — default if live flags unset
 *   EXECUTE_AFTER_WAIT=1       — live only: wait ADMIN_TIMELOCK then execute
 *   ALLOW_MAINNET_DEPLOY=1 + CONFIRM_MAINNET_DEPLOY=I_UNDERSTAND
 *   LIVE_MAINNET_SEND=1        — required for live schedule txs
 *
 * Usage:
 *   DRY_RUN=1 GENESIS_MINT_PRICE_ETH=0.05 GENESIS_PUBLIC_START=… \
 *     npx hardhat run scripts/schedule-mainnet-mint-sale.ts --network mainnet
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import {
  assertMainnetDeployAllowed,
  deploymentFileStem,
  explorerBase,
  isDryRun,
  logDeployBanner,
  logLiveMainnetPreflight,
} from "./lib/deploy-network-guard";
import { getDeployerSigner } from "./lib/signer";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function resolveGenesisAddress(fileStem: string): Promise<string> {
  if (process.env.GENESIS_NFT_ADDRESS?.trim()) {
    return ethers.getAddress(process.env.GENESIS_NFT_ADDRESS.trim());
  }
  const path = join(__dirname, "..", "deployments", `${fileStem}-genesis.json`);
  if (!existsSync(path)) {
    throw new Error(
      "REFUSED: set GENESIS_NFT_ADDRESS or deployments/robinhood-genesis.json",
    );
  }
  const rec = JSON.parse(readFileSync(path, "utf8")) as { address?: string };
  if (!rec.address) throw new Error(`Missing address in ${path}`);
  return ethers.getAddress(rec.address);
}

function resolveMerkleRoot(): string {
  if (process.env.GENESIS_MERKLE_ROOT?.trim()) {
    return process.env.GENESIS_MERKLE_ROOT.trim();
  }
  const wlPath = join(
    __dirname,
    "..",
    "deployments",
    "robinhood-genesis-whitelist.mainnet.json",
  );
  if (!existsSync(wlPath)) {
    throw new Error(
      "REFUSED: set GENESIS_MERKLE_ROOT or generate deployments/robinhood-genesis-whitelist.mainnet.json",
    );
  }
  const wl = JSON.parse(readFileSync(wlPath, "utf8")) as { merkleRoot?: string };
  if (!wl.merkleRoot) throw new Error(`Missing merkleRoot in ${wlPath}`);
  return wl.merkleRoot;
}

async function waitTimelock(
  nft: { ADMIN_TIMELOCK: () => Promise<bigint> },
  label: string,
): Promise<void> {
  const delay = Number(await nft.ADMIN_TIMELOCK());
  const latest = await ethers.provider.getBlock("latest");
  const eta = (latest?.timestamp ?? 0) + delay + 2;
  for (;;) {
    const b = await ethers.provider.getBlock("latest");
    const now = b?.timestamp ?? 0;
    if (now >= eta) return;
    console.log(`  waiting ${eta - now}s for ${label} (timelock=${delay}s)`);
    await sleep(Math.min(15_000, Math.max(2_000, (eta - now) * 1000)));
  }
}

async function main() {
  if (
    process.env.ALLOW_MAINNET_DEPLOY?.trim() !== "1" ||
    process.env.CONFIRM_MAINNET_DEPLOY?.trim() !== "I_UNDERSTAND"
  ) {
    process.env.DRY_RUN = process.env.DRY_RUN?.trim() || "1";
  }

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const ctx = { networkName: network.name, chainId };
  assertMainnetDeployAllowed(ctx, "schedule-mainnet-mint-sale.ts");

  const fileStem = deploymentFileStem(ctx);
  const deployer = await getDeployerSigner(ethers.provider);
  const genesis = await resolveGenesisAddress(fileStem);

  const priceEth = process.env.GENESIS_MINT_PRICE_ETH?.trim();
  if (!priceEth) {
    throw new Error(
      "REFUSED: Mainnet requires explicit GENESIS_MINT_PRICE_ETH (no silent default).",
    );
  }
  const mintPriceWei = ethers.parseEther(priceEth);

  const publicStartRaw = process.env.GENESIS_PUBLIC_START?.trim();
  if (!publicStartRaw) {
    throw new Error("REFUSED: set GENESIS_PUBLIC_START (unix seconds).");
  }
  const publicStart = Number(publicStartRaw);
  if (!Number.isFinite(publicStart) || publicStart <= 0) {
    throw new Error("REFUSED: invalid GENESIS_PUBLIC_START");
  }
  const whitelistStart = publicStart > 3600 ? publicStart - 3600 : 0;
  const skipMerkle =
    process.env.SKIP_MERKLE_ROOT?.trim() === "1" ||
    process.env.SKIP_MERKLE_ROOT?.trim()?.toUpperCase() === "YES";
  const merkleRoot = skipMerkle ? null : resolveMerkleRoot();

  const nft = await ethers.getContractAt("HansomeGenesisNFT", genesis, deployer);
  const owner = ethers.getAddress(await nft.owner());
  const timelock = Number(await nft.ADMIN_TIMELOCK());
  const reservedMinted = Boolean(await nft.reservedMinted());
  const commitmentLocked = Boolean(await nft.saleIdentityCommitmentLocked());

  logDeployBanner("schedule-mainnet-mint-sale.ts", ctx, {
    GENESIS: genesis,
    PRICE_ETH: priceEth,
    PUBLIC_START: publicStart,
    WHITELIST_START: whitelistStart,
    MERKLE_ROOT: skipMerkle ? "(SKIPPED)" : merkleRoot,
    ADMIN_TIMELOCK_SEC: timelock,
    RESERVED_MINTED: reservedMinted,
    COMMITMENT_LOCKED: commitmentLocked,
    EXPLORER: explorerBase(ctx),
  });

  const plan = {
    mode: isDryRun() ? "DRY_RUN" : "LIVE",
    script: "schedule-mainnet-mint-sale.ts",
    network: ctx.networkName,
    chainId: ctx.chainId,
    genesis,
    owner,
    mintPriceEth: priceEth,
    mintPriceWei: mintPriceWei.toString(),
    publicStart,
    whitelistStart,
    merkleRoot,
    skipMerkleRoot: skipMerkle,
    adminTimelockSeconds: timelock,
    reservedMinted,
    commitmentLocked,
    steps: [
      "scheduleMintPrice",
      ...(skipMerkle ? [] : ["scheduleWhitelistMerkleRoot"]),
      "schedulePublicStart",
      process.env.EXECUTE_AFTER_WAIT === "1"
        ? "wait timelock + execute*"
        : "execute* in a later run after timelock (or set EXECUTE_AFTER_WAIT=1)",
    ],
    generatedAt: new Date().toISOString(),
  };

  const outDir = join(__dirname, "..", "deployments");
  mkdirSync(outDir, { recursive: true });
  const planPath = join(
    outDir,
    `${fileStem}-mint-sale-schedule.${isDryRun() ? "dry-run." : ""}json`,
  );
  writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  console.log("Wrote", planPath);

  if (owner !== deployer.address) {
    throw new Error(
      `REFUSED: deployer ${deployer.address} is not NFT owner ${owner}`,
    );
  }
  if (!reservedMinted) {
    console.warn(
      "WARNING: reservedMinted=false — run reserve-mint-mainnet.ts before opening sale.",
    );
  }
  if (!commitmentLocked) {
    console.warn(
      "WARNING: saleIdentityCommitment not locked — lock before WL/public mint.",
    );
  }

  if (isDryRun()) {
    console.log("DRY_RUN complete — would schedule:");
    console.log("  mintPriceWei:", mintPriceWei.toString());
    console.log(
      "  merkleRoot:",
      skipMerkle ? "(SKIPPED — SKIP_MERKLE_ROOT=1)" : merkleRoot,
    );
    console.log("  publicStart:", publicStart, "→ whitelistStart:", whitelistStart);
    console.log("No transactions sent.");
    return;
  }

  logLiveMainnetPreflight("schedule-mainnet-mint-sale.ts", ctx, {
    genesis,
    mintPriceEth: priceEth,
    publicStart,
    whitelistStart,
    merkleRoot: skipMerkle ? "(SKIPPED)" : merkleRoot,
    executeAfterWait: process.env.EXECUTE_AFTER_WAIT === "1",
  });

  console.log("CHAIN_ID before tx:", ctx.chainId);
  const priceTx = await (await nft.scheduleMintPrice(mintPriceWei)).wait();
  console.log("scheduled mintPrice tx:", priceTx?.hash);

  let merkleTxHash: string | null = null;
  if (!skipMerkle) {
    if (!merkleRoot) {
      throw new Error("REFUSED: merkleRoot missing while SKIP_MERKLE_ROOT unset");
    }
    const merkleTx = await (
      await nft.scheduleWhitelistMerkleRoot(merkleRoot)
    ).wait();
    merkleTxHash = merkleTx?.hash ?? null;
    console.log("scheduled merkleRoot tx:", merkleTxHash);
  } else {
    console.log("SKIP_MERKLE_ROOT=1 — did not schedule whitelistMerkleRoot");
  }

  const publicTx = await (await nft.schedulePublicStart(publicStart)).wait();
  console.log("scheduled publicStart tx:", publicTx?.hash);

  const liveResult = {
    ...plan,
    mode: "LIVE_SCHEDULE_ONLY",
    txs: {
      scheduleMintPrice: priceTx?.hash ?? null,
      scheduleWhitelistMerkleRoot: merkleTxHash,
      schedulePublicStart: publicTx?.hash ?? null,
    },
    scheduledAt: new Date().toISOString(),
  };
  const livePath = join(outDir, `${fileStem}-mint-sale-schedule.json`);
  writeFileSync(livePath, `${JSON.stringify(liveResult, null, 2)}\n`);
  console.log("Wrote", livePath);

  if (process.env.EXECUTE_AFTER_WAIT === "1") {
    await waitTimelock(nft, "admin ops");
    await (await nft.executeMintPrice(mintPriceWei)).wait();
    console.log("executed mintPrice →", (await nft.mintPrice()).toString());
    if (!skipMerkle && merkleRoot) {
      await (await nft.executeWhitelistMerkleRoot(merkleRoot)).wait();
      console.log("executed merkleRoot →", await nft.whitelistMerkleRoot());
    }
    await (await nft.executePublicStart(publicStart)).wait();
    console.log("executed publicStart →", (await nft.publicStart()).toString());
    console.log("whitelistStart:", (await nft.whitelistStart()).toString());
  } else {
    console.log(
      "Scheduled only. After ADMIN_TIMELOCK, call executeMintPrice / " +
        (skipMerkle ? "" : "executeWhitelistMerkleRoot / ") +
        "executePublicStart manually (do not set EXECUTE_AFTER_WAIT unless approved).",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
