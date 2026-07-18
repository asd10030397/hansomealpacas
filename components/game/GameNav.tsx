"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { gameHref } from "@/lib/game/paths";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useWalletUi } from "@/hooks/game/useWalletUi";
import { AudioSettings } from "./AudioSettings";
import { ComingSoonModal } from "./ComingSoonModal";
import { GameLanguageToggle } from "./GameLanguageToggle";
import { WalletRequiredModal } from "./WalletRequiredModal";
import { PixelBadge, PixelButton, WalletButton } from "@/components/ui/pixel";

type NavLink =
  | { href: string; label: string; kind: "link" }
  | { label: string; kind: "soon"; feature: string }
  | { href: string; label: string; kind: "wallet"; feature: string };

function navClass(active: boolean) {
  return `game-nav__link ${active ? "game-nav__link--active" : ""}`;
}

export function GameNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useGameI18n();
  const { wallet, connectMock, disconnectMock } = useWalletUi();
  const [menuOpen, setMenuOpen] = useState(false);
  const [soon, setSoon] = useState<{ open: boolean; feature: string }>({
    open: false,
    feature: "",
  });
  const [walletModal, setWalletModal] = useState<{
    open: boolean;
    feature: string;
    href?: string;
  }>({ open: false, feature: "" });

  const links: NavLink[] = useMemo(
    () => [
      { href: gameHref.home, label: t.nav.home, kind: "link" },
      { href: gameHref.dashboard, label: t.nav.game, kind: "link" },
      { href: gameHref.mint, label: t.nav.mint, kind: "link" },
      {
        href: gameHref.myNfts,
        label: t.nav.myNfts,
        kind: "wallet",
        feature: t.nav.featureMyNfts,
      },
      { label: t.nav.rewards, kind: "soon", feature: t.nav.featureRewards },
      { label: t.nav.board, kind: "soon", feature: t.nav.featureLeaderboard },
      { href: gameHref.docs, label: t.nav.docs, kind: "link" },
    ],
    [t],
  );

  const renderItem = (l: NavLink, mobile = false) => {
    if (l.kind === "link") {
      const active =
        pathname === l.href || (l.href !== gameHref.home && pathname.startsWith(l.href));
      return (
        <Link
          key={`${l.kind}-${l.href}`}
          href={l.href}
          onClick={() => setMenuOpen(false)}
          className={mobile ? `game-nav__mobile-link ${active ? "is-active" : ""}` : navClass(active)}
        >
          {l.label}
        </Link>
      );
    }

    if (l.kind === "soon") {
      return (
        <button
          key={`soon-${l.label}`}
          type="button"
          className={mobile ? "game-nav__mobile-link" : navClass(false)}
          onClick={() => {
            setSoon({ open: true, feature: l.feature });
            setMenuOpen(false);
          }}
        >
          {l.label}
        </button>
      );
    }

    const active =
      pathname === l.href || (l.href !== gameHref.home && pathname.startsWith(l.href));
    return (
      <button
        key={`wallet-${l.href}`}
        type="button"
        className={mobile ? `game-nav__mobile-link ${active ? "is-active" : ""}` : navClass(active)}
        onClick={() => {
          if (wallet.connected) {
            router.push(l.href);
            setMenuOpen(false);
          } else {
            setWalletModal({ open: true, feature: l.feature, href: l.href });
            setMenuOpen(false);
          }
        }}
      >
        {l.label}
      </button>
    );
  };

  return (
    <header className="game-nav">
      <div className="game-nav__inner">
        <Link href={gameHref.home} className="game-nav__brand">
          {t.nav.brand}
          <span>{t.nav.brandSub}</span>
        </Link>

        <nav className="game-nav__links" aria-label={t.nav.aria}>
          {links.map((l) => renderItem(l))}
        </nav>

        <div className="game-nav__tools">
          <span className="hidden sm:inline-flex">
            <PixelBadge tone="blue">{t.common.chainBadge}</PixelBadge>
          </span>
          <div className="hidden sm:block">
            <AudioSettings />
          </div>
          <WalletButton wallet={wallet} onConnect={connectMock} onDisconnect={disconnectMock} />
          <PixelButton
            size="sm"
            variant="ghost"
            className="lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="game-mobile-nav"
          >
            {t.common.menu}
          </PixelButton>
          {/* Far top-right — last in tools flex */}
          <GameLanguageToggle />
        </div>
      </div>

      {menuOpen ? (
        <nav id="game-mobile-nav" className="game-nav__drawer" aria-label={t.nav.mobileAria}>
          {links.map((l) => renderItem(l, true))}
          <div className="flex items-center justify-end gap-2 pt-2">
            <AudioSettings />
            <GameLanguageToggle />
          </div>
        </nav>
      ) : null}

      <ComingSoonModal
        open={soon.open}
        onClose={() => setSoon((s) => ({ ...s, open: false }))}
        feature={soon.feature}
      />
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
