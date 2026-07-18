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
  getCommitSecret,
  upsertCommitSecret,
  type CommitSecretRecord,
} from "@/lib/game/commitSecret";
import { playSfx } from "@/lib/game/audio";

export type RevealResult =
  | { ok: true; mode: "chain" | "local"; record: CommitSecretRecord }
  | { ok: false; error: string };

export function useHansomeReveal() {
  const { address, isConnected } = useAccount();
  const configured = isHansomeGameConfigured();
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } =
    useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash, chainId: GAME_CHAIN_ID });
  const [lastError, setLastError] = useState<string | null>(null);

  const revealNft = useCallback(
    async (input: { tokenId: number; day: number }): Promise<RevealResult> => {
      setLastError(null);
      reset();

      const secret = getCommitSecret(input.tokenId, input.day);
      if (!secret) {
        return {
          ok: false,
          error: `No commit secret for #${input.tokenId} on day ${input.day}. Commit on this device first.`,
        };
      }
      if (secret.status === "revealed") {
        return { ok: false, error: `Token #${input.tokenId} already revealed.` };
      }
      if (secret.status !== "submitted" && secret.status !== "prepared") {
        return { ok: false, error: "Commit is not ready to reveal." };
      }

      if (!configured || !HANSOME_GAME_ADDRESS) {
        const record = upsertCommitSecret({
          ...secret,
          status: "revealed",
        });
        playSfx("ui-click");
        return { ok: true, mode: "local", record };
      }

      if (!isConnected || !address) {
        return { ok: false, error: "Connect wallet to reveal on-chain." };
      }

      try {
        const txHash = await writeContractAsync({
          address: HANSOME_GAME_ADDRESS,
          abi: hansomeGameAbi,
          functionName: "reveal",
          args: [
            BigInt(input.tokenId),
            BigInt(input.day),
            secret.locationId,
            secret.salt,
          ],
          chainId: GAME_CHAIN_ID,
        });
        const record = upsertCommitSecret({
          ...secret,
          status: "revealed",
          txHash,
        });
        playSfx("ui-click");
        return { ok: true, mode: "chain", record };
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Reveal transaction failed.";
        setLastError(message);
        return { ok: false, error: message };
      }
    },
    [address, configured, isConnected, reset, writeContractAsync],
  );

  return {
    revealNft,
    configured,
    isPending: isPending || receipt.isLoading,
    txHash: hash,
    lastError: lastError ?? writeError?.message ?? null,
  };
}
