"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ABILITY_EFFECT_CATALOG,
  hasPlayedAbilityEffect,
  markAbilityEffectPlayed,
  parseAbilityEffectId,
  type AbilityEffectId,
} from "@/lib/game/abilityEffects";
import {
  hasPlayedSettlementResultSfx,
  markSettlementResultSfxPlayed,
  parseSettlementResultSfxId,
  SETTLEMENT_RESULT_SFX_CATALOG,
  type SettlementResultSfxId,
} from "@/lib/game/settlementResults";

export type SettlementPresentationRow = {
  tokenId: number;
  outcome: string;
  ability: string | null;
};

export type SettlementResultCue = {
  kind: "result";
  tokenId: number;
  resultId: SettlementResultSfxId;
  durationMs: number;
};

export type SettlementAbilityCue = {
  kind: "ability";
  tokenId: number;
  abilityId: AbilityEffectId;
};

export type SettlementPresentationCue = SettlementResultCue | SettlementAbilityCue;

function buildPending(
  day: number,
  rows: SettlementPresentationRow[],
): SettlementPresentationCue[] {
  const cues: SettlementPresentationCue[] = [];
  for (const row of rows) {
    const resultId = parseSettlementResultSfxId(row.outcome);
    if (resultId && !hasPlayedSettlementResultSfx(day, row.tokenId, resultId)) {
      cues.push({
        kind: "result",
        tokenId: row.tokenId,
        resultId,
        durationMs: SETTLEMENT_RESULT_SFX_CATALOG[resultId].durationMs,
      });
    }

    const abilityId = parseAbilityEffectId(row.ability);
    if (abilityId && !hasPlayedAbilityEffect(day, row.tokenId, abilityId)) {
      cues.push({
        kind: "ability",
        tokenId: row.tokenId,
        abilityId,
      });
    }
  }
  return cues;
}

/**
 * Settlement presentation queue:
 * per NFT — result VFX/SFX first, then ability VFX/SFX.
 * Overlays call `advance` on complete. Once per result (sessionStorage).
 */
export function useSettlementPresentationQueue(
  day: number,
  rows: SettlementPresentationRow[],
  enabled: boolean,
) {
  const [current, setCurrent] = useState<SettlementPresentationCue | null>(null);
  const playingRef = useRef(false);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const signature = useMemo(
    () =>
      `${day}|${enabled ? 1 : 0}|${rows
        .map((r) => `${r.tokenId}:${r.outcome}:${r.ability ?? ""}`)
        .join("|")}`,
    [day, enabled, rows],
  );

  const pendingCount = useMemo(() => {
    if (!enabled) return 0;
    return buildPending(day, rows).length;
  }, [day, rows, enabled]);

  const startNext = useCallback(() => {
    if (playingRef.current) return;
    if (!enabled) {
      setCurrent(null);
      return;
    }

    const pending = buildPending(day, rowsRef.current);
    const next = pending[0];
    if (!next) {
      setCurrent(null);
      return;
    }

    playingRef.current = true;
    if (next.kind === "result") {
      markSettlementResultSfxPlayed(day, next.tokenId, next.resultId);
    } else {
      markAbilityEffectPlayed(day, next.tokenId, next.abilityId);
    }
    setCurrent(next);
  }, [day, enabled]);

  useEffect(() => {
    if (!enabled) {
      playingRef.current = false;
      setCurrent(null);
      return;
    }
    startNext();
  }, [signature, enabled, startNext]);

  const advance = useCallback(() => {
    playingRef.current = false;
    setCurrent(null);
    queueMicrotask(() => startNext());
  }, [startNext]);

  const currentAbility =
    current?.kind === "ability"
      ? {
          tokenId: current.tokenId,
          abilityId: current.abilityId,
          durationMs: ABILITY_EFFECT_CATALOG[current.abilityId].durationMs,
        }
      : null;

  const currentResult =
    current?.kind === "result"
      ? {
          tokenId: current.tokenId,
          resultId: current.resultId,
          durationMs: current.durationMs,
        }
      : null;

  const queueStatus = !enabled
    ? "idle"
    : current
      ? `playing:${current.kind}`
      : pendingCount > 0
        ? "queued"
        : "idle";

  return {
    current,
    currentAbility,
    currentResult,
    advance,
    busy: current != null,
    pendingCount,
    queueStatus,
  };
}
