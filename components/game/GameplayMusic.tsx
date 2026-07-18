"use client";

import { useEffect, useRef } from "react";
import { useAudioSettings } from "@/hooks/game/useAudioSettings";
import {
  mountGameplayMusic,
  setGameplayMusicEnabled,
} from "@/lib/game/gameplay-music";
import { hasAmbientStarted } from "@/lib/ambient-sound";

/**
 * Battle-mode HANSOME theme for /game/*.
 * Crossfades from site ambient; respects ♪ Music toggle only.
 * Phase impacts / UI cues must use playSfx() + SFX toggle (not Music).
 */
export function GameplayMusic() {
  const { prefs, hydrated, setMusicEnabled } = useAudioSettings();
  const ambientHandoffDone = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    return mountGameplayMusic();
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;

    // Continuity: site ambient already unlocked → enter battle theme without silence.
    if (!ambientHandoffDone.current && hasAmbientStarted() && !prefs.musicEnabled) {
      ambientHandoffDone.current = true;
      setMusicEnabled(true);
      return;
    }

    ambientHandoffDone.current = true;
    setGameplayMusicEnabled(prefs.musicEnabled);
  }, [hydrated, prefs.musicEnabled, setMusicEnabled]);

  return null;
}
