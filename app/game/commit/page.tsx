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

function locationDisplay(locationId: LocationId): string {
  const loc = GAME_LOCATIONS[locationId];
  return `${loc.name} · W${loc.weight}`;
}

export default function CommitPage() {
  const { t } = useGameI18n();
  const gameHref = useGameHref();
  const { day, now, phaseEndsAt, phase, isMock } = useGameState();
  const { commitNft, isPending, lastError } = useHansomeCommit();
  const owned = useOwnedGenesisNfts();
  const gameConfigured = isHansomeGameConfigured();
  /** Preview inventory when chain is live but wallet is not connected. */
  const usingDemoInventory = !gameConfigured || !owned.isConnected;

  const playable = usingDemoInventory
    ? MOCK_NFTS.filter((n) => n.revealed)
    : owned.nfts.filter((n) => n.revealed);
  const [locationId, setLocationId] = useState<LocationId | null>(null);
  const [selectedToken, setSelectedToken] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [sealedToday, setSealedToday] = useState(() =>
    listCommitSecretsForDay(day.day),
  );

  useEffect(() => {
    setSealedToday(listCommitSecretsForDay(day.day));
  }, [day.day]);

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
    return locationDisplay(locationId);
  }, [locationId]);

  const committedCount = new Set(
    sealedToday
      .filter((s) => s.status === "submitted" || s.status === "revealed")
      .map((s) => s.tokenId),
  ).size;

  const onCommit = async (tokenId: number) => {
    if (locationId == null) {
      setStatusMsg(t.commit.pickLocationFirst);
      return;
    }
    if (phase !== "COMMIT") {
      setStatusMsg(t.commit.phaseClosed);
      return;
    }
    const nft = playable.find((n) => n.tokenId === tokenId);
    if (nft?.side === "Cougar" && locationId === 0) {
      setStatusMsg(t.commit.cougarHomeBlocked);
      return;
    }

    if (gameConfigured && !owned.isConnected) {
      setStatusMsg(t.commit.connectWallet);
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

    setStatusMsg(
      t.commit.commitSuccess
        .replace("{tokenId}", String(tokenId))
        .replace("{location}", locationDisplay(locationId)),
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-3 py-6">
      {isMock ? <p className="mock-chip mb-3">{t.common.demoBanner}</p> : null}
      <h1 className="pixel-title text-lg text-[#f0c44a]">{t.commit.heading}</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--hg-muted)]">
        {t.commit.blurb}
      </p>
      <div className="mt-4">
        <GameStatusPanel day={day} now={now} phaseEndsAt={phaseEndsAt} />
      </div>

      <PixelPanel
        className="mt-4"
        title={t.commit.locationTitle}
        eyebrow={t.commit.locationEyebrow}
      >
        {locationLabel ? (
          <p className="commit-location-pill">{locationLabel}</p>
        ) : (
          <p className="text-sm text-[var(--hg-muted)]">{t.commit.noLocation}</p>
        )}
        <PixelButton href={gameHref.explore} variant="green" className="mt-3" size="sm">
          {t.commit.openMap}
        </PixelButton>
      </PixelPanel>

      <PixelPanel
        className="mt-4"
        title={t.commit.selectNftTitle}
        eyebrow={`DAY ${day.day}`}
      >
        {phase !== "COMMIT" ? (
          <GameFeedback tone="info" label={t.common.phaseChanged}>
            {t.commit.phaseCommitOnly.replace("{phase}", phase)}
          </GameFeedback>
        ) : null}
        {usingDemoInventory ? (
          <GameFeedback tone="info" label="Wallet">
            {gameConfigured ? t.commit.connectWallet : t.common.demoBanner}
          </GameFeedback>
        ) : null}
        {gameConfigured && owned.isConnected && owned.isLoading ? (
          <p className="mt-2 text-sm text-[var(--hg-muted)]">
            {t.commit.loadingInventory}
          </p>
        ) : null}
        {gameConfigured &&
        owned.isConnected &&
        !owned.isLoading &&
        playable.length === 0 ? (
          <GameFeedback tone="info" label="Inventory">
            {t.commit.emptyInventory}
          </GameFeedback>
        ) : null}

        <ul className="commit-nft-list">
          {playable.map((nft) => {
            const sealed = getCommitSecret(nft.tokenId, day.day);
            const isDone =
              sealed?.status === "submitted" || sealed?.status === "revealed";
            const busy = selectedToken === nft.tokenId && isPending;
            const disabled =
              isPending ||
              locationId == null ||
              phase !== "COMMIT" ||
              isDone ||
              (gameConfigured && !owned.isConnected) ||
              (nft.side === "Cougar" && locationId === 0);

            const sealedLocation =
              sealed != null ? locationDisplay(sealed.locationId) : null;

            return (
              <li
                key={nft.tokenId}
                className={`commit-nft-row${isDone ? " commit-nft-row--done" : ""}`}
              >
                <div className="commit-nft-row__body">
                  <p className="commit-nft-row__title">
                    #{nft.tokenId} · {nft.side}
                    {nft.side === "Alpaca" ? ` · ${nft.gameplayClass}` : " · W=1"}
                  </p>
                  {isDone && sealedLocation ? (
                    <div className="commit-nft-row__status" aria-label={`${t.commit.submitted}, ${sealedLocation}`}>
                      <span className="commit-nft-row__submitted">
                        ✓ {t.commit.submitted}
                      </span>
                      <span className="commit-nft-row__location">
                        📍 {sealedLocation}
                      </span>
                    </div>
                  ) : null}
                </div>
                <PixelButton
                  variant={isDone ? "ghost" : "gold"}
                  size="sm"
                  className="commit-nft-row__action"
                  disabled={disabled}
                  aria-busy={busy || undefined}
                  onClick={() => void onCommit(nft.tokenId)}
                >
                  {busy
                    ? t.commit.committing
                    : isDone
                      ? t.commit.sealed
                      : t.commit.commitAction}
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
              /closed|cannot|pick a location|fail|error|blocked/i.test(statusMsg)
                ? "error"
                : "success"
            }
            label={
              /closed|cannot|pick a location|fail|error|blocked/i.test(statusMsg)
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

        {committedCount > 0 ? (
          <p className="mt-3 text-xs text-[var(--hg-muted)]">
            {t.commit.committedCount
              .replace("{count}", String(committedCount))
              .replace("{day}", String(day.day))}
          </p>
        ) : null}
      </PixelPanel>
    </div>
  );
}
