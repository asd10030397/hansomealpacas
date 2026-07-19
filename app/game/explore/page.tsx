"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { LocationCard } from "@/components/game/LocationCard";
import { GameFeedback } from "@/components/game/ui/GameFeedback";
import { PixelBadge, PixelButton, PixelPanel } from "@/components/ui/pixel";
import { GAME_LOCATIONS } from "@/data/game/locations";
import { MOCK_NFTS } from "@/data/game/mock";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useGameState } from "@/hooks/game/useGameState";
import { useHansomeCommit } from "@/hooks/game/useHansomeCommit";
import { useOwnedGenesisNfts } from "@/hooks/game/useOwnedGenesisNfts";
import {
  getCommitSecret,
  listCommitSecretsForDay,
  setPendingLocation,
} from "@/lib/game/commitSecret";
import {
  abilityLabelFor,
} from "@/lib/game/genesisIdentity";
import { isHansomeGameConfigured } from "@/lib/game/hansomeGame";
import { GAME_SECTION_IDS } from "@/lib/game/scrollToGameSection";
import { resolveNftDisplaySync, speciesClassLabel } from "@/lib/game/nftDisplay";
import { dispatchPageBackgroundLocation } from "@/lib/game/pageBackground";
import type { LocationId, NftSide } from "@/types/game";

function locationDisplay(locationId: LocationId): string {
  const loc = GAME_LOCATIONS[locationId];
  return `${loc.name} · W${loc.weight}`;
}

