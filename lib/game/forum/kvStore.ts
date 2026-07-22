import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import {
  countForumLikes,
  normalizeForumStore,
  viewerHasForumLiked,
  visibleForumThreads,
} from "@/lib/game/forum/forumStoreHelpers";
import { readForumJsonStoreFile } from "@/lib/game/forum/jsonStore";
import { deriveForumTitle, sanitizeForumText } from "@/lib/game/forum/sanitize";
import {
  FORUM_KV_KEYS,
  type ForumKvMeta,
} from "@/lib/game/forum/storageConfig";
import type {
  ForumBoardSlug,
  ForumLike,
  ForumLikeTargetType,
  ForumPublicReply,
  ForumReply,
  ForumStoreData,
  ForumThread,
  ForumThreadDetail,
  ForumThreadSummary,
} from "@/lib/game/forum/types";
import {
  DEFAULT_FORUM_BOARD_SLUG,
  FORUM_BOARD_SLUGS,
  FORUM_LIMITS,
} from "@/lib/game/forum/types";

type ForumKvClient = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  mget<T extends unknown[]>(...keys: string[]): Promise<T>;
};

let kvClient: ForumKvClient | null | undefined;
let migrationPromise: Promise<void> | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function getKv(): Promise<ForumKvClient> {
  if (kvClient !== undefined && kvClient !== null) return kvClient;
  const { kv } = await import("@vercel/kv");
  kvClient = kv as ForumKvClient;
  return kvClient;
}

function withKvWriteChain<T>(fn: () => Promise<T>): Promise<T> {
  const run = () => fn();
  const queued = writeChain.then(run, run);
  writeChain = queued.then(
    () => undefined,
    () => undefined,
  );
  return queued;
}

async function ensureForumKvMigrated(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = migrateForumJsonToKvOnce();
  }
  await migrationPromise;
}

function boardThreadIdsFromStore(data: ForumStoreData, board: string): string[] {
  return visibleForumThreads(data.threads)
    .filter((t) => t.boardSlug === board)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((t) => t.id);
}

