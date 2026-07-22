"use client";

import { useCallback, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import type { ForumLikeTargetType } from "@/lib/game/forum/types";

type ToggleResult =
  | { ok: true; liked: boolean; likeCount: number }
  | { ok: false; error: string; code?: string };

export function useForumLike() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isToggling, setIsToggling] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const toggle = useCallback(
    async (
      targetType: ForumLikeTargetType,
      targetId: string,
    ): Promise<ToggleResult> => {
      if (!isConnected || !address) {
        const err = "Wallet not connected.";
        setLastError(err);
        return { ok: false, error: err, code: "NOT_CONNECTED" };
      }

      setIsToggling(true);
      setLastError(null);

      try {
        const params = new URLSearchParams({
          address,
          action: "toggle-like",
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

        const res = await fetch("/api/game/forum/likes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            targetType,
            targetId,
            signature,
            nonce: nonceJson.nonce,
          }),
        });

        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          code?: string;
          liked?: boolean;
          likeCount?: number;
        };

        if (!res.ok || !json.ok || typeof json.liked !== "boolean" || typeof json.likeCount !== "number") {
          const err = json.error ?? "Like failed.";
          setLastError(err);
          return { ok: false, error: err, code: json.code };
        }

        return { ok: true, liked: json.liked, likeCount: json.likeCount };
      } catch (e) {
        const err =
          e instanceof Error && /reject/i.test(e.message)
            ? "Signature cancelled."
            : e instanceof Error
              ? e.message
              : "Like failed.";
        setLastError(err);
        return { ok: false, error: err };
      } finally {
        setIsToggling(false);
      }
    },
    [address, isConnected, signMessageAsync],
  );

  return { toggle, isToggling, lastError, clearError: () => setLastError(null) };
}
