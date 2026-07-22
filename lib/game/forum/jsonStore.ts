import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import {
  countForumLikes,
  emptyForumStore,
  normalizeForumStore,
  pruneForumNonces,
  viewerHasForumLiked,
  visibleForumThreads,
} from "@/lib/game/forum/forumStoreHelpers";
import { FORUM_JSON_STORE_PATH } from "@/lib/game/forum/storageConfig";
import { deriveForumTitle, sanitizeForumText } from "@/lib/game/forum/sanitize";
import type {
  ForumBoardSlug,
  ForumLikeTargetType,
  ForumPublicReply,
  ForumReply,
  ForumStoreData,
  ForumThread,
  ForumThreadDetail,
  ForumThreadSummary,
} from "@/lib/game/forum/types";
import { DEFAULT_FORUM_BOARD_SLUG, FORUM_LIMITS } from "@/lib/game/forum/types";

let writeChain: Promise<void> = Promise.resolve();

async function readStore(): Promise<ForumStoreData> {
  try {
    const raw = await readFile(FORUM_JSON_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as ForumStoreData;
    if (parsed.version !== 1 || !Array.isArray(parsed.threads)) {
      return emptyForumStore();
    }
    return normalizeForumStore(parsed);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return emptyForumStore();
    throw e;
  }
}

async function writeStore(data: ForumStoreData): Promise<void> {
  const dir = path.dirname(FORUM_JSON_STORE_PATH);
  await mkdir(dir, { recursive: true });
  const tmp = `${FORUM_JSON_STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await rename(tmp, FORUM_JSON_STORE_PATH);
}

function withStore<T>(fn: (data: ForumStoreData) => T | Promise<T>): Promise<T> {
  const run = async () => {
    const data = await readStore();
    return fn(data);
  };
  const queued = writeChain.then(run, run);
  writeChain = queued.then(
    () => undefined,
    () => undefined,
  );
  return queued;
}

async function mutateStore(
  fn: (data: ForumStoreData) => void | Promise<void>,
): Promise<void> {
  await withStore(async (data) => {
    await fn(data);
    await writeStore(data);
  });
}

export async function listForumThreads(
  boardSlug: ForumBoardSlug = DEFAULT_FORUM_BOARD_SLUG,
  viewerAddress?: string,
): Promise<ForumThreadSummary[]> {
  return withStore((data) => {
    const likes = data.likes ?? [];
    return visibleForumThreads(data.threads)
      .filter((t) => t.boardSlug === boardSlug)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, FORUM_LIMITS.listLimit)
      .map(({ id, boardSlug: slug, title, authorAddress, tokenId, createdAt, replyCount }) => ({
        id,
        boardSlug: slug,
        title,
        authorAddress,
        tokenId,
        createdAt,
        replyCount,
        likeCount: countForumLikes(likes, "thread", id),
        viewerLiked: viewerHasForumLiked(likes, "thread", id, viewerAddress),
      }));
  });
}

export async function getForumThread(
  threadId: string,
  viewerAddress?: string,
): Promise<{ thread: ForumThreadDetail; replies: ForumPublicReply[] } | null> {
  return withStore((data) => {
    const thread = visibleForumThreads(data.threads).find((t) => t.id === threadId);
    if (!thread) return null;
    const likes = data.likes ?? [];
    const replies = data.replies
      .filter((r) => r.threadId === threadId && !r.hidden)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(({ id, threadId: tid, body, authorAddress, tokenId, createdAt }) => ({
        id,
        threadId: tid,
        body,
        authorAddress,
        tokenId,
        createdAt,
        likeCount: countForumLikes(likes, "reply", id),
        viewerLiked: viewerHasForumLiked(likes, "reply", id, viewerAddress),
      }));
    return {
      thread: {
        ...thread,
        likeCount: countForumLikes(likes, "thread", thread.id),
        viewerLiked: viewerHasForumLiked(likes, "thread", thread.id, viewerAddress),
      },
      replies,
    };
  });
}

export async function issueForumNonce(address: string): Promise<{
  nonce: string;
  expiresAt: number;
}> {
  const normalized = address.toLowerCase();
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = Date.now() + FORUM_LIMITS.nonceTtlMs;

  await mutateStore((data) => {
    data.nonces = pruneForumNonces(data.nonces).filter((n) => n.address !== normalized);
    data.nonces.push({ address: normalized, nonce, expiresAt });
  });

  return { nonce, expiresAt };
}

export async function consumeForumNonce(
  address: string,
  nonce: string,
): Promise<boolean> {
  const normalized = address.toLowerCase();
  let ok = false;

  await mutateStore((data) => {
    data.nonces = pruneForumNonces(data.nonces);
    const idx = data.nonces.findIndex(
      (n) => n.address === normalized && n.nonce === nonce,
    );
    if (idx === -1) return;
    data.nonces.splice(idx, 1);
    ok = true;
  });

  return ok;
}

export async function checkForumCooldown(address: string): Promise<{
  allowed: boolean;
  retryAfterMs: number;
}> {
  return withStore((data) => {
    const last = data.cooldowns[address.toLowerCase()] ?? 0;
    const elapsed = Date.now() - last;
    if (elapsed >= FORUM_LIMITS.cooldownMs) {
      return { allowed: true, retryAfterMs: 0 };
    }
    return {
      allowed: false,
      retryAfterMs: FORUM_LIMITS.cooldownMs - elapsed,
    };
  });
}

async function touchForumCooldown(address: string): Promise<void> {
  await mutateStore((data) => {
    data.cooldowns[address.toLowerCase()] = Date.now();
  });
}

export async function createForumThread(input: {
  boardSlug: ForumBoardSlug;
  title?: string;
  body: string;
  authorAddress: string;
  tokenId: number;
}): Promise<ForumThread> {
  const body = sanitizeForumText(input.body, FORUM_LIMITS.maxBody);
  const title = input.title?.trim()
    ? sanitizeForumText(input.title, FORUM_LIMITS.maxTitle)
    : deriveForumTitle(body, FORUM_LIMITS.maxTitle);
  if (!title || !body) {
    throw new Error("INVALID_CONTENT");
  }

  const thread: ForumThread = {
    id: randomUUID(),
    boardSlug: input.boardSlug,
    title,
    body,
    authorAddress: input.authorAddress.toLowerCase(),
    tokenId: input.tokenId,
    createdAt: new Date().toISOString(),
    replyCount: 0,
  };

  await mutateStore((data) => {
    data.threads.unshift(thread);
  });
  await touchForumCooldown(input.authorAddress);
  return thread;
}

export async function createForumReply(input: {
  threadId: string;
  body: string;
  authorAddress: string;
  tokenId: number;
}): Promise<ForumReply> {
  const body = sanitizeForumText(input.body, FORUM_LIMITS.maxBody);
  if (!body) {
    throw new Error("INVALID_CONTENT");
  }

  const reply: ForumReply = {
    id: randomUUID(),
    threadId: input.threadId,
    body,
    authorAddress: input.authorAddress.toLowerCase(),
    tokenId: input.tokenId,
    createdAt: new Date().toISOString(),
  };

  await mutateStore((data) => {
    const thread = data.threads.find((t) => t.id === input.threadId && !t.hidden);
    if (!thread) {
      throw new Error("THREAD_NOT_FOUND");
    }
    data.replies.push(reply);
    thread.replyCount += 1;
  });
  await touchForumCooldown(input.authorAddress);
  return reply;
}

export async function toggleForumLike(input: {
  targetType: ForumLikeTargetType;
  targetId: string;
  address: string;
}): Promise<{ liked: boolean; likeCount: number }> {
  const normalized = input.address.toLowerCase();
  let liked = false;
  let likeCount = 0;

  await mutateStore((data) => {
    if (!data.likes) data.likes = [];

    if (input.targetType === "thread") {
      const thread = data.threads.find((t) => t.id === input.targetId && !t.hidden);
      if (!thread) throw new Error("TARGET_NOT_FOUND");
    } else {
      const reply = data.replies.find((r) => r.id === input.targetId && !r.hidden);
      if (!reply) throw new Error("TARGET_NOT_FOUND");
    }

    const idx = data.likes.findIndex(
      (l) =>
        l.targetType === input.targetType &&
        l.targetId === input.targetId &&
        l.address === normalized,
    );

    if (idx === -1) {
      data.likes.push({
        targetType: input.targetType,
        targetId: input.targetId,
        address: normalized,
        createdAt: new Date().toISOString(),
      });
      liked = true;
    } else {
      data.likes.splice(idx, 1);
      liked = false;
    }

    likeCount = countForumLikes(data.likes, input.targetType, input.targetId);
  });

  return { liked, likeCount };
}

export async function hideForumThread(input: {
  threadId: string;
  authorAddress: string;
}): Promise<void> {
  const normalized = input.authorAddress.toLowerCase();

  await mutateStore((data) => {
    const thread = data.threads.find((t) => t.id === input.threadId && !t.hidden);
    if (!thread) throw new Error("THREAD_NOT_FOUND");
    if (thread.authorAddress !== normalized) throw new Error("NOT_AUTHOR");
    thread.hidden = true;
  });
}

export async function hideForumReply(input: {
  replyId: string;
  threadId?: string;
  authorAddress: string;
}): Promise<void> {
  const normalized = input.authorAddress.toLowerCase();

  await mutateStore((data) => {
    const reply = data.replies.find((r) => r.id === input.replyId && !r.hidden);
    if (!reply) throw new Error("REPLY_NOT_FOUND");
    if (input.threadId && reply.threadId !== input.threadId) {
      throw new Error("REPLY_NOT_FOUND");
    }
    if (reply.authorAddress !== normalized) throw new Error("NOT_AUTHOR");
    reply.hidden = true;
    const thread = data.threads.find((t) => t.id === reply.threadId);
    if (thread && thread.replyCount > 0) {
      thread.replyCount -= 1;
    }
  });
}

/** Used by KV migration — reads the JSON store file without mutating. */
export async function readForumJsonStoreFile(): Promise<ForumStoreData | null> {
  try {
    const raw = await readFile(FORUM_JSON_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as ForumStoreData;
    if (parsed.version !== 1 || !Array.isArray(parsed.threads)) {
      return emptyForumStore();
    }
    return normalizeForumStore(parsed);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return null;
    throw e;
  }
}
