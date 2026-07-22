import "server-only";

import path from "node:path";

/** JSON file path — local dev fallback only; ignored when KV is configured. */
export const FORUM_JSON_STORE_PATH =
  process.env.FORUM_STORE_PATH?.trim() ||
  path.join(process.cwd(), "data", "forum", "store.json");

export function isForumKvConfigured(): boolean {
  const url =
    process.env.KV_REST_API_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    "";
  const token =
    process.env.KV_REST_API_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    "";
  return Boolean(url && token);
}

export type ForumKvMeta = {
  version: 1;
  migratedFromJson?: boolean;
  migratedAt?: string;
  initializedAt?: string;
};

export const FORUM_KV_KEYS = {
  meta: "forum:meta",
  boardThreads: (board: string) => `forum:threads:${board}`,
  thread: (id: string) => `forum:thread:${id}`,
  threadReplies: (threadId: string) => `forum:replies:${threadId}`,
  reply: (id: string) => `forum:reply:${id}`,
  likes: (targetType: string, targetId: string) =>
    `forum:likes:${targetType}:${targetId}`,
  nonce: (address: string) => `forum:nonce:${address.toLowerCase()}`,
  cooldown: (address: string) => `forum:cooldown:${address.toLowerCase()}`,
} as const;
