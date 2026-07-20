/**
 * Read-only verification that Genesis reserved #001–#010 are minted
 * to the expected founder wallet. Never sends transactions.
 *
 * Env:
 *   GENESIS_NFT_ADDRESS — or deployments/robinhood-genesis.json
 *   RESERVE_MINT_TO     — expected owner of #001–#010 (required)
 *
 * Usage:
 *   RESERVE_MINT_TO=0x… npx hardhat run scripts/verify-mainnet-reserved.ts --network mainnet
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import {
  assertExplicitMainnetNetwork,
  assertKnownNetwork,
  assertChainIdMatchesNetwork,
  deploymentFileStem,
  explorerBase,
  logDeployBanner,
} from "./lib/deploy-network-guard";

const TOKEN_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const ALLOCATION = {
  1: "Founder NFT",
  2: "Internal Mainnet gameplay testing",
  3: "Internal Mainnet gameplay testing",
  4: "Internal Mainnet gameplay testing",
  5: "Community giveaways / partnerships / collaborations",
  6: "Community giveaways / partnerships / collaborations",
  7: "Community giveaways / partnerships / collaborations",
  8: "Community giveaways / partnerships / collaborations",
  9: "Community giveaways / partnerships / collaborations",
  10: "Community giveaways / partnerships / collaborations",
} as const;

type GenesisJson = {
  address?: string;
  reservedTo?: string;
  reservedMinted?: boolean;
  reserveMintStatus?: string;
};

function loadGenesisJson(fileStem: string): GenesisJson | null {
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

async function main() {
  // Force no-write semantics for chain txs (still writes verify JSON report).
  process.env.DRY_RUN = "1";

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const ctx = { networkName: network.name, chainId };
  assertKnownNetwork(ctx.networkName);
  assertChainIdMatchesNetwork(ctx);
  assertExplicitMainnetNetwork(ctx);

  const fileStem = deploymentFileStem(ctx);
  const genesisJson = loadGenesisJson(fileStem);
  const expectedRaw =
    process.env.RESERVE_MINT_TO?.trim() || genesisJson?.reservedTo?.trim() || "";
  if (!expectedRaw) {
    throw new Error(
      "REFUSED: set RESERVE_MINT_TO or ensure robinhood-genesis.json has reservedTo.",
    );
  }
  const expectedOwner = ethers.getAddress(expectedRaw);
  const genesis = await resolveGenesisAddress(fileStem, genesisJson);

  const nft = await ethers.getContractAt("HansomeGenesisNFT", genesis);
  const reservedMinted = Boolean(await nft.reservedMinted());
  const totalMinted = await nft.totalMinted();
  const commitmentLocked = Boolean(await nft.saleIdentityCommitmentLocked());

  logDeployBanner("verify-mainnet-reserved.ts", ctx, {
    GENESIS: genesis,
    EXPECTED_OWNER: expectedOwner,
    RESERVED_MINTED: reservedMinted,
    TOTAL_MINTED: totalMinted.toString(),
    COMMITMENT_LOCKED: commitmentLocked,
    EXPLORER: explorerBase(ctx),
    NOTE: "READ-ONLY — no transactions",
  });

  const rows: Array<{
    tokenId: number;
    purpose: string;
    owner: string | null;
    ok: boolean;
    error?: string;
  }> = [];

  let allOk = reservedMinted && commitmentLocked;
  if (!reservedMinted) {
    console.error("FAIL: reservedMinted=false — run reserveMint first");
    allOk = false;
  }
  if (!commitmentLocked) {
    console.error("FAIL: saleIdentityCommitment not locked");
    allOk = false;
  }

  for (const tokenId of TOKEN_IDS) {
    const purpose = ALLOCATION[tokenId];
    try {
      const owner = ethers.getAddress(await nft.ownerOf(BigInt(tokenId)));
      const ok = owner === expectedOwner;
      if (!ok) allOk = false;
      rows.push({ tokenId, purpose, owner, ok });
      console.log(
        `${ok ? "PASS" : "FAIL"} #${String(tokenId).padStart(3, "0")} owner=${owner} (${purpose})`,
      );
    } catch (e) {
      allOk = false;
      const msg = e instanceof Error ? e.message : String(e);
      rows.push({ tokenId, purpose, owner: null, ok: false, error: msg });
      console.log(`FAIL #${String(tokenId).padStart(3, "0")} not minted / unreadable (${purpose})`);
    }
  }

  const report = {
    mode: "VERIFY_READONLY",
    network: ctx.networkName,
    chainId: ctx.chainId,
    genesis,
    expectedOwner,
    jsonReservedTo: genesisJson?.reservedTo ?? null,
    jsonReservedMinted: genesisJson?.reservedMinted ?? null,
    jsonReserveMintStatus: genesisJson?.reserveMintStatus ?? null,
    reservedMinted,
    commitmentLocked,
    totalMinted: totalMinted.toString(),
    allocation: ALLOCATION,
    tokens: rows,
    ok: allOk,
    nextStep: allOk
      ? "Continue Game suite: deploy-game.ts with GENESIS_NFT_ADDRESS=" + genesis
      : "Recovery: ALLOW_MAINNET_DEPLOY=1 CONFIRM_MAINNET_DEPLOY=I_UNDERSTAND " +
        "npx hardhat run scripts/reserve-mint-mainnet.ts --network mainnet " +
        "(see docs/MAINNET_GENESIS_MINT_OPS.md § Recovery)",
    generatedAt: new Date().toISOString(),
  };

  const outDir = join(__dirname, "..", "deployments");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${fileStem}-reserved-verify.json`);
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log("Wrote", outPath);

  if (!allOk) {
    console.error("\nVERIFICATION FAILED — do not continue Game deploy.");
    process.exitCode = 2;
  } else {
    console.log("\nVERIFICATION OK — #001–#010 owned by", expectedOwner);
    console.log("Continue with deploy-game.ts");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
