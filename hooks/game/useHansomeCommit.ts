"use client";

import { useCallback, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
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
import type { LocationId } from "@/types/game";

export type CommitResult =
  | { ok: true; mode: "chain"; record: CommitSecretRecord }
  | { ok: true; mode: "local"; record: CommitSecretRecord }
  | { ok: false; error: string };

/**
 * Prepare Commit secret and optionally submit HansomeGame.commit when configured.
 */
export function useHansomeCommit() {
  const { address, isConnected } = useAccount();
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

      try {
        const txHash = await writeContractAsync({
          address: HANSOME_GAME_ADDRESS,
          abi: hansomeGameAbi,
          functionName: "commit",
          args: [
            BigInt(input.tokenId),
            BigInt(input.day),
            prepared.commitHash,
          ],
          chainId: GAME_CHAIN_ID,
        });
        const sealed = upsertCommitSecret({
          ...prepared,
          status: "submitted",
          txHash,
        });
        playSfx("ui-click");
        return { ok: true, mode: "chain", record: sealed };
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Commit transaction failed.";
        setLastError(message);
        return { ok: false, error: message };
      }
    },
    [address, configured, isConnected, reset, writeContractAsync],
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
