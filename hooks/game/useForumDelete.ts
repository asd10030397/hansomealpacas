"use client";

import { useCallback, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import type { ForumAuthAction } from "@/lib/game/forum/types";

type DeleteTarget =
  | { action: Extract<ForumAuthAction, "delete-thread">; threadId: string }
  | { action: Extract<ForumAuthAction, "delete-reply">; threadId: string; replyId: string };

type DeleteResult = { ok: true } | { ok: false; error: string; code?: string };

export function useForumDelete() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isDeleting, setIsDeleting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const remove = useCallback(
    async (target: DeleteTarget): Promise<DeleteResult> => {
      if (!isConnected || !address) {
        const err = "Wallet not connected.";
        setLastError(err);
        return { ok: false, error: err, code: "NOT_CONNECTED" };
      }

      setIsDeleting(true);
      setLastError(null);

      try {
        const targetType = target.action === "delete-thread" ? "thread" : "reply";
        const targetId = target.action === "delete-thread" ? target.threadId : target.replyId;

        const params = new URLSearchParams({
          address,
          action: target.action,
          targetType,
          targetId,
        });
        const nonceRes = await fetch(`/api/game/forum/auth/nonce?${params.toString()}`);
        const nonceJson = (await nonceRes.json()) as {
          ok?: boolean;
          message?: string;
          nonce?: string;
          error?: string;
        };
        if (!nonceRes.ok || !nonceJson.ok || !nonceJson.message || !nonceJson.nonce) {
          const err = nonceJson.error ?? "Could not start authentication.";
          setLastError(err);
          return { ok: false, error: err };
        }

        const signature = await signMessageAsync({ message: nonceJson.message });

        const url =
          target.action === "delete-thread"
            ? `/api/game/forum/threads/${target.threadId}`
            : `/api/game/forum/threads/${target.threadId}/replies/${target.replyId}`;

        const res = await fetch(url, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            signature,
            nonce: nonceJson.nonce,
          }),
        });

        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          code?: string;
        };

        if (!res.ok || !json.ok) {
          const err = json.error ?? "Delete failed.";
          setLastError(err);
          return { ok: false, error: err, code: json.code };
        }

        return { ok: true };
      } catch (e) {
        const err =
          e instanceof Error && /reject/i.test(e.message)
            ? "Signature cancelled."
            : e instanceof Error
              ? e.message
              : "Delete failed.";
        setLastError(err);
        return { ok: false, error: err };
      } finally {
        setIsDeleting(false);
      }
    },
    [address, isConnected, signMessageAsync],
  );

  return { remove, isDeleting, lastError, clearError: () => setLastError(null) };
}
