"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import {
  GAME_DOCK_MORE,
  GAME_DOCK_PRIMARY,
  navItemById,
  type GameNavId,
} from "@/lib/game/navConfig";
import { isNavActive } from "@/lib/game/navActive";
import { forceUnlockBodyScroll } from "@/lib/ui/bodyScrollLock";
import { AudioSettings } from "./AudioSettings";
import { GameLanguageToggle } from "./GameLanguageToggle";

function dockLabel(
  id: GameNavId,
  t: ReturnType<typeof useGameI18n>["t"],
): string {
  switch (id) {
    case "home":
      return t.dock.home;
    case "play":
      return t.dock.play;
    case "mint":
      return t.dock.mint;
    case "myNfts":
      return t.dock.nfts;
    case "rewards":
      return t.dock.rewards;
    case "leaderboard":
      return t.nav.leaderboard;
    case "docs":
      return t.nav.docs;
    default:
      return id;
  }
}

export function MobileGameDock() {
  const pathname = usePathname();
  const gameHref = useGameHref();
  const { t } = useGameI18n();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
    forceUnlockBodyScroll();
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const moreActive = GAME_DOCK_MORE.some((id) => {
    const item = navItemById(id);
    return isNavActive(pathname, gameHref[item.hrefKey], gameHref.home);
  });

  const itemClass = (href: string, forceActive = false) => {
    const active =
      forceActive || (href ? isNavActive(pathname, href, gameHref.home) : false);
    return `mobile-dock__item ${active ? "is-active" : ""}`;
  };

  return (
    <>
      {moreOpen ? (
        <div className="mobile-dock__sheet" role="dialog" aria-label={t.dock.more}>
          <div className="mobile-dock__sheet-backdrop" onClick={() => setMoreOpen(false)} />
          <div className="mobile-dock__sheet-panel">
            <p className="mobile-dock__sheet-title">{t.dock.more}</p>
            <div className="mobile-dock__sheet-links">
              {GAME_DOCK_MORE.map((id) => {
                const item = navItemById(id);
                const href = gameHref[item.hrefKey];
                const active = isNavActive(pathname, href, gameHref.home);
                return (
                  <Link
                    key={id}
                    href={href}
                    data-nav-id={id}
                    className={`mobile-dock__sheet-link ${active ? "is-active" : ""}`}
                    onClick={() => setMoreOpen(false)}
                  >
                    {dockLabel(id, t)}
                  </Link>
                );
              })}
            </div>
            <div className="mobile-dock__sheet-tools">
              <GameLanguageToggle />
              <AudioSettings />
            </div>
          </div>
        </div>
      ) : null}

      <nav className="mobile-dock mobile-game-dock" aria-label={t.dock.aria}>
        {GAME_DOCK_PRIMARY.map((id) => {
          const item = navItemById(id);
          const href = gameHref[item.hrefKey];
          const label = dockLabel(id, t);

          return (
            <Link
              key={id}
              href={href}
              className={itemClass(href)}
              onClick={() => setMoreOpen(false)}
            >
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          className={itemClass("", moreOpen || moreActive)}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        >
          {t.dock.more}
        </button>
      </nav>
    </>
  );
}