function replyIdsForThread(data: ForumStoreData, threadId: string): string[] {
  return data.replies
    .filter((r) => r.threadId === threadId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((r) => r.id);
}

function likesForTarget(
  data: ForumStoreData,
  targetType: ForumLikeTargetType,
  targetId: string,
): ForumLike[] {
  return (data.likes ?? []).filter(
    (l) => l.targetType === targetType && l.targetId === targetId,
  );
}

async function writeStoreDataToKv(kv: ForumKvClient, data: ForumStoreData): Promise<void> {
  const normalized = normalizeForumStore(data);

  for (const board of FORUM_BOARD_SLUGS) {
    await kv.set(FORUM_KV_KEYS.boardThreads(board), boardThreadIdsFromStore(normalized, board));
  }

  for (const thread of normalized.threads) {
    await kv.set(FORUM_KV_KEYS.thread(thread.id), thread);
    await kv.set(
      FORUM_KV_KEYS.threadReplies(thread.id),
      replyIdsForThread(normalized, thread.id),
    );
  }

  for (const reply of normalized.replies) {
    await kv.set(FORUM_KV_KEYS.reply(reply.id), reply);
  }

  const likeTargets = new Set<string>();
  for (const like of normalized.likes ?? []) {
    likeTargets.add(`${like.targetType}:${like.targetId}`);
  }
  for (const targetKey of likeTargets) {
    const [targetType, targetId] = targetKey.split(":");
    await kv.set(
      FORUM_KV_KEYS.likes(targetType, targetId),
      likesForTarget(normalized, targetType as ForumLikeTargetType, targetId),
    );
  }

  for (const [address, ts] of Object.entries(normalized.cooldowns)) {
    await kv.set(FORUM_KV_KEYS.cooldown(address), ts);
  }

  for (const nonce of normalized.nonces) {
    const ttlSec = Math.max(1, Math.ceil((nonce.expiresAt - Date.now()) / 1000));
    await kv.set(FORUM_KV_KEYS.nonce(nonce.address), nonce, { ex: ttlSec });
  }
}

async function migrateForumJsonToKvOnce(): Promise<void> {
  const kv = await getKv();
  const meta = await kv.get<ForumKvMeta>(FORUM_KV_KEYS.meta);
  if (meta?.migratedFromJson) return;

  const hasKvThreads = await Promise.all(
    FORUM_BOARD_SLUGS.map(async (board) => {
      const ids = await kv.get<string[]>(FORUM_KV_KEYS.boardThreads(board));
      return (ids?.length ?? 0) > 0;
    }),
  );
  if (hasKvThreads.some(Boolean)) {
    if (!meta) {
      await kv.set(FORUM_KV_KEYS.meta, {
        version: 1,
        initializedAt: new Date().toISOString(),
      });
    }
    return;
  }

  const jsonData = await readForumJsonStoreFile();
  if (!jsonData) {
    await kv.set(FORUM_KV_KEYS.meta, {
      version: 1,
      initializedAt: new Date().toISOString(),
    });
    return;
  }

  await writeStoreDataToKv(kv, jsonData);
  await kv.set(FORUM_KV_KEYS.meta, {
    version: 1,
    migratedFromJson: true,
    migratedAt: new Date().toISOString(),
  });
}

async function getLikes(
  kv: ForumKvClient,
  targetType: ForumLikeTargetType,
  targetId: string,
): Promise<ForumLike[]> {
  return (await kv.get<ForumLike[]>(FORUM_KV_KEYS.likes(targetType, targetId))) ?? [];
}

async function setLikes(
  kv: ForumKvClient,
  targetType: ForumLikeTargetType,
  targetId: string,
  likes: ForumLike[],
): Promise<void> {
  if (likes.length === 0) {
    await kv.del(FORUM_KV_KEYS.likes(targetType, targetId));
    return;
  }
  await kv.set(FORUM_KV_KEYS.likes(targetType, targetId), likes);
}

export async function listForumThreads(
  boardSlug: ForumBoardSlug = DEFAULT_FORUM_BOARD_SLUG,
  viewerAddress?: string,
): Promise<ForumThreadSummary[]> {
  return withKvWriteChain(async () => {
    await ensureForumKvMigrated();
    const kv = await getKv();
    const threadIds =
      (await kv.get<string[]>(FORUM_KV_KEYS.boardThreads(boardSlug))) ?? [];
    if (threadIds.length === 0) return [];

    const threadKeys = threadIds.map((id) => FORUM_KV_KEYS.thread(id));
    const threads = (await kv.mget<ForumThread[]>(...threadKeys)).filter(
      (t): t is ForumThread => Boolean(t) && !t.hidden,
    );

    const sorted = threads
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, FORUM_LIMITS.listLimit);

    const summaries: ForumThreadSummary[] = [];
    for (const { id, boardSlug: slug, title, authorAddress, tokenId, createdAt, replyCount } of sorted) {
      const likes = await getLikes(kv, "thread", id);
      summaries.push({
        id,
        boardSlug: slug,
        title,
        authorAddress,
        tokenId,
        createdAt,
        replyCount,
        likeCount: countForumLikes(likes, "thread", id),
        viewerLiked: viewerHasForumLiked(likes, "thread", id, viewerAddress),
      });
    }
    return summaries;
  });
}

