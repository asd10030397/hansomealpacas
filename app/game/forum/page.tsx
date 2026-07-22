"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { ForumBoardSwitcher } from "@/components/game/forum/ForumBoardSwitcher";
import { ForumComposer } from "@/components/game/forum/ForumComposer";
import { ForumThreadList } from "@/components/game/forum/ForumThreadList";
import { PixelPanel } from "@/components/ui/pixel";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useOwnedGenesisNfts } from "@/hooks/game/useOwnedGenesisNfts";
import { useForumAuthorDisplayMap } from "@/hooks/game/useForumAuthorDisplayMap";
import { parseForumBoardSlug, type ForumThreadSummary } from "@/lib/game/forum/types";
import { isGenesisConfigured } from "@/lib/game/genesis";

export default function ForumPage() {
  const { t } = useGameI18n();
  const gameHref = useGameHref();
  const router = useRouter();
  const searchParams = useSearchParams();
  const boardSlug = parseForumBoardSlug(searchParams.get("board"));
  const { address } = useAccount();
  const owned = useOwnedGenesisNfts();
  const [threads, setThreads] = useState<ForumThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const forumTokenIds = useMemo(
    () => threads.map((thread) => thread.tokenId),
    [threads],
  );
  const authorDisplay = useForumAuthorDisplayMap(forumTokenIds, owned.nfts);

  const refreshThreads = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const query = address ? `&address=${encodeURIComponent(address)}` : "";
      const res = await fetch(`/api/game/forum/threads?board=${boardSlug}${query}`);
      const json = (await res.json()) as {
        ok?: boolean;
        threads?: ForumThreadSummary[];
        error?: string;
      };
      if (!res.ok || !json.ok || !json.threads) {
        setLoadError(json.error ?? t.forum.loadError);
        setThreads([]);
        return;
      }
      setThreads(json.threads);
    } catch {
      setLoadError(t.forum.loadError);
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [address, boardSlug, t.forum.loadError]);

  useEffect(() => {
    void refreshThreads();
  }, [refreshThreads]);

  return (
    <div className="mx-auto max-w-3xl px-3 py-6">
      {!isGenesisConfigured() ? (
        <p className="mock-chip mb-3">{t.common.demoBanner}</p>
      ) : null}

      <div>
        <h1 className="pixel-title text-lg text-[#f0c44a]">{t.forum.heading}</h1>
        <p className="mt-2 text-sm text-[var(--hg-muted)]">{t.forum.blurb}</p>
        <p className="mt-2 rounded border border-[#f0c44a]/20 bg-[#0e121c]/60 px-3 py-2 text-xs text-[#f0c44a]/90">
          {t.forum.bugReportNotice}
        </p>
        <p className="mt-2 text-xs text-[var(--hg-muted)]">{t.forum.gateNote}</p>
      </div>

      <ForumBoardSwitcher activeBoard={boardSlug} />

      <div className="mt-4 space-y-4">
        <ForumComposer
          mode="create-thread"
          boardSlug={boardSlug}
          nfts={owned.nfts}
          isConnected={owned.isConnected}
          configured={owned.configured}
          onSuccess={(id) => {
            void refreshThreads();
            router.push(`${gameHref.forum}/${id}`);
          }}
        />

        {loadError ? (
          <PixelPanel title={t.common.unavailableTitle} eyebrow={t.forum.boards[boardSlug]}>
            <p className="text-sm text-red-300">{loadError}</p>
          </PixelPanel>
        ) : (
          <ForumThreadList
            threads={threads}
            boardSlug={boardSlug}
            loading={loading}
            authorDisplay={authorDisplay}
          />
        )}
      </div>
    </div>
  );
}
