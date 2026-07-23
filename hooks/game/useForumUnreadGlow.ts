"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useGameHref } from "@/hooks/game/useGameHref";
import {
  FORUM_SEEN_EVENT,
  fetchNewestForumActivityAt,
  getForumLastSeenAt,
  hasUnreadForum,
} from "@/lib/game/forum/unread";
import { isNavActive } from "@/lib/game/navActive";

const POLL_MS = 60_000;

export function useForumUnreadGlow(): boolean {
  const pathname = usePathname();
  const gameHref = useGameHref();
  const [showGlow, setShowGlow] = useState(false);

  const onForumRoute = isNavActive(pathname, gameHref.forum, gameHref.home);

  const refresh = useCallback(async () => {
    if (onForumRoute) {
      setShowGlow(false);
      return;
    }

    const lastSeen = getForumLastSeenAt();
    if (!lastSeen) {
      setShowGlow(false);
      return;
    }

    const newestAt = await fetchNewestForumActivityAt();
    setShowGlow(hasUnreadForum(lastSeen, newestAt));
  }, [onForumRoute]);

  useEffect(() => {
    void refresh();

    const interval = window.setInterval(() => {
      void refresh();
    }, POLL_MS);

    const onFocus = () => {
      void refresh();
    };

    const onSeen = () => {
      setShowGlow(false);
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener(FORUM_SEEN_EVENT, onSeen);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(FORUM_SEEN_EVENT, onSeen);
    };
  }, [refresh]);

  return showGlow;
}
