"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { PixelBadge, WalletButton } from "@/components/ui/pixel";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useGameNavLinks } from "@/hooks/game/useGameNavLinks";
import { useWalletUi } from "@/hooks/game/useWalletUi";
import { isNavActive } from "@/lib/game/navActive";
import type { GameNavItemDef } from "@/lib/game/navConfig";
import { AudioSettings } from "./AudioSettings";
import { GameBackButton } from "./GameBackButton";
import { GameLanguageToggle } from "./GameLanguageToggle";
import { WalletRequiredModal } from "./WalletRequiredModal";

/** Wide-viewport game header — desktop / large tablet only. */
export function DesktopGameNav() {
  const pathname = usePathname();
  const router = useRouter();
  const gameHref = useGameHref();
  const { t } = useGameI18n();
  const { wallet, connectMock, disconnectMock } = useWalletUi();
  const links = useGameNavLinks();
  const [walletModal, setWalletModal] = useState<{
    open: boolean;
    feature: string;
    href?: string;
  }>({ open: false, feature: "" });

  const activate = (item: GameNavItemDef & { href: string; feature: string }) => {
    if (item.requiresWallet && !wallet.connected) {
      setWalletModal({
        open: true,
        feature: item.feature || t.nav.featureMyNfts,
        href: item.href,
      });
      return;
    }
    router.push(item.href);
  };

  return (
    <header className="game-nav game-nav--desktop" data-game-chrome="desktop">
      <div className="game-nav__inner game-nav__inner--desktop">
        <div className="game-nav__brand-cluster">
          <Link href={gameHref.home} className="game-nav__brand">
            {t.nav.brand}
            <span>{t.nav.brandSub}</span>
          </Link>
          <GameBackButton className="game-nav__back--desktop" />
        </div>

        <nav className="game-nav__links" aria-label={t.nav.aria}>
          {links.map((item) => {
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
          })}
        </nav>

        <div className="game-nav__tools">
          <span className="game-nav__chain-badge">
            <PixelBadge tone="blue">{t.common.chainBadge}</PixelBadge>
          </span>
          <AudioSettings />
          <span data-wallet-entry="header-desktop">
            <WalletButton
              wallet={wallet}
              onConnect={connectMock}
              onDisconnect={disconnectMock}
              compact
            />
          </span>
          <GameLanguageToggle />
        </div>
      </div>

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
