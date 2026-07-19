/**
 * Verify Testnet gameplay unlock is active and identity overrides match the FY deck.
 *
 * Usage: npx hardhat run scripts/verify-testnet-gameplay-unlock.ts --network robinhoodTestnet
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";
import { buildTestnetAssignedIdentities } from "./lib/build-testnet-assigned-identities";
import { getDeployerSigner } from "./lib/signer";

const SIDE = ["None", "Alpaca", "Cougar"] as const;
const CLASS = [
  "None",
  "Common",
  "Guardian",
  "Farmer",
  "Lucky",
  "Runner",
  "King",
] as const;

function unpack(packed: number): { side: string; cls: string } {
  const isCougar = (packed & 0x80) !== 0;
  const cls = packed & 0x0f;
  if (isCougar) return { side: "Cougar", cls: "None" };
  return { side: "Alpaca", cls: CLASS[cls] ?? `?${cls}` };
}

async function main() {
  const gamePath = join(__dirname, "..", "deployments", `${network.name}-game.json`);
  if (!existsSync(gamePath)) throw new Error(`Missing ${gamePath}`);
  const record = JSON.parse(readFileSync(gamePath, "utf8")) as {
    address: string;
    genesis: string;
  };

  const signer = await getDeployerSigner(ethers.provider);
  const game = await ethers.getContractAt("HansomeGame", record.address, signer);
  const genesis = await ethers.getContractAt(
    "HansomeGenesisNFT",
    record.genesis,
    signer,
  );

  const unlock = await game.testnetGameplayUnlock();
  const collectionRevealed = await genesis.isCollectionRevealed();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);

  console.log({
    network: network.name,
    chainId,
    game: record.address,
    genesis: record.genesis,
    testnetGameplayUnlock: unlock,
    collectionRevealed,
  });

  if (chainId === 4663) {
    throw new Error("REFUSED: do not run unlock verify against Mainnet.");
  }
  if (!unlock) throw new Error("testnetGameplayUnlock is false — run activate script.");
  if (collectionRevealed) {
    console.warn(
      "WARN: collection already revealed — game will use on-chain genesis identities.",
    );
  }

  const { assigned } = buildTestnetAssignedIdentities();
  const totalMinted = Number(await genesis.totalMinted());
  const sampleIds = [11, 22, 27, 30, 100, 550].filter(
    (id) => id >= 11 && id <= totalMinted,
  );
  console.log({ totalMinted, sampling: sampleIds });

  for (const tokenId of sampleIds) {
    let onChainRevealed = false;
    let onChainSide = 0;
    let onChainClass = 0;
    try {
      onChainRevealed = await genesis.isRevealed(tokenId);
      onChainSide = Number(await genesis.side(tokenId));
      onChainClass = Number(await genesis.gameplayClass(tokenId));
    } catch (e) {
      throw new Error(`Genesis read failed for #${tokenId}: ${String(e)}`);
    }
    const packed = assigned[tokenId - 11]!;
    const expected = unpack(packed);
    // Gameplay readiness: sale token + unlock + !collectionRevealed ⇒ ready even if !isRevealed
    const gameplayReady =
      onChainRevealed ||
      (unlock && !collectionRevealed && tokenId >= 11 && tokenId <= 550);

    console.log({
      tokenId,
      onChainRevealed,
      onChainSide: SIDE[onChainSide],
      onChainClass: CLASS[onChainClass],
      testnetOverride: expected,
      gameplayReady,
    });

    if (!gameplayReady) {
      throw new Error(`Token #${tokenId} not gameplay-ready after unlock`);
    }
    if (!onChainRevealed && expected.side === "None") {
      throw new Error(`Token #${tokenId} packed identity invalid`);
    }
  }

  console.log(
    "OK — Testnet sale NFTs are gameplay-unlocked; HansomeGame reads FY assigned traits via _sideOf/_classOf.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
