"use client";

import { useCallback, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { hansomeGameAbi } from "@/lib/game/abis/hansomeGame";
import {
  GAME_CHAIN_ID,
  HANSOME_GAME_ADDRESS,
  isHansomeGameConfigured,
} from "@/lib/game/hansomeGame";
import {
  generateSalt,
  getCommitSecret,
  upsertCommitSecret,
  type CommitSecretRecord,
} from "@/lib/game/commitSecret";
import { playSfx } from "@/lib/game/audio";
import {
  formatRobinhoodWriteError,
  sendRobinhoodContractWrite,
} from "@/lib/game/robinhoodContractWrite";
import type { LocationId } from "@/types/game";

export type CommitResult =
  | { ok: true; mode: "chain"; record: CommitSecretRecord }
  | { ok: true; mode: "local"; record: CommitSecretRecord }
  | { ok: false; error: string };

/**
 * Prepare Commit secret and optionally submit HansomeGame.commit when configured.
 * On-chain path matches Mint: simulate → estimateGas → pin Robinhood fees → write.
 */
export function useHansomeCommit() {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const publicClient = usePublicClient({ chainId: GAME_CHAIN_ID });
  const configured = isHansomeGameConfigured();
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } =
    useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash, chainId: GAME_CHAIN_ID });
  const [lastError, setLastError] = useState<string | null>(null);

  const commitNft = useCallback(
    async (input: {
      tokenId: number;
      day: number;
      locationId: LocationId;
    }): Promise<CommitResult> => {
      setLastError(null);
      reset();

      const existing = getCommitSecret(input.tokenId, input.day);
      if (existing?.status === "submitted" || existing?.status === "revealed") {
        return {
          ok: false,
          error: `Token #${input.tokenId} already committed for day ${input.day}.`,
        };
      }

      const salt = existing?.salt ?? generateSalt();
      const prepared = upsertCommitSecret({
        tokenId: input.tokenId,
        day: input.day,
        locationId: input.locationId,
        salt,
        status: "prepared",
      });

      if (!configured || !HANSOME_GAME_ADDRESS) {
        const sealed = upsertCommitSecret({
          ...prepared,
          status: "submitted",
        });
        playSfx("ui-click");
        return { ok: true, mode: "local", record: sealed };
      }

      if (!isConnected || !address) {
        return { ok: false, error: "Connect wallet to commit on-chain." };
      }

      if (walletChainId !== GAME_CHAIN_ID) {
        return {
          ok: false,
          error: `Wrong network. Switch to chain ${GAME_CHAIN_ID} (Robinhood Testnet).`,
        };
      }

      if (!publicClient) {
        return { ok: false, error: "RPC client unavailable for commit simulation." };
      }

      try {
        const args = [
          BigInt(input.tokenId),
          BigInt(input.day),
          prepared.commitHash,
        ] as const;

        console.info("[hansome-commit] simulate args", {
          tokenId: input.tokenId,
          day: input.day,
          commitHash: prepared.commitHash,
          contract: HANSOME_GAME_ADDRESS,
          chainId: GAME_CHAIN_ID,
          walletChainId,
          account: address,
          locationId: input.locationId,
        });

        const { hash: txHash } = await sendRobinhoodContractWrite({
          label: "hansome-commit",
          publicClient,
          writeContractAsync: writeContractAsync as never,
          request: {
            chainId: GAME_CHAIN_ID,
            address: HANSOME_GAME_ADDRESS,
            abi: hansomeGameAbi,
            functionName: "commit",
            args,
            account: address,
          },
          extraLog: {
            tokenId: input.tokenId,
            day: input.day,
            locationId: input.locationId,
            commitHash: prepared.commitHash,
          },
        });

        const sealed = upsertCommitSecret({
          ...prepared,
          status: "submitted",
          txHash,
        });
        playSfx("ui-click");
        return { ok: true, mode: "chain", record: sealed };
      } catch (e) {
        const message = formatRobinhoodWriteError(e, "Commit transaction failed.");
        setLastError(message);
        return { ok: false, error: message };
      }
    },
    [
      address,
      configured,
      isConnected,
      publicClient,
      reset,
      walletChainId,
      writeContractAsync,
    ],
  );

  return {
    commitNft,
    configured,
    isPending: isPending || receipt.isLoading,
    txHash: hash,
    receipt,
    lastError: lastError ?? writeError?.message ?? null,
  };
}
