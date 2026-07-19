"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadAudioPreferences,
  saveAudioPreferences,
  type AudioPreferences,
} from "@/lib/game/audio";

export function useAudioSettings() {
  const [prefs, setPrefs] = useState<AudioPreferences>({
    musicEnabled: true,
    sfxEnabled: true,
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPrefs(loadAudioPreferences());
    setHydrated(true);
  }, []);

  const setMusicEnabled = useCallback((musicEnabled: boolean) => {
    setPrefs((p) => {
      const next = { ...p, musicEnabled };
      saveAudioPreferences(next);
      return next;
    });
  }, []);

  const setSfxEnabled = useCallback((sfxEnabled: boolean) => {
    setPrefs((p) => {
      const next = { ...p, sfxEnabled };
      saveAudioPreferences(next);
      return next;
    });
  }, []);

  return { prefs, hydrated, setMusicEnabled, setSfxEnabled };
}
