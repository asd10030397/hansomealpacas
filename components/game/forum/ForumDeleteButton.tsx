"use client";

import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useForumDelete } from "@/hooks/game/useForumDelete";
import type { ForumAuthAction } from "@/lib/game/forum/types";

type ForumDeleteButtonProps = {
  action: Extract<ForumAuthAction, "delete-thread" | "delete-reply">;
  threadId: string;
  replyId?: string;
  compact?: boolean;
  onDeleted?: () => void;
};

export function ForumDeleteButton({
  action,
  threadId,
  replyId,
  compact = false,
  onDeleted,
}: ForumDeleteButtonProps) {
  const { t } = useGameI18n();
  const { remove, isDeleting } = useForumDelete();

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmMessage =
      action === "delete-thread" ? t.forum.deleteThreadConfirm : t.forum.deleteReplyConfirm;
    if (!window.confirm(confirmMessage)) return;

    const result =
      action === "delete-thread"
        ? await remove({ action, threadId })
        : await remove({ action, threadId, replyId: replyId! });

    if (result.ok) {
      onDeleted?.();
    }
  };

  const sizeClass = compact ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-xs";

  return (
    <button
      type="button"
      onClick={(e) => void handleClick(e)}
      disabled={isDeleting}
      aria-label={t.forum.delete}
      title={t.forum.deleteSignHint}
      className={`inline-flex items-center gap-1.5 rounded border border-red-400/25 bg-red-950/20 text-red-300 transition-colors hover:border-red-400/50 hover:bg-red-950/40 disabled:opacity-50 ${sizeClass}`}
    >
      {isDeleting ? t.forum.deleting : t.forum.delete}
    </button>
  );
}
