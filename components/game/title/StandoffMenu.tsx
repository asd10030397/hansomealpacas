"use client";

import Image from "next/image";
import Link from "next/link";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useGameState } from "@/hooks/game/useGameState";
import { useWalletUi } from "@/hooks/game/useWalletUi";
import { enterGameHref, isResultPhase } from "@/lib/game/uiLoopPhase";
import { StandoffApology } from "./StandoffApology";

/**
 * Center brand + primary game menu.
 * Composition hierarchy: title first, apology notice, actions.
 */
export function StandoffMenu() {
  const { t } = useGameI18n();
  const gameHref = useGameHref();
  const { phase } = useGameState();
  const { wallet, connectMock, disconnectMock } = useWalletUi();
  const enterHref = enterGameHref(phase, gameHref);
  const enterSub = isResultPhase(phase)
    ? t.dashboard.mainResult
    : t.dashboard.mainCommit;

  return (
    <div className="standoff__foreground">
      <header className="standoff__brand">
        <p className="standoff__eyebrow">{t.title.eyebrow}</p>
        <h1 className="standoff__title">
          <span className="standoff__title-line standoff__title-line--top">HANSOME</span>
          <span className="standoff__title-line standoff__title-line--bottom">ALPACAS</span>
        </h1>
        <div className="standoff__rule" aria-hidden />
        <p className="standoff__tagline">{t.title.tagline}</p>
      </header>

      <StandoffApology />

      <nav className="standoff__menu" aria-label={t.title.menuAria}>
        <button
          type="button"
          className="standoff__btn standoff__btn--gold"
          data-wallet-entry="home-cta"
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
              {wallet.connected && wallet.address ? wallet.address : t.title.connect}
            </span>
            <span className="standoff__btn-sub">
              {wallet.connected ? t.title.connectSubConnected : t.title.connectSub}
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
            <span>{t.title.mint}</span>
            <span className="standoff__btn-sub">{t.title.mintSub}</span>
          </span>
        </Link>

        <Link href={enterHref} className="standoff__btn standoff__btn--green">
          <Image
            src="/assets/icons/menu-explore.svg"
            alt=""
            width={22}
            height={22}
            className="standoff__btn-icon"
            unoptimized
          />
          <span className="standoff__btn-label">
            <span>{t.title.enterGame}</span>
            <span className="standoff__btn-sub">{enterSub}</span>
          </span>
        </Link>
      </nav>
    </div>
  );
}
