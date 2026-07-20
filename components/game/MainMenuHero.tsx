"use client";

import { MOCK_BANNER } from "@/data/game/mock";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameState } from "@/hooks/game/useGameState";
import { useWalletUi } from "@/hooks/game/useWalletUi";
import { enterGameHref, isResultPhase } from "@/lib/game/uiLoopPhase";
import { CompactGameHud } from "./CompactGameHud";
import { GameTitleLogo } from "./GameTitleLogo";
import { RpgMenuButton } from "./RpgMenuButton";
import { TerritoryHud } from "./TerritoryHud";
import { TitleScreenBackdrop } from "./TitleScreenBackdrop";

/**
 * Premium RPG title screen — composition first, Web3 second.
 */
export function MainMenuHero() {
  const { day, now, phaseEndsAt, phase } = useGameState();
  const gameHref = useGameHref();
  const { wallet, connectMock, disconnectMock } = useWalletUi();
  const enterHref = enterGameHref(phase, gameHref);
  const enterSub = isResultPhase(phase) ? "BATTLE RESULT" : "CHOOSE LOCATION";

  return (
    <section className="title-screen">
      <TitleScreenBackdrop />
      <TerritoryHud />

      <div className="title-screen__center">
        <p className="mock-chip title-screen__demo">{MOCK_BANNER}</p>
        <GameTitleLogo />

        <nav className="title-screen__menu" aria-label="Main menu">
          <RpgMenuButton
            iconSrc="/assets/icons/menu-wallet.svg"
            variant="gold"
            subtitle={wallet.connected ? "MOCK · TAP TO DISCONNECT" : "MOCK WALLET · NO TX"}
            onClick={() => (wallet.connected ? disconnectMock() : connectMock())}
          >
            {wallet.connected && wallet.address ? wallet.address : "CONNECT WALLET"}
          </RpgMenuButton>

          <RpgMenuButton
            href={gameHref.mint}
            iconSrc="/assets/icons/menu-mint.svg"
            variant="gold"
            subtitle="550 TOTAL SUPPLY"
          >
            MINT GENESIS NFT
          </RpgMenuButton>

          <RpgMenuButton
            href={enterHref}
            iconSrc="/assets/icons/menu-explore.svg"
            variant="green"
            subtitle={enterSub}
          >
            ENTER THE GAME
          </RpgMenuButton>
        </nav>

        <div className="title-screen__hud">
          <CompactGameHud day={day} now={now} phaseEndsAt={phaseEndsAt} phase={phase} />
        </div>
      </div>
    </section>
  );
}
