"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useWalletUi } from "@/hooks/game/useWalletUi";
import { GAME_NAV_ITEMS, type GameNavItemDef } from "@/lib/game/navConfig";
import { isNavActive } from "@/lib/game/navActive";
import { AudioSettings } from "./AudioSettings";
import { GameLanguageToggle } from "./GameLanguageToggle";
import { WalletRequiredModal } from "./WalletRequiredModal";
import { PixelBadge, PixelButton, WalletButton } from "@/components/ui/pixel";

export function GameNav() {
  const pathname = usePathname();
  const router = useRouter();
  const gameHref = useGameHref();
  const { t } = useGameI18n();
  const { wallet, connectMock, disconnectMock } = useWalletUi();
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletModal, setWalletModal] = useState<{
    open: boolean;
    feature: string;
    href?: string;
  }>({ open: false, feature: "" });

  const links = useMemo(
    () =>
      GAME_NAV_ITEMS.map((item) => ({
        ...item,
        href: gameHref[item.hrefKey],
        label: t.nav[item.labelKey],
        feature:
          item.id === "myNfts"
            ? t.nav.featureMyNfts
            : item.id === "rewards"
              ? t.nav.featureRewards
              : item.id === "leaderboard"
                ? t.nav.featureLeaderboard
                : "",
      })),
    [t, gameHref],
  );

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
      setWalletModal({ open: true, feature: item.feature || t.nav.featureMyNfts, href: item.href });
      setMenuOpen(false);
      return;
    }
    router.push(item.href);
    setMenuOpen(false);
  };

  const renderDesktopLink = (item: (typeof links)[number]) => {
    const active = isNavActive(pathname, item.href, gameHref.home);
    if (item.requiresWallet) {
      return (
        <button
          key={item.id}
          type="button"
          className={`game-nav__link ${active ? "game-nav__link--active" : ""}`}
          onClick={() => activate(item)}
        >
          {item.label}
        </button>
      );
    }
    return (
      <Link
        key={item.id}
        href={item.href}
        className={`game-nav__link ${active ? "game-nav__link--active" : ""}`}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <header className="game-nav">
      {/* Desktop / tablet wide */}
      <div className="game-nav__inner game-nav__inner--desktop">
        <Link href={gameHref.home} className="game-nav__brand">
          {t.nav.brand}
          <span>{t.nav.brandSub}</span>
        </Link>

        <nav className="game-nav__links" aria-label={t.nav.aria}>
          {links.map(renderDesktopLink)}
        </nav>

        <div className="game-nav__tools">
          <span className="hidden xl:inline-flex">
            <PixelBadge tone="blue">{t.common.chainBadge}</PixelBadge>
          </span>
          <AudioSettings />
          <span data-wallet-entry="header-desktop">
            <WalletButton wallet={wallet} onConnect={connectMock} onDisconnect={disconnectMock} compact />
          </span>
          <GameLanguageToggle />
        </div>
      </div>

      {/* Mobile header */}
      <div className="game-nav__mobile">
        <div className="game-nav__mobile-row game-nav__mobile-row--top">
          <Link href={gameHref.home} className="game-nav__brand" onClick={() => setMenuOpen(false)}>
            {t.nav.brand}
            <span>{t.nav.brandSub}</span>
          </Link>
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
          <AudioSettings />
        </div>
      </div>

      {menuOpen ? (
        <nav id="game-mobile-nav" className="game-nav__drawer" aria-label={t.nav.mobileAria}>
          <div className="game-nav__drawer-scroll">
            {links.map((item) => {
              const active = isNavActive(pathname, item.href, gameHref.home);
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
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  data-nav-id={item.id}
                  className={`game-nav__mobile-link ${active ? "is-active" : ""}`}
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
