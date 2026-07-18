"use client";

import { useCallback, useMemo } from "react";
import { zeroAddress } from "viem";
import {
  useAccount,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { hansomeGenesisNftAbi } from "@/lib/game/abis/hansomeGenesisNft";
import {
  GENESIS_CHAIN_ID,
  GENESIS_NFT_ADDRESS,
  GENESIS_SUPPLY,
  isGenesisConfigured,
} from "@/lib/game/genesis";
import {
  buildMintSaleState,
  lookupWhitelistProof,
  type WhitelistProofMap,
} from "@/lib/game/mintService";
import type { MintSaleState } from "@/types/game";

const abi = hansomeGenesisNftAbi;

type UseGenesisMintOptions = {
  /** Optional merkle proofs for whitelist mint. */
  whitelistProofs?: WhitelistProofMap | null;
};

export function useGenesisMint(options: UseGenesisMintOptions = {}) {
  const { address, isConnected } = useAccount();
  const configured = isGenesisConfigured() && GENESIS_NFT_ADDRESS != null;
  const nft = GENESIS_NFT_ADDRESS;
  const reader = address ?? zeroAddress;

  const reads = useReadContracts({
    contracts: [
      {
        address: nft ?? zeroAddress,
        abi,
        functionName: "name",
        chainId: GENESIS_CHAIN_ID,
      },
      {
        address: nft ?? zeroAddress,
        abi,
        functionName: "totalMinted",
        chainId: GENESIS_CHAIN_ID,
      },
      {
        address: nft ?? zeroAddress,
        abi,
        functionName: "saleMinted",
        chainId: GENESIS_CHAIN_ID,
      },
      {
        address: nft ?? zeroAddress,
        abi,
        functionName: "mintPrice",
        chainId: GENESIS_CHAIN_ID,
      },
      {
        address: nft ?? zeroAddress,
        abi,
        functionName: "publicStart",
        chainId: GENESIS_CHAIN_ID,
      },
      {
        address: nft ?? zeroAddress,
        abi,
        functionName: "isWhitelistOpen",
        chainId: GENESIS_CHAIN_ID,
      },
      {
        address: nft ?? zeroAddress,
        abi,
        functionName: "isPublicOpen",
        chainId: GENESIS_CHAIN_ID,
      },
      {
        address: nft ?? zeroAddress,
        abi,
        functionName: "reservedMinted",
        chainId: GENESIS_CHAIN_ID,
      },
      {
        address: nft ?? zeroAddress,
        abi,
        functionName: "royaltyInfo",
        args: [1n, 10_000n],
        chainId: GENESIS_CHAIN_ID,
      },
      {
        address: nft ?? zeroAddress,
        abi,
        functionName: "whitelistMintCount",
        args: [reader],
        chainId: GENESIS_CHAIN_ID,
      },
      {
        address: nft ?? zeroAddress,
        abi,
        functionName: "publicMintCount",
        args: [reader],
        chainId: GENESIS_CHAIN_ID,
      },
    ],
    query: {
      enabled: configured,
      refetchInterval: 12_000,
    },
  });

  const proof = lookupWhitelistProof(address, options.whitelistProofs);

  const sale: MintSaleState | null = useMemo(() => {
    if (!configured || !reads.data) return null;
    const [
      nameR,
      totalR,
      saleR,
      priceR,
      publicStartR,
      wlOpenR,
      pubOpenR,
      reservedR,
      royaltyR,
      wlCountR,
      pubCountR,
    ] = reads.data;

    if (
      totalR.status !== "success" ||
      saleR.status !== "success" ||
      priceR.status !== "success" ||
      wlOpenR.status !== "success" ||
      pubOpenR.status !== "success"
    ) {
      return null;
    }

    const royaltyBps =
      royaltyR.status === "success" ? Number(royaltyR.result[1]) : GENESIS_SUPPLY.royaltyBps;

    return buildMintSaleState({
      name: nameR.status === "success" ? nameR.result : undefined,
      totalMinted: totalR.result,
      saleMinted: saleR.result,
      mintPrice: priceR.result,
      publicStart: publicStartR.status === "success" ? publicStartR.result : 0n,
      isWhitelistOpen: wlOpenR.result,
      isPublicOpen: pubOpenR.result,
      reservedMinted: reservedR.status === "success" ? reservedR.result : false,
      royaltyBps,
      whitelistMintCount:
        address && wlCountR.status === "success" ? Number(wlCountR.result) : null,
      publicMintCount:
        address && pubCountR.status === "success" ? Number(pubCountR.result) : null,
      whitelistEligible: !isConnected
        ? null
        : proof != null
          ? true
          : options.whitelistProofs
            ? false
            : null,
    });
  }, [address, configured, isConnected, options.whitelistProofs, proof, reads.data]);

  const mintPrice =
    reads.data?.[3]?.status === "success" ? reads.data[3].result : 0n;
  const publicMintedWallet =
    address && reads.data?.[10]?.status === "success"
      ? Number(reads.data[10].result)
      : 0;
  const wlMintedWallet =
    address && reads.data?.[9]?.status === "success"
      ? Number(reads.data[9].result)
      : 0;

  const { writeContract, data: txHash, isPending, error: writeError, reset } =
    useWriteContract();
  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: GENESIS_CHAIN_ID,
  });

  const mintPublic = useCallback(
    (quantity: number) => {
      if (!nft) throw new Error("Genesis NFT not configured");
      const value = mintPrice * BigInt(quantity);
      writeContract({
        address: nft,
        abi,
        functionName: "publicMint",
        args: [BigInt(quantity)],
        value,
        chainId: GENESIS_CHAIN_ID,
      });
    },
    [mintPrice, nft, writeContract],
  );

  const mintWhitelist = useCallback(() => {
    if (!nft) throw new Error("Genesis NFT not configured");
    if (!proof) throw new Error("No whitelist proof for this wallet");
    writeContract({
      address: nft,
      abi,
      functionName: "whitelistMint",
      args: [proof],
      value: mintPrice,
      chainId: GENESIS_CHAIN_ID,
    });
  }, [mintPrice, nft, proof, writeContract]);

  const maxPublicQty = Math.max(
    0,
    Math.min(
      GENESIS_SUPPLY.publicWalletMax - publicMintedWallet,
      GENESIS_SUPPLY.combinedWalletMax - wlMintedWallet - publicMintedWallet,
    ),
  );

  return {
    configured,
    sale,
    mintPrice,
    isLoading: configured && reads.isLoading && !sale,
    isRefetching: reads.isFetching,
    refetch: reads.refetch,
    readError: reads.error,
    mintPublic,
    mintWhitelist,
    canWhitelistMint: Boolean(proof) && sale?.phase === "Whitelist",
    maxPublicQty,
    txHash,
    isPending,
    isConfirming: receipt.isLoading,
    isSuccess: receipt.isSuccess,
    writeError,
    receiptError: receipt.error,
    resetTx: reset,
  };
}
