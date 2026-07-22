/** MVP forum — tactics + bug report boards. */

export const FORUM_BOARD_TACTICS = "tactics" as const;
export const FORUM_BOARD_BUGS = "bugs" as const;

export const FORUM_BOARD_SLUGS = [FORUM_BOARD_TACTICS, FORUM_BOARD_BUGS] as const;

export type ForumBoardSlug = (typeof FORUM_BOARD_SLUGS)[number];

/** Default board on `/game/forum` when no `?board=` query. */
export const DEFAULT_FORUM_BOARD_SLUG: ForumBoardSlug = FORUM_BOARD_TACTICS;

/** @deprecated Use `DEFAULT_FORUM_BOARD_SLUG` or a specific slug constant. */
export const FORUM_BOARD_SLUG = DEFAULT_FORUM_BOARD_SLUG;

export function isForumBoardSlug(value: string): value is ForumBoardSlug {
  return (FORUM_BOARD_SLUGS as readonly string[]).includes(value);
}

export function parseForumBoardSlug(
  value: string | null | undefined,
  fallback: ForumBoardSlug = DEFAULT_FORUM_BOARD_SLUG,
): ForumBoardSlug {
  const trimmed = (value ?? "").trim();
  return isForumBoardSlug(trimmed) ? trimmed : fallback;
}

export type ForumThread = {
  id: string;
  boardSlug: ForumBoardSlug;
  title: string;
  body: string;
  authorAddress: string;
  tokenId: number;
  createdAt: string;
  replyCount: number;
  /** Reserved for future moderation — hidden threads omitted from public list. */
  hidden?: boolean;
};

export type ForumReply = {
  id: string;
  threadId: string;
  body: string;
  authorAddress: string;
  tokenId: number;
  createdAt: string;
  hidden?: boolean;
};

export type ForumAuthNonce = {
  address: string;
  nonce: string;
  expiresAt: number;
};

export type ForumLikeTargetType = "thread" | "reply";

export type ForumLike = {
  targetType: ForumLikeTargetType;
  targetId: string;
  /** lowercase wallet address */
  address: string;
  createdAt: string;
};

export type ForumStoreData = {
  version: 1;
  threads: ForumThread[];
  replies: ForumReply[];
  nonces: ForumAuthNonce[];
  /** address (lowercase) → last post unix ms */
  cooldowns: Record<string, number>;
  /** Optional for legacy stores — defaults to [] on read. */
  likes?: ForumLike[];
};

export const FORUM_LIMITS = {
  maxTitle: 120,
  maxBody: 4000,
  cooldownMs: 30_000,
  nonceTtlMs: 5 * 60_000,
  listLimit: 50,
} as const;

export type ForumAuthAction =
  | "create-thread"
  | "create-reply"
  | "toggle-like"
  | "delete-thread"
  | "delete-reply";

export type ForumThreadSummary = Pick<
  ForumThread,
  "id" | "boardSlug" | "title" | "authorAddress" | "tokenId" | "createdAt" | "replyCount"
> & {
  likeCount: number;
  viewerLiked?: boolean;
};

export type ForumPublicReply = Pick<
  ForumReply,
  "id" | "threadId" | "body" | "authorAddress" | "tokenId" | "createdAt"
> & {
  likeCount: number;
  viewerLiked?: boolean;
};

export type ForumThreadDetail = ForumThread & {
  likeCount: number;
  viewerLiked?: boolean;
};
