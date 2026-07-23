"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useGameHref } from "@/hooks/game/useGameHref";
import { fetchNewestForumActivityAt, markForumSeen } from "@/lib/game/forum/unread";
import { isNavActive } from "@/lib/game/navActive";

/** Marks forum activity as seen while the user is on any forum route. */
export function useForumSeenOnVisit(): void {
  const pathname = usePathname();
  const gameHref = useGameHref();

  useEffect(() => {
    if (!isNavActive(pathname, gameHref.forum, gameHref.home)) return;

    let cancelled = false;

    void (async () => {
      const newestAt = await fetchNewestForumActivityAt();
      if (cancelled) return;
      markForumSeen(newestAt ?? new Date().toISOString());
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, gameHref.forum, gameHref.home]);
}
