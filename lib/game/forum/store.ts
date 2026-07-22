import "server-only";

/**
 * Forum persistence facade — Vercel KV in production when configured,
 * JSON file fallback for local dev / CI without KV env vars.
 */

import { isForumKvConfigured } from "@/lib/game/forum/storageConfig";
import * as jsonStore from "@/lib/game/forum/jsonStore";
import * as kvStore from "@/lib/game/forum/kvStore";
import type {
  ForumBoardSlug,
  ForumLikeTargetType,
  ForumPublicReply,
  ForumReply,
  ForumThread,
  ForumThreadDetail,
  ForumThreadSummary,
} from "@/lib/game/forum/types";

function backend() {
  return isForumKvConfigured() ? kvStore : jsonStore;
}

export async function listForumThreads(
  boardSlug?: ForumBoardSlug,
  viewerAddress?: string,
): Promise<ForumThreadSummary[]> {
  return backend().listForumThreads(boardSlug, viewerAddress);
}

export async function getForumThread(
  threadId: string,
  viewerAddress?: string,
): Promise<{ thread: ForumThreadDetail; replies: ForumPublicReply[] } | null> {
  return backend().getForumThread(threadId, viewerAddress);
}

export async function issueForumNonce(address: string): Promise<{
  nonce: string;
  expiresAt: number;
}> {
  return backend().issueForumNonce(address);
}

export async function consumeForumNonce(
  address: string,
  nonce: string,
): Promise<boolean> {
  return backend().consumeForumNonce(address, nonce);
}

export async function checkForumCooldown(address: string): Promise<{
  allowed: boolean;
  retryAfterMs: number;
}> {
  return backend().checkForumCooldown(address);
}

export async function createForumThread(input: {
  boardSlug: ForumBoardSlug;
  title?: string;
  body: string;
  authorAddress: string;
  tokenId: number;
}): Promise<ForumThread> {
  return backend().createForumThread(input);
}

export async function createForumReply(input: {
  threadId: string;
  body: string;
  authorAddress: string;
  tokenId: number;
}): Promise<ForumReply> {
  return backend().createForumReply(input);
}

export async function toggleForumLike(input: {
  targetType: ForumLikeTargetType;
  targetId: string;
  address: string;
}): Promise<{ liked: boolean; likeCount: number }> {
  return backend().toggleForumLike(input);
}

export async function hideForumThread(input: {
  threadId: string;
  authorAddress: string;
}): Promise<void> {
  return backend().hideForumThread(input);
}

export async function hideForumReply(input: {
  replyId: string;
  threadId?: string;
  authorAddress: string;
}): Promise<void> {
  return backend().hideForumReply(input);
}
