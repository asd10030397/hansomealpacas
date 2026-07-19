"use client";

import { useState } from "react";
import { GameStatusPanel } from "@/components/game/GameStatusPanel";
import {
  GameEmptyState,
  GameFeedback,
} from "@/components/game/ui/GameFeedback";
import { PixelButton, PixelPanel } from "@/components/ui/pixel";
import { GAME_LOCATIONS } from "@/data/game/locations";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useGameState } from "@/hooks/game/useGameState";
import { useHansomeReveal } from "@/hooks/game/useHansomeReveal";
import { listCommitSecretsForDay } from "@/lib/game/commitSecret";

export default function RevealPage() {
  const { t } = useGameI18n();
  const gameHref = useGameHref();
  const { day, now, phaseEndsAt, phase, isMock } = useGameState();
  const { revealNft, configured, isPending, lastError } = useHansomeReveal();
  const [queue, setQueue] = useState(() => listCommitSecretsForDay(day.day));
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const onReveal = async (tokenId: number) => {
    if (phase !== "REVEAL") {
      setStatusMsg(`Reveal Move window closed (phase is ${phase}).`);
      return;
    }
    setBusyId(tokenId);
    const result = await revealNft({ tokenId, day: day.day });
    setQueue(listCommitSecretsForDay(day.day));
    setBusyId(null);

    if (!result.ok) {
      setStatusMsg(result.error);
      return;
    }

    const loc = GAME_LOCATIONS[result.record.locationId]?.name ?? "?";
    setStatusMsg(
      result.mode === "chain"
        ? `Reveal Move #${tokenId} on-chain → ${loc}.`
        : `Reveal Move #${tokenId} locally → ${loc}. ` +
            (configured
              ? "Connect wallet for on-chain Reveal Move."
              : "Game contract not deployed yet — local Reveal Move recorded."),
    );
  };

  const pending = queue.filter((r) => r.status === "submitted" || r.status === "prepared");
  const done = queue.filter((r) => r.status === "revealed");

  return (
    <div className="mx-auto max-w-3xl px-3 py-6">
      {isMock ? <p className="mock-chip mb-3">{t.common.demoBanner}</p> : null}
      <h1 className="pixel-title text-lg text-[#f0c44a]">{t.reveal.heading}</h1>
      <p className="mt-2 text-sm text-[var(--hg-muted)]">{t.reveal.blurb}</p>
      <div className="mt-4">
        <GameStatusPanel day={day} now={now} phaseEndsAt={phaseEndsAt} phase={phase} />
      </div>

      <PixelPanel
        className="mt-4"
        title="REVEAL MOVE QUEUE"
        eyebrow={configured ? "CHAIN READY WHEN CONNECTED" : "LOCAL SECRETS · AWAITING GAME DEPLOY"}
      >
        {phase !== "REVEAL" ? (
          <GameFeedback tone="info" label={t.common.phaseChanged}>
            Current phase is {phase}. Switch demo phase to REVEAL on Dashboard to test Reveal Move.
          </GameFeedback>
        ) : null}

        {pending.length === 0 && done.length === 0 ? (
          <GameEmptyState title={t.common.emptyTitle}>
            No commit secrets for day {day.day} on this device.
            <div className="mt-3">
              <PixelButton href={gameHref.commit} variant="green" size="sm" className="w-auto">
                GO TO COMMIT MOVE
              </PixelButton>
            </div>
          </GameEmptyState>
        ) : (
          <ul className="mt-2 space-y-2">
            {[...pending, ...done].map((secret) => {
              const loc = GAME_LOCATIONS[secret.locationId];
              const revealed = secret.status === "revealed";
              const busy = busyId === secret.tokenId && isPending;
              return (
                <li key={`${secret.day}-${secret.tokenId}`} className="hg-list-row">
                  <span>
                    #{secret.tokenId} · {loc?.name ?? `L${secret.locationId}`}
                    <span className="ml-2 text-[0.65rem] text-[var(--hg-muted)]">
                      · {secret.status.toUpperCase()}
                    </span>
                  </span>
                  <PixelButton
                    variant="gold"
                    size="sm"
                    className="w-auto min-w-[7rem]"
                    disabled={
                      revealed || isPending || phase !== "REVEAL" || busyId === secret.tokenId
                    }
                    aria-busy={busy || undefined}
                    onClick={() => void onReveal(secret.tokenId)}
                  >
                    {busy ? "REVEALING…" : revealed ? "REVEALED" : "REVEAL MOVE"}
                  </PixelButton>
                </li>
              );
            })}
          </ul>
        )}

        {isPending ? (
          <GameFeedback tone="pending" label={t.common.txPending}>
            Confirm in wallet if prompted, then wait for the transaction.
          </GameFeedback>
        ) : null}
        {statusMsg && !lastError ? (
          <GameFeedback
            tone={statusMsg.toLowerCase().includes("fail") || statusMsg.toLowerCase().includes("closed") ? "error" : "success"}
            label={
              statusMsg.toLowerCase().includes("fail") || statusMsg.toLowerCase().includes("closed")
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
  );
}
