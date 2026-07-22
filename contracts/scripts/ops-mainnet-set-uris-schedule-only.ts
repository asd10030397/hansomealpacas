/**
 * Mainnet-only: setBaseURI + schedulePlaceholderURI (NO execute).
 *
 * Requires: ALLOW_MAINNET_DEPLOY=1 CONFIRM_MAINNET_DEPLOY=I_UNDERSTAND LIVE_MAINNET_SEND=1
 *
 *   npx hardhat run scripts/ops-mainnet-set-uris-schedule-only.ts --network mainnet
 */
import { ethers, network } from "hardhat";
import { getDeployerSigner } from "./lib/signer";
import {
  assertMainnetDeployAllowed,
  isDryRun,
  logDeployBanner,
} from "./lib/deploy-network-guard";

const GENESIS = "0x6eBb78FDB40CF6f6b8B33a235eF321AD15107cb0";
const EXPECTED_OWNER = "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A";
const BASE_URI =
  "ipfs://bafybeihs7d6nzeq2s6woads3bsbpwa5g4fgspz7fmtxr4wd6xh2idd224e/";
const PLACEHOLDER_URI =
  "ipfs://bafybeiaq6n2kpjqsr5tb22gmxek6w3u2ot2ys7fkxzkxtzhzbfcyhnc26u/placeholder.json";

async function main() {
  if (
    process.env.ALLOW_MAINNET_DEPLOY?.trim() !== "1" ||
    process.env.CONFIRM_MAINNET_DEPLOY?.trim() !== "I_UNDERSTAND"
  ) {
    process.env.DRY_RUN = "1";
  }
  if (process.env.LIVE_MAINNET_SEND?.trim() !== "1") {
    process.env.DRY_RUN = "1";
  }

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const ctx = { networkName: network.name, chainId };
  assertMainnetDeployAllowed(ctx, "ops-mainnet-set-uris-schedule-only.ts");
  logDeployBanner("ops-mainnet-set-uris-schedule-only.ts", ctx);

  if (chainId !== 4663) {
    throw new Error(`REFUSED: chainId ${chainId} !== 4663`);
  }

  const signer = await getDeployerSigner(ethers.provider);
  const signerAddr = await signer.getAddress();
  if (signerAddr.toLowerCase() !== EXPECTED_OWNER.toLowerCase()) {
    throw new Error(
      `REFUSED: signer ${signerAddr} !== expected owner ${EXPECTED_OWNER}`,
    );
  }

  const nft = await ethers.getContractAt("HansomeGenesisNFT", GENESIS, signer);
  const owner = await nft.owner();
  if (owner.toLowerCase() !== EXPECTED_OWNER.toLowerCase()) {
    throw new Error(`REFUSED: on-chain owner ${owner} !== ${EXPECTED_OWNER}`);
  }

  if (await nft.metadataFrozen()) throw new Error("REFUSED: metadataFrozen");
  if (await nft.revealRequested()) throw new Error("REFUSED: revealRequested");
  if (await nft.collectionRevealed()) {
    throw new Error("REFUSED: collectionRevealed");
  }

  // Exact string checks (no trim/normalize beyond equality)
  if (BASE_URI !== process.env.BASE_URI?.trim() && process.env.BASE_URI?.trim()) {
    throw new Error("REFUSED: BASE_URI env mismatch with locked constant");
  }
  if (
    PLACEHOLDER_URI !== process.env.PLACEHOLDER_URI?.trim() &&
    process.env.PLACEHOLDER_URI?.trim()
  ) {
    throw new Error("REFUSED: PLACEHOLDER_URI env mismatch with locked constant");
  }
  if (!BASE_URI.endsWith("/")) throw new Error("REFUSED: baseURI must end with /");
  if (BASE_URI !== "ipfs://bafybeihs7d6nzeq2s6woads3bsbpwa5g4fgspz7fmtxr4wd6xh2idd224e/") {
    throw new Error("REFUSED: baseURI string mismatch");
  }
  if (
    PLACEHOLDER_URI !==
    "ipfs://bafybeiaq6n2kpjqsr5tb22gmxek6w3u2ot2ys7fkxzkxtzhzbfcyhnc26u/placeholder.json"
  ) {
    throw new Error("REFUSED: placeholderURI string mismatch");
  }

  const OP_PLACEHOLDER = ethers.id("PLACEHOLDER");
  const opId = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32"],
      [OP_PLACEHOLDER, ethers.keccak256(ethers.toUtf8Bytes(PLACEHOLDER_URI))],
    ),
  );

  console.log(
    JSON.stringify(
      {
        chainId,
        genesis: GENESIS,
        owner: signerAddr,
        BASE_URI,
        PLACEHOLDER_URI,
        dryRun: isDryRun(),
        plannedOpId: opId,
      },
      null,
      2,
    ),
  );

  if (isDryRun()) {
    console.log("DRY_RUN — no txs sent");
    return;
  }

  console.log("Sending setBaseURI…");
  const tx1 = await nft.setBaseURI(BASE_URI);
  console.log("setBaseURI hash", tx1.hash);
  const rc1 = await tx1.wait();
  if (!rc1 || rc1.status !== 1) throw new Error("setBaseURI failed");

  const baseEv = rc1.logs
    .map((l) => {
      try {
        return nft.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((p) => p?.name === "BaseURIUpdated");

  console.log("Sending schedulePlaceholderURI…");
  const tx2 = await nft.schedulePlaceholderURI(PLACEHOLDER_URI);
  console.log("schedulePlaceholderURI hash", tx2.hash);
  const rc2 = await tx2.wait();
  if (!rc2 || rc2.status !== 1) throw new Error("schedulePlaceholderURI failed");

  const schedEv = rc2.logs
    .map((l) => {
      try {
        return nft.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((p) => p?.name === "AdminOpScheduled");

  const eta = Number(await nft.pendingAdminOps(opId));
  const tokenURI1 = await nft.tokenURI(1n);
  const collectionRevealed = await nft.collectionRevealed();
  const revealRequested = await nft.revealRequested();

  console.log(
    JSON.stringify(
      {
        pass: true,
        setBaseURI: {
          hash: tx1.hash,
          block: rc1.blockNumber,
          gasUsed: rc1.gasUsed.toString(),
          BaseURIUpdated: baseEv?.args?.uri ?? null,
        },
        schedulePlaceholderURI: {
          hash: tx2.hash,
          block: rc2.blockNumber,
          gasUsed: rc2.gasUsed.toString(),
          opId: schedEv?.args?.opId ?? opId,
          etaFromEvent: schedEv?.args?.eta?.toString?.() ?? null,
          pendingAdminOpsEta: eta,
          earliestExecuteUnix: eta,
          earliestExecuteUtc: eta
            ? new Date(eta * 1000).toISOString()
            : null,
        },
        tokenURI1,
        collectionRevealed,
        revealRequested,
        note: "executePlaceholderURI NOT sent — wait until eta",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
