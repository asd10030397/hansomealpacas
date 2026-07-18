"use client";

import { ComingSoonButton } from "@/components/game/ComingSoonButton";
import { GameStatusPanel } from "@/components/game/GameStatusPanel";
import { PixelPanel } from "@/components/ui/pixel";
import { MOCK_BANNER, MOCK_NFTS } from "@/data/game/mock";
import { useGameState } from "@/hooks/game/useGameState";

export default function RevealPage() {
  const { day, now, phaseEndsAt, phase } = useGameState();

  return (
    <div className="mx-auto max-w-3xl px-3 py-6">
      <p className="mock-chip mb-3">{MOCK_BANNER}</p>
      <h1 className="pixel-title text-lg text-[#f0c44a]">REVEAL</h1>
      <p className="mt-2 text-sm text-[var(--hg-muted)]">
        Open your committed location + salt. Must match the stored commit hash.
      </p>
      <div className="mt-4">
        <GameStatusPanel day={day} now={now} phaseEndsAt={phaseEndsAt} />
      </div>
      <PixelPanel className="mt-4" title="REVEAL QUEUE" eyebrow="CONTRACTS NOT CONNECTED">
        {phase !== "REVEAL" ? (
          <p className="mb-3 text-sm text-[#f0c44a]">
            Demo phase is {phase}. Reveal on-chain will only accept REVEAL later — UI opens Coming
            Soon until contracts ship.
          </p>
        ) : null}
        <ul className="space-y-2">
          {MOCK_NFTS.filter((n) => n.gameStatus === "Committed" || n.revealed).map((nft) => (
            <li
              key={nft.tokenId}
              className="flex items-center justify-between gap-3 border-2 border-[#2a3348] px-3 py-2 text-sm"
            >
              <span>
                #{nft.tokenId} · {nft.side}
              </span>
              <ComingSoonButton feature="Reveal" variant="gold" size="sm" className="w-auto min-w-[7rem]">
                REVEAL
              </ComingSoonButton>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[var(--hg-muted)]">
          TODO(contract): replace Coming Soon triggers with HansomeGame.reveal.
        </p>
      </PixelPanel>
    </div>
  );
}
