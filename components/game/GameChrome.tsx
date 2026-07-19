"use client";

import { useGameMobileViewport } from "@/hooks/game/useGameMobileViewport";
import { DesktopGameNav } from "./DesktopGameNav";
import { MobileGameChrome } from "./MobileGameChrome";

/**
 * Picks exactly one chrome subtree from the shared viewport breakpoint.
 * Mobile fixes live under MobileGameChrome; desktop under DesktopGameNav.
 */
export function GameChrome() {
  const isMobile = useGameMobileViewport();

  if (isMobile) {
    return <MobileGameChrome />;
  }

  return <DesktopGameNav />;
}
