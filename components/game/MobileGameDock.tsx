"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useForumUnreadGlow } from "@/hooks/game/useForumUnreadGlow";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import {
  FORUM_DOCK_GLOW_CLASS,
  FORUM_DOCK_MORE_GLOW_CLASS,
} from "@/lib/game/forum/unread";
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
    case "claim":
      return t.dock.claim;
    case "leaderboard":
      return t.nav.leaderboard;
    case "forum":
      return t.nav.forum;
    case "market":
      return t.nav.market;
    case "season":
      return t.nav.season;
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
  const showForumGlow = useForumUnreadGlow();
  const [moreOpen, setMoreOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  const closeMore = useCallback(() => {
    setMoreOpen(false);
    forceUnlockBodyScroll();
  }, []);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    closeMore();
  }, [pathname, closeMore]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMore();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen, closeMore]);

  // Closed state: never leave dialog markup, overlays, or body lock behind.
  useEffect(() => {
    if (moreOpen) return;
    forceUnlockBodyScroll();
  }, [moreOpen]);

  const moreActive = GAME_DOCK_MORE.some((id) => {
    const item = navItemById(id);
    if (item.externalHref) return false;
    return isNavActive(pathname, gameHref[item.hrefKey!], gameHref.home);
  });

  const itemClass = (href: string, forceActive = false) => {
    const active =
      forceActive || (href ? isNavActive(pathname, href, gameHref.home) : false);
    return `mobile-dock__item ${active ? "is-active" : ""}`;
  };

  const sheet =
    moreOpen && portalReady
      ? createPortal(
          <div
            className="mobile-dock__sheet"
            data-more-sheet="open"
            role="dialog"
            aria-modal="true"
            aria-label={t.dock.more}
          >
            <button
              type="button"
              className="mobile-dock__sheet-backdrop"
              data-more-backdrop="true"
              aria-label={t.common.close}
              onClick={closeMore}
            />
            <div className="mobile-dock__sheet-panel" data-more-panel="true">
              <p className="mobile-dock__sheet-title">{t.dock.more}</p>
              <div className="mobile-dock__sheet-links">
                {GAME_DOCK_MORE.map((id) => {
                  const item = navItemById(id);
                  const href = item.externalHref ?? gameHref[item.hrefKey!];
                  const active =
                    !item.externalHref &&
                    isNavActive(pathname, href, gameHref.home);
                  const label = dockLabel(id, t);
                  if (item.externalHref) {
                    return (
                      <a
                        key={id}
                        href={href}
                        data-nav-id={id}
                        className="mobile-dock__sheet-link mobile-dock__sheet-link--external"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t.nav.marketAria}
                        onClick={closeMore}
                      >
                        {label}
                      </a>
                    );
                  }
                  const glowClass =
                    id === "forum" && showForumGlow && !active ? FORUM_DOCK_GLOW_CLASS : "";
                  return (
                    <Link
                      key={id}
                      href={href}
                      data-nav-id={id}
                      className={`mobile-dock__sheet-link ${active ? "is-active" : ""} ${glowClass}`.trim()}
                      onClick={closeMore}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
              <div className="mobile-dock__sheet-tools">
                <GameLanguageToggle />
                <AudioSettings />
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {sheet}

      <nav
        className="mobile-dock mobile-game-dock"
        aria-label={t.dock.aria}
        data-more-open={moreOpen ? "true" : "false"}
      >
        {GAME_DOCK_PRIMARY.map((id) => {
          const item = navItemById(id);
          const href = gameHref[item.hrefKey!];
          const label = dockLabel(id, t);

          return (
            <Link
              key={id}
              href={href}
              className={itemClass(href)}
              onClick={closeMore}
            >
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          className={`${itemClass("", moreOpen || moreActive)} ${showForumGlow && !moreActive ? FORUM_DOCK_MORE_GLOW_CLASS : ""}`.trim()}
          data-dock-more="true"
          aria-expanded={moreOpen}
          onClick={() => {
            setMoreOpen((v) => {
              const next = !v;
              if (!next) forceUnlockBodyScroll();
              return next;
            });
          }}
        >
          {t.dock.more}
        </button>
      </nav>
    </>
  );
}
