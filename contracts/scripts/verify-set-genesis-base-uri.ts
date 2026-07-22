/**
 * Phase 1 post-broadcast verification for setBaseURI.
 */
import { ethers } from "hardhat";

const GENESIS_NFT = "0x6eBb78FDB40CF6f6b8B33a235eF321AD15107cb0";
const TX_HASH =
  process.env.SETBASEURI_TX ||
  "0x53806bbc520ff3dbc8a1fd99d5ff21c9cbccb1c44e04efc1f499f8f17fcab406";
const PLACEHOLDER =
  "ipfs://bafybeiaq6n2kpjqsr5tb22gmxek6w3u2ot2ys7fkxzkxtzhzbfcyhnc26u/placeholder.json";

async function main() {
  const nft = await ethers.getContractAt("HansomeGenesisNFT", GENESIS_NFT);
  const rc = await ethers.provider.getTransactionReceipt(TX_HASH);
  if (!rc) throw new Error(`Receipt not found for ${TX_HASH}`);
  const tx = await ethers.provider.getTransaction(TX_HASH);
  if (!tx) throw new Error(`Tx not found for ${TX_HASH}`);

  const iface = nft.interface;
  const baseUriEvents = rc.logs
    .map((log) => {
      try {
        return iface.parseLog({ topics: [...log.topics], data: log.data });
      } catch {
        return null;
      }
    })
    .filter((e) => e && e.name === "BaseURIUpdated");

  const [
    saleMinted,
    nextSaleTokenId,
    revealRequested,
    collectionRevealed,
    metadataFrozen,
    tokenUri1,
    whitelistMerkleRoot,
  ] = await Promise.all([
    nft.saleMinted(),
    nft.nextSaleTokenId(),
    nft.revealRequested(),
    nft.collectionRevealed(),
    nft.metadataFrozen(),
    nft.tokenURI(1n),
    nft.whitelistMerkleRoot(),
  ]);

  const block = await ethers.provider.getBlock(rc.blockNumber);

  const checks = {
    receiptStatusSuccess: rc.status === 1,
    baseUriEventCount: baseUriEvents.length,
    baseUriEventUri: baseUriEvents[0]?.args?.[0] ?? null,
    tokenUri1IsPlaceholder: tokenUri1 === PLACEHOLDER,
    saleMintedIsZero: saleMinted === 0n,
    nextSaleTokenIdIs11: nextSaleTokenId === 11n,
    revealRequestedFalse: revealRequested === false,
    collectionRevealedFalse: collectionRevealed === false,
    metadataFrozenFalse: metadataFrozen === false,
    merkleRootUnset:
      whitelistMerkleRoot ===
      "0x0000000000000000000000000000000000000000000000000000000000000000",
  };

  const allPass = Object.values(checks).every(Boolean);

  console.log(
    JSON.stringify(
      {
        txHash: TX_HASH,
        blockNumber: rc.blockNumber,
        blockTimestamp: block?.timestamp,
        gasUsed: rc.gasUsed.toString(),
        from: tx.from,
        to: tx.to,
        status: rc.status,
        baseURIUpdated: baseUriEvents.map((e) => ({
          uriFingerprint: String(e?.args?.[0]).slice(7, 14) + "…" + String(e?.args?.[0]).slice(-8),
          uriLength: String(e?.args?.[0]).length,
        })),
        liveState: {
          tokenURI1: tokenUri1,
          saleMinted: saleMinted.toString(),
          nextSaleTokenId: nextSaleTokenId.toString(),
          revealRequested,
          collectionRevealed,
          metadataFrozen,
          whitelistMerkleRoot,
        },
        checks,
        postBroadcastPass: allPass,
      },
      null,
      2,
    ),
  );

  if (!allPass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
