"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PixelButton, WalletButton } from "@/components/ui/pixel";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useForumUnreadGlow } from "@/hooks/game/useForumUnreadGlow";
import { useGameNavLinks } from "@/hooks/game/useGameNavLinks";
import { useWalletUi } from "@/hooks/game/useWalletUi";
import { FORUM_MOBILE_NAV_GLOW_CLASS } from "@/lib/game/forum/unread";
import { isNavActive } from "@/lib/game/navActive";
import type { GameNavItemDef } from "@/lib/game/navConfig";
import { AudioSettings } from "./AudioSettings";
import { GameBackButton } from "./GameBackButton";
import { GameLanguageToggle } from "./GameLanguageToggle";
import { WalletRequiredModal } from "./WalletRequiredModal";

/** Narrow-viewport game header + MENU drawer. */
export function MobileGameHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const gameHref = useGameHref();
  const { t } = useGameI18n();
  const { wallet, connectMock, disconnectMock } = useWalletUi();
  const links = useGameNavLinks();
  const showForumGlow = useForumUnreadGlow();
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletModal, setWalletModal] = useState<{
    open: boolean;
    feature: string;
    href?: string;
  }>({ open: false, feature: "" });

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const activate = (item: GameNavItemDef & { href: string; feature: string }) => {
    if (item.requiresWallet && !wallet.connected) {
      setWalletModal({
        open: true,
        feature: item.feature || t.nav.featureMyNfts,
        href: item.href,
      });
      setMenuOpen(false);
      return;
    }
    router.push(item.href);
    setMenuOpen(false);
  };

  return (
    <header className="game-nav game-nav--mobile" data-game-chrome="mobile-header">
      <div className="game-nav__mobile">
        <div className="game-nav__mobile-row game-nav__mobile-row--top">
          <div className="game-nav__brand-cluster">
            <GameBackButton />
            <Link
              href={gameHref.home}
              className="game-nav__brand"
              onClick={() => setMenuOpen(false)}
            >
              {t.nav.brand}
              <span>{t.nav.brandSub}</span>
            </Link>
          </div>
          <PixelButton
            size="sm"
            variant={menuOpen ? "gold" : "ghost"}
            className="game-nav__menu-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="game-mobile-nav"
          >
            {menuOpen ? t.common.close : t.common.menu}
          </PixelButton>
        </div>
        <div className="game-nav__mobile-row game-nav__mobile-row--actions">
          <span data-wallet-entry="header-mobile">
            <WalletButton
              wallet={wallet}
              onConnect={connectMock}
              onDisconnect={disconnectMock}
              compact
            />
          </span>
          <div className="game-nav__mobile-tools">
            <GameLanguageToggle />
            <AudioSettings />
          </div>
        </div>
      </div>

      {menuOpen ? (
        <nav id="game-mobile-nav" className="game-nav__drawer" aria-label={t.nav.mobileAria}>
          <div className="game-nav__drawer-scroll">
            {links.map((item) => {
              const active = !item.external && isNavActive(pathname, item.href, gameHref.home);
              if (item.external) {
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    data-nav-id={item.id}
                    className="game-nav__mobile-link game-nav__mobile-link--external"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t.nav.marketAria}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                );
              }
              if (item.requiresWallet) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-nav-id={item.id}
                    className={`game-nav__mobile-link ${active ? "is-active" : ""}`}
                    onClick={() => activate(item)}
                  >
                    {item.label}
                  </button>
                );
              }
              const glowClass =
                item.id === "forum" && showForumGlow && !active
                  ? FORUM_MOBILE_NAV_GLOW_CLASS
                  : "";
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  data-nav-id={item.id}
                  className={`game-nav__mobile-link ${active ? "is-active" : ""} ${glowClass}`.trim()}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="game-nav__drawer-tools">
            <span data-wallet-entry="mobile-menu">
              <WalletButton
                wallet={wallet}
                onConnect={() => {
                  connectMock();
                  setMenuOpen(false);
                }}
                onDisconnect={disconnectMock}
                compact
              />
            </span>
            <GameLanguageToggle />
          </div>
        </nav>
      ) : null}

      <WalletRequiredModal
        open={walletModal.open}
        onClose={() => setWalletModal((s) => ({ ...s, open: false }))}
        onConnect={() => {
          connectMock();
          if (walletModal.href) router.push(walletModal.href);
        }}
        feature={walletModal.feature}
      />
    </header>
  );
}
