"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useWalletUi } from "@/hooks/game/useWalletUi";
import { isNavActive } from "@/lib/game/navActive";
import { WalletRequiredModal } from "./WalletRequiredModal";

export function MobileGameDock() {
  const pathname = usePathname();
  const router = useRouter();
  const gameHref = useGameHref();
  const { t } = useGameI18n();
  const { wallet, connectMock } = useWalletUi();
  const [walletOpen, setWalletOpen] = useState(false);

  const itemClass = (href: string) => {
    const active = isNavActive(pathname, href, gameHref.home);
    return `pixel-title flex flex-col items-center justify-center py-3 text-[0.45rem] ${
      active ? "bg-[#e8b03a] text-[#1a1520]" : "text-[#f3ebe0]"
    }`;
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 border-t-4 border-[#0d1018] bg-[#121826] pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label={t.dock.aria}
      >
        <Link href={gameHref.home} className={itemClass(gameHref.home)}>
          {t.dock.home}
        </Link>
        <Link href={gameHref.dashboard} className={itemClass(gameHref.dashboard)}>
          {t.dock.play}
        </Link>
        <Link href={gameHref.explore} className={itemClass(gameHref.explore)}>
          {t.dock.deploy}
        </Link>
        <button
          type="button"
          className={itemClass(gameHref.myNfts)}
          onClick={() => {
            if (wallet.connected) router.push(gameHref.myNfts);
            else setWalletOpen(true);
          }}
        >
          {t.dock.nfts}
        </button>
        <Link href={gameHref.rewards} className={itemClass(gameHref.rewards)}>
          {t.dock.loot}
        </Link>
      </nav>

      <WalletRequiredModal
        open={walletOpen}
        onClose={() => setWalletOpen(false)}
        onConnect={() => {
          connectMock();
          router.push(gameHref.myNfts);
        }}
        feature={t.nav.featureMyNfts}
      />
    </>
  );
}
