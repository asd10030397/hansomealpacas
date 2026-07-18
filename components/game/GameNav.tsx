"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { gameHref } from "@/lib/game/paths";
import { useWalletUi } from "@/hooks/game/useWalletUi";
import { AudioSettings } from "./AudioSettings";
import { ComingSoonModal } from "./ComingSoonModal";
import { WalletRequiredModal } from "./WalletRequiredModal";
import { PixelBadge, PixelButton, WalletButton } from "@/components/ui/pixel";

type NavLink =
  | { href: string; label: string; kind: "link" }
  | { label: string; kind: "soon"; feature: string }
  | { href: string; label: string; kind: "wallet"; feature: string };

const LINKS: NavLink[] = [
  { href: gameHref.home, label: "HOME", kind: "link" },
  { href: gameHref.dashboard, label: "GAME", kind: "link" },
  { href: gameHref.mint, label: "MINT", kind: "link" },
  { href: gameHref.myNfts, label: "MY NFTS", kind: "wallet", feature: "My NFTs" },
  { label: "REWARDS", kind: "soon", feature: "Rewards" },
  { label: "BOARD", kind: "soon", feature: "Leaderboard" },
  { href: gameHref.docs, label: "DOCS", kind: "link" },
];

function navClass(active: boolean) {
  return `game-nav__link ${active ? "game-nav__link--active" : ""}`;
}

export function GameNav() {
  const pathname = usePathname();
  const router = useRouter();
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

  const renderItem = (l: NavLink, mobile = false) => {
    if (l.kind === "link") {
      const active =
        pathname === l.href || (l.href !== gameHref.home && pathname.startsWith(l.href));
      return (
        <Link
          key={l.label}
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
          key={l.label}
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
        key={l.label}
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
          HANSOME
          <span>GAME</span>
        </Link>

        <nav className="game-nav__links" aria-label="Game">
          {LINKS.map((l) => renderItem(l))}
        </nav>

        <div className="game-nav__tools">
          <PixelBadge tone="blue">ROBINHOOD CHAIN</PixelBadge>
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
            MENU
          </PixelButton>
        </div>
      </div>

      {menuOpen ? (
        <nav id="game-mobile-nav" className="game-nav__drawer" aria-label="Mobile game">
          {LINKS.map((l) => renderItem(l, true))}
          <div className="pt-2">
            <AudioSettings />
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
