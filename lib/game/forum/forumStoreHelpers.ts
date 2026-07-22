import type {
  ForumAuthNonce,
  ForumLike,
  ForumLikeTargetType,
  ForumStoreData,
  ForumThread,
} from "@/lib/game/forum/types";

export function emptyForumStore(): ForumStoreData {
  return {
    version: 1,
    threads: [],
    replies: [],
    nonces: [],
    cooldowns: {},
    likes: [],
  };
}

export function normalizeForumStore(parsed: ForumStoreData): ForumStoreData {
  return {
    version: 1,
    threads: parsed.threads ?? [],
    replies: parsed.replies ?? [],
    nonces: parsed.nonces ?? [],
    cooldowns: parsed.cooldowns ?? {},
    likes: parsed.likes ?? [],
  };
}

export function countForumLikes(
  likes: ForumLike[],
  targetType: ForumLikeTargetType,
  targetId: string,
): number {
  return likes.filter((l) => l.targetType === targetType && l.targetId === targetId)
    .length;
}

export function viewerHasForumLiked(
  likes: ForumLike[],
  targetType: ForumLikeTargetType,
  targetId: string,
  viewerAddress?: string,
): boolean {
  if (!viewerAddress) return false;
  const normalized = viewerAddress.toLowerCase();
  return likes.some(
    (l) =>
      l.targetType === targetType &&
      l.targetId === targetId &&
      l.address === normalized,
  );
}

export function pruneForumNonces(nonces: ForumAuthNonce[]): ForumAuthNonce[] {
  const now = Date.now();
  return nonces.filter((n) => n.expiresAt > now);
}

export function visibleForumThreads(threads: ForumThread[]): ForumThread[] {
  return threads.filter((t) => !t.hidden);
}
