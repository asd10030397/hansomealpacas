"use client";

import { ComingSoonButton } from "@/components/game/ComingSoonButton";
import { GameStatusPanel } from "@/components/game/GameStatusPanel";
import { PixelButton, PixelPanel } from "@/components/ui/pixel";
import { MOCK_NFTS } from "@/data/game/mock";
import { gameHref } from "@/lib/game/paths";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useGameState } from "@/hooks/game/useGameState";

export default function CommitPage() {
  const { t } = useGameI18n();
  const { day, now, phaseEndsAt, phase } = useGameState();
  const playable = MOCK_NFTS.filter((n) => n.revealed);

  return (
    <div className="mx-auto max-w-3xl px-3 py-6">
      <p className="mock-chip mb-3">{t.common.demoBanner}</p>
      <h1 className="pixel-title text-lg text-[#f0c44a]">{t.commit.heading}</h1>
      <p className="mt-2 text-sm text-[var(--hg-muted)]">{t.commit.blurb}</p>
      <div className="mt-4">
        <GameStatusPanel day={day} now={now} phaseEndsAt={phaseEndsAt} />
      </div>
      <PixelPanel className="mt-4" title="SELECT NFT" eyebrow="CONTRACTS NOT CONNECTED">
        {phase !== "COMMIT" ? (
          <p className="mb-3 text-sm text-[#f0c44a]">
            Demo phase is {phase}. Commit on-chain will only accept COMMIT later — UI opens Coming
            Soon until contracts ship.
          </p>
        ) : null}
        <ul className="space-y-2">
          {playable.map((nft) => (
            <li
              key={nft.tokenId}
              className="flex items-center justify-between gap-3 border-2 border-[#2a3348] px-3 py-2 text-sm"
            >
              <span>
                #{nft.tokenId} · {nft.side}
                {nft.side === "Alpaca" ? ` · ${nft.gameplayClass}` : " · W=1"}
              </span>
              <ComingSoonButton feature="Commit" variant="gold" size="sm" className="w-auto min-w-[7rem]">
                COMMIT
              </ComingSoonButton>
            </li>
          ))}
        </ul>
        <PixelButton href={gameHref.explore} variant="green" className="mt-4" size="sm">
          OPEN MAP
        </PixelButton>
        <p className="mt-3 text-xs text-[var(--hg-muted)]">
          TODO(contract): replace Coming Soon triggers with HansomeGame.commit.
        </p>
      </PixelPanel>
    </div>
  );
}
