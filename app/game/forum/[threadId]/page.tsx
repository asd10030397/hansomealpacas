"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { ForumComposer } from "@/components/game/forum/ForumComposer";
import { ForumDeleteButton } from "@/components/game/forum/ForumDeleteButton";
import { ForumIdentityBadge } from "@/components/game/forum/ForumIdentityBadge";
import { ForumLikeButton } from "@/components/game/forum/ForumLikeButton";
import { PixelPanel } from "@/components/ui/pixel";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useOwnedGenesisNfts } from "@/hooks/game/useOwnedGenesisNfts";
import { useForumAuthorDisplayMap } from "@/hooks/game/useForumAuthorDisplayMap";
import type { ForumPublicReply, ForumThreadDetail } from "@/lib/game/forum/types";
import { isGenesisConfigured } from "@/lib/game/genesis";

function formatWhen(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-TW" : "en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function isSameAuthor(viewer?: string, author?: string): boolean {
  if (!viewer || !author) return false;
  return viewer.toLowerCase() === author.toLowerCase();
}

export default function ForumThreadPage() {
  const params = useParams<{ threadId: string }>();
  const threadId = params.threadId;
  const router = useRouter();
  const { t, locale } = useGameI18n();
  const gameHref = useGameHref();
  const { address } = useAccount();
  const owned = useOwnedGenesisNfts();
  const [thread, setThread] = useState<ForumThreadDetail | null>(null);
  const [replies, setReplies] = useState<ForumPublicReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const forumTokenIds = useMemo(() => {
    const ids: number[] = [];
    if (thread) ids.push(thread.tokenId);
    for (const reply of replies) ids.push(reply.tokenId);
    return ids;
  }, [thread, replies]);
  const authorDisplay = useForumAuthorDisplayMap(forumTokenIds, owned.nfts);

  const refreshThread = useCallback(async () => {
    if (!threadId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const query = address ? `?address=${encodeURIComponent(address)}` : "";
      const res = await fetch(`/api/game/forum/threads/${threadId}${query}`);
      const json = (await res.json()) as {
        ok?: boolean;
        thread?: ForumThreadDetail;
        replies?: ForumPublicReply[];
        error?: string;
      };
      if (!res.ok || !json.ok || !json.thread) {
        setLoadError(json.error ?? t.forum.loadError);
        setThread(null);
        setReplies([]);
        return;
      }
      setThread(json.thread);
      setReplies(json.replies ?? []);
    } catch {
      setLoadError(t.forum.loadError);
      setThread(null);
      setReplies([]);
    } finally {
      setLoading(false);
    }
  }, [threadId, address, t.forum.loadError]);

  useEffect(() => {
    void refreshThread();
  }, [refreshThread]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-3 py-6">
        <p className="text-sm text-[var(--hg-muted)]">{t.common.loading}</p>
      </div>
    );
  }

  if (loadError || !thread) {
    return (
      <div className="mx-auto max-w-3xl px-3 py-6">
        <Link href={gameHref.forum} className="text-sm text-[#f0c44a] hover:underline">
          ← {t.forum.backToBoard}
        </Link>
        <PixelPanel className="mt-4" title={t.common.unavailableTitle}>
          <p className="text-sm text-[var(--hg-muted)]">{loadError ?? t.forum.notFound}</p>
        </PixelPanel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-6">
      {!isGenesisConfigured() ? (
        <p className="mock-chip mb-3">{t.common.demoBanner}</p>
      ) : null}

      <Link
        href={`${gameHref.forum}?board=${thread.boardSlug}`}
        className="text-sm text-[#f0c44a] hover:underline"
      >
        ← {t.forum.backToBoard}
      </Link>

      <PixelPanel className="mt-4" title={thread.title} eyebrow={t.forum.boards[thread.boardSlug]}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <p className="whitespace-pre-wrap text-sm text-white/90">{thread.body}</p>
          <ForumIdentityBadge
            tokenId={thread.tokenId}
            authorAddress={thread.authorAddress}
            image={authorDisplay.get(thread.tokenId)?.image}
            side={authorDisplay.get(thread.tokenId)?.side}
            gameplayClass={authorDisplay.get(thread.tokenId)?.gameplayClass}
          />
        </div>
        <p className="mt-3 text-xs text-[var(--hg-muted)]">
          {formatWhen(thread.createdAt, locale)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ForumLikeButton
            targetType="thread"
            targetId={thread.id}
            initialCount={thread.likeCount}
            initialLiked={thread.viewerLiked}
          />
          {isSameAuthor(address, thread.authorAddress) ? (
            <ForumDeleteButton
              action="delete-thread"
              threadId={thread.id}
              onDeleted={() => {
                router.push(`${gameHref.forum}?board=${thread.boardSlug}`);
              }}
            />
          ) : null}
        </div>
      </PixelPanel>

      <PixelPanel className="mt-4" title={t.forum.commentsTitle} eyebrow={String(replies.length)}>
        {replies.length === 0 ? (
          <p className="text-sm text-[var(--hg-muted)]">{t.forum.emptyComments}</p>
        ) : (
          <ul className="space-y-4">
            {replies.map((reply) => (
              <li
                key={reply.id}
                className="rounded border border-[#f0c44a]/10 bg-[#0e121c]/40 p-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <p className="whitespace-pre-wrap text-sm text-white/90">{reply.body}</p>
                  <ForumIdentityBadge
                    tokenId={reply.tokenId}
                    authorAddress={reply.authorAddress}
                    image={authorDisplay.get(reply.tokenId)?.image}
                    side={authorDisplay.get(reply.tokenId)?.side}
                    gameplayClass={authorDisplay.get(reply.tokenId)?.gameplayClass}
                    compact
                  />
                </div>
                <p className="mt-2 text-xs text-[var(--hg-muted)]">
                  {formatWhen(reply.createdAt, locale)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ForumLikeButton
                    targetType="reply"
                    targetId={reply.id}
                    initialCount={reply.likeCount}
                    initialLiked={reply.viewerLiked}
                    compact
                  />
                  {isSameAuthor(address, reply.authorAddress) ? (
                    <ForumDeleteButton
                      action="delete-reply"
                      threadId={threadId}
                      replyId={reply.id}
                      compact
                      onDeleted={() => {
                        void refreshThread();
                      }}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PixelPanel>

      <div className="mt-4">
        <ForumComposer
          mode="create-reply"
          boardSlug={thread.boardSlug}
          nfts={owned.nfts}
          isConnected={owned.isConnected}
          configured={owned.configured}
          threadId={threadId}
          onSuccess={() => {
            void refreshThread();
          }}
        />
      </div>
    </div>
  );
}
