"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAudioSettings } from "@/hooks/game/useAudioSettings";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import {
  isGameplayMusicAwaitingUnlock,
  mountGameplayMusic,
  setGameplayMusicEnabled,
  subscribeGameplayMusicUnlock,
} from "@/lib/game/gameplay-music";
import { stopAmbientSoundHard } from "@/lib/ambient-sound";

/**
 * Alpaca Warpath for the Game section only.
 * Hard-stops marketing ambient; never falls back to homepage BGM.
 * Autoplay-blocked: Music toggle stays ON; track starts on first interaction.
 */
export function GameplayMusic() {
  const { prefs, hydrated } = useAudioSettings();

  useEffect(() => {
    if (!hydrated) return;
    stopAmbientSoundHard();
    return mountGameplayMusic();
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    stopAmbientSoundHard();
    setGameplayMusicEnabled(prefs.musicEnabled);
  }, [hydrated, prefs.musicEnabled]);

  return <GameAudioUnlockPrompt musicEnabled={hydrated && prefs.musicEnabled} />;
}

function GameAudioUnlockPrompt({ musicEnabled }: { musicEnabled: boolean }) {
  const { t } = useGameI18n();
  const awaiting = useSyncExternalStore(
    subscribeGameplayMusicUnlock,
    isGameplayMusicAwaitingUnlock,
    () => false,
  );

  if (!musicEnabled || !awaiting) return null;

  return (
    <button
      type="button"
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[60] -translate-x-1/2 rounded-md border border-[#3a4558] bg-[#121826]/95 px-3 py-2 text-[0.65rem] font-semibold tracking-wide text-[#e8dfd2] shadow-lg backdrop-blur-sm md:bottom-4"
      aria-live="polite"
    >
      {t.common.tapToEnableAudio}
    </button>
  );
}
