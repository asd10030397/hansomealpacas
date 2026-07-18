"use client";

import Image from "next/image";
import Link from "next/link";
import { gameHref } from "@/lib/game/paths";
import { useWalletUi } from "@/hooks/game/useWalletUi";

/**
 * Center brand + primary game menu.
 * Composition hierarchy: title first, actions second.
 */
export function StandoffMenu() {
  const { wallet, connectMock, disconnectMock } = useWalletUi();

  return (
    <div className="standoff__foreground">
      <header className="standoff__brand">
        <p className="standoff__eyebrow">PIXEL RPG · ROBINHOOD CHAIN</p>
        <h1 className="standoff__title">
          <span className="standoff__title-line standoff__title-line--top">HANSOME</span>
          <span className="standoff__title-line standoff__title-line--bottom">ALPACAS</span>
        </h1>
        <div className="standoff__rule" aria-hidden />
        <p className="standoff__tagline">ALPACAS VS COUGARS</p>
      </header>

      <nav className="standoff__menu" aria-label="Main menu">
        <button
          type="button"
          className="standoff__btn standoff__btn--gold"
          onClick={() => (wallet.connected ? disconnectMock() : connectMock())}
        >
          <Image
            src="/assets/icons/menu-wallet.svg"
            alt=""
            width={22}
            height={22}
            className="standoff__btn-icon"
            unoptimized
          />
          <span className="standoff__btn-label">
            <span>
              {wallet.connected && wallet.address ? wallet.address : "CONNECT WALLET"}
            </span>
            <span className="standoff__btn-sub">
              {wallet.connected ? "MOCK · TAP TO DISCONNECT" : "MOCK WALLET · NO TX"}
            </span>
          </span>
        </button>

        <Link href={gameHref.mint} className="standoff__btn standoff__btn--gold">
          <Image
            src="/assets/icons/menu-mint.svg"
            alt=""
            width={22}
            height={22}
            className="standoff__btn-icon"
            unoptimized
          />
          <span className="standoff__btn-label">
            <span>MINT GENESIS NFT</span>
            <span className="standoff__btn-sub">550 TOTAL SUPPLY</span>
          </span>
        </Link>

        <Link href={gameHref.explore} className="standoff__btn standoff__btn--green">
          <Image
            src="/assets/icons/menu-explore.svg"
            alt=""
            width={22}
            height={22}
            className="standoff__btn-icon"
            unoptimized
          />
          <span className="standoff__btn-label">
            <span>EXPLORE WORLD</span>
            <span className="standoff__btn-sub">ENTER THE WORLD</span>
          </span>
        </Link>
      </nav>
    </div>
  );
}
