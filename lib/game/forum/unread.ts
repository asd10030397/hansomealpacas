import { FORUM_BOARD_SLUGS } from "@/lib/game/forum/types";

export const FORUM_LAST_SEEN_KEY = "hansome.forum.lastSeenAt";
export const FORUM_SEEN_EVENT = "hansome-forum-seen";

export const FORUM_NAV_GLOW_CLASS = "game-nav__link--forum-glow";
export const FORUM_MOBILE_NAV_GLOW_CLASS = "game-nav__mobile-link--forum-glow";
export const FORUM_DOCK_GLOW_CLASS = "mobile-dock__sheet-link--forum-glow";
export const FORUM_DOCK_MORE_GLOW_CLASS = "mobile-dock__item--forum-glow";

function canUseLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}

export function getForumLastSeenAt(): string | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(FORUM_LAST_SEEN_KEY);
    if (!raw?.trim()) return null;
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? raw : null;
  } catch {
    return null;
  }
}

export function setForumLastSeenAt(iso: string): void {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(FORUM_LAST_SEEN_KEY, iso);
  } catch {
    /* ignore quota / private mode */
  }
}

export function markForumSeen(activityAt?: string): void {
  const ts = activityAt ?? new Date().toISOString();
  setForumLastSeenAt(ts);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(FORUM_SEEN_EVENT));
  }
}

/** True only after the user has visited the forum at least once. */
export function hasUnreadForum(lastSeen: string | null, newestAt: string | null): boolean {
  if (!lastSeen) return false;
  if (!newestAt) return false;
  return newestAt > lastSeen;
}

type ThreadCreatedAt = { createdAt: string };

export async function fetchNewestForumActivityAt(): Promise<string | null> {
  try {
    const lists = await Promise.all(
      FORUM_BOARD_SLUGS.map(async (board) => {
        const res = await fetch(`/api/game/forum/threads?board=${board}`, {
          cache: "no-store",
        });
        if (!res.ok) return [] as ThreadCreatedAt[];
        const json = (await res.json()) as {
          ok?: boolean;
          threads?: ThreadCreatedAt[];
        };
        if (!json.ok || !Array.isArray(json.threads)) return [];
        return json.threads;
      }),
    );

    let newest: string | null = null;
    for (const thread of lists.flat()) {
      if (!thread.createdAt) continue;
      if (!newest || thread.createdAt > newest) newest = thread.createdAt;
    }
    return newest;
  } catch {
    return null;
  }
}
