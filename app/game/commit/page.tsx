"use client";

import { useEffect, useMemo, useState } from "react";
import { GameStatusPanel } from "@/components/game/GameStatusPanel";
import { GameFeedback } from "@/components/game/ui/GameFeedback";
import { PixelButton, PixelPanel } from "@/components/ui/pixel";
import { GAME_LOCATIONS } from "@/data/game/locations";
import { MOCK_NFTS } from "@/data/game/mock";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useGameState } from "@/hooks/game/useGameState";
import { useHansomeCommit } from "@/hooks/game/useHansomeCommit";
import { useOwnedGenesisNfts } from "@/hooks/game/useOwnedGenesisNfts";
import {
  getCommitSecret,
  getPendingLocation,
  listCommitSecretsForDay,
  setPendingLocation,
} from "@/lib/game/commitSecret";
import { isHansomeGameConfigured } from "@/lib/game/hansomeGame";
import type { LocationId } from "@/types/game";

export default function CommitPage() {
  const { t } = useGameI18n();
  const gameHref = useGameHref();
  const { day, now, phaseEndsAt, phase, isMock } = useGameState();
  const { commitNft, configured, isPending, lastError } = useHansomeCommit();
  const owned = useOwnedGenesisNfts();

  const playable = isHansomeGameConfigured()
    ? owned.nfts.filter((n) => n.revealed)
    : MOCK_NFTS.filter((n) => n.revealed);
  const [locationId, setLocationId] = useState<LocationId | null>(null);
  const [selectedToken, setSelectedToken] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [sealedToday, setSealedToday] = useState(() =>
    listCommitSecretsForDay(day.day),
  );

  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("location");
    const q = fromQuery != null ? Number(fromQuery) : NaN;
    if (Number.isInteger(q) && q >= 0 && q <= 4) {
      setLocationId(q as LocationId);
      setPendingLocation(q as LocationId);
      return;
    }
    const pending = getPendingLocation();
    if (pending != null) setLocationId(pending);
  }, []);

  const locationLabel = useMemo(() => {
    if (locationId == null) return null;
    const loc = GAME_LOCATIONS[locationId];
    return `${loc.name} · W${loc.weight}`;
  }, [locationId]);

  const onCommit = async (tokenId: number) => {
    if (locationId == null) {
      setStatusMsg("Pick a location on DEPLOY first.");
      return;
    }
    if (phase !== "COMMIT") {
      setStatusMsg(`Commit window closed (phase is ${phase}).`);
      return;
    }
    const nft = playable.find((n) => n.tokenId === tokenId);
    if (nft?.side === "Cougar" && locationId === 0) {
      setStatusMsg("Cougars cannot commit to Home.");
      return;
    }

    setSelectedToken(tokenId);
    const result = await commitNft({
      tokenId,
      day: day.day,
      locationId,
    });
    setSealedToday(listCommitSecretsForDay(day.day));

    if (!result.ok) {
      setStatusMsg(result.error);
      return;
    }

    if (result.mode === "chain") {
      setStatusMsg(
        `Committed #${tokenId} on-chain. Keep this device — salt is stored for Reveal.`,
      );
    } else {
      setStatusMsg(
        `Sealed #${tokenId} locally for day ${day.day} → ${locationLabel}. ` +
          (isHansomeGameConfigured()
            ? "Wallet required for on-chain submit."
            : "Game contract not deployed yet — secret saved for Reveal when chain is live."),
      );
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-3 py-6">
      {isMock ? <p className="mock-chip mb-3">{t.common.demoBanner}</p> : null}
      <h1 className="pixel-title text-lg text-[#f0c44a]">{t.commit.heading}</h1>
      <p className="mt-2 text-sm text-[var(--hg-muted)]">{t.commit.blurb}</p>
      <div className="mt-4">
        <GameStatusPanel day={day} now={now} phaseEndsAt={phaseEndsAt} />
      </div>

      <PixelPanel
        className="mt-4"
        title="LOCATION"
        eyebrow={configured ? "CHAIN READY WHEN CONNECTED" : "LOCAL SEAL · AWAITING GAME DEPLOY"}
      >
        {locationLabel ? (
          <p className="text-sm text-[#f0c44a]">{locationLabel}</p>
        ) : (
          <p className="text-sm text-[var(--hg-muted)]">
            No location selected. Choose one on the Deploy map.
          </p>
        )}
        <PixelButton href={gameHref.explore} variant="green" className="mt-3" size="sm">
          OPEN MAP
        </PixelButton>
      </PixelPanel>

      <PixelPanel className="mt-4" title="SELECT NFT" eyebrow={`DAY ${day.day}`}>
        {phase !== "COMMIT" ? (
          <GameFeedback tone="info" label={t.common.phaseChanged}>
            Current phase is {phase}. Commit only seals during COMMIT.
          </GameFeedback>
        ) : null}
        {isHansomeGameConfigured() && !owned.isConnected ? (
          <GameFeedback tone="info" label="Wallet">
            Connect your wallet to load owned Genesis NFTs.
          </GameFeedback>
        ) : null}
        {isHansomeGameConfigured() && owned.isLoading ? (
          <p className="mt-2 text-sm text-[var(--hg-muted)]">Loading inventory…</p>
        ) : null}
        {isHansomeGameConfigured() &&
        owned.isConnected &&
        !owned.isLoading &&
        playable.length === 0 ? (
          <GameFeedback tone="info" label="Inventory">
            No revealed Genesis NFTs in this wallet.
          </GameFeedback>
        ) : null}
        <ul className="mt-2 space-y-2">
          {playable.map((nft) => {
            const sealed = getCommitSecret(nft.tokenId, day.day);
            const busy = selectedToken === nft.tokenId && isPending;
            const disabled =
              isPending ||
              locationId == null ||
              phase !== "COMMIT" ||
              sealed?.status === "submitted" ||
              sealed?.status === "revealed" ||
              (nft.side === "Cougar" && locationId === 0);

            return (
              <li key={nft.tokenId} className="hg-list-row">
                <span>
                  #{nft.tokenId} · {nft.side}
                  {nft.side === "Alpaca" ? ` · ${nft.gameplayClass}` : " · W=1"}
                  {sealed ? (
                    <span className="ml-2 text-[0.65rem] text-[#3f9e4a]">
                      · {sealed.status.toUpperCase()} · L{sealed.locationId}
                    </span>
                  ) : null}
                </span>
                <PixelButton
                  variant="gold"
                  size="sm"
                  className="w-auto min-w-[7rem]"
                  disabled={disabled}
                  aria-busy={busy || undefined}
                  onClick={() => void onCommit(nft.tokenId)}
                >
                  {busy
                    ? "COMMITTING…"
                    : sealed?.status === "submitted"
                      ? "SEALED"
                      : "COMMIT"}
                </PixelButton>
              </li>
            );
          })}
        </ul>

        {isPending ? (
          <GameFeedback tone="pending" label={t.common.txPending}>
            Confirm in wallet if prompted, then wait for the transaction.
          </GameFeedback>
        ) : null}
        {statusMsg && !lastError ? (
          <GameFeedback
            tone={
              /closed|cannot|pick a location|fail|error/i.test(statusMsg)
                ? "error"
                : "success"
            }
            label={
              /closed|cannot|pick a location|fail|error/i.test(statusMsg)
                ? t.common.txError
                : t.common.txSuccess
            }
          >
            {statusMsg}
          </GameFeedback>
        ) : null}
        {lastError ? (
          <GameFeedback tone="error" label={t.common.txError}>
            {lastError}
          </GameFeedback>
        ) : null}

        {sealedToday.length > 0 ? (
          <p className="mt-3 text-xs text-[var(--hg-muted)]">
            {sealedToday.length} secret(s) stored for day {day.day}. Reveal will read salt from
            this browser.
          </p>
        ) : null}
      </PixelPanel>
    </div>
  );
}
