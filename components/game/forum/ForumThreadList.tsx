"use client";

import Link from "next/link";
import { PixelPanel } from "@/components/ui/pixel";
import { ForumIdentityBadge } from "@/components/game/forum/ForumIdentityBadge";
import { ForumLikeButton } from "@/components/game/forum/ForumLikeButton";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import type { ForumBoardSlug, ForumThreadSummary } from "@/lib/game/forum/types";
import type { NftDisplayIdentity } from "@/lib/game/nftDisplay";

type ForumThreadListProps = {
  threads: ForumThreadSummary[];
  boardSlug: ForumBoardSlug;
  loading?: boolean;
  authorDisplay?: Map<number, NftDisplayIdentity>;
};

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

export function ForumThreadList({
  threads,
  boardSlug,
  loading,
  authorDisplay,
}: ForumThreadListProps) {
  const { t, locale } = useGameI18n();
  const gameHref = useGameHref();
  const boardLabel = t.forum.boards[boardSlug];

  if (loading) {
    return (
      <PixelPanel title={t.forum.threadsTitle} eyebrow={boardLabel}>
        <p className="text-sm text-[var(--hg-muted)]">{t.common.loading}</p>
      </PixelPanel>
    );
  }

  if (threads.length === 0) {
    return (
      <PixelPanel title={t.forum.threadsTitle} eyebrow={boardLabel}>
        <p className="text-sm text-[var(--hg-muted)]">{t.forum.emptyThreads}</p>
      </PixelPanel>
    );
  }

  return (
    <PixelPanel title={t.forum.threadsTitle} eyebrow={boardLabel}>
      <ul className="divide-y divide-[#f0c44a]/10">
        {threads.map((thread) => {
          const display = authorDisplay?.get(thread.tokenId);
          return (
          <li key={thread.id} className="py-3 first:pt-0 last:pb-0">
            <div className="rounded border border-transparent px-1 py-1 transition-colors hover:border-[#f0c44a]/20 hover:bg-[#0e121c]/40">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`${gameHref.forum}/${thread.id}`}
                    className="block hover:underline"
                  >
                    <h2 className="truncate text-sm font-semibold text-[#f0c44a]">
                      {thread.title}
                    </h2>
                  </Link>
                  <p className="mt-1 text-xs text-[var(--hg-muted)]">
                    {t.forum.metaLine(
                      formatWhen(thread.createdAt, locale),
                      thread.replyCount,
                      thread.likeCount,
                    )}
                  </p>
                  <div className="mt-2">
                    <ForumLikeButton
                      targetType="thread"
                      targetId={thread.id}
                      initialCount={thread.likeCount}
                      initialLiked={thread.viewerLiked}
                      compact
                    />
                  </div>
                </div>
                <ForumIdentityBadge
                  tokenId={thread.tokenId}
                  authorAddress={thread.authorAddress}
                  image={display?.image}
                  side={display?.side}
                  gameplayClass={display?.gameplayClass}
                  compact
                />
              </div>
            </div>
          </li>
          );
        })}
      </ul>
    </PixelPanel>
  );
}
