"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { GameChrome } from "@/components/game/GameChrome";
import { useGamePageBackground } from "@/components/game/GamePageBackground";
import { GameplayMusic } from "@/components/game/GameplayMusic";
import { GameUiSfx } from "@/components/game/GameUiSfx";
import { GameVisualShell } from "@/components/game/GameVisualShell";
import { AutoRevealProvider } from "@/hooks/game/useAutoReveal";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { forceUnlockBodyScroll } from "@/lib/ui/bodyScrollLock";

/** Client chrome around /game/* pages (nav, dock, i18n skip link). */
export function GameShell({ children }: { children: React.ReactNode }) {
  const { t } = useGameI18n();
  const pathname = usePathname();
  const pageBg = useGamePageBackground();

  // Emergency cleanup: never leave body locked after route changes.
  useEffect(() => {
    forceUnlockBodyScroll();
  }, [pathname]);

  return (
    <GameVisualShell>
      <GameplayMusic />
      <GameUiSfx />
      <AutoRevealProvider>
        <div className="hansome-game hansome-game-shell" data-bg={pageBg}>
          <a
            href="#game-main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:bg-[#e8b03a] focus:px-3 focus:py-2 focus:text-[#1a1520]"
          >
            {t.common.skipToContent}
          </a>
          <GameChrome />
          <main id="game-main" className="hansome-game-main">
            {children}
          </main>
        </div>
      </AutoRevealProvider>
    </GameVisualShell>
  );
}
