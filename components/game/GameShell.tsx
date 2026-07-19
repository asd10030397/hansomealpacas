"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { GameNav } from "@/components/game/GameNav";
import { GameplayMusic } from "@/components/game/GameplayMusic";
import { GameUiSfx } from "@/components/game/GameUiSfx";
import { GameVisualShell } from "@/components/game/GameVisualShell";
import { MobileGameDock } from "@/components/game/MobileGameDock";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { forceUnlockBodyScroll } from "@/lib/ui/bodyScrollLock";

/** Client chrome around /game/* pages (nav, dock, i18n skip link). */
export function GameShell({ children }: { children: React.ReactNode }) {
  const { t } = useGameI18n();
  const pathname = usePathname();

  // Emergency cleanup: never leave body locked after route changes.
  useEffect(() => {
    forceUnlockBodyScroll();
  }, [pathname]);

  return (
    <GameVisualShell>
      <GameplayMusic />
      <GameUiSfx />
      <div className="hansome-game hansome-game-shell">
        <a
          href="#game-main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:bg-[#e8b03a] focus:px-3 focus:py-2 focus:text-[#1a1520]"
        >
          {t.common.skipToContent}
        </a>
        <GameNav />
        <main id="game-main" className="hansome-game-main">
          {children}
        </main>
        <MobileGameDock />
      </div>
    </GameVisualShell>
  );
}
