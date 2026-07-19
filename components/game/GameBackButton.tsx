"use client";

import { usePathname, useRouter } from "next/navigation";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";

function isGameHomePath(pathname: string, home: string): boolean {
  if (pathname === home) return true;
  // Apex www title route + pretty game-host root
  return pathname === "/game" || pathname === "/";
}

type Props = {
  className?: string;
};

/**
 * Browser-style back control for game chrome.
 * Hidden on the title/home screen; otherwise router.back() with home fallback.
 */
export function GameBackButton({ className = "" }: Props) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const gameHref = useGameHref();
  const { t } = useGameI18n();

  if (isGameHomePath(pathname, gameHref.home)) return null;

  const onBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(gameHref.home);
  };

  return (
    <button
      type="button"
      className={`game-nav__back ${className}`.trim()}
      onClick={onBack}
      aria-label={t.nav.backAria}
      data-testid="game-nav-back"
    >
      <span aria-hidden="true">←</span>
      <span className="game-nav__back-label">{t.nav.back}</span>
    </button>
  );
}
