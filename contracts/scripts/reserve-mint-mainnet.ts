/**
 * Mainnet Genesis reserveMint ceremony — mints #001–#010 once via existing
 * reserveMint(address). No ownerMint. No unlimited mint.
 *
 * Also used for RECOVERY when deploy-genesis deployed the NFT but reserveMint failed.
 * Locks sale identity commitment if not already locked.
 *
 * Env:
 *   GENESIS_NFT_ADDRESS   — required (or deployments/robinhood-genesis.json)
 *   RESERVE_MINT_TO       — recipient of #001–#010 (required on live; dry-run may use JSON reservedTo)
 *   DRY_RUN=1             — default if live flags unset; reports already-reserved without error
 *   ALLOW_MAINNET_DEPLOY=1 + CONFIRM_MAINNET_DEPLOY=I_UNDERSTAND — live only
 *
 * Usage:
 *   DRY_RUN=1 RESERVE_MINT_TO=0x… npx hardhat run scripts/reserve-mint-mainnet.ts --network mainnet
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { buildSaleIdentities } from "./lib/genesis-identities";
import {
  assertMainnetDeployAllowed,
  deploymentFileStem,
  explorerBase,
  isDryRun,
  logDeployBanner,
  logLiveMainnetPreflight,
} from "./lib/deploy-network-guard";
import { getDeployerSigner } from "./lib/signer";

type GenesisJson = {
  address?: string;
  reservedTo?: string;
  reservedMinted?: boolean;
};

async function loadGenesisJson(fileStem: string): Promise<GenesisJson | null> {
  const path = join(__dirname, "..", "deployments", `${fileStem}-genesis.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as GenesisJson;
}

async function resolveGenesisAddress(
  fileStem: string,
  json: GenesisJson | null,
): Promise<string> {
  if (process.env.GENESIS_NFT_ADDRESS?.trim()) {
    return ethers.getAddress(process.env.GENESIS_NFT_ADDRESS.trim());
  }
  if (json?.address) return ethers.getAddress(json.address);
  throw new Error(
    "REFUSED: set GENESIS_NFT_ADDRESS or provide deployments/robinhood-genesis.json",
  );
}

function patchGenesisJson(
  fileStem: string,
  patch: Record<string, unknown>,
): void {
  const path = join(__dirname, "..", "deployments", `${fileStem}-genesis.json`);
  if (!existsSync(path)) return;
  const prev = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  writeFileSync(path, `${JSON.stringify({ ...prev, ...patch }, null, 2)}\n`);
  console.log("Updated", path);
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
  assertMainnetDeployAllowed(ctx, "reserve-mint-mainnet.ts");

  const fileStem = deploymentFileStem(ctx);
  const genesisJson = await loadGenesisJson(fileStem);
  const deployer = await getDeployerSigner(ethers.provider);
  const genesis = await resolveGenesisAddress(fileStem, genesisJson);

  const toRaw =
    process.env.RESERVE_MINT_TO?.trim() || genesisJson?.reservedTo?.trim() || "";
  if (!toRaw && !isDryRun()) {
    throw new Error("REFUSED: live reserveMint requires RESERVE_MINT_TO");
  }
  const to = ethers.getAddress(toRaw || deployer.address);

  const nft = await ethers.getContractAt("HansomeGenesisNFT", genesis, deployer);
  const reservedMinted = Boolean(await nft.reservedMinted());
  const commitmentLocked = Boolean(await nft.saleIdentityCommitmentLocked());
  const owner = ethers.getAddress(await nft.owner());
  const totalMinted = await nft.totalMinted();

  logDeployBanner("reserve-mint-mainnet.ts", ctx, {
    GENESIS: genesis,
    RESERVE_MINT_TO: to,
    OWNER: owner,
    RESERVED_MINTED: reservedMinted,
    COMMITMENT_LOCKED: commitmentLocked,
    TOTAL_MINTED: totalMinted.toString(),
    EXPLORER: explorerBase(ctx),
  });

  const plan = {
    mode: isDryRun() ? "DRY_RUN" : "LIVE",
    script: "reserve-mint-mainnet.ts",
    network: ctx.networkName,
    chainId: ctx.chainId,
    genesis,
    reserveMintTo: to,
    owner,
    reservedMinted,
    commitmentLocked,
    totalMinted: totalMinted.toString(),
    alreadyReservedDetected: reservedMinted,
    status: reservedMinted ? "ALREADY_DONE" : "NEEDS_RESERVE_MINT",
    tokenIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    allocationPurpose: {
      "001": "Founder NFT",
      "002-004": "Internal Mainnet gameplay testing",
      "005-010": "Community giveaways, partnerships, collaborations",
    },
    note:
      "Calls existing reserveMint(to) once — mints exactly 10 Special Alpacas. " +
      "No ownerMint. On-chain reservedMinted prevents a second mint.",
    verifyCommand:
      "RESERVE_MINT_TO=<same> npx hardhat run scripts/verify-mainnet-reserved.ts --network mainnet",
    generatedAt: new Date().toISOString(),
  };

  const outDir = join(__dirname, "..", "deployments");
  mkdirSync(outDir, { recursive: true });
  const planPath = join(
    outDir,
    `${fileStem}-reserve-mint.${isDryRun() ? "dry-run." : ""}json`,
  );
  writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  console.log("Wrote", planPath);

  if (reservedMinted) {
    console.log("DETECTED: reservedMinted=true — reserveMint cannot run again.");
    if (isDryRun()) {
      console.log("DRY_RUN complete — existing reserved allocation detected (no txs).");
      return;
    }
    throw new Error(
      "REFUSED: reservedMinted=true — reserveMint already done; cannot mint again.",
    );
  }

  if (owner !== deployer.address) {
    throw new Error(
      `REFUSED: deployer ${deployer.address} is not NFT owner ${owner}`,
    );
  }

  if (isDryRun()) {
    console.log("DRY_RUN complete — would ensure commitment lock + reserveMint(", to, ")");
    console.log("No transactions sent.");
    return;
  }

  logLiveMainnetPreflight("reserve-mint-mainnet.ts", ctx, {
    genesis,
    reserveMintTo: to,
    tokenIds: "1..10",
    commitmentLocked,
  });
  console.log("CHAIN_ID before tx:", ctx.chainId);

  if (!commitmentLocked) {
    const onChainCommitment = await nft.saleIdentityCommitment();
    if (onChainCommitment === ethers.ZeroHash) {
      const identities = buildSaleIdentities();
      const commitment = ethers.keccak256(identities);
      console.log("Setting sale identity commitment (recovery)…");
      await (await nft.setSaleIdentityCommitment(commitment)).wait();
    }
    console.log("Locking sale identity commitment (recovery)…");
    await (await nft.lockSaleIdentityCommitment()).wait();
  }

  console.log("Calling reserveMint(", to, ")");
  const tx = await nft.reserveMint(to);
  const receipt = await tx.wait();
  console.log("reserveMint tx:", receipt?.hash);
  console.log("reservedMinted:", await nft.reservedMinted());
  console.log("totalMinted:", (await nft.totalMinted()).toString());
  console.log("ownerOf(1):", await nft.ownerOf(1n));
  console.log("ownerOf(10):", await nft.ownerOf(10n));

  patchGenesisJson(fileStem, {
    reservedTo: to,
    reservedMinted: true,
    reservedMintTxHash: receipt?.hash,
    reserveMintStatus: "complete",
    saleIdentityCommitmentLocked: true,
    reserveMintError: null,
  });

  console.log(
    "Verify:",
    `RESERVE_MINT_TO=${to} npx hardhat run scripts/verify-mainnet-reserved.ts --network mainnet`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
