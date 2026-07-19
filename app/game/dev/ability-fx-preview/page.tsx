"use client";

/**
 * DEV ONLY — visual/SFX preview for Season 1 ability presentations.
 * Not linked from production nav. Visit /game/dev/ability-fx-preview
 */

import { useCallback, useEffect, useState } from "react";
import { AbilityEffectOverlay } from "@/components/game/ability-effects/AbilityEffectOverlay";
import {
  ABILITY_EFFECT_CATALOG,
  ABILITY_EFFECT_IDS,
  type AbilityEffectId,
} from "@/lib/game/abilityEffects";
import { loadAudioPreferences, saveAudioPreferences } from "@/lib/game/audio";

const SEQUENCE: AbilityEffectId[] = [...ABILITY_EFFECT_IDS];
const GAP_MS = 450;

export default function AbilityFxPreviewPage() {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(-1);
  const [activeId, setActiveId] = useState<AbilityEffectId | null>(null);
  const [done, setDone] = useState(false);
  const [sfxOn, setSfxOn] = useState(true);
  const [singleShot, setSingleShot] = useState(false);

  const start = useCallback(() => {
    const prefs = loadAudioPreferences();
    saveAudioPreferences({ ...prefs, sfxEnabled: true });
    setSfxOn(true);
    setDone(false);
    setSingleShot(false);
    setStarted(true);
    setIndex(0);
    setActiveId(SEQUENCE[0]!);
  }, []);

  const playOne = useCallback((id: AbilityEffectId) => {
    const prefs = loadAudioPreferences();
    saveAudioPreferences({ ...prefs, sfxEnabled: true });
    setSfxOn(true);
    setDone(false);
    setSingleShot(true);
    setStarted(true);
    setIndex(SEQUENCE.indexOf(id));
    setActiveId(id);
  }, []);

  useEffect(() => {
    const prefs = loadAudioPreferences();
    setSfxOn(prefs.sfxEnabled);
  }, []);

  // Dev helpers:
  //   ?autostart=1
  //   ?ability=king  (single ability)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const only = params.get("ability") as AbilityEffectId | null;
    if (only && ABILITY_EFFECT_IDS.includes(only)) {
      const t = window.setTimeout(() => playOne(only), 400);
      return () => window.clearTimeout(t);
    }
    if (params.get("autostart") !== "1") return;
    const t = window.setTimeout(() => start(), 400);
    return () => window.clearTimeout(t);
  }, [start, playOne]);

  const onComplete = useCallback(() => {
    setActiveId(null);
    if (singleShot) {
      setDone(true);
      return;
    }
    const next = index + 1;
    if (next >= SEQUENCE.length) {
      setDone(true);
      setIndex(-1);
      return;
    }
    window.setTimeout(() => {
      setIndex(next);
      setActiveId(SEQUENCE[next]!);
    }, GAP_MS);
  }, [index, singleShot]);

  const current = activeId ? ABILITY_EFFECT_CATALOG[activeId] : null;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col px-4 py-8">
      <p className="mock-chip mb-3" data-testid="ability-fx-preview-badge">
        DEV PREVIEW — ability VFX + SFX
      </p>
      <h1 className="pixel-title text-lg text-[#f0c44a]">ABILITY FX PREVIEW</h1>
      <p className="mt-2 text-sm text-[var(--hg-muted)]">
        Plays Guardian → Runner → Lucky → Farmer → King once. SFX uses the game
        SFX channel (forced on for this preview).
      </p>
      <p className="mt-1 text-xs text-[var(--hg-muted)]" data-testid="sfx-status">
        SFX: {sfxOn ? "ON" : "OFF"}
      </p>

      <div
        className="relative mt-6 min-h-[14rem] overflow-hidden border-2 border-[#2a3348] bg-[#121826]"
        data-testid="ability-fx-stage"
      >
        <div className="flex h-full min-h-[14rem] flex-col items-center justify-center gap-2 px-4 py-6">
          <div className="flex h-24 w-24 items-center justify-center border border-[#3a4560] bg-[#1a2233] text-[0.65rem] text-[var(--hg-muted)]">
            NFT
          </div>
          <p className="pixel-title text-[0.7rem] text-[#f0c44a]" data-testid="ability-fx-label">
            {current?.banner ?? (done ? "SEQUENCE COMPLETE" : "READY")}
          </p>
          <p className="text-xs text-[var(--hg-muted)]" data-testid="ability-fx-step">
            {activeId
              ? `${index + 1} / ${SEQUENCE.length} · ${activeId}`
              : done
                ? "done"
                : "idle"}
          </p>
        </div>
        {activeId ? (
          <AbilityEffectOverlay
            key={`${activeId}-${index}`}
            abilityId={activeId}
            active
            onComplete={onComplete}
          />
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="border-2 border-[#f0c44a] bg-[#2a2410] px-4 py-2 text-sm text-[#f0c44a]"
          data-testid="ability-fx-start"
          onClick={start}
          disabled={started && !done && activeId != null}
        >
          {done ? "REPLAY ALL (SFX ON)" : started ? "PLAYING…" : "START PREVIEW (SFX ON)"}
        </button>
      </div>

      <ol className="mt-6 space-y-1 text-xs text-[var(--hg-muted)]">
        {SEQUENCE.map((id, i) => (
          <li key={id}>
            <button
              type="button"
              data-testid={`ability-fx-item-${id}`}
              className={
                id === activeId
                  ? "text-[#f0c44a]"
                  : i < index || done
                    ? "text-[#3f9e4a]"
                    : undefined
              }
              onClick={() => playOne(id)}
            >
              {i + 1}. {ABILITY_EFFECT_CATALOG[id].banner}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
