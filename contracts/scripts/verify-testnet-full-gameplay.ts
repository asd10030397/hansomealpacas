/**
 * Full Testnet gameplay access check: unlock + trait deck coverage + sample classes.
 *
 * Usage: npx hardhat run scripts/verify-testnet-full-gameplay.ts --network robinhoodTestnet
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

function unpack(packed: number): { side: string; cls: string; key: string } {
  const isCougar = (packed & 0x80) !== 0;
  const cls = packed & 0x0f;
  if (isCougar) return { side: "Cougar", cls: "None", key: "Cougar" };
  const name = CLASS[cls] ?? `?${cls}`;
  return { side: "Alpaca", cls: name, key: `Alpaca:${name}` };
}

async function main() {
  if (network.name === "robinhood" || network.name.toLowerCase().includes("mainnet")) {
    throw new Error("REFUSED: Mainnet");
  }
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
  const totalMinted = Number(await genesis.totalMinted());
  if (!unlock) {
    throw new Error("testnetGameplayUnlock=false — run activate-testnet-gameplay-identities");
  }

  const { assigned, revealSeed } = buildTestnetAssignedIdentities();
  const wanted = [
    "Alpaca:Common",
    "Alpaca:Guardian",
    "Alpaca:Farmer",
    "Alpaca:Lucky",
    "Alpaca:Runner",
    "Cougar",
  ] as const;
  const firstId: Record<string, number> = {};
  for (let i = 0; i < 540; i++) {
    const u = unpack(assigned[i]!);
    if (firstId[u.key] == null) firstId[u.key] = i + 11;
  }

  console.log({
    game: record.address,
    unlock,
    collectionRevealed,
    totalMinted,
    revealSeed,
    deckFirstIds: firstId,
  });

  // King is reserved #1 (not in sale deck).
  try {
    const kingRevealed = await genesis.isRevealed(1);
    const kingSide = Number(await genesis.side(1));
    const kingClass = Number(await genesis.gameplayClass(1));
    console.log({
      tokenId: 1,
      label: "Alpaca:King (reserved)",
      onChainRevealed: kingRevealed,
      side: SIDE[kingSide],
      cls: CLASS[kingClass],
      gameplayReady: kingRevealed,
    });
  } catch (e) {
    console.log({ tokenId: 1, label: "Alpaca:King", error: String(e) });
  }

  for (const key of wanted) {
    const tokenId = firstId[key];
    if (tokenId == null) throw new Error(`Deck missing ${key}`);
    const minted = tokenId <= totalMinted;
    const packed = assigned[tokenId - 11]!;
    const expected = unpack(packed);
    let onChainRevealed = false;
    if (minted) {
      onChainRevealed = await genesis.isRevealed(tokenId);
    }
    const gameplayReady =
      onChainRevealed || (unlock && !collectionRevealed && tokenId >= 11);
    console.log({
      key,
      tokenId,
      minted,
      onChainRevealed,
      testnetOverride: { side: expected.side, cls: expected.cls },
      gameplayReady,
      note: minted
        ? "available now"
        : `mint more sale NFTs (need totalMinted >= ${tokenId})`,
    });
  }

  console.log(
    "OK — Testnet unlock active. Sale NFTs use FY trait deck for Commit/Reveal/Settle.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