export async function getForumThread(
  threadId: string,
  viewerAddress?: string,
): Promise<{ thread: ForumThreadDetail; replies: ForumPublicReply[] } | null> {
  return withKvWriteChain(async () => {
    await ensureForumKvMigrated();
    const kv = await getKv();
    const thread = await kv.get<ForumThread>(FORUM_KV_KEYS.thread(threadId));
    if (!thread || thread.hidden) return null;

    const threadLikes = await getLikes(kv, "thread", threadId);
    const replyIds =
      (await kv.get<string[]>(FORUM_KV_KEYS.threadReplies(threadId))) ?? [];
    const replyKeys = replyIds.map((id) => FORUM_KV_KEYS.reply(id));
    const replyRows =
      replyKeys.length > 0
        ? (await kv.mget<ForumReply[]>(...replyKeys)).filter(
            (r): r is ForumReply => Boolean(r) && !r.hidden,
          )
        : [];

    const replies: ForumPublicReply[] = [];
    for (const { id, threadId: tid, body, authorAddress, tokenId, createdAt } of replyRows.sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt),
    )) {
      const likes = await getLikes(kv, "reply", id);
      replies.push({
        id,
        threadId: tid,
        body,
        authorAddress,
        tokenId,
        createdAt,
        likeCount: countForumLikes(likes, "reply", id),
        viewerLiked: viewerHasForumLiked(likes, "reply", id, viewerAddress),
      });
    }

    return {
      thread: {
        ...thread,
        likeCount: countForumLikes(threadLikes, "thread", thread.id),
        viewerLiked: viewerHasForumLiked(threadLikes, "thread", thread.id, viewerAddress),
      },
      replies,
    };
  });
}

export async function issueForumNonce(address: string): Promise<{
  nonce: string;
  expiresAt: number;
}> {
  return withKvWriteChain(async () => {
    await ensureForumKvMigrated();
    const kv = await getKv();
    const normalized = address.toLowerCase();
    const nonce = randomBytes(16).toString("hex");
    const expiresAt = Date.now() + FORUM_LIMITS.nonceTtlMs;
    const ttlSec = Math.max(1, Math.ceil(FORUM_LIMITS.nonceTtlMs / 1000));

    await kv.set(
      FORUM_KV_KEYS.nonce(normalized),
      { address: normalized, nonce, expiresAt },
      { ex: ttlSec },
    );

    return { nonce, expiresAt };
  });
}

export async function consumeForumNonce(
  address: string,
  nonce: string,
): Promise<boolean> {
  return withKvWriteChain(async () => {
    await ensureForumKvMigrated();
    const kv = await getKv();
    const normalized = address.toLowerCase();
    const key = FORUM_KV_KEYS.nonce(normalized);
    const stored = await kv.get<{ address: string; nonce: string; expiresAt: number }>(key);
    if (!stored || stored.nonce !== nonce || stored.expiresAt <= Date.now()) {
      return false;
    }
    await kv.del(key);
    return true;
  });
}

