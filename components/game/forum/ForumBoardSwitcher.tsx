"use client";

import Link from "next/link";
import {
  FORUM_BOARD_BUGS,
  FORUM_BOARD_TACTICS,
  type ForumBoardSlug,
} from "@/lib/game/forum/types";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";

type ForumBoardSwitcherProps = {
  activeBoard: ForumBoardSlug;
};

const BOARD_ORDER = [FORUM_BOARD_TACTICS, FORUM_BOARD_BUGS] as const;

export function ForumBoardSwitcher({ activeBoard }: ForumBoardSwitcherProps) {
  const { t } = useGameI18n();
  const gameHref = useGameHref();

  return (
    <div
      className="mt-4 flex flex-wrap gap-2"
      role="tablist"
      aria-label={t.forum.boardSwitcherAria}
    >
      {BOARD_ORDER.map((slug) => {
        const active = slug === activeBoard;
        const label = t.forum.boards[slug];
        return (
          <Link
            key={slug}
            href={`${gameHref.forum}?board=${slug}`}
            role="tab"
            aria-selected={active}
            className={`rounded border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              active
                ? "border-[#f0c44a] bg-[#f0c44a]/15 text-[#f0c44a]"
                : "border-[#f0c44a]/25 bg-[#1a1520]/50 text-[var(--hg-muted)] hover:border-[#f0c44a]/45 hover:text-[#f0c44a]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
