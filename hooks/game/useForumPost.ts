"use client";

import { useCallback, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import type { ForumAuthAction, ForumBoardSlug } from "@/lib/game/forum/types";
import { DEFAULT_FORUM_BOARD_SLUG } from "@/lib/game/forum/types";

type PostPayload = {
  action: ForumAuthAction;
  tokenId: number;
  body: string;
  threadId?: string;
  boardSlug?: ForumBoardSlug;
};

type PostResult =
  | { ok: true; id: string }
  | { ok: false; error: string; code?: string; retryAfterMs?: number };

export function useForumPost() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const submit = useCallback(
    async (payload: PostPayload): Promise<PostResult> => {
      if (!isConnected || !address) {
        const err = "Wallet not connected.";
        setLastError(err);
        return { ok: false, error: err, code: "NOT_CONNECTED" };
      }

      setIsSubmitting(true);
      setLastError(null);

      try {
        const nonceRes = await fetch(
          `/api/game/forum/auth/nonce?address=${encodeURIComponent(address)}&action=${payload.action}`,
        );
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
          payload.action === "create-thread"
            ? "/api/game/forum/threads"
            : `/api/game/forum/threads/${payload.threadId}/replies`;

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            tokenId: payload.tokenId,
            body: payload.body,
            signature,
            nonce: nonceJson.nonce,
            boardSlug:
              payload.action === "create-thread"
                ? (payload.boardSlug ?? DEFAULT_FORUM_BOARD_SLUG)
                : undefined,
          }),
        });

        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          code?: string;
          retryAfterMs?: number;
          thread?: { id: string };
          reply?: { id: string };
        };

        if (!res.ok || !json.ok) {
          const err = json.error ?? "Post failed.";
          setLastError(err);
          return {
            ok: false,
            error: err,
            code: json.code,
            retryAfterMs: json.retryAfterMs,
          };
        }

        const id =
          payload.action === "create-thread" ? json.thread?.id : json.reply?.id;
        if (!id) {
          const err = "Unexpected server response.";
          setLastError(err);
          return { ok: false, error: err };
        }

        return { ok: true, id };
      } catch (e) {
        const err =
          e instanceof Error && /reject/i.test(e.message)
            ? "Signature cancelled."
            : e instanceof Error
              ? e.message
              : "Post failed.";
        setLastError(err);
        return { ok: false, error: err };
      } finally {
        setIsSubmitting(false);
      }
    },
    [address, isConnected, signMessageAsync],
  );

  return { submit, isSubmitting, lastError, clearError: () => setLastError(null) };
}