export async function checkForumCooldown(address: string): Promise<{
  allowed: boolean;
  retryAfterMs: number;
}> {
  return withKvWriteChain(async () => {
    await ensureForumKvMigrated();
    const kv = await getKv();
    const last =
      (await kv.get<number>(FORUM_KV_KEYS.cooldown(address.toLowerCase()))) ?? 0;
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
  const kv = await getKv();
  await kv.set(FORUM_KV_KEYS.cooldown(address.toLowerCase()), Date.now());
}

export async function createForumThread(input: {
  boardSlug: ForumBoardSlug;
  title?: string;
  body: string;
  authorAddress: string;
  tokenId: number;
}): Promise<ForumThread> {
  return withKvWriteChain(async () => {
    await ensureForumKvMigrated();
    const kv = await getKv();

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

    const boardKey = FORUM_KV_KEYS.boardThreads(input.boardSlug);
    const boardIds = (await kv.get<string[]>(boardKey)) ?? [];
    await kv.set(boardKey, [thread.id, ...boardIds]);
    await kv.set(FORUM_KV_KEYS.thread(thread.id), thread);
    await kv.set(FORUM_KV_KEYS.threadReplies(thread.id), []);
    await touchForumCooldown(input.authorAddress);
    return thread;
  });
}

export async function createForumReply(input: {
  threadId: string;
  body: string;
  authorAddress: string;
  tokenId: number;
}): Promise<ForumReply> {
  return withKvWriteChain(async () => {
    await ensureForumKvMigrated();
    const kv = await getKv();

    const body = sanitizeForumText(input.body, FORUM_LIMITS.maxBody);
    if (!body) {
      throw new Error("INVALID_CONTENT");
    }

    const thread = await kv.get<ForumThread>(FORUM_KV_KEYS.thread(input.threadId));
    if (!thread || thread.hidden) {
      throw new Error("THREAD_NOT_FOUND");
    }

    const reply: ForumReply = {
      id: randomUUID(),
      threadId: input.threadId,
      body,
      authorAddress: input.authorAddress.toLowerCase(),
      tokenId: input.tokenId,
      createdAt: new Date().toISOString(),
    };

    const replyListKey = FORUM_KV_KEYS.threadReplies(input.threadId);
    const replyIds = (await kv.get<string[]>(replyListKey)) ?? [];
    await kv.set(replyListKey, [...replyIds, reply.id]);
    await kv.set(FORUM_KV_KEYS.reply(reply.id), reply);
    await kv.set(FORUM_KV_KEYS.thread(input.threadId), {
      ...thread,
      replyCount: thread.replyCount + 1,
    });
    await touchForumCooldown(input.authorAddress);
    return reply;
  });
}

export async function toggleForumLike(input: {
  targetType: ForumLikeTargetType;
  targetId: string;
  address: string;
}): Promise<{ liked: boolean; likeCount: number }> {
  return withKvWriteChain(async () => {
    await ensureForumKvMigrated();
    const kv = await getKv();
    const normalized = input.address.toLowerCase();

    if (input.targetType === "thread") {
      const thread = await kv.get<ForumThread>(FORUM_KV_KEYS.thread(input.targetId));
      if (!thread || thread.hidden) throw new Error("TARGET_NOT_FOUND");
    } else {
      const reply = await kv.get<ForumReply>(FORUM_KV_KEYS.reply(input.targetId));
      if (!reply || reply.hidden) throw new Error("TARGET_NOT_FOUND");
    }

    const likes = await getLikes(kv, input.targetType, input.targetId);
    const idx = likes.findIndex(
      (l) => l.targetType === input.targetType && l.address === normalized,
    );

    let liked = false;
    if (idx === -1) {
      likes.push({
        targetType: input.targetType,
        targetId: input.targetId,
        address: normalized,
        createdAt: new Date().toISOString(),
      });
      liked = true;
    } else {
      likes.splice(idx, 1);
      liked = false;
    }

    await setLikes(kv, input.targetType, input.targetId, likes);
    return { liked, likeCount: likes.length };
  });
}

export async function hideForumThread(input: {
  threadId: string;
  authorAddress: string;
}): Promise<void> {
  return withKvWriteChain(async () => {
    await ensureForumKvMigrated();
    const kv = await getKv();
    const normalized = input.authorAddress.toLowerCase();
    const thread = await kv.get<ForumThread>(FORUM_KV_KEYS.thread(input.threadId));
    if (!thread || thread.hidden) throw new Error("THREAD_NOT_FOUND");
    if (thread.authorAddress !== normalized) throw new Error("NOT_AUTHOR");
    await kv.set(FORUM_KV_KEYS.thread(input.threadId), { ...thread, hidden: true });
  });
}

export async function hideForumReply(input: {
  replyId: string;
  threadId?: string;
  authorAddress: string;
}): Promise<void> {
  return withKvWriteChain(async () => {
    await ensureForumKvMigrated();
    const kv = await getKv();
    const normalized = input.authorAddress.toLowerCase();
    const reply = await kv.get<ForumReply>(FORUM_KV_KEYS.reply(input.replyId));
    if (!reply || reply.hidden) throw new Error("REPLY_NOT_FOUND");
    if (input.threadId && reply.threadId !== input.threadId) {
      throw new Error("REPLY_NOT_FOUND");
    }
    if (reply.authorAddress !== normalized) throw new Error("NOT_AUTHOR");

    await kv.set(FORUM_KV_KEYS.reply(input.replyId), { ...reply, hidden: true });

    const thread = await kv.get<ForumThread>(FORUM_KV_KEYS.thread(reply.threadId));
    if (thread && thread.replyCount > 0) {
      await kv.set(FORUM_KV_KEYS.thread(reply.threadId), {
        ...thread,
        replyCount: thread.replyCount - 1,
      });
    }
  });
}
