/**
 * Phase 1 preflight: simulate setBaseURI + estimateGas (no broadcast).
 */
import { ethers, network } from "hardhat";
import { getDeployerSigner } from "./lib/signer";

const GENESIS_NFT = "0x6eBb78FDB40CF6f6b8B33a235eF321AD15107cb0";
const EXPECTED_OWNER = "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A";

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== 4663) {
    throw new Error(`REFUSED: chainId ${chainId} !== 4663`);
  }

  const baseURI = process.env.BASE_URI;
  if (!baseURI?.endsWith("/")) {
    throw new Error("Set BASE_URI from vault (must end with /)");
  }

  const signer = await getDeployerSigner(ethers.provider);
  const signerAddr = await signer.getAddress();
  if (signerAddr.toLowerCase() !== EXPECTED_OWNER.toLowerCase()) {
    throw new Error(`Signer ${signerAddr} != owner ${EXPECTED_OWNER}`);
  }

  const nft = await ethers.getContractAt("HansomeGenesisNFT", GENESIS_NFT, signer);

  const [frozen, saleMinted, nextSaleTokenId, revealRequested, collectionRevealed, metadataFrozen, tokenUri1, nonce] =
    await Promise.all([
      nft.metadataFrozen(),
      nft.saleMinted(),
      nft.nextSaleTokenId(),
      nft.revealRequested(),
      nft.collectionRevealed(),
      nft.metadataFrozen(),
      nft.tokenURI(1n),
      ethers.provider.getTransactionCount(signerAddr, "pending"),
    ]);

  if (frozen) throw new Error("metadataFrozen — cannot setBaseURI");

  const data = nft.interface.encodeFunctionData("setBaseURI", [baseURI]);
  await ethers.provider.call({ from: signerAddr, to: GENESIS_NFT, data });

  const gasEstimate = await nft.setBaseURI.estimateGas(baseURI);
  const feeData = await ethers.provider.getFeeData();
  const block = await ethers.provider.getBlock("latest");
  const balance = await ethers.provider.getBalance(signerAddr);

  console.log(
    JSON.stringify(
      {
        network: network.name,
        chainId,
        signer: signerAddr,
        contract: GENESIS_NFT,
        baseURIFingerprint: `${baseURI.slice(7, 14)}…${baseURI.slice(-8)}`,
        baseURILength: baseURI.length,
        endsWithSlash: baseURI.endsWith("/"),
        simulation: "PASS",
        gasEstimate: gasEstimate.toString(),
        maxFeePerGas: feeData.maxFeePerGas?.toString() ?? null,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() ?? null,
        gasPrice: feeData.gasPrice?.toString() ?? null,
        ownerBalanceWei: balance.toString(),
        pendingNonce: nonce,
        blockNumber: block?.number,
        preState: {
          saleMinted: saleMinted.toString(),
          nextSaleTokenId: nextSaleTokenId.toString(),
          revealRequested,
          collectionRevealed,
          metadataFrozen,
          tokenURI1: tokenUri1,
        },
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
