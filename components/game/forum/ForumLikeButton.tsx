"use client";

import { useEffect, useState } from "react";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useForumLike } from "@/hooks/game/useForumLike";
import type { ForumLikeTargetType } from "@/lib/game/forum/types";

type ForumLikeButtonProps = {
  targetType: ForumLikeTargetType;
  targetId: string;
  initialCount: number;
  initialLiked?: boolean;
  compact?: boolean;
  onToggled?: (liked: boolean, likeCount: number) => void;
};

export function ForumLikeButton({
  targetType,
  targetId,
  initialCount,
  initialLiked = false,
  compact = false,
  onToggled,
}: ForumLikeButtonProps) {
  const { t } = useGameI18n();
  const { toggle, isToggling } = useForumLike();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setLiked(initialLiked);
    setCount(initialCount);
  }, [initialLiked, initialCount, targetId]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const result = await toggle(targetType, targetId);
    if (result.ok) {
      setLiked(result.liked);
      setCount(result.likeCount);
      onToggled?.(result.liked, result.likeCount);
    }
  };

  const label = liked ? t.forum.unlike : t.forum.like;
  const sizeClass = compact ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-xs";

  return (
    <button
      type="button"
      onClick={(e) => void handleClick(e)}
      disabled={isToggling}
      aria-pressed={liked}
      aria-label={`${label} (${t.forum.likeCountLabel(count)})`}
      title={t.forum.likeSignHint}
      className={`inline-flex items-center gap-1.5 rounded border transition-colors ${sizeClass} ${
        liked
          ? "border-[#f0c44a] bg-[#f0c44a]/15 text-[#f0c44a]"
          : "border-[#f0c44a]/20 bg-[#1a1520]/50 text-[var(--hg-muted)] hover:border-[#f0c44a]/40 hover:text-[#f0c44a]"
      } disabled:opacity-50`}
    >
      <span aria-hidden="true">{liked ? "♥" : "♡"}</span>
      <span>{t.forum.likeCountLabel(count)}</span>
    </button>
  );
}
