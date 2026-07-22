"use client";

import { useMemo, useState } from "react";
import { PixelButton, PixelPanel } from "@/components/ui/pixel";
import { ForumIdentityBadge } from "@/components/game/forum/ForumIdentityBadge";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useForumPost } from "@/hooks/game/useForumPost";
import type { OwnedGenesisNft } from "@/hooks/game/useOwnedGenesisNfts";
import type { ForumAuthAction, ForumBoardSlug } from "@/lib/game/forum/types";
import { FORUM_BOARD_BUGS, FORUM_LIMITS } from "@/lib/game/forum/types";

type ForumComposerProps = {
  mode: ForumAuthAction;
  boardSlug?: ForumBoardSlug;
  nfts: OwnedGenesisNft[];
  isConnected: boolean;
  configured: boolean;
  threadId?: string;
  onSuccess: (id: string) => void;
};

export function ForumComposer({
  mode,
  boardSlug,
  nfts,
  isConnected,
  configured,
  threadId,
  onSuccess,
}: ForumComposerProps) {
  const { t } = useGameI18n();
  const { submit, isSubmitting, lastError, clearError } = useForumPost();
  const [body, setBody] = useState("");
  const [tokenId, setTokenId] = useState<number | null>(null);
  const boardLabel = boardSlug ? t.forum.boards[boardSlug] : t.forum.boardName;
  const bodyPlaceholder =
    mode === "create-thread" && boardSlug === FORUM_BOARD_BUGS
      ? t.forum.bugsBodyPlaceholder
      : mode === "create-thread"
        ? t.forum.bodyPlaceholder
        : t.forum.commentPlaceholder;

  const canPost = configured && isConnected && nfts.length > 0;

  const selectedNft = useMemo(
    () => nfts.find((n) => n.tokenId === tokenId) ?? null,
    [nfts, tokenId],
  );

  const handleSubmit = async () => {
    clearError();
    if (!canPost || tokenId == null) return;
    const result = await submit({
      action: mode,
      tokenId,
      body,
      threadId,
      boardSlug,
    });
    if (result.ok) {
      setBody("");
      onSuccess(result.id);
    }
  };

  if (!configured) {
    return (
      <PixelPanel
        title={mode === "create-reply" ? t.forum.commentComposerTitle : t.forum.composerTitle}
        eyebrow={boardLabel}
      >
        <p className="text-sm text-[var(--hg-muted)]">{t.common.demoBanner}</p>
      </PixelPanel>
    );
  }

  if (!isConnected) {
    return (
      <PixelPanel
        title={mode === "create-reply" ? t.forum.commentComposerTitle : t.forum.composerTitle}
        eyebrow={boardLabel}
      >
        <p className="text-sm text-[var(--hg-muted)]">
          {t.common.walletRequiredBody(t.forum.featureName)}
        </p>
      </PixelPanel>
    );
  }

  if (nfts.length === 0) {
    return (
      <PixelPanel
        title={mode === "create-reply" ? t.forum.commentComposerTitle : t.forum.composerTitle}
        eyebrow={boardLabel}
      >
        <p className="text-sm text-[var(--hg-muted)]">{t.forum.noNftBody}</p>
      </PixelPanel>
    );
  }

  return (
    <PixelPanel
      title={mode === "create-reply" ? t.forum.commentComposerTitle : t.forum.composerTitle}
      eyebrow={boardLabel}
    >
      <p className="mb-3 text-xs text-[var(--hg-muted)]">{t.forum.postAsHint}</p>

      <div className="flex flex-wrap gap-2">
        {nfts.map((nft) => {
          const active = tokenId === nft.tokenId;
          return (
            <button
              key={nft.tokenId}
              type="button"
              onClick={() => setTokenId(nft.tokenId)}
              className={`rounded border px-2 py-1.5 transition-colors ${
                active
                  ? "border-[#f0c44a] bg-[#f0c44a]/10"
                  : "border-[#f0c44a]/20 bg-[#1a1520]/50 hover:border-[#f0c44a]/40"
              }`}
            >
              <ForumIdentityBadge
                tokenId={nft.tokenId}
                authorAddress=""
                image={nft.image}
                side={nft.side}
                gameplayClass={nft.gameplayClass}
                compact
              />
            </button>
          );
        })}
      </div>

      <label className="mt-4 block">
        <span className="text-xs uppercase tracking-wide text-[var(--hg-muted)]">
          {mode === "create-thread" ? t.forum.bodyLabel : t.forum.commentLabel}
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, FORUM_LIMITS.maxBody))}
          maxLength={FORUM_LIMITS.maxBody}
          rows={mode === "create-thread" ? 5 : 4}
          className="mt-1 w-full resize-y rounded border border-[#f0c44a]/25 bg-[#0e121c] px-3 py-2 text-sm text-white outline-none focus:border-[#f0c44a]"
          placeholder={bodyPlaceholder}
        />
      </label>

      {selectedNft ? (
        <div className="mt-3 rounded border border-[#f0c44a]/15 bg-[#0e121c]/60 p-2">
          <ForumIdentityBadge
            tokenId={selectedNft.tokenId}
            authorAddress=""
            image={selectedNft.image}
            side={selectedNft.side}
            gameplayClass={selectedNft.gameplayClass}
          />
        </div>
      ) : (
        <p className="mt-3 text-xs text-[#f0c44a]/90">{t.forum.selectNftHint}</p>
      )}

      {lastError ? (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {lastError}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PixelButton
          variant="gold"
          size="sm"
          disabled={!canPost || tokenId == null || isSubmitting || !body.trim()}
          onClick={() => void handleSubmit()}
        >
          {isSubmitting
            ? t.forum.signing
            : mode === "create-thread"
              ? t.forum.createThread
              : t.forum.postComment}
        </PixelButton>
        <p className="text-xs text-[var(--hg-muted)]">{t.forum.signHint}</p>
      </div>
    </PixelPanel>
  );
}
