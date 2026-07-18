"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { gameHref } from "@/lib/game/paths";
import { useWalletUi } from "@/hooks/game/useWalletUi";
import { ComingSoonModal } from "./ComingSoonModal";
import { WalletRequiredModal } from "./WalletRequiredModal";

export function MobileGameDock() {
  const pathname = usePathname();
  const router = useRouter();
  const { wallet, connectMock } = useWalletUi();
  const [soonOpen, setSoonOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);

  const itemClass = (href: string, forceActive = false) => {
    const active =
      forceActive ||
      pathname === href ||
      (href !== gameHref.home && pathname.startsWith(href + "/"));
    return `pixel-title flex flex-col items-center justify-center py-3 text-[0.45rem] ${
      active ? "bg-[#e8b03a] text-[#1a1520]" : "text-[#f3ebe0]"
    }`;
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 border-t-4 border-[#0d1018] bg-[#121826] pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Quick game actions"
      >
        <Link href={gameHref.home} className={itemClass(gameHref.home)}>
          HOME
        </Link>
        <Link href={gameHref.dashboard} className={itemClass(gameHref.dashboard)}>
          PLAY
        </Link>
        <Link href={gameHref.explore} className={itemClass(gameHref.explore)}>
          MAP
        </Link>
        <button
          type="button"
          className={itemClass(gameHref.myNfts)}
          onClick={() => {
            if (wallet.connected) router.push(gameHref.myNfts);
            else setWalletOpen(true);
          }}
        >
          NFTS
        </button>
        <button
          type="button"
          className={itemClass(gameHref.rewards, soonOpen)}
          onClick={() => setSoonOpen(true)}
        >
          LOOT
        </button>
      </nav>

      <ComingSoonModal
        open={soonOpen}
        onClose={() => setSoonOpen(false)}
        feature="Rewards"
      />
      <WalletRequiredModal
        open={walletOpen}
        onClose={() => setWalletOpen(false)}
        onConnect={() => {
          connectMock();
          router.push(gameHref.myNfts);
        }}
        feature="My NFTs"
      />
    </>
  );
}