export default function ExplorePage() {
  const { t } = useGameI18n();
  const { day, phase } = useGameState();
  const { commitNft, isPending, lastError } = useHansomeCommit();
  const owned = useOwnedGenesisNfts();
  const gameConfigured = isHansomeGameConfigured();
  const usingDemoInventory = !owned.configured || !owned.isConnected;

  const playable = usingDemoInventory
    ? MOCK_NFTS.filter((n) => n.revealed)
    : owned.nfts.filter((n) => n.revealed);

  const [selectedToken, setSelectedToken] = useState<number | null>(null);
  const [committingLocation, setCommittingLocation] = useState<LocationId | null>(
    null,
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [sealedToday, setSealedToday] = useState(() =>
    listCommitSecretsForDay(day.day, owned.address),
  );

  useEffect(() => {
    setSealedToday(listCommitSecretsForDay(day.day, owned.address));
    setStatusMsg(null);
    setCommittingLocation(null);
  }, [day.day, owned.address]);

  // Prefer first uncommitted NFT; keep selection if still valid.
  useEffect(() => {
    if (playable.length === 0) {
      setSelectedToken(null);
      return;
    }
    const stillValid =
      selectedToken != null &&
      playable.some((n) => n.tokenId === selectedToken);
    if (stillValid) return;

    const nextOpen = playable.find((n) => {
      const sealed = getCommitSecret(n.tokenId, day.day, owned.address);
      return sealed?.status !== "submitted" && sealed?.status !== "revealed";
    });
    setSelectedToken(nextOpen?.tokenId ?? playable[0]!.tokenId);
  }, [playable, selectedToken, day.day, owned.address]);

  const selectedNft = useMemo(
    () => playable.find((n) => n.tokenId === selectedToken) ?? null,
    [playable, selectedToken],
  );

  const side: NftSide = selectedNft?.side === "Cougar" ? "Cougar" : "Alpaca";

  const selectedSealed =
    selectedToken != null
      ? getCommitSecret(selectedToken, day.day, owned.address)
      : null;
  const selectedAlreadyCommitted =
    selectedSealed?.status === "submitted" ||
    selectedSealed?.status === "revealed";

  const busy = isPending || committingLocation != null;

  const onCommitHere = async (locationId: LocationId) => {
    if (busy) return;
    if (selectedToken == null || selectedNft == null) {
      setStatusMsg(t.explore.pickNftFirst);
      return;
    }
    if (phase !== "COMMIT") {
      setStatusMsg(t.explore.phaseClosed);
      return;
    }
    if (selectedAlreadyCommitted) {
      setStatusMsg(t.explore.alreadyCommitted);
      return;
    }
    if (selectedNft.side === "Cougar" && locationId === 0) {
      setStatusMsg(t.explore.cougarHomeNote);
      return;
    }
    if (gameConfigured && !owned.isConnected) {
      setStatusMsg(t.explore.connectWallet);
      return;
    }

    setStatusMsg(null);
    setCommittingLocation(locationId);
    setPendingLocation(locationId, day.day);
    dispatchPageBackgroundLocation(locationId);

    const result = await commitNft({
      tokenId: selectedToken,
      day: day.day,
      locationId,
    });

    setSealedToday(listCommitSecretsForDay(day.day, owned.address));
    setCommittingLocation(null);

    if (!result.ok) {
      setStatusMsg(result.error);
      return;
    }

    setStatusMsg(
      t.explore.commitSuccess
        .replace("{tokenId}", String(selectedToken))
        .replace("{location}", locationDisplay(locationId)),
    );

    // Auto-advance to next uncommitted NFT for multi-NFT play.
    const nextOpen = playable.find((n) => {
      if (n.tokenId === selectedToken) return false;
      const sealed = getCommitSecret(n.tokenId, day.day, owned.address);
      return sealed?.status !== "submitted" && sealed?.status !== "revealed";
    });
    if (nextOpen) setSelectedToken(nextOpen.tokenId);
  };

  return (
    <div className="mx-auto max-w-5xl px-3 py-6">
      {!gameConfigured ? (
        <p className="mock-chip mb-3">{t.common.demoBanner}</p>
      ) : null}
      <h1 className="pixel-title text-lg text-[#f0c44a]">{t.explore.heading}</h1>
      <p className="mt-2 text-sm text-[var(--hg-muted)]">{t.explore.blurb}</p>

      <PixelPanel className="mt-4" title={t.explore.flowTitle}>
        <ol className="grid gap-2 sm:grid-cols-5">
          {t.explore.flowSteps.map(([step, hint], i) => (
            <li
              key={step}
              className="border-2 border-[#0d1018] bg-[#121826]/80 px-2 py-2 text-center backdrop-blur-[2px]"
            >
              <p className="pixel-title text-[0.5rem] text-[#f0c44a]">
                {i + 1}. {step}
              </p>
              <p className="mt-1 text-[0.65rem] text-[var(--hg-muted)]">{hint}</p>
            </li>
          ))}
        </ol>
      </PixelPanel>

      <div
        id={GAME_SECTION_IDS.commit}
        className="scroll-mt-[calc(env(safe-area-inset-top,0px)+4.5rem)]"
      >
        <PixelPanel
          className="mt-4"
          title={t.explore.selectNftTitle}
          eyebrow={`DAY ${day.day}`}
        >
          <p className="mb-3 text-xs text-[var(--hg-muted)]">
            {t.explore.selectNftHint}
          </p>

          {usingDemoInventory ? (
            <GameFeedback tone="info" label="Wallet">
              {owned.configured ? t.explore.connectWallet : t.common.demoBanner}
            </GameFeedback>
          ) : null}

          {!usingDemoInventory && owned.isLoading ? (
            <p className="text-sm text-[var(--hg-muted)]">{t.explore.loadingInventory}</p>
          ) : null}

          {!usingDemoInventory && !owned.isLoading && playable.length === 0 ? (
            <GameFeedback tone="info" label="Inventory">
              {t.explore.emptyInventory}
            </GameFeedback>
          ) : null}

          <ul className="commit-nft-list">
            {playable.map((nft) => {
              const sealed = getCommitSecret(nft.tokenId, day.day, owned.address);
              const isDone =
                sealed?.status === "submitted" || sealed?.status === "revealed";
              const isSelected = selectedToken === nft.tokenId;
              const display = resolveNftDisplaySync({
                tokenId: nft.tokenId,
                side: nft.side,
                gameplayClass: nft.gameplayClass,
                image: nft.image,
              });
              const title = speciesClassLabel(display.side, display.gameplayClass);
              const abilityName = abilityLabelFor(
                display.side ?? "Unknown",
                display.gameplayClass ?? "Common",
              );
              const sealedLocation =
                sealed != null ? locationDisplay(sealed.locationId) : null;

              return (
                <li
                  key={nft.tokenId}
                  className={`commit-nft-row${isDone ? " commit-nft-row--done" : ""}${isSelected ? " ring-2 ring-[#f0c44a]" : ""}`}
                >
                  <div className="commit-nft-row__media">
                    <div className="commit-nft-row__art">
                      <Image
                        src={display.image}
                        alt={`#${nft.tokenId} ${title}`}
                        fill
                        className="object-contain p-1"
                        sizes="72px"
                        unoptimized
                      />
                    </div>
                  </div>
                  <div className="commit-nft-row__body">
                    <p className="commit-nft-row__title">
                      #{nft.tokenId} · {title}
                      {display.side === "Cougar" ? " · W=1" : null}
                    </p>
                    <p className="commit-nft-row__ability">
                      <span className="commit-nft-row__ability-name">
                        {abilityName}
                      </span>
                    </p>
                    {isDone && sealedLocation ? (
                      <div className="commit-nft-row__status">
                        <span className="commit-nft-row__submitted">
                          ✓ {t.explore.committedBadge}
                        </span>
                        <span className="commit-nft-row__location">
                          📍 {sealedLocation}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <PixelButton
                    variant={isSelected ? "gold" : "slate"}
                    size="sm"
                    className="commit-nft-row__action"
                    disabled={busy}
                    onClick={() => setSelectedToken(nft.tokenId)}
                  >
                    {isDone
                      ? t.explore.sealed
                      : isSelected
                        ? t.explore.nftSelected
                        : t.explore.selectNftAction}
                  </PixelButton>
                </li>
              );
            })}
          </ul>

          {selectedNft ? (
            <p className="mt-3 text-xs text-[var(--hg-muted)]">
              {t.explore.committingAs
                .replace("{tokenId}", String(selectedNft.tokenId))
                .replace(
                  "{side}",
                  selectedNft.side === "Cougar"
                    ? t.explore.cougarView
                    : t.explore.alpacaView,
                )}
            </p>
          ) : null}
        </PixelPanel>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <PixelBadge tone={side === "Cougar" ? "danger" : "green"}>
            {side === "Cougar" ? t.explore.cougarView : t.explore.alpacaView}
          </PixelBadge>
          {selectedAlreadyCommitted && selectedSealed ? (
            <PixelBadge tone="gold">
              {locationDisplay(selectedSealed.locationId)}
            </PixelBadge>
          ) : null}
          {sealedToday.length > 0 ? (
            <span className="text-xs text-[var(--hg-muted)]">
              {t.explore.committedCount
                .replace("{count}", String(sealedToday.filter((s) => s.status === "submitted" || s.status === "revealed").length))
                .replace("{day}", String(day.day))}
            </span>
          ) : null}
        </div>

        <PixelPanel
          className="mt-4"
          title={t.explore.mapTitle}
          eyebrow={t.explore.mapEyebrow}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GAME_LOCATIONS.map((loc) => {
              const blockedForNft =
                selectedNft?.side === "Cougar" && loc.id === 0;
              const actionDisabled =
                busy ||
                selectedToken == null ||
                selectedAlreadyCommitted ||
                phase !== "COMMIT" ||
                blockedForNft ||
                (gameConfigured && !owned.isConnected);

              return (
                <LocationCard
                  key={loc.id}
                  location={loc}
                  side={side}
                  selected={committingLocation === loc.id}
                  actionLabel={
                    selectedAlreadyCommitted
                      ? t.explore.sealed
                      : t.explore.commitHere
                  }
                  actionBusy={committingLocation === loc.id}
                  actionDisabled={actionDisabled && committingLocation !== loc.id}
                  onAction={(id) => void onCommitHere(id)}
                />
              );
            })}
          </div>
          {side === "Cougar" ? (
            <p className="mt-3 text-xs text-[#c44b3a]">{t.explore.cougarHomeNote}</p>
          ) : null}

          {busy ? (
            <GameFeedback tone="pending" label={t.common.txPending}>
              {t.explore.committingHint}
            </GameFeedback>
          ) : null}

          {statusMsg && !lastError ? (
            <GameFeedback
              tone={
                /closed|cannot|fail|error|blocked|already|connect|pick/i.test(
                  statusMsg,
                )
                  ? "error"
                  : "success"
              }
              label={
                /closed|cannot|fail|error|blocked|already|connect|pick/i.test(
                  statusMsg,
                )
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
        </PixelPanel>
      </div>
    </div>
  );
}
